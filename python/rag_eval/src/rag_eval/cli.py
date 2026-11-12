from __future__ import annotations

import argparse
import json
from importlib import resources

from rag_eval.config import settings
from rag_eval.embed import embed_query
from rag_eval.metrics import hit_at_k, reciprocal_rank, summarize, unique_slugs
from rag_eval.retrieve import client, inspect_collection, search


def load_gold() -> list[dict]:
    raw = resources.files("rag_eval").joinpath("gold.json").read_text(encoding="utf-8")
    return json.loads(raw)


def cmd_inspect(_: argparse.Namespace) -> int:
    cfg = settings()
    qdrant = client(cfg["qdrant_url"])
    report = inspect_collection(qdrant, cfg["collection"])
    print(f"Qdrant {cfg['qdrant_url']}  {cfg['collection']}")
    print(f"points={report['points']}  slugs={report['slug_count']}  {report['visibility']}")
    for slug in report["unique_slugs"]:
        print(f"  {slug}")
    return 0


def cmd_eval(args: argparse.Namespace) -> int:
    cfg = settings()
    qdrant = client(cfg["qdrant_url"])
    cases = load_gold()
    if args.id:
        cases = [case for case in cases if case["id"] == args.id]
        if not cases:
            raise SystemExit(f"gold id tidak ada: {args.id}")
    rows = []
    for case in cases:
        vector = embed_query(
            case["query"],
            base_url=cfg["embedding_base_url"],
            api_key=cfg["embedding_api_key"],
            model=cfg["embedding_model"],
        )
        hits = search(
            qdrant,
            vector,
            collection=cfg["collection"],
            limit=max(args.k * 3, 10),
            visibility=args.visibility,
        )
        ranked = unique_slugs(hits, limit=args.k)
        relevant = case["relevant_slugs"]
        row = {
            "id": case["id"],
            "hit": hit_at_k(ranked, relevant, args.k),
            "rr": reciprocal_rank(ranked, relevant),
            "top": ranked,
        }
        rows.append(row)
        mark = "PASS" if row["hit"] else "FAIL"
        print(f"{mark} {case['id']}  rr={row['rr']:.2f}  top={ranked[: args.k]}")
    summary = summarize(rows)
    print(
        f"hit@{args.k}={summary['hit_at_k']}  mrr={summary['mrr']}  cases={summary['cases']}"
    )
    return 0 if summary["hit_at_k"] >= args.min_hit else 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Eval retrieval Qdrant Hub knowledge")
    sub = parser.add_subparsers(dest="cmd", required=True)
    inspect = sub.add_parser("inspect", help="isi koleksi Qdrant")
    inspect.set_defaults(func=cmd_inspect)
    evaluate = sub.add_parser("eval", help="hit@k dan MRR dari gold.json")
    evaluate.add_argument("--k", type=int, default=5)
    evaluate.add_argument("--id", default="")
    evaluate.add_argument("--visibility", default="")
    evaluate.add_argument("--min-hit", type=float, default=0.0)
    evaluate.set_defaults(func=cmd_eval)
    args = parser.parse_args()
    if args.cmd == "eval" and not args.visibility:
        args.visibility = None
    raise SystemExit(args.func(args))


if __name__ == "__main__":
    main()
