import os
import chromadb
from chromadb import PersistentClient


from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import markdown
from bs4 import BeautifulSoup

CONTENT_DIR = "../frontend/public/content"
CHROMA_DIR = "chroma_db"
COLLECTION_NAME = "site_docs"
client = PersistentClient(path=CHROMA_DIR)

#client = chromadb.Client(Settings(chroma_db_impl="duckdb+parquet", persist_directory=CHROMA_DIR))
model = SentenceTransformer("all-MiniLM-L6-v2")

def extract_text_from_md(md_path):
    with open(md_path, 'r', encoding='utf-8') as f:
        html = markdown.markdown(f.read())
        text = BeautifulSoup(html, "html.parser").get_text()
        return text.strip()

def embed_site_content():
    if COLLECTION_NAME in [c.name for c in client.list_collections()]:
        client.delete_collection(COLLECTION_NAME)
    collection = client.create_collection(COLLECTION_NAME)

    for root, _, files in os.walk(CONTENT_DIR):
        for file in files:
            if file.endswith(".md"):
                path = os.path.join(root, file)
                text = extract_text_from_md(path)
                chunks = [text[i:i+500] for i in range(0, len(text), 500)]
                embeddings = model.encode(chunks).tolist()
                collection.add(documents=chunks, embeddings=embeddings, ids=[f"{os.path.relpath(path, CONTENT_DIR)}_{i}" for i in range(len(chunks))]
)

    #client.persist()
    print("✅ Vector DB built.")

if __name__ == "__main__":
    embed_site_content()
