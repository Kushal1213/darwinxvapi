"""Provider-free grounding evaluation runner for Veyra RAG behavior."""
from __future__ import annotations

import argparse
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "evaluation" / "grounding_manifest.json"
DEFAULT_CORPUS = ROOT / "evaluation" / "grounding_corpus.json"


def load_rag_module():
    path = ROOT / "services" / "rag-service" / "main.py"
    spec = importlib.util.spec_from_file_location("veyra_rag_eval", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def source_names(chunks: list[dict]) -> list[str]:
    return [chunk.get("source", "") for chunk in chunks]


def evaluate_case(rag, case: dict, corpus: list[dict]) -> dict:
    failures = []
    product = case.get("product")
    try:
        market = rag.canonical_market(case["market"])
    except ValueError as exc:
        return {
            "id": case.get("id"),
            "passed": False,
            "failures": [str(exc)],
            "action": "error",
            "sources": [],
            "retrieval_mode": "fixture-lexical",
            "abstention_reason": "invalid_market",
        }

    candidates = rag.lexical_candidates(case["question"], market, corpus, product)
    chunks = rag.select_market_chunks(candidates, market, int(case.get("top_k", 2)), product)
    answer = rag.synthesize_direct_knowledge_answer(case["question"], chunks) if chunks else "I don't have that specific detail in my knowledge base."
    reason = "no_eligible_candidates" if not chunks else rag.abstention_reason(answer)
    action = "abstain" if reason else "answer"
    sources = [] if reason else source_names(chunks)

    if action != case["expected_action"]:
        failures.append(f"expected action {case['expected_action']}, got {action}")

    expected_sources = set(case.get("expected_sources", []))
    if expected_sources and not expected_sources.issubset(set(sources)):
        missing = sorted(expected_sources - set(sources))
        failures.append("missing expected sources: " + ", ".join(missing))

    forbidden_sources = set(case.get("forbidden_sources", []))
    leaked_sources = sorted(forbidden_sources & set(sources))
    if leaked_sources:
        failures.append("returned forbidden sources: " + ", ".join(leaked_sources))

    forbidden_markets = set(case.get("forbidden_markets", []))
    returned_markets = {chunk.get("market", "") for chunk in chunks if not reason}
    leaked_markets = sorted(forbidden_markets & returned_markets)
    if leaked_markets:
        failures.append("returned forbidden markets: " + ", ".join(leaked_markets))

    return {
        "id": case["id"],
        "passed": not failures,
        "failures": failures,
        "action": action,
        "sources": sources,
        "retrieved_count": 0 if reason else len(chunks),
        "retrieval_mode": "fixture-lexical",
        "abstention_reason": reason,
        "risk_category": case.get("risk_category"),
        "reviewer": case.get("reviewer"),
    }


def run_evaluation(manifest_path: Path = DEFAULT_MANIFEST, corpus_path: Path = DEFAULT_CORPUS) -> dict:
    rag = load_rag_module()
    manifest = load_json(manifest_path)
    corpus = load_json(corpus_path)
    results = [evaluate_case(rag, case, corpus) for case in manifest["cases"]]
    passed = sum(1 for result in results if result["passed"])
    failed = len(results) - passed
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest": str(manifest_path),
        "corpus": str(corpus_path),
        "version": manifest.get("version"),
        "mode": manifest.get("mode", "fixture-lexical"),
        "totals": {"cases": len(results), "passed": passed, "failed": failed},
        "cases": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Veyra grounding evaluation manifest.")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    report = run_evaluation(args.manifest, args.corpus)
    text = json.dumps(report, indent=2)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text + "\n", encoding="utf-8")
    print(text)
    return 0 if report["totals"]["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
