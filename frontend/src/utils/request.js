import { api } from "./api";

/**
 * Reusable HTTP Request Helpers
 */
export const request = {
  get: async (url, params = {}) => {
    const response = await api.get(url, { params });
    return response.data;
  },

  post: async (url, data = {}) => {
    const response = await api.post(url, data);
    return response.data;
  },

  put: async (url, data = {}) => {
    const response = await api.put(url, data);
    return response.data;
  },

  delete: async (url, params = {}) => {
    const response = await api.delete(url, { params });
    return response.data;
  },

  upload: async (url, file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};
