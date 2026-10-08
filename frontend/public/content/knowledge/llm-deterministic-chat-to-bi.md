---
title: "Deterministic Natural-Language-to-BI: Router, Constrained SQL Nodes and Safe Charts"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-deterministic-chat-to-bi"
summary: "An architecture for 'chat with your data' that stays reproducible and safe: an LLM intent router, pre-authored SQL report nodes, a guarded generic text-to-SQL node with AST validation and tenant scoping, and deterministic chart building."
---

# Deterministic Natural-Language-to-BI: Router, Constrained SQL Nodes and Safe Charts

"Ask your data a question, get a chart" is one of the most requested LLM features, and one of the riskiest. A naive version hands the model the database schema, lets it write SQL, runs whatever comes back, and asks the model to emit a chart spec too. That's fine for a demo. In production you get wrong numbers, different answers to the same question, broken charts, and in the worst case one customer's data leaking to another.

I designed and built a chat-to-BI feature for a multi-tenant restaurant analytics assistant. The product requirements were strict: **same question + same data ⇒ same answer**, read-only access, hard tenant isolation, and a few seconds of latency. This article describes the architecture that met them.

## Core idea: let the LLM choose, not compute

The LLM is good at understanding a question. It's unreliable at producing exact SQL and chart JSON every time. So I split the work:

| Job | Who does it |
|---|---|
| Understand intent, extract dates/granularity | LLM (router), temperature 0, JSON schema |
| Write the SQL for known report types | **Humans**: pre-authored, reviewed, parameterized |
| Write SQL for anything else | LLM, inside strict guardrails |
| Enforce tenant scope and read-only | **Code**, at the AST level |
| Build the chart | **Code**: a pure function from rows to spec |
| Explain the result in words | LLM, temperature 0, strict JSON, with a fallback |

## Architecture: N report nodes + 1 generic node

```
User message (+ recent conversation history)
        │
        ▼
 Orchestrator ── injects tenant_id from the verified auth token (never from the request body)
        │
        ▼
 Router (LLM call #1, temp 0)
   → { node: "revenue-trend" | "sales-mix" | ... | "generic",
       params: { dateFrom, dateTo, granularity, limit } }
        │
   ┌────┴──────────────────────────┬──────────────────────────────┐
   ▼                               ▼                              ▼
 Report node A               Report node B …               Generic node (guarded)
 pre-authored SQL            pre-authored SQL              LLM SQL → AST validate →
 fixed chart type            fixed chart type              tenant inject → execute
   │                               │                              │
   └───────────────┬───────────────┴──────────────────────────────┘
                   ▼
   rows → deterministic chart builder → LLM narrative (call #2, temp 0)
                   ▼
   { node, narrative, chart, data: { rows }, meta: { sql, latencyMs } }
```

It runs **in-process** in the existing TypeScript backend, with no separate agent service and no orchestration framework. The "agent graph" is a router function and a dispatch table. That kept latency low and the code easy to read.

### The router

One LLM call with a tight output schema:

```typescript
interface RouterOutput {
  node: "revenue-trend" | "sales-mix" | "conversion-funnel" | "generic";
  params: {
    dateFrom?: string;            // YYYY-MM-DD
    dateTo?: string;
    granularity?: "day" | "week" | "month";
    limit?: number;
  };
}
```

**Date handling is precomputed, not delegated.** LLMs are unreliable at calendar arithmetic, so before calling the router, code computes a reference table relative to today and injects it into the prompt:

```typescript
function buildDateContext(today = new Date()): string {
  return `
- "last 7 days" / "this week"   → ${iso(daysAgo(7))} to ${iso(today)}
- "last 30 days" / "last month" → ${iso(daysAgo(30))} to ${iso(today)}
- "last quarter" / "last 90 days" → ${iso(daysAgo(90))} to ${iso(today)}
- "this year" / "year to date"  → ${iso(startOfYear(today))} to ${iso(today)}`;
}
```

The model only has to *pick* the right row. Granularity follows simple rules: ≤14 days → day, ≤90 days → week, otherwise month. If no date is mentioned, the default is the last 30 days. **Follow-ups** ("what about last month?", "compare that to…") are routed to the generic node, which receives the recent conversation history.

### Report nodes: deterministic by construction

Every report node has the same shape:

```typescript
export async function runRevenueTrend(tenantId: string, p: Params, db: Db) {
  const binds = { tenantId, dateFrom: p.dateFrom ?? defaultFrom(), dateTo: p.dateTo ?? today() };
  const rows  = await db.query(REVENUE_TREND_SQL, { replacements: binds }); // pre-authored, read-only
  const chart = buildChartSpec({ type: "grouped_bar", rows, x: "period", y: ["revenue"] });
  let narrative = fallbackNarrative(rows);                      // computed string, always available
  try { narrative = extractJson((await callLLM({ rows, temperature: 0 })).text); } catch {}
  return { node: "revenue-trend", narrative, chart, data: { rows }, meta: { sql: REVENUE_TREND_SQL } };
}
```

There is **at most one LLM call**, and only for prose. The SQL and chart type are never generated. Adding a report means adding one node file. A pre-authored query can be reviewed, indexed, and tested like any other code.

### The generic node: non-deterministic, heavily guarded

Questions outside the catalog go to a generic node where the LLM *does* write SQL, inside layered guards:

