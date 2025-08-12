import axiosInstance from "./axiosInstance";

const configApi = {
  getAllConfig: async () => {
    const response = await axiosInstance.get(`/api/config/all`);
    return response.data;
  },
  updateAllConfig: async (body) => {
    const response = await axiosInstance.put(`/api/config/all`, body);
    return response.data;
  },
  testSMTP: async (body) => {
    const response = await axiosInstance.post(`/api/smtp/test`, body);
    return response.data;
  },
};

export default configApi;
