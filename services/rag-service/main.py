"""
Veyra RAG Service (Ultra-Low Latency Edition v1.1)
Target: Total RAG latency < 1.5 seconds

Key Optimizations:
1. Model: models/gemini-flash-latest with 3072d gemini-embedding-001
2. LRU Embedding Cache (@lru_cache) -> query vector search < 1ms on cache hit
3. Startup FAISS In-Memory Preload -> 0 disk I/O on retrieval requests
4. Externalized YAML prompts (config/prompts.yaml)
5. Request ID middleware (X-Request-ID) for centralized log tracing
6. Retry backoff decorator for LLM calls
7. Interactive Swagger OpenAPI (/docs & /redoc)
"""

import os
import sys
import threading
import json
import time
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from functools import lru_cache
from typing import Optional

import numpy as np
import faiss
import yaml
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# ── Logging Setup ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [req_id=%(request_id)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)

class RequestIDFilter(logging.Filter):
    def filter(self, record):
        if not hasattr(record, "request_id"):
            record.request_id = "sys"
        return True

for handler in logging.getLogger().handlers:
    handler.addFilter(RequestIDFilter())

logger = logging.getLogger("rag-service")
logger.addFilter(RequestIDFilter())

BASE_DIR = Path(__file__).resolve().parents[2].resolve()
load_dotenv(os.getenv('VEYRA_ENV_FILE') or BASE_DIR / ".env")
sys.path.insert(0, str(BASE_DIR / "services"))
from managed_knowledge import generation, read_snapshot
from answer_support import extract_supported_answer, terms as evidence_terms
from gemini_provider import GeminiProvider

# ── Configuration ─────────────────────────────────────────────
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL     = os.getenv("GEMINI_MODEL", "models/gemini-flash-latest")
EMBEDDING_MODEL  = "models/gemini-embedding-001"
EMBEDDING_DIM    = 3072
FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", str(BASE_DIR / "knowledge-base" / "embeddings" / "faiss_index"))
PROMPTS_YAML_PATH = Path(__file__).parent / "config" / "prompts.yaml"

INDEX_PATH    = Path(FAISS_INDEX_PATH)
if not INDEX_PATH.is_absolute():
    INDEX_PATH = BASE_DIR / INDEX_PATH

if INDEX_PATH.suffix != ".faiss":
    INDEX_DIR = INDEX_PATH
    INDEX_FILE = INDEX_DIR / "index.faiss"
    METADATA_FILE = INDEX_DIR / "metadata.json"
else:
    INDEX_DIR = INDEX_PATH.parent
    INDEX_FILE = INDEX_PATH
    METADATA_FILE = INDEX_DIR / "metadata.json"

# ── Global In-Memory State ─────────────────────────────────────
faiss_index: Optional[faiss.IndexFlatIP] = None
chunk_store: list[dict] = []
prompts_config: dict = {}
embedding_cache_hits = 0
gemini = GeminiProvider()


@asynccontextmanager
async def lifespan(_app):
    load_prompts()
    logger.info(f"GEMINI_API_KEY configured: {bool(GEMINI_API_KEY)}")
    if GEMINI_API_KEY:
        gemini.configure(GEMINI_API_KEY)
        logger.info(f"Gemini API configured | llm={GEMINI_MODEL} | embed={EMBEDDING_MODEL}")
    else:
        logger.warning("GEMINI_API_KEY missing")
    load_index()
    try:
        yield
    finally:
        gemini.close()


# ── FastAPI App with OpenAPI Docs ──────────────────────────────
app = FastAPI(
    title="Veyra — Voice RAG Intelligence Engine",
    description="Production high-performance RAG pipeline for Veyra voice agents. Target latency < 1.5s.",
    version="1.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request Tracing Middleware ─────────────────────────────────
@app.middleware("http")
async def add_request_id_header(request: Request, call_next):
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])
    request.state.request_id = req_id
    response: Response = await call_next(request)
    response.headers["X-Request-ID"] = req_id
    return response


# ── In-Memory Loaders ──────────────────────────────────────────
def load_prompts():
    global prompts_config
    if PROMPTS_YAML_PATH.exists():
        with open(PROMPTS_YAML_PATH, "r", encoding="utf-8") as f:
            prompts_config = yaml.safe_load(f)
        logger.info(f"Loaded external prompts v{prompts_config.get('version', '1.0')}")
    else:
        prompts_config = {
            "version": "1.0-fallback",
            "system_prompt": "Answer in 2 short sentences based on context.",
            "language_rules": {"en": "Respond in English."}
        }


