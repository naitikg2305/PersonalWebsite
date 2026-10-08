---
title: "Load Testing on Shared Pre-Production: Jenkins, Spinnaker, Eureka and Pre-Flight Checks"
category: "Load Testing & ML Serving"
slug: "load-testing-preflight-and-shared-environments"
summary: "The tooling and operating discipline around load tests on a shared preprod environment: why the load generator belongs inside the VPC, Jenkins-driven Gatling jobs, Spinnaker branch deploys at 0% routing, Eureka-based pre-flight checks, and how to avoid hurting other teams."
---

# Load Testing on Shared Pre-Production: Jenkins, Spinnaker, Eureka and Pre-Flight Checks

Running the load test is the easy part. Most of my time on a model-serving load-testing effort went into the surrounding work: getting load generated from the right place, targeting the right deployment, checking what was actually live, reading results before they vanished, and not breaking things for every other team on the shared environment. This article covers that work.

## Why not just loop requests from a laptop?

A Python thread pool calling the serving API from your laptop is a good **correctness** tool. It tells you whether the model resolves, whether features join, whether warm and cold entities score differently, and whether there are 5xx errors. It is the wrong tool for numbers you will sign off on:

1. **You are on the wrong side of the VPN.** Every request carries tens of milliseconds of tunnel round-trip that varies with your own load and cannot be subtracted afterwards.
2. **You saturate first.** A userland VPN client tops out long before the service does, so the "knee" you find is your own.
3. **There is no server-side view.** Under load, client timings are dominated by queueing at the client.
4. **Nobody can compare it.** "p95 under X ms at Y req/s" only means something on a standard rig.

A load generator running **inside the VPC**, one hop from the service, has a small, constant overhead and can scale out. In my case that was Gatling, packaged as a container image and launched by a parameterized Jenkins job.

## The pieces

| Tool | Role in the test |
|---|---|
| **Gatling** | Load generator. Scala simulations with virtual users, feeders, per-step OK/KO counts and percentiles. |
| **Jenkins** | Launches Gatling runs with parameters (version, users, duration, extra JVM args). Each build is one generator instance. You scale out by running builds in parallel. |
| **Spinnaker** | Deploys a private copy of the serving service from a branch (a "branch cluster") so heavy load does not land on shared pods. |
| **Eureka** | Service registry. The source of truth for which versions of a service are registered, UP, and taking what share of traffic. |
| **S3** | Hosts the feeder file the Gatling pods download at start-up. |
| **CloudWatch / Datadog** | Endpoint metrics and serving-layer metrics. See [the metrics article](/knowledge/ml-serving-sagemaker-autoscaling-and-metrics). |

## Spinnaker branch deploys at 0% routing

A shared preprod cluster serves everyone's tests. Pushing real load onto it degrades their results and lets theirs pollute yours. Spinnaker pipelines can deploy a server group from a branch or commit with an **end routing percentage of 0**. The new instances register with the service registry under their own version label, but receive no organic traffic. Only requests that explicitly target that version reach them.

Things worth knowing:

- The deploy only creates *service* pods. The model itself was registered separately, and requests selected it by model name. Spinnaker never touched the model.
- In my setup the Jenkins `version` parameter selected both the routing target and the Gatling image tag. **If no load-test image existed for that tag, the build died at image pull** before sending a single request. A branch cluster is only usable once its test image has been built.
- Branch clusters were automatically torn down within about a day, so we had to redeploy before each test session.
- Verify the deploy in the registry (the version shows N instances UP at routing 0.0) rather than trusting the pipeline's green badge.

## Eureka-based pre-flight checks

The most expensive mistake I made was launching a large run against a version that had been retired by an unannounced release overnight. Every inference call was rejected by the gateway while logins still worked (the full story is in [the case study](/knowledge/load-testing-congestion-collapse-case-study)). After that I wrote a pre-flight script and ran it before every session:

