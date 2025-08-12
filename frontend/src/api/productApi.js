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
  getStockByNo: async (No) => {
    const res = await axiosInstance.get(`/api/v1/product/getStock?No=${No}`);
    return res.data;
  },
};

export default ProductApi;
