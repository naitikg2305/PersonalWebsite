"""Site chatbot core: retrieve from the committed Chroma DB, answer with Claude Haiku on Bedrock.

Shared by the Lambda handler (lambda_function.py) and the local dev server (local_server.py).
Credentials come from the standard AWS chain: the Lambda execution role in AWS, or the
profile named in CHATBOT_AWS_PROFILE locally. No API keys.
"""

import os
import pathlib
import re
import shutil

import chromadb
from anthropic import AnthropicBedrock
from chromadb.utils.embedding_functions import ONNXMiniLM_L6_V2

HERE = pathlib.Path(__file__).parent
DB_DIR = HERE / "chroma_db"
COLLECTION = "site_docs"

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-haiku-5-5")
REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
TOP_K = int(os.environ.get("TOP_K", "6"))
MAX_QUERY_CHARS = 1000

SYSTEM_PROMPT = """You are the assistant on Naitik Gupta's personal website (naitikg.us). \
Visitors ask about Naitik's work experience, projects, skills, education, interests, and the \
engineering knowledge notes he has published on the site.

Answer using only the context excerpts provided with each question. If the context doesn't \
contain the answer, say you don't know and suggest the visitor reach out to Naitik directly \
(naitikg2305@gmail.com or linkedin.com/in/naitikg2305). Don't invent details.

Refer to Naitik in the third person. Keep answers concise (a short paragraph or a few bullets) \
and conversational."""


def embedding_function() -> ONNXMiniLM_L6_V2:
    """Chroma's built-in all-MiniLM-L6-v2 (ONNX, no PyTorch). Must match the one used in embed.py."""
    model_dir = os.environ.get("ONNX_MODEL_DIR")
    if model_dir:  # the Lambda image bakes the model here; locally it uses ~/.cache/chroma
        ONNXMiniLM_L6_V2.DOWNLOAD_PATH = pathlib.Path(model_dir)
    return ONNXMiniLM_L6_V2()


def _db_path() -> pathlib.Path:
    # Chroma's SQLite needs a writable directory; the Lambda code dir is read-only, so copy to /tmp.
    if os.access(DB_DIR, os.W_OK):
        return DB_DIR
    tmp = pathlib.Path("/tmp/chroma_db")
    if not tmp.exists():
        shutil.copytree(DB_DIR, tmp)
    return tmp


_collection = None
_client = None


def _get_collection():
    global _collection
    if _collection is None:
        db = chromadb.PersistentClient(
            path=str(_db_path()),
            settings=chromadb.Settings(anonymized_telemetry=False),
        )
        _collection = db.get_collection(COLLECTION, embedding_function=embedding_function())
    return _collection


def _get_client() -> AnthropicBedrock:
    global _client
    if _client is None:
        _client = AnthropicBedrock(
            aws_region=REGION,
            aws_profile=os.environ.get("CHATBOT_AWS_PROFILE"),  # None in Lambda → execution role
        )
    return _client


STOPWORDS = {"what", "who", "where", "when", "which", "how", "does", "did", "naitik", "gupta", "tell", "about"}


def _keywords(question: str) -> list[str]:
    """Capitalized names in the question (Minfy, Grubhub, NaviGatr...). Small embedders blur rare names."""
    words = re.findall(r"\b[A-Z][A-Za-z0-9+.-]{2,}\b", question)
    return [w for w in dict.fromkeys(words) if w.lower() not in STOPWORDS]


def retrieve(question: str, k: int = TOP_K) -> list[dict]:
    collection = _get_collection()
    results: dict[str, dict] = {}

    # 1) keyword pass: chunks that literally contain a name from the question
    for word in _keywords(question)[:3]:
        hits = collection.query(query_texts=[question], n_results=3, where_document={"$contains": word})
        for cid, doc, meta in zip(hits["ids"][0], hits["documents"][0], hits["metadatas"][0]):
            results.setdefault(cid, {"text": doc, "source": meta.get("source", ""), "title": meta.get("title", "")})

    # 2) semantic pass fills the rest
    hits = collection.query(query_texts=[question], n_results=k)
    for cid, doc, meta in zip(hits["ids"][0], hits["documents"][0], hits["metadatas"][0]):
        if len(results) >= k:
            break
        results.setdefault(cid, {"text": doc, "source": meta.get("source", ""), "title": meta.get("title", "")})

    return list(results.values())[:k]


def answer(question: str) -> str:
    question = (question or "").strip()
    if not question:
        return "Please ask a question."
    question = question[:MAX_QUERY_CHARS]

    chunks = retrieve(question)
    context = "\n\n".join(
        f'<excerpt source="{c["source"]}" title="{c["title"]}">\n{c["text"]}\n</excerpt>'
        for c in chunks
    )

    # Haiku 5.5 thinks by default; low effort keeps chat answers fast and cheap.
    # Older models (Haiku 4.5) don't accept output_config.effort, so only send it to 5.x.
    extra = {"output_config": {"effort": "low"}} if re.search(r"claude-[a-z]+-5-", MODEL_ID) else {}
    response = _get_client().messages.create(
        model=MODEL_ID,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"<context>\n{context}\n</context>\n\nVisitor's question: {question}",
            }
        ],
        **extra,
    )
    if response.stop_reason == "refusal":
        return "Sorry, I can't help with that one."
    return "".join(block.text for block in response.content if block.type == "text").strip()
