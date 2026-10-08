---
title: "RAG Fundamentals: Chunking, Embeddings, Vector Stores and Context Assembly"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-rag-fundamentals"
summary: "How a retrieval-augmented generation pipeline actually works end to end, from chunking and embedding documents to retrieving top-k context and prompting the model."
---

# RAG Fundamentals: Chunking, Embeddings, Vector Stores and Context Assembly

Retrieval-Augmented Generation (RAG) is the most common way to make a language model answer questions about *your* data without retraining it. I have built RAG pipelines on top of hosted models (OpenAI, Claude via Bedrock) and on top of small local models (Phi-3 Mini running in 4-bit on a laptop GPU). The core design turned out to be identical in both cases. This article explains that core.

## What RAG is, and why it exists

A language model only knows what was in its training data. It doesn't know your PDFs, your product manuals, or anything that happened after its training cutoff. RAG fixes this in two steps:

1. **Retrieve** the few pieces of your documents that are most relevant to the question.
2. **Generate** an answer with the model, passing those pieces in the prompt as context.

The model is "grounded" in your text instead of relying only on what it memorized. You can change what it knows by changing the documents, and nothing has to be retrained.

## The two phases

```
INGEST (once, or whenever documents change)
  documents ──► extract text ──► chunk ──► embed each chunk ──► vector store
                                                               (id, text, vector, metadata)

QUERY (every user question)
  question ──► embed (same model!) ──► nearest-neighbour search ──► top-k chunks
                                                                       │
                       prompt = instructions + context + question ◄────┘
                                          │
                                          ▼
                                         LLM ──► answer (+ source references)
```

A common misunderstanding, and one I had to explain to myself early on: **the context the model sees is not the whole knowledge base.** The vector store might hold ten thousand chunks. The model only ever sees the `top_k` of them (often 3 to 10) that are closest to the current question. Everything else stays in the database.

## Chunking

Documents are too long to embed or prompt as a whole, and one vector for an entire 80-page manual would blur every topic together. So documents are split into **chunks**, and both embedding and retrieval happen at the chunk level.

The simplest approach that works well is a **fixed-size sliding window with overlap**:

```python
CHUNK_SIZE = 512      # characters
CHUNK_OVERLAP = 64    # characters shared between neighbouring chunks

def chunk_text(text: str, source: str):
    chunks, start, idx = [], 0, 0
    while start < len(text):
        piece = text[start:start + CHUNK_SIZE].strip()
        if piece:
            chunks.append({"id": f"{source}#chunk_{idx}", "text": piece, "source": source})
            idx += 1
        start += CHUNK_SIZE - CHUNK_OVERLAP   # step 448 chars forward
    return chunks
```

Some trade-offs I learned:

- **Smaller chunks (256 to 512 chars)** retrieve more precisely, but each chunk may lack surrounding context.
- **Larger chunks (1,000 to 2,000 chars)** carry more context, but retrieval is coarser and you pull more irrelevant text into the prompt.
- **Overlap of roughly 10 to 20 percent** means a fact cut by a chunk boundary still appears whole in at least one chunk. With no overlap, important sentences get split down the middle.
- **Chunk IDs matter.** A stable ID like `{source}#chunk_{n}` lets you cite sources and compare retrieval across systems. As the failure-modes article explains, the ID format can quietly break evaluations.

Fancier strategies exist, such as sentence-aware, paragraph-aware, or semantic chunking that splits on topic shifts. For many document sets, a fixed window plus overlap is a good baseline, and you should measure before you try anything cleverer.

## Embeddings

An **embedding** is a fixed-length vector that represents the meaning of a piece of text. Texts with similar meanings get vectors that point in similar directions, even when they share no keywords. A question about "fuel economy" can retrieve a chunk about "miles per gallon".

I used `sentence-transformers` with `all-MiniLM-L6-v2`. It's small, fast, produces 384-dimensional vectors, and is good enough for most English RAG work. Larger models such as `all-mpnet-base-v2` (768 dimensions) are more accurate but slower.

