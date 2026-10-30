import { create } from "zustand";

export const useChatStore = create((set) => ({
  sessions: [],
  activeId: "",
  nonce: 0,
  listVersion: 0,
  setSessions: (sessions) => set({ sessions }),
  openSession: (activeId) => set({ activeId }),
  newChat: () => set((state) => ({ activeId: "", nonce: state.nonce + 1 })),
  touchList: () => set((state) => ({ listVersion: state.listVersion + 1 })),
}));
