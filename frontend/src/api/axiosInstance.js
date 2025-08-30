import axios from "axios";
import { BASE_URL } from "./constant";

const axiosInstance = axios.create({
  withCredentials: true,
  baseURL: `${BASE_URL}`,
});

let isRefreshing = false;
let refreshSubscribers = [];

function onRefreshed() {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
}
//interceptor ini untuk menangani error 401 dari authenticate, karena getUserInfo dari  levelWrapper.jsx hanya dipanggil jika fullreload atau berada di /login untuk mengurangi beban server, karena authenticate cukup terpercaya dengan deode token di middleware tanpa hit database. jika tidak ada interceptor ini, maka kita masih bisa navigasi kemana mana walau token sudah tidak berlaku atau terhapus karena levelWrapper hanya mengecek userInfo di store, jika tidak ada barulah ia akan refetch getUSerInfo seperti misalnya fullreload
//NEW : getUserinfo sekarang sudah melakukan refresh token jika access token kadaluarasa

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if it's a 401 error
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request until refresh is done
        return new Promise((resolve) => {
          refreshSubscribers.push(() => {
            resolve(axiosInstance(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${BASE_URL}/api/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        if (res.status === 200) {
          onRefreshed();
          return axiosInstance(originalRequest); // retry original request
        }
      } catch (refreshError) {
        console.error("Refresh token failed:", refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
