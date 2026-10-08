---
title: "Running and Debugging Scheduled ML ETL Flows on Azkaban"
category: "Data Platforms & Orchestration"
slug: "data-platform-azkaban-scheduled-ml-flows"
summary: "How Azkaban models ML pipelines as DAGs of jobs, how to deploy and trigger flows safely from a CLI, and the failure modes that cost real time and money."
---

# Running and Debugging Scheduled ML ETL Flows on Azkaban

On a client data-platform engagement I had to run and modify a production ML pipeline: a Spark ETL on Amazon EMR that builds a training dataset, followed by TensorFlow training on an EC2 box, followed by scoring and export. The whole thing was orchestrated by **Azkaban**, LinkedIn's open-source workflow scheduler, with **Jenkins** handling deployment. This article is what I wish I had known before my first run.

## What Azkaban is

Azkaban is a batch workflow scheduler. You give it a **project** (a zip of job definitions plus code), and it gives you:

- **Flows**: a directed acyclic graph (DAG) of **jobs**. Each job is a command (a shell script, a `spark-submit`, a Python entry point) with a `dependencies` list.
- **Executions**: each run of a flow gets a numeric execution ID. Azkaban tracks per-job status (`RUNNING`, `SUCCEEDED`, `FAILED`, `KILLED`, `SKIPPED`) and keeps each job's log.
- **Schedules**: cron-like triggers that start a flow daily or hourly.
- **Flow parameters**: key/value overrides you can pass at trigger time, which jobs see as properties (for example, `${run_date}`).

In ML platforms it's common to *generate* the Azkaban project from code instead of writing `.job` files by hand. In my case a Python `project.py` declared the jobs, the compute (an EMR cluster for Spark, an EC2 instance for training), and the dependencies. A builder library then produced the Azkaban DAG, including infrastructure jobs I never wrote myself: *provision cluster -> bootstrap cluster -> your jobs -> terminate cluster*.

## The lifecycle: code -> Jenkins -> Azkaban -> EMR

```
git push <branch>
   -> Jenkins "deploy branch" job: runs unit tests, builds the package, generates the
      Azkaban project, uploads it to the target environment's Azkaban
   -> Azkaban flow triggered (by schedule, UI, or CLI)
   -> provisioning job starts an EMR cluster
   -> bootstrap job installs your package and dependencies on the cluster
   -> ETL jobs run spark-submit on the cluster master
   -> teardown jobs terminate the cluster
```

A few things that follow from this:

- **Infrastructure shape is fixed at deploy time.** Node type, node count, and maximum uptime came from `project.py` when Jenkins generated the project. Flow parameters could *not* change them. To change the cluster, you change code, push a branch, and redeploy.
- **The naming is derived.** The Azkaban project name was `<repo>_<project-dir>` and the flow was `process_<project-dir>`. Using the bare directory name as the project, or the project name as the flow, just gives a 404. The best first check is listing the flows. It confirms auth and prints the real job names:

```bash
# Generic shape of what a scheduler CLI does against Azkaban's AJAX API
curl -s -b cookies "https://<azkaban-host>/manager?ajax=fetchprojectflows&project=<project>"
curl -s -b cookies "https://<azkaban-host>/manager?ajax=fetchflowgraph&project=<project>&flow=<flow>"
```

- **Read the generated DAG, not the source.** Generated job names can differ from what you'd expect. One of mine had a typo baked into the generator, so grepping logs for the "correct" spelling found nothing.

## Triggering a subset of a flow

Running the full pipeline (ETL plus training plus export) for a smoke test is wasteful, so I ran only the ETL branch. Azkaban supports this by disabling jobs. Our CLI exposed it as `--jobs a,b,c`. The semantics are the trap:

> **Selecting jobs disables everything else. It does not add the ancestors or descendants of what you picked.**

So you have to name the *whole chain* yourself: setup jobs, cluster provisioning, cluster bootstrap, your ETL job, **and the teardown jobs**. If you leave out the teardown pair, the flow "succeeds" and leaves a large EMR cluster running until its uptime cap.

```bash
scheduler-cli run \
  --project <project> --flow <flow> \
  --jobs setup,provision_cluster,bootstrap_cluster,job_etl,terminate_cluster,cleanup_cluster \
  -p run_date 2026-01-16 \
  -p _config_ '<json override, see the spark-submit quoting article>'
```

