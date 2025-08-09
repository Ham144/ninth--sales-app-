import { create } from "zustand";

//zustand
export const useUserInfo = create((set) => ({
  userInfo: null,
  setUserInfo: (userInfo) => set((state) => ({ userInfo })),
  clearUserInfo: () => set(() => ({ userInfo: null })),
}));

export const useEditor = create((set) => {
  const defaultFlow = {
    title: "",
    desc: "",
    request: [],
    status: [],
    isAllowanceModeRequest: false,
  };

  return {
    currentEditingInputID: "",
    flow: defaultFlow,
    setCurrentEditingInputID: (id) =>
      set((state) => ({ currentEditingInputID: id })),
    setFlow: (updater) =>
      set((state) => ({
        flow:
          typeof updater === "function"
            ? updater(state.flow)
            : { ...defaultFlow, ...updater }, // ← merge dengan default untuk isi kosong
      })),
  };
});

export const useResponseCollector = create((set) => ({
  instanceTitle: "",
  overallStatus: "in-progress",
  requestData: {}, // object { [input._id]: jawaban }
  statuses: [], //pilih current dengan [flowInstance.currentStatusIndex]
  currentStatusIndex: null,
  setCurrentStatusIndex: (index) => set({ currentStatusIndex: index }),
  // Optional helper jika mau set langsung dari key dan value
  setRequestData: (key, value) =>
    set((state) => ({
      requestData: {
        ...state.requestData,
        [key]: value,
      },
    })),
  resetRequestData: () =>
    set({
      instanceTitle: "",
      requestData: {},
      published: false,
      overallStatus: "in-progress",
    }),

  setOveralStatus: (status) => set({ overallStatus: status }),
  setInstanceTitle: (text) => set({ instanceTitle: text }),
  setRequirement: (currentStatusIndex, inputId, value) => {
    set((state) => {
      const newStatuses = [...state.statuses];

      const currentStatus = newStatuses[currentStatusIndex];

      if (!currentStatus) return { statuses: state.statuses }; // Guard

      newStatuses[currentStatusIndex] = {
        ...currentStatus,
        requirementsData: {
          ...currentStatus.requirementsData,
          [inputId]: value,
        },
      };

      return { statuses: newStatuses };
    });
  },

  setFullRequestData: (newRequestData) => set({ requestData: newRequestData }),
  setStatuses: (statusDataArray) => set({ statuses: statusDataArray }),
}));
