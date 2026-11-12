from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.orchestrator import run_turn
from app.registry import all_apps, enabled_apps, tool_map
from app.retrieve import retrieve
from app.schemas import RetrieveRequest, RetrieveResponse, TurnRequest, TurnResult

app = FastAPI(
    title="MIDCSI AI service",
    version="0.1.0",
    description="RAG + tool-calling center. Apps register HTTP tools; MIDCSI is provider #1, petty-cash is provider #2.",
)


def require_key(
    x_ai_service_key: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if settings.ai_service_key and x_ai_service_key != settings.ai_service_key:
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health")
def health(settings: Settings = Depends(get_settings)):
    qdrant = "unknown"
    try:
        from qdrant_client import QdrantClient

        client = QdrantClient(url=settings.qdrant_url, prefer_grpc=False)
        info = client.get_collection(settings.qdrant_collection)
        qdrant = f"ok:{info.points_count}"
    except Exception as exc:
        qdrant = f"error:{exc.__class__.__name__}"
    return {
        "ok": True,
        "service": "midcsi-ai",
        "qdrant": qdrant,
        "has_llm_key": bool(settings.llm_api_key),
        "apps_enabled": [app.id for app in enabled_apps()],
        "apps_registered": len(all_apps()),
    }


@app.get("/v1/apps", dependencies=[Depends(require_key)])
def list_apps():
    return {
        "apps": [
            {
                "id": app.id,
                "title": app.title,
                "enabled": app.enabled,
                "wave": app.wave,
                "note": app.note,
                "tools": [tool.name for tool in app.tools],
            }
            for app in all_apps()
        ],
        "enabled_tools": list(tool_map()),
    }


@app.post("/v1/retrieve", response_model=RetrieveResponse, dependencies=[Depends(require_key)])
def retrieve_route(body: RetrieveRequest, settings: Settings = Depends(get_settings)):
    return retrieve(settings, body.q, top_k=body.top_k, visibility=body.visibility)


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _turn_payload(result: TurnResult) -> dict:
    return {
        "reply": result.reply,
        "appended": [msg.model_dump(by_alias=True) for msg in result.appended],
        "toolCallsUsed": [call.model_dump() for call in result.tool_calls_used],
        "tokensUsed": result.tokens_used,
        "handoffRequested": result.handoff_requested,
        "model": result.model,
        "action": result.action,
        "latencyMs": result.latency_ms,
        "llmError": result.llm_error,
    }


@app.post("/v1/turn", response_model=TurnResult, dependencies=[Depends(require_key)])
async def turn_json(body: TurnRequest, settings: Settings = Depends(get_settings)):
    return await run_turn(body, settings)


@app.post("/v1/turn/stream", dependencies=[Depends(require_key)])
async def turn_stream(body: TurnRequest, settings: Settings = Depends(get_settings)):
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def on_event(event: str, data: dict) -> None:
        await queue.put(_sse(event, data))

    async def run() -> None:
        try:
            result = await run_turn(body, settings, on_event=on_event)
            await queue.put(_sse("done", _turn_payload(result)))
        except Exception as exc:
            await queue.put(_sse("error", {"message": str(exc)[:300]}))
        finally:
            await queue.put(None)

    async def generate() -> AsyncIterator[str]:
        task = asyncio.create_task(run())
        try:
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break
                yield chunk
        finally:
            await task

    return StreamingResponse(generate(), media_type="text/event-stream")
