import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "./Modal";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate } from "@/utils/formatters";
import {
  downloadPrescriptionTemplate,
  parsePrescriptionsExcel,
} from "@/utils/bulkDataHandler";

export default function PrescriptionImportModal({ isOpen, onClose, onSuccess }) {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [autoCreateCustomer, setAutoCreateCustomer] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = () => {
    setSelectedFile(null);
    setParseResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsParsing(true);
    setParseResult(null);

    try {
      const result = await parsePrescriptionsExcel(file);
      setParseResult(result);
      if (result.valid.length === 0) {
        toast.error("Tidak ada baris data rekam medis yang valid dalam file.");
      } else {
        toast.success(`Berhasil membaca ${result.valid.length} data rekam medis!`);
      }
    } catch (err) {
      console.error("Gagal parse file:", err);
      toast.error(err.message || "Gagal membaca file Excel/CSV");
      handleReset();
    } finally {
      setIsParsing(false);
    }
  };

  const handleSubmitImport = async () => {
    if (!parseResult || parseResult.valid.length === 0) {
      toast.error("Tidak ada data rekam medis valid yang dapat diimpor");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await request.post(API_ENDPOINTS.PRESCRIPTIONS.BULK_IMPORT, {
        prescriptions: parseResult.valid,
        autoCreateCustomer,
      });

      if (res?.success) {
        toast.success(res.message || "Import rekam medis berhasil!");
        handleReset();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res?.message || "Gagal mengimpor rekam medis");
      }
    } catch (err) {
      console.error("Gagal import rekam medis:", err);
      toast.error(err.message || "Terjadi kesalahan saat memproses import");
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = parseResult?.valid?.length || 0;
  const invalidCount = parseResult?.invalid?.length || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) {
          handleReset();
          onClose();
        }
      }}
      title="Import Masal Rekam Medis & Resep Mata"
      subtitle="Unggah file spreadsheet Excel (.xlsx, .xls) atau CSV untuk menambah banyak rekam medis sekaligus"
      maxWidth="max-w-5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            {parseResult && (
              <span>
                Total diproses:{" "}
                <strong className="text-slate-900">{parseResult.totalCount} baris</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmitImport}
              disabled={isSubmitting || validCount === 0}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Memproses Import...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 shrink-0" />
                  <span>Proses Import ({validCount} Rekam Medis)</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs text-slate-700">
        {/* Step 1: Download Template Helper */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-blue-900 text-xs">
                Format spreadsheet rekam medis belum sesuai?
              </h4>
              <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                Unduh template resmi berformat Excel yang telah dilengkapi contoh data nama pasien, tanggal periksa, parameter refraksi OD (Kanan) & OS (Kiri), Total PD, hingga diagnosa. Pasien yang belum ada di database dapat otomatis didaftarkan oleh sistem.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadPrescriptionTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold shadow-2xs transition-all shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Download Template Excel</span>
          </button>
        </div>

        {/* Step 2: Upload Zone */}
        <div>
          <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
            Pilih File Excel / CSV (.xlsx, .xls, .csv)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer transition-all text-center group"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-blue-100 text-slate-500 group-hover:text-blue-600 flex items-center justify-center transition-colors mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-800">
                Klik untuk memilih file rekam medis
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Format yang didukung: Microsoft Excel (.xlsx, .xls) atau Comma-Separated Values (.csv)
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">{selectedFile.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Ganti file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Step 3: Parsing State & Summary */}
        {isParsing && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Sedang membaca dan memvalidasi isi spreadsheet rekam medis...</span>
          </div>
        )}

        {parseResult && (
          <div className="space-y-4">
            {/* Stat Badges & Option Checkbox */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{validCount} Siap Diimport</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" />
                    <span>{invalidCount} Baris Tidak Lengkap</span>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCreateCustomer}
                  onChange={(e) => setAutoCreateCustomer(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>Daftarkan pasien otomatis jika belum ada di database</span>
              </label>
            </div>

            {/* Preview Table */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Pratinjau Data ({Math.min(parseResult.totalCount, 50)} dari{" "}
                  {parseResult.totalCount} baris)
                </span>
                {invalidCount > 0 && (
                  <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Baris dengan tanda merah akan dilewati saat proses import
                  </span>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">Status</th>
                      <th className="px-3 py-2">Tgl Periksa</th>
                      <th className="px-3 py-2">Nama Pasien</th>
                      <th className="px-3 py-2">No HP / WA</th>
                      <th className="px-3 py-2 bg-blue-50/70 text-blue-900 text-center">OD (R) Sph / Cyl / Axis / Add</th>
                      <th className="px-3 py-2 bg-indigo-50/70 text-indigo-900 text-center">OS (L) Sph / Cyl / Axis / Add</th>
                      <th className="px-3 py-2 text-center">Total PD</th>
                      <th className="px-3 py-2">Pemeriksa</th>
                      <th className="px-3 py-2">Diagnosa / Keluhan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parseResult.valid.slice(0, 40).map((rx, idx) => (
                      <tr key={`valid-${idx}`} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-center">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-600">
                          {rx.exam_date ? formatDate(rx.exam_date) : "-"}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {rx.customer_name}
                          {rx.customer_age && (
                            <span className="text-[10px] font-normal text-slate-400 ml-1">
                              ({rx.customer_age} th)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">
                          {rx.customer_phone || "-"}
                        </td>
                        <td className="px-3 py-2 font-mono text-center bg-blue-50/30 text-blue-900">
                          {rx.od_sph} / {rx.od_cyl} x {rx.od_axis}° {parseFloat(rx.od_add) > 0 ? `+${rx.od_add}` : ""}
                        </td>
                        <td className="px-3 py-2 font-mono text-center bg-indigo-50/30 text-indigo-900">
                          {rx.os_sph} / {rx.os_cyl} x {rx.os_axis}° {parseFloat(rx.os_add) > 0 ? `+${rx.os_add}` : ""}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-700">
                          {rx.total_pd ? `${rx.total_pd} mm` : "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {rx.examiner_name || "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]">
                          {rx.complaint_diagnose || rx.notes || "-"}
                        </td>
                      </tr>
                    ))}

                    {parseResult.invalid.map((rx, idx) => (
                      <tr key={`invalid-${idx}`} className="bg-rose-50/40 text-rose-900">
                        <td className="px-3 py-2 text-center">
                          <XCircle className="w-3.5 h-3.5 text-rose-600 inline" />
                        </td>
                        <td className="px-3 py-2">{rx.exam_date || "-"}</td>
                        <td className="px-3 py-2 font-bold">{rx.customer_name || "(Kosong)"}</td>
                        <td className="px-3 py-2 font-mono">{rx.customer_phone || "-"}</td>
                        <td className="px-3 py-2 text-center">-</td>
                        <td className="px-3 py-2 text-center">-</td>
                        <td className="px-3 py-2 text-center">-</td>
                        <td className="px-3 py-2">{rx.examiner_name || "-"}</td>
                        <td className="px-3 py-2 text-rose-600 font-semibold">{rx.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
