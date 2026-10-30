import { API_BASE, http } from "./http";

let token = "";
let expiresAt = 0;

export function clearChatToken() {
  token = "";
  expiresAt = 0;
}

export async function chatToken() {
  if (token && Date.now() < expiresAt) return token;
  const data = await http("/api/v1/agent/demo/token", { method: "POST", body: {} });
  token = data.chatToken;
  const ttl = Number(data.expiresIn) || 900;
  expiresAt = Date.now() + Math.max(30, ttl - 30) * 1000;
  return token;
}

export async function agentJson(path, { method = "GET", body } = {}) {
  const auth = await chatToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}
