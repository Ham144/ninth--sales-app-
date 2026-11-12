from __future__ import annotations

import httpx


def embed_query(text: str, *, base_url: str, api_key: str, model: str) -> list[float]:
    if not base_url or not api_key:
        raise SystemExit("EMBEDDING_BASE_URL/LLM_BASE_URL dan API key wajib untuk eval")
    response = httpx.post(
        f"{base_url}/embeddings",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "input": text},
        timeout=60.0,
    )
    response.raise_for_status()
    data = response.json().get("data") or []
    if not data or not data[0].get("embedding"):
        raise RuntimeError("embedding kosong")
    return data[0]["embedding"]
