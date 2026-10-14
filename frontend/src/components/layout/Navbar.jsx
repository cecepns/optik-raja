import React from "react";
import { Menu, ShoppingCart, Glasses, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/context/AppContext";

export default function Navbar() {
  const { currentUser, settings, setIsSidebarOpen } = useApp();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
      <div className="flex items-center justify-between px-5 sm:px-7 py-3">
        {/* Left: Mobile Toggle & Clean Store Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden"
            title="Buka Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <span className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
            {settings.store_name || "Optik Raja"}
          </span>
        </div>

        {/* Right: Quick Action button & Active User */}
        <div className="flex items-center gap-3 sm:gap-4">
          {["Owner", "Kasir"].includes(currentUser?.role) && (
            <Link
              to="/pos"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Kasir POS</span>
            </Link>
          )}

          {currentUser?.role === "Refraksionis Optisien" && (
            <Link
              to="/prescriptions"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
            >
              <Glasses className="w-4 h-4" />
              <span>Rekam Medis</span>
            </Link>
          )}

          {currentUser?.role === "Teknisi Lab" && (
            <Link
              to="/lab"
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-xs transition-colors"
            >
              <Wrench className="w-4 h-4" />
              <span>Status Lab</span>
            </Link>
          )}

          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-extrabold text-sm border border-blue-200 shadow-2xs">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-bold text-slate-800 leading-none">
                {currentUser?.name || "Pengguna"}
              </p>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                {currentUser?.role || "Staff"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
