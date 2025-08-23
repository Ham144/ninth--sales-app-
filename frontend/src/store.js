import { create } from "zustand";

//zustand
export const useUserInfo = create((set) => ({
  userInfo: null,
  setUserInfo: (userInfo) => set((state) => ({ userInfo })),
  clearUserInfo: () => set(() => ({ userInfo: null })),
}));
