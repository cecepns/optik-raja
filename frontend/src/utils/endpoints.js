/**
 * Centralized API & Upload Endpoints Configuration
 * Backend Server: https://api.kingcreativestudio.my.id/optik-raja
 */

export const BASE_API_URL =
  import.meta.env.VITE_API_URL ||
  "https://api.kingcreativestudio.my.id/optik-raja/api";

export const BASE_UPLOAD_URL =
  import.meta.env.VITE_UPLOAD_URL ||
  "https://api.kingcreativestudio.my.id/optik-raja/uploads";

/**
 * Helper to construct full URL for uploaded files/images without relying on local proxy
 */
export const getUploadUrl = (path) => {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:") ||
    path.startsWith("blob:")
  ) {
    return path;
  }
  const cleanPath = path.startsWith("/uploads/")
    ? path.replace(/^\/uploads\//, "")
    : path.startsWith("/")
    ? path.slice(1)
    : path;
  return `${BASE_UPLOAD_URL}/${cleanPath}`;
};

export const API_ENDPOINTS = {
  HEALTH: "/health",
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    PROFILE: "/auth/profile",
  },
  USERS: {
    LIST: "/users",
    DETAIL: (id) => `/users/${id}`,
    CREATE: "/users",
    UPDATE: (id) => `/users/${id}`,
    DELETE: (id) => `/users/${id}`,
  },
  SETTINGS: {
    GET: "/settings",
    UPDATE: "/settings",
  },
  EMPLOYEES: {
    LIST: "/employees",
    CREATE: "/employees",
    UPDATE: (id) => `/employees/${id}`,
    DELETE: (id) => `/employees/${id}`,
  },
  CUSTOMERS: {
    LIST: "/customers",
    DETAIL: (id) => `/customers/${id}`,
    CREATE: "/customers",
    UPDATE: (id) => `/customers/${id}`,
    DELETE: (id) => `/customers/${id}`,
  },
  PRODUCTS: {
    LIST: "/products",
    CREATE: "/products",
    UPDATE: (id) => `/products/${id}`,
    DELETE: (id) => `/products/${id}`,
  },
  PRESCRIPTIONS: {
    LIST: "/prescriptions",
    DETAIL: (id) => `/prescriptions/${id}`,
    CREATE: "/prescriptions",
    UPDATE: (id) => `/prescriptions/${id}`,
    DELETE: (id) => `/prescriptions/${id}`,
  },
  TRANSACTIONS: {
    LIST: "/transactions",
    DETAIL: (id) => `/transactions/${id}`,
    CREATE: "/transactions",
    PAY: (id) => `/transactions/${id}/pay`,
  },
  LAB_ORDERS: {
    LIST: "/lab-orders",
    UPDATE_STATUS: (id) => `/lab-orders/${id}/status`,
  },
  EXPENSES: {
    LIST: "/expenses",
    CREATE: "/expenses",
    UPDATE: (id) => `/expenses/${id}`,
    DELETE: (id) => `/expenses/${id}`,
  },
  REPORTS: {
    DASHBOARD: "/reports/dashboard",
  },
  UPLOAD: "/upload",
};
