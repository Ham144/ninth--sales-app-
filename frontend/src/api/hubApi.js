import { http } from "./http";

export const hubApi = {
  listUpdates: ({ search = "", status = "all" } = {}) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const qs = params.toString();
    return http(`/api/v1/hub/updates${qs ? `?${qs}` : ""}`);
  },
  createUpdate: (body) => http("/api/v1/hub/updates", { method: "POST", body }),
  bulkUpdates: (rows) =>
    http("/api/v1/hub/updates/bulk", { method: "POST", body: { rows } }),
  patchUpdate: (id, body) =>
    http(`/api/v1/hub/updates/${id}`, { method: "PATCH", body }),
  listDocs: ({ docType, search = "", tag, appId } = {}) => {
    const params = new URLSearchParams();
    if (docType) params.set("docType", docType);
    if (search) params.set("search", search);
    if (tag) params.set("tag", tag);
    if (appId) params.set("appId", appId);
    const qs = params.toString();
    return http(`/api/v1/hub/docs${qs ? `?${qs}` : ""}`);
  },
  getDoc: (id) => http(`/api/v1/hub/docs/by-id/${id}`),
  createDoc: (body) => http("/api/v1/hub/docs", { method: "POST", body }),
  updateDoc: (id, body) =>
    http(`/api/v1/hub/docs/${id}`, { method: "PUT", body }),
  deleteDoc: (id) => http(`/api/v1/hub/docs/${id}`, { method: "DELETE" }),
  listApps: ({ all = false } = {}) =>
    http(`/api/v1/hub/apps${all ? "?all=1" : ""}`),
  createApp: (body) => http("/api/v1/hub/apps", { method: "POST", body }),
  updateApp: (id, body) =>
    http(`/api/v1/hub/apps/${encodeURIComponent(id)}`, { method: "PUT", body }),
  deleteApp: (id) =>
    http(`/api/v1/hub/apps/${encodeURIComponent(id)}`, { method: "DELETE" }),
  ragSearch: (q, limit = 8) =>
    http(`/api/v1/hub/rag/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};
