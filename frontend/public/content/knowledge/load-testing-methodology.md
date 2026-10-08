---
title: "A Practical Methodology for Load and Latency Testing ML Model Serving"
category: "Load Testing & ML Serving"
slug: "load-testing-methodology"
summary: "How to design latency and load tests for an ML inference path: closed vs open loop, why req/s beats 'users', ramp-up, test duration, staged ramps, stop rules, and realistic request feeders."
---

# A Practical Methodology for Load and Latency Testing ML Model Serving

When a new model is about to go live behind a real-time serving platform, two questions always come up:

1. **Latency:** how fast is one inference at realistic, moderate concurrency?
2. **Load / capacity:** what happens to latency and error rate as traffic rises, and where does the serving path saturate?

I spent several weeks answering both for a ranking model on a client's model-serving platform (a feature-fetching service in front of a SageMaker real-time endpoint running TensorFlow Serving), using Gatling load tests launched from Jenkins. This article is the methodology I would now use from day one. The companion articles cover the [debugging stories](/knowledge/load-testing-congestion-collapse-case-study), [SageMaker autoscaling and metrics](/knowledge/ml-serving-sagemaker-autoscaling-and-metrics), and [the deployment and pre-flight tooling](/knowledge/load-testing-preflight-and-shared-environments).

## Latency test vs load test

| | Latency test | Load test |
|---|---|---|
| Question | How fast at realistic concurrency? | Where does it bend or break? |
| Load | Low, steady (e.g. 10–20 virtual users) | Staged increases until a stop rule fires |
| Output | Steady-state p95 (and p99 if available) | Throughput (req/s) vs latency and error curve, the "knee" |
| Duration | Minutes are often enough | Hours (see below) |

Always run the latency test first. It is the baseline every load stage is compared against, and it is the cheapest way to catch correctness problems (wrong model version, missing features, 5xx errors) before you push hard.

## Concept 1: closed-loop vs open-loop load

Most load tools default to a **closed-loop** model: you configure N "virtual users", and each user loops *send request → wait for response → think time → repeat*. The arrival rate is not something you set; it falls out of the system:

```
throughput (req/s) ≈ users / (iteration latency + think time)
```

An **open-loop** test instead fixes the arrival rate (e.g. "200 req/s") regardless of how fast responses come back. Real user traffic is closer to open-loop: people do not stop arriving because your service got slow.

Why it matters: in a closed loop, if something upstream saturates, adding users does **not** add load. It just adds queueing. I saw 50, 100 and 250 users all produce the same throughput, while client-side p95 grew from ~1 s to ~9 s. That pattern, `users / latency = constant`, is the fingerprint of a closed-loop test sitting behind a bottleneck.

## Concept 2: measure in req/s, not "users"

"We tested with 1,000 users" means nothing on its own. 1,000 closed-loop users with a 10-second iteration time is 100 req/s; 1,000 users with a 100 ms iteration is 10,000 req/s. State every result as:

- **achieved requests per second at the component you care about** (e.g. model invocations/s), and
- the latency percentile and error rate *at that rate*.

Also check what the tool counts as a "request". In my harness every iteration did setup calls (create a test account, add claims, log in) before the actual inference call, so the tool's total req/s was roughly 3x the rate actually reaching the model. Use the per-step count for the inference call, or better, the server-side invocation count.

## Concept 3: there are several latencies; know which one you are reading

For a feature-fetching serving layer in front of a model endpoint, I tracked three layers:

| Layer | Source | Includes |
|---|---|---|
| Model forward pass | CloudWatch `ModelLatency` on the SageMaker endpoint | Inference inside the container only |
| Serving-platform latency | APM metric (Datadog) on the serving service | Feature fetch + request packing + endpoint call + platform overhead. **Usually the SLO number.** |
| Load-generator end-to-end | Gatling report | Setup calls, network, generator queueing, everything |

In my tests the forward pass was a few milliseconds, the serving-layer p95 was roughly ten milliseconds, and the generator's end-to-end p95 was hundreds of milliseconds to seconds. Reporting the wrong layer can be off by two orders of magnitude. Subtracting layers also tells you where time goes: `platform latency − endpoint round trip ≈ feature fetch + serialization`.

