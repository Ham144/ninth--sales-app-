import { navigate } from "../lib/router.jsx";
import { useAuthStore } from "../store/authStore";

export const API_BASE = import.meta.env.VITE_API_BASE || "";

function getToken() {
  return localStorage.getItem("hub_token") || "";
}

export function isAuthFailure(status, message) {
  if (Number(status) !== 401) return false;
  const text = String(message || "").toLowerCase();
  return (
    text.includes("invalid or expired token") ||
    text.includes("session renewal") ||
    text.includes("session anda telah habis") ||
    text.includes("no refresh token") ||
    text.includes("session server tidak cocok") ||
    text.includes("token tidak ditemukan")
  );
}

let refreshing = null;

async function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/api/auth/refresh-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          throw new Error(data.message || "refresh failed");
        }
        setAuthToken(data.access_token);
        return data.access_token;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function forceLogout() {
  useAuthStore.getState().clearSession();
  import("./agentApi").then((mod) => mod.clearChatToken()).catch(() => {});
  if (!window.location.pathname.startsWith("/login")) navigate("/login");
}

function skipAuthRecovery(path) {
  return (
    String(path || "").includes("/auth/refresh-token") ||
    String(path || "").includes("/auth/login")
  );
}

async function readBody(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { message: text };
  }
}

export async function request(path, { method = "GET", body, headers, retry = true } = {}) {
  const token = getToken();
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  const data = await readBody(res);
  if (!res.ok) {
    const message = data?.message || `HTTP ${res.status}`;
    if (retry && isAuthFailure(res.status, message) && !skipAuthRecovery(path)) {
      try {
        await refreshAccessToken();
        return request(path, { method, body, headers, retry: false });
      } catch {
        forceLogout();
      }
    }
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function http(path, options = {}) {
  return request(path, options);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem("hub_token", token);
  else localStorage.removeItem("hub_token");
}
