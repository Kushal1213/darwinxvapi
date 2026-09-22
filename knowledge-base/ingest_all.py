"""
Batch Ingestion Script — reads manifest.json and pushes ALL files to the ingestion service.
Handles PDFs, HTML files, and plain text files.

Usage:
    # Terminal 1: Start ingestion service
    cd services/ingestion-service
    uvicorn main:app --port 8002

    # Terminal 2: Run this script
    python knowledge-base/ingest_all.py
"""

import json, time, requests
from pathlib import Path

INGESTION_URL = "http://localhost:8002"
RAW_DIR = Path("knowledge-base/raw")
MANIFEST_FILE = RAW_DIR / "manifest.json"


def check_service() -> bool:
    try:
        r = requests.get(f"{INGESTION_URL}/health", timeout=5)
        d = r.json()
        print(f"✅ Ingestion service OK | chunks already indexed: {d['total_chunks']}")
        return True
    except Exception as e:
        print(f"❌ Ingestion service not reachable: {e}")
        print(f"   Start it: uvicorn main:app --port 8002  (from services/ingestion-service/)")
        return False


def ingest_pdf(entry: dict) -> bool:
    fp = RAW_DIR / entry["file"]
    if not fp.exists():
        print(f"  ⚠️  File not found: {entry['file']}")
        return False
    try:
        with open(fp, "rb") as f:
            r = requests.post(
                f"{INGESTION_URL}/ingest/pdf",
                files={"file": (entry["file"], f, "application/pdf")},
                params={"category": entry["category"], "market": entry["market"]},
                timeout=120,
            )
        r.raise_for_status()
        d = r.json()
        print(f"  ✅ PDF  [{entry['market']:12}] {entry['file'][:45]:<45} +{d['chunks_added']} chunks")
        return True
    except Exception as e:
        print(f"  ❌ PDF  {entry['file']}: {e}")
        return False


def ingest_text(entry: dict) -> bool:
    """Ingest plain text / HTML files via the /ingest/text endpoint."""
    fp = RAW_DIR / entry["file"]
    if not fp.exists():
        print(f"  ⚠️  File not found: {entry['file']}")
        return False
    try:
        content = fp.read_text(encoding="utf-8", errors="ignore")
        # Strip HTML tags if it's an HTML file
        if entry["file"].endswith(".html"):
            from bs4 import BeautifulSoup
            import re
            soup = BeautifulSoup(content, "html.parser")
            for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
                tag.decompose()
            content = soup.get_text(separator="\n")
            content = re.sub(r'\n{3,}', '\n\n', content).strip()

        r = requests.post(
            f"{INGESTION_URL}/ingest/text",
            json={
                "content": content,
                "filename": entry["file"],
                "title": entry["title"],
                "category": entry["category"],
                "market": entry["market"],
            },
            timeout=120,
        )
        r.raise_for_status()
        d = r.json()
        print(f"  ✅ TEXT [{entry['market']:12}] {entry['file'][:45]:<45} +{d['chunks_added']} chunks")
        return True
    except Exception as e:
        print(f"  ❌ TEXT {entry['file']}: {e}")
        return False


if __name__ == "__main__":
    print("=" * 65)
    print("  Darwix KB — Batch Ingestion")
    print("=" * 65)

    if not check_service():
        exit(1)

    if not MANIFEST_FILE.exists():
        print("❌ manifest.json not found — run scrape_html.py first")
        exit(1)

    manifest = json.loads(MANIFEST_FILE.read_text())
    files = manifest["files"]

    pdfs  = [f for f in files if f["type"] == "pdf"]
    texts = [f for f in files if f["type"] == "text"]

    print(f"\n📄 Ingesting {len(pdfs)} PDFs...")
    pdf_ok = 0
    for entry in pdfs:
        if ingest_pdf(entry):
            pdf_ok += 1
        time.sleep(0.5)   # gentle rate limit

    print(f"\n📝 Ingesting {len(texts)} text/HTML files...")
    text_ok = 0
    for entry in texts:
        if ingest_text(entry):
            text_ok += 1
        time.sleep(0.3)

    # Final stats from service
    try:
        stats = requests.get(f"{INGESTION_URL}/stats", timeout=10).json()
        print(f"\n{'='*65}")
        print(f"  INGESTION COMPLETE")
        print(f"  PDFs:  {pdf_ok}/{len(pdfs)}")
        print(f"  Texts: {text_ok}/{len(texts)}")
        print(f"  Total chunks in FAISS: {stats['total_chunks']}")
        print(f"  By category: {stats['categories']}")
        print(f"\n  RAG service is ready to answer queries!")
        print(f"  Test: POST http://localhost:8001/retrieve")
        print(f"{'='*65}")
    except Exception:
        print(f"\n✅ Done: {pdf_ok} PDFs + {text_ok} texts ingested")
