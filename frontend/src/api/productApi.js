import axiosInstance from "./axiosInstance";

const ProductApi = {
  getAllProducts: async (searchKey) => {
    const res = await axiosInstance.get(
      `/api/v1/product/list?searchKey=${searchKey}`
    );
    return res.data;
  },
  getStockByNo: async (No) => {
    const res = await axiosInstance.get(`/api/v1/product/getStock?No=${No}`);
    return res.data;
  },
};

export default ProductApi;
