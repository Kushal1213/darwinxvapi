"""Small compatibility boundary around the maintained Google Gen AI SDK."""

from google import genai
from google.genai import types


class GeminiProvider:
    """Own one SDK client and expose the narrow contract Veyra needs."""

    def __init__(self):
        self._client = None

    @property
    def configured(self) -> bool:
        return self._client is not None

    def configure(self, api_key: str) -> None:
        self.close()
        if api_key:
            self._client = genai.Client(api_key=api_key)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def embed_content(self, *, model: str, content, task_type: str):
        """Return the legacy-shaped embedding payload used by the index code."""
        if self._client is None:
            raise RuntimeError("Gemini is not configured")
        is_batch = isinstance(content, (list, tuple))
        response = self._client.models.embed_content(
            model=model,
            contents=list(content) if is_batch else content,
            config=types.EmbedContentConfig(
                task_type=task_type.upper(),
                output_dimensionality=3072,
            ),
        )
        embeddings = [embedding.values for embedding in response.embeddings or []]
        if not embeddings:
            raise RuntimeError("Gemini returned no embeddings")
        return {"embedding": embeddings if is_batch else embeddings[0]}

    def generate_content(self, *, model: str, content: str,
                         temperature: float, max_output_tokens: int) -> str:
        if self._client is None:
            raise RuntimeError("Gemini is not configured")
        response = self._client.models.generate_content(
            model=model,
            contents=content,
            config=types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            ),
        )
        return (response.text or "").strip()
