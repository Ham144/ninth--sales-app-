import { http } from "./http";

export const IntegrationAPI = {
  list: () => http("/api/asThirdParty/integration"),
  delete: (id) => http(`/api/asThirdParty/integration/${id}`, { method: "DELETE" }),
  generate: (formData) =>
    http("/api/asThirdParty/integration", { method: "POST", body: formData }),
};
