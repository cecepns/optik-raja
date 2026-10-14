import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, User, Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, isAuthenticated, currentUser, settings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // If already authenticated, redirect to destination
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      const from = location.state?.from?.pathname || "/pos";
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, currentUser, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Silakan masukkan username dan password");
      return;
    }

    try {
      setIsLoading(true);
      await login(username.trim(), password);
      const from = location.state?.from?.pathname || "/pos";
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(err.message || "Gagal masuk ke sistem");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (u, p) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
        {/* Logo & Header di Atas */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img
              src="/logo.png"
              alt="Logo Optik Raja"
              className="h-14 sm:h-16 w-auto max-w-[260px] object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Masuk ke Sistem
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Silakan masukkan username dan password Anda
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              Username atau Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15 transition-all outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15 transition-all outline-hidden font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? "Sembunyikan sandi" : "Tampilkan sandi"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-slate-600">Ingat saya</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition-all disabled:opacity-60 cursor-pointer mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Login Preset */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 text-center">
            Pilihan Akun Demo (Klik untuk Isi):
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin("owner", "admin123")}
              className="p-2 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-left transition-all cursor-pointer"
            >
              <p className="text-xs font-bold leading-tight">Owner</p>
              <p className="text-[10px] text-purple-600 font-mono mt-0.5">owner</p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("kasir", "kasir123")}
              className="p-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-left transition-all cursor-pointer"
            >
              <p className="text-xs font-bold leading-tight">Kasir</p>
              <p className="text-[10px] text-emerald-600 font-mono mt-0.5">kasir</p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("optisien", "optik123")}
              className="p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-left transition-all cursor-pointer"
            >
              <p className="text-xs font-bold leading-tight">Refraksionis</p>
              <p className="text-[10px] text-blue-600 font-mono mt-0.5">optisien</p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("teknisi", "lab123")}
              className="p-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-left transition-all cursor-pointer"
            >
              <p className="text-xs font-bold leading-tight">Teknisi Lab</p>
              <p className="text-[10px] text-amber-600 font-mono mt-0.5">teknisi</p>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} {settings.store_name || "Optik Raja"}. All rights reserved.
        </div>
      </div>
    </div>
  );
}
