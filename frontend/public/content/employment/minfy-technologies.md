---
title: "Solutions Architect & AI Engineer"
order: 1
company: "Minfy Technologies"
dates: "Jan 2026 – Present"
location: "Tysons, VA"
slug: "minfy-technologies"
summaryPoints:
  - AI engineering and pre-sales solutions architecture for AWS consulting clients.
positions:
  - role: "Solutions Architect (Pre-Sales)"
    dates: "Sep 2026 – Present"
    bullets:
      - main: "Technical voice on AWS pre-sales calls alongside Minfy’s sales team."
        sub:
          - "Translate client problems into proposed AWS architectures, cost estimates, and SOW scope for SMB and startup prospects."
          - "Pitched Minfy’s GenAI and AWS migration work at Amazon HQ2, leading to follow-up prospect calls."
      - main: "Authored the Statement of Work for an AI marketing-agent POC."
        sub:
          - "Bedrock Claude + Nova Canvas, deterministic HTML renderer, MCP server, and a human approval gate — 10 measurable objectives, 4 gated phases, 15 deliverables."
      - main: "Build AWS cost estimates for proposals."
        sub:
          - "Model costs across volume tiers in the AWS Pricing Calculator and share estimate links with clients; POC budgets for IoT, GenAI marketing, and document-AI proposals."
  - role: "AI Engineer"
    dates: "Jan 2026 – Present"
    bullets:
      - main: "2nd place, AWS × Anthropic Energy Hackathon (Houston, Sep 2026) — pipeline leak-detection agent on Amazon Bedrock AgentCore."
        sub:
          - "Built the detection and leak-localization tools and deployed the agent (Strands + Claude Sonnet 4.5): 5/5 leaks caught, 15/15 false alarms rejected, ~5-mile average localization on a 200-mile line."
          - "Coordinated a three-engineer team through Claude Code with a shared CLAUDE.md git-sync protocol — scaffold to deployed agent in one build day."
      - main: "Contributing to a personalization POC for Grubhub’s TensorFlow shared-bottom multi-task Topics Ranking model."
        sub:
          - "Fixed the Spark-on-EMR training-data pipeline for user-level behavioral features — a partition-read bug had silently zero-filled every order-history feature (0.36M rows read instead of 167.9M)."
          - "Owned preprod load and latency testing: 1.1M requests in a 3-hour test, up to 166 req/s (1.7× production’s peak) at 3.9 ms p95 model latency and 0.0002% errors."
      - main: "Designed a cost-aware computer vision + VLM pipeline for Samsara dashcam crash footage."
        sub:
          - "Dynamic frame sampling and reduction, YOLO detections with ByteTrack tracking, bounding-box overlays, and structured JSON context before video summarization."
          - "Defined a five-metric evaluation strategy (3 pipeline tracks × 4 VLMs on 97 labeled clips) with a YOLO baseline comparison."
      - main: "Built an AI evaluation test bench that black-box tests any LLM endpoint — RAG chatbots, multi-turn assistants, and NL-to-SQL APIs."
        sub:
          - "Document and SQL sources of truth, custom question and ground-truth datasets, and multi-turn conversational testing."
          - "Automated endpoint comparisons using semantic-similarity, rule-based, and LLM-as-a-judge scoring; ships as a FastAPI UI, CLI, and Docker image."
      - main: "Built POS integrations and a Chat-to-BI assistant for a restaurant reservation-auction platform."
        sub:
          - "Square and Clover integrations (Toast designed) automating booking creation, customer mapping, order sync, and check-status updates."
          - "Deterministic natural-language-to-BI workflow on Amazon Bedrock: intent routing into constrained SQL nodes with validated queries and auto-generated charts."
---

# 🏢 Minfy Technologies

**Jan 2026 – Present | Tysons, VA**

---

Minfy is an AWS consulting partner, so my work is client-project based: I join an engagement, learn the client’s systems fast, and ship the AI piece of it. In my first year that has meant a personalized ranking model for Grubhub, a video-understanding pipeline for Samsara, an LLM evaluation platform, and GenAI features for a restaurant marketplace. Since September I’ve also taken on solutions architecture for pre-sales — the step before a project exists.

---

## Solutions Architect (Pre-Sales)

**Sep 2026 – Present**

I join prospect calls with Minfy’s sales team as the technical voice. Sales runs the commercial side (including AWS MAP / MAP Lite funding applications); my job is to understand what the client is actually trying to do, show what we’ve built and what we can build, and turn that into something concrete they can say yes to.

### What I do

