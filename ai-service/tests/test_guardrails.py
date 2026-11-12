from app.guardrails import present_reply, sales_order_lookup, wrap_tool_result


def test_wrap_marks_untrusted():
    wrapped = wrap_tool_result("search_products", {"observedAt": "x", "No": "A"})
    assert "DATA TIDAK TEPERCAYA" in wrapped
    assert "observedAt" not in wrapped
    assert "A" in wrapped


def test_present_reply_strips_timestamps():
    assert "2026" not in present_reply("Ada stok. 2026-11-12T02:00:00.000Z")


def test_sales_order_lookup():
    assert sales_order_lookup("invoice CSI-2026-00110")["query"] == "CSI-2026-00110"
    assert sales_order_lookup("status NAV SO/SMD-25/08-00027")["liveStatus"] is True
    assert sales_order_lookup("halo") is None
