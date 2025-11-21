import axiosInstance from "./axiosInstance";

//login LDAP
export const loginLdap = async (body) => {
  const response = await axiosInstance.post(`/api/auth/login/ldap`, body);
  return response?.data;
};

export const loginApp = async (body) => {
  const response = await axiosInstance.post(`/api/auth/login/app`, body);
  return response?.data;
};

export const register = async (body) => {
  const response = await axiosInstance.post(
    "/api/auth/multi-tenant/register",
    body
  )
  return response?.data;
}

export const createAppUser = async (body) => {
  const response = await axiosInstance.post("/api/auth/createAppUser", body);
  return response.data;
};

export const getUserInfo = async () => {
  try {
    const res = await axiosInstance.get("/api/auth/getUserInfo", {
      withCredentials: true,
    });
    return res.data;
  } catch (error) {
    // Jika error (termasuk setelah interceptor coba refresh), return response yang menandakan user tidak login
    console.log("getUserInfo failed:", error.message);
    return {
      success: false,
      userInfo: null,
      message: "User not authenticated",
    };
  }
};

export const getAllAccount = async ({}) => {
  const response = await axiosInstance.get(`/api/auth/getAllAccount`);
  return response.data;
};

//mostly update role
export const updateUser = async (body) => {
  const response = await axiosInstance.put(`/api/auth/updateUser`, body);
  return response.data;
};

export const getUserById = async (id) => {
  const response = await axiosInstance.get(`/api/auth/getUserById/${id}`);
  return response?.data;
};

export const deleteAppUser = async (id) => {
  const response = await axiosInstance.delete(`/api/auth/deleteAppUser/${id}`);
  return response.data;
};

export const refreshToken = async () => {
  const response = await axiosInstance.post(`/api/auth/refresh-token`);
  return response.data;
};

export const getStatus2Fa = async () => {
  const response = await axiosInstance.get("/api/auth/2fa/status");
  return response.data;
};

export const deactivate2Fa = async () => {
  const response = await axiosInstance.delete("/api/auth/2fa/deactivate");
  return response.data;
};

export const activate2Fa = async () => {
  const response = await axiosInstance.get("/api/auth/2fa/activate");
  return response.data;
};

export const verify2Fa = async ({ otp }) => {
  const response = await axiosInstance.post("/api/auth/2fa/verify", { otp });
  return response.data;
};

export const complete2faLogin = async ({ otp, pendingToken }) => {
  const response = await axiosInstance.post("/api/auth/2fa/login-complete", {
    otp,
    pendingToken,
  });
  return response.data;
};

export const logout = async () => {
  const response = await axiosInstance.delete(`/api/auth/logout`);
  return response.data;
};
