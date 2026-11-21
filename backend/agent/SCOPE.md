# Agent scope

This is the CSI staff **RAG + tool-calling center**, not a shop chatbot and not a Hub-only copilot.

## Who owns what

| Piece | Owner | Notes |
|---|---|---|
| Model loop, tool registry, Qdrant retrieve | `ai-service/` (Python) | Production brain when `AI_SERVICE_URL` is set |
| Chat HTTP, JWT, sessions, Mongo/NAV tool executors | `backend/agent/` (Node) | Door + data; not a second brain in staging/prod |
| `orchestrator.js` / `llm.js` Node loop | Tests / inject only | If Python is down, chat errors — no silent Node fallback |

Each internal application exposes REST. MIDCSI/Hub is provider #1 (`POST /api/v1/apps/midcsi/tools/:name`). Petty-cash Nest is provider #2 (`POST /api/apps/petty-cash/tools/:name` with `X-AI-Service-Key`). Remaining catalog apps join the same way when they have an API key and a documented read contract. The Hub UI is the first chat client, not the owner of the agent. The agent does not POST petty-cash `/flow-log/new`.

Accepted work: staff lookup across registered app APIs (stock, price, piutang, order status, petty cash, forms, and so on as each app is wired), allowlisted Hub Mongo reads via `hub_data_query` (Level B: customer lookup, SalesLine unwind, between, avg/sum/min/max) for ad-hoc questions, curated Hub Knowledge RAG (not a 300GB dump store), and a sales-order **draft**. The staff member reviews and presses Kirim; the existing sales-order API writes to NAV. The agent does not send the order, print a POS bill, overwrite warehouse stock, or run free-form Mongo/SQL writes.

Declined work: a bot that talks to the B2B customer. Shop login on chat, WhatsApp, outbound follow-up, and any tool whose receiver is the shop stay out. Headcount-cut claims do not change that.

A fuller customer record is storage. A channel from this agent to the shop is a different product.
