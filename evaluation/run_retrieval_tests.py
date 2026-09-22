"""
run_retrieval_tests.py — generates evaluation/retrieval_tests.md from REAL
retrieval calls against knowledge-base/local_retriever.py.

Every row in the resulting table is produced by actually querying the
indexed knowledge base at script run time; nothing is hand-typed. Re-run
this file any time the knowledge base changes to regenerate the report.

Usage:
    python3 evaluation/run_retrieval_tests.py
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from knowledge_base_utils import get_retriever  # noqa: E402

# (query, category-under-test, human verdict rubric note)
QUERIES = [
    ("What is the minimum monthly salary required for a personal loan?", "qualification"),
    ("What is the maximum loan-to-value ratio for a loan against property?", "policy"),
    ("What KYC documents are required to open a loan file?", "policy"),
    ("Customer says the interest rate is too high, how should I respond?", "objection"),
    ("What is a rider in a life insurance policy and what does 'benepisyaryo' mean?", "faq / localization"),
    ("What is DP and tenor for a motorcycle financing product in Indonesia?", "product / localization"),
    ("Is pre-existing disease covered immediately under a new health insurance policy?", "faq"),
    ("What happens if a customer misses an EMI / cicilan payment date?", "policy"),
]


def verdict_for(results, query_terms_min_score=0.05):
    if not results:
        return "incorrect", "No chunk cleared the similarity floor — retrieval returned nothing."
    top = results[0]
    if top["score"] >= 0.15:
        return "correct", f"Top match score {top['score']:.3f} against `{top['source']}` is a strong lexical match."
    if top["score"] >= query_terms_min_score:
        return "partially correct", (
            f"Top match score {top['score']:.3f} against `{top['source']}` is weak — "
            "the source is topically related but may not fully answer the question."
        )
    return "incorrect", f"Best score was only {top['score']:.3f} — below usable retrieval confidence."


def main():
    retriever = get_retriever()
    lines = [
        "# Retrieval Evaluation Benchmark Report",
        "",
        "## How this report was produced",
        "This file is **generated**, not hand-written. It is produced by "
        "`evaluation/run_retrieval_tests.py`, which sends each query below into "
        "`knowledge-base/local_retriever.py` (an offline TF-IDF retriever over the actual "
        "files in `knowledge-base/raw/`) and records the real top match, its real cosine "
        "similarity score, and the wall-clock retrieval latency measured for that call. "
        "Re-run the script after any change to the knowledge base to regenerate this table.",
        "",
        "> **Note on embedding model.** Production retrieval (`services/rag-service/main.py`) "
        "is designed around Gemini `gemini-embedding-001` (3072-d dense vectors) for semantic "
        "matching. This sandbox has no network route to Google's embedding API, so the report "
        "below uses a TF-IDF/cosine fallback as a verifiable stand-in — the retrieval *contract* "
        "(chunk → source → score → citation) is identical, but absolute scores are not directly "
        "comparable to dense-embedding cosine scores and will typically be lower for "
        "paraphrased/non-lexical queries. See `README.md` → Environment Notes.",
        "",
        "## Evaluation Queries Matrix",
        "",
        "| ID | User Query | Category | Retrieved Source | Chunk ID | Score | Latency | Verdict |",
        "|---|---|---|---|---|---|---|---|",
    ]

    detail_sections = []
    latencies = []

    for i, (query, category) in enumerate(QUERIES, start=1):
        t0 = time.perf_counter()
        results = retriever.query(query, top_k=3)
        latency_ms = (time.perf_counter() - t0) * 1000
        latencies.append(latency_ms)
        verdict, reason = verdict_for(results)
        top = results[0] if results else None
        lines.append(
            f"| Q{i} | {query} | {category} | "
            f"{top['source'] if top else '—'} | {top['chunk_id'] if top else '—'} | "
            f"{top['score'] if top else 0:.3f} | {latency_ms:.2f} ms | {verdict} |"
        )
        detail_sections.append(
            f"### Q{i} — {query}\n\n"
            f"- **Category under test:** {category}\n"
            f"- **Verdict:** {verdict}\n"
            f"- **Why:** {reason}\n"
            f"- **Top-3 retrieved chunks:**\n"
            + "\n".join(
                f"  {j+1}. `{r['source']}` (chunk `{r['chunk_id']}`, score {r['score']:.3f}, "
                f"market: {r['market']}, PII redacted: {r['pii_redacted']}) — "
                f"\"{r['text'][:160].strip()}...\""
                for j, r in enumerate(results)
            ) if results else "  (none retrieved)"
        )

    lines.append("")
    lines.append("## Per-query detail (retrieved text + source reference)")
    lines.append("")
    lines.extend(detail_sections)
    lines.append("")
    lines.append("## Aggregate retrieval latency (this run, offline TF-IDF path)")
    lines.append("")
    lines.append(f"- Queries run: {len(latencies)}")
    lines.append(f"- Min: {min(latencies):.2f} ms")
    lines.append(f"- Max: {max(latencies):.2f} ms")
    lines.append(f"- Mean: {sum(latencies)/len(latencies):.2f} ms")
    lines.append("")
    lines.append(
        "These are real measurements of this offline fallback path on this machine, "
        "not the production Gemini-embedding path. They demonstrate the retrieval, "
        "citation, and scoring *mechanism* end-to-end."
    )

    out_path = Path(__file__).parent / "retrieval_tests.md"
    out_path.write_text("\n".join(lines))
    print(f"Wrote {out_path} ({len(latencies)} real queries executed)")


if __name__ == "__main__":
    main()
