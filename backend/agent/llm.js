import { presentReply } from "./guardrails.js";

export const MODEL_MODES = {
  hemat: {
    id: "hemat",
    label: "Hemat",
    description: "Paling irit. Untuk membandingkan, bukan default staf.",
  },
  pas: {
    id: "pas",
    label: "Pas",
    description: "Default. Lookup stok, harga, customer, order, dan aplikasi.",
  },
  kuat: {
    id: "kuat",
    label: "Kuat",
    description: "Kalau jawaban Pas kurang. Satu langkah di atas, bukan model termahal.",
  },
};

export function normalizeModelMode(mode) {
  if (mode === "hemat") return "hemat";
  if (mode === "kuat" || mode === "precise") return "kuat";
  return "pas";
}

function preciseProfile(tenant) {
  return tenant?.llmModes?.precise || {};
}

function hematProfile(tenant) {
  return tenant?.llmModes?.hemat || {};
}

export function hasHematLlm(tenant, env = process.env) {
  return Boolean(hematProfile(tenant).model || env.LLM_HEMAT_MODEL);
}

export function hasKuatLlm(tenant, env = process.env) {
  return Boolean(preciseProfile(tenant).model || env.LLM_PRECISE_MODEL);
}

export function availableModelModes(tenant, env = process.env) {
  return Object.values(MODEL_MODES).map((mode) => {
    const available =
      mode.id === "pas" ||
      (mode.id === "hemat" && hasHematLlm(tenant, env)) ||
      (mode.id === "kuat" && hasKuatLlm(tenant, env));
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

export function resolveLlm(tenant, env = process.env, mode = "pas") {
  const selectedMode = normalizeModelMode(mode);
  const precise = preciseProfile(tenant);
  const hemat = hematProfile(tenant);
  if (selectedMode === "kuat" && !hasKuatLlm(tenant, env)) {
    const error = new Error("Level Kuat belum dikonfigurasi");
    error.status = 409;
    throw error;
  }
  if (selectedMode === "hemat" && !hasHematLlm(tenant, env)) {
    const error = new Error("Level Hemat belum dikonfigurasi");
    error.status = 409;
    throw error;
  }
  const baseUrl = String(
    (selectedMode === "kuat" && (precise.baseUrl || env.LLM_PRECISE_BASE_URL)) ||
      (selectedMode === "hemat" && (hemat.baseUrl || env.LLM_HEMAT_BASE_URL)) ||
      tenant?.llm?.baseUrl ||
      env.LLM_BASE_URL ||
      "https://openrouter.ai/api/v1",
  ).replace(/\/$/, "");
  const apiKey =
    (selectedMode === "kuat" && (precise.apiKey || env.LLM_PRECISE_API_KEY)) ||
    (selectedMode === "hemat" && (hemat.apiKey || env.LLM_HEMAT_API_KEY)) ||
    tenant?.llm?.apiKey ||
    env.LLM_API_KEY ||
    "";
  const model =
    (selectedMode === "kuat" && (precise.model || env.LLM_PRECISE_MODEL)) ||
    (selectedMode === "hemat" && (hemat.model || env.LLM_HEMAT_MODEL)) ||
    tenant?.llm?.model ||
    env.LLM_MODEL ||
    "deepseek/deepseek-v3.2";
  const fallbackModel =
    (selectedMode === "kuat" && (precise.fallbackModel || env.LLM_PRECISE_FALLBACK_MODEL)) ||
    (selectedMode === "hemat" && (hemat.fallbackModel || env.LLM_HEMAT_FALLBACK_MODEL)) ||
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
    timeoutMs: selectedMode === "kuat" ? 60000 : 30000,
  };
}

export function effectiveLlm(tenant, env = process.env, mode = "pas") {
  const selectedMode = normalizeModelMode(mode);
  const saved =
    selectedMode === "kuat" ? preciseProfile(tenant) : selectedMode === "hemat" ? hematProfile(tenant) : tenant?.llm || {};
  const envPrefix = selectedMode === "kuat" ? "LLM_PRECISE_" : selectedMode === "hemat" ? "LLM_HEMAT_" : "LLM_";
  const source = {
    baseUrl: saved.baseUrl ? "saved" : env[`${envPrefix}BASE_URL`] ? "env" : selectedMode === "pas" ? "default" : "pas",
    apiKey: saved.apiKey ? "saved" : env[`${envPrefix}API_KEY`] ? "env" : selectedMode === "pas" ? "missing" : "pas",
    model: saved.model ? "saved" : env[`${envPrefix}MODEL`] ? "env" : selectedMode === "pas" ? "default" : "missing",
    fallbackModel: saved.fallbackModel
      ? "saved"
      : env[`${envPrefix}FALLBACK_MODEL`]
        ? "env"
        : selectedMode === "pas"
          ? "none"
          : "pas",
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
