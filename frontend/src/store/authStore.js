import { create } from "zustand";

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem("hub_user") || "null");
  } catch {
    return null;
  }
})();

export const useAuthStore = create((set) => ({
  user: saved,
  setSession: (user, token) => {
    if (token) localStorage.setItem("hub_token", token);
    if (user) localStorage.setItem("hub_user", JSON.stringify(user));
    set({ user });
  },
  clearSession: () => {
    localStorage.removeItem("hub_token");
    localStorage.removeItem("hub_user");
    localStorage.removeItem("hub_username");
    localStorage.removeItem("hub_password");
    set({ user: null });
  },
}));
