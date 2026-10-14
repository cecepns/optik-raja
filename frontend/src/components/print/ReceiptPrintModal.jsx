import React, { useState } from "react";
import {
  Printer,
  Download,
  Bluetooth,
  X,
  CheckCircle,
  Clock,
  Loader2,
  FileText,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";
import { formatRupiah, formatDateTime, formatDate } from "@/utils/formatters";
import { useApp } from "@/context/AppContext";
import {
  printReceiptStandard,
  downloadReceiptPdf,
  printReceiptBluetooth,
} from "@/utils/receiptPrinter";

export default function ReceiptPrintModal({ isOpen, onClose, transaction }) {
  const { settings } = useApp();

  const [isPrintingBluetooth, setIsPrintingBluetooth] = useState(false);
  const [bluetoothStatus, setBluetoothStatus] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!isOpen || !transaction) return null;

  const isDp = transaction.payment_status === "DP";
  const isLunas = transaction.payment_status === "Lunas";
  const paperSize = settings.printer_paper_size || "58mm";

  // 1. Print Biasa (Standard Browser / OS Print dialog via isolated iframe)
  const handlePrintStandard = () => {
    try {
      printReceiptStandard(transaction, settings);
      toast.success("Membuka dialog cetak printer...");
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuka dialog cetak: " + err.message);
    }
  };

  // 2. Download PDF (Receipt Ticket format)
  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    try {
      downloadReceiptPdf(transaction, settings);
      toast.success("Struk PDF berhasil diunduh!");
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengunduh PDF: " + err.message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // 3. Print Bluetooth (Web Bluetooth ESC/POS Direct)
  const handlePrintBluetooth = async () => {
    setIsPrintingBluetooth(true);
    setBluetoothStatus("Mempersiapkan koneksi bluetooth...");
    try {
      const printerName = await printReceiptBluetooth(
        transaction,
        settings,
        (status) => {
          setBluetoothStatus(status);
        }
      );
      toast.success(`Berhasil mencetak ke ${printerName}!`);
    } catch (err) {
      console.error(err);
      if (err.name === "NotFoundError" || err.message?.includes("User cancelled")) {
        toast("Pencarian printer bluetooth dibatalkan", { icon: "ℹ️" });
      } else {
        toast.error(err.message || "Gagal mencetak via Bluetooth");
      }
    } finally {
      setIsPrintingBluetooth(false);
      setBluetoothStatus("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-4 sm:my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-400" />
            <h3 className="font-bold text-sm tracking-tight">Cetak Struk Kasir</h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-blue-300 border border-slate-700">
              {paperSize}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Quick Action Buttons */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-gray-200 shrink-0">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Pilihan Metode Cetak / Unduh:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Opsi 1: Print Biasa */}
            <button
              type="button"
              onClick={handlePrintStandard}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Cetak lewat dialog printer biasa (kabel / WiFi / network / PDF printer)"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Print Biasa</span>
            </button>

            {/* Opsi 2: Print Bluetooth */}
            <button
              type="button"
              onClick={handlePrintBluetooth}
              disabled={isPrintingBluetooth}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Cetak langsung ke printer kasir mini termal Bluetooth (ESC/POS)"
            >
              {isPrintingBluetooth ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <Bluetooth className="w-4 h-4 shrink-0" />
              )}
              <span>Termal Bluetooth</span>
            </button>

            {/* Opsi 3: Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Unduh file struk format PDF ukuran struk termal"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              <span>Download PDF</span>
            </button>
          </div>

          {/* Bluetooth Progress Banner */}
          {isPrintingBluetooth && (
            <div className="mt-2.5 px-3 py-2 bg-indigo-100/80 border border-indigo-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-indigo-900 animate-pulse">
              <Bluetooth className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{bluetoothStatus || "Sedang memproses..."}</span>
            </div>
          )}
        </div>

        {/* Thermal Receipt Paper Layout (Scrollable Preview) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/90 flex flex-col items-center">
          <div
            className={`w-full ${
              paperSize === "80mm" ? "max-w-[340px]" : "max-w-[300px]"
            } bg-white shadow-2xl p-6 text-gray-900 text-xs font-mono rounded-xl border border-gray-300 select-none my-2 mb-8 shrink-0`}
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight uppercase text-gray-900">
                {settings.store_name || "Optik Raja"}
              </h2>
              {settings.optician_permit_no && (
                <p className="text-[10px] text-gray-600 mt-0.5 font-sans font-medium">
                  SIP: {settings.optician_permit_no}
                </p>
              )}
              {settings.address && (
                <p className="text-[10px] text-gray-600 mt-0.5 leading-snug">{settings.address}</p>
              )}
              {settings.phone && (
                <p className="text-[10px] text-gray-600 font-sans">Telp/WA: {settings.phone}</p>
              )}
            </div>

            {/* Transaction Metadata */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-gray-500">No Nota:</span>
                <span className="font-bold text-gray-900">{transaction.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal:</span>
                <span>{formatDateTime(transaction.transaction_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kasir:</span>
                <span>{transaction.employee_name || "Kasir"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pelanggan:</span>
                <span className="font-bold text-gray-900">{transaction.customer_name}</span>
              </div>
              {transaction.completion_estimate && (
                <div className="flex justify-between text-blue-800 font-bold">
                  <span className="shrink-0">Est. Selesai:</span>
                  <span className="text-right">{formatDate(transaction.completion_estimate)}</span>
                </div>
              )}
            </div>

            {/* Items List */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-2">
              <div className="text-[10px] font-bold uppercase text-gray-500 flex justify-between">
                <span>Item & Qty</span>
                <span>Total</span>
              </div>
              {(transaction.items || []).map((item, idx) => (
                <div key={idx} className="space-y-0.5 text-[11px]">
                  <div className="font-bold text-gray-900 leading-tight">{item.product_name}</div>
                  <div className="flex justify-between text-gray-600 text-[10px]">
                    <span>
                      {item.quantity} x {formatRupiah(item.price)}
                      {item.discount > 0 && ` (-${formatRupiah(item.discount)})`}
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatRupiah(item.total_price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals & Payments */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatRupiah(transaction.subtotal)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon:</span>
                  <span>-{formatRupiah(transaction.discount_amount)}</span>
                </div>
              )}
              {transaction.bpjs_subsidy > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Subsidi BPJS:</span>
                  <span>-{formatRupiah(transaction.bpjs_subsidy)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-xs sm:text-sm text-gray-900 pt-1.5 border-t border-gray-300">
                <span>TOTAL:</span>
                <span className="text-blue-900">{formatRupiah(transaction.grand_total)}</span>
              </div>
              <div className="flex justify-between pt-1 text-gray-600">
                <span>Metode Bayar:</span>
                <span className="font-bold text-gray-800">{transaction.payment_method}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900">
                <span>{isDp ? "Uang Muka (DP):" : "Dibayar:"}</span>
                <span>{formatRupiah(transaction.paid_amount)}</span>
              </div>
              {isDp && (
                <div className="flex justify-between font-extrabold text-red-600">
                  <span>SISA TAGIHAN:</span>
                  <span>{formatRupiah(transaction.remaining_amount)}</span>
                </div>
              )}
              {!isDp && transaction.change_amount > 0 && (
                <div className="flex justify-between text-emerald-800 font-semibold">
                  <span>Kembalian:</span>
                  <span>{formatRupiah(transaction.change_amount)}</span>
                </div>
              )}
            </div>

            {/* Payment Status Stamp */}
            <div className="py-3 text-center">
              <div
                className={`inline-block px-3.5 py-1 text-xs font-black uppercase rounded border-2 tracking-wider ${
                  isLunas
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                    : "border-amber-600 text-amber-700 bg-amber-50"
                }`}
              >
                {isLunas
                  ? "STATUS: LUNAS"
                  : `STATUS: DP (SISA ${formatRupiah(transaction.remaining_amount)})`}
              </div>
            </div>

            {/* Footer Note */}
            <div className="text-center pt-3 text-[10px] text-gray-600 space-y-1.5 border-t border-dashed border-gray-300 mt-3">
              {settings.receipt_footer && (
                <p className="font-sans leading-relaxed text-gray-700 font-medium">
                  {settings.receipt_footer}
                </p>
              )}
              <p className="text-[9px] text-gray-400 font-sans">
                --- Simpan struk ini sebagai bukti transaksi ---
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-white border-t border-gray-200 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400 hidden sm:flex">
            <Info className="w-3.5 h-3.5" />
            <span>Format kertas printer: {paperSize}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors ml-auto cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
