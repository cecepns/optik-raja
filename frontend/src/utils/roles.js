/**
 * Role-based Navigation and Authorization Utilities
 * Roles: Owner, Supervisor, Admin
 */

export const USER_ROLES = {
  OWNER: "Owner",
  SUPERVISOR: "Supervisor",
  ADMIN: "Admin",
};

export const ALL_SYSTEM_MENUS = [
  { path: "/pos", name: "Kasir POS", description: "Pencatatan kasir dan penjualan optik" },
  { path: "/prescriptions", name: "Rekam Medis", description: "Pemeriksaan refraksi & visus mata" },
  { path: "/lab", name: "Status Pesanan", description: "Pantau antrean pesanan lab & faset" },
  { path: "/transactions", name: "Daftar Transaksi", description: "Rekap nota dan riwayat penjualan" },
  { path: "/customers", name: "Master Pelanggan", description: "Database data pasien & pelanggan" },
  { path: "/products", name: "Master Produk", description: "Katalog frame, lensa, dan aksesoris" },
  { path: "/employees", name: "Master Pegawai", description: "Data karyawan & skema komisi" },
  { path: "/users", name: "Manajemen User", description: "Akun login pengguna sistem" },
  { path: "/expenses", name: "Pengeluaran Kas", description: "Pencatatan kas keluar & operasional" },
  { path: "/reports", name: "Laporan Keuangan", description: "Laba rugi, omset & komisi karyawan" },
  { path: "/settings", name: "Pengaturan Sistem", description: "Profil toko, struk, dan hak akses" },
];

export const DEFAULT_ROLE_PERMISSIONS = {
  Supervisor: [
    "/pos",
    "/prescriptions",
    "/lab",
    "/transactions",
    "/customers",
    "/products",
    "/expenses",
    "/reports",
  ],
  Admin: [
    "/pos",
    "/prescriptions",
    "/lab",
    "/transactions",
    "/customers",
    "/products",
  ],
};

export const ROLE_DEFAULT_ROUTES = {
  [USER_ROLES.OWNER]: "/pos",
  [USER_ROLES.SUPERVISOR]: "/pos",
  [USER_ROLES.ADMIN]: "/pos",
};

/**
 * Get landing page based on user role and permissions
 */
export const getDefaultRouteForRole = (role, permissions) => {
  if (!role) return "/login";
  if (role === USER_ROLES.OWNER) return "/pos";

  const userPerms = permissions?.[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
  if (userPerms.includes("/pos")) return "/pos";
  if (userPerms.length > 0) return userPerms[0];
  return "/pos";
};

/**
 * Check if a user role is authorized for a specific route path
 */
export const isRouteAuthorized = (userRole, routePath, rolePermissions) => {
  if (!userRole) return false;
  if (userRole === USER_ROLES.OWNER) return true;

  const perms = rolePermissions?.[userRole] || DEFAULT_ROLE_PERMISSIONS[userRole] || [];
  return perms.includes(routePath);
};

/**
 * Legacy check for backwards compatibility
 */
export const isRoleAuthorized = (userRole, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  if (userRole === USER_ROLES.OWNER) return true;
  return allowedRoles.includes(userRole);
};
