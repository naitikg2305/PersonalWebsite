---
title: "RAG Failure Modes and How to Debug Them"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-rag-failure-modes"
summary: "A field guide to the ways RAG systems fail (retrieval misses, chunking artifacts, context overflow, ID mismatches, ungrounded answers) and how to tell which layer is at fault."
---

# RAG Failure Modes and How to Debug Them

A RAG demo is easy. A RAG system that gives the right answer reliably is much harder. When I built RAG apps and later a test bench to evaluate other people's RAG endpoints, I kept seeing the same failures. This article sorts them by layer, because the first debugging question is always **"which layer broke?"**

```
 question
    │
    ▼
[1] Ingest/Chunking ──► [2] Embedding/Retrieval ──► [3] Context assembly ──► [4] Generation
     (index time)           (query time)               (prompt building)        (the model)
```

A bad answer can come from any of these four layers. The fix is very different in each case.

---

## Layer 1: Ingest and chunking failures

### Text extraction garbage
PDF extraction can return text that is out of order, hyphenated across lines, missing tables entirely, or empty for scanned documents. If the chunk text is bad, everything downstream is bad too.

**Check:** print a few raw chunks after ingest. If they read badly to you, they will retrieve badly too.

### Facts split across chunk boundaries
A fixed window with no overlap can split "The maximum torque is" from "320 Nm". Neither half retrieves well on its own.

**Fix:** add 10 to 20 percent overlap, or chunk on sentence or paragraph boundaries.

### Stale index
The documents changed but nobody re-ran ingest. The model answers confidently from old text.

**Fix:** treat ingest as a deploy step and record an index version or build timestamp.

### Embedding model changed without re-ingest
If the query-time embedder differs from the ingest-time embedder, similarity scores become noise. A dimension mismatch fails loudly. A different model with the same dimension fails *silently*, which is worse.

**Fix:** store the embedding model name in collection metadata and assert it at query time.

---

## Layer 2: Retrieval failures

### The right chunk exists but isn't in top-k
This is the most common failure. Typical causes:

- The question uses vocabulary the chunk doesn't, and a small embedding model can't bridge the gap.
- Many near-duplicate chunks (boilerplate, headers, legal footers) crowd out the useful one.
- `top_k` is too small for questions that span multiple sections.

**Check:** for a failing question, query the store directly and print the top 20 results with distances. If the right chunk ranks 7th and `top_k = 5`, you have found the problem.

**Fixes:** increase `top_k`, strip boilerplate before chunking, try a stronger embedder, or add hybrid keyword + vector search.

### Open-ended questions retrieve everything and nothing
"Tell me about engines" matches loosely against dozens of chunks. Running a small local model, I found this produced rambling answers that didn't know when to stop. "How does a four-stroke engine work?" produced a crisp, grounded answer.

**Fix:** a system prompt that constrains length and scope. For product UX, consider clarifying questions.

### Doc-ID mismatches that make retrieval look broken
This one cost me real debugging time. Two systems indexed *the same files*, but one stored IDs as `Manuals/engine.pdf#chunk_5` and the other as `engine.pdf#chunk_5`. A strict set-intersection of retrieved IDs reported **0 percent overlap** while both systems were retrieving identical chunks.

Comparing filenames only is too loose, because `a/x/foo.pdf` and `a/y/foo.pdf` would then match. The fix I settled on was **path-suffix alignment**: two IDs match when the final `filename#chunk_N` segment is identical *and* one side's directories are a suffix of the other's.

```python
def ids_align(a: str, b: str) -> bool:
    a_dirs, a_leaf = a.rsplit("/", 1) if "/" in a else ("", a)
    b_dirs, b_leaf = b.rsplit("/", 1) if "/" in b else ("", b)
    if a_leaf != b_leaf:
        return False
    da = [p for p in a_dirs.split("/") if p]
    db = [p for p in b_dirs.split("/") if p]
    short, long_ = (da, db) if len(da) <= len(db) else (db, da)
    return long_[len(long_) - len(short):] == short
```

Even with aligned IDs, `chunk_5` only means the same thing if both systems used the same chunk size and overlap. Matching IDs say the chunk identity is the same *in principle*. They don't prove the model saw the same bytes.

---

## Layer 3: Context assembly failures

### Silent truncation
I once had a "safety" cap that kept only the first N characters of the assembled context. Whenever the answer sat in the 4th or 5th chunk, it was cut off before the model ever saw it. The model then said "not in the context" or, worse, guessed.

**Fix:** remove arbitrary caps. If you must trim, do it by **token count** and drop whole low-ranked chunks.

### Context window overflow
System prompt + chunks + history + question + room for the answer all share one window. With a 4K-token local model, a long conversation history plus 10 chunks can push the question itself out of the window, or leave no room to generate an answer.

**Check:** log the prompt token count for every request.

### Lost in the middle
Long contexts with the relevant chunk buried in the middle often get worse answers than the same chunk placed first or last. Keep the highest-ranked chunks at the edges, and keep `top_k` modest.

---

## Layer 4: Generation failures

### Ungrounded numbers and entities (hallucination)
The model writes "the engine produces 300 hp" when the retrieved text says 250, or names a component that appears nowhere in the context. This is the most dangerous failure because the answer *sounds* right.

**Detect it deterministically:** extract every number from the answer and check that each appears (within tolerance) in the retrieved chunk text. Do the same for nouns and named entities using spaCy. The evaluation articles cover both checks in detail.

### Ignoring the "say you don't know" instruction
Small models are especially prone to answering anyway. A clear system message, greedy decoding (`do_sample=False`), and asking the model to cite chunk IDs all help.

### Wrong prompt format (local models)
If a local instruct model receives a raw string instead of its trained chat template, it hallucinates, continues the user's sentence, or never stops. Always use `tokenizer.apply_chat_template(...)`. This is covered in the local-models article.

### Correct retrieval, correct grounding, still a poor answer
Sometimes every chunk is right and every number is grounded, but the answer is incomplete or misses the point. Deterministic checks can't catch this. An LLM-as-judge rubric (relevancy, completeness, coherence) is the right tool here.

---

## A debugging checklist

When a RAG answer is wrong, walk the layers in order:

1. **Is the fact in the corpus at all?** Search the raw extracted text.
2. **Is it in a clean chunk?** Print the chunk.
3. **Does it rank in top-k for this question?** Print the top 20 with distances.
4. **Did it reach the prompt intact?** Log the final prompt and its token count.
5. **Did the model use it?** Compare the answer's numbers and entities with the context.

Logging the retrieved IDs, the final prompt, and the answer for every request turns most of these steps into a two-minute check instead of a guessing game.

## Key takeaways

- Debug by layer: ingest, retrieval, context assembly, then generation. Most "the LLM is wrong" bugs are really retrieval or prompt-assembly bugs.
- Print chunks, print top-20 retrievals, and log final prompts with token counts.
- Normalize document IDs before comparing retrieval across systems. Path-suffix alignment avoids both false zeros and false matches.
- Never truncate context by characters. Budget the whole window in tokens.
- Check numbers and entities in the answer against the retrieved text. That is a cheap, deterministic hallucination detector.
- Use an LLM judge only for what deterministic checks can't see: completeness and quality.