## Date parameters: count the subtractions

ML ETLs are almost always parameterised by a date, and the offsets stack up silently. In my flow:

```
Azkaban run_date param      = R
main.py run_date            = R - 1 day      (a "minus_days" default; names the output folder)
ETL query_date              = R - 2 days     (END of the data window)
window                      = query_date - (lookback - 1) ... query_date
```

So "run for the 16th" wrote a folder named for the 15th from data ending on the 14th. If you don't pin `run_date` explicitly, Azkaban uses the flow start time, and a run triggered today processes yesterday. I now write the arithmetic down before every run, and I pick `R` backwards from the newest partition I know exists.

## Monitoring: poll, don't trust a blocking monitor

Our CLI had a blocking `monitor` command that exited non-zero when the flow failed. During one run it also exited non-zero on a **transient network blip**, which from the outside looks exactly like a job failure. Nothing was watching after that. A dumb polling loop turned out to be more reliable:

```bash
EXECID=<id>
while :; do
  s=$(scheduler-cli status --execid "$EXECID" 2>&1 | grep -E "^status|^duration" | tr '\n' ' ')
  echo "[$(date +%H:%M:%S)] $s"
  case "$s" in *FAILED*|*SUCCEEDED*|*KILLED*) break;; esac
  sleep 120
done
```

For logs, the **Azkaban UI's per-job log** was the most dependable source. Click the red job in the execution graph. It needs no cloud credentials and it survives cluster termination. Tools that SSH to the EMR master to tail logs need both live credentials *and* a live cluster, and on a failed run you want the cluster gone as soon as possible.

**Use timing as a diagnostic.** Provisioning plus bootstrap took about 23 minutes, so an argument-parsing error showed up around 23 minutes in, a few seconds into `spark-submit`. If a run got past roughly 25 minutes, I knew the arguments were accepted and real data was being read.

## The most expensive failure mode: failed jobs skip teardown

Azkaban's default failure behaviour is to stop scheduling downstream jobs, and **teardown jobs are downstream**. When the ETL failed, the "terminate cluster" job was simply never run, and a 9-node memory-optimised cluster kept billing until its uptime cap.

My post-failure checklist, in this order:

1. **Tear down first, diagnose second.** Our generated project had a dedicated stop-cluster flow. Run it immediately.
2. **Verify termination independently.** The stop flow returned `SUCCEEDED` in about a second because it only *requests* termination (an async `TerminateJobFlows` call). That's an acknowledgement, not proof. Check the cluster state in EMR:
   ```bash
   aws emr list-clusters --active --query 'Clusters[].[Name,Status.State]' --output table
   ```
   In the console, switch the filter to **All clusters** so you actually see `TERMINATED`, rather than trusting an empty "active" list.
3. **Then** read the failed job's log in the Azkaban UI.

Also note that **dev had `retries=0` and alerts only went to chat, not to the pager.** A dev failure kills the run outright and nobody gets paged, so you have to be the one watching.

## Triage table I ended up with

| Symptom | Usual cause |
|---|---|
| Flow 404 | Project never deployed to that environment, or wrong project/flow name |
| `JSONDecodeError` a few seconds into `spark-submit` | Shell mangled a JSON parameter (brace expansion) |
| Flow succeeds, output tiny or empty | Input partitions missing in this environment |
| Hard assert on number of training dates | Lookback window too small for the train/val split |
| Cluster vanished mid-flow | Uptime cap exceeded |
| Deploy rejected with 401 | Expired Jenkins API token |
| Everything times out | Off VPN or SSO session expired |

## Key takeaways

- Azkaban flows are DAGs, and the generated DAG is the source of truth for job names. List it before you run anything.
- Selecting a subset of jobs disables everything you didn't name. Always include the teardown jobs.
- Write down the date arithmetic. Offsets stack across scheduler, entry point, and ETL.
- Poll execution status yourself. A blocking monitor can die on a network blip.
- A failed job means the cluster is still running. Tear down, verify in EMR, and only then debug.
- Cluster shape and uptime are deploy-time decisions, so changing them means code, a branch, and a redeploy through Jenkins.
