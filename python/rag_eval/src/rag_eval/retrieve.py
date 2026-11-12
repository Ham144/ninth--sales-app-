from __future__ import annotations

from collections import Counter

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels


def client(url: str) -> QdrantClient:
    return QdrantClient(url=url, prefer_grpc=False)


def search(
    qdrant: QdrantClient,
    vector: list[float],
    *,
    collection: str,
    limit: int = 10,
    visibility: str | None = None,
) -> list[dict]:
    query_filter = None
    if visibility:
        query_filter = qmodels.Filter(
            must=[
                qmodels.FieldCondition(
                    key="visibility",
                    match=qmodels.MatchValue(value=visibility),
                )
            ]
        )
    result = qdrant.query_points(
        collection_name=collection,
        query=vector,
        query_filter=query_filter,
        limit=limit,
        with_payload=True,
    )
    hits = []
    for point in result.points:
        payload = point.payload or {}
        hits.append(
            {
                "slug": payload.get("slug"),
                "title": payload.get("title"),
                "docType": payload.get("docType"),
                "visibility": payload.get("visibility"),
                "score": point.score,
            }
        )
    return hits


def inspect_collection(qdrant: QdrantClient, collection: str) -> dict:
    info = qdrant.get_collection(collection)
    slugs: list[str] = []
    vis: list[str] = []
    offset = None
    while True:
        points, offset = qdrant.scroll(
            collection_name=collection,
            limit=100,
            offset=offset,
            with_payload=["slug", "visibility"],
            with_vectors=False,
        )
        for point in points:
            payload = point.payload or {}
            slugs.append(str(payload.get("slug") or ""))
            vis.append(str(payload.get("visibility") or ""))
        if offset is None:
            break
    unique = sorted({slug for slug in slugs if slug})
    return {
        "points": int(info.points_count or 0),
        "status": str(info.status),
        "unique_slugs": unique,
        "slug_count": len(unique),
        "visibility": dict(Counter(vis)),
    }
