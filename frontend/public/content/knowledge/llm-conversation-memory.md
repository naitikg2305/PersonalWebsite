---
title: "Conversation Memory for LLM Chat and RAG"
category: "Applied LLMs: RAG, Local Models & Evaluation"
slug: "llm-conversation-memory"
summary: "How to add multi-turn memory to a chat or RAG app: session stores, history windows, prompt layouts for single-prompt vs messages-API models, and strategies for long conversations."
---

# Conversation Memory for LLM Chat and RAG

Language models are **stateless**. Every API call or `generate()` call starts from nothing. When a chatbot "remembers" what you said three messages ago, it's because the application sent those messages again. I built the same RAG app twice, once stateless and once with session memory, and the difference was all application code, not model capability.

## Why memory matters

Without memory, each question stands alone. Follow-ups break:

```
User: What's the torque of the 2.0L engine?
Bot:  320 Nm.
User: And the 1.5L?          ← "the 1.5L what?" — the model has no idea
```

With memory, the model can resolve pronouns ("how much does *it* cost?"), handle ellipsis ("and the 1.5L?"), and stay consistent across a conversation. In analytics assistants, memory is what makes "now break that down by month" work.

## Architecture: a server-side session store

```
client                          server
  │  POST /chat {message, session_id?}
  ├────────────────────────────►│
  │                             │ history = sessions.get(session_id) or new session
  │                             │ window  = history[-MAX_HISTORY:]
  │                             │ docs    = retrieve(message)            (RAG step)
  │                             │ answer  = llm(window + docs + message)
  │                             │ history += [user msg, assistant msg]
  │◄────────────────────────────┤ {answer, session_id}
```

A minimal FastAPI-style version:

```python
import uuid

SESSIONS: dict[str, list[dict]] = {}
MAX_HISTORY_MESSAGES = 10   # last 5 user/assistant exchanges

def get_or_create(session_id: str | None) -> tuple[str, list[dict]]:
    if session_id and session_id in SESSIONS:
        return session_id, SESSIONS[session_id]
    sid = session_id or str(uuid.uuid4())
    SESSIONS[sid] = []
    return sid, SESSIONS[sid]

def chat(message: str, session_id: str | None):
    sid, history = get_or_create(session_id)
    window = history[-MAX_HISTORY_MESSAGES:]
    answer = rag_answer_with_history(message, window)
    history += [{"role": "user", "content": message},
                {"role": "assistant", "content": answer}]
    return {"answer": answer, "session_id": sid}
```

The client gets `session_id` from its first response and sends it back with every later message. A "New chat" button either calls a `/chat/clear` endpoint or simply drops the ID so the next request starts a fresh session.

**Persistence:** an in-memory dict is fine for prototypes, but every restart wipes every conversation. For anything real, store messages per session in SQLite, Postgres, Redis, or a JSON file, keyed by session ID, and load them on each request.

## The history window

You can't send unlimited history, because it competes with retrieved context and the answer for the same context window. The simplest control is a message count, `MAX_HISTORY_MESSAGES`.

| Window | Effect |
|---|---|
| Small (4 to 6 messages) | More room for RAG context; forgets earlier topics quickly |
| Medium (8 to 10) | Good default for Q&A-style chat |
| Large (20+) | Long coherent sessions; risks overflowing small-context models |

A message-count window has a flaw: one giant pasted message can use up the whole budget. A **token-based window** is more robust. Walk backwards through the history, summing token counts, and stop at a budget:

```python
def token_window(history, tok, budget=1500):
    kept, used = [], 0
    for msg in reversed(history):
        n = len(tok.encode(msg["content"]))
        if used + n > budget:
            break
        kept.append(msg)
        used += n
    return list(reversed(kept))
```

## Two prompt layouts

How you *deliver* history depends on the model interface.

### Messages API (OpenAI, Claude, most hosted models)

Send real multi-turn messages and put the RAG context in the final user turn:

```python
messages = [{"role": "system", "content": "Answer from the provided context. Be concise."}]
messages += window                                   # prior user/assistant turns, verbatim
messages.append({"role": "user",
                 "content": f"Context:\n{context}\n\nQuestion: {question}"})
```

The model sees the conversation as a conversation, which is the format it was trained on.

### Single prompt (simple local generation)

With a small local model I sometimes flattened everything into one user message:

```
Previous conversation:
User: What's the torque of the 2.0L engine?
Assistant: 320 Nm.

Use the following context to answer the question.
Context: ...
Question: And the 1.5L?
Answer:
```

This works, but it's better to pass history as proper `user`/`assistant` messages through `tokenizer.apply_chat_template`, so the model gets its native turn markers. Flattened history is more likely to make the model continue writing "User:" lines itself.

## Memory and retrieval interact

A subtle RAG problem: **the retriever sees only the latest message.** "And the 1.5L?" embeds into a vector that matches nothing useful. Options:

1. **Query rewriting.** Ask the LLM to rewrite the follow-up into a standalone question ("What's the torque of the 1.5L engine?") before embedding it. This costs one extra call and gives the biggest quality gain.
2. **Concatenate recent turns** into the retrieval query. It's cheap but noisier.
3. **Route follow-ups differently.** In an analytics assistant I worked on, follow-ups ("what about last month?", "compare that to...") went to a node that could use conversation history, while fresh questions went to fixed report templates.

## Strategies for long conversations

- **Sliding window** (above): simple and predictable.
- **Summarize old turns**: periodically compress older messages into a "summary of earlier conversation" message and keep the last few turns verbatim. It costs an extra LLM call but preserves long-range facts.
- **Persistent facts**: a separate, small store of durable user facts (preferences, names) injected into the system prompt. This is different from conversation history, and you should be explicit about what gets stored.
- **Scope sessions**: tie a session to a task (a report, a document) so memory doesn't bleed across unrelated topics.

## Testing memory

Memory bugs only show up across turns, so single-question tests miss them. In my evaluation bench I added a **chatbot-with-history** mode: one persistent session, scripted opening questions, then LLM-generated follow-ups that deliberately rely on earlier context ("break that down by location"). The full conversation history is sent with every turn. Then each turn is scored like a normal answer. Drift, forgotten constraints, and pronoun failures show up as score drops on later turns.

## Key takeaways

- Models are stateless. Memory is your application re-sending prior turns.
- Keep a server-side session store keyed by `session_id`, and persist it if conversations must survive restarts.
- Bound history by tokens, not just message count, so it doesn't crowd out retrieved context.
- Use real multi-turn messages and the model's chat template rather than flattened transcripts.
- Retrieval sees only the current message unless you rewrite follow-ups into standalone questions.
- Test memory with multi-turn scripts. Single-turn evals can't catch it.