- **Discovery → architecture** — listen to the client’s problem, propose an AWS architecture, and pick the right services and region (e.g. a region that has Claude and Nova Canvas on Bedrock, not just the closest one).
- **Amazon HQ2** — went to Amazon’s HQ2 with our sales team to pitch Minfy’s GenAI and AWS modernization/migration work, using my restaurant-platform project as the reference. It led to follow-up calls with prospects.
- **Statements of Work** — wrote the SOW for an *AI Marketing Creative Studio* POC: Bedrock Claude for copy and layout, Amazon Nova Canvas for imagery, a deterministic HTML/CSS renderer so the image model never draws text, social-publishing connectors with spend caps, an MCP server, and a mandatory human approval gate. It has 10 measurable objectives, 4 gated phases, and 15 deliverables with acceptance criteria, delivered as a branded document.
- **Cost modeling** — build estimates in the **AWS Pricing Calculator** across volume tiers and share the estimate links with clients, plus a POC sandbox budget with contingency. Example: a 20-service IoT POC came out to **~$210 → ~$1,244/month from 100 → 5,000 devices** ($2.10 → $0.25 per device).
- **Migration assessments** — e.g. a startup running 10 SaaS services: three spend scenarios, per-service AWS substitutions, hidden costs (NAT gateway, egress), and an honest call on which funding programs actually fit their size.

#### What I learned

- **Clients buy outcomes, not services** — the architecture diagram matters less than measurable objectives and a clear “what you get at each gate.”
- **The bill is usually the always-on stuff** — databases, NAT gateways, and load balancers often cost more than the AI itself.

---

## AI Engineer

**Jan 2026 – Present**

---

## 🏆 AWS × Anthropic Energy Hackathon — 2nd Place

**Houston, TX · Sep 16, 2026**

AWS and Anthropic ran a one-day build at an energy symposium: pick one of four energy use cases, build it with **Claude Code**, and deploy it on **Amazon Bedrock AgentCore**. Judging covered agentic behavior, source-code integrity (no faked data), UI/demo, and AgentCore usage. I went for Minfy with two teammates, and we took **2nd place**.

**The problem — pipeline leak detection.** A gas operator runs 200 miles of transmission pipeline with 8 SCADA stations. The hard part is telling real leaks from normal operational noise — compressor starts, valve changes, temperature swings — because a false alarm costs $100k+ per shutdown and a missed leak risks federal (PHMSA) penalties. We had 90 days of SCADA data (207,360 rows) plus labeled leaks, labeled false alarms, and the operating, weather, and inspection records around them.

**What we built.** A detect-to-report incident agent (Strands Agents SDK on Bedrock Claude Sonnet 4.5) that triages an alarm, recommends a response, and drafts the regulatory notification — citing the exact file and row behind every claim, and saying so when the data doesn’t support a conclusion. Its 9 tools compute everything from the raw data (no hard-coded answers), and a Streamlit operator console shows the analysis, confidence signals, what-if scenarios, and a leak-location map.

### What I did

- **Detection logic and tools** — SCADA analytics (pressure, flow, sustained mass-balance deficit), an operational-context checker that explains false alarms (compressor starts, valve changes, temperature-driven line-pack), and a pressure-gradient tool that localizes a leak to a segment, mile marker, and nearest isolation valves.
- **Validation** — a harness over all 20 labeled events: **5/5 leaks detected, 15/15 false alarms rejected**, and leaks localized to **~5 miles on average** on a 200-mile line.
- **Deployment** — deployed the agent to **Amazon Bedrock AgentCore Runtime** (streaming, public endpoint) and wrote the adapter that feeds its results into the UI; it was live and usable from a phone during judging.
- **Team coordination through Claude Code** — split the problem into three parallel workstreams with fixed tool interfaces, and wrote the team’s `CLAUDE.md` as a coordination spec: every teammate’s Claude session pulls, reads a shared sync log, does one task, logs updates for the others, and pushes. Three engineers and three AI sessions stayed in sync from scaffold to a deployed, tested agent in a single build day.

#### What I learned

- **Agents need hard evidence** — tools that compute from real data, plus a “fail loud” rule, are what make an agent trustworthy in a safety-critical domain.
- **`CLAUDE.md` is a team protocol, not just notes** — a shared source of truth is what lets multiple AI-assisted developers build in parallel without stepping on each other.

---

## Project 1: Grubhub — Personalized Topics Ranking

**Jul 2026 – Present**

Grubhub’s homepage shows diners a stack of “topics” — carousels like *reorder your favorites* or *local gems*. A TensorFlow multi-task ranker decides their order. Our engagement adds per-diner behavioral features to build a personalized version of that model and take it toward production.

**The model** is a shared-bottom multi-task network: context features (through embeddings) and per-diner, per-topic behavioral rates feed a shared dense trunk with two heads — P(click) and P(order) — and the page is ranked by P(order). Personalization works *without* diner identity: the model sees Bayesian-smoothed per-(diner, topic) rates, so it generalizes to any diner with history.

