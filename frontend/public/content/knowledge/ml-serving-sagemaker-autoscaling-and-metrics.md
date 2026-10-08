---
title: "SageMaker Endpoints Under Load: Autoscaling, CloudWatch and Datadog Metrics"
category: "Load Testing & ML Serving"
slug: "ml-serving-sagemaker-autoscaling-and-metrics"
summary: "How SageMaker real-time endpoints autoscale (invocations per instance, not CPU), which CloudWatch and Datadog metrics to read during a load test, and the unit, dimension, percentile and time-zone traps that silently corrupt results."
---

# SageMaker Endpoints Under Load: Autoscaling, CloudWatch and Datadog Metrics

During a load test of a model served on an **Amazon SageMaker real-time endpoint** (a TensorFlow Serving container on `ml.m5.large` instances, behind a feature-fetching serving platform), I spent more time making sure the metrics were right than running the tests. This article collects what I learned about how the endpoint scales and how to read its metrics without fooling yourself.

## How a SageMaker real-time endpoint fits in

A typical online inference path looks like this:

```
client -> API gateway -> serving platform (fetch features, build tf.Examples)
       -> SageMaker endpoint (TF Serving, N instances) -> scores back
```

The endpoint is a managed fleet of instances behind a load balancer, with one or more **production variants**. Autoscaling is configured through **Application Auto Scaling**, usually as a target-tracking policy on the variant's `DesiredInstanceCount`.

## Autoscaling on invocations, not CPU

The most common target-tracking metric for SageMaker is the predefined `SageMakerVariantInvocationsPerInstance`: average invocations per instance per minute. The endpoint I tested scaled between 1 and 2 instances with a target of 1,000 invocations per instance per minute.

What I observed:

- The endpoint scaled from 1 to 2 instances when traffic passed about 2,000 invocations/min. At that point **CPU was around 6%**.
- Across hours of sustained load at well over 100 req/s on two instances, CPU stayed in the teens or below and model latency was flat at a few milliseconds.

So the endpoint scaled on **request count**, long before compute was a constraint. That is not a bug. It is a conservative, model-agnostic default. But it has consequences:

| Scaling signal | Pros | Cons |
|---|---|---|
| Invocations per instance | Simple, predictive, works for any model | Must be tuned per model; a light model scales out (and costs more) far too early, a heavy one too late |
| CPU / GPU utilization | Tracks actual compute pressure | Lags; misleading for I/O-bound or batched models |
| Latency (custom metric) | Tracks what users feel | Noisy; needs care to avoid oscillation |

**Lesson:** an autoscaling event in a load test is not evidence that the model is near capacity. Check CPU and model latency at the moment it scales. For production sizing, derive the invocations target from a load test: find the per-instance rate where latency starts to bend, then set the target comfortably below it.

Also note: the role I tested with could not call `application-autoscaling:Describe*`, so I read the policy from the deployment config. If you need to know the target and cooldowns, find out early where they live.

```bash
# if you do have permission
aws application-autoscaling describe-scaling-policies \
  --service-namespace sagemaker \
  --resource-id endpoint/<endpoint-name>/variant/<variant-name>

# current instance count
aws sagemaker describe-endpoint --endpoint-name <endpoint-name> \
  --query 'ProductionVariants[0].CurrentInstanceCount'
```

## The CloudWatch metrics that matter

| Metric | Namespace | Notes |
|---|---|---|
| `Invocations` | `AWS/SageMaker` | Use `Sum`. Your ground-truth request count. |
| `ModelLatency` | `AWS/SageMaker` | Time inside the container. **Microseconds.** |
| `OverheadLatency` | `AWS/SageMaker` | SageMaker's own overhead on top. Also microseconds. |
| `Invocation5XXErrors` / `4XXErrors` | `AWS/SageMaker` | Model/container errors vs bad requests |
| `CPUUtilization`, `MemoryUtilization` | `/aws/sagemaker/Endpoints` | Note the different namespace. CPU can exceed 100% (summed across vCPUs). |

