import React, { useState } from "react";
import {
  Download,
  CheckCircle2,
  Smartphone,
  Monitor,
  Info,
  Share,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import Modal from "@/components/common/Modal";

export default function PwaInstallCard() {
  const { deferredPrompt, isInstalled, installApp } = usePwaInstall();
  const [showModal, setShowModal] = useState(false);

  // Detect user OS for smart default tab
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "android";
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "desktop";
  });

  const handleActionClick = async () => {
    if (deferredPrompt) {
      const handled = await installApp();
      if (!handled) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 border border-slate-200/90 hover:border-blue-200 rounded-2xl p-3.5 transition-all shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Logo: Kecil, Background Putih, Tidak Ter-stretch */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="Logo PWA Optik Raja"
                className="w-full h-full object-contain"
                loading="eager"
              />
            </div>

            {/* Info Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                  Download Aplikasi
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-100 text-blue-700">
                  <Sparkles className="w-2.5 h-2.5" /> PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {isInstalled
                  ? "Aplikasi sudah terpasang di perangkat"
                  : "Pasang di HP / Laptop untuk akses cepat & ringan"}
              </p>
            </div>

            {/* Action Button */}
            {isInstalled ? (
              <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terpasang</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleActionClick}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer shrink-0"
                title="Download / Pasang Aplikasi PWA Optik Raja"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}
          </div>

          {/* Bottom link: Guide */}
          <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Tanpa download dari Play Store / App Store</span>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer flex items-center gap-1 transition-colors"
            >
              <Info className="w-3 h-3" />
              <span>Petunjuk pasang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Petunjuk Pasang PWA */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Instalasi Aplikasi Optik Raja"
        subtitle="Akses cepat tanpa browser seperti aplikasi bawaan HP"
        maxWidth="max-w-lg"
        footer={
          <div className="w-full flex items-center justify-between gap-2">
            <span className="text-xs text-slate-400">PWA • Progressive Web App</span>
            <div className="flex items-center gap-2">
              {deferredPrompt && !isInstalled && (
                <button
                  type="button"
                  onClick={async () => {
                    await installApp();
                    setShowModal(false);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Pasang Sekarang</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header Card dengan Logo Kecil & Background Putih */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center p-1.5 shrink-0">
              <img
                src="/pwa-192x192.png"
                alt="Logo PWA"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Optik Raja POS & Lab System
              </h4>
              <p className="text-xs text-slate-500">
                Bisa dibuka langsung dari Home Screen / Layar Utama HP & Desktop.
              </p>
            </div>
          </div>

          {/* Tab Pilihan Perangkat */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("android")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "android"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ios")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "ios"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iOS (iPhone/iPad)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("desktop")}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === "desktop"
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Komputer / PC</span>
            </button>
          </div>

          {/* Panduan per Platform */}
          {activeTab === "android" && (
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  Buka website ini menggunakan browser <strong>Google Chrome</strong> di HP Android Anda.
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p>
                  Ketuk tombol <strong>Download / Pasang</strong> di halaman login, atau ketuk menu titik tiga (<strong>⋮</strong>) di sudut kanan atas browser Chrome.
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  Pilih opsi <strong>&quot;Install aplikasi&quot;</strong> atau <strong>&quot;Tambahkan ke Layar Utama&quot;</strong> (Add to Home Screen).
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  4
                </span>
                <p>
                  Ikon aplikasi <strong>Optik Raja</strong> akan muncul di menu HP Anda dan siap digunakan layaknya aplikasi bawaan.
                </p>
              </div>
            </div>
          )}

          {activeTab === "ios" && (
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  Buka website ini menggunakan browser <strong>Safari</strong> di iPhone atau iPad Anda (Apple mewajibkan instalasi PWA via Safari).
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p>
                  Ketuk tombol <strong>Bagikan (Share)</strong>{" "}
                  <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 font-mono text-[10px]">
                    <Share className="w-3 h-3 inline mr-1 text-blue-600" /> Share
                  </span>{" "}
                  di bilah navigasi bagian bawah layar.
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  Gulir ke bawah pada menu yang muncul, lalu pilih{" "}
                  <strong>&quot;Tambahkan ke Layar Utama&quot; (Add to Home Screen)</strong>{" "}
                  <Plus className="w-3 h-3 inline text-blue-600" />.
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  4
                </span>
                <p>
                  Ketuk <strong>Tambah (Add)</strong> di sudut kanan atas layar. Selesai!
                </p>
              </div>
            </div>
          )}

          {activeTab === "desktop" && (
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  Gunakan browser <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, atau <strong>Brave</strong> di laptop/komputer.
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p>
                  Klik ikon <strong>Install</strong> (simbol monitor atau panah ke bawah) di ujung kanan bilah alamat URL (address bar).
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  Atau klik menu titik tiga (<strong>⋮</strong>) di sudut kanan atas browser &gt; pilih <strong>&quot;Install Optik Raja&quot;</strong>.
                </p>
              </div>
              <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  4
                </span>
                <p>
                  Aplikasi akan terbuka mandiri di jendela terpisah dengan performa responsif dan ringan.
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
