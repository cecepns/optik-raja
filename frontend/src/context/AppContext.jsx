import React, { createContext, useContext, useState, useEffect } from "react";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import toast from "react-hot-toast";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("optik_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem("optik_token") || null);

  const [settings, setSettings] = useState({
    store_name: "Optik Raja Official",
    optician_permit_no: "KEMENKES RI NO. 445/RO-OPT/JBR/2024",
    phone: "0812-9876-5432",
    address: "Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara",
    receipt_footer: "Terima kasih atas kepercayaan Anda. Garansi stel kacamata & servis gratis selamanya. Garansi adaptasi lensa 30 hari.",
    printer_paper_size: "58mm",
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await request.get(API_ENDPOINTS.SETTINGS.GET);
      if (res?.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error("Gagal memuat pengaturan toko:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const login = async (username, password) => {
    const res = await request.post(API_ENDPOINTS.AUTH.LOGIN, { username, password });
    if (res?.success && res?.data?.user && res?.data?.token) {
      setCurrentUser(res.data.user);
      setToken(res.data.token);
      localStorage.setItem("optik_user", JSON.stringify(res.data.user));
      localStorage.setItem("optik_token", res.data.token);
      toast.success(res.message || "Selamat datang kembali!");
      return res.data.user;
    }
    throw new Error(res?.message || "Login gagal, periksa username dan password Anda.");
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem("optik_user");
    localStorage.removeItem("optik_token");
    toast.success("Anda berhasil keluar dari sistem");
  };

  const rolePermissions = settings?.role_permissions || currentUser?.role_permissions || {
    Supervisor: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products", "/expenses", "/reports"],
    Admin: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products"],
  };

  const switchRole = (newRole) => {
    if (!currentUser) return;
    const updated = { ...currentUser, role: newRole };
    setCurrentUser(updated);
    localStorage.setItem("optik_user", JSON.stringify(updated));
    toast.success(`Beralih ke peran: ${newRole}`);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        token,
        isAuthenticated: Boolean(currentUser && token),
        login,
        logout,
        settings,
        setSettings,
        fetchSettings,
        rolePermissions,
        isSidebarOpen,
        setIsSidebarOpen,
        switchRole,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
