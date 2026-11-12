from __future__ import annotations

from typing import Any

import httpx

from app.config import Settings
from app.retrieve import retrieve
from app.schemas import RetrieveResponse


async def execute_remote_tool(
    *,
    settings: Settings,
    name: str,
    args: dict[str, Any],
    customer_id: str | None,
    callback_url: str,
) -> dict[str, Any]:
    headers = {"Content-Type": "application/json"}
    if settings.ai_service_key:
        headers["X-AI-Service-Key"] = settings.ai_service_key
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.post(
                callback_url,
                headers=headers,
                json={"name": name, "args": args, "customerId": customer_id},
            )
            data = response.json()
    except Exception:
        return {"payload": {"error": "data tidak tersedia"}, "handoff": False}
    if response.status_code >= 400:
        return {"payload": data if isinstance(data, dict) else {"error": "tool gagal"}, "handoff": False}
    if isinstance(data, dict) and "payload" in data:
        return {"payload": data.get("payload"), "handoff": bool(data.get("handoff"))}
    return {"payload": data, "handoff": False}


def knowledge_from_retrieve(result: RetrieveResponse, q: str) -> dict:
    return {
        "query": q,
        "mode": result.mode,
        "data": [row.model_dump() for row in result.data],
        "note": result.note,
    }


def execute_local_knowledge(settings: Settings, args: dict[str, Any], visibility: str | None) -> dict:
    q = str(args.get("q") or "").strip()
    if len(q) < 2:
        return {"error": "q minimal 2 karakter"}
    result = retrieve(settings, q, top_k=settings.top_k, visibility=visibility)
    return knowledge_from_retrieve(result, q)
