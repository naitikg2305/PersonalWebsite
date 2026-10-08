---
title: "Scoring LLM Answers: Deterministic Metrics, Grounding Checks and LLM-as-Judge"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-scoring-metrics-and-judges"
summary: "A layered approach to scoring LLM and RAG outputs: embedding similarity, tolerant number matching, retrieval precision/recall, number and entity grounding for hallucination detection, spaCy intent checks, and when to add an LLM judge."
---

# Scoring LLM Answers: Deterministic Metrics, Grounding Checks and LLM-as-Judge

"Is this answer good?" is not one question. It's several: is it similar to a reference, are its numbers right, did it retrieve the right evidence, is everything it claims supported by that evidence, and is it actually helpful? When I designed the scoring for an LLM evaluation bench, I split these into **layers**, with cheap deterministic checks first and an LLM judge last. This article explains each metric, how to implement it, and where it misleads.

```
Layer 1  Semantic        embedding similarity · numbers match · style heuristics
Layer 2  Retrieval &     top-k precision/recall · numbers grounded in docs ·
         grounding       answer-term grounding · intent grounding (spaCy)
Layer 3  LLM judge       relevancy · faithfulness · context relevancy · correctness · coherence
(+)      Domain          SQL row match · golden-set checks
```

**Why deterministic first?** Deterministic metrics give the same output for the same input, cost nothing to run, and can be debugged line by line. An LLM judge is costly, slightly non-reproducible, and can be wrong itself. Use it for what rules can't see.

---

## Layer 1: semantic comparison

### Embedding similarity
Embed the endpoint's answer and the reference (baseline or golden) answer with the same sentence-transformer, normalize the vectors, and take the dot product.

```python
def answer_similarity(a: str, b: str) -> float:
    ea, eb = embedder.encode([a, b], normalize_embeddings=True)
    return float(ea @ eb)        # cosine similarity
```

This measures *intent*, not wording: "intake, compression, power, exhaust" and "the four strokes are intake, compression, combustion/power and exhaust" score about 0.99. **Limitation:** two answers that disagree on a number can still score 0.95, because embeddings barely notice digits. Never use similarity alone.

### Numbers match (with tolerance)
Extract numbers (including percentages) with a regex, and require every number in the endpoint's answer to match some number in the reference:

```python
NUM = re.compile(r"-?\d+(?:,\d{3})*(?:\.\d+)?%?")

def close(a: float, b: float, rel=0.05, abs_tol=0.01) -> bool:
    return abs(a - b) <= max(abs_tol, rel * max(abs(a), abs(b)))
```

The tolerance matters. "10%" vs "10.2%" or "$1,250" vs "$1,250.00" shouldn't fail. Clean up thousands separators and currency symbols before parsing. Report the mismatches, not just a boolean, because "1250 not found in reference" is directly actionable.

### Style heuristics
Word count, lexical diversity, and the answer-to-question length ratio. They're not quality on their own, but they catch truncated answers, rambling, and repetition loops.

---

## Layer 2: retrieval and grounding

### Top-k precision and recall
Compare the chunk IDs the endpoint retrieved with the IDs the bench retrieved for the same question: `precision = |overlap| / |app_ids|` and `recall = |overlap| / |truth_ids|`. **Normalize IDs first.** Different folder prefixes for the same file will give a false zero. I compute both a raw and a path-suffix-aligned version and report both, so a gap between them is itself a diagnostic.

### Numbers grounded in retrieved docs
This is the single most useful hallucination check I've built. Every number in the endpoint's **answer** must appear (within tolerance) somewhere in the text of the **docs the endpoint itself returned**:

```python
def numbers_grounded(answer: str, docs: list[dict]) -> dict:
    doc_nums = [n for d in docs for n in extract_numbers(d.get("text", ""))]
    violations = [n for n in extract_numbers(answer)
                  if not any(close(n, d) for d in doc_nums)]
    return {"grounded": not violations, "violations": violations}
```

If the model says "300 hp" and no retrieved chunk contains 300, that's an invented number. It catches the most damaging kind of hallucination, the confident and specific kind.

**Gotcha:** derived numbers fail legitimately. If rows contain 9 and 10 and the narrative says "90%", the check flags 90. For analytics answers I read these violations as "computed, verify" rather than "hallucinated".

### Answer-term grounding
The same idea for words. Use spaCy to extract nouns and named entities from the answer, then check each one appears in the retrieved text:

```python
import spacy
nlp = spacy.load("en_core_web_sm")

def answer_term_grounding(answer: str, docs_text: str) -> dict:
    doc = nlp(answer)
    terms = {t.lemma_.lower() for t in doc if t.pos_ in ("NOUN", "PROPN")}
    terms |= {e.text.lower() for e in doc.ents if not e.text[:1].isdigit()}
    hay = docs_text.lower()
    unsupported = sorted(t for t in terms if t not in hay)
    rate = 1 - len(unsupported) / max(len(terms), 1)
    return {"grounding_rate": rate, "hallucination_risk": 1 - rate,
            "unsupported_terms": unsupported[:20]}
```

It's best-effort (substring matching, no synonyms), so treat it as a **risk signal**. A component name that appears nowhere in the evidence deserves a look.

### Which text counts as evidence?
This is a real policy decision. Should the answer be checked against **the text the endpoint returned**, or against **the bench's canonical copy** of the chunks it cited? Checking returned text catches wiring bugs: snippets that are truncated, empty, or mapped to the wrong chunk. Checking canonical text gives a single source of truth, but it can miss cases where the model saw something different. I default to the endpoint's returned text, and I document the choice.

### Intent grounding with spaCy
When a question was generated from a known source chunk, I can ask: *does the answer talk about what that chunk talks about?* Extract nouns and **verb lemmas** from both:

- `noun_coverage`: the fraction of the chunk's nouns that appear in the answer.
- `verb_agreement`: the fraction of the chunk's verb lemmas that appear in the answer. Lemmatization means "sat", "sitting", and "sit" all match.
- `intent_score`: the mean of the two.

It's fully deterministic, with no embeddings and no LLM. **Caveat:** it's context-sensitive. A chunk about the history of an engine mentions inventors and dates that a short, correct answer rightly leaves out, which gives a low score. I treat it as a soft signal, never as a gate.

---

## Layer 3: LLM-as-judge

Some qualities need judgment: completeness, whether the answer actually addresses the question, and coherence. For these, I run a G-Eval-style judge. **One call** receives the question, the reference context, and *both* answers (endpoint and baseline), then scores each one from 0 to 1 on:

- **answer relevancy**: does it answer the question?
- **faithfulness**: is it supported by the context?
- **contextual relevancy**: was the context itself relevant?
- **correctness**: is it factually right?
- **coherence**: is it well structured?

It also returns an `overall_preference` (endpoint / baseline / tie) and a short rationale per answer.

Design choices that made the judge more trustworthy:

- **Score both answers in one call.** It's cheaper, and relative judgments are more stable than absolute ones.
- **Ask for a rationale**, so you can audit disagreements.
- **Use temperature 0 and strict JSON output** with a parse fallback.
- **Keep it optional and separately aggregated.** It adds API cost and must never be the only signal.
- **Remember the judge can disagree with your baseline, and be right.** In one run, the baseline listed "ignition" as a separate stroke and the judge correctly preferred the endpoint's standard four-stroke naming. Judges are evaluators, not oracles.

## Mirroring and alignment

A trick I found useful: compute the **same deterministic metrics for the baseline answer** against the baseline's own retrieval, then measure the per-metric agreement `1 - |endpoint - baseline|`. If the endpoint's faithfulness is 0.6 and the baseline's is 0.95 on the same question, the gap points at the endpoint. If both are 0.6, the question or corpus is probably the problem.

## Domain layers

- **SQL row match:** for text-to-SQL, compare result rows from an independent query with tolerant equality (null ≈ 0, case-insensitive keys, ±5 percent numeric), falling back to key-metric matching when column shapes differ.
- **Golden checks:** expected-answer similarity above a threshold, required substrings present, and exact equality on structured fields such as which route or template was chosen.
- **Composite pass/fail:** for BI, I mark an answer correct only when rows match, *and* narrative similarity is above about 0.55, *and* the numbers are grounded. Each sub-signal is still reported on its own.

## Aggregation

Report means and rates per metric (similarity, precision and recall@k, grounding rate, numbers-match rate, judge means) plus **p95 latency**. Skipped metrics are `null` with a reason and are excluded from means. A zero average caused by "not applicable" is a classic way to fool yourself.

## Key takeaways

- Layer your metrics: deterministic semantic checks, then retrieval and grounding, then an optional LLM judge.
- Embedding similarity measures intent but ignores numbers, so always pair it with tolerant number matching.
- "Every number in the answer appears in the retrieved evidence" is a cheap, powerful hallucination detector. spaCy term grounding extends it to entities.
- Decide explicitly which text counts as evidence, and normalize IDs before computing retrieval overlap.
- Use an LLM judge for relevancy, completeness, and coherence. Score both answers in one call, ask for rationales, and never treat the judge as ground truth.
- Report every metric separately with skip reasons. Composite scores are for dashboards, and individual signals are for debugging.
