---
title: "Offline LLM Agent (Local-chat)"
category: "software"
order: 2
date: "2026-09-03"
tags: ["Local LLMs", "Ollama", "Qwen3", "Tool Calling", "FastAPI", "Python", "CUDA"]
summary: "A fully local chat agent running Qwen3 through Ollama on my laptop GPU, with persistent memory, plain-JSON conversations, and an opt-in, bounded web-research tool loop that answers with citations."
github: https://github.com/naitikg2305/Local-chat
---

# Offline LLM Agent (Local-chat)

## What it is

Local-chat is a small, fully local chat app over **Ollama**, running on my laptop's NVIDIA RTX 5070 Ti (12 GB VRAM). With web search off, the whole path stays on my machine:

```text
Browser → FastAPI server → local Ollama → Qwen3 → laptop GPU
```

I built it because cloud API costs on my other projects (see The Quintacle) were adding up, and I wanted to understand local inference in practice: what fits in VRAM, how fast it runs, and where a local model needs help.

## What I built

- **FastAPI backend** (one Python file plus `httpx`): conversation CRUD, an SSE streaming proxy to Ollama, memory, and settings.
- **Plain-file storage.** Each conversation is one JSON file, so I can grep, edit or delete it. Writes go to a temp file and are then renamed, so a crash mid-write can't truncate a chat. Partial responses are kept if I hit stop or generation fails.
- **Persistent memory.** A list of facts in `memory.json` is injected into every system prompt. Hovering one of my messages and clicking "→ memory" saves it as a fact.
- **Vanilla JS frontend** with no build step and no CDN, so it works with the network off. It has a dark theme, its own small markdown renderer, a collapsible **reasoning** panel for Qwen3's thinking stream, and token count and tok/s after each response.
- **Models:** `qwen3:14b` by default, with `qwen3:8b` and `qwen3:4b` as lighter options. The model dropdown is filled from `ollama list` at runtime. Model weights live in one shared store that my other repos reuse, so nothing is downloaded twice.

## Bounded web-research tool loop

A local model only knows its training data and will make up plausible "current" facts. So web research is an explicit **per-message checkbox, off by default**. When it's on, Qwen runs a **bounded agent loop** through Ollama's tool-calling protocol:

```text
Question
  → Qwen calls search_web  → app runs the search, returns numbered snippets
  → Qwen calls read_web_page on useful sources (and may refine the query)
  → app returns bounded page extracts, marked as untrusted evidence
  → Qwen answers with [1], [2] citations; the app appends a Web sources list
```

Qwen isn't a browser. Search, HTTP fetching, HTML parsing and citations are tools that my app provides. Key design choices:
- **Hard limits:** 4 planning rounds, 8 tool calls and 3 successfully extracted pages per answer.
- **No silent fallback.** If nothing usable is retrieved, the app says research failed and shows retry and paste-a-URL options. It doesn't let the model improvise and present that as web-grounded.
- **Failover across search backends** (DuckDuckGo HTML, DuckDuckGo Lite, Brave), with optional Brave Search API support through an environment variable. URLs I paste into the question are fetched first.
- **Prompt-injection hygiene.** Retrieved text is marked untrusted, and the model is told to ignore instructions inside it and not to claim it read a full page when it only got a snippet.
- **Context budgeting** for the 8K window: the system prompt and fresh evidence are kept ahead of old assistant turns, so stale claims don't crowd out current sources.

## Reusing the models in coding-agent harnesses

The same local Ollama/Qwen models also serve as the model backend inside the **Claude Code** and **Codex** coding-agent harnesses. That way routine coding-agent work runs on my laptop GPU (RTX 5070 Ti, 12 GB) instead of going through paid API calls, which keeps my API costs down.

## What I learned
- **Download size isn't VRAM usage.** The KV cache and runtime buffers add up, so I check real placement with `ollama ps` and `nvidia-smi`.
- **Reasoning models need care.** Turning Qwen3's thinking off with `think: false` made it dump its reasoning into the answer instead, so I show it in a separate panel. Even "say hi" uses about 230 tokens, mostly reasoning. That's a few seconds on GPU and closer to a minute on CPU.
- **Search results aren't memory.** They're temporary context for one request and don't change the model. Stable facts go into Memory on purpose; volatile web results shouldn't.
- Getting reliable tool use from a 14B local model mostly came down to the app doing the strict work (limits, parsing, citations, failure handling) rather than trusting the model to do it.

The server binds to localhost only and has no auth. It's a personal tool, not meant to be exposed.

**Stack:** Python, FastAPI, httpx, Uvicorn · Ollama (tool calling, streaming) · Qwen3 14B/8B/4B · vanilla HTML/CSS/JS · Arch Linux, CUDA, RTX 5070 Ti Laptop GPU
