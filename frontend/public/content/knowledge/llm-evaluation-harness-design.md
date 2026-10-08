---
title: "Designing an Evaluation Harness for LLM Endpoints"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-evaluation-harness-design"
summary: "How I designed a black-box test bench that evaluates any RAG, chatbot, or text-to-SQL endpoint: an independent source of truth, a baseline pipeline, plugin response normalizers, multi-turn sessions, and a SQL oracle."
---

# Designing an Evaluation Harness for LLM Endpoints

At work I built an **AI test bench**: a service that evaluates LLM-backed applications from the outside. You point it at an HTTP endpoint (a RAG chatbot, an agentic assistant, a natural-language BI API) and it runs a suite of questions, scores every answer, and produces a report. The key constraint was **no changes to the app under test**. The bench owns the whole verification pipeline. This article covers the architecture and the design decisions. The metrics themselves are in the companion article on scoring.

## The core problem: what is "correct"?

You can't evaluate an answer without something to compare it against. Hand-written expected answers (a "golden set") are valuable but expensive and go stale. The bench's central idea is to **build its own independent source of truth** and an independent baseline answer for every question:

- **For document Q&A (RAG mode):** the bench ingests the same documents into *its own* vector store, retrieves from it, and generates its own answer with a strong LLM.
- **For analytics/BI (SQL mode):** the bench connects read-only to the same database the API uses, has an LLM write an *independent* SQL query, executes it, and compares the rows.

Then the endpoint's answer is compared with the baseline across several layers of metrics.

## Architecture

```
            ┌──────────── inputs ─────────────┐
            │ docs (zip/dir)   SQL DB (read-only)   golden set (optional)
            └───────┬─────────────┬──────────────────────┬──────────┘
                    ▼             │                      │
           [1] Ingest → bench vector store               │
                    │             │                      │
           [2] Question generation (rule-based | LLM | user bank)
                    │             │                      │
           [3] Suite mode ──► RAG  or  SQL-API           │
                    │                                    │
     ┌──────────────┴──────────────┐                     │
     ▼                             ▼                     │
 POST endpoint                Bench baseline             │
 (per question / turn)        RAG: retrieve → LLM answer │
     │                        SQL: dates → LLM SELECT →  │
     ▼                             execute → summarize   │
 Normalize via preset              │                     │
     │                             │                     │
     └──────────────┬──────────────┘                     │
                    ▼                                    ▼
           [4] Comparison layers: semantic │ retrieval+grounding │ LLM judge │ SQL │ golden
                    ▼
           [5] Per-question rows + suite aggregates (means, rates, p95 latency)
```

It's a FastAPI service with a single-page UI, ChromaDB for the vector store, sentence-transformers for embeddings, spaCy for linguistic checks, and SQLAlchemy for database access. It's packaged as a Docker image so a whole suite can run anywhere.

## Design decision 1: question generation, three ways

1. **Rule-based from chunks:** "What does the document say about X?" This is cheap and deterministic, and each question records the `source_chunk_id` it came from, so later checks know exactly which text *should* support the answer.
2. **LLM-generated:** more natural questions, generated from chunk text (RAG) or from a short "context brief" describing the business domain (SQL mode).
3. **User question bank:** overrides generation entirely. This is essential for regression testing, where you want the same questions every run.

## Design decision 2: plugin response normalizers

Real endpoints don't share a JSON contract. One returns `{answer, top_k_docs}`. Another returns `{response, sources}`. A BI API returns `{narrative: {text}, data: {rows}, meta: {sql}}`. Hard-coding one shape would make the bench useless.

So every response passes through a **normalizer** that produces one internal shape:

```python
@dataclass
class NormalizedEndpointResponse:
    answer: str                 # main answer text
    top_k_docs: list[dict]      # sources / retrieved chunks / synthetic row-chunks
    prompt_echo: str | None     # the question echoed back, if any
    preset: str                 # which normalizer handled it
    warnings: list[str]         # extraction problems, surfaced in the report
```

Normalizers are a **file-drop plugin architecture**. Each preset is a folder exposing one function, registered with one line:

```python
# presets/nodes/my_app/normalize.py
def normalize(raw: dict) -> NormalizedEndpointResponse:
    return NormalizedEndpointResponse(
        answer=raw.get("output", ""),
        top_k_docs=raw.get("evidence", []),
        prompt_echo=raw.get("query"), preset="my_app", warnings=[],
    )

# presets/registry.py
PRESET_HANDLERS["my_app"] = my_app.normalize
```

There's no base class, decorator, or framework. Built-in presets cover the classic RAG shape, a **generic** preset, and a **BI** preset. The generic preset composes two mechanisms:

- **Alias lists** tried in order: answer ← `answer | response | text | message | output | result`; sources ← `top_k_docs | sources | documents | references | chunks`.
- **Dotted-path overrides** for nested JSON, such as `answer_path = "data.narrative.text"` or `result[0].text`. A path takes precedence, and the alias walk is the fallback.

