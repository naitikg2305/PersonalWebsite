---
title: "Debugging Spark ETL on EMR: Shell Quoting, AQE, and Silent Data Bugs"
category: "Data Platforms & Orchestration"
slug: "data-platform-spark-on-emr-debugging"
summary: "Hard-won lessons from running Spark SQL ETL on Amazon EMR, from bash brace expansion corrupting JSON arguments to AQE settings that do nothing and partition reads that silently return nothing."
---

# Debugging Spark ETL on EMR: Shell Quoting, AQE, and Silent Data Bugs

Spark on Amazon EMR is a common workhorse for ML feature pipelines. A scheduler starts a cluster, ships your code, runs `spark-submit` on the master node, and writes Parquet to S3 that is registered as Hive tables. The bugs that hurt most in this setup are rarely Spark bugs. They come from the layers around Spark: the shell that builds the command, the config flags that look enabled but aren't, and the data that silently isn't there.

These are the lessons I collected while running and extending a scheduled ML ETL on EMR. On that engagement I also helped build a new branch of about ten Spark SQL jobs that materialise a training dataset.

## 1. Bash brace expansion ate my JSON

### The setup

The pipeline's entry point accepted a `_config_` argument: a JSON object deep-merged over the job's YAML config. It let you shrink the lookback window for a smoke test without redeploying. Because quotes get mangled as values pass through a scheduler, a CLI, and a remote shell, the convention was to write `*` in place of `"`, and the Python entry point did `.replace("*", '"')` before `json.loads`.

```bash
-p _config_ '{*dev*:{*job_etl*:{*lookback_days*:2,*val_test_days*:1}}}'
```

### What happened

The run spent about 23 minutes provisioning a cluster, then died a few seconds into `spark-submit`:

```
json.decoder.JSONDecodeError: Expecting ',' delimiter: line 1 column 34 (char 33)
```

The JSON was valid, and I had checked it with `json.loads` locally. The problem was that the value ended up **unquoted inside a `spark-submit` command executed by bash on the EMR master**. To bash, `{a,b}` is a **brace-expansion pattern**, like `file{1,2}.txt`. So the remote shell rewrote my JSON into several words before Python ever saw it:

```bash
$ set -- {*dev*:{*job_etl*:{*lookback_days*:2,*val_test_days*:1,*skip*:true}}}
$ echo $#            # 3 tokens, not 1
$ echo "$1"
{*dev*:{*job_etl*:*lookback_days*:2}}     # inner braces stripped
```

It got worse: the entry point used `argparse`'s `parse_known_args()`, so tokens 2 and 3 were **silently dropped** as unknown arguments. Only the mangled first token reached `json.loads`.

### The fix

Escape every comma as `\,`. That stops brace expansion, and after quote removal the value is a literal comma again:

```bash
-p _config_ '{*dev*:{*job_etl*:{*lookback_days*:2\,*val_test_days*:1\,*skip*:true}}}'
```

A single-key override with no comma needs no escaping, which is why the bug only appeared once I added a second key.

### The lesson: test the round trip, not the payload

Validating JSON locally proves nothing when a shell sits between you and the parser. Before spending money on a cluster, I now push the value through the same kind of shell and then through the same parser:

```bash
bash -c 'set -- <YOUR_VALUE>; echo "argc=$#"; echo -n "$1"' \
  | tail -n +2 \
  | python3 -c "import sys,json; print(json.loads(sys.stdin.read().replace('*','\"')))"
```

Two more takeaways:

- **Values that work in a UI are not automatically CLI-safe.** The team's documented example had an unescaped comma, and it worked because it had been entered in the Azkaban web UI, which doesn't go through the same shell path.
- **`parse_known_args` hides bugs.** It's convenient when a scheduler injects extra arguments, but it turns "your argument got split" into silent data loss. Log `sys.argv` at startup.

The deeper fix is to never interpolate structured data into a shell command. Base64-encode it, write it to a file in S3 and pass the path, or build the command as an argv list instead of a string.

## 2. Spark AQE: config flags that silently do nothing

Reading the job's `spark-submit` flags, I found:

```
--conf spark.sql.adaptive.skewJoin.enabled=true
--conf spark.sql.adaptive.enabled=false
```

Skew-join handling is a feature of **Adaptive Query Execution (AQE)**. With AQE disabled, `skewJoin.enabled=true` is inert: it reads like protection against skew and does nothing. AQE (on by default since Spark 3.2) re-plans at shuffle boundaries using runtime statistics. It coalesces small shuffle partitions, splits skewed partitions in sort-merge joins, and can switch a join to broadcast once it sees the real sizes.

