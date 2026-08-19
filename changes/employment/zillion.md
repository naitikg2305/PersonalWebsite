---
title: "Software Engineer"
order: 2
company: "Zillion Technologies"
dates: "2024 – Jan 2026"
location: "Hybrid"
slug: "zillion"
summaryPoints:
  - Summer 2024 & 2025 Intern → Full-time role. Vector search, RAG, chatbot integration.
positions:
  - role: "Software Engineering Intern"
    dates: "Summer 2024"
    bullets:
      - main: "Built an intelligent file search system that turned SharePoint into a searchable knowledge base."
        sub:
          - "Improved the SharePoint API so we could securely crawl and index large volumes of files."
          - "Added semantic search using embeddings and a chatbot so users could ask questions in plain language and get answers with file locations."
      - main: "Kept the system efficient with delta updates — only re-indexing what changed instead of everything."
        sub: []
  - role: "Software AI Engineer Intern"
    dates: "Summer 2025"
    bullets:
      - main: "Built the Admin Panel for Zecured: onboarding and offboarding users from IAM systems using credentials."
        sub:
          - "Governance flow that groups similar roles (by entitlements and descriptions) so companies can clean up role sprawl."
          - "Two-step approval: both PO and Manager must approve for a green light; any rejection turns it red."
      - main: "AI suggests access levels from role descriptions; you pick which roles to merge into one or split into new buckets."
        sub: []
  - role: "AI Engineer"
    dates: "2025 – Jan 2026"
    bullets:
      - main: "Built a voice AI for Sysco so callers could ask about orders in natural language (e.g. “my last order” or “order with a burger”)."
        sub:
          - "Connected the agent to Salesforce and Talkdesk; set up flows and learned Vertex AI and Google Cloud."
      - main: "Ran a small LLM locally on my GPU to generate entitlement descriptions in Zecured — no cloud API calls, so better privacy and lower cost."
        sub: []
---

# 🏢 Zillion Technologies

**2024 – Jan 2026 | Hybrid**

---

## Software Engineering Intern — Summer 2024

**Project: Intelligent File Search & Vector Database Integration**

When I joined Zillion Technologies as an intern, most interns were assigned exploratory or future-looking projects. Thanks to my full-stack experience, I was entrusted with a live, client-facing deliverable — a system that transformed SharePoint file repositories into an intelligent, searchable vector database.

- **Optimized SharePoint API Integration**
  - Took over existing implementation and significantly improved performance and structure
  - Enhanced secure auth (secret ID, secret key, user token), recursive file navigation, large-volume handling
- **Vector Embedding for Semantic Search**
  - Designed pipeline for document content (OCR for image-based PDFs) to vector database
  - Used `all-MiniLM-L6-v2` transformer for embeddings
- **Chatbot Interface**
  - Integrated OpenAI ChatGPT for conversational queries
  - Results included content matches, file locations, and metadata for precise navigation
- **Delta Updating**
  - Implemented selective re-indexing of only modified files/folders
  - Reduced processing time and improved scalability

---

## Software AI Engineer Intern — Summer 2025

**Project: Zecured — Admin Panel**

Worked on an entirely new feature for Zecured: the Admin Panel. The panel consisted of three main flows.

- **Onboarding & Offboarding**
  - Given credentials, onboard and offboard users from IAM systems
  - Streamlined access management for enterprise environments

- **Governance — Role Clustering**
  - For companies with hundreds or thousands of roles (each with entitlements, role names, job descriptions), the system matches and buckets similar roles based on entitlements (highest), descriptions, and other attributes
  - **Regex matching** for entitlements and descriptions to form and compare buckets
  - Users can approve a bucket, reject it, assign a new role name, or update descriptions
  - Reduced role sprawl and simplified access governance

- **AI-Suggested Access Level**
  - AI runs through each role’s description and **suggests an access level** — which can differ from the role’s current access level
  - From a bucket of many options (e.g., 10), you choose a subset (e.g., 3): for each you pick either the **suggested** access level or keep the **original** (as long as they match where needed)
  - On confirm: one **merged role** is created (one new role bucket); the remaining roles form **new buckets**
  - Lets you consolidate roles with consistent, AI-informed access levels while keeping flexibility

- **Approval Flow**
  - Two-step approval: PO approval + Manager approval
  - Both approvals = green light; any rejection = red light
  - Clear visibility into approval status across the workflow

#### What I learned (Zecured / IAM)

