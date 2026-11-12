from __future__ import annotations


def unique_slugs(hits: list[dict], limit: int | None = None) -> list[str]:
    seen: list[str] = []
    for hit in hits:
        slug = str(hit.get("slug") or "").strip()
        if not slug or slug in seen:
            continue
        seen.append(slug)
        if limit is not None and len(seen) >= limit:
            break
    return seen


def hit_at_k(ranked: list[str], relevant: list[str], k: int) -> float:
    wanted = {slug for slug in relevant if slug}
    if not wanted:
        return 0.0
    return 1.0 if wanted.intersection(ranked[:k]) else 0.0


def reciprocal_rank(ranked: list[str], relevant: list[str]) -> float:
    wanted = {slug for slug in relevant if slug}
    for index, slug in enumerate(ranked, start=1):
        if slug in wanted:
            return 1.0 / index
    return 0.0


def summarize(rows: list[dict]) -> dict:
    n = len(rows) or 1
    return {
        "cases": len(rows),
        "hit_at_k": round(sum(row["hit"] for row in rows) / n, 4),
        "mrr": round(sum(row["rr"] for row in rows) / n, 4),
    }
