"""Build the chatbot's Chroma DB from the site's markdown content. Run locally, then commit chroma_db/.

    .venv/bin/python embed.py

Uses Chroma's built-in ONNX all-MiniLM-L6-v2, the same embedder the Lambda uses at query time.
No AWS calls: embedding runs on this machine.
"""

import pathlib
import re
import shutil

import chromadb

from chatbot import COLLECTION, DB_DIR, embedding_function

CONTENT_DIR = pathlib.Path(__file__).parent.parent / "frontend" / "public" / "content"
CHUNK_CHARS = 1200
OVERLAP_CHARS = 200

FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


def parse(md: str) -> tuple[str, str]:
    """Return (title, body) with YAML frontmatter stripped."""
    title = ""
    m = FRONTMATTER.match(md)
    if m:
        fields = dict(re.findall(r'^(title|company):\s*"?(.*?)"?\s*$', m.group(1), re.MULTILINE))
        title = fields.get("title", "")
        if fields.get("company") and fields["company"] not in title:
            title = f"{fields['company']}: {title}"  # e.g. "Minfy Technologies: AI Engineer"
        md = md[m.end():]
    return title, md.strip()


def chunk(text: str) -> list[str]:
    """Paragraph-aware chunks of ~CHUNK_CHARS, with overlap so answers spanning a boundary survive."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks, current = [], ""
    for p in paragraphs:
        if current and len(current) + len(p) > CHUNK_CHARS:
            chunks.append(current)
            current = current[-OVERLAP_CHARS:] + "\n\n" + p
        else:
            current = f"{current}\n\n{p}" if current else p
    if current:
        chunks.append(current)
    return chunks


def main():
    shutil.rmtree(DB_DIR, ignore_errors=True)  # rebuild from scratch: no stale chunks
    db = chromadb.PersistentClient(path=str(DB_DIR), settings=chromadb.Settings(anonymized_telemetry=False))
    collection = db.create_collection(
        COLLECTION, embedding_function=embedding_function(), metadata={"hnsw:space": "cosine"}
    )

    ids, docs, metas = [], [], []
    for path in sorted(CONTENT_DIR.rglob("*.md")):
        rel = path.relative_to(CONTENT_DIR).as_posix()
        title, body = parse(path.read_text(encoding="utf-8"))
        title = title or path.stem.replace("-", " ")
        for i, piece in enumerate(chunk(body)):
            ids.append(f"{rel}#{i}")
            docs.append(f"[{title}]\n{piece}")
            metas.append({"source": rel, "title": title})

    for start in range(0, len(ids), 256):
        collection.add(ids=ids[start:start + 256], documents=docs[start:start + 256], metadatas=metas[start:start + 256])

    files = len({m["source"] for m in metas})
    print(f"Embedded {len(ids)} chunks from {files} markdown files into {DB_DIR}")


if __name__ == "__main__":
    main()