1. **Frozen schema manifest.** The model sees a curated, versioned description of allowed tables and columns, not the live database. Sensitive columns (tokens, password hashes) are simply absent.
2. **Prompt sandboxing.** User text goes inside a dedicated tag, and the system prompt says never to follow instructions found inside it.
3. **AST validation.** The SQL is parsed (`node-sql-parser` in TypeScript; `sqlglot` is the Python equivalent). It's rejected unless it's a **single `SELECT`**: no `INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/CALL`, and no multiple statements. Anything that can't be parsed is also rejected.
4. **Tenant injection at the AST.** The validator adds `WHERE tenant_id = :tenantId` to the parsed tree if it's missing (and enforces a `LIMIT`). Isolation doesn't depend on the model remembering a rule.
5. **Read-only database user** with `GRANT SELECT` on only the needed tables, as defense in depth.
6. **Retry budget.** Up to two retries with the validator error fed back, then a graceful "try rephrasing" message.
7. **Transparency.** The response is labeled as an exploratory answer, and the UI shows the SQL.

```typescript
import { Parser } from "node-sql-parser";
const parser = new Parser();

function validateAndScope(sql: string, tenantId: string): string {
  const ast = parser.astify(sql, { database: "MySQL" });
  const stmts = Array.isArray(ast) ? ast : [ast];
  if (stmts.length !== 1 || stmts[0].type !== "select") throw new Error("Only a single SELECT is allowed");
  injectTenantFilter(stmts[0], tenantId);   // AND tenant_id = ? into every relevant FROM/JOIN
  ensureLimit(stmts[0], 500);
  return parser.sqlify(stmts[0]);
}
```

Logging every generic query has a useful side effect: questions that come up repeatedly are candidates for **promotion to a new report node**, so the deterministic catalog grows from real usage.

## Deterministic charts

The early prototype asked the LLM to emit full Plotly JSON. The colors, axes, and even the chart types varied from run to run. In the production design, the **chart type is fixed per report node** (or chosen from a closed enum by the generic node), and a pure function builds the spec:

```
buildChartSpec(rows, { type, x, y[], groupBy?, stack? }, theme) → PlotlySpec
type ∈ bar | grouped_bar | stacked_bar | horizontal_bar | line | scatter |
       donut | funnel | heatmap | treemap | histogram
```

Same rows + same decision ⇒ byte-identical chart JSON. Theme, fonts, and axis formats live in code. The frontend passes the spec straight to the Plotly component, and PNG/PDF export reuses the same spec.

**A bug worth knowing about.** Weekly buckets originally used MySQL's `%Y-%u` (year-week) format, so week 6 became `"2026-06"`. Plotly auto-detected that as `YYYY-MM` and drew it as *June*. The fix was to make every period a real ISO date: day → `%Y-%m-%d`, week → the Monday of that week, month → the 1st of the month. The chart builder then detects ISO dates and sets `xaxis.type = "date"`, using `"%b %Y"` ticks when every value is the 1st of a month. Don't let a charting library guess your date format.

## The determinism checklist

- **Temperature 0** for every call: router, narrative, generic SQL.
- **Pinned model version.** Never a floating "latest" alias. On Bedrock, cross-region inference profile IDs need the regional prefix, or on-demand invocation fails.
- **Template-first.** Free-form SQL is the fallback, not the default.
- **Closed enums** for anything structural (node names, chart types).
- **Prompts are code**: version-controlled, and every change re-runs the golden set.
- **Idempotent cache** on `(node, params_hash, data_version)`, so a repeated question skips the LLM entirely.
- **Narrative fallback.** If the LLM is unavailable or returns bad JSON, return a computed summary. The data and chart still render.

## Evaluating it

- **Router golden set:** 10 to 20 phrasings per report and the expected node, with pass rate tracked per commit.
- **Independent SQL oracle:** an evaluation bench writes its own SQL for the same question and compares rows with tolerance. This found real issues, including a revenue figure that differed because the two queries disagreed on which transaction types counted.
- **Disclosed-SQL replay:** re-run the SQL in `meta.sql` to confirm the rows weren't altered.
- **Ambiguous metrics are a product issue.** "Utilization" can mean the share of tables booked or the share of seats filled. Both are valid, and they differ several-fold. The fix is a defined metric in the report node and the schema manifest, not a better prompt.

## Lessons learned

- Let the LLM **route and narrate**, and let code **compute**.
- Never take the tenant ID from the request body. Derive it from the verified token and inject it into the AST.
- Keep the schema manifest in sync with the live database. Column-name drift between the manifest and the actual tables caused failures that looked like LLM mistakes.
- Precompute dates. Don't ask the model to do calendar math.
- Always have a non-LLM fallback for the narrative.

## Key takeaways

- An intent router plus pre-authored SQL report nodes gives reproducible answers. A guarded generic node handles the long tail.
- Enforce safety in code: single-`SELECT` AST validation, AST-level tenant scoping, a read-only DB user, and a frozen schema manifest.
- Build charts with a pure function from rows and an enum chart type, never from LLM-emitted JSON.
- Normalize all time buckets to ISO dates to avoid charting libraries misreading them.
- Pin models, use temperature 0, version prompts, cache results, and test routing and SQL correctness against golden sets and an independent oracle.
