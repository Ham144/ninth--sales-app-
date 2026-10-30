import { presentReply } from "./guardrails.js";

export const MODEL_MODES = {
  fast: {
    id: "fast",
    label: "Cepat",
    description: "Untuk lookup stok, harga, customer, aplikasi, dan pertanyaan rutin.",
  },
  precise: {
    id: "precise",
    label: "Teliti",
    description: "Untuk pertanyaan ambigu, beberapa tool, dan analisis dokumen.",
  },
};

function preciseProfile(tenant) {
  return tenant?.llmModes?.precise || {};
}

export function hasPreciseLlm(tenant, env = process.env) {
  return Boolean(preciseProfile(tenant).model || env.LLM_PRECISE_MODEL);
}

export function availableModelModes(tenant, env = process.env) {
  return Object.values(MODEL_MODES).map((mode) => {
    const available = mode.id === "fast" || hasPreciseLlm(tenant, env);
    let model = "";
    if (available) {
      try {
        model = resolveLlm(tenant, env, mode.id).model || "";
      } catch {
        model = "";
      }
    }
    return { ...mode, available, model };
  });
}

export function resolveLlm(tenant, env = process.env, mode = "fast") {
  const selectedMode = mode === "precise" ? "precise" : "fast";
  const precise = preciseProfile(tenant);
  if (selectedMode === "precise" && !hasPreciseLlm(tenant, env)) {
    const error = new Error("Mode Teliti belum dikonfigurasi");
    error.status = 409;
    throw error;
  }
  const baseUrl = String(
    (selectedMode === "precise" && (precise.baseUrl || env.LLM_PRECISE_BASE_URL)) ||
      tenant?.llm?.baseUrl ||
      env.LLM_BASE_URL ||
      "https://openrouter.ai/api/v1",
  ).replace(/\/$/, "");
  const apiKey =
    (selectedMode === "precise" && (precise.apiKey || env.LLM_PRECISE_API_KEY)) ||
    tenant?.llm?.apiKey ||
    env.LLM_API_KEY ||
    "";
  const model =
    (selectedMode === "precise" && (precise.model || env.LLM_PRECISE_MODEL)) ||
    tenant?.llm?.model ||
    env.LLM_MODEL ||
    "deepseek/deepseek-chat";
  const fallbackModel =
    (selectedMode === "precise" && (precise.fallbackModel || env.LLM_PRECISE_FALLBACK_MODEL)) ||
    tenant?.llm?.fallbackModel ||
    env.LLM_FALLBACK_MODEL ||
    "";
  if (
    tenant?.dataSensitivity === "sensitive" &&
    baseUrl.includes("openrouter.ai")
  ) {
    const error = new Error("OpenRouter tidak diizinkan untuk data sensitif");
    error.status = 409;
    throw error;
  }
  return {
    baseUrl,
    apiKey,
    model,
    fallbackModel,
    mode: selectedMode,
    timeoutMs: selectedMode === "precise" ? 60000 : 30000,
  };
}

export function effectiveLlm(tenant, env = process.env, mode = "fast") {
  const selectedMode = mode === "precise" ? "precise" : "fast";
  const saved = selectedMode === "precise" ? preciseProfile(tenant) : tenant?.llm || {};
  const envPrefix = selectedMode === "precise" ? "LLM_PRECISE_" : "LLM_";
  const source = {
    baseUrl: saved.baseUrl ? "saved" : env[`${envPrefix}BASE_URL`] ? "env" : selectedMode === "precise" ? "fast" : "default",
    apiKey: saved.apiKey ? "saved" : env[`${envPrefix}API_KEY`] ? "env" : selectedMode === "precise" ? "fast" : "missing",
    model: saved.model ? "saved" : env[`${envPrefix}MODEL`] ? "env" : selectedMode === "precise" ? "missing" : "default",
    fallbackModel: saved.fallbackModel ? "saved" : env[`${envPrefix}FALLBACK_MODEL`] ? "env" : selectedMode === "precise" ? "fast" : "none",
  };
  try {
    const resolved = resolveLlm(tenant, env, selectedMode);
    return {
      ok: true,
      mode: selectedMode,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
      fallbackModel: resolved.fallbackModel,
      hasApiKey: Boolean(resolved.apiKey),
      source,
    };
  } catch (error) {
    return { ok: false, message: error.message, source };
  }
}

function markedItemNos(text) {
  const nos = [];
  for (const line of text.split("\n")) {
    const plain = line.replace(/\*\*/g, "").trim();
    const match = plain.match(/^\d+\.\s+(.+)$/);
    if (match) nos.push(match[1].trim());
  }
  return [...new Set(nos)].slice(0, 8);
}

export function userContentForModel(msg) {
  const question = String(msg?.content || "");
  const marked = String(msg?.context || "").trim();
  if (!marked) return question;
  const nos = markedItemNos(marked);
  const list = nos.length ? `Nomor item pada pesan itu: ${nos.join(", ")}.\n` : "";
  return `${list}Pesan yang ditandai adalah acuan. Jangan minta nomor item lagi. MNG2 adalah Mangga Dua.\n${marked}\n\n${question}`;
}

export function toLlmMessages(system, history) {
  const out = [{ role: "system", content: system }];
  for (const msg of history) {
    if (msg.role === "user") out.push({ role: "user", content: userContentForModel(msg) });
    if (msg.role === "assistant") {
      const item = { role: "assistant", content: presentReply(msg.content || "") };
      if (msg.toolCalls?.length) item.tool_calls = msg.toolCalls;
      out.push(item);
    }
    if (msg.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.content || "",
      });
    }
  }
  return out;
}

export function openAiTools(tools) {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters || { type: "object", properties: {} },
    },
  }));
}

export async function completeChat({
  baseUrl,
  apiKey,
  model,
  messages,
  tools,
  fetchImpl = globalThis.fetch,
  appUrl = process.env.APP_URL || "",
  timeoutMs = 30000,
}) {
  if (!apiKey) {
    const error = new Error("LLM_API_KEY belum diisi");
    error.status = 503;
    throw error;
  }
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (appUrl) headers["HTTP-Referer"] = appUrl;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      tools: tools?.length ? tools : undefined,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "LLM menolak permintaan");
    error.status = 502;
    throw error;
  }
  const message = data.choices?.[0]?.message || {};
  return {
    content: message.content || "",
    toolCalls: message.tool_calls || [],
    usage: data.usage || {},
    model: data.model || model,
  };
}
