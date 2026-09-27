"""Local browser QA only: real service routes with deterministic fake embeddings."""
import importlib.util
import sys
from pathlib import Path
import uvicorn

name = sys.argv[1]
spec = importlib.util.spec_from_file_location(name, Path(__file__).parent / name / 'main.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
if name == 'ingestion-service':
    module.GEMINI_API_KEY = 'browser-fixture-not-a-real-key'
    def embed(**kwargs):
        return {'embedding': [[1.0] + [0.0] * 3071 for _ in kwargs['content']]}
    module.genai.embed_content = embed
uvicorn.run(module.app, host='127.0.0.1', port=int(sys.argv[2]))
