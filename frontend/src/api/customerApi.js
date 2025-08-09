import axiosInstance from "./axiosInstance.js";

const CustomerApi = {
  getAllCustomers: async (searchKey) => {
    const response = await axiosInstance.get(
      `/api/v1/customer/list?searchKey=${searchKey}`
    );
    return response.data;
  },
  getByNo: async (no) => {
    const response = await axiosInstance.post(`/api/v1/customer/getByNo/${no}`);
    return response.data;
  },
};

export default CustomerApi;
