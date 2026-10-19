import { http } from "./http";

const configApi = {
  getAllConfig: () => http("/api/config/all"),
  updateAllConfig: (body) => http("/api/config/all", { method: "PUT", body }),
  testSMTP: (body) => http("/api/config/smtp/test", { method: "POST", body }),
};

export default configApi;
