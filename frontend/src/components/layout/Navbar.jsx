import React from "react";
import { Menu, ShoppingCart, Glasses, Wrench, LogOut } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "@/context/AppContext";

const PAGE_TITLES = {
  "/pos": "Kasir POS",
  "/prescriptions": "Rekam Medis Pasien",
  "/lab": "Status Pesanan",
  "/transactions": "Daftar Transaksi",
  "/customers": "Master Pelanggan",
  "/products": "Master Produk",
  "/employees": "Master Pegawai",
  "/users": "Manajemen User",
  "/expenses": "Pengeluaran Kas",
  "/reports": "Laporan Keuangan",
  "/settings": "Pengaturan Sistem",
};

export default function Navbar() {
  const { currentUser, settings, setIsSidebarOpen, logout } = useApp();
  const location = useLocation();

  const currentTitle = PAGE_TITLES[location.pathname] || "";

  // Dynamic theme per role for avatar & badges
  const getRoleConfig = (role) => {
    switch (role) {
      case "Owner":
        return {
          label: "Owner",
          badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
          avatarBg: "bg-purple-100 text-purple-700 border-purple-200",
        };
      case "Refraksionis Optisien":
        return {
          label: "Refraksionis",
          badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
          avatarBg: "bg-blue-100 text-blue-700 border-blue-200",
        };
      case "Teknisi Lab":
        return {
          label: "Teknisi Lab",
          badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
          avatarBg: "bg-amber-100 text-amber-700 border-amber-200",
        };
      case "Kasir":
      default:
        return {
          label: "Kasir",
          badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
          avatarBg: "bg-emerald-100 text-emerald-700 border-emerald-200",
        };
    }
  };

  const roleConfig = getRoleConfig(currentUser?.role);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 h-14 sm:h-16 gap-2 sm:gap-4 max-w-full overflow-hidden">
        {/* Left: Mobile Toggle & Store Title / Page Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 shadow-2xs lg:hidden shrink-0 transition-colors"
            title="Buka Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base lg:text-lg text-slate-900 tracking-tight truncate whitespace-nowrap">
              {settings?.store_name || "Optik Raja"}
            </span>

            {currentTitle && (
              <>
                <span className="hidden md:inline-block text-slate-300 font-light select-none">
                  /
                </span>
                <span className="hidden md:inline-block text-xs lg:text-sm font-semibold text-slate-500 truncate whitespace-nowrap">
                  {currentTitle}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Quick Action button & Active User */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Quick Action Button for Owner & Kasir */}
          {["Owner", "Kasir"].includes(currentUser?.role) && (
            <Link
              to="/pos"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs whitespace-nowrap shrink-0 transition-colors"
              title="Kasir POS"
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                <span className="hidden sm:inline">Kasir </span>POS
              </span>
            </Link>
          )}

          {/* Quick Action Button for Refraksionis Optisien */}
          {currentUser?.role === "Refraksionis Optisien" && (
            <Link
              to="/prescriptions"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs whitespace-nowrap shrink-0 transition-colors"
              title="Rekam Medis Pasien"
            >
              <Glasses className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                <span className="hidden sm:inline">Rekam </span>Medis
              </span>
            </Link>
          )}

          {/* Quick Action Button for Teknisi Lab */}
          {currentUser?.role === "Teknisi Lab" && (
            <Link
              to="/lab"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs whitespace-nowrap shrink-0 transition-colors"
              title="Status Lab & Faset"
            >
              <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>
                <span className="hidden sm:inline">Status </span>Lab
              </span>
            </Link>
          )}

          {/* User Profile Container */}
          <div className="flex items-center gap-2 sm:gap-2.5 pl-2 sm:pl-3 border-l border-slate-200 shrink-0">
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${roleConfig.avatarBg} flex items-center justify-center font-extrabold text-xs sm:text-sm border shadow-2xs shrink-0`}
              title={`${currentUser?.name || "Pengguna"} (${currentUser?.role || "Staff"})`}
            >
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>

            <div className="hidden md:block text-left min-w-0 max-w-[130px] lg:max-w-[160px]">
              <p className="text-xs lg:text-sm font-bold text-slate-800 leading-tight truncate">
                {currentUser?.name || "Pengguna"}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${roleConfig.badgeClass}`}
                >
                  {roleConfig.label}
                </span>
              </div>
            </div>

            {/* Quick Logout Button */}
            <button
              type="button"
              onClick={logout}
              title="Keluar dari sistem"
              className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
