/**
 * Role-based Navigation and Authorization Utilities
 */

export const USER_ROLES = {
  OWNER: "Owner",
  KASIR: "Kasir",
  REFRAKSIONIS: "Refraksionis Optisien",
  TEKNISI: "Teknisi Lab",
};

export const ROLE_DEFAULT_ROUTES = {
  [USER_ROLES.OWNER]: "/pos",
  [USER_ROLES.KASIR]: "/pos",
  [USER_ROLES.REFRAKSIONIS]: "/prescriptions",
  [USER_ROLES.TEKNISI]: "/lab",
};

/**
 * Get landing page based on user role
 */
export const getDefaultRouteForRole = (role) => {
  if (!role) return "/login";
  return ROLE_DEFAULT_ROUTES[role] || "/pos";
};

/**
 * Check if a role is authorized for allowed roles
 */
export const isRoleAuthorized = (userRole, allowedRoles) => {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
};