The BI preset turns tabular `rows` into synthetic `{id, text}` "documents", so the same number-grounding checks work on analytics answers.

**Preset detection.** Before a full run, a `detect-preset` endpoint takes a pasted sample or sends one probe request, then uses heuristics to suggest a preset with a confidence score, reasons, and a normalized preview. "Does it have `narrative.text`? Then BI. `answer`? Then classic RAG. Otherwise, generic with paths." The user confirms the choice before spending a whole suite on the wrong mapping. Unknown preset names fall back to the default with a warning instead of crashing.

## Design decision 3: single-turn and multi-turn modes

| Mode | Behaviour |
|---|---|
| `single_response` | Every question is an independent POST with no session state |
| `chatbot_with_history` | One persistent session. Bank questions are asked first, then the bench LLM generates follow-ups that depend on earlier turns. The full conversation history goes to the endpoint *and* to the bench baseline every turn |

Agentic apps fail in ways single-turn tests never see: forgotten filters, pronouns resolved to the wrong entity, drift. Multi-turn mode scores every turn, so you can watch quality decay over a conversation.

## Design decision 4: two SQL oracles for text-to-SQL and BI

For natural-language BI endpoints, document grounding isn't enough. The real question is whether the numbers are right. The bench has two independent SQL checks:

**Disclosed SQL replay (integrity).** If the response exposes the SQL it ran (at a configurable path such as `meta.sql`) and its rows (such as `data.rows`), the bench re-executes that exact SQL with the same named binds against the same database and compares the rows. This proves the endpoint reports what its query actually returns. It does *not* prove the query was the right one.

**LLM SQL oracle (correctness).** Independently of the endpoint:

```
question ──► resolve tenant + date window   (LLM parse, rule-based fallback:
         │                                   "last 3 months", "in 2025", "this week")
         ├─► load schema manifest            (curated text, never live introspection)
         ├─► LLM writes ONE inline SELECT    (validated as a replayable read-only query)
         ├─► execute read-only on same DB ──► bench rows
         ├─► compare to endpoint rows        (loose: null≈0, case-insensitive keys, ±5% numeric)
         └─► LLM summarizes bench rows    ──► bench narrative for semantic comparison
```

Row comparison has to be forgiving about shape. Two correct queries may return different column sets, for example when one adds a computed percentage. So when strict row alignment fails, the oracle falls back to **metric matching**: do the shared key figures agree within tolerance? It also flags `baseline_unreliable` when the bench's own query returns zero rows, so a bad bench query doesn't penalize the endpoint.

A composite `endpoint_correct` flag combines them: rows or metrics match, **and** narrative similarity is above a threshold, **and** the narrative's numbers are grounded.

Lesson learned: the two oracles answer different questions. Replay = "is it honest?" Oracle = "is it right?" I keep them as separate signals rather than merging them into one score.

## Design decision 5: one LLM client, swappable providers

Every LLM use goes through one shared client: question generation, baseline answers, date resolution, SQL generation, narrative summaries, and the judge. The provider is chosen from the environment (OpenAI or Claude on AWS Bedrock). Swapping the evaluator model is a configuration change, and every LLM-dependent step changes consistently.

## Design decision 6: report everything, aggregate carefully

Each question produces one result row containing both answers, both sets of retrieved IDs, every metric, normalization warnings, and skip reasons. Suite aggregates include mean similarity, precision and recall@k, grounding rates, row-match rates, judge means, and **p95 latency**. When a metric doesn't apply (for example, retrieval overlap in SQL mode), it's recorded as `null` with a `skipped_reason`, not a misleading zero.

## Lessons learned

- **Independence is the point.** The bench's retrieval, SQL, and answers must be produced without looking at the endpoint's output, or you're only measuring agreement with yourself.
- **Normalization is half the work.** Most "metric is zero" bugs were extraction bugs, which is why preset warnings are surfaced in every row.
- **An LLM baseline can be wrong too.** In one run, the judge correctly preferred the endpoint's answer over the bench's. Treat the baseline as a strong reference, not ground truth.
- **Different valid answers exist.** A BI question about "utilization" can legitimately be computed two ways. A mismatch is a prompt for investigation, not an automatic failure.
- **Configuration beats code changes.** Paths, presets, binds, schema manifests, and providers are all per-run settings, so new endpoints rarely need new code.

## Key takeaways

- Build an independent source of truth and baseline for every question: a bench vector store for RAG, read-only SQL for BI.
- Normalize heterogeneous endpoint responses with small plugin functions, plus alias lists and dotted paths for the generic case.
- Support multi-turn sessions. Agentic failures appear across turns.
- For text-to-SQL, separate integrity (replay the disclosed SQL) from correctness (an independent LLM-generated query), and compare rows with tolerance and a metric fallback.
- Report every metric per row with explicit skip reasons. Aggregate only what's comparable.
