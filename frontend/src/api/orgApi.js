import axiosInstance from "./axiosInstance";

const OrgApi = {
  getAllOrg: async (q) => {
    const response = await axiosInstance.get(`/api/org/getAllOrg?search=${q}`);
    return response.data;
  },
  getAllOrgSuperTenant: async (q) => {
    const response = await axiosInstance.get(
      `/api/org/getAllOrgSuperTenant?search=${q}`
    );
    return response.data;
  },
  disableOrg: async (_id) => {
    const response = await axiosInstance.delete(`/api/org/disableOrg/${_id}`);
    return response.data;
  },
  deleteOrg: async (_id) => {
    const response = await axiosInstance.delete(`/api/org/deleteOrg/${_id}`);
    return response.data;
  },
  createOrgApi: async (body) => {
    const response = await axiosInstance.post("/api/org/createOrg", body);
    return response.data;
  },
  getMyOrg: async (_id) => {
    const response = await axiosInstance.get(`/api/org/getOrgById/${_id}`);
    return response.data;
  },
};

export default OrgApi;
