from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

REGISTRY_PATH = Path(__file__).resolve().parents[1] / "registry" / "catalog.json"


class ToolDef(BaseModel):
    name: str
    description: str = ""
    kind: str = "http"
    method: str = "POST"
    path: str = ""
    timeout_ms: int = 8000
    parameters: dict[str, Any] = Field(default_factory=lambda: {"type": "object", "properties": {}})
    visibility: str | None = None


class AppDef(BaseModel):
    id: str
    title: str
    enabled: bool = False
    base_url_env: str = "MIDCSI_BASE_URL"
    default_base_url: str = ""
    wave: int = 1
    note: str = ""
    tools: list[ToolDef] = Field(default_factory=list)


class Catalog(BaseModel):
    apps: list[AppDef]


@lru_cache
def load_catalog() -> Catalog:
    raw = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return Catalog.model_validate(raw)


def enabled_apps() -> list[AppDef]:
    return [app for app in load_catalog().apps if app.enabled]


def all_apps() -> list[AppDef]:
    return list(load_catalog().apps)


def tool_map() -> dict[str, tuple[AppDef, ToolDef]]:
    mapping: dict[str, tuple[AppDef, ToolDef]] = {}
    for app in enabled_apps():
        for tool in app.tools:
            mapping[tool.name] = (app, tool)
    return mapping


def get_tool(name: str) -> tuple[AppDef, ToolDef] | None:
    return tool_map().get(name)


def specs_for_turn(requested: list[str] | None) -> list[dict]:
    """Hub may send a MIDCSI subset; other enabled apps stay on the turn."""
    catalog = openai_tool_specs()
    if not requested:
        return catalog
    wanted = set(requested)
    out: list[dict] = []
    for spec in catalog:
        name = spec["function"]["name"]
        pair = get_tool(name)
        if not pair:
            continue
        app, _ = pair
        if app.id == "midcsi":
            if name in wanted:
                out.append(spec)
        else:
            out.append(spec)
    return out


def openai_tool_specs(names: list[str] | None = None) -> list[dict]:
    mapping = tool_map()
    selected = names or list(mapping)
    specs = []
    for name in selected:
        pair = mapping.get(name)
        if not pair:
            continue
        _, tool = pair
        specs.append(
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters or {"type": "object", "properties": {}},
                },
            }
        )
    return specs
