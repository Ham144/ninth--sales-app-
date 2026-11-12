# MIDCSI AI service

FastAPI microservice for the staff copilot: Chat Completions tool-calling loop and Qdrant vector search.

The Node hub still owns JWT, chat sessions, Mongo product/customer/SO tools, and the Kirim button to NAV. This process never posts a sales order.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 7080
```

| Method | Path | Role |
|---|---|---|
| GET | `/health` | Qdrant + LLM key |
| POST | `/v1/retrieve` | embed query, search `hub_knowledge` |
| POST | `/v1/turn` | JSON turn |
| POST | `/v1/turn/stream` | SSE `token` / `tool` / `done` |

Shared secret: header `X-AI-Service-Key`.

Tool registry: `registry/catalog.json`. `GET /v1/apps` lists all catalog apps. Enabled now: `midcsi` and `petty-cash`. Other apps stay disabled; Hub still returns `501` for them. Petty-cash tools are served by Nest (`PETTY_CASH_BASE_URL`), not by the Hub proxy.

HTTP tools call `POST {MIDCSI_BASE_URL}/api/v1/apps/midcsi/tools/:name` or `POST {PETTY_CASH_BASE_URL}/api/apps/petty-cash/tools/:name`. Knowledge stays on Qdrant. The generic `internal/tools` callback is not used. The agent never posts a petty-cash expense.

Pydantic rejects empty or >2000-character turns before the model is called. If this process is down, the Hub chat fails; it does not run a second Node agent loop.
