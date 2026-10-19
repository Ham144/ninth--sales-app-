const API_BASE = import.meta.env.VITE_API_BASE || "";

function getToken() {
  return localStorage.getItem("hub_token") || "";
}

export async function http(path, { method = "GET", body, headers } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }

  if (!res.ok) {
    const err = new Error(data?.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export function setAuthToken(token) {
  if (token) localStorage.setItem("hub_token", token);
  else localStorage.removeItem("hub_token");
}
