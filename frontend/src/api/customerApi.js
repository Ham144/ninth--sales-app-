import axiosInstance from "./axiosInstance.js";

const CustomerApi = {
  getAllCustomers: async (searchKey, page = 1, limit = 10) => {
    const skip = (Number(page) - 1) * Number(limit);
    const params = new URLSearchParams();
    if (searchKey) params.set("searchKey", searchKey);
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    const response = await axiosInstance.get(
      `/api/v1/customer/list?${params.toString()}`
    );
    return response.data;
  },
  getByNo: async (no) => {
    const response = await axiosInstance.get(`/api/v1/customer/getByNo/${no}`);
    return response.data;
  },
};

export default CustomerApi;