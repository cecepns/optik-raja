import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  Glasses,
  Wrench,
  Receipt,
  Users,
  Package,
  UserCheck,
  UserCog,
  WalletCards,
  BarChart3,
  Settings,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function Sidebar() {
  const location = useLocation();
  const { currentUser, logout, isSidebarOpen, setIsSidebarOpen } = useApp();

  const userRole = currentUser?.role || "Kasir";

  const navigation = [
    { name: "Kasir POS", path: "/pos", icon: ShoppingCart, roles: ["Owner", "Kasir"] },
    { name: "Resep Pasien (RO)", path: "/prescriptions", icon: Glasses, roles: ["Owner", "Kasir", "Refraksionis Optisien"] },
    { name: "Status Lab & Faset", path: "/lab", icon: Wrench, roles: ["Owner", "Kasir", "Teknisi Lab"] },
    { name: "Daftar Transaksi", path: "/transactions", icon: Receipt, roles: ["Owner", "Kasir"] },
    { name: "Master Pelanggan", path: "/customers", icon: Users, roles: ["Owner", "Kasir", "Refraksionis Optisien"] },
    { name: "Master Produk", path: "/products", icon: Package, roles: ["Owner", "Kasir"] },
    { name: "Master Pegawai", path: "/employees", icon: UserCheck, roles: ["Owner"] },
    { name: "Manajemen User", path: "/users", icon: UserCog, roles: ["Owner"] },
    { name: "Pengeluaran Kas", path: "/expenses", icon: WalletCards, roles: ["Owner"] },
    { name: "Laporan Keuangan", path: "/reports", icon: BarChart3, roles: ["Owner"] },
    { name: "Pengaturan Sistem", path: "/settings", icon: Settings, roles: ["Owner"] },
  ];

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-72 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center">
            <img
              src="/logo.png"
              alt="Logo Optik Raja"
              className="h-11 w-auto object-contain rounded-xl"
            />
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
          <div className="px-3 pb-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
            Menu Operasional
          </div>

          {filteredNav.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-600"}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* User Profile & Logout Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/70">
          <div className="flex items-center justify-between gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {currentUser?.name || "Pengguna"}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-semibold text-slate-500 truncate">
                    {userRole}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              title="Keluar dari sistem"
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
