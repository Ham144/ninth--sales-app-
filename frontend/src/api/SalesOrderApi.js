import axiosInstance from "./axiosInstance";

const SalesOrderApi = {
  requestSalesOrder: async (body) => {
    const response = await axiosInstance.post(`/api/v1/salesOrder/new`, body);
    return response;
  },
  getAllSalesOrder: async (searchKey) => {
    const response = await axiosInstance.get(
      `/api/v1/salesOrder/list?searchKey=${searchKey}`
    );
    return response;
  },
  createTempSO: async (body) => {
    const response = await axiosInstance.put(
      `/api/v1/salesOrder/temp/create`,
      body
    );
    return response;
  },
  getTempSO: async (customerId) => {
    const response = await axiosInstance.get(
      `/api/v1/salesOrder/temp/collect?customerId=${customerId}`
    );
    return response;
  },
  getById: async (id) => {
    const response = await axiosInstance.get(
      `/api/v1/salesOrder/getById/${id}`
    );
    return response;
  },
};

export default SalesOrderApi;