```bash
D="Name=EndpointName,Value=<endpoint> Name=VariantName,Value=<variant>"

aws cloudwatch get-metric-statistics --namespace AWS/SageMaker \
  --metric-name Invocations --dimensions $D \
  --start-time 2026-01-01T18:00:00Z --end-time 2026-01-01T20:00:00Z \
  --period 60 --statistics Sum

aws cloudwatch get-metric-statistics --namespace AWS/SageMaker \
  --metric-name ModelLatency --dimensions $D \
  --start-time ... --end-time ... --period 3600 \
  --extended-statistics p50 p95 p99
```

### Traps I hit

1. **Wrong variant name returns zeros, not an error.** Many examples use `VariantName=AllTraffic`, but that is only a default. My endpoint's variant was named differently, and with the wrong value every metric quietly read 0. Check with `describe-endpoint` first.
2. **Units.** `ModelLatency` is in microseconds. "2,800" is 2.8 ms.
3. **Late datapoints.** CloudWatch keeps receiving datapoints for minutes after a burst. My first read of one stage's total was about 4x too low. Re-pull the window later before you record totals.
4. **Period and percentiles.** Percentiles (`--extended-statistics`) are computed per period. A one-hour period gives one stable number. One-minute periods give a noisy series. Pick on purpose.
5. **Which endpoint served the traffic?** If several model versions have endpoints, prove yours by showing `Invocations` on it ≈ client OK count, and ~0 on its siblings.

## Datadog: the serving-layer view

The CloudWatch metrics describe the endpoint. The number most SLOs are written against is the **serving platform's** latency (feature fetch + request packing + endpoint call), and that came from the service's APM/metrics in Datadog.

Things that tripped me up:

- **Percentiles baked into metric names.** Dropwizard-style timers emit `....95percentile`, `....count`, and so on as separate metrics. If only `95percentile` exists, there is **no p99**, and you cannot derive one. Frame the SLO around what is actually emitted.
- **Count vs rate.** Use `.as_count()` to total requests over a window and `.as_rate()` for req/s tiles. Mixing them gives numbers off by the rollup interval.
- **Rollups hide bursts.** Over a wide time range Datadog rolls points into large buckets, and a 5-minute burst can disappear into an hourly average. Zoom to the run window. For p95, take the median of steady-state points, not the max, and skip the first minute of warm-up.
- **Tag casing.** Datadog lowercases tag values. If the serving platform needs the exact registered model name casing in the request, do not copy the name from a Datadog filter.
- **Composite tiles.** A dashboard tile named "Invocation latency" was actually `model_latency + overhead_latency`, about 5 ms instead of the 2–3 ms forward pass. Read the tile's query before quoting it.
- **API access.** A read-scoped personal access token used as a Bearer token on the query API was enough for scripted pulls. Never put a key in a screenshot.

```bash
curl -s -H "Authorization: Bearer $DD_TOKEN" \
  "https://api.datadoghq.com/api/v1/query?from=$FROM&to=$TO&query=$(urlencode \
  'sum:my.service.inference.count{env:preprod,model_name:my_model}.as_count()')"
```

### Validate scope with counts before reading latency

In a shared environment, a filter that is slightly wrong shows *someone else's* latency. My rule: **the server-side count over the window must roughly equal the load generator's OK count for the inference step** before I believe any percentile. An "impossibly fast" p95 next to a tiny count is a scope error, not a fast model. Across every stage of my tests, Datadog counts and CloudWatch invocations matched the generator's counts, and that is what made the latency numbers trustworthy.

## Time zones

Jenkins and CloudWatch were in UTC. The Datadog UI displayed local time, and colleagues quoted times in US Eastern. I recorded every window in UTC with a buffer (start −1 min, end +2 min) and converted only at display time. Half the "no data" moments I had were really a window shifted by four hours.

## Key takeaways

- SageMaker target tracking on `InvocationsPerInstance` scales on traffic, not compute. A scale-out at 6% CPU tells you about the policy, not the model's limits.
- Tune the invocations target per model from load-test data.
- CloudWatch: check the real `VariantName`, convert microseconds, re-pull after late datapoints, and remember CPU lives in a different namespace.
- Datadog: know which percentiles exist, use counts vs rates correctly, zoom to the window, and read composite tile definitions.
- Reconcile counts across generator, serving layer and endpoint before trusting any latency number.
- Store all time windows in UTC.