When our new feature jobs started hitting skew and executor starvation, turning AQE on was one of the fixes. Others in the same tuning pass:

- **Disabled automatic broadcast joins** (`spark.sql.autoBroadcastJoinThreshold=-1`) on the cluster after joins hit OOM because size estimates were wrong.
- **`DISTRIBUTE BY` the partition key before partitioned writes.** Without it, every task writes a file into every partition it touches, and four fan-out writes produced a small-file explosion.
- **Raised `spark.sql.files.maxPartitionBytes`** (to 512 MB) on the read side to cut task count on wide scans.
- **Serialised jobs that had been running in parallel on the same cluster.** Parallel DAG branches look efficient, but they compete for the same executors. One heavy branch starved the others and flooded logs.
- **Materialised a reused intermediate** instead of recomputing it in several downstream queries.

I also noticed `dynamicAllocation=true` set alongside a fixed `spark.executor.instances`. That isn't an error, but the intent is ambiguous, and it's worth deciding which one you actually want.

## 3. Partition reads that silently return nothing

This class of bug is the scariest because **the flow succeeds**.

- **A missing partition is an empty DataFrame, not an error.** Spark reading `WHERE event_date BETWEEN a AND b` from a Hive table with no partitions in that range returns zero rows. Downstream joins and aggregations then produce null or zero features, and the job writes a "valid" but meaningless dataset. In a dev environment where tables are only partially synced from prod, this is the default outcome unless you check.
- **Single-partition reads where a range was needed.** One lookup job read `run_date = X` from a table that is only written on some days. On days without a write, the features came out zero-filled. The fix was to read a `run_date` *range* and take the latest value per key.
- **Proxy dependencies.** The declared upstream dependency for one input was a *current-state* table, used as a proxy because the *history* table it really read wasn't registered with the dependency tracker. Syncing the declared table and not the real one gave silently empty results.

My defences now:

```sql
-- before the run: does the window exist, and is it complete?
SELECT count(DISTINCT event_date) FROM my_db.my_events
WHERE event_date BETWEEN DATE '2026-01-01' AND DATE '2026-03-01';   -- expect 60
```

I also put **in-job row-count assertions** on every layer (fail if a layer is more than about 20% off its baseline) and check for Spark's `_SUCCESS` marker in each output prefix. Spark only writes it on a clean job commit.

## 4. Smaller Spark SQL portability gotchas

- **`SELECT * EXCEPT (col)` is Databricks/BigQuery syntax, not Apache Spark SQL** on EMR. Use an explicit column list.
- **`LATERAL VIEW explode(...)` before the JOIN**, not after, or the join semantics change. Guard against `NULL` arrays, because `explode` drops those rows, so use `explode_outer` or `coalesce` to an empty array.
- **Drop-and-recreate on schema drift.** `CREATE TABLE IF NOT EXISTS` followed by an insert fails once the column list changes. Proper versioned DDL is better than ad-hoc `DROP TABLE` blocks.
- **Writes in `overwrite` mode scoped by partition** only replace that partition. But a "drop partition if exists, then add" step de-registers the old partition metadata even though the external data files survive.
- **Bootstrap actions should be minimal.** A package that couldn't build from source on the EMR image (`fasttext`) needed a prebuilt wheel variant. Pin what you must, but keep heavy installs out of cluster bootstrap.

## 5. Make sure dev writes stay in dev

When I cloned a production module to build an experimental version, one job still wrote to the **production** priors table. The fix was simple, but the habit I took from it is to grep every new job for output locations before its first run. The reverse case existed too: one dev table's *base* location pointed at the prod bucket, an artifact of copied DDL, while each dev partition had an explicit dev location. Check `SHOW CREATE TABLE` *and* the partition locations before concluding where data actually goes.

## Key takeaways

- Never let a shell interpolate JSON. If you must, escape commas (`\,`) and test the full shell-to-parser round trip.
- `parse_known_args` can silently drop the pieces of a split argument. Log `argv`.
- `spark.sql.adaptive.skewJoin.enabled` does nothing without `spark.sql.adaptive.enabled=true`.
- Partitioned writes need `DISTRIBUTE BY` the partition key, or you get a small-file explosion.
- Missing partitions mean empty DataFrames, not errors. Verify input coverage and assert on row counts.
- Audit every output path in a cloned job before its first run.
