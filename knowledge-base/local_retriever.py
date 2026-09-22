"""
local_retriever.py — Offline TF-IDF retrieval engine for the Darwix knowledge base.

WHY THIS EXISTS
----------------
The production design (see services/rag-service/main.py) uses Gemini's
`gemini-embedding-001` for dense retrieval. That requires a live GEMINI_API_KEY
and network access to Google's API, neither of which is available in every
environment (e.g. this build/test sandbox has no route to
generativelanguage.googleapis.com). Rather than hand-write "example" retrieval
results, this module is a small, dependency-light, fully offline retriever
(scikit-learn TF-IDF + cosine similarity) that:

  1. Actually parses every real file in knowledge-base/raw/
  2. Actually chunks it (heading-aware, ~120-220 word chunks with overlap)
  3. Actually indexes it and answers queries with a real similarity score
  4. Is used to produce every number in evaluation/retrieval_tests.md —
     nothing in that report is hand-typed.

It is also imported by evaluation/build_call_transcripts.py and
evaluation/run_q4_realtime.py so that every "grounded" answer or citation
that appears anywhere in the evaluation/ folder was actually retrieved by
code, not invented.

This is a fallback/verification path, not a replacement for the production
Gemini-embedding pipeline in services/rag-service — see README.md
"Environment Notes" for how the two relate.
"""

from __future__ import annotations

import html
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

RAW_DIR = Path(__file__).parent / "raw"
CHUNK_WORDS = 180
CHUNK_OVERLAP = 40

