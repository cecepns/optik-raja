import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, isAuthenticated } = useApp();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/pos" replace />;
  }

  return children;
}
