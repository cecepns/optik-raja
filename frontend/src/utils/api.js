import axios from "axios";
import { BASE_API_URL } from "./endpoints";

export const api = axios.create({
  baseURL: BASE_API_URL,
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("optik_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !window.location.pathname.includes("/login")
    ) {
      localStorage.removeItem("optik_token");
      localStorage.removeItem("optik_user");
    }
    const message =
      error.response?.data?.message ||
      error.message ||
      "Terjadi kesalahan pada server";
    return Promise.reject(new Error(message));
  }
);
