---
title: "Working Across Dev, Preprod, and Prod on a Data Platform"
category: "Data Platforms & Orchestration"
slug: "data-platform-multi-environment-workflows"
summary: "How three-environment data platforms are usually laid out, how prod-to-dev data syncs really work, and the wrong-environment bugs that return plausible but wrong answers."
---

# Working Across Dev, Preprod, and Prod on a Data Platform

Most mature data platforms run every service three times: **dev**, **preprod** (staging), and **prod**. That means three Jenkins instances, three Azkaban schedulers, three Presto/Trino clusters, three Redash instances, and often three cloud accounts. The separation keeps experiments away from production data and schedules, but it adds a whole class of bugs that look like ordinary failures or, worse, look like success.

This is what I learned while setting up and running ML ETL flows across environments on a client data-platform engagement.

## The mental model

| Layer | Per-environment? | Notes |
|---|---|---|
| Schedulers (Azkaban), CI (Jenkins) | Yes, separate hosts | A flow deployed to dev doesn't exist in prod until promoted |
| Query engines (Presto/Trino), BI (Redash) | Yes, separate hosts | Each one is **permanently bound to one warehouse** |
| Data (Hive tables on S3) | Yes, separate buckets/schemas | Dev only has what was synced or produced in dev |
| Cloud accounts | Usually separate accounts | One SSO login, a different profile per account |
| Human identity (SSO password) | Shared | Same password everywhere |
| API tokens (Jenkins, Redash) | **Per instance** | A prod Redash key doesn't work against dev Redash |

That last row bites people. Single sign-on makes the environments *feel* unified, but service API tokens are issued per instance. In my case all the Jenkins tokens, even the environment-scoped ones, had to be generated from the dev Jenkins UI, because that was the only place the token page existed. That quirk is worth writing down when you find it.

## Hostname conventions and how to tell which one you hit

Platforms usually encode the environment in the hostname: `dev-<service>`, `preprod-<service>`, and prod with either a `prod-` prefix or **no prefix at all**. Ours used no prefix for prod, with one exception where the query engine did have one. So guessing `prod-jenkins` was the natural mistake, and it failed.

Two debugging tricks paid off:

**1. Check the resolved IP, not just the HTTP response.** Each environment lived in its own VPC CIDR range, so the address told me which environment I had actually reached:

```bash
getent hosts <hostname> | awk '{print $1}'
```

**2. A TLS handshake plus an HTTP 5xx can mean "this host doesn't exist."** The company domain had a wildcard DNS record pointing at a CDN catch-all. A mistyped hostname still resolved, completed TLS, and returned **HTTP 500**, which looks like a sick service instead of a nonexistent one. The repo's own docs listed scheduler URLs on the wrong domain, and I first wrote off the 500 as "normal for that service's root page." Once I checked the IP and saw the CDN range instead of an internal one, it was obvious. **Probe and verify endpoints; don't trust docs.**

Status codes I learned to read as healthy: `403` (reachable, needs auth), `301`/`302` (redirect to SSO login), `200`.

## Prod-to-dev data sync: it triggers, it doesn't transfer

Dev pipelines need realistic input data, so platforms provide a **prod-to-dev table sync**: a job that copies the latest N partitions of a prod Hive table into dev. Two things about it confused me at first.

**Which environment runs it?** The *dev* CI server, even though the job's name mentions prod. The job is configured by its **destination**, which is dev, and it runs with service-side credentials that can read prod. My dev Jenkins token only authorised "run this job."

**How does my CLI reach prod?** It doesn't. Reading the CLI source showed the sync command was a single authenticated HTTP POST to a Jenkins job with a payload like this:

```python
data = {"table_name": "my_db.my_events", "num_partitions": 60,
        "drop_and_create_table": False}
post(f"{DEV_JENKINS}/job/<tasks>/job/prod-dev-table-sync/buildWithParameters", data)
```

What follows:

- You never need prod credentials to sync. Prod data never passes through your laptop.
- `--env` on the CLI picks **which Jenkins you talk to**, not the data's source or destination. Pointing it at prod would ask prod Jenkins to run a job that probably isn't defined there.
- **The direction is one-way by design.** There's no dev-to-prod sync, so you can't accidentally push experimental data into production this way.

### The canonical verify-the-sync sequence

```bash
# 1. PROD: what is the newest partition?
SELECT * FROM "my_db"."my_events$partitions" ORDER BY 1 DESC LIMIT 5;   -- on prod engine
# 2. MOVE: trigger the sync job on dev CI for N partitions
# 3. DEV: did it land?
SELECT max(event_date), count(DISTINCT event_date) FROM my_db.my_events; -- on dev engine
```

Steps 1 and 3 run against **different warehouses** to answer different questions. Comparing them *is* the verification.

### Sync the table the job actually reads

The job's declared dependency list isn't always what it reads. One input was declared as a *current-state* table as a proxy, because the *history* table it really read didn't report to the dependency tracker. A comment buried in the project file said to sync the history table. Syncing only the declared one gave a silently empty input.

Going the other way, two feature-store inputs were **deliberately read from hardcoded prod S3 paths** even in dev, because those feature stores weren't produced in dev at all. Syncing them would have been wasted effort, and their staleness in dev didn't matter. So before syncing anything, I trace which tables and paths each job really reads, from the code, not from the dependency list.

## Wrong-environment bugs return plausible data

The most dangerous failures in a multi-environment setup don't error. They give you an answer from the wrong place.

- **Prod Redash can't see dev tables.** Checking a dev run's output on the prod instance gives zero rows (and zero rows isn't an error) or a stale prod number that looks reasonable.
- **Global defaults override per-environment settings.** When I wrote a small Redash CLI with an `--env` flag, my first version let a global `BASE_URL` variable take precedence over the per-environment one. So `--env dev` **silently queried prod**. The fix was an explicit precedence order: per-env variable, then global default, then built-in default. I added a test that prints the resolved host for each environment.
- **Copied DDL points at the other environment.** A dev table's base location pointed at the prod bucket because its DDL had been copied. Each dev partition had its own explicit dev location, so writes were safe, but I only knew that after checking partition-level locations.
- **Mixed identities.** Several CLIs defaulted the remote username to the OS `$USER`, which wasn't the platform username. Auth failed with confusing permission errors until I exported the right username explicitly.

## Rules I follow now

- **Numbers for anyone outside the team come from prod.** Dev is only for checking that a flow's inputs exist and its outputs landed.
- **Every environment-sensitive command prints its resolved target.** Host, account, profile.
- **One sourceable env file** (`~/.platform_env.sh`) that exports the full matrix of hosts per environment. Not `~/.bashrc`, which usually returns early for non-interactive shells, so scripts that source it silently get nothing.
- **Prepend, don't append, `~/.local/bin` to PATH** when you install newer CLIs alongside old distro packages. An old `apt` AWS CLI v1 couldn't parse `[sso-session]` config blocks and kept winning on PATH.
- **Dev schedules are manual.** Experimental projects deploy with a manual schedule so they never compete with the production schedule of the model they were cloned from.

## Key takeaways

- SSO is shared, but API tokens are per instance. Track them separately.
- Verify which environment you reached by its resolved IP. A wildcard DNS record can make a nonexistent host look like a broken one.
- Prod-to-dev sync is a trigger on dev CI that runs with service credentials. It's one-way by design.
- Sync what the code actually reads, which may differ from the declared dependencies.
- Wrong-environment bugs return plausible data. Make tools print their resolved targets, and get headline numbers from prod.
