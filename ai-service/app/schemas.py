from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

Role = Literal["user", "assistant", "tool", "system"]
ModelMode = Literal["hemat", "pas", "kuat"]


class ChatMessage(BaseModel):
    role: Role
    content: str = ""
    context: str | None = None
    tool_call_id: str | None = Field(default=None, alias="toolCallId")
    tool_name: str | None = Field(default=None, alias="toolName")
    tool_calls: list[dict[str, Any]] | None = Field(default=None, alias="toolCalls")

    model_config = {"populate_by_name": True, "extra": "ignore"}


class ToolSpec(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = ""
    parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})


class RetrieveRequest(BaseModel):
    q: str = Field(min_length=2, max_length=500)
    top_k: int = Field(default=5, ge=1, le=30)
    visibility: Literal["public", "internal"] | None = None


class Passage(BaseModel):
    slug: str
    title: str = ""
    visibility: str | None = None
    score: float = 0
    text: str = ""


class RetrieveResponse(BaseModel):
    query: str
    mode: Literal["vector", "text", "empty"]
    data: list[Passage]
    note: str
    latency_ms: int = 0


class TurnRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)
    tools: list[ToolSpec] = Field(default_factory=list)
    system_prompt: str = Field(min_length=1)
    max_iter: int = Field(default=4, ge=1, le=8)
    customer_id: str | None = None
    model_mode: ModelMode = "pas"
    visibility: Literal["public", "internal"] | None = None
    tool_callback_url: str | None = None
    memory_window: int = Field(default=12, ge=2, le=40)

    @field_validator("message")
    @classmethod
    def strip_message(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("message wajib")
        return text


class ToolCallUsed(BaseModel):
    name: str
    args: dict[str, Any] = Field(default_factory=dict)
    latency_ms: int = 0


class SalesOrderAction(BaseModel):
    kind: str
    ready: bool = False
    model_config = {"extra": "allow"}


class TurnResult(BaseModel):
    reply: str
    appended: list[ChatMessage]
    tool_calls_used: list[ToolCallUsed]
    tokens_used: int = 0
    handoff_requested: bool = False
    model: str = ""
    action: dict[str, Any] | None = None
    latency_ms: int = 0
    llm_error: str | None = None
