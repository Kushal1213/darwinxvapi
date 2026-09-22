from dotenv import load_dotenv
import os, google.generativeai as genai

load_dotenv(".env")
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

r = genai.embed_content(
    model="models/gemini-embedding-001",
    content="What is a life insurance premium?",
    task_type="retrieval_query",
)
print(f"KEY VALID — model: gemini-embedding-001 — dim: {len(r['embedding'])}")
print("Ready for ingestion!")
