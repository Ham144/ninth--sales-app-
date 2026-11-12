from rag_eval.metrics import hit_at_k, reciprocal_rank, summarize, unique_slugs


def test_unique_slugs_keeps_first_rank():
    hits = [
        {"slug": "internal-cek-stok"},
        {"slug": "internal-cek-stok"},
        {"slug": "internal-baca-piutang"},
    ]
    assert unique_slugs(hits, limit=5) == ["internal-cek-stok", "internal-baca-piutang"]


def test_hit_and_mrr():
    ranked = ["a", "b", "internal-cek-stok"]
    relevant = ["internal-cek-stok"]
    assert hit_at_k(ranked, relevant, 5) == 1.0
    assert hit_at_k(ranked, relevant, 2) == 0.0
    assert reciprocal_rank(ranked, relevant) == 1 / 3


def test_summarize():
    summary = summarize([{"hit": 1.0, "rr": 1.0}, {"hit": 0.0, "rr": 0.0}])
    assert summary["hit_at_k"] == 0.5
    assert summary["mrr"] == 0.5
