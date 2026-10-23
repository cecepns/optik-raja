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
    UPDATE_PERMISSIONS: "/settings/permissions",
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
    EXPORT: "/customers/export",
    BULK_IMPORT: "/customers/bulk-import",
  },
  PRODUCTS: {
    LIST: "/products",
    CREATE: "/products",
    UPDATE: (id) => `/products/${id}`,
    DELETE: (id) => `/products/${id}`,
    EXPORT: "/products/export",
    BULK_IMPORT: "/products/bulk-import",
  },
  PRESCRIPTIONS: {
    LIST: "/prescriptions",
    DETAIL: (id) => `/prescriptions/${id}`,
    CREATE: "/prescriptions",
    UPDATE: (id) => `/prescriptions/${id}`,
    DELETE: (id) => `/prescriptions/${id}`,
    EXPORT: "/prescriptions/export",
    BULK_IMPORT: "/prescriptions/bulk-import",
  },
  TRANSACTIONS: {
    LIST: "/transactions",
    DETAIL: (id) => `/transactions/${id}`,
    CREATE: "/transactions",
    UPDATE: (id) => `/transactions/${id}`,
    DELETE: (id) => `/transactions/${id}`,
    PAY: (id) => `/transactions/${id}/pay`,
    EXPORT: "/transactions/export",
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
  EXPENSE_CATEGORIES: {
    LIST: "/expense-categories",
    CREATE: "/expense-categories",
    UPDATE: (id) => `/expense-categories/${id}`,
    DELETE: (id) => `/expense-categories/${id}`,
  },
  REPORTS: {
    DASHBOARD: "/reports/dashboard",
  },
  UPLOAD: "/upload",
};
