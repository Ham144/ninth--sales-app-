import axios from "axios";
import { BASE_URL } from "./constant";

const axiosInstance = axios.create({
  withCredentials: true,
  baseURL: `${BASE_URL}`,
});

//interceptor ini untuk menangani error 401 dari authenticate, karena getUserInfo dari  levelWrapper.jsx hanya dipanggil jika fullreload atau berada di /login untuk mengurangi beban server, karena authenticate cukup terpercaya dengan deode token di middleware tanpa hit database. jika tidak ada interceptor ini, maka kita masih bisa navigasi kemana mana walau token sudah tidak berlaku atau terhapus karena levelWrapper hanya mengecek userInfo di store, jika tidak ada barulah ia akan refetch getUSerInfo seperti misalnya fullreload
//NEW : getUserinfo sekarang sudah melakukan refresh token jika access token kadal

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response.status === 401) {
      const response = axios.post(
        `${BASE_URL}/api/auth/refresh-token`,
        {},
        {
          withCredentials: true,
        }
      );
      if (response.status === 200) {
        return axiosInstance(error.config); // tanpa ubah header
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
