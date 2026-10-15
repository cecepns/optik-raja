import React from "react";
import { AlertTriangle, Trash2, CheckCircle2, AlertCircle, Info, Check } from "lucide-react";
import Modal from "./Modal";

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Konfirmasi Hapus",
  message = "Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.",
  confirmText = "Ya, Hapus Data",
  cancelText = "Batal",
  confirmVariant = "danger",
  isLoading = false,
}) {
  const getVariantConfig = () => {
    switch (confirmVariant) {
      case "success":
        return {
          iconBox: "bg-emerald-100 text-emerald-600",
          headerIcon: <CheckCircle2 className="w-6 h-6" />,
          buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
          btnIcon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
        };
      case "primary":
      case "info":
        return {
          iconBox: "bg-blue-100 text-blue-600",
          headerIcon: <Info className="w-6 h-6" />,
          buttonBg: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20",
          btnIcon: <Check className="w-4 h-4 shrink-0" />,
        };
      case "warning":
        return {
          iconBox: "bg-amber-100 text-amber-600",
          headerIcon: <AlertCircle className="w-6 h-6" />,
          buttonBg: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20",
          btnIcon: <AlertCircle className="w-4 h-4 shrink-0" />,
        };
      case "danger":
      default:
        return {
          iconBox: "bg-red-100 text-red-600",
          headerIcon: <AlertTriangle className="w-6 h-6" />,
          buttonBg: "bg-red-600 hover:bg-red-700 text-white shadow-red-600/20",
          btnIcon: <Trash2 className="w-4 h-4 shrink-0" />,
        };
    }
  };

  const config = getVariantConfig();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-50 text-center cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl active:scale-[0.99] transition-all shadow-sm hover:shadow disabled:opacity-50 text-center cursor-pointer ${config.buttonBg}`}
          >
            {config.btnIcon}
            <span className="leading-tight sm:whitespace-nowrap">
              {isLoading ? "Memproses..." : confirmText}
            </span>
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3.5 sm:gap-4 py-1 sm:py-2">
        <div
          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl ${config.iconBox} flex items-center justify-center shrink-0 shadow-xs`}
        >
          {config.headerIcon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-700 text-sm sm:text-base leading-relaxed break-words">
            {message}
          </p>
        </div>
      </div>
    </Modal>
  );
}
