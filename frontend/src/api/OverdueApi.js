import axiosInstance from "./axiosInstance";

const OverdueApi = {
  list: async ({ search, limit, skip, page, startDate, endDate }) => {
    const queries = [
      search ? `search=${search}` : null,
      limit ? `limit=${limit}` : null,
      skip ? `skip=${skip}` : null,
      page ? `page=${page}` : null,
      startDate ? `startDate=${startDate}` : null,
      endDate ? `endDate=${endDate}` : null,
    ]
      .filter(Boolean)
      .join("&");

    const response = await axiosInstance.get(`/api/v1/overdue/list?${queries}`);
    return response;
  },
  renewOverdue: async () => {
    const response = await axiosInstance.post(
      "/api/v1/overdue/renewOverdue",
      {}
    );
    return response;
  },
  getAvailableMonths: async () => {
    const response = await axiosInstance.get("/api/v1/overdue/availableMonths");
    return response;
  },
  downloadCsv: async (body) => {
    const response = await axiosInstance.post(
      "/api/v1/overdue/downloadCsv",
      body
    );
    return response.data;
  },
};

export default OverdueApi;