_index_lock = threading.Lock()
_snapshot = None
_loaded_token = None


def load_index():
    global faiss_index, chunk_store, _snapshot, _loaded_token
    with _index_lock:
        try:
            managed_token = generation(INDEX_DIR)
            # Legacy ingestion and metadata migrations must reload too.
            token = (managed_token, *[(p.stat().st_mtime_ns, p.stat().st_size) if p.exists() else None
                                      for p in (INDEX_FILE, METADATA_FILE)])
            if _snapshot is not None and token == _loaded_token:
                return _snapshot
            combined = faiss.IndexFlatIP(EMBEDDING_DIM)
            records = []
            if INDEX_FILE.exists() and METADATA_FILE.exists():
                legacy = faiss.read_index(str(INDEX_FILE))
                legacy_records = json.loads(METADATA_FILE.read_text(encoding='utf-8'))
                if legacy.d != EMBEDDING_DIM or legacy.ntotal != len(legacy_records):
                    raise ValueError('Legacy index does not match its metadata')
                if legacy.ntotal:
                    combined.add(legacy.reconstruct_n(0, legacy.ntotal))
                records.extend(legacy_records)
            managed, managed_records = read_snapshot(INDEX_DIR, EMBEDDING_DIM, managed_token)
            if managed.ntotal:
                combined.add(managed.reconstruct_n(0, managed.ntotal))
            records.extend(managed_records)
            _snapshot = (combined, records)
            _loaded_token = token
            faiss_index, chunk_store = _snapshot
            return _snapshot
        except Exception:
            # Never serve a stale generation after a document was archived.
            logger.exception('Knowledge snapshot unavailable')
            raise HTTPException(503, 'Knowledge snapshot unavailable; restore the index or retry ingestion.')


