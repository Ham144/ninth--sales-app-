from __future__ import annotations

import re
import time

import httpx
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.config import Settings
from app.schemas import Passage, RetrieveResponse

# Table-heavy knowledge needs several rows back, not one howto blurb.
CHUNKS_PER_DOC = {"howto": 6, "technical": 8}

EMAIL_RE = re.compile(r"\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b", re.I)
ASSET_CODE_RE = re.compile(r"\bE0\d{3,}\b", re.I)


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


def exact_needles(q: str) -> list[str]:
    source = str(q or "").strip()
    if not source:
        return []
    out: list[str] = []
    for match in EMAIL_RE.finditer(source):
        out.append(match.group(0))
    for match in ASSET_CODE_RE.finditer(source):
        out.append(match.group(0))
    # Unique-ish tokens (sku-like) when query is short / lookup-shaped.
    if len(source) <= 80 and ("@" in source or ASSET_CODE_RE.search(source)):
        return out
    return out


def _collapse(hits: list[dict], top_k: int) -> list[dict]:
    by_slug: dict[str, list[dict]] = {}
    for hit in hits:
        slug = str(hit.get("slug") or "")
        by_slug.setdefault(slug, []).append(hit)
    docs = []
    for slug, group in by_slug.items():
        group.sort(key=lambda row: (-float(row.get("score") or 0), -len(str(row.get("text") or ""))))
        # Prefer exact rows: keep all exact-scored chunks up to allowed.
        allowed = CHUNKS_PER_DOC.get(group[0].get("docType") or "howto", 6)
        docs.append({"best": float(group[0].get("score") or 0), "chunks": group[:allowed]})
    docs.sort(key=lambda row: -row["best"])
    out = []
    for doc in docs[:top_k]:
        out.extend(doc["chunks"])
    return out


def _payload_hit(payload: dict, score: float) -> dict:
    return {
        "slug": payload.get("slug") or "",
        "title": payload.get("title") or "",
        "docType": payload.get("docType") or "howto",
        "visibility": payload.get("visibility"),
        "score": score,
        "text": str(payload.get("text") or "")[:1200],
    }


def _exact_scroll(
    client: QdrantClient,
    collection: str,
    needles: list[str],
    visibility: str | None,
    limit: int = 2000,
) -> list[dict]:
    if not needles:
        return []
    query_filter = None
    if visibility:
        query_filter = qmodels.Filter(
            must=[qmodels.FieldCondition(key="visibility", match=qmodels.MatchValue(value=visibility))]
        )
    needles_l = [n.lower() for n in needles]
    hits: list[dict] = []
    offset = None
    scanned = 0
    while scanned < limit:
        records, offset = client.scroll(
            collection_name=collection,
            scroll_filter=query_filter,
            limit=min(256, limit - scanned),
            offset=offset,
            with_payload=True,
            with_vectors=False,
        )
        if not records:
            break
        scanned += len(records)
        for point in records:
            payload = point.payload or {}
            text = str(payload.get("text") or "")
            text_l = text.lower()
            if any(n in text_l for n in needles_l):
                hits.append(_payload_hit(payload, 10.0))
        if offset is None:
            break
    return hits


def retrieve(settings: Settings, q: str, top_k: int = 5, visibility: str | None = None) -> RetrieveResponse:
    started = time.perf_counter()
    client = QdrantClient(url=settings.qdrant_url, prefer_grpc=False)
    needles = exact_needles(q)
    exact_hits = []
    try:
        exact_hits = _exact_scroll(client, settings.qdrant_collection, needles, visibility)
    except Exception:
        exact_hits = []

    vector_hits: list[dict] = []
    try:
        vector = _embed(settings, q)
        query_filter = None
        if visibility:
            query_filter = qmodels.Filter(
                must=[qmodels.FieldCondition(key="visibility", match=qmodels.MatchValue(value=visibility))]
            )
        result = client.query_points(
            collection_name=settings.qdrant_collection,
            query=vector,
            query_filter=query_filter,
            limit=max(top_k * 12, 24),
            with_payload=True,
        )
        for point in result.points:
            vector_hits.append(_payload_hit(point.payload or {}, float(point.score or 0)))
    except Exception:
        if not exact_hits:
            return RetrieveResponse(
                query=q,
                mode="empty",
                data=[],
                note="Retrieval gagal.",
                latency_ms=int((time.perf_counter() - started) * 1000),
            )

    # Exact rows first so collapse keeps them despite weak embedding scores.
    collapsed = _collapse([*exact_hits, *vector_hits], top_k)
    # Dedupe identical text
    seen = set()
    unique = []
    for row in collapsed:
        key = f"{row.get('slug')}:{str(row.get('text') or '')[:96]}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    passages = [
        Passage(
            slug=row["slug"],
            title=row["title"],
            visibility=row.get("visibility"),
            score=round(float(row.get("score") or 0), 4),
            text=row.get("text") or "",
        )
        for row in unique
        if row.get("slug")
    ]
    if passages:
        mode = "vector"
        note = (
            "Cuplikan exact + semantik dari Knowledge."
            if exact_hits
            else "Cuplikan panduan dari retrieval semantik."
        )
    else:
        mode = "empty"
        note = "Tidak ada cuplikan."
    return RetrieveResponse(
        query=q,
        mode=mode,
        data=passages,
        note=note,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
