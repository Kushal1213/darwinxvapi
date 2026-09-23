"""
Veyra Ingestion Service
Handles: document loading → cleaning → chunking → Google embedding → FAISS indexing

Embedding: Google text-embedding-004 (768-dim, via API — no local model needed)
Run: uvicorn main:app --reload --port 8002
"""

import os
import re
import json
import time
import hashlib
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime

import numpy as np
import faiss
import google.generativeai as genai
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# import fitz          # PyMuPDF — PDF text extraction (temporarily disabled due to dependency issue)
from pypdf import PdfReader  # Alternative PDF reader
from bs4 import BeautifulSoup
import requests as req_lib

load_dotenv("../../.env")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")
EMBEDDING_MODEL    = "models/gemini-embedding-001"  # Google 768-dim, confirmed available
EMBEDDING_DIM      = 3072   # gemini-embedding-001 output dimension
BASE_DIR           = Path(__file__).resolve().parents[2]
FAISS_INDEX_PATH   = os.getenv("FAISS_INDEX_PATH", str(BASE_DIR / "knowledge-base" / "embeddings" / "faiss_index"))
CHUNK_SIZE_CHARS   = 1200    # ≈ 300 tokens (4 chars/token)
CHUNK_OVERLAP_CHARS= 200
CHUNK_MIN_CHARS    = 80
EMBED_BATCH_SIZE   = 20      # Google allows up to 100 per call; keep low to avoid rate limits

INDEX_DIR     = Path(FAISS_INDEX_PATH)
INDEX_FILE    = INDEX_DIR / "index.faiss"
METADATA_FILE = INDEX_DIR / "metadata.json"
RAW_DIR       = Path("../../knowledge-base/raw")

INDEX_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)

# ── Global State ─────────────────────────────────────────────
faiss_index: Optional[faiss.IndexFlatIP] = None
chunk_store: list[dict] = []

app = FastAPI(title="Veyra Ingestion Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Startup ────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global faiss_index, chunk_store

    if not GEMINI_API_KEY:
        logger.warning("⚠️  GEMINI_API_KEY not set — embeddings will fail")
    else:
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info(f"✅ Gemini configured — embedding model: {EMBEDDING_MODEL}")

    if INDEX_FILE.exists() and METADATA_FILE.exists():
        faiss_index = faiss.read_index(str(INDEX_FILE))
        if faiss_index.d != EMBEDDING_DIM:
            logger.warning(f"⚠️ Index dimension mismatch ({faiss_index.d} vs {EMBEDDING_DIM}), recreating fresh index")
            faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)
            chunk_store = []
        else:
            with open(METADATA_FILE) as f:
                chunk_store = json.load(f)
            logger.info(f"✅ Loaded existing FAISS index: {faiss_index.ntotal} chunks")
    else:
        faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)
        logger.info(f"✅ New FAISS index created (dim={EMBEDDING_DIM})")


# ── Pydantic Models ────────────────────────────────────────────
class IngestionStatus(BaseModel):
    status: str
    chunks_added: int
    total_chunks: int
    source: str
    duration_ms: int

class URLIngestionRequest(BaseModel):
    url: str
    category: str = "general"
    title: Optional[str] = None
    market: str = "india"


# ── Routes ────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ingestion",
        "embedding_model": EMBEDDING_MODEL,
        "total_chunks": len(chunk_store),
        "index_vectors": faiss_index.ntotal if faiss_index else 0,
        "gemini_configured": bool(GEMINI_API_KEY),
    }