### What I did

- **Training-data pipeline (Spark on EMR, scheduled with Azkaban)**
  - Found that a job was reading a single partition instead of a date range — **356,831 rows instead of 167,889,061** — which meant every order-history training feature (orders over 30/60/90/180 days, days since last order, spend, cuisine entropy) was being zero-filled.
  - Fixed three Spark SQL correctness bugs (a window function inside an aggregate, config-driven cuisine exclusions, and NULL diner IDs creating a phantom diner that skewed sampling).
  - Turned on Spark Adaptive Query Execution after a 78,546-task stage sat stuck for 90+ minutes.
  - Built the 120-day sampling job the modeling POC trained on.
- **Got the production retraining ETL running in the dev environment** — root-caused the first failure to bash brace-expansion mangling JSON flow parameters on the EMR master, and got a clean run on the second try. Modeled the cluster cost (provisioning was ~85% of runtime — cluster shape is the only real cost lever).
- **Owned preprod load and latency testing of the personalized model**
  - Built the load-test feeders from real homepage sessions (up to 3,800 distinct diners, 4–26 topics per request).
  - Ramped from 10 to 1,000+ virtual users with Jenkins/Gatling; pulled per-stage metrics from Datadog and CloudWatch.
  - **Diagnosed an apparent ~30 req/s ceiling**: by reading the Gatling simulation source and the per-service metrics, showed the limiter was the preprod auth service and start-up congestion — not the model. With a ramp-up fix, measured throughput rose ~5×.
  - **3-hour test: 1.1M requests**, peak **166 req/s** (1.7× production’s dual-region peak), model **p50 2.0 / p95 3.9 / p99 5.6 ms**, platform p95 ~12 ms flat, **0.0002% errors**, endpoint CPU ≤11% per instance.
  - A 5-job follow-up proved the remaining ~160 req/s cap lived in the test harness, not the model or serving platform.
  - Root-caused a 100%-failure wave to a stale platform version after an unannounced preprod release, and wrote a pre-flight check so it couldn’t recur.
  - Wrote the client deliverables: one-pager, side-effects report, test tracking doc, and a runbook + learnings document.
- **Exploratory data analysis** on clickstream data: CTR by rank is U-shaped (not monotone), ~85% of impressions are carousels, and sponsored content is ~52% of impressions but only ~5.5% of clicks. Catalogued eight SQL pitfalls that silently return wrong answers.
- **Tooling**: a multi-environment Redash CLI, Jenkins launchers, CloudWatch/Datadog query scripts, and a CLI handbook so a new engineer can set up the whole toolchain in ~20 minutes.

#### What I learned

- **Load testing is measured in requests per second, not “users.”** Closed-loop users that all start at t = 0 measure congestion collapse, not capacity — always ramp up and run for hours.
- **Autoscaling on invocations, not CPU** — size production on the latency budget and cost, not on utilization.
- **Ranking ML end to end** — shared-bottom multi-task models, position bias, cold start, MRR/NDCG, and offline-vs-online serving.

---

## Project 2: Samsara — Dashcam Video Safety Analysis

**Jun 2026 – Aug 2026**

Fleet dashcams capture “defensive driving” safety events from a road-facing and a cabin-facing camera. The goal was to validate whether vision-language models (VLMs) can label these events reliably — and to build the pipeline that makes them cheaper and more accurate.

### What I did

- **Ground-truth framework report** — analyzed 97 labeled clips, quantified per-label support and precision for 15 event labels, and found that the target behaves as a *hazard-response outcome* rather than a driver-behavior taxonomy. Delivered seven recommendations on label definitions and annotation policy.
- **Cost-aware CV preprocessing pipeline**
  - Frame-rate reduction (60 fps down to 5–45 fps) with a CLI and a Gradio web UI.
  - **YOLO detection with ByteTrack tracking**, so a car visible for 3 seconds is one tracked object instead of 90 frame hits.
  - Track-level analysis: approaching / receding trends, rapid-approach and near-miss candidate events, converging objects.
  - Bounding-box overlays and a structured JSON “evidence packet” handed to the VLM before summarization.
- **Rule-based label extractor** answering ~40 safety labels with yes / no / *unknown* (“unknown beats wrong”), using YOLO tracks, pose keypoints, lane detection, and time-to-collision estimates. Quantified that stock object detection alone answers ~12% of the taxonomy (~19% with raw-video signals) — which shaped the client’s model-selection discussion.
- **Evaluation strategy** — 3 pipeline tracks (raw video → VLM, dynamic frames → VLM, YOLO-guided → VLM) × 4 VLMs on the same 97 videos, a YOLO-based ground-truth audit layer to separate model misses from label noise, and a scoring tool (accuracy / precision / recall / F1, confusion matrices, per-tag alignment, cross-run leaderboard).