# ── LRU Caching for Embeddings ─────────────────────────────────
@lru_cache(maxsize=512)
def get_cached_embedding(query_text: str) -> tuple:
    """Computes and caches normalized 3072d vector for query."""
    result = gemini.embed_content(
        model=EMBEDDING_MODEL,
        content=query_text,
        task_type="retrieval_query",
    )
    vec = np.array(result["embedding"], dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return tuple(vec.tolist())


def embed_query_fast(query: str) -> np.ndarray:
    global embedding_cache_hits
    try:
        # Check LRU cache
        vec_tuple = get_cached_embedding(query)
        embedding_cache_hits += 1
        return np.array(vec_tuple, dtype=np.float32).reshape(1, -1)
    except Exception as e:
        # A zero vector makes FAISS return arbitrary documents. Let the request
        # handler select the deterministic lexical fallback instead.
        logger.warning(f"Embedding API error ({e}), using lexical retrieval fallback")
        return None


def canonical_market(market: str) -> str:
    """Map supported UI/Vapi identifiers; reject unknown markets."""
    value = (market or "").strip().lower()
    if value in {"india", "india-loan", "india-insurance", "in", "indian", "hindi"}:
        return "india"
    if value in {"ph-bancassurance", "ph", "philippines", "taglish"}:
        return "philippines"
    if value in {"id-finance", "id", "indonesia", "bahasa"}:
        return "indonesia"
    raise ValueError(f"Unsupported market: {market}")


def product_is_eligible(chunk_product: Optional[str], product: Optional[str] = None) -> bool:
    if not product:
        return True
    value = (chunk_product or "").strip().lower()
    requested = product.strip().lower()
    specific_loans = {'personal loan', 'personal-loan', 'home loan', 'home-loan', 'business loan', 'business-loan', 'auto loan', 'auto-loan', 'car loan', 'car-loan', 'loan against property'}
    specific_insurance = {'life insurance', 'life-insurance', 'health insurance', 'health-insurance'}
    if not value:
        return False
    if value == 'general':
        return True  # Explicitly reviewed as shared across products.
    if value == requested:
        return True
    if requested in specific_loans:
        return value in {'loan', 'loans'} or value.replace(' ', '-') == requested.replace(' ', '-')
    if requested in specific_insurance:
        return value == 'insurance' or value.replace(' ', '-') == requested.replace(' ', '-')
    if requested == "loan" and (value == "loans" or value.endswith("-loan") or value.endswith("-loans")):
        return True
    if requested == "insurance" and ("insurance" in value or value in {'policy', 'bancassurance'}):
        return True
    return False


def query_product_scope(query: str) -> Optional[str]:
    """Use explicit product words to prevent a cross-product citation."""
    loan = bool(re.search(r'\bloans?\b', query, re.I))
    insurance = bool(re.search(r'\b(?:insurance|bancassurance|policy|policies)\b', query, re.I))
    if loan == insurance:
        return None
    return 'loan' if loan else 'insurance'


def effective_date_is_eligible(chunk: dict, today: Optional[date] = None) -> bool:
    current = today or datetime.now(timezone.utc).date()
    try:
        effective_from = date.fromisoformat(chunk['effective_from']) if chunk.get('effective_from') else None
        effective_to = date.fromisoformat(chunk['effective_to']) if chunk.get('effective_to') else None
    except (TypeError, ValueError):
        return False
    return not ((effective_from and effective_from > current) or (effective_to and effective_to < current))


def chunk_is_eligible(chunk: dict, market: str, product: Optional[str] = None) -> bool:
    if chunk.get("agent_eligible") is False:
        return False
    if chunk.get("published") is False:
        return False
    if chunk.get("publication_status") not in (None, "", "published"):
        return False
    if chunk.get("review_status") not in (None, "", "approved"):
        return False
    if not effective_date_is_eligible(chunk):
        return False
    if chunk.get("market") != market:
        return False
    return product_is_eligible(chunk.get("product"), product)


def abstention_reason(answer: str) -> Optional[str]:
    normalized = clean_for_speech(answer).lower()
    if "specialize exclusively" in normalized:
        return "out_of_scope"
    if any(phrase in normalized for phrase in [
        "i don't have that specific detail",
        "i couldn't find supporting information",
        "i couldn't find a clear answer",
        "connect you with a specialist",
    ]):
        return "insufficient_support"
    return None


def lexical_candidates(query: str, market: str, records=None, product: Optional[str] = None) -> list[dict]:
    """Offline fallback when the embedding provider is unavailable.

    It deliberately searches the already-loaded, versioned chunks so citations
    remain identical to the normal FAISS path. This is much safer than searching
    with a zero vector, whose results have no relationship to the question.
    """
    query_terms = evidence_terms(normalize_query(query))
    market_name = canonical_market(market)
    ranked = []
    for chunk in (chunk_store if records is None else records):
        if not chunk_is_eligible(chunk, market_name, product):
            continue
        text_terms = evidence_terms(chunk.get("content", ""))
        overlap = len(query_terms & text_terms)
        if overlap:
            score = overlap / max(1, len(query_terms))
            ranked.append({**chunk, "_score": min(score, 1.0)})
    return sorted(ranked, key=lambda item: item["_score"], reverse=True)


def select_market_chunks(candidates: list[dict], market: str, top_k: int, product: Optional[str] = None) -> list[dict]:
    """Return only chunks eligible for the requested market/product."""
    market_name = canonical_market(market)
    return [chunk for chunk in candidates if chunk_is_eligible(chunk, market_name, product)][:top_k]


# ── Data Models ───────────────────────────────────────────────
class RetrieveRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000, pattern=r'\S', json_schema_extra={"example": "What is the minimum age and monthly income for personal loan?"})
    top_k: int = Field(default=2, ge=1, le=5)
    language: str = Field(default="en", json_schema_extra={"example": "en"})
    market: str = Field(default="india", json_schema_extra={"example": "india"})
    product: Optional[str] = Field(default=None, min_length=1, max_length=100)
    session_id: Optional[str] = None

class RetrieveResponse(BaseModel):
    answer: str
    sources: list[dict]
    chunks: list[dict]
    latency_ms: int
    retrieval_latency_ms: int
    llm_latency_ms: int
    model: str
    retrieved_count: int
    kb_version: str
    retrieval_mode: str
    abstention_reason: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────
@app.get("/health", summary="Service Health & KB Index Status")
def health():
    index, records = load_index()
    return {
        "status": "ok",
        "service": "rag-service",
        "version": "1.1.0",
        "kb_version": prompts_config.get("version", "1.1"),
        "llm_model": GEMINI_MODEL,
        "embedding_model": EMBEDDING_MODEL,
        "indexed_chunks": len(records),
        "index_vectors": index.ntotal,
        "cache_hits": embedding_cache_hits,
        "agent_scopes": knowledge_scopes(records),
    }


