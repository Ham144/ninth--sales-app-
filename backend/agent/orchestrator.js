import { BUDGET_MESSAGE, expandEmptyToolReply, presentReply, systemPromptFor } from "./guardrails.js";
import { completeChat, openAiTools, resolveLlm, toLlmMessages } from "./llm.js";
import { windowMessages } from "./memory.js";
import { activeTools, executeTool, parseArgs, wrapToolResult } from "./tools.js";

function chunkText(text, size = 48) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

export async function runTurn({
  tenant,
  session,
  message,
  context = "",
  customerId,
  limiter,
  fetchImpl,
  complete = completeChat,
  execute = executeTool,
  onEvent,
  env = process.env,
}) {
  const text = String(message || "").trim();
  if (!text) {
    const error = new Error("message wajib");
    error.status = 400;
    throw error;
  }
  if (text.length > 2000) {
    const error = new Error("message terlalu panjang");
    error.status = 400;
    throw error;
  }

  const budget = tenant.dailyTokenBudget ?? 200000;
  const publicVisitor = tenant.audience === "public";
  const spent = publicVisitor && limiter ? await limiter.getSpent(tenant.slug || tenant._id) : 0;
  session.messages = session.messages || [];
  session.messages.push({
    role: "user",
    content: text,
    context: String(context || "").trim().slice(0, 1200),
    createdAt: new Date().toISOString(),
  });

  if (publicVisitor && spent >= budget) {
    session.messages.push({
      role: "assistant",
      content: BUDGET_MESSAGE,
      createdAt: new Date().toISOString(),
    });
    return {
      reply: BUDGET_MESSAGE,
      toolCallsUsed: [],
      tokensUsed: 0,
      handoffRequested: false,
      budgetExceeded: true,
    };
  }

  const llm = resolveLlm(tenant, env, session.modelMode || "fast");
  const completeFn = complete || completeChat;
  const executeFn = execute || executeTool;
  const tools = activeTools(tenant, customerId);
  const maxIter = tenant.maxToolIterations || 4;
  let tokensUsed = 0;
  const toolCallsUsed = [];
  let reply = "";

  for (let i = 0; i < maxIter; i += 1) {
    const messages = toLlmMessages(
      systemPromptFor(tenant),
      windowMessages(session.messages, tenant.memoryWindowSize || 12),
    );
    let completion;
    try {
      completion = await completeFn({
        ...llm,
        messages,
        tools: openAiTools(tools),
        fetchImpl,
      });
    } catch (error) {
      if (!llm.fallbackModel || error.status === 409 || error.status === 503) throw error;
      completion = await completeFn({
        ...llm,
        model: llm.fallbackModel,
        messages,
        tools: openAiTools(tools),
        fetchImpl,
      });
    }

    tokensUsed += completion.usage?.total_tokens || 0;
    session.model = completion.model || llm.model;
    const calls = completion.toolCalls || [];
    if (!calls.length) {
      reply = expandEmptyToolReply(
        presentReply(completion.content) || "Saya tidak menemukan jawaban dari data yang tersedia.",
        session.messages,
      );
      session.messages.push({
        role: "assistant",
        content: reply,
        createdAt: new Date().toISOString(),
      });
      for (const piece of chunkText(reply)) onEvent?.({ type: "token", text: piece });
      break;
    }

    session.messages.push({
      role: "assistant",
      content: completion.content || "",
      toolCalls: calls,
      createdAt: new Date().toISOString(),
    });

    for (const call of calls) {
      const name = call.function?.name || call.name;
      const tool = tools.find((item) => item.name === name);
      const args = parseArgs(call.function?.arguments ?? call.arguments);
      onEvent?.({ type: "tool", name });
      const started = Date.now();
      const result = tool
        ? await executeFn({
            tool,
            args,
            customerId,
            fetchImpl,
            upstream: tenant.upstream,
            limiter,
          })
        : {
            payload: { error: "Tool tidak dikenal" },
            observedAt: new Date().toISOString(),
          };
      if (result.handoff) session.handoffRequested = true;
      toolCallsUsed.push({
        name,
        args,
        latencyMs: Date.now() - started,
        customerInjected: Boolean(customerId && tool?.inject),
      });
      session.messages.push({
        role: "tool",
        toolCallId: call.id || `call_${toolCallsUsed.length}`,
        toolName: name,
        content: wrapToolResult(name, result.payload),
        createdAt: new Date().toISOString(),
      });
    }
  }

  if (!reply) {
    reply = "Saya belum bisa menyelesaikan permintaan itu dari data yang tersedia.";
    session.messages.push({
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString(),
    });
  }

  if (publicVisitor && limiter) await limiter.addSpent(tenant.slug || tenant._id, tokensUsed);
  return {
    reply,
    toolCallsUsed,
    tokensUsed,
    handoffRequested: Boolean(session.handoffRequested),
    budgetExceeded: false,
  };
}