```bash
# Which versions are registered, UP, and at what routing share?
curl -s "$EUREKA/apps/<SERVICE>/routing" | python3 -m json.tool
curl -s "$EUREKA/apps/<SERVICE>/instances" | python3 -c '
import sys, json, collections
d = json.load(sys.stdin)
print(collections.Counter((i["version"], i["status"]) for i in d))'

# Is the model version's endpoint InService?
aws sagemaker list-endpoints --name-contains <model-prefix> \
  --query 'Endpoints[].[EndpointName,EndpointStatus]' --output text

# Is the feeder publicly fetchable by the generator pods?
curl -s -o /dev/null -w "%{http_code}\n" "$FEEDER_URL"     # expect 200

# What else is running on the load-test job right now?
curl -s -u "$USER:$TOKEN" "$JENKINS_JOB/api/json?tree=builds[number,building,result,actions[parameters[name,value]]]{0,10}"
```

The pre-flight checklist:

- [ ] Target version is listed as UP in the registry (the 100%-routed one if you are on mainline)
- [ ] Model version under test still exists and its endpoint is `InService` (old model versions were retired nightly)
- [ ] Feeder is rebuilt for the current model version and returns HTTP 200 anonymously (a missing public-read ACL showed up as HTTP 403 inside the pod)
- [ ] Nobody else is running a large test on the same job or cluster
- [ ] Off-peak for the shared environment, and the owning teams are told before you go past moderate load

## Jenkins operating lessons

- **Parameterize, then script.** I triggered builds through the Jenkins JSON API with basic auth plus an API token, and read results from `consoleText`. Scripting made parallel stages reproducible.
- **Identical queued builds get merged.** Jenkins collapses queued builds with identical parameters. Give parallel builds a trivially different parameter (duration 10800, 10801, ...).
- **Build retention is short.** The job kept about ten builds. Consoles from big parallel stages disappeared before I read them. Save consoles as soon as builds finish, and keep server-side counts as a backup source of truth.
- **The badge lies.** Builds were marked FAILURE because a setup step logged harmless "already exists" errors. Trust the per-step OK/KO row for the inference call.
- **Executor pools are shared.** The agent label had about 36 executors shared by every load-test job. Thirty concurrent builds queued other teams' health checks behind ours. Cap concurrency well below the pool size.
- **Start-up races.** Builds starting at the same instant occasionally died in a dependency-install race. Relaunching fixed it.

```bash
# read a finished build
curl -sS -u "$USER:$TOKEN" "$JOB/<N>/consoleText" > console_<N>.txt
grep -A 12 "Global Information" console_<N>.txt          # Gatling totals and percentiles
grep "<inference step name>" console_<N>.txt             # OK/KO for the inference step
```

## Side effects on shared preprod: write them down

After the heavy stages I wrote a side-effects report, system by system. It was one of the most valuable documents of the engagement:

| System | What happened |
|---|---|
| Model endpoint | Autoscaled 1 to 2 instances and back. No errors. Dedicated, so no impact on others. |
| Serving pods (shared) | Flat latency. Brief cache-miss spike in the first minute of each cold stage. |
| API gateway + auth/login | Saturated at high user counts. For a few minutes, anyone using preprod login likely saw 503s. |
| CI executor pool | Other teams' jobs were delayed by several minutes. |
| Other people's tests | A colleague's 1-user run overlapped a 500-user stage and recorded a badly inflated p95. |
| Dashboards | Our bursts dominated shared preprod graphs during the test windows. |

Write it down, give the windows in UTC, and tell the affected teams. It builds trust, and it stops someone else from spending a day debugging your load test.

## Key takeaways

- Generate load from inside the network, close to the service. Use laptop loops only for correctness checks.
- Use a branch deploy at 0% routing for heavy load, and make sure the test image for that version exists.
- Run a registry-based pre-flight check every session: live service version, live model version, reachable feeder, nobody else testing.
- Script Jenkins, save consoles right away, de-duplicate parallel parameters, and stay well under the shared executor pool.
- Shared preprod has neighbours. Coordinate before heavy stages and publish a side-effects report afterwards.
