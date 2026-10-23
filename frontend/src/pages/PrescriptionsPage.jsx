import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Calendar,
  Clock,
  RotateCcw,
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle,
  X,
  MessageCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/context/AppContext";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PrescriptionPrintModal from "@/components/print/PrescriptionPrintModal";
import PrescriptionImportModal from "@/components/common/PrescriptionImportModal";
import { exportPrescriptionsToExcel } from "@/utils/bulkDataHandler";
import { sendWhatsAppMessage, buildPrescriptionWhatsAppMessage } from "@/utils/whatsapp";

/**
 * Format date as DD/MM/YYYY (e.g. 13/10/2026) matching screenshot
 */
const formatDateSlash = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const initialForm = {
  customer_id: "",
  examiner_name: "Budi Santoso, A.Md.RO",
  exam_date: new Date().toISOString().slice(0, 10),

  // OD (Right)
  od_ucva: "6/18",
  od_sph: "0.00",
  od_cyl: "0.00",
  od_axis: 0,
  od_bcva: "6/6",
  od_add: "+0.00",
  od_mpd: 31.0,
  od_pv: "10°",
  od_sh: "18 mm",

  // OS (Left)
  os_ucva: "6/20",
  os_sph: "0.00",
  os_cyl: "0.00",
  os_axis: 0,
  os_bcva: "6/6",
  os_add: "+0.00",
  os_mpd: 31.0,
  os_pv: "10°",
  os_sh: "18 mm",

  total_pd: 62.0,
  complaint_diagnose: "",
  notes: "",
};

