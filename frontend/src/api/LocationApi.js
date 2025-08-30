import axiosInstance from "./axiosInstance";

const locationApi = {
  getAllLocation: async (searchKey) => {
    const response = await axiosInstance.get(
      `/api/v1/location/list${searchKey ? `?searchKey=${searchKey}` : ""}`
    );
    return response.data;
  },
};

export default locationApi;
