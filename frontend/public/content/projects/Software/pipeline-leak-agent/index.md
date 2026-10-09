---
title: "Pipeline Leak-Detection Agent (2nd Place, AWS × Anthropic Energy Hackathon)"
category: "software"
order: 5
date: "2026-09-16"
tags: ["Amazon Bedrock AgentCore", "Strands Agents", "Claude Sonnet 4.5", "Claude Code", "boto3", "Python", "pandas"]
summary: "A pipeline leak-detection agent built in one day at the AWS × Anthropic Energy Hackathon in Houston and deployed on Amazon Bedrock AgentCore. It classified all 20 labelled events correctly and placed leaks within 5 miles on average on a 200-mile line. 2nd place."
github: https://github.com/naitikg2305/AWS_Hackathon_Minfy
---

# Pipeline Leak-Detection Agent

## Overview

On September 16, 2026 I took part in the AWS × Anthropic "Claude Code + Bedrock AgentCore" hackathon at an energy symposium in Houston, representing Minfy as part of a three-person team. Teams picked one of four energy use cases. Everything had to be built with **Claude Code** and deployed on **Amazon Bedrock AgentCore**. We took **2nd place**.

We picked **Use Case 3: Pipeline Leak Detection & Integrity Agent** (midstream). The setup was a 200-mile, 24-inch gas transmission line with 8 SCADA stations. The hard part is telling real leaks apart from normal operational transients like compressor starts, valve changes and temperature-driven line-pack shifts. A false alarm can mean a shutdown costing $100k+, and a missed leak risks PHMSA penalties. The data included 90 days of 5-minute SCADA readings (207,360 rows), 5 labelled leaks, 15 labelled false positives, and supporting files: segment metadata, weather, valve status, inspections and regulations. Every claim the agent made had to trace back to that data.

## How it works

The team built a single **Strands Agents** agent on **Claude Sonnet 4.5** that follows a fixed workflow: detect and triage, then response, then compliance. It cites the file and row behind every claim and says so plainly when the data doesn't support a conclusion. All of its tools compute their answers from the CSVs. There are no hard-coded verdicts and no matching on event IDs.

```text
Alarm → query_scada (is there a sustained mass-balance deficit?)
      → check_operational_context (compressor start? valve change? temperature swing?)
      → locate_leak (pressure-gradient ratio → segment, mile marker, valves to close)
      → response + compliance steps, with citations
```

My teammates built the agent's response and compliance tools and the Streamlit operator console. My part was the detection side, the team coordination setup, and the AgentCore deployment.

## What I built

### Splitting the work and keeping three Claude Code sessions in sync
- I used Claude Code to break the use case into **three parallel workstreams**: data and detection tools, agent and orchestration, and UI/deploy/demo. Each had its own plan file and **fixed tool interfaces**, so all three of us could build at the same time.
- I wrote the team's **CLAUDE.md** with a mandatory "git sync" rule that every teammate's Claude Code session followed. At the start of a session, it asks who is driving. Before each task, it runs `git pull` and reads a shared `SYNC.md` log. After each task, it updates that person's plan, adds a note for the others to `SYNC.md`, updates CLAUDE.md if a tool signature or status changed, then commits and pushes. CLAUDE.md was the single source of truth: if something wasn't written there, the other sessions didn't know about it. It also pinned exact tool signatures, including short aggregated outputs and a rule never to paste the 207k-row SCADA file into context.

### Three detection tools
- **`query_scada`**: aggregated pressure and flow stats for a station and time window, plus compressor and valve status. Its key output is the **mass-balance deficit** with a *sustained* flag. A sustained deficit is the primary leak signal.
- **`check_operational_context`**: looks for things that explain a false alarm: compressor starts, valve changes, and temperature-driven line-pack changes. I tuned the lookback windows to 6 hours for mechanical events and 12 hours for weather, with a temperature-swing threshold of more than 15°F. This context explains false positives, but it never overrides a sustained deficit.
- **`locate_leak`**: uses the ratio of pressure gradients between the two bounding stations to estimate where the leak is. It returns the segment, mile marker, nearest valves and a recommended isolation.

### Validation harness
I wrote `validate_all_events.py` to run the detection logic over all 20 labelled events and score it against the labels (results below).

### Integration and deployment
- Added Strands `@tool` decorators to the tools and wired them into the agent. The Sonnet 4 model ID turned out to be legacy in our lab account, so I moved the agent to **Claude Sonnet 4.5**. I then got the first end-to-end run working: a false-positive event classified correctly, with its evidence chain and citations.
- Deployed the agent to **Amazon Bedrock AgentCore Runtime** in us-east-1. The package bundled the agent, all of its tools and the data, and the Runtime served HTTP with **SSE streaming** and session IDs for conversation continuity.
- Wrote the **`AgentCoreAdapter`**, which calls `invoke_agent_runtime` through boto3 and parses the SSE stream into a structured investigation result that the operator console displays.

## Results

- **5/5 leaks detected** and **15/15 false positives rejected** across the 20 labelled events.
- **Average localization error: 5.0 miles** on the 200-mile line (range 0.8–9.7 miles).
- The agent went from an empty scaffold to a deployed, tested AgentCore Runtime within the single build day.
- **2nd place** overall.

## Lessons

- **Shared instructions coordinate AI-assisted teammates.** With three people each driving their own Claude Code session, the CLAUDE.md sync rule worked as a lightweight protocol. Interface changes and fixes showed up in the shared log instead of getting lost.
- **Pick one primary signal.** Making a sustained mass-balance deficit the deciding factor, and using operational context only to explain alarms, kept the logic simple. It also avoided explaining away real leaks.
- **Validate against every labelled case, not a demo case.** Running the harness over all 20 events gave a real accuracy number instead of one hand-picked success.
- **Check model availability in the actual account early.** A legacy model ID is a quick fix, but only if you find it before deployment.

**Stack:** Python, pandas · Strands Agents SDK · Amazon Bedrock (Claude Sonnet 4.5) · Amazon Bedrock AgentCore Runtime · boto3 · Claude Code · git/GitHub
