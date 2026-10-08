---
title: "Querying a Hive Data Lake with Presto/Trino and Redash: Patterns and Footguns"
category: "Data Platforms & Orchestration"
slug: "data-platform-presto-trino-redash-querying"
summary: "How Presto/Trino and Redash fit together over a Hive data lake, a reliable discovery workflow, and the SQL mistakes that return wrong answers instead of errors."
---

# Querying a Hive Data Lake with Presto/Trino and Redash: Patterns and Footguns

In a typical Hadoop-lineage data lake, tables are Parquet files on S3, partitioned by date and registered in a **Hive metastore**. Spark writes them. For reading, especially interactively, most teams use **Presto** or its fork **Trino**, a distributed SQL engine that queries the files in place. **Redash** often sits on top as the shared web UI for ad-hoc queries, saved queries, and dashboards.

I used this stack daily on a client engagement to check ETL inputs, validate pipeline outputs, and pull data for analysis. Most of the useful lessons were about queries that **succeed and return the wrong answer**.

## How the pieces fit

| Surface | What it is | Best for |
|---|---|---|
| **Redash** (web UI or its REST API) | BI/query tool; a "data source" points at a Presto/Trino cluster | Shared, saved, and parameterised queries; quick reads |
| **Trino CLI / Python client** | Direct connection to a cluster | Scripting, and environments Redash isn't wired to |
| **Spark SQL** | What the ETL itself runs on EMR | Production transforms |

Redash and a direct Trino client hitting the same cluster see the **same data**. Picking between them is about ergonomics. The real differences:

- **Each Redash instance is bound to one environment's warehouse.** Checking a dev pipeline's output needs the dev instance (with its own API key) or a direct dev Trino connection.
- **Your ETL is Spark SQL, but the query engine speaks Presto SQL.** The dialects differ (`NVL` vs `coalesce`, date functions, `LATERAL VIEW explode` vs `CROSS JOIN UNNEST`). Our internal CLI used **sqlglot** to transpile Spark SQL to Presto before running it. That let me sanity-check ETL SQL logic against real data in seconds instead of spending a 25-minute cluster spin-up on it:

```python
import sqlglot
presto_sql = sqlglot.transpile(spark_sql, read="spark", write="presto")[0]
```

## Redash's API in five calls

There wasn't a CLI for Redash on my machine, so I wrote a small stdlib-only one. The API is simple and asynchronous:

```text
Authorization: Key <api-key>                      # per-user key, per Redash instance

GET    /api/data_sources                          # resolve the data source name -> id
POST   /api/query_results   {data_source_id, query, max_age: 0}   -> returns a job
GET    /api/jobs/<job_id>                         # poll: status 3 = success, 4 = failure, 5 = cancelled
GET    /api/query_results/<query_result_id>       # fetch rows
DELETE /api/jobs/<job_id>                         # cancel on client-side timeout
```

Two design choices I'd repeat:

- **Cancel on timeout.** If the client gives up, send `DELETE` so the query doesn't keep burning warehouse capacity as an orphan.
- **Print a loud warning on zero rows** (see footgun #2 below).

Redash-specific constraints: **one statement per query** (no `;`-separated batches, and strip trailing semicolons and `--` comments when you send SQL files through the API), and **avoid literal `{{ }}`**, because Redash treats `{{name}}` as a query parameter.

## A discovery workflow that works

When I meet an unfamiliar table, I go through these steps in order:

```sql
-- 1. find it
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_name LIKE '%session%';

-- 2. describe it
DESCRIBE my_db.my_events;
SHOW CREATE TABLE my_db.my_events;          -- partition keys + external S3 location

-- 3. which partitions actually exist?
SELECT * FROM "my_db"."my_events$partitions" ORDER BY 1 DESC LIMIT 20;

-- 4. only now, a partition-filtered query
SELECT ... FROM my_db.my_events WHERE event_date = DATE '2026-01-14';
```

The `"$partitions"` hidden table (Hive connector) is the most useful thing here. It reads metastore metadata only, so it costs almost nothing and tells you what data exists before you query it. `SHOW CREATE TABLE` also gives you the S3 location without needing cloud credentials.

## Footguns: wrong answers, not errors

### 1. Integer division truncates to zero

In Presto/Trino, `bigint / bigint` is integer division. A click-through rate computed as `clicks / impressions` comes back as **0**, with no error.

```sql
-- WRONG: always 0
SELECT sum(clicked) / count(*) FROM t;
-- RIGHT
SELECT sum(clicked) * 1e0 / count(*) FROM t;           -- or CAST(... AS double)
```

### 2. Zero rows is not "no data"

A filter on a partition value that doesn't exist (wrong date, wrong granularity, partition not landed yet) returns **zero rows**, not an error. Before concluding anything from an empty result, check `$partitions`. The same thing in Spark is worse: the pipeline "succeeds" on an empty DataFrame.

### 3. Always filter the partition column

Event tables can hold millions of rows per day. Without a partition predicate, a query scans every file in the table, which is slow and expensive for everyone sharing the cluster.

### 4. Partition granularity varies

Some tables are partitioned **monthly** (the partition value is the first of the month). To get one day, filter **both** the partition column and the real date column. Otherwise you scan or return the whole month.

### 5. Know the grain

If a table has one row per *(session, module, item shown)*, then `COUNT(*)` counts **impressions**, not sessions. Use `COUNT(DISTINCT session_id)` for sessions. Averaging a flag over rows is **row-weighted**: sessions with more rows count more. For a true session-level rate, aggregate to session grain first, then average.

### 6. Case-sensitive join keys in raw data

Raw clickstream IDs aren't always consistently cased. `LOWER()` both sides of the join, or the join quietly drops matches.

### 7. Dev is not prod

Dev warehouses only contain what was synced or produced there. Use dev to confirm a pipeline's inputs and outputs exist, and get any number you'll report to others from prod.

### 8. `USING` joins change column references

After `JOIN ... USING (session_id)`, refer to the key bare (`session_id`), not qualified (`t.session_id`). Engines differ on whether the qualified form works.

## Analysis lessons that came out of careful querying

Being strict about grain and weighting paid off in the analysis itself:

- **Position-bias curves weren't monotonic.** Click-through rate by display rank came out U-shaped, because users who scroll deep self-select. A naive "CTR decays with position" correction would have been miscalibrated.
- **Layout and position were confounded.** One layout type dominated impressions and one high-volume module dominated a whole layout bucket. Any per-position estimate has to control for layout.
- **Baselines catch broken pipelines.** We kept per-layer daily row-count baselines and treated a deviation of more than about 20% as "stop and diagnose" before anyone looked at model metrics.

## Key takeaways

- Redash and Trino are two interfaces to the same engine, and each instance is tied to one environment.
- Use `"$partitions"` and `SHOW CREATE TABLE` before querying an unfamiliar table.
- Integer division, empty partitions, mixed partition granularity, and row-weighted averages all fail silently.
- Transpile Spark SQL to Presto (sqlglot) to validate ETL logic before you pay for a cluster.
- Redash's API is asynchronous: submit, poll the job, fetch the results, and cancel on timeout.
