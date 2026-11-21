from app.guardrails import (
    knowledge_prefetch,
    looks_like_tool_markup,
    present_reply,
    sales_order_lookup,
    synthesize_reply_from_tools,
    wrap_tool_result,
)


def test_wrap_marks_untrusted():
    wrapped = wrap_tool_result("search_products", {"observedAt": "x", "No": "A"})
    assert "DATA TIDAK TEPERCAYA" in wrapped
    assert "observedAt" not in wrapped
    assert "A" in wrapped


def test_present_reply_strips_timestamps():
    assert "2026" not in present_reply("Ada stok. 2026-11-12T02:00:00.000Z")


def test_present_reply_strips_medical_team():
    raw = (
        "Saya tidak memiliki informasi tentang efek samping medis. "
        "Untuk informasi mengenai produk CSI yang berhubungan dengan kesehatan, "
        "Anda dapat menghubungi bagian customer service atau tim medis kami."
    )
    shown = present_reply(raw)
    assert "tim medis" not in shown.lower()
    assert "tidak memiliki informasi" in shown.lower()


def test_present_reply_drops_tool_markup():
    raw = '<|DSML|function_calls><|DSML|invoke name="product_info">'
    assert looks_like_tool_markup(raw)
    assert present_reply(raw) == ""


def test_synthesize_reply_from_tools():
    messages = [
        {
            "role": "tool",
            "toolName": "search_products",
            "content": wrap_tool_result(
                "search_products",
                {"data": [{"No": "BF08A", "Description": "Kipas", "Unit_Price": 1}], "message": "ok"},
            ),
        }
    ]
    out = synthesize_reply_from_tools(messages)
    assert "BF08A" in out
    assert "Kipas" in out


def test_sales_order_lookup():
    assert sales_order_lookup("invoice CSI-2026-00110")["query"] == "CSI-2026-00110"
    assert sales_order_lookup("status NAV SO/SMD-25/08-00027")["liveStatus"] is True
    assert sales_order_lookup("halo") is None


def test_knowledge_prefetch_email_beats_customer_vocab():
    hit = knowledge_prefetch("customer putra_as@indo.net.id itu npwp nya apa ?")
    assert hit == {"q": "putra_as@indo.net.id"}
    assert knowledge_prefetch("customer C110 di Jakarta") is None
    assert knowledge_prefetch("Printer E0290 acquisition_date")["q"]
