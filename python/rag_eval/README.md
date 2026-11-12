# MIDCSI RAG eval (Python)

Eval retrieval ke Qdrant. Chat AI Agent MIDCSI tetap Node (`backend/agent`).

```bash
cd python/rag_eval
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
pytest
rag-eval inspect
rag-eval eval --k 5
```

Membaca `backend/.env` (`QDRANT_URL`, `EMBEDDING_*` / `LLM_*`).
