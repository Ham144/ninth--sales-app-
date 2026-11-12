import { systemPromptFor } from "./guardrails.js";
import { windowMessages } from "./memory.js";
import { actionFromSession, activeTools } from "./tools.js";

export function aiServiceEnabled(env = process.env) {
  return Boolean(String(env.AI_SERVICE_URL || "").trim());
}

async function consumeNamedSse(body, onEvent) {
  if (!body || typeof body.getReader !== "function") return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() || "";
    for (const part of parts) {
      let event = "message";
      const datas = [];
      for (const line of part.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) datas.push(line.slice(5).trim());
      }
      if (!datas.length) continue;
      try {
        onEvent(event, JSON.parse(datas.join("\n")));
      } catch {
        /* keep-alive */
      }
    }
    if (done) break;
  }
}

export async function runTurnViaAiService({
  tenant,
  session,
  message,
  customerId,
  onEvent,
  env = process.env,
  fetchImpl = globalThis.fetch,
}) {
  const base = String(env.AI_SERVICE_URL || "").replace(/\/$/, "");
  const tools = activeTools(tenant, customerId).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters || { type: "object", properties: {} },
  }));
  const response = await fetchImpl(`${base}/v1/turn/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.AI_SERVICE_KEY ? { "X-AI-Service-Key": env.AI_SERVICE_KEY } : {}),
    },
    body: JSON.stringify({
      message,
      history: windowMessages(session.messages, tenant.memoryWindowSize || 12),
      tools,
      system_prompt: systemPromptFor(tenant),
      max_iter: tenant.maxToolIterations || 4,
      customer_id: customerId || null,
      model_mode: session.modelMode || "pas",
      visibility: tenant.audience === "public" ? "public" : null,
      memory_window: tenant.memoryWindowSize || 12,
    }),
  });
  if (!response.ok) {
    const error = new Error(`ai-service HTTP ${response.status}`);
    error.status = 502;
    throw error;
  }
  let done = null;
  let streamError = null;
  await consumeNamedSse(response.body, (event, data) => {
    if (event === "token") onEvent?.({ type: "token", text: data.text });
    if (event === "tool") onEvent?.({ type: "tool", name: data.name });
    if (event === "done") done = data;
    if (event === "error") streamError = data?.message || "ai-service error";
  });
  if (streamError) {
    const error = new Error(streamError);
    error.status = 502;
    throw error;
  }
  if (!done) {
    const error = new Error("ai-service tidak mengirim done");
    error.status = 502;
    throw error;
  }
  for (const msg of done.appended || []) {
    session.messages.push({
      role: msg.role,
      content: msg.content || "",
      context: msg.context,
      toolCallId: msg.toolCallId,
      toolName: msg.toolName,
      toolCalls: msg.toolCalls,
      createdAt: new Date().toISOString(),
    });
  }
  session.model = done.model || session.model;
  const last = session.messages[session.messages.length - 1];
  const action = done.action || actionFromSession(session.messages);
  if (action && last?.role === "assistant") last.action = action;
  return {
    reply: done.reply,
    toolCallsUsed: (done.toolCallsUsed || []).map((call) => ({
      name: call.name,
      args: call.args || {},
      latencyMs: call.latency_ms || call.latencyMs || 0,
      customerInjected: false,
    })),
    tokensUsed: done.tokensUsed || 0,
    action,
    handoffRequested: Boolean(done.handoffRequested),
    budgetExceeded: false,
  };
}
