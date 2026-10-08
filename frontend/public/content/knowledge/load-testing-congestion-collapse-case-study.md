---
title: "The Throughput Ceiling That Wasn't: Debugging a Model Load Test"
category: "Load Testing & ML Serving"
slug: "load-testing-congestion-collapse-case-study"
summary: "Three lessons from load testing an ML serving path: a fake throughput ceiling caused by start-up congestion and a slow-scaling auth service, 100% failures from a stale service version, and throughput that rose over a long run."
---

# The Throughput Ceiling That Wasn't: Debugging a Model Load Test

This is a write-up of the most instructive part of a load-testing engagement I worked on: the stretch where every number looked like a clear finding, and most of them turned out to be wrong. The system under test was a ranking model served through a feature-fetching serving platform in front of an AWS SageMaker real-time endpoint. The load came from Gatling simulations launched by a Jenkins job, running inside the VPC on a shared pre-production environment.

The general methodology is in [A Practical Methodology for Load and Latency Testing](/knowledge/load-testing-methodology). This article is about the debugging.

## Background: how the harness worked

Each Gatling virtual user ran a closed loop:

1. Create a test account and add claims to it
2. Log in through the API gateway (via the platform's auth service)
3. Take the next request from the feeder file and POST it to the serving platform
4. Pause 25–200 ms, and repeat for the configured duration

The important detail, which I only found by reading the simulation's base class source, was that **steps 1 and 2 ran on every iteration**, not once per user. So every model call was paired with an account creation and a login.

## Story 1: the "hard ceiling" at ~30 req/s

### What I saw

I ran a staged ramp: 50 users, then 2, 5, 10 and 20 parallel Jenkins builds of 50 users each. All users started at t=0, and each stage lasted about 5 minutes.

| Users | Model req/s (CloudWatch) | Generator e2e p95 | Model p95 (forward pass) |
|---|---|---|---|
| 50 | ~26 | ~1.3 s | ~3 ms |
| 100 | ~33 | ~3 s | ~3.7 ms |
| 250 | ~25 | ~8.6 s | ~3.7 ms |
| 500 | ~28 | ~13 s | ~3.9 ms |
| 1,000 | ~27 | 29–45 s, ~1% timeouts | ~3.3 ms |

Throughput was flat while client latency grew linearly with users. Checking `users / latency`: 50/1.3, 250/8.6 and 500/13.5 all come out near 30 req/s. That is the textbook signature of closed-loop users stuck behind a fixed-capacity queue. The model itself was idle: a few ms of latency and single-digit CPU.

At ~1,550 users the whole thing collapsed: the gateway returned HTTP 503 after a 45-second timeout on every login, and **zero** requests reached the model.

My conclusion at the time was "the serving path has a ~30 req/s ceiling upstream of the model". I correctly attributed it to the harness's account-creation and login path rather than the model. But I was wrong that it was a fixed capacity limit.

### What it actually was

A colleague re-ran the test with one change: a **60-second ramp-up** for user injection instead of starting everyone at t=0. With zero failures on any step:

| Users (ramped) | Model req/s |
|---|---|
| 10 | ~5 |
| 30 | ~17 |
| 100 | ~67 sustained over 2 h, peaking near 90 |

Throughput scaled linearly with users. The "ceiling" was **start-up congestion collapse**. Hundreds of simultaneous account creations and logins swamped the auth path at once, requests queued past timeouts, and because the load was closed-loop, every user that failed or slowed down came straight back and kept the downstream services saturated. The system never got to recover into its real steady state.

### The second half: an autoscaling auth service

The long, ramped run showed something else. With users fixed at 100, model throughput per 10-minute window climbed steadily: 26 → 35 → 43 → 51 → 61 → 68 → 76 → 82 → 85 → 88 → 91 → 92 req/s over two hours, while model p95 stayed flat at ~3 ms.

Closed-loop math explains it: if users are fixed and throughput rises, iteration latency must be falling (here from ~3.8 s to ~1.1 s). The cause was the shared preprod **auth service**, which autoscales on load but only adds a host every few minutes. In my 5-minute tests its host count never moved. In the 2-hour run it grew by dozens of hosts, and its p95 fell as it caught up. Plotting the auth service's p95 against users across my earlier stages gave a clean dose-response curve: roughly 3 ms at 10 users, 15 ms at 100, 80 ms at 500, over 300 ms at 1,000. The bottleneck had been in the auth service all along, not in anything we owned.

Later runs with pre-scaled auth hosts and five parallel jobs plateaued again at a higher level, a few times above the original "ceiling". The remaining limit was still upstream of the model, in the account-creation/gateway path.

### Lessons

- **Always ramp up.** All-at-once starts produced a false capacity number that I reported for a week.
- **Run long.** Shared dependencies that autoscale need tens of minutes; a short test measures their cold size.
- **Attribute before you escalate.** Flat server-side latency plus exploding client latency means the queue is in the harness or a dependency. More users only make the picture worse.
- **Read the harness source.** "Login once per user" vs "login every iteration" changed the whole interpretation.

## Story 2: 100% failures from a stale version

### What I saw

The day after the first ramp I launched a large rerun. Every build failed. Late-starting builds got through login fine, but **every** inference POST came back with a bare HTTP 461 (a non-standard status with no body), and the model received zero invocations. A 5-user recovery smoke test failed the same way. It looked like we had broken something with the previous day's load.

### What it actually was

The Jenkins job takes a `version` parameter that does two things: it selects the Gatling image tag, and it tells the gateway which deployed version of the serving service to route to. I had passed the same version as the day before. Querying the service registry (Eureka) showed that **the serving platform had been released to a new version the previous evening, without announcement**, and the old version had no instances left. The gateway was rejecting requests aimed at a version that no longer existed. Logins worked because they did not target that service.

A smoke test with the current version passed immediately with zero errors and the expected invocation count. The large rerun, now on the right version, reproduced the start-up collapse from Story 1. So both runs actually agreed once the version was correct.

### Lessons

- In shared pre-production, **versions move under you**. Releases do not wait for your test window.
- Make a **pre-flight check** mandatory: query the service registry for the live version and pass that, never a remembered one. (Model versions also churned: a nightly job retired old model minors, and requests to a retired one returned HTTP 500 "model disabled". Check those too.)
- When *everything* fails at a tiny load that worked yesterday, suspect configuration and environment before capacity.

## Story 3: the evidence that disappeared

At 10–20 concurrent builds, some Jenkins console logs were gone before I could read them. The job only kept about ten build records. I recovered per-stage totals from CloudWatch `Invocations` on the endpoint, which has its own retention. Since then I save consoles as soon as builds finish, and I always reconcile client counts against server-side counts.

## Key takeaways

- A flat throughput curve with rising client latency in a closed-loop test means "something is queueing". It does not tell you *what*, or whether the limit is real.
- Start-up congestion collapse can look exactly like a hard ceiling. Ramp-up (≥ 60 s) is not optional.
- Slow-scaling shared dependencies (auth, gateways) can dominate results. Test for hours, and watch their host counts and p95 as well as your own.
- Measure throughput in req/s at the model (server-side), not "users".
- Check the live service and model versions before every session. An unannounced release can turn a healthy system into 100% failures.
- Keep the model's own metrics in view the whole time. Here they were flat throughout, which is what eventually proved every problem was upstream.