- **IAM in the enterprise** — How companies structure identity and access: onboarding/offboarding, entitlements, role hierarchies, and how governance panels sit on top of existing IAM systems
- **Regex for entitlements and descriptions** — Matching and bucketing roles using patterns on entitlement strings and job descriptions so similar roles cluster correctly for merge or review

---

## AI Engineer

### Project 1: Agentic AI Voice Agent — Sysco

Built an agentic AI system implemented in **LangGraph** and **Google ADK** (experimented with both). The project was under **Sysco** (the food company), with order and product data in **Salesforce** and authentication by phone number.

- **Connected Salesforce to the agent** — Pulled orders, people, contacts, and items so the voice agent could answer questions about real customer data. The agent queried Salesforce in real time to respond to natural language requests.

The system was a voice-enabled answering machine: users could call in and check on their orders using natural language. Examples: *"Tell me about my last order"*, *"What was the order we just talked about?"*, *"My order with a burger"*. Connected to **Talkdesk** via websockets for real-time voice.

#### What I learned (Agentic AI)

- **Google’s agent convention** — A **top-level agent** orchestrates a **sequential agent** and **tools**; tools can invoke **further agents**, almost like nodes in a graph. This funneling gives the LLM **deterministic paths** and **hard data** (e.g., from Salesforce) instead of free-form generation, which **reduces hallucinations** and keeps answers grounded.
- **LangGraph / Google ADK** — Structuring multi-step, tool-calling flows so the model follows a controlled path rather than “making it up.”
- **Operational** — Google Cloud Console, enabling APIs, **Vertex AI** for deployment; **Talkdesk** (flows, call routing, IVR, webhooks); **Salesforce** (orders, people, contacts, items, API).

---

### Project 2: Local LLM on RTX 3060 — Phi-3 Mini

Ran **Phi-3 Mini** locally on an RTX 3060. Quantized in **8-bit** and **4-bit** to fit in 3GB and 5.6GB VRAM respectively, and configured all libraries (CUDA, transformers, bitsandbytes, etc.) to use the GPU.

Implemented this in parallel in **Zecured** to generate entitlement descriptions. A parallel tab compared the local LLM output to GPT — performance was competitive. Benefits: **no API calls to OpenAI**, ensuring data privacy and reducing costs.

#### What I learned (Local LLMs)

- **Temperature & sampling** — **Temperature** controls randomness; **do_sample** (or equivalent) makes the model more **creative** vs deterministic. Tuning these changes how “strict” or varied the outputs are.
- **4-bit vs 8-bit quantization** — Ran **4-bit** (e.g., ~3GB VRAM) and **8-bit** (e.g., ~5.6GB VRAM) on my own hardware (RTX 3060) to **speed up inference** and fit larger contexts; traded a bit of quality for latency and memory.
- **Stack** — Local LLM deployment, CUDA/GPU setup, Hugging Face transformers, bitsandbytes; getting Phi-3 Mini running and integrated into Zecured.

---

## 🔧 Technologies Used

**Summer 2024 — SharePoint Vector Search:**
- **Languages & Frameworks**: Python (FastAPI)
- **APIs**: Optimized SharePoint API
- **LLMs**: OpenAI ChatGPT
- **Embeddings**: Hugging Face `all-MiniLM-L6-v2`
- **Vector Database**: ChromaDB
- **OCR**: Tesseract
- **Other**: File system crawling, chatbot integration, metadata parsing

**Summer 2025 — Zecured Admin Panel:**
- IAM onboarding/offboarding, role governance, approval workflows
- Regex matching for entitlements/descriptions; AI-suggested access level, merge/new buckets

**AI Engineer (2025 – Jan 2026):**
- **Agentic AI**: LangGraph, Google ADK, Vertex AI, Google Cloud Console
- **Voice**: Talkdesk (websockets, flows, call routing, IVR), Salesforce (orders, contacts, items, API)
- **Local LLM**: Phi-3 Mini, 4-bit/8-bit quantization, RTX 3060 / CUDA
- **Stack**: Hugging Face transformers, bitsandbytes, GPU-optimized inference
- **Zecured**: Entitlement description generation, parallel local vs. cloud LLM comparison

---

## 💡 Why It Mattered

This wasn’t a sandbox — it was a **production-grade, client-facing system**. Hands-on experience in:

- Improving real-world API integrations
- Scalable document ingestion and vectorization
- NLP-powered semantic search
- Delta indexing for efficiency
- User-focused AI applications for enterprise

> **Outcome:** Delivered a working prototype enabling real-time, context-aware document retrieval from complex SharePoint file systems.

---
