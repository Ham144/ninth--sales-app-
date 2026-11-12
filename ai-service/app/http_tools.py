from __future__ import annotations

from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from app.config import Settings
from app.registry import AppDef, ToolDef, get_tool
from app.tools_client import execute_local_knowledge


def resolve_base_url(app: AppDef, settings: Settings) -> str:
    env_val = getattr(settings, app.base_url_env.lower(), None) if app.base_url_env else None
    # pydantic-settings: midcsi_base_url
    mapped = {
        "MIDCSI_BASE_URL": settings.midcsi_base_url,
        "PETTY_CASH_BASE_URL": settings.petty_cash_base_url,
    }
    url = str(mapped.get(app.base_url_env) or env_val or app.default_base_url or settings.midcsi_base_url)
    return url.rstrip("/")


def _safe_url(base: str, path: str) -> str:
    if not path.startswith("/") or path.startswith("//") or "://" in path:
        raise ValueError("path tool tidak valid")
    parsed = urlparse(base)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("base_url tidak valid")
    joined = urljoin(base + "/", path.lstrip("/"))
    if urlparse(joined).netloc != parsed.netloc:
        raise ValueError("path tool keluar dari origin")
    return joined


async def execute_http(app: AppDef, tool: ToolDef, args: dict[str, Any], settings: Settings) -> dict[str, Any]:
    url = _safe_url(resolve_base_url(app, settings), tool.path)
    headers = {"Content-Type": "application/json"}
    if settings.ai_service_key:
        headers["X-AI-Service-Key"] = settings.ai_service_key
    timeout = max(tool.timeout_ms, 1000) / 1000
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(tool.method.upper(), url, json=args, headers=headers)
            data = response.json()
            if response.status_code >= 400:
                return {
                    "payload": {
                        "error": "data tidak tersedia",
                        "appId": app.id,
                        "tool": tool.name,
                        "status": response.status_code,
                    },
                    "handoff": False,
                }
    except Exception:
        return {"payload": {"error": "data tidak tersedia", "appId": app.id, "tool": tool.name}, "handoff": False}
    if isinstance(data, dict) and "payload" in data:
        return {"payload": data.get("payload"), "handoff": bool(data.get("handoff"))}
    return {"payload": data, "handoff": False}


async def dispatch_tool(
    name: str,
    args: dict[str, Any],
    *,
    settings: Settings,
    visibility: str | None = None,
) -> dict[str, Any]:
    pair = get_tool(name)
    if not pair:
        return {"payload": {"error": "Tool tidak dikenal", "name": name}, "handoff": False}
    app, tool = pair
    if tool.kind == "qdrant":
        vis = tool.visibility or visibility
        payload = execute_local_knowledge(settings, args, vis)
        return {"payload": payload, "handoff": False}
    if tool.kind == "handoff":
        return {"payload": {"accepted": True, "reason": str(args.get("reason") or "")}, "handoff": True}
    if tool.kind != "http":
        return {"payload": {"error": "jenis tool tidak didukung", "kind": tool.kind}, "handoff": False}
    return await execute_http(app, tool, args, settings)
