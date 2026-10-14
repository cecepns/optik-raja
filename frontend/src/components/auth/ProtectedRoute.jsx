import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { getDefaultRouteForRole } from "@/utils/roles";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    const fallbackRoute = getDefaultRouteForRole(currentUser.role);
    // Prevent infinite redirect loop if current route matches fallback route
    if (location.pathname === fallbackRoute) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center font-bold text-xl mb-3">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-800">Akses Terbatas</h2>
          <p className="text-sm text-slate-500 mt-1">
            Akun Anda ({currentUser.role}) tidak memiliki izin untuk membuka halaman ini.
          </p>
        </div>
      );
    }
    return <Navigate to={fallbackRoute} replace />;
  }

  return children;
}
