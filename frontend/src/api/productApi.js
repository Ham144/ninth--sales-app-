import axiosInstance from "./axiosInstance";

const ProductApi = {
  getAllProducts: async (query, page = 1, limit = 10) => {
    const skip = (Number(page) - 1) * Number(limit);
    const params = new URLSearchParams();
    if (query) params.set("searchKey", query);
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    const res = await axiosInstance.get(
      `/api/v1/product/list?${params.toString()}`
    );
    return res.data;
  },
  getStockByNo: async ({ No, locationCode }) => {
    const params = new URLSearchParams();
    if (No) params.set("No", No);
    if (locationCode) params.set("locationCode", locationCode);

    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await axiosInstance.get(`/api/v1/product/getStock${query}`);
    return res.data;
  },
};

export default ProductApi;
