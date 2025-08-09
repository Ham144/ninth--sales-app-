import axiosInstance from "./axiosInstance";

const configApi = {
  getConfig: async () => {
    const response = await axiosInstance.get(`/api/config`);
    return response.data;
  },
  updateConfig: async (body) => {
    const response = await axiosInstance.put(`/api/config`, body);
    return response.data;
  },
};

export default configApi;
