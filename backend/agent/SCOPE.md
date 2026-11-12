# Agent scope

This is the CSI staff **RAG + tool-calling center**, not a shop chatbot and not a Hub-only copilot.

The AI service (`ai-service`) owns the model loop, Qdrant knowledge, and the tool registry. Each internal application exposes REST. MIDCSI/Hub is provider #1 (`POST /api/v1/apps/midcsi/tools/:name`). Petty-cash Nest is provider #2 (`POST /api/apps/petty-cash/tools/:name` with `X-AI-Service-Key`). Remaining catalog apps join the same way when they have an API key and a documented read contract. The Hub UI is the first chat client, not the owner of the agent. The agent does not POST petty-cash `/flow-log/new`.

Accepted work: staff lookup across registered app APIs (stock, price, piutang, order status, petty cash, forms, and so on as each app is wired), Hub documentation RAG, and a sales-order **draft**. The staff member reviews and presses Kirim; the existing sales-order API writes to NAV. The agent does not send the order, print a POS bill, or overwrite warehouse stock by itself.

Declined work: a bot that talks to the B2B customer. Shop login on chat, WhatsApp, outbound follow-up, and any tool whose receiver is the shop stay out. Headcount-cut claims do not change that.

A fuller customer record is storage. A channel from this agent to the shop is a different product.