## Concept 4: ramp up, never start everyone at t=0

If 1,500 virtual users start in the same second, every one of them hits the cold start path (login, cache misses, connection setup) simultaneously. Downstream services that would comfortably handle the steady state get a thundering herd, time out, and closed-loop retries keep them saturated. This is **start-up congestion collapse**, and it can make a healthy system look like it has a hard ceiling. Spreading user injection over even 60 seconds removed the collapse entirely in my case.

## Concept 5: run long enough for the system to adapt

Five-minute tests measure a cold system. Autoscaling groups, caches, JIT compilation and connection pools all need time. In one 2-hour run with a fixed 100 users, throughput climbed steadily from ~26 to ~92 req/s because a shared authentication service was autoscaling the whole time and each iteration got faster. A 5-minute test would have reported the first number. **Run 1–2 hours or more** for capacity questions, and discard the first minute or so as warm-up for latency questions.

## The methodology, step by step

1. **Pre-flight** (every session): confirm the live versions of the serving service and the model, confirm the endpoint is `InService`, confirm the request feeder file is reachable. See the [pre-flight article](/knowledge/load-testing-preflight-and-shared-environments).
2. **Smoke** (5–10 users, a few minutes): zero errors, server-side invocation count ≈ client OK count.
3. **Latency run** (10–20 users, 5–10 minutes, ramped): record steady-state p95 per layer.
4. **Staged load ramp**, one variable at a time:

   | Stage | Users × parallel generators | Expectation |
   |---|---|---|
   | L1 | 15 × 1 | Equals latency baseline |
   | L2 | 20 × 2 | p95 roughly flat |
   | L3 | 20 × 4 | Autoscale event likely; watch p95 step and errors |
   | L4 | 25 × 4, long duration | Sustained; find the knee |

5. **Stop rule**, decided before you start, for example: error rate > 1% on the inference step, *or* p95 > 2x baseline, *or* endpoint at max instances with latency rising. When it fires, record and stop: that is your capacity number.
6. **Attribute before pushing further.** If client latency explodes but server-side latency is flat, the bottleneck is elsewhere (often the harness). More load proves nothing until you know where the queue is.

## Building a realistic feeder

Replay-style tests read request bodies from a "feeder" file. Most fake-fast results I have seen come from bad feeders:

- **Sample real sessions** from logged or training data, one request per session, with the real number of candidates per request (mine ranged from 4 to 26).
- **Use many distinct entity IDs.** A feeder cycling a handful of users keeps the feature cache warm and under-reports latency.
- **Include a cold slice** (e.g. 15% synthetic IDs that miss the feature store) so the default/fallback path is timed too.
- **Populate every context feature.** A missing field may take a sentinel/default shortcut and look faster than reality.
- **Pin the exact model version** in the request rather than a "latest" alias, so the run is reproducible.
- For parallel generators, give each one a **disjoint feeder** so they do not replay the same IDs simultaneously.

```bash
# generic shape: sample -> build -> publish -> verify reachable
python build_feeder.py sessions.csv --model-name my_model_v1.9 \
  --num-requests 800 --cold-fraction 0.15 --seed 7 --out feeder.json
aws s3 cp feeder.json s3://<feeder-bucket>/feeder.json
curl -s -o /dev/null -w "%{http_code}\n" "<feeder-url>"   # must print 200
```

## What to record per run

Run/build ID, service version, model version, users, ramp-up, duration, parallel generators, inference-step OK/KO, generator p50/p95 (labelled "generator end-to-end"), server-side count, server-side steady-state p95, failures, endpoint invocations, model latency p95, instance count, CPU, and the exact UTC time window. Leave blanks as named blanks; never guess.

## Key takeaways

- Decide up front whether you are asking a latency question or a capacity question.
- Closed-loop "users" are not load. Report achieved **req/s** at the component under test.
- Know which latency layer you are quoting; the SLO is usually the serving-layer p95, not the generator's.
- **Always ramp up** (60 s or more) and **run long** (1–2 h+) for capacity tests.
- Use a stop rule and attribute bottlenecks before adding more load.
- Feeder realism (distinct IDs, cold slice, full features, pinned version) decides whether your numbers mean anything.