def knowledge_scopes(records):
    return {agent: sum(chunk_is_eligible(c, market, product) for c in records)
            for agent, market, product in [
                ('india-loan', 'india', 'loan'), ('india-insurance', 'india', 'insurance'),
                ('ph-bancassurance', 'philippines', 'bancassurance'), ('id-finance', 'indonesia', 'finance')]}


@app.get('/stats')
def stats():
    _, records = load_index()
    sources = {}
    for chunk in records:
        key = chunk.get('document_id') or chunk.get('source', 'Unknown')
        item = sources.setdefault(key, {
            'source': chunk.get('source'), 'title': chunk.get('title', chunk.get('source')),
            'market': chunk.get('market'), 'product': chunk.get('product'),
            'effective_from': chunk.get('effective_from'), 'effective_to': chunk.get('effective_to'),
            'managed': bool(chunk.get('document_id')), 'chunks': 0, 'eligible_chunks': 0,
        })
        item['chunks'] += 1
        item['eligible_chunks'] += int(any(knowledge_scopes([chunk]).values()))
    return {'total_chunks': len(records), 'agent_scopes': knowledge_scopes(records),
            'sources': list(sources.values())}

@app.get("/test", summary="Simple test endpoint")
def test():
    logger.info("Test endpoint called")
    return {"status": "ok", "message": "Test successful"}