@app.post("/ingest/pdf", response_model=IngestionStatus)
async def ingest_pdf(
    file: UploadFile = File(...),
    category: str = "policy",
    market: str = "india",
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files accepted")
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")

    start = time.time()
    content = await file.read()

    # Save raw file
    (RAW_DIR / file.filename).write_bytes(content)

    text = extract_pdf_text(content)
    if not text.strip():
        raise HTTPException(422, "Could not extract text from PDF")

    chunks = chunk_text(text, source=file.filename, category=category, market=market)
    added = await embed_and_index(chunks)
    save_index()

    duration_ms = int((time.time() - start) * 1000)
    logger.info(f"Ingested {file.filename}: {added} chunks in {duration_ms}ms")
    return IngestionStatus(status="success", chunks_added=added,
                           total_chunks=len(chunk_store), source=file.filename,
                           duration_ms=duration_ms)


@app.post("/ingest/url", response_model=IngestionStatus)
async def ingest_url(body: URLIngestionRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")

    start = time.time()
    try:
        resp = req_lib.get(body.url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (compatible; VeyraBot/1.0)"
        })
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch URL: {e}")

    text = extract_html_text(resp.text)
    if not text.strip():
        raise HTTPException(422, "No extractable text at URL")

    chunks = chunk_text(text, source=body.url, category=body.category,
                        market=body.market, title=body.title or body.url)
    added = await embed_and_index(chunks)
    save_index()

    duration_ms = int((time.time() - start) * 1000)
    logger.info(f"Ingested URL {body.url}: {added} chunks in {duration_ms}ms")
    return IngestionStatus(status="success", chunks_added=added,
                           total_chunks=len(chunk_store), source=body.url,
                           duration_ms=duration_ms)


class TextIngestionRequest(BaseModel):
    content: str
    filename: str
    title: Optional[str] = None
    category: str = "general"
    market: str = "india"


@app.post("/ingest/text", response_model=IngestionStatus)
async def ingest_text(body: TextIngestionRequest):
    """Ingest a plain text or pre-extracted HTML string directly."""
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")
    if not body.content.strip():
        raise HTTPException(422, "Empty content")

    start = time.time()
    chunks = chunk_text(
        body.content,
        source=body.filename,
        category=body.category,
        market=body.market,
        title=body.title or body.filename,
    )
    added = await embed_and_index(chunks)
    save_index()

    duration_ms = int((time.time() - start) * 1000)
    logger.info(f"Ingested text '{body.filename}': {added} chunks in {duration_ms}ms")
    return IngestionStatus(status="success", chunks_added=added,
                           total_chunks=len(chunk_store), source=body.filename,
                           duration_ms=duration_ms)


@app.get("/stats")
def stats():
    sources, categories = {}, {}
    for c in chunk_store:
        sources[c.get("source", "?")] = sources.get(c.get("source", "?"), 0) + 1
        categories[c.get("category", "?")] = categories.get(c.get("category", "?"), 0) + 1
    return {
        "total_chunks": len(chunk_store),
        "sources": sources,
        "categories": categories,
        "embedding_model": EMBEDDING_MODEL,
        "index_type": "FAISS-FlatIP-768d",
        "last_updated": datetime.now().isoformat(),
    }


@app.delete("/reset")
def reset_index():
    global faiss_index, chunk_store
    faiss_index = faiss.IndexFlatIP(EMBEDDING_DIM)
    chunk_store = []
    save_index()
    return {"status": "reset"}


# ── Text Extraction ────────────────────────────────────────────

def extract_pdf_text(content: bytes) -> str:
    parts = []
    import io
    pdf_file = io.BytesIO(content)
    reader = PdfReader(pdf_file)
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        parts.append(f"[PAGE {i+1}]\n{text}")
    return "\n".join(parts)


def extract_html_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "iframe"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


# ── Chunking ──────────────────────────────────────────────────

def chunk_text(text: str, source: str, category: str,
               market: str = "india", title: str = None) -> list[dict]:
    paragraphs = [p.strip() for p in re.split(r"\n\n+", text) if p.strip()]
    chunks, current, current_len, page_num, idx = [], [], 0, 1, 0

    for para in paragraphs:
        if para.startswith("[PAGE"):
            try:
                page_num = int(para.split()[1].rstrip("]"))
            except (IndexError, ValueError):
                pass
            continue
        if len(para) < CHUNK_MIN_CHARS:
            continue

        if current_len + len(para) > CHUNK_SIZE_CHARS and current:
            chunk_text_str = "\n\n".join(current)
            chunks.append(_build_chunk(chunk_text_str, source, category,
                                       market, title or source, page_num, idx))
            idx += 1
            # overlap: keep last paragraph
            current = current[-1:] if len(current) > 1 else []
            current_len = len(current[0]) if current else 0

        current.append(para)
        current_len += len(para)

    if current:
        chunk_text_str = "\n\n".join(current)
        if len(chunk_text_str) >= CHUNK_MIN_CHARS:
            chunks.append(_build_chunk(chunk_text_str, source, category,
                                       market, title or source, page_num, idx))

    # Dedup by content hash
    seen, unique = set(), []
    for c in chunks:
        h = hashlib.md5(c["content"].encode()).hexdigest()
        if h not in seen:
            seen.add(h)
            unique.append(c)

    logger.info(f"Chunked '{source[:40]}': {len(unique)} unique chunks")
    return unique


def _build_chunk(content, source, category, market, title, page, idx) -> dict:
    slug = re.sub(r"[^a-z0-9]", "_", source.lower())[:30]
    return {
        "record_id":  f"kb_{slug}_{idx:04d}",
        "chunk_id":   hashlib.md5(content.encode()).hexdigest()[:12],
        "title":      title,
        "content":    content,
        "category":   category,
        "source":     source,
        "page":       page,
        "url":        source if source.startswith("http") else None,
        "version":    "1.0",
        "pii":        _detect_pii(content),
        "market":     market,
        "updated_at": datetime.now().isoformat(),
        "char_count": len(content),
    }


def _detect_pii(text: str) -> bool:
    patterns = [
        r"\b\d{10}\b",
        r"\b[A-Z]{5}[0-9]{4}[A-Z]\b",
        r"\b\d{12}\b",
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    ]
    return any(re.search(p, text) for p in patterns)


# ── Embedding (Google API) ────────────────────────────────────

async def embed_and_index(chunks: list[dict]) -> int:
    global faiss_index, chunk_store
    if not chunks:
        return 0

    all_embeddings = []
    for i in range(0, len(chunks), EMBED_BATCH_SIZE):
        batch = chunks[i: i + EMBED_BATCH_SIZE]
        texts = [c["content"] for c in batch]
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=texts,
                task_type="retrieval_document",
            )
            batch_vecs = result["embedding"]   # list of list[float]
            all_embeddings.extend(batch_vecs)
            logger.info(f"  Embedded batch {i//EMBED_BATCH_SIZE + 1}: {len(batch)} chunks")
            time.sleep(0.3)   # Gentle rate limiting
        except Exception as e:
            logger.error(f"Embedding error on batch {i}: {e}")
            raise HTTPException(500, f"Embedding failed: {e}")

    vecs = np.array(all_embeddings, dtype=np.float32)
    # Normalize for cosine similarity via inner product
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    vecs = vecs / norms

    faiss_index.add(vecs)
    chunk_store.extend(chunks)
    return len(chunks)


def save_index():
    faiss.write_index(faiss_index, str(INDEX_FILE))
    with open(METADATA_FILE, "w") as f:
        json.dump(chunk_store, f, indent=2, default=str)
    logger.info(f"💾 Saved FAISS index: {len(chunk_store)} chunks")
