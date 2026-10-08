"""Site chatbot core: retrieve from the committed Chroma DB, answer with Claude Haiku on Bedrock.

Shared by the Lambda handler (lambda_function.py) and the local dev server (local_server.py).
Credentials come from the standard AWS chain: the Lambda execution role in AWS, or the
profile named in CHATBOT_AWS_PROFILE locally. No API keys.
"""

import os
import pathlib
import re
import shutil
import time

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


DAILY_CAP_TABLE = os.environ.get("DAILY_CAP_TABLE")  # unset locally → no cap
DAILY_CAP = int(os.environ.get("DAILY_CAP", "300"))
BUSY_MESSAGE = (
    "The chatbot has hit its daily limit. Please try again tomorrow, "
    "or reach Naitik directly at naitikg2305@gmail.com."
)


def _under_daily_cap() -> tuple[bool, int | None]:
    """Atomically count today's chats; refuse once the cap is reached (hard ceiling on Bedrock spend).
    Returns (allowed, chats counted today) — count is None when no table is configured (local dev)."""
    if not DAILY_CAP_TABLE:
        return True, None
    import time

    import boto3
    from botocore.exceptions import ClientError

    day = time.strftime("%Y-%m-%d", time.gmtime())
    try:
        result = boto3.client("dynamodb", region_name=REGION).update_item(
            TableName=DAILY_CAP_TABLE,
            Key={"day": {"S": day}},
            UpdateExpression="ADD #n :one SET expires_at = :exp",
            ConditionExpression="attribute_not_exists(#n) OR #n < :cap",
            ExpressionAttributeNames={"#n": "count"},
            ExpressionAttributeValues={
                ":one": {"N": "1"},
                ":cap": {"N": str(DAILY_CAP)},
                ":exp": {"N": str(int(time.time()) + 7 * 86400)},  # TTL cleans old days
            },
            ReturnValues="UPDATED_NEW",
        )
        return True, int(result["Attributes"]["count"]["N"])
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False, DAILY_CAP
        raise


_cold_start = True  # first invocation in this Lambda container


def answer_with_sources(question: str) -> dict:
    """Answer + the site pages it used + a real trace for the site's live terminal:
    {"response": str, "sources": [{"title", "source"}], "trace": {...timings, chunks, tokens...}}."""
    global _cold_start
    t0 = time.perf_counter()
    trace: dict = {"cold_start": _cold_start, "model": MODEL_ID}
    _cold_start = False

    question = (question or "").strip()
    if not question:
        return {"response": "Please ask a question.", "sources": [], "trace": trace}
    question = question[:MAX_QUERY_CHARS]

    allowed, count = _under_daily_cap()
    trace.update(daily_count=count, daily_cap=DAILY_CAP if DAILY_CAP_TABLE else None)
    if not allowed:
        trace["capped"] = True
        return {"response": BUSY_MESSAGE, "sources": [], "trace": trace}

    t = time.perf_counter()
    chunks = retrieve(question)
    trace.update(retrieve_ms=round((time.perf_counter() - t) * 1000), chunks=len(chunks), keywords=_keywords(question)[:3])
    context = "\n\n".join(
        f'<excerpt source="{c["source"]}" title="{c["title"]}">\n{c["text"]}\n</excerpt>'
        for c in chunks
    )

    # Haiku 5.5 thinks by default; low effort keeps chat answers fast and cheap.
    # Older models (Haiku 4.5) don't accept output_config.effort, so only send it to 5.x.
    extra = {"output_config": {"effort": "low"}} if re.search(r"claude-[a-z]+-5-", MODEL_ID) else {}
    t = time.perf_counter()
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
    trace.update(
        bedrock_ms=round((time.perf_counter() - t) * 1000),
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        stop_reason=response.stop_reason,
    )

    sources, seen = [], set()
    for c in chunks:  # unique pages, in retrieval order
        if c["source"] not in seen:
            seen.add(c["source"])
            sources.append({"title": c["title"], "source": c["source"]})
    trace["total_ms"] = round((time.perf_counter() - t0) * 1000)

    if response.stop_reason == "refusal":
        return {"response": "Sorry, I can't help with that one.", "sources": [], "trace": trace}
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    return {"response": text, "sources": sources[:4], "trace": trace}


def answer(question: str) -> str:
    return answer_with_sources(question)["response"]
