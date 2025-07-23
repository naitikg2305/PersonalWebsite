# 🏢 Zillion Technologies — Software Engineering Intern  
**Summer 2024 | Hybrid**  
**Project: Intelligent File Search & Vector Database Integration**

When I joined Zillion Technologies as an intern, most interns were assigned exploratory or future-looking projects. But thanks to my full-stack experience, I was entrusted with a live, client-facing deliverable — a system that transformed SharePoint file repositories into an intelligent, searchable vector database.

---

## 🔧 What I Built

- **Optimized SharePoint API Integration**  
  Took over an existing SharePoint API implementation and significantly improved its performance and structure. Enhanced its ability to securely authenticate (secret ID, secret key, user token), recursively navigate file systems, and handle large volumes of mixed-format files more efficiently.

- **Vector Embedding for Semantic Search**  
  Designed a pipeline to process document content (with OCR for image-based PDFs) and embed it into a vector database. Used the `all-MiniLM-L6-v2` transformer from Hugging Face to generate embeddings for semantic search.

- **Chatbot Interface**  
  Integrated a chatbot powered by OpenAI’s ChatGPT that allowed users to query the system conversationally. Results included not just content matches, but also exact file locations and metadata for precise navigation.

- **Delta Updating**  
  Implemented a delta-update mechanism to selectively re-index only modified files or folders. This significantly reduced processing time and improved system scalability.

---

## ⚙️ Technologies Used

- **Languages & Frameworks**: Python (FastAPI)  
- **APIs**: Optimized SharePoint API  
- **LLMs**: OpenAI ChatGPT  
- **Embeddings**: Hugging Face `all-MiniLM-L6-v2`  
- **Vector Database**: ChromaDB  
- **OCR**: Tesseract  
- **Other**: File system crawling, chatbot integration, metadata parsing

---

## 💡 Why It Mattered

This wasn’t a sandbox or experimental task — it was a **production-grade, client-facing system**. It gave me hands-on experience in:

- Improving and optimizing real-world API integrations  
- Scalable document ingestion and vectorization  
- NLP-powered semantic search  
- Efficient updating with delta indexing  
- User-focused AI applications for real-world environments

> **Outcome:** Delivered a working prototype that enabled real-time, context-aware document retrieval from complex SharePoint file systems — all within a few weeks.

---

## 📚 What I Learned

- Practical implementation of **Large Language Models (LLMs)** in enterprise applications  
- **Retrieval-Augmented Generation (RAG)** workflows for real-time semantic search  
- Use of **transformers** for embedding textual data  
- Construction and querying of **NoSQL vector databases** using ChromaDB  
- Techniques for **delta updating** in vector databases to maintain efficiency and scalability  
- Integration of **OCR** pipelines for multi-format document ingestion  
- End-to-end system design for AI-powered document search

---