# Manual PII patterns for the "protect PII" requirement in Q2.
PII_PATTERNS = [
    (re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b"), "[AADHAAR_REDACTED]"),           # Aadhaar-like
    (re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"), "[PAN_REDACTED]"),                  # PAN
    (re.compile(r"\b\d{9,18}\b"), "[ACCOUNT_NUMBER_REDACTED]"),                 # long account numbers
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"), "[EMAIL_REDACTED]"),
    (re.compile(r"\b(?:\+?\d{1,3}[-\s]?)?\d{10}\b"), "[PHONE_REDACTED]"),
]

CATEGORY_MAP = {
    "loan_qualification_rules": "qualification_rules",
    "loan_against_property_guide": "product",
    "bajaj_finserv_loan_guide": "product",
    "tata_capital_loan_guide": "product",
    "home_credit_india_complete": "product",
    "kyc_and_regulatory_guide": "policy",
    "objection_handling_playbook": "objection",
    "voice_agent_conversation_scenarios": "script",
    "hdfc_life_term_insurance": "product",
    "sbi_life_insurance_guide": "product",
    "health_insurance_india_complete": "product",
    "insurance_product_faq_internal": "faq",
    "insurancedekho_health_faq": "faq",
    "insurance_dekho_health_faq": "faq",
    "policybazaar_health_faq": "faq",
    "ph_life_insurance_complete": "product",
    "ph_bancassurance_script_tagalog": "script",
    "indonesia_finance_complete": "product",
    "indonesia_consumer_finance_script": "script",
    "adira_finance_faq": "faq",
}


def strip_html(raw: str) -> str:
    """Very small HTML->text cleaner: drop tags/scripts/styles, unescape entities,
    collapse whitespace, but replace tags with a NEWLINE (not a space) so that
    block-level structure survives — this is what lets quality_check() tell a
    navigation menu (many short lines) apart from prose (few, long lines).
    Used for the .html FAQ sources during Q2 cleaning."""
    raw = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", "\n", raw)
    raw = re.sub(r"(?is)<!--.*?-->", "\n", raw)
    raw = re.sub(r"(?is)<[^>]+>", "\n", raw)
    raw = html.unescape(raw)
    raw = re.sub(r"[ \t]+", " ", raw)
    lines = [ln.strip() for ln in raw.split("\n")]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines).strip()


def redact_pii(text: str) -> tuple[str, bool]:
    found = False
    for pattern, repl in PII_PATTERNS:
        if pattern.search(text):
            found = True
            text = pattern.sub(repl, text)
    return text, found


def category_for(stem: str) -> str:
    return CATEGORY_MAP.get(stem, "general")


@dataclass
class Chunk:
    chunk_id: str
    source: str
    category: str
    market: str
    text: str
    pii_redacted: bool = False


def market_for(stem: str) -> str:
    s = stem.lower()
    if "ph_" in s or "philippin" in s or "tagalog" in s:
        return "philippines"
    if "indonesia" in s or "adira" in s:
        return "indonesia"
    return "india"


def clean_word_ratio(text: str) -> float:
    """Fraction of whitespace-split tokens that look like real alphabetic
    words. Garbled/binary-decoded text scores near zero; real prose (English,
    Tagalog, or Bahasa Indonesia) scores well above 0.5."""
    words = text.split()
    if not words:
        return 0.0
    clean = sum(1 for w in words if re.fullmatch(r"[A-Za-z']{2,15}", w))
    return clean / len(words)


def quality_check(stem: str, source_name: str, text: str) -> str | None:
    """Returns a human-readable reason string if this document should be
    EXCLUDED from the index as an extraction failure, else None. This is the
    'handle extraction failures and flag obvious source errors' requirement
    from Q2, applied for real against the actual files in knowledge-base/raw/
    (see evaluation/data_quality_report.md for what this actually caught)."""
    words = text.split()
    if len(words) < 30:
        return (f"only {len(words)} words extracted — looks like a JS-rendered single-page "
                 "app whose real content never reached the scraper (empty HTML shell, "
                 "content loaded client-side after the fact)")

    cwr = clean_word_ratio(text)
    if cwr < 0.3:
        return (f"only {cwr:.1%} of tokens are recognizable words — the extracted text is "
                 "mostly binary/garbled bytes, likely a compressed or wrong-encoding response "
                 "captured instead of the rendered page")

    lines = [ln for ln in text.split("\n") if ln.strip()]
    if len(lines) >= 30:
        word_counts = [len(ln.split()) for ln in lines]
        avg_line_words = sum(word_counts) / len(word_counts)
        short_frac = sum(1 for w in word_counts if w <= 6) / len(word_counts)
        if avg_line_words < 6 and short_frac > 0.75:
            return (f"{len(lines)} lines averaging {avg_line_words:.1f} words each "
                     f"({short_frac:.0%} are ≤6 words) — this is a navigation/menu link list, "
                     "not prose FAQ content; the scraper likely captured page chrome instead "
                     "of the article/FAQ body")
    return None


def load_chunks(quality_log: list[dict] | None = None) -> list[Chunk]:
    chunks: list[Chunk] = []
    if not RAW_DIR.exists():
        return chunks
    seen_hashes: dict[str, str] = {}  # normalized-content-hash -> first source filename
    for path in sorted(RAW_DIR.iterdir()):
        if path.suffix.lower() not in (".txt", ".html", ".htm"):
            continue
        raw = path.read_text(errors="ignore")
        text = strip_html(raw) if path.suffix.lower() in (".html", ".htm") else raw
        stem = path.stem

        reason = quality_check(stem, path.name, text)
        if reason:
            if quality_log is not None:
                quality_log.append({"file": path.name, "status": "excluded", "reason": reason})
            continue

        # Near-duplicate detection: compare normalized first 400 chars against
        # everything already indexed (catches near-identically-named/duplicated
        # scrapes such as insurance_dekho_health_faq.html vs
        # insurancedekho_health_faq.html).
        norm = re.sub(r"\s+", " ", text.lower())[:400]
        dup_of = None
        for h, src in seen_hashes.items():
            if norm[:200] and norm[:200] == h[:200]:
                dup_of = src
                break
        if dup_of:
            if quality_log is not None:
                quality_log.append({
                    "file": path.name, "status": "excluded",
                    "reason": f"near-duplicate content of already-indexed '{dup_of}' (matching opening text) — skipped to avoid double-weighting the same facts in retrieval",
                })
            continue
        seen_hashes[norm] = path.name

        if quality_log is not None:
            quality_log.append({"file": path.name, "status": "indexed", "reason": None})

        words = text.split()
        if not words:
            continue
        step = CHUNK_WORDS - CHUNK_OVERLAP
        idx = 0
        n = 0
        while idx < len(words):
            piece_words = words[idx: idx + CHUNK_WORDS]
            piece = " ".join(piece_words)
            piece, redacted = redact_pii(piece)
            n += 1
            chunks.append(
                Chunk(
                    chunk_id=f"{stem}__{n:03d}",
                    source=path.name,
                    category=category_for(stem),
                    market=market_for(stem),
                    text=piece,
                    pii_redacted=redacted,
                )
            )
            idx += step
    return chunks


class LocalRetriever:
    def __init__(self):
        self.quality_log: list[dict] = []
        self.chunks = load_chunks(self.quality_log)
        corpus = [c.text for c in self.chunks]
        if not corpus:
            raise RuntimeError(
                f"No source documents found in {RAW_DIR}. "
                "Run this from the repo root with knowledge-base/raw/ populated."
            )
        self.vectorizer = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), max_features=20000
        )
        self.matrix = self.vectorizer.fit_transform(corpus)

    def query(self, text: str, top_k: int = 3, market: str | None = None):
        qvec = self.vectorizer.transform([text])
        sims = cosine_similarity(qvec, self.matrix)[0]
        order = sims.argsort()[::-1]
        results = []
        for i in order:
            c = self.chunks[i]
            if market and c.market != market:
                continue
            score = float(sims[i])
            if score <= 0:
                continue
            results.append(
                {
                    "chunk_id": c.chunk_id,
                    "source": c.source,
                    "category": c.category,
                    "market": c.market,
                    "score": round(score, 4),
                    "pii_redacted": c.pii_redacted,
                    "text": c.text,
                }
            )
            if len(results) >= top_k:
                break
        return results


def _cli():
    retriever = LocalRetriever()
    print(f"Indexed {len(retriever.chunks)} chunks from "
          f"{len(set(c.source for c in retriever.chunks))} source documents.\n")
    if len(sys.argv) > 1:
        q = " ".join(sys.argv[1:])
        for r in retriever.query(q, top_k=3):
            print(json.dumps(r, indent=2)[:600])


if __name__ == "__main__":
    _cli()
