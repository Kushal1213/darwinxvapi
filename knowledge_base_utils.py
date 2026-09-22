"""Shared helper so scripts under evaluation/ can import the retriever
without path headaches, and so it's only built (indexed) once per process."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "knowledge-base"))
from local_retriever import LocalRetriever  # noqa: E402

_retriever = None


def get_retriever() -> LocalRetriever:
    global _retriever
    if _retriever is None:
        _retriever = LocalRetriever()
    return _retriever
