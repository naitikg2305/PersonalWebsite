import os
from dotenv import load_dotenv
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from chromadb import PersistentClient
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or specify: ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


load_dotenv()

client = OpenAI()
#app = FastAPI()

model = SentenceTransformer("all-MiniLM-L6-v2")

# ✅ FIX: Define chroma_client before using it
CHROMA_DIR = "./chroma_db"
chroma_client = PersistentClient(path=CHROMA_DIR)
collection = chroma_client.get_or_create_collection("site_docs")


@app.post("/chat")
def chat(query: dict = Body(...)):
    try:
        user_q = query.get("query", "")
        if not user_q:
            return {"response": "Please ask a question."}

        embedding = model.encode([user_q])[0].tolist()
        results = collection.query(query_embeddings=[embedding], n_results=4)
        context = "\n\n".join(results["documents"][0])

        prompt = f"""
        You are an assistant that answers questions about Naitik Gupta.
        Use the context below to answer the question.

        Context:
        {context}

        Question:
        {user_q}

        Answer:
        """

        response = client.chat.completions.create(
            model="gpt-4.1",  # or "gpt-3.5-turbo" if GPT-4 isn't working
            messages=[{"role": "user", "content": prompt}]
        )

        return {"response": response.choices[0].message.content.strip()}

    except Exception as e:
        print("❌ Error:", e)
        return {"response": f"Error occurred: {e}"}