@app.post("/retrieve", response_model=RetrieveResponse, summary="Retrieve Grounded Answer (<1.5s target)")
async def retrieve(req: RetrieveRequest, request: Request):
    try:
        market = canonical_market(req.market)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    implied_product = {'india-loan': 'loan', 'india-insurance': 'insurance',
                       'ph-bancassurance': 'bancassurance', 'id-finance': 'finance'}.get(req.market.strip().lower())
    if implied_product and req.product and not product_is_eligible(req.product, implied_product):
        raise HTTPException(422, 'Product conflicts with the selected agent market')
    stated_product = query_product_scope(req.query)
    index, records = load_index()
    # Older managed documents have no product metadata. Keep them searchable
    # when the user has not selected a product or an agent scope explicitly.
    product = req.product or implied_product or (stated_product if any(row.get('product') for row in records) else None)
    t0 = time.time()
    req_id = getattr(request.state, "request_id", "sys")
    if stated_product and product and not product_is_eligible(product, stated_product):
        return RetrieveResponse(
            answer="I couldn't find supporting information for that market or product. Let me connect you with a specialist.",
            sources=[], chunks=[], latency_ms=int((time.time() - t0) * 1000),
            retrieval_latency_ms=0, llm_latency_ms=0, model=GEMINI_MODEL,
            retrieved_count=0, kb_version=prompts_config.get("version", "1.1"),
            retrieval_mode="none", abstention_reason="no_eligible_candidates",
        )
    if not records:
        return RetrieveResponse(
            answer="No published knowledge is available yet. Ask an administrator to upload and approve a document.",
            sources=[], chunks=[], latency_ms=int((time.time() - t0) * 1000),
            retrieval_latency_ms=0, llm_latency_ms=0, model=GEMINI_MODEL,
            retrieved_count=0, kb_version=prompts_config.get("version", "1.1"),
            retrieval_mode="none", abstention_reason="knowledge_empty",
        )

    # Step 1: Vector Embedding & FAISS Search (< 150ms)
    t_retrieval_start = time.time()
    logger.info(f"[{req_id}] Starting retrieval for market={market}, product={product or 'unspecified'}")
    query_vec = embed_query_fast(req.query) if GEMINI_API_KEY else None
    retrieval_mode = "vector" if query_vec is not None else "lexical"
    candidates = []
    if query_vec is not None:
        # Search inside the permitted scope. Searching a global top-16 first
        # can hide every eligible chunk behind higher-scoring other products.
        eligible_ids = [i for i, chunk in enumerate(records) if chunk_is_eligible(chunk, market, product)]
        k = min(max(req.top_k * 8, 16), len(eligible_ids))
        try:
            scoped = faiss.IndexFlatIP(index.d)
            if eligible_ids:
                scoped.add(index.reconstruct_batch(np.asarray(eligible_ids, dtype=np.int64)))
            scores, indices = scoped.search(query_vec, k) if k else ([], [])
            for score, offset in zip(scores[0] if k else [], indices[0] if k else []):
                if offset != -1:
                    candidates.append({**records[eligible_ids[offset]], "_score": float(score)})
        except Exception as e:
            logger.warning(f"[{req_id}] FAISS search failed ({e}), using lexical retrieval fallback")
            retrieval_mode = "lexical"
            candidates = lexical_candidates(req.query, market, records, product)
    else:
        candidates = lexical_candidates(req.query, market, records, product)

    # Supplement semantic retrieval with exact terms, including short fields such
    # as age/fee. Deduplicate overlap without discarding independent citations.
    seen = {(c.get('document_id'), c.get('source'), c.get('chunk_id'), c.get('content')) for c in candidates}
    for chunk in lexical_candidates(req.query, market, records, product):
        key = (chunk.get('document_id'), chunk.get('source'), chunk.get('chunk_id'), chunk.get('content'))
        if key not in seen:
            candidates.append(chunk)
            seen.add(key)
    logger.info(f"[{req_id}] Found {len(candidates)} candidates")

    retrieval_ms = int((time.time() - t_retrieval_start) * 1000)

    if not candidates:
        return RetrieveResponse(
            answer="I don't have that specific detail in my knowledge base. Let me transfer you to a specialist.",
            sources=[],
            chunks=[],
            latency_ms=int((time.time() - t0) * 1000),
            retrieval_latency_ms=retrieval_ms,
            llm_latency_ms=0,
            model=GEMINI_MODEL,
            retrieved_count=0,
            kb_version=prompts_config.get("version", "1.1"),
            retrieval_mode=retrieval_mode,
            abstention_reason="no_eligible_candidates",
        )

    # Select top chunks directly to save LLM context tokens & latency.
    top_chunks = select_market_chunks(candidates, market, len(candidates), product)
    logger.info(f"[{req_id}] Selected {len(top_chunks)} top chunks for LLM")

    if not top_chunks:
        return RetrieveResponse(
            answer="I couldn't find supporting information for that market or product. Let me connect you with a specialist.",
            sources=[], chunks=[], latency_ms=int((time.time() - t0) * 1000),
            retrieval_latency_ms=retrieval_ms, llm_latency_ms=0, model=GEMINI_MODEL,
            retrieved_count=0, kb_version=prompts_config.get("version", "1.1"),
            retrieval_mode=retrieval_mode, abstention_reason="no_eligible_candidates",
        )

    # Step 2: Use direct knowledge synthesizer for faster response
    t_llm_start = time.time()
    try:
        logger.info(f"[{req_id}] Using direct knowledge synthesizer for query: '{req.query}'")
        answer, support = extract_supported_answer(normalize_query(req.query), top_chunks)
        answer = clean_for_speech(answer)
        top_chunks = support
        logger.info(f"[{req_id}] Generated answer: {answer[:100]}")
    except Exception as e:
        logger.error(f"[{req_id}] Answer generation error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(503, "Answer extraction failed; please retry.") from e
    llm_ms = int((time.time() - t_llm_start) * 1000)

    total_ms = int((time.time() - t0) * 1000)
    logger.info(f"[{req_id}] RAG Complete | total={total_ms}ms (retrieval={retrieval_ms}ms, llm={llm_ms}ms) | query='{req.query[:30]}'")

    sources = [
        {
            "source": c["source"],
            "title": c.get("title", c["source"]),
            "document_id": c.get("document_id"),
            "family_id": c.get("family_id", c.get("document_id")),
            "revision": c.get("revision"),
            "content_hash": c.get("content_hash"),
            "product": c.get("product"),
            "effective_from": c.get("effective_from"),
            "effective_to": c.get("effective_to"),
            "page": c.get("page"),
            "chunk_id": c.get("chunk_id", "chk-01"),
            "score": round(c["_score"], 4),
            "category": c.get("category", "policy"),
            "excerpt": c.get("content", ""),
        }
        for c in top_chunks
    ]
    reason = abstention_reason(answer)

    return RetrieveResponse(
        answer=answer,
        sources=sources if not reason else [],
        chunks=[{k: v for k, v in c.items() if k != "_score"} for c in top_chunks] if not reason else [],
        latency_ms=total_ms,
        retrieval_latency_ms=retrieval_ms,
        llm_latency_ms=llm_ms,
        model=GEMINI_MODEL,
        retrieved_count=0 if reason else len(top_chunks),
        kb_version=prompts_config.get("version", "1.1"),
        retrieval_mode=retrieval_mode,
        abstention_reason=reason,
    )


import re

def clean_for_speech(text: str) -> str:
    if not text:
        return ""
    # Convert vertical bars | to natural pauses (comma)
    text = text.replace("|", ", ")
    # Convert technical symbols
    text = text.replace("**", "").replace("*", "").replace("#", "").replace("`", "").replace("_", " ")
    text = text.replace("INR ", "Rupees ").replace("INR", "Rupees")
    # Collapse multiple spaces and trim
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def parse_voice_answer(text: str) -> str:
    if not text:
        return ""

    # Reject raw meta-reasoning traces
    if text.startswith("Document") or text.startswith("Task:") or "Constraint 1" in text or "Note: Since" in text:
        return ""

    # 1. Check for Sentence 1 / Sentence 2 markers
    match = re.search(r'Sentence 1:\s*(.*?)\s*Sentence 2:\s*(.*)', text, re.IGNORECASE | re.DOTALL)
    if match:
        s1, s2 = match.group(1).strip(), match.group(2).strip()
        s2 = re.split(r'\n|Note:|Constraint|Draft', s2)[0].strip()
        return clean_for_speech(f"{s1} {s2}")

    # 2. Check for explicit markers
    for marker in ["Refined Version:", "Final Answer:", "Final Response:", "Spoken Answer:", "Direct answer:"]:
        if marker in text:
            part = text.split(marker)[-1].strip()
            part = re.sub(r'^(Sentence \d+:|Draft \d+:)\s*', '', part, flags=re.IGNORECASE).strip()
            return clean_for_speech(part.split('\n')[0])

    # 3. Take the first clean paragraph block
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    for p in paragraphs:
        if not p.startswith("*") and not p.startswith("-") and not p.startswith("#") and not p.startswith("Task:") and not p.startswith("Document") and "Constraint" not in p:
            clean_p = p.split('\n')[0].strip()
            return clean_for_speech(clean_p)

    return ""


def normalize_query(query: str) -> str:
    if not query:
        return ""
    q = query.lower()
    # Normalize common ASR phonetic mishearings
    q = re.sub(r'\b(ltd|lt b|l t v|el tee vee)\b', 'ltv', q)
    q = re.sub(r'\b(cibil|sibil|cibl)\b', 'cibil', q)
    q = re.sub(r'\b(lic|l i c)\b', 'lic', q)
    return q


def synthesize_direct_knowledge_answer(query: str, chunks: list[dict]) -> str:
    answer, _ = extract_supported_answer(normalize_query(query), chunks)
    return clean_for_speech(answer)


# ── Fast Gemini LLM Generator with Timeout & Fail-Safe ─────────────────
def generate_answer_fast(query: str, chunks: list[dict], language: str = "en") -> str:
    logger.info(f"Generating answer for query: '{query}' with {len(chunks)} chunks")

    context_str = "\n\n".join([f"Document ({c.get('source','KB')}):\n{c['content']}" for c in chunks])

    user_prompt = f"""Context:
{context_str}

Question: {query}
Synthesize a direct 2-sentence conversational answer based on the context above:"""

    try:
        logger.info(f"Calling Gemini model: {GEMINI_MODEL}")
        raw_text = gemini.generate_content(
            model=GEMINI_MODEL,
            content=user_prompt,
            temperature=0.2,
            max_output_tokens=300,
        )
        if raw_text:
            cleaned = parse_voice_answer(raw_text)
            if cleaned and len(cleaned) > 10:
                logger.info(f"Using Gemini text answer: {cleaned[:100]}")
                return cleaned
    except Exception as e:
        logger.warning(f"LLM Generation failed ({e}) — switching to instant knowledge synthesizer")
        import traceback
        logger.warning(traceback.format_exc())

    # Fast & reliable fallback: synthesize directly from FAISS context (< 5ms)
    logger.info("Using fallback knowledge synthesizer")
    return synthesize_direct_knowledge_answer(query, chunks)
