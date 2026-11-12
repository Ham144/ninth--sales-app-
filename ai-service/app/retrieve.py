from __future__ import annotations

import time

import httpx
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import Settings
from app.schemas import Passage, RetrieveResponse

CHUNKS_PER_DOC = {"howto": 1, "technical": 4}


def _embed(settings: Settings, text: str) -> list[float]:
    base = (settings.embedding_base_url or settings.llm_base_url).rstrip("/")
    key = settings.embedding_api_key or settings.llm_api_key
    if not key:
        raise RuntimeError("embedding API key kosong")
    response = httpx.post(
        f"{base}/embeddings",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={"model": settings.embedding_model, "input": text},
        timeout=60.0,
    )
    response.raise_for_status()
    data = response.json().get("data") or []
    if not data or not data[0].get("embedding"):
        raise RuntimeError("embedding kosong")
    return data[0]["embedding"]


def _collapse(hits: list[dict], top_k: int) -> list[dict]:
    by_slug: dict[str, list[dict]] = {}
    for hit in hits:
        slug = str(hit.get("slug") or "")
        by_slug.setdefault(slug, []).append(hit)
    docs = []
    for slug, group in by_slug.items():
        group.sort(key=lambda row: (-float(row.get("score") or 0), -len(str(row.get("text") or ""))))
        allowed = CHUNKS_PER_DOC.get(group[0].get("docType") or "howto", 1)
        docs.append({"best": float(group[0].get("score") or 0), "chunks": group[:allowed]})
    docs.sort(key=lambda row: -row["best"])
    out = []
    for doc in docs[:top_k]:
        out.extend(doc["chunks"])
    return out


def retrieve(settings: Settings, q: str, top_k: int = 5, visibility: str | None = None) -> RetrieveResponse:
    started = time.perf_counter()
    try:
        vector = _embed(settings, q)
    except Exception:
        return RetrieveResponse(
            query=q,
            mode="empty",
            data=[],
            note="Embedding gagal.",
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
    client = QdrantClient(url=settings.qdrant_url, prefer_grpc=False)
    query_filter = None
    if visibility:
        query_filter = qmodels.Filter(
            must=[qmodels.FieldCondition(key="visibility", match=qmodels.MatchValue(value=visibility))]
        )
    try:
        result = client.query_points(
            collection_name=settings.qdrant_collection,
            query=vector,
            query_filter=query_filter,
            limit=max(top_k * 8, 10),
            with_payload=True,
        )
    except Exception:
        return RetrieveResponse(
            query=q,
            mode="empty",
            data=[],
            note="Qdrant tidak terjangkau.",
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
    hits = []
    for point in result.points:
        payload = point.payload or {}
        hits.append(
            {
                "slug": payload.get("slug") or "",
                "title": payload.get("title") or "",
                "docType": payload.get("docType") or "howto",
                "visibility": payload.get("visibility"),
                "score": point.score or 0,
                "text": str(payload.get("text") or "")[:1200],
            }
        )
    collapsed = _collapse(hits, top_k)
    passages = [
        Passage(
            slug=row["slug"],
            title=row["title"],
            visibility=row.get("visibility"),
            score=round(float(row.get("score") or 0), 4),
            text=row.get("text") or "",
        )
        for row in collapsed
        if row.get("slug")
    ]
    mode = "vector" if passages else "empty"
    return RetrieveResponse(
        query=q,
        mode=mode,
        data=passages,
        note="Cuplikan panduan dari retrieval semantik." if passages else "Tidak ada cuplikan.",
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
