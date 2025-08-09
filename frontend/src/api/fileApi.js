import axiosInstance from "./axiosInstance";

const FileApi = {
  uploadImage: async (formData) => {
    console.log("🔥 uploadImage() called");
    const res = await axiosInstance.post("/api/file/upload/img", formData);
    console.log("✅ upload success:", res.data);
    return res.data;
  },
};

export default FileApi;
