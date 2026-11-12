from __future__ import annotations

import json
import time
from collections.abc import Awaitable, Callable
from datetime import datetime, timezone
from typing import Any

from app.config import Settings
from app.guardrails import (
    action_from_messages,
    expand_empty_tool_reply,
    present_reply,
    sales_order_lookup,
    wrap_tool_result,
)
from app.llm import complete_chat, resolve_model, to_llm_messages, window_messages
from app.http_tools import dispatch_tool
from app.registry import specs_for_turn
from app.schemas import ChatMessage, ToolCallUsed, TurnRequest, TurnResult


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_args(raw: Any) -> dict:
    if isinstance(raw, dict):
        return dict(raw)
    try:
        parsed = json.loads(raw or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _dump_message(msg: dict) -> ChatMessage:
    return ChatMessage.model_validate(
        {
            "role": msg.get("role"),
            "content": msg.get("content") or "",
            "context": msg.get("context"),
            "toolCallId": msg.get("toolCallId") or msg.get("tool_call_id"),
            "toolName": msg.get("toolName") or msg.get("tool_name"),
            "toolCalls": msg.get("toolCalls") or msg.get("tool_calls"),
        }
    )


async def run_turn(
    request: TurnRequest,
    settings: Settings,
    on_event: Callable[[str, dict], Awaitable[None] | None] | None = None,
    complete=None,
) -> TurnResult:
    started = time.perf_counter()
    history = [msg.model_dump(by_alias=True) for msg in request.history]
    if not history or history[-1].get("role") != "user" or history[-1].get("content") != request.message:
        history.append({"role": "user", "content": request.message, "createdAt": _now()})
    requested = [tool.name for tool in request.tools] if request.tools else None
    spec_tools = specs_for_turn(requested)
    tools_by_name = {spec["function"]["name"]: True for spec in spec_tools}
    complete_fn = complete or complete_chat
    model, fallback = resolve_model(settings, request.model_mode)
    timeout_ms = 60000 if request.model_mode == "kuat" else 30000
    tokens_used = 0
    tool_calls_used: list[ToolCallUsed] = []
    reply = ""
    handoff = False
    used_model = model
    llm_error = None
    streamed = False

    async def emit(event: str, data: dict) -> None:
        nonlocal streamed
        if event == "token":
            streamed = True
        if on_event:
            maybe = on_event(event, data)
            if hasattr(maybe, "__await__"):
                await maybe

    lookup = sales_order_lookup(request.message)
    if lookup and "sales_orders" in tools_by_name:
        await emit("tool", {"name": "sales_orders"})
        t0 = time.perf_counter()
        result = await dispatch_tool("sales_orders", lookup, settings=settings)
        tool_calls_used.append(
            ToolCallUsed(name="sales_orders", args=lookup, latency_ms=int((time.perf_counter() - t0) * 1000))
        )
        call_id = "order_lookup"
        history.append(
            {
                "role": "assistant",
                "content": "",
                "toolCalls": [
                    {
                        "id": call_id,
                        "type": "function",
                        "function": {"name": "sales_orders", "arguments": json.dumps(lookup)},
                    }
                ],
            }
        )
        history.append(
            {
                "role": "tool",
                "toolCallId": call_id,
                "toolName": "sales_orders",
                "content": wrap_tool_result("sales_orders", result.get("payload")),
            }
        )

    for _ in range(request.max_iter):
        messages = to_llm_messages(request.system_prompt, window_messages(history, request.memory_window))

        async def on_token(piece: str) -> None:
            await emit("token", {"text": piece})

        try:
            completion = await complete_fn(
                settings=settings,
                messages=messages,
                tools=spec_tools,
                model=model,
                timeout_ms=timeout_ms,
                on_token=on_token,
            )
        except Exception as exc:
            if not fallback or fallback == model:
                llm_error = str(exc)
                break
            try:
                completion = await complete_fn(
                    settings=settings,
                    messages=messages,
                    tools=spec_tools,
                    model=fallback,
                    timeout_ms=timeout_ms,
                    on_token=on_token,
                )
            except Exception as inner:
                llm_error = str(inner)
                break
        tokens_used += int((completion.get("usage") or {}).get("total_tokens") or 0)
        used_model = completion.get("model") or model
        calls = completion.get("toolCalls") or []
        if not calls:
            reply = expand_empty_tool_reply(
                present_reply(completion.get("content") or "") or "Saya tidak menemukan jawaban dari data yang tersedia.",
                history,
            )
            history.append({"role": "assistant", "content": reply})
            if not streamed:
                for i in range(0, len(reply), 48):
                    await emit("token", {"text": reply[i : i + 48]})
            break
        history.append({"role": "assistant", "content": completion.get("content") or "", "toolCalls": calls})
        for call in calls:
            fn = call.get("function") or {}
            name = fn.get("name") or call.get("name")
            args = _parse_args(fn.get("arguments") or call.get("arguments"))
            args.pop("customerId", None)
            await emit("tool", {"name": name})
            t0 = time.perf_counter()
            vis = "public" if name == "search_public_knowledge" else request.visibility
            result = await dispatch_tool(name or "", args, settings=settings, visibility=vis)
            if result.get("handoff"):
                handoff = True
            tool_calls_used.append(
                ToolCallUsed(name=name or "", args=args, latency_ms=int((time.perf_counter() - t0) * 1000))
            )
            history.append(
                {
                    "role": "tool",
                    "toolCallId": call.get("id") or f"call_{len(tool_calls_used)}",
                    "toolName": name,
                    "content": wrap_tool_result(name or "unknown", result.get("payload")),
                }
            )

    if not reply:
        reply = "Saya belum bisa menyelesaikan permintaan itu dari data yang tersedia."
        if llm_error:
            reply = "Layanan model sedang tidak bisa menjawab. Silakan coba lagi."
        history.append({"role": "assistant", "content": reply})

    action = action_from_messages(history)
    proposed = any(call.name == "propose_sales_order" for call in tool_calls_used)
    if action and proposed:
        reply = "Draf sales order ada di kartu. Periksa lalu tekan Kirim. Belum terkirim ke NAV."
        history[-1]["content"] = reply

    user_indexes = [i for i, msg in enumerate(history) if msg.get("role") == "user"]
    cut = user_indexes[-1] + 1 if user_indexes else 0
    appended = [_dump_message(msg) for msg in history[cut:]]
    return TurnResult(
        reply=reply,
        appended=appended,
        tool_calls_used=tool_calls_used,
        tokens_used=tokens_used,
        handoff_requested=handoff,
        model=used_model,
        action=action,
        latency_ms=int((time.perf_counter() - started) * 1000),
        llm_error=llm_error,
    )