```python
from sentence_transformers import SentenceTransformer
import numpy as np

embedder = SentenceTransformer("all-MiniLM-L6-v2")   # load once, reuse

vecs = embedder.encode(["chunk one", "chunk two"]).tolist()     # batch for ingest
q = embedder.encode("What is the fuel economy?", normalize_embeddings=True)

# With normalized vectors, cosine similarity is just a dot product
a = embedder.encode("Answer A", normalize_embeddings=True)
b = embedder.encode("Answer B", normalize_embeddings=True)
similarity = float(np.dot(a, b))
```

**The golden rule:** use the *same* embedding model for ingest and for queries. If you switch models, or even switch to one with a different dimension, the old vectors are meaningless and you must re-ingest everything.

## The vector store

The vector store holds `(id, vector, text, metadata)` and answers "which stored vectors are closest to this one?" I used **ChromaDB** with a persistent client so the index survives restarts:

```python
import chromadb

client = chromadb.PersistentClient(path="./chroma_data")
coll = client.get_or_create_collection(
    "docs", metadata={"hnsw:space": "cosine"}   # cosine distance, not L2
)

# Ingest
coll.add(ids=ids, documents=texts, embeddings=embedder.encode(texts).tolist(),
         metadatas=[{"source": s} for s in sources])

# Query
res = coll.query(
    query_embeddings=embedder.encode([question]).tolist(),
    n_results=5,
    include=["documents", "metadatas", "distances"],
)
```

Storing the raw `documents` next to the vectors means you get the chunk text straight back for the prompt, without a second lookup.

A typical ingest job is a "rebuild" operation: delete the collection, recreate it, and re-add every chunk. It runs when documents change (manually, from a CI step, or from an `/ingest` endpoint), **not** on every chat request.

## Choosing top_k

`top_k` is how many chunks you retrieve per question.

- **3 to 5**: tight, cheap prompts. Good when answers live in one or two places.
- **10 to 20**: better recall for questions that span sections, but longer prompts and more noise for the model to ignore.

Small models are hurt more by noise than large ones, so with a 4K-context local model I kept `top_k` low.

## Context assembly and the prompt

Once you have the chunks, building the prompt is plain string work:

```python
context = "\n\n".join(d["text"] for d in docs) or "No relevant documents found."

prompt = f"""Use only the following context to answer the question.
If the answer is not in the context, say you don't know.

Context:
{context}

Question: {question}

Answer:"""
```

Two points are easy to get wrong:

1. **Don't add arbitrary character caps.** At one point I truncated context to a fixed number of characters "for safety", and it silently cut off the chunk that held the answer. The real limit is the model's context window, measured in **tokens**. If you must trim, count tokens and drop whole chunks from the lowest-ranked end.
2. **Budget the whole window.** System prompt + context + chat history + question + *the answer you want generated* all share the same context window. A 4K-token model with 5 chunks of 512 characters is fine. The same model with 20 chunks and a long chat history is not.

## Hosted model vs local model: what changes?

The RAG part (retrieve, assemble, prompt) is **identical**. What changes is who runs the model:

| Aspect | Hosted API | Local model |
|---|---|---|
| Retrieval and prompt | Your code | Your code (same) |
| Running the model | Provider | You: weights, GPU, quantization, tokenizer, chat template |
| Typical failures | Rate limits, cost, API errors | Out-of-memory, library version drift, wrong chat format |
| Data residency | Leaves your machine | Stays local |

When my local RAG app broke, the cause was never "RAG". It was the model-running layer, which is covered in the local-models article.

## Key takeaways

- RAG = retrieve the top-k relevant chunks, then generate with those chunks as context. The model never sees the whole knowledge base.
- Chunk with a sliding window and roughly 10 to 20 percent overlap, and give chunks stable IDs.
- Use one embedding model everywhere. If you change it, re-ingest.
- Use cosine distance and store the chunk text alongside the vectors.
- Budget the context window in tokens, not characters, and never truncate retrieved context blindly.
- The RAG design is provider-agnostic. Hosted and local models differ only in how the generation step is operated.
