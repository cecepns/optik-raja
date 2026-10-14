import React, { useState, useEffect } from "react";
import {
  Settings,
  Store,
  Printer,
  ShieldCheck,
  Save,
  CheckCircle2,
  FileText,
  Phone,
  MapPin,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { useApp } from "@/context/AppContext";
import ReceiptPrintModal from "@/components/print/ReceiptPrintModal";

export default function SettingsPage() {
  const { settings, fetchSettings, currentUser, switchRole } = useApp();

  const [formData, setFormData] = useState({
    store_name: "",
    optician_permit_no: "",
    phone: "",
    address: "",
    receipt_footer: "",
    printer_paper_size: "58mm",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showTestReceipt, setShowTestReceipt] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        store_name: settings.store_name || "",
        optician_permit_no: settings.optician_permit_no || "",
        phone: settings.phone || "",
        address: settings.address || "",
        receipt_footer: settings.receipt_footer || "",
        printer_paper_size: settings.printer_paper_size || "58mm",
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await request.put(API_ENDPOINTS.SETTINGS.UPDATE, formData);
      if (res?.success) {
        toast.success("Pengaturan profil toko berhasil disimpan!");
        await fetchSettings();
      }
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan pengaturan");
    } finally {
      setIsSaving(false);
    }
  };

  // Mock sample transaction for test printing
  const testTransaction = {
    invoice_number: "TEST-NOTA-0001",
    transaction_date: new Date().toISOString(),
    employee_name: currentUser.name,
    customer_name: "Pasien Uji Coba Printer",
    completion_estimate: "2026-10-15",
    items: [
      { product_name: "Frame Titanium Rimless (Sample)", quantity: 1, price: 780000, discount: 0, total_price: 780000 },
      { product_name: "Lensa Essilor Crizal 1.60 (Sample)", quantity: 1, price: 1350000, discount: 0, total_price: 1350000 },
    ],
    subtotal: 2130000,
    discount_amount: 0,
    bpjs_subsidy: 0,
    grand_total: 2130000,
    paid_amount: 1000000,
    change_amount: 0,
    payment_status: "DP",
    payment_method: "Tunai",
    dp_amount: 1000000,
    remaining_amount: 1130000,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Pengaturan Sistem & Profil Optik
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Konfigurasi informasi toko optik, izin operasional, format struk, dan koneksi printer thermal
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left (2 cols): Store Profile & Receipt Settings */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">
                Identitas Toko & Surat Izin Optik
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Nama Toko Optik <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.store_name}
                  onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Optik Raja Official"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Nomor Izin Optik (SIP / Kemenkes)
                </label>
                <input
                  type="text"
                  value={formData.optician_permit_no}
                  onChange={(e) => setFormData({ ...formData, optician_permit_no: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="KEMENKES RI NO. 445/RO-OPT/JBR/2024"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Nomor Telepon / WhatsApp Toko
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0812-9876-5432"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Format Kertas Printer Thermal
                </label>
                <select
                  value={formData.printer_paper_size}
                  onChange={(e) => setFormData({ ...formData, printer_paper_size: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                >
                  <option value="58mm">58 mm (Printer Kasir Standard / Bluetooth)</option>
                  <option value="80mm">80 mm (Printer Kasir Lebar Desktop)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Alamat Lengkap Gerai Optik
              </label>
              <textarea
                rows="2"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Jl. Merdeka Raya No. 88..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Catatan Penutup Struk (Footer Note)
              </label>
              <textarea
                rows="2"
                value={formData.receipt_footer}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Terima kasih atas kunjungan Anda. Garansi stel kacamata selamanya..."
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Menyimpan..." : "Simpan Pengaturan Toko"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right (1 col): Printer Testing & RBAC Access Matrix */}
        <div className="space-y-4">
          {/* Printer Peripherals Box */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <Printer className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold">Koneksi & Simulasi Printer</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Dukungan pencetakan struk transaksi thermal bluetooth ESC/POS langsung via peramban web maupun sistem kasir.
            </p>
            <div className="p-3 bg-gray-50 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Status Driver:</span>
                <span className="font-bold text-emerald-600">Siap Cetak (Web Print API)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ukuran Kertas:</span>
                <span className="font-bold text-gray-800">{formData.printer_paper_size}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowTestReceipt(true)}
              className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Uji Coba Cetak Struk (Test Print)</span>
            </button>
          </div>

          {/* RBAC Info Box */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-gray-800">
              <ShieldCheck className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-bold">Hak Akses Pengguna (RBAC)</h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Pembatasan hak akses menu sesuai peran petugas:
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="font-bold text-emerald-900 block">Kasir / RO:</span>
                <span className="text-emerald-700 text-[11px]">
                  Fokus operasional: transaksi penjualan POS, rekam medis resep, dan monitoring proses lab.
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-100">
                <span className="font-bold text-purple-900 block">Owner (Pemilik):</span>
                <span className="text-purple-700 text-[11px]">
                  Akses menyeluruh: laporan omzet keuangan, arus kas keluar operasional, master pegawai, komisi, dan pengaturan toko.
                </span>
              </div>
            </div>

            <div className="pt-1">
              <span className="text-[11px] font-bold text-gray-600 block mb-1">
                Beralih Mode Cepat:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchRole("Kasir")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors ${
                    currentUser.role === "Kasir"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Mode Kasir
                </button>
                <button
                  type="button"
                  onClick={() => switchRole("Owner")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-colors ${
                    currentUser.role === "Owner"
                      ? "bg-purple-600 text-white border-purple-600"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  Mode Owner
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Print Modal */}
      <ReceiptPrintModal
        isOpen={showTestReceipt}
        onClose={() => setShowTestReceipt(false)}
        transaction={testTransaction}
      />
    </div>
  );
}
