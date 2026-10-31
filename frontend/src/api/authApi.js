import { http } from "./http";

export const authApi = {
  searchOrgs: (search = "") =>
    http(`/api/org/getAllOrg?search=${encodeURIComponent(search || "*")}`),
  loginLdap: (body) => http("/api/auth/login/ldap", { method: "POST", body }),
  me: () => http("/api/auth/getUserInfo"),
};
