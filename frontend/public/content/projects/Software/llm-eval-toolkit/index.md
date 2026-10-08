---
title: "LLM Evaluation Toolkit"
category: "software"
order: 4
date: "2026-10-06"
tags: ["LLM Evaluation", "Python", "Statistics", "LLM-as-a-Judge", "RAG", "pytest"]
summary: "Five small, offline-reproducible Python tools covering different parts of LLM evaluation: failure taxonomies, LLM-judge reliability, regression gating, inter-annotator agreement and RAG answer quality. Built with mock backends and synthetic data."
---

# LLM Evaluation Toolkit

## What it is

Five standalone Python projects, each covering one part of applied LLM evaluation:

1. **AI Failure Taxonomy Analyzer**: multi-label failure classification with a human review loop
2. **LLM-as-a-Judge Reliability Study**: how far an LLM judge can be trusted, and where it breaks
3. **LLM Regression Suite**: a CI-style gate for prompt and model changes
4. **LLM Response Evaluation Benchmark**: human-annotated evaluation with inter-annotator agreement
5. **RAG Answer Quality Evaluator**: retrieval, faithfulness and citation quality for RAG pipelines

> **How this was built, honestly:** I built these with **Claude Code**, running parallel subagents in one session. They were tested only with **deterministic mock backends and synthetic data**, so everything is **offline-reproducible**, but no real model has been evaluated yet. The demo outputs show that the metrics recover effects *planted* in the synthetic data. They say nothing about real models. The repos aren't published yet.

## Shared design

All five follow the same pattern:
- A **typer** CLI, **pydantic v2** schemas and **JSONL** data files.
- One small **LLM backend interface**, `get_backend(name).complete(prompt, system, temperature)`, over plain `httpx` with no vendor SDKs. It supports `mock | ollama | anthropic | openai`. The real-provider paths are written but have only been tested against mocked HTTP and failure cases.
- A **seeded mock backend** for each project, so the whole pipeline runs offline and the committed `examples/` outputs reproduce exactly.
- A README with an explicit **Limitations** section.
- **292 pytest tests** across the five projects, all passing.

## The five tools

### 1. AI Failure Taxonomy Analyzer
- An 8-category multi-label taxonomy in YAML: hallucination, factual error, reasoning error, unsupported claim, omission, over-refusal, instruction violation and formatting failure. Each category has decision rules, examples, a severity weight and a remediation hint.
- A **rule-based classifier** (refusal patterns, format and length constraints parsed from the prompt, fabricated-citation and DOI checks, re-computed arithmetic) **ensembled** with an LLM classifier that has robust JSON parsing, one retry, then abstention.
- A **human-in-the-loop review queue** ranked by low confidence and classifier disagreement. Corrections go to an append-only audit log, and labels resolve as human correction > gold > prediction.
- Metrics: per-category precision, recall and F1, macro and micro F1, Hamming loss, and a multi-label confusion matrix. Also failure rates broken down by model, domain and severity.

### 2. LLM-as-a-Judge Reliability Study
- **Agreement with human labels:** Cohen's κ for pairwise verdicts; Spearman, Kendall and Pearson correlation and MAE for 1–10 scores.
- **Position bias:** swap A/B order and test the first-position rate with a two-sided binomial test.
- **Verbosity bias:** content-preserving padding, tested with a Wilcoxon signed-rank test.
- **Prompt and rubric sensitivity** across paraphrased templates and 5 rubrics (Fleiss' κ), plus **self-consistency** over repeated sampling.
- A weighted **triage queue** that flags items where the judge looks unreliable. The tests also check the reverse case: with zero injected bias, no bias is detected.

### 3. LLM Regression Suite
- A golden set of 55 tagged cases. Runs are cached under content-hashed run IDs, and `rescore` re-scores cached outputs without calling the model again.
- Deterministic metrics: exact and normalized match, token F1, fact coverage, forbidden-claim and unsupported-number checks, and JSON, length and bullet instruction checks.
- Run comparison with a **95% paired bootstrap CI** for each metric delta and an **exact McNemar test**, plus a per-tag breakdown and unified diffs.
- **YAML-configured gates:** max metric drops, minimum rates, zero new hallucinations on critical tags such as medical and safety, and a cap on regressed examples. Exit codes `0` pass, `1` gate fail, `2` backend error, so it can block CI. A sample GitHub Actions workflow is included but has not been run.

### 4. LLM Response Evaluation Benchmark
- A 6-dimension rubric with anchored 1–5 descriptions, and cross-file referential validation of the data.
- **Agreement statistics implemented from scratch in NumPy:** Krippendorff's α (nominal, ordinal and interval), Cohen's κ (unweighted, linear and quadratic) and Fleiss' κ. They're **validated against published worked examples**, including the one in Krippendorff (2011).
- An additive **annotator-bias model** (lenient, harsh, compressed-range and noisy flags) and a priority-sorted **adjudication queue** for ambiguous items.
- Model comparison with a paired bootstrap over prompts and pairwise win rates.

### 5. RAG Answer Quality Evaluator
- **Retrieval:** recall@k, precision@k, MRR and nDCG@k.
- **Answers:** exact match, token F1 and an optional LLM judge.
- **Faithfulness:** claim-level verification (supported, unsupported or contradicted) against the retrieved context.
- **Citations:** ALCE-style citation precision and recall.
- **Failure attribution:** rule-based separation of retrieval failures from generation failures, plus abstention scoring on unanswerable questions.
- A minimal RAG pipeline to evaluate: 3 chunkers (fixed window, sentence packing, markdown heading) × 3 retrievers (BM25, TF-IDF, dense embeddings) × k ∈ {1, 3, 5}, giving an **18-config experiment grid**.

## What I learned
- **Validate the judge before trusting it.** Position and verbosity bias are measurable, and a triage queue is a cheap way to send the risky items to people.
- **Report uncertainty.** With about 50 test cases, one example moves a metric by about 2 points. That's why the regression gate reports paired CIs and McNemar p-values, not just deltas.
- **Separate retrieval failures from generation failures.** Otherwise "the RAG is bad" isn't actionable.
- **Synthetic data proves the plumbing, not the conclusions.** When the rules and the data are written together, scores come out optimistic. The next step is to run these tools against real backends (a local Ollama model or Claude Haiku) on real data.

**Stack:** Python 3.12, uv, typer, rich, pydantic v2, httpx, PyYAML, NumPy, SciPy, scikit-learn, rank-bm25, pytest
