import React from "react";
import { Printer, X, FileText, CheckCircle2, MessageCircle } from "lucide-react";
import { formatDate, formatDiopter } from "@/utils/formatters";
import { useApp } from "@/context/AppContext";
import { sendWhatsAppMessage, buildPrescriptionWhatsAppMessage } from "@/utils/whatsapp";

export default function PrescriptionPrintModal({ isOpen, onClose, prescription }) {
  const { settings } = useApp();

  if (!isOpen || !prescription) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleSendWhatsApp = () => {
    const msg = buildPrescriptionWhatsAppMessage(prescription, settings);
    sendWhatsAppMessage(prescription.customer_phone, msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden my-6">
        {/* Action Header - hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-sm text-gray-900">
                Kartu Resep Kacamata & Rekam Medis
              </h3>
              <p className="text-xs text-gray-500">
                Format standar medis refraksi optik
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Kirim Resep ke WhatsApp Pasien"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim WhatsApp</span>
              <span className="sm:hidden">WA</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak (Print)</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prescription Document Canvas */}
        <div className="p-8 bg-white text-gray-900 printable-area max-h-[85vh] overflow-y-auto text-xs sm:text-sm">
          {/* Clinic Header */}
          <div className="flex items-center justify-between border-b-2 border-blue-900 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Logo Optik"
                className="w-12 h-12 object-contain rounded-lg p-1 border border-gray-200"
              />
              <div>
                <h1 className="text-lg font-extrabold text-blue-900 tracking-tight leading-tight">
                  {settings.store_name || "OPTIK RAJA OFFICIAL"}
                </h1>
                <p className="text-[11px] font-semibold text-gray-600">
                  {settings.optician_permit_no}
                </p>
                <p className="text-[11px] text-gray-500">
                  {settings.address} • Telp/WA: {settings.phone}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-800 rounded border border-blue-200 uppercase tracking-wider">
                Kartu Refraksi Medis
              </span>
              <p className="text-[11px] text-gray-500 mt-1">
                Tgl: {formatDate(prescription.exam_date)}
              </p>
            </div>
          </div>

          {/* Patient Details */}
          <div className="bg-gray-50/75 p-3.5 rounded-lg border border-gray-200 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Nama Pasien:</span>
              <span className="font-bold text-gray-900 text-sm">{prescription.customer_name}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">No HP / WA:</span>
              <span className="font-medium text-gray-800">{prescription.customer_phone}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Usia / Gender:</span>
              <span className="font-medium text-gray-800">
                {prescription.customer_age ? `${prescription.customer_age} Thn` : "-"} / {prescription.customer_gender || "-"}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px] uppercase font-semibold">Pemeriksa (RO):</span>
              <span className="font-bold text-blue-700">{prescription.examiner_name}</span>
            </div>
          </div>

          {/* Optical Rx Matrix OD vs OS */}
          <div className="mb-5 overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-center text-xs">
              <thead>
                <tr className="bg-blue-900 text-white font-semibold">
                  <th className="border border-gray-300 py-2 px-2 text-left whitespace-nowrap">Mata (Eye)</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">UCVA</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">SPH</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">CYL</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">AXIS</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">BCVA</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">ADD</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">MPD</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">PV</th>
                  <th className="border border-gray-300 py-2 px-2 whitespace-nowrap">SH</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="border border-gray-300 py-2.5 px-2 text-left font-bold text-blue-900 whitespace-nowrap">
                    OD (Kanan)
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-medium">{prescription.od_ucva || "-"}</td>
                  <td className="border border-gray-300 py-2.5 px-2 font-bold text-sm text-gray-900">
                    {formatDiopter(prescription.od_sph)}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-semibold">
                    {formatDiopter(prescription.od_cyl)}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-semibold">
                    {prescription.od_axis ? `${prescription.od_axis}°` : "0°"}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-medium text-emerald-700">
                    {prescription.od_bcva || "6/6"}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-bold text-indigo-700">
                    {formatDiopter(prescription.od_add)}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2">{prescription.od_mpd ? `${prescription.od_mpd} mm` : "-"}</td>
                  <td className="border border-gray-300 py-2.5 px-2">{prescription.od_pv || "-"}</td>
                  <td className="border border-gray-300 py-2.5 px-2">{prescription.od_sh || "-"}</td>
                </tr>
                <tr className="bg-white hover:bg-gray-50">
                  <td className="border border-gray-300 py-2.5 px-2 text-left font-bold text-blue-900 whitespace-nowrap">
                    OS (Kiri)
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-medium">{prescription.os_ucva || "-"}</td>
                  <td className="border border-gray-300 py-2.5 px-2 font-bold text-sm text-gray-900">
                    {formatDiopter(prescription.os_sph)}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-semibold">
                    {formatDiopter(prescription.os_cyl)}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-semibold">
                    {prescription.os_axis ? `${prescription.os_axis}°` : "0°"}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-medium text-emerald-700">
                    {prescription.os_bcva || "6/6"}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2 font-bold text-indigo-700">
                    {formatDiopter(prescription.os_add)}
                  </td>
                  <td className="border border-gray-300 py-2.5 px-2">{prescription.os_mpd ? `${prescription.os_mpd} mm` : "-"}</td>
                  <td className="border border-gray-300 py-2.5 px-2">{prescription.os_pv || "-"}</td>
                  <td className="border border-gray-300 py-2.5 px-2">{prescription.os_sh || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Secondary Parameters & Diagnoses */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
              <span className="text-[10px] font-bold text-blue-800 uppercase block">Total PD (Pupillary Distance)</span>
              <span className="text-base font-extrabold text-blue-900">
                {prescription.total_pd ? `${prescription.total_pd} mm` : "-"}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 sm:col-span-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase block">Keluhan / Diagnosa Refraksi</span>
              <p className="text-xs text-gray-800 mt-0.5">
                {prescription.complaint_diagnose || "Pemeriksaan refraksi rutin, tanpa keluhan spesifik."}
              </p>
            </div>
          </div>

          {prescription.notes && (
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 mb-6 text-xs text-amber-900">
              <span className="font-bold block text-[10px] uppercase">Rekomendasi Lensa / Catatan:</span>
              <p className="mt-0.5">{prescription.notes}</p>
            </div>
          )}

          {/* Footer Signature */}
          <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-end text-xs">
            <div className="text-gray-500 text-[11px] max-w-xs">
              <p>* Resep ini diterbitkan oleh tenaga Refraksionis Optisien berizin resmi.</p>
              <p>* Harap periksakan mata Anda secara berkala minimal 1 tahun sekali.</p>
            </div>
            <div className="text-center w-48">
              <p className="text-gray-600 mb-12">Pemeriksa,</p>
              <p className="font-bold text-gray-900 underline">{prescription.examiner_name}</p>
              <p className="text-[10px] text-gray-500">Refraksionis Optisien (RO)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
