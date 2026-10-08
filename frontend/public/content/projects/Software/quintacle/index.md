---
title: "The Quintacle: Local-First Personal AI OS"
category: "software"
order: 1
date: "2026-09-29"
tags: ["Python", "FastAPI", "Next.js", "TypeScript", "LLM Structured Outputs", "SQLite", "Claude API"]
summary: "A local-first personal operating system / second brain: a deterministic Python core over markdown files, with LLMs used only at the edges, to parse messy input on the way in and narrate facts on the way out."
github: https://github.com/naitikg2305/quintacle
---

# The Quintacle

## What it is

The Quintacle is my personal "Jarvis": a deterministic agent, not a chatbot. I learn constantly and in scattered places (AI chats, videos, between gym sets), and most of it used to disappear. The Quintacle closes that loop: **learn → summarise → drop it in → it lands in a clean, organised personal database** without breaking my flow.

The core idea is **structure replaces search**. Data lives in a known folder and schema layout. Markdown files with YAML frontmatter are the source of truth, and SQLite is a disposable index. Deterministic Python fetches exact facts. An LLM is used at only two points: parsing messy input into a validated schema on the way in, and narrating facts on the way out. I review every AI proposal before anything is written.

The first version (2024–2025) was a voice-driven assistant idea. In September 2026 I rebuilt it from scratch, with Claude Code as my pair-programmer.

## What I built

### Python core (FastAPI)
- `create_app()` wires **12 domain node packages**: schedule, logs, journal, knowledge base, wardrobe, grooming, documents, home, travel, people, finance and profile. Each one has its own `store.py` / `llm.py` / `api.py`.
- **101 REST routes**, about 7.7k lines of Python across 63 files.
- **Storage:** one frontmatter `.md` file per item (todos, KB notes, outfits, documents, people, meal presets, workout routines, every daily log entry). Dense tabular logs go into a SQLite index with 12 tables, WAL mode and idempotent migrations. `rebuild_sqlite_index()` regenerates everything from markdown. It upserts by name so integer foreign keys survive a rebuild, and there's a test for that.

### "Drop": multimodal ingestion
One endpoint (`POST /drop`) takes whatever I throw at it:
1. **Deterministic routing first, no AI.** 40 keyword prefixes map to 23 entry types (`food:`, `todo:`, `card:`, `stock:`, `visit:`, `friend:` …).
2. An unprefixed photo gets **one cheap vision call** that classifies it into 7 kinds (nutrition label, prepared meal, receipt, clothing item, full outfit, document, generic).
3. **Per-type structured extraction** with Claude structured outputs and Pydantic schemas.
4. **`difflib` canonicalisation** against existing names, so "Pull Ups" and "pull-ups" don't fork into two exercises.
5. Real camera photos are filed automatically into `Media/Photos/<Year>/<Month>/<Trip or Place>` using EXIF date and GPS, and linked to that day's journal.
6. **It never writes on its own.** The frontend shows an editable review card (23 entry types) and only commits after I approve.

It handles images, PDFs, DOCX (text plus embedded images), video (OpenCV samples frames and captions them) and STL/OBJ/3MF files.

### Frontend
- Next.js 16, React 19, TypeScript 5, Tailwind 4: **21 pages**, 18 components, about 9.5k lines of TS/TSX, and a fully typed API client.
- A dark HUD design system with sidebar and phone tab bar, built to work on my phone.
- **Knowledge graph** computed in code (no LLM): edges come from frontmatter links, EXIF dates → journal days, meal → ingredient, routine → exercise and outfit → item. It's rendered with d3-force.
- **"Folder = page" browser**: each folder infers a gallery, table, card or list layout from its data, and any `*expir*` date field gets automatic "expired / expires soon" badges.

### Other pieces
- **Chat** with a picker of 3 Claude and 3 GPT models, per-token prices shown in the UI, server-side web search on both providers, prompt caching on the knowledge-base block, and whole-KB or folder-scoped grounding. Sessions are saved as markdown.
- **Nutrition** tracking against sex- and age-specific RDAs for 20 micronutrients, with meals composed by deterministic arithmetic from ingredient presets.
- **Habits and goals** with pure deterministic progress math, a calendar/day view that pulls everything for a date, a document vault that creates a renewal todo when something is about to expire, and an STL viewer ported from this website.

## Notable details and lessons
- **Structure over RAG.** Retrieval accuracy depends on a folder structure I control. That shrinks the LLM's job to parsing and narration, so a small, cheap model is enough. Grounding is full-text injection; there's no vector database.
- **Deterministic first, AI as fallback.** Regex gates run before any paid call, `difflib` acts as a post-LLM safety net, and nothing is written without approval.
- **Structured outputs have limits.** The journal parser hit Anthropic's "compiled grammar is too large" error, so I split it into a main call plus a small date-resolution pass.
- **LLM unit bugs are real.** A model returned copper in mg instead of mcg (0.2% vs ~80% of RDA), so I added a unit-canonicalisation layer.
- **Cost drives architecture.** Routine work goes to Haiku and research to Sonnet, with prompt caching. The API bill is what started my local-inference work (see the Offline LLM Agent project).

## Status
- 138 pytest tests across 26 files; 136 pass (the 2 failures are stale keyword-argument tests). No frontend tests or CI yet.
- Runs on localhost only, with no telemetry and keys gitignored. It has no auth yet, so it isn't exposed remotely.
- I've written design docs for an MCP server, Android packaging and self-hosting, but haven't built them yet.

**Stack:** Python, FastAPI, Pydantic, SQLite, python-frontmatter, Pillow, OpenCV, python-docx, openpyxl, pytest · Anthropic SDK (structured outputs, vision, PDF input, web search, prompt caching), OpenAI SDK · Next.js 16, React 19, TypeScript, Tailwind 4, d3-force, three.js
