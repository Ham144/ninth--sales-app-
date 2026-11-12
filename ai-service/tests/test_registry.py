from unittest.mock import AsyncMock, MagicMock, patch

from app.config import Settings
from app.http_tools import _safe_url, execute_http, resolve_base_url
from app.registry import all_apps, enabled_apps, get_tool, load_catalog, specs_for_turn


def setup_module():
    load_catalog.cache_clear()


def test_catalog_enables_midcsi_and_petty_cash():
    ids = {app.id for app in all_apps()}
    assert "midcsi" in ids
    assert "petty-cash" in ids
    assert "catur-pos" in ids
    assert "s-bit" in ids
    enabled = {app.id for app in enabled_apps()}
    assert enabled == {"midcsi", "petty-cash"}


def test_midcsi_search_products_is_http_path():
    pair = get_tool("search_products")
    assert pair
    app, tool = pair
    assert app.id == "midcsi"
    assert tool.kind == "http"
    assert tool.path.endswith("/search_products")
    assert get_tool("petty_cash_list") is None


def test_petty_cash_tools_hit_nest_not_hub():
    pair = get_tool("petty_cash_warehouses")
    assert pair
    app, tool = pair
    assert app.id == "petty-cash"
    assert tool.kind == "http"
    assert tool.path == "/api/apps/petty-cash/tools/petty_cash_warehouses"
    assert get_tool("petty_cash_logs")
    assert get_tool("petty_cash_analytics")
    assert get_tool("petty_cash_categories")
    assert get_tool("petty_cash_budget")
    assert get_tool("petty_cash_create") is None
    assert all("/flow-log/new" not in (tool.path or "") for tool in app.tools)
    settings = Settings(petty_cash_base_url="http://127.0.0.1:3001")
    assert resolve_base_url(app, settings) == "http://127.0.0.1:3001"
    fallback = resolve_base_url(app, Settings(petty_cash_base_url=""))
    assert fallback == "http://192.168.169.20"


def test_hub_midcsi_subset_keeps_petty_cash_tools():
    names = {spec["function"]["name"] for spec in specs_for_turn(["search_products"])}
    assert "search_products" in names
    assert "product_detail" not in names
    assert "petty_cash_warehouses" in names
    assert "petty_cash_logs" in names


def test_http_path_cannot_escape_origin():
    url = _safe_url("http://127.0.0.1:7047", "/api/v1/apps/midcsi/tools/search_products")
    assert url.startswith("http://127.0.0.1:7047/")
    try:
        _safe_url("http://127.0.0.1:7047", "https://evil.example/x")
        assert False
    except ValueError:
        pass


async def test_execute_http_posts_service_key_to_petty_cash():
    app, tool = get_tool("petty_cash_warehouses")
    settings = Settings(petty_cash_base_url="http://127.0.0.1:3001", ai_service_key="k")
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"payload": {"data": [{"id": "w1", "name": "SMD"}]}}
    holder = {}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            holder["client"] = self
            self.request = AsyncMock(return_value=response)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

    with patch("app.http_tools.httpx.AsyncClient", FakeClient):
        result = await execute_http(app, tool, {"searchKey": "smd"}, settings)
    assert result["payload"]["data"][0]["name"] == "SMD"
    method, url = holder["client"].request.call_args.args[:2]
    assert method == "POST"
    assert url == "http://127.0.0.1:3001/api/apps/petty-cash/tools/petty_cash_warehouses"
    assert holder["client"].request.call_args.kwargs["headers"]["X-AI-Service-Key"] == "k"
