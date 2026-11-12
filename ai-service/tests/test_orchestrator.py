import json

from app.config import Settings
from app.orchestrator import run_turn
from app.schemas import ToolSpec, TurnRequest


async def test_run_turn_executes_tool_then_replies():
    step = {"n": 0}

    async def complete(**kwargs):
        step["n"] += 1
        if step["n"] == 1:
            return {
                "content": "",
                "toolCalls": [
                    {
                        "id": "call_1",
                        "function": {"name": "search_products", "arguments": json.dumps({"searchKey": "cat"})},
                    }
                ],
                "usage": {"total_tokens": 4},
                "model": "test",
            }
        return {"content": "Ada cat di tool.", "toolCalls": [], "usage": {"total_tokens": 2}, "model": "test"}

    async def fake_remote(name, args, **kwargs):
        assert name == "search_products"
        return {"payload": {"data": [{"No": "CAT-1"}]}, "handoff": False}

    import app.orchestrator as orch

    orig = orch.dispatch_tool
    orch.dispatch_tool = fake_remote
    try:
        result = await run_turn(
            TurnRequest(
                message="ada cat?",
                system_prompt="copilot staf",
                tools=[ToolSpec(name="search_products", description="cari produk")],
            ),
            Settings(llm_api_key="x"),
            complete=complete,
        )
    finally:
        orch.dispatch_tool = orig
    assert result.reply == "Ada cat di tool."
    assert result.tool_calls_used[0].name == "search_products"
    assert any("DATA TIDAK TEPERCAYA" in (msg.content or "") for msg in result.appended)