export default function PrescriptionsPage() {
  const { settings } = useApp();
  const [prescriptions, setPrescriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Date Range Filter (Default 1 month range as shown in screenshot)
  const defaultDateEnd = new Date().toISOString().slice(0, 10);
  const dStart = new Date();
  dStart.setMonth(dStart.getMonth() - 1);
  const defaultDateStart = dStart.toISOString().slice(0, 10);

  const [dateStart, setDateStart] = useState(defaultDateStart);
  const [dateEnd, setDateEnd] = useState(defaultDateEnd);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Export / Import State
  const [isExporting, setIsExporting] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Detail / Print Modal State
  const [selectedRx, setSelectedRx] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    fetchPrescriptions();
  }, [page, limit, debouncedSearch, dateStart, dateEnd]);

  const loadCustomers = async () => {
    try {
      const res = await request.get(API_ENDPOINTS.CUSTOMERS.LIST, { limit: 100 });
      if (res?.data) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPrescriptions = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
      };
      if (dateStart) params.date_start = dateStart;
      if (dateEnd) params.date_end = dateEnd;

      const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, params);
      if (res?.success) {
        setPrescriptions(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat data rekam medis");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilter = () => {
    setDateStart("");
    setDateEnd("");
    setSearch("");
    setPage(1);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (dateStart) params.date_start = dateStart;
      if (dateEnd) params.date_end = dateEnd;

      let dataToExport = prescriptions;
      try {
        const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.EXPORT, params);
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          dataToExport = res.data;
        }
      } catch {
        // Fallback to currently loaded data
      }

      if (dataToExport.length === 0) {
        toast.error("Tidak ada data rekam medis untuk diekspor");
        return;
      }

      const periodLabel = dateStart && dateEnd ? `${formatDate(dateStart)} - ${formatDate(dateEnd)}` : "Semua Periode";
      const fileName = exportPrescriptionsToExcel(dataToExport, periodLabel);
      toast.success(`Berhasil mengekspor ${dataToExport.length} rekam medis (${fileName})!`);
    } catch (err) {
      console.error("Gagal ekspor rekam medis:", err);
      toast.error(err.message || "Gagal mengekspor data rekam medis");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData(initialForm);
    setIsEditing(false);
    setEditId(null);
    setIsFormModalOpen(true);
  };

  const handleMpdChange = (eye, val) => {
    setFormData((prev) => {
      const nextVal = val === "" ? "" : val;
      const nextOd = eye === "od" ? nextVal : prev.od_mpd;
      const nextOs = eye === "os" ? nextVal : prev.os_mpd;

      const odNum = parseFloat(nextOd);
      const osNum = parseFloat(nextOs);

      let calculatedPd = "";
      if (!isNaN(odNum) && !isNaN(osNum)) {
        calculatedPd = Number((odNum + osNum).toFixed(1));
      } else if (!isNaN(odNum)) {
        calculatedPd = Number(odNum.toFixed(1));
      } else if (!isNaN(osNum)) {
        calculatedPd = Number(osNum.toFixed(1));
      }

      return {
        ...prev,
        [eye === "od" ? "od_mpd" : "os_mpd"]: nextVal,
        total_pd: calculatedPd,
      };
    });
  };

  const handleOpenEdit = (rx) => {
    setFormData({
      customer_id: rx.customer_id,
      examiner_name: rx.examiner_name,
      exam_date: rx.exam_date ? rx.exam_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      od_ucva: rx.od_ucva || "",
      od_sph: rx.od_sph || "0.00",
      od_cyl: rx.od_cyl || "0.00",
      od_axis: rx.od_axis ?? 0,
      od_bcva: rx.od_bcva || "6/6",
      od_add: rx.od_add || "0.00",
      od_mpd: rx.od_mpd !== undefined && rx.od_mpd !== null ? rx.od_mpd : 31.0,
      od_pv: rx.od_pv || "10°",
      od_sh: rx.od_sh || "18 mm",
      os_ucva: rx.os_ucva || "",
      os_sph: rx.os_sph || "0.00",
      os_cyl: rx.os_cyl || "0.00",
      os_axis: rx.os_axis ?? 0,
      os_bcva: rx.os_bcva || "6/6",
      os_add: rx.os_add || "0.00",
      os_mpd: rx.os_mpd !== undefined && rx.os_mpd !== null ? rx.os_mpd : 31.0,
      os_pv: rx.os_pv || "10°",
      os_sh: rx.os_sh || "18 mm",
      total_pd:
        rx.total_pd !== undefined && rx.total_pd !== null
          ? rx.total_pd
          : rx.od_mpd && rx.os_mpd
          ? Number((Number(rx.od_mpd) + Number(rx.os_mpd)).toFixed(1))
          : 62.0,
      complaint_diagnose: rx.complaint_diagnose || "",
      notes: rx.notes || "",
    });
    setIsEditing(true);
    setEditId(rx.id);
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_id) {
      toast.error("Silakan pilih Pasien / Pelanggan!");
      return;
    }

    const payload = {
      ...formData,
      od_axis: formData.od_axis === "" ? 0 : Number(formData.od_axis),
      os_axis: formData.os_axis === "" ? 0 : Number(formData.os_axis),
      od_mpd: formData.od_mpd === "" ? null : Number(formData.od_mpd),
      os_mpd: formData.os_mpd === "" ? null : Number(formData.os_mpd),
      total_pd: formData.total_pd === "" ? null : Number(formData.total_pd),
    };

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await request.put(API_ENDPOINTS.PRESCRIPTIONS.UPDATE(editId), payload);
        toast.success("Rekam medis berhasil diperbarui");
      } else {
        await request.post(API_ENDPOINTS.PRESCRIPTIONS.CREATE, payload);
        toast.success("Rekam medis baru berhasil disimpan");
      }
      setIsFormModalOpen(false);
      fetchPrescriptions();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan rekam medis");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await request.delete(API_ENDPOINTS.PRESCRIPTIONS.DELETE(deleteId));
      toast.success("Rekam medis berhasil dihapus");
      setDeleteId(null);
      fetchPrescriptions();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus rekam medis");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrint = (rx) => {
    setSelectedRx(rx);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Search Bar (Full Width, Matching Screenshot) */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari Nama / No. HP Pasien..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs placeholder:text-gray-400"
        />
      </div>

      {/* 2. Three Action Buttons (Export Excel, Import Excel, + Input Rekam Medis) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Export Excel Button (Dark Green) */}
        <button
          type="button"
          onClick={handleExportExcel}
          disabled={isLoading || isExporting}
          className="h-11 flex items-center justify-center gap-1.5 px-2 sm:px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-xs whitespace-nowrap transition-all cursor-pointer disabled:opacity-50"
          title="Download data rekam medis format Excel"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">Export<span className="hidden sm:inline"> Excel</span></span>
        </button>

        {/* Import Excel Button (Amber / Orange) */}
        <button
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          className="h-11 flex items-center justify-center gap-1.5 px-2 sm:px-3 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-xs whitespace-nowrap transition-all cursor-pointer"
          title="Import rekam medis pasien dari file Excel"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Import<span className="hidden sm:inline"> Excel</span></span>
        </button>

        {/* + Input Rekam Medis Button (Blue) */}
        <button
          type="button"
          onClick={handleOpenCreate}
          className="h-11 flex items-center justify-center gap-1.5 px-2 sm:px-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-[11px] sm:text-xs font-bold shadow-xs whitespace-nowrap transition-all cursor-pointer"
          title="Catat rekam medis pasien baru"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate"><span className="hidden sm:inline">Input </span>Rekam Medis</span>
        </button>
      </div>

      {/* 3. Date Range Filter Bar (Fixed Overflow & Reload Button) */}
      <div className="bg-white p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-gray-200 shadow-2xs space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Date Start */}
          <div className="relative flex-1 min-w-0">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => {
                setDateStart(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
            />
          </div>

          <span className="text-gray-400 text-xs font-semibold shrink-0 px-0.5">
            s/d
          </span>

          {/* Date End */}
          <div className="relative flex-1 min-w-0">
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => {
                setDateEnd(e.target.value);
                setPage(1);
              }}
              className="w-full min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 text-[11px] sm:text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
            />
          </div>

          {/* Reset / Reload Button */}
          <button
            type="button"
            onClick={handleResetFilter}
            className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 border border-gray-200 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
            title="Reset Rentang Tanggal"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        {/* Period Subtitle */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5 border-t border-gray-100">
          <span className="truncate">
            Menampilkan periode:{" "}
            <strong className="text-gray-700">
              {dateStart && dateEnd
                ? `${formatDate(dateStart)} — ${formatDate(dateEnd)}`
                : "Semua Tanggal"}
            </strong>
          </span>
          {(dateStart !== defaultDateStart || dateEnd !== defaultDateEnd) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="text-blue-600 hover:underline font-semibold shrink-0 cursor-pointer ml-2 text-[11px]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. Rekam Medis Card List (Matching Screenshot Precisely) */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
          <p className="text-xs">Memuat rekam medis pasien...</p>
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-xs">
          Belum ada data rekam medis pada periode ini.
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map((rx, idx) => {
            const examTime = rx.created_at
              ? new Date(rx.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "10.00.00";

            const isFirstVisit = !rx.visit_number || rx.visit_number === 1;

            return (
              <div
                key={rx.id}
                className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-2xs space-y-2.5 transition-shadow hover:shadow-xs"
              >
                {/* Line 1: No */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">No</span>
                  <span className="text-gray-900 font-bold">
                    {(page - 1) * limit + idx + 1}
                  </span>
                </div>

                {/* Line 2: Tgl Periksa + Jam */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Tgl Periksa</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">
                      {formatDateSlash(rx.exam_date)}
                    </span>
                    <span className="text-gray-400 text-[11px] flex items-center gap-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{examTime}</span>
                    </span>
                  </div>
                </div>

                {/* Line 3: Nama Pasien + Badge Kunjungan */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Nama Pasien</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-600 sm:text-sm">
                      {rx.customer_name}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {isFirstVisit
                        ? "Kunjungan pertama"
                        : `Kunjungan ke-${rx.visit_number}`}
                    </span>
                  </div>
                </div>

                {/* Line 4: Usia */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Usia</span>
                  <span className="text-gray-800 font-medium">
                    {rx.customer_age
                      ? `${rx.customer_age} thn`
                      : rx.age
                      ? `${rx.age} thn`
                      : "-"}
                  </span>
                </div>

                {/* Line 5: No. HP */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">No. HP</span>
                  <span className="text-gray-800 font-mono font-medium">
                    {rx.customer_phone || "-"}
                  </span>
                </div>

                {/* Line 6: OD (Kanan) & OS (Kiri) Breakdown */}
                <div className="pt-1 text-right space-y-1 font-mono text-[11px]">
                  <div className="text-gray-500 font-semibold text-[10px]">
                    OD (Kanan)
                  </div>
                  <div className="text-gray-700">
                    S:{" "}
                    <span className="font-bold text-gray-900">
                      {formatDiopter(rx.od_sph)}
                    </span>{" "}
                    C:{" "}
                    <span className="font-bold text-gray-900">
                      {formatDiopter(rx.od_cyl)}
                    </span>{" "}
                    Ax:{" "}
                    <span className="font-bold text-gray-900">
                      {rx.od_axis !== undefined ? `${rx.od_axis}°` : "-"}
                    </span>{" "}
                    Add:{" "}
                    <span className="font-bold text-gray-900">
                      {formatDiopter(rx.od_add)}
                    </span>
                  </div>

                  <div className="text-gray-500 font-semibold text-[10px] pt-0.5">
                    OS (Kiri)
                  </div>
                  <div className="text-gray-700">
                    S:{" "}
                    <span className="font-bold text-gray-900">
                      {formatDiopter(rx.os_sph)}
                    </span>{" "}
                    C:{" "}
                    <span className="font-bold text-gray-900">
                      {formatDiopter(rx.os_cyl)}
                    </span>{" "}
                    Ax:{" "}
                    <span className="font-bold text-gray-900">
                      {rx.os_axis !== undefined ? `${rx.os_axis}°` : "-"}
                    </span>{" "}
                    Add:{" "}
                    <span className="font-bold text-gray-900">
                      {formatDiopter(rx.os_add)}
                    </span>
                  </div>
                </div>

                {/* Line 7: PD */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-500 font-medium">PD</span>
                  <span className="text-gray-800 font-medium">
                    {rx.total_pd ? `${rx.total_pd} mm` : "-"}
                  </span>
                </div>

                {/* Line 8: Kunjungan Count */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Kunjungan</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-600 font-extrabold text-sm">
                      {rx.total_visits || rx.visit_number || 1}
                    </span>
                    <span className="text-gray-500 text-xs">kunjungan</span>
                  </div>
                </div>

                {/* Dashed Separator & Action Buttons (WA, Eye, Edit, Trash) */}
                <div className="border-t border-dashed border-gray-200 pt-2.5 flex items-center justify-end gap-1.5 sm:gap-2">
                  {/* WhatsApp Send Button - Emerald outline */}
                  <button
                    type="button"
                    onClick={() => {
                      const msg = buildPrescriptionWhatsAppMessage(rx, settings);
                      sendWhatsAppMessage(rx.customer_phone, msg);
                    }}
                    className="p-1.5 rounded-lg border border-emerald-400 text-emerald-600 bg-white hover:bg-emerald-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    title="Kirim Resep via WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>

                  {/* Eye (Detail / Cetak Resep) Button - Cyan outline */}
                  <button
                    type="button"
                    onClick={() => handlePrint(rx)}
                    className="p-1.5 rounded-lg border border-cyan-400 text-cyan-600 bg-white hover:bg-cyan-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    title="Lihat & Cetak Resep Pasien"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit Button - Amber outline */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(rx)}
                    className="p-1.5 rounded-lg border border-amber-400 text-amber-600 bg-white hover:bg-amber-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    title="Edit Rekam Medis"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button - Rose outline */}
                  <button
                    type="button"
                    onClick={() => setDeleteId(rx.id)}
                    className="p-1.5 rounded-lg border border-rose-400 text-rose-600 bg-white hover:bg-rose-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                    title="Hapus Rekam Medis"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Pagination Footer */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalItems}
        limit={limit}
        onPageChange={(p) => setPage(p)}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
        itemName="rekam medis"
        compact={true}
      />

      {/* ==========================================
          IMPORT REKAM MEDIS MODAL (EXCEL / CSV)
         ========================================== */}
      <PrescriptionImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchPrescriptions}
      />

      {/* ==========================================
          CREATE / EDIT REKAM MEDIS MODAL (LENGKAP OD & OS)
         ========================================== */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={isEditing ? "Edit Rekam Medis Pasien" : "Input Rekam Medis Pasien Baru"}
        subtitle="Form rekam medis optik lengkap parameter klinis OD & OS"
        maxWidth="max-w-4xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Rekam Medis"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Header Data Pasien */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Pilih Pasien <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value="">-- Pilih Pasien Terdaftar --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone || c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Pemeriksa Refraksionis (RO) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.examiner_name}
                onChange={(e) => setFormData({ ...formData, examiner_name: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Tanggal Periksa <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.exam_date}
                onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>
          </div>

          {/* Matrix Refraksi OD (Kanan) & OS (Kiri) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OD (Right Eye) */}
            <div className="border border-blue-200 bg-blue-50/20 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-blue-100">
                <span className="font-extrabold text-blue-900 text-xs flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  MATA KANAN (OD - Oculus Dexter)
                </span>
                <span className="text-[10px] text-blue-600 font-mono font-bold">KANAN</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">SPH</label>
                  <input
                    type="text"
                    value={formData.od_sph}
                    onChange={(e) => setFormData({ ...formData, od_sph: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="-1.50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">CYL</label>
                  <input
                    type="text"
                    value={formData.od_cyl}
                    onChange={(e) => setFormData({ ...formData, od_cyl: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="-0.50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">AXIS (°)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={formData.od_axis ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        od_axis: e.target.value === "" ? "" : e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="90"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">ADD</label>
                  <input
                    type="text"
                    value={formData.od_add}
                    onChange={(e) => setFormData({ ...formData, od_add: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center bg-white border border-gray-300 rounded-md"
                    placeholder="+2.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">MPD (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.od_mpd ?? ""}
                    onChange={(e) => handleMpdChange("od", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="31.0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">BCVA</label>
                  <input
                    type="text"
                    value={formData.od_bcva}
                    onChange={(e) => setFormData({ ...formData, od_bcva: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center bg-white border border-gray-300 rounded-md"
                    placeholder="6/6"
                  />
                </div>
              </div>
            </div>

            {/* OS (Left Eye) */}
            <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                <span className="font-extrabold text-indigo-900 text-xs flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                  MATA KIRI (OS - Oculus Sinister)
                </span>
                <span className="text-[10px] text-indigo-600 font-mono font-bold">KIRI</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">SPH</label>
                  <input
                    type="text"
                    value={formData.os_sph}
                    onChange={(e) => setFormData({ ...formData, os_sph: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="-1.75"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">CYL</label>
                  <input
                    type="text"
                    value={formData.os_cyl}
                    onChange={(e) => setFormData({ ...formData, os_cyl: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="-0.50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">AXIS (°)</label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={formData.os_axis ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        os_axis: e.target.value === "" ? "" : e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="90"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">ADD</label>
                  <input
                    type="text"
                    value={formData.os_add}
                    onChange={(e) => setFormData({ ...formData, os_add: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center bg-white border border-gray-300 rounded-md"
                    placeholder="+2.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">MPD (mm)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.os_mpd ?? ""}
                    onChange={(e) => handleMpdChange("os", e.target.value)}
                    className="w-full px-2 py-1.5 text-xs text-center font-bold bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                    placeholder="31.0"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 block mb-0.5">BCVA</label>
                  <input
                    type="text"
                    value={formData.os_bcva}
                    onChange={(e) => setFormData({ ...formData, os_bcva: e.target.value })}
                    className="w-full px-2 py-1.5 text-xs text-center bg-white border border-gray-300 rounded-md"
                    placeholder="6/6"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pupillary Distance & Catatan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">
                  Total PD (Pupillary Distance) mm
                </label>
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  Auto (MPD R+L)
                </span>
              </div>
              <input
                type="number"
                step="0.5"
                value={formData.total_pd ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    total_pd: e.target.value === "" ? "" : e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-blue-900"
                placeholder="Contoh: 62.0 (Otomatis dari MPD Kanan + Kiri)"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                * Otomatis terhitung dari MPD Kanan + Kiri, atau bisa diedit manual.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Keluhan Pasien / Diagnosa Refraksi
              </label>
              <input
                type="text"
                value={formData.complaint_diagnose}
                onChange={(e) => setFormData({ ...formData, complaint_diagnose: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Pandangan buram jarak jauh, silau saat malam..."
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Detail / Cetak Lembar Resep Modal */}
      <PrescriptionPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        prescription={selectedRx}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Rekam Medis"
        message="Apakah Anda yakin ingin menghapus catatan rekam medis ini?"
      />
    </div>
  );
}
