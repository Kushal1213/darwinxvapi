import json
import tempfile
import unittest
from pathlib import Path

from grounding_eval import DEFAULT_CORPUS, DEFAULT_MANIFEST, run_evaluation


class GroundingEvaluationTests(unittest.TestCase):
    def test_fixture_manifest_passes_and_reports_denominators(self):
        report = run_evaluation(DEFAULT_MANIFEST, DEFAULT_CORPUS)
        self.assertEqual(report["totals"], {"cases": 6, "passed": 6, "failed": 0})
        by_id = {case["id"]: case for case in report["cases"]}
        self.assertEqual(by_id["answer-india-loan-documents"]["sources"], ["fixture-india-loan-policy"])
        self.assertEqual(by_id["abstain-unpublished-source"]["action"], "abstain")
        self.assertEqual(by_id["abstain-wrong-market"]["retrieved_count"], 0)

    def test_manifest_failures_are_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
            manifest["cases"][0]["expected_sources"] = ["missing-source"]
            path = Path(directory) / "manifest.json"
            path.write_text(json.dumps(manifest), encoding="utf-8")
            report = run_evaluation(path, DEFAULT_CORPUS)
        self.assertEqual(report["totals"]["failed"], 1)
        self.assertIn("missing expected sources", report["cases"][0]["failures"][0])


if __name__ == "__main__":
    unittest.main()