#### What I learned

- **Give the VLM hard evidence, not just pixels** — structured detections and tracks ground the model the same way tool calls ground an agent.
- **Frame budget is the cost lever** for video models; sampling smartly matters more than sampling densely.

---

## Project 3: AI Evaluation Test Bench

**Feb 2026 – Aug 2026**

A standalone, black-box evaluation harness for any LLM-backed HTTP endpoint — RAG chatbots, multi-turn assistants, and natural-language-to-SQL “Chat BI” APIs. It requires no code changes in the app being tested. I wrote 21 of its 22 commits.

### What I did

- **Ingest** documents from a directory, ZIP, or S3 into its own ChromaDB (sentence-transformer embeddings), so the bench has an independent baseline to compare against.
- **Question generation** — rule-based, LLM-generated, BI-specific, or a user-provided question bank; LLM-generated follow-ups for multi-turn conversation testing with persistent sessions.
- **Three-layer scoring**
  1. Deterministic: cosine similarity, tolerance-based number matching, style checks.
  2. Grounding: Top-K document precision/recall, number grounding, and spaCy noun/verb grounding to estimate hallucination risk; latency p95.
  3. Optional LLM-as-a-judge across five rubrics (relevancy, faithfulness, contextual relevancy, correctness, coherence).
- **SQL truth layer for Chat-BI endpoints** — replays the SQL the endpoint discloses, and separately has an LLM write, validate, and execute its own read-only query as an oracle, producing a composite “endpoint correct” verdict.
- **Plugin architecture** — drop-in response normalizers per endpoint shape, plus a preset sniffer that guesses the right one.
- Pluggable LLM client (OpenAI or Claude on Amazon Bedrock), outbound auth to the app under test (bearer, basic, login flows incl. Cognito), Docker packaging, unit tests, and ~90 KB of documentation.

---

## Project 4: Restaurant Platform — POS Integration & Chat-to-BI

**Feb 2026 – Aug 2026**

A restaurant table-reservation marketplace where diners bid on tables auction-style. I owned the GenAI and integration track.

### POS integration

- Wrote the technical design: a vendor-agnostic canonical API, ID-mapping tables between platform and POS entities, idempotent upserts, and a vendor analysis across Square, Toast, Clover, and others.
- **Built the Square and Clover adapters** (TypeScript/Express): per-restaurant OAuth 2.0, multi-location matching by address scoring, customer upsert, idempotent order creation carrying reservation details, and check-status sync back to the platform.
- **Cross-vendor customer deduplication** with a database-side cache, liveness checks, and self-healing — no vendor search calls on repeat bookings.
- End-to-end sandbox testing from restaurant onboarding → auction win → order in the POS → status sync.

### Chat-to-BI

- A natural-language analytics assistant for restaurant owners, built without LangChain.
- **Router LLM call (Claude on Amazon Bedrock)** classifies the question into one of 9 nodes and extracts the date range and granularity.
- **8 deterministic report nodes** with pre-authored SQL (revenue trend, booking funnel, table utilization, and more), plus a generic node where the LLM writes SQL that is **AST-validated as SELECT-only and tenant-scoped** before it runs.
- Deterministic Plotly charts (bar, pie, histogram, funnel, heatmap…), temperature-0 narratives, and a React chat UI with PDF export.
- This endpoint became one of the test bench’s evaluation targets.

#### What I learned

- **Deterministic paths beat free-form generation** for analytics — let the LLM route and parameterize, and let validated SQL produce the numbers.
- **Integrations are mostly edge cases** — OAuth quirks, idempotency, and vendor-specific state models.

---

## 🔧 Technologies Used

- **ML & data:** TensorFlow / Keras, Apache Spark (EMR), Presto/Trino, Azkaban, SageMaker endpoints
- **Computer vision:** Ultralytics YOLO, ByteTrack, YOLO-pose, OpenCV, Gradio, VLMs (Gemini, Nova, Qwen-VL)
- **LLM & GenAI:** Amazon Bedrock (Claude), Bedrock AgentCore, Strands Agents, Claude Code, OpenAI, ChromaDB, sentence-transformers, spaCy
- **Backend:** Python (FastAPI, Pydantic), TypeScript / Node.js (Express, Sequelize), MySQL
- **Load & observability:** Jenkins, Gatling, Spinnaker, Datadog, CloudWatch
- **Integrations:** Square API, Clover API, AWS Cognito, S3
- **Pre-sales:** AWS Pricing Calculator, solution architecture diagrams, SOW writing
- **Other:** Docker, Git, Bash, React, Plotly

---
