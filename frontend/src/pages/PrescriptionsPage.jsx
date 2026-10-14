import React, { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Calendar,
  User,
  Activity,
  CheckCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import PrescriptionPrintModal from "@/components/print/PrescriptionPrintModal";

const initialForm = {
  customer_id: "",
  examiner_name: "Budi Santoso, A.Md.RO",
  exam_date: new Date().toISOString().slice(0, 10),

  // OD (Right)
  od_ucva: "6/18",
  od_sph: "-1.50",
  od_cyl: "-0.50",
  od_axis: 90,
  od_bcva: "6/6",
  od_add: "+0.00",
  od_mpd: 31.0,
  od_pv: "10°",
  od_sh: "18 mm",

  // OS (Left)
  os_ucva: "6/20",
  os_sph: "-1.75",
  os_cyl: "-0.50",
  os_axis: 90,
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
  const [prescriptions, setPrescriptions] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

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
  }, [page, limit, debouncedSearch]);

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
      const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, {
        page,
        limit,
        search: debouncedSearch,
      });
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

  const handleOpenCreate = () => {
    setFormData(initialForm);
    setIsEditing(false);
    setEditId(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (rx) => {
    setFormData({
      customer_id: rx.customer_id,
      examiner_name: rx.examiner_name,
      exam_date: rx.exam_date ? rx.exam_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      od_ucva: rx.od_ucva || "",
      od_sph: rx.od_sph || "0.00",
      od_cyl: rx.od_cyl || "0.00",
      od_axis: rx.od_axis || 0,
      od_bcva: rx.od_bcva || "6/6",
      od_add: rx.od_add || "0.00",
      od_mpd: rx.od_mpd || 31.0,
      od_pv: rx.od_pv || "10°",
      od_sh: rx.od_sh || "18 mm",
      os_ucva: rx.os_ucva || "",
      os_sph: rx.os_sph || "0.00",
      os_cyl: rx.os_cyl || "0.00",
      os_axis: rx.os_axis || 0,
      os_bcva: rx.os_bcva || "6/6",
      os_add: rx.os_add || "0.00",
      os_mpd: rx.os_mpd || 31.0,
      os_pv: rx.os_pv || "10°",
      os_sh: rx.os_sh || "18 mm",
      total_pd: rx.total_pd || 62.0,
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
      toast.error("Silakan pilih Pelanggan!");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await request.put(API_ENDPOINTS.PRESCRIPTIONS.UPDATE(editId), formData);
        toast.success("Rekam medis berhasil diperbarui");
      } else {
        await request.post(API_ENDPOINTS.PRESCRIPTIONS.CREATE, formData);
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

  const headers = [
    { label: "Tanggal & Pasien", align: "left" },
    { label: "Mata Kanan (OD)", align: "left" },
    { label: "Mata Kiri (OS)", align: "left" },
    { label: "Total PD", align: "center" },
    { label: "Pemeriksa (RO)", align: "left" },
    { label: "Keluhan / Diagnosa", align: "left" },
    { label: "Aksi", align: "center" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Rekam Medis & Refraksi Pasien
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Rekam medis pemeriksaan refraksi klinis terpisah OD dan OS dengan parameter standar optik
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Rekam Medis</span>
        </button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari pasien, no telepon, atau pemeriksa..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="text-xs text-gray-500">
          Total Rekam Medis: <span className="font-bold text-gray-800">{totalItems}</span>
        </div>
      </div>

      {/* Main Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={prescriptions.length === 0}
        emptyMessage="Belum ada data rekam medis pasien."
      >
        {prescriptions.map((rx) => (
          <tr key={rx.id} className="hover:bg-gray-50/70 transition-colors">
            {/* Pasien & Date */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-gray-900">{rx.customer_name}</div>
              <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                {formatDate(rx.exam_date)} ({rx.customer_phone})
              </div>
            </td>

            {/* OD Summary */}
            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
              <div className="text-blue-900 font-semibold">
                Sph: <span className="font-bold">{formatDiopter(rx.od_sph)}</span> | Cyl: {formatDiopter(rx.od_cyl)} Ax {rx.od_axis}°
              </div>
              <div className="text-[10px] text-gray-500">
                Add: {formatDiopter(rx.od_add)} | BCVA: {rx.od_bcva || "6/6"}
              </div>
            </td>

            {/* OS Summary */}
            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
              <div className="text-blue-900 font-semibold">
                Sph: <span className="font-bold">{formatDiopter(rx.os_sph)}</span> | Cyl: {formatDiopter(rx.os_cyl)} Ax {rx.os_axis}°
              </div>
              <div className="text-[10px] text-gray-500">
                Add: {formatDiopter(rx.os_add)} | BCVA: {rx.os_bcva || "6/6"}
              </div>
            </td>

            {/* Total PD */}
            <td className="px-4 py-3 text-center whitespace-nowrap text-xs font-bold text-gray-800">
              {rx.total_pd ? `${rx.total_pd} mm` : "-"}
            </td>

            {/* Examiner */}
            <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-gray-700">
              {rx.examiner_name}
            </td>

            {/* Diagnosis */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 max-w-xs truncate">
              {rx.complaint_diagnose || "-"}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePrint(rx)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Cetak Rekam Medis"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(rx)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Edit Rekam Medis"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(rx.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus Rekam Medis"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {/* Pagination Footer */}
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
      />

      {/* Create / Edit Modal (Complete OD / OS Clinical Matrix) */}
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
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Rekam Medis"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient & Exam Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Pilih Pelanggan / Pasien <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Pilih Pasien --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - {c.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Pemeriksa (RO/Optometris/Dokter) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.examiner_name}
                onChange={(e) => setFormData({ ...formData, examiner_name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Nama & Gelar RO"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Tanggal Pemeriksaan <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.exam_date}
                onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* OD (Right Eye) Card */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
            <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
              Mata Kanan (OD - Oculus Dexter)
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">UCVA</label>
                <input
                  type="text"
                  value={formData.od_ucva}
                  onChange={(e) => setFormData({ ...formData, od_ucva: e.target.value })}
                  placeholder="6/18"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5">SPH</label>
                <input
                  type="text"
                  value={formData.od_sph}
                  onChange={(e) => setFormData({ ...formData, od_sph: e.target.value })}
                  placeholder="-1.50"
                  className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-bold font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-blue-900 mb-0.5">CYL</label>
                <input
                  type="text"
                  value={formData.od_cyl}
                  onChange={(e) => setFormData({ ...formData, od_cyl: e.target.value })}
                  placeholder="-0.50"
                  className="w-full px-2 py-1 bg-white border border-blue-400 rounded text-xs font-semibold font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">AXIS (0-180)</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={formData.od_axis}
                  onChange={(e) => setFormData({ ...formData, od_axis: Number(e.target.value) })}
                  placeholder="90"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">BCVA</label>
                <input
                  type="text"
                  value={formData.od_bcva}
                  onChange={(e) => setFormData({ ...formData, od_bcva: e.target.value })}
                  placeholder="6/6"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">ADD</label>
                <input
                  type="text"
                  value={formData.od_add}
                  onChange={(e) => setFormData({ ...formData, od_add: e.target.value })}
                  placeholder="+1.50"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">MPD (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.od_mpd}
                  onChange={(e) => setFormData({ ...formData, od_mpd: Number(e.target.value) })}
                  placeholder="31.0"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">PV (Angle)</label>
                <input
                  type="text"
                  value={formData.od_pv}
                  onChange={(e) => setFormData({ ...formData, od_pv: e.target.value })}
                  placeholder="10°"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">SH (Height)</label>
                <input
                  type="text"
                  value={formData.od_sh}
                  onChange={(e) => setFormData({ ...formData, od_sh: e.target.value })}
                  placeholder="18 mm"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* OS (Left Eye) Card */}
          <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200">
            <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
              Mata Kiri (OS - Oculus Sinister)
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">UCVA</label>
                <input
                  type="text"
                  value={formData.os_ucva}
                  onChange={(e) => setFormData({ ...formData, os_ucva: e.target.value })}
                  placeholder="6/20"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">SPH</label>
                <input
                  type="text"
                  value={formData.os_sph}
                  onChange={(e) => setFormData({ ...formData, os_sph: e.target.value })}
                  placeholder="-1.75"
                  className="w-full px-2 py-1 bg-white border border-indigo-400 rounded text-xs font-bold font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-900 mb-0.5">CYL</label>
                <input
                  type="text"
                  value={formData.os_cyl}
                  onChange={(e) => setFormData({ ...formData, os_cyl: e.target.value })}
                  placeholder="-0.50"
                  className="w-full px-2 py-1 bg-white border border-indigo-400 rounded text-xs font-semibold font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">AXIS (0-180)</label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={formData.os_axis}
                  onChange={(e) => setFormData({ ...formData, os_axis: Number(e.target.value) })}
                  placeholder="90"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-800 mb-0.5">BCVA</label>
                <input
                  type="text"
                  value={formData.os_bcva}
                  onChange={(e) => setFormData({ ...formData, os_bcva: e.target.value })}
                  placeholder="6/6"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-indigo-800 mb-0.5">ADD</label>
                <input
                  type="text"
                  value={formData.os_add}
                  onChange={(e) => setFormData({ ...formData, os_add: e.target.value })}
                  placeholder="+1.50"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">MPD (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.os_mpd}
                  onChange={(e) => setFormData({ ...formData, os_mpd: Number(e.target.value) })}
                  placeholder="31.0"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">PV (Angle)</label>
                <input
                  type="text"
                  value={formData.os_pv}
                  onChange={(e) => setFormData({ ...formData, os_pv: e.target.value })}
                  placeholder="10°"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 mb-0.5">SH (Height)</label>
                <input
                  type="text"
                  value={formData.os_sh}
                  onChange={(e) => setFormData({ ...formData, os_sh: e.target.value })}
                  placeholder="18 mm"
                  className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* General Optical Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Total PD (Pupillary Distance, mm)
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.total_pd}
                onChange={(e) => setFormData({ ...formData, total_pd: Number(e.target.value) })}
                placeholder="62.5"
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Keluhan / Diagnosa Pasien (Catatan Klinis)
              </label>
              <input
                type="text"
                value={formData.complaint_diagnose}
                onChange={(e) => setFormData({ ...formData, complaint_diagnose: e.target.value })}
                placeholder="Contoh: Penglihatan buram jauh, sering pusing saat membaca dekat..."
                className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Catatan Kustom / Rekomendasi Lensa
            </label>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Contoh: Disarankan Lensa Progresif Freeform dengan coating Bluechromic..."
              className="w-full px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Rekam Medis"
        message="Apakah Anda yakin ingin menghapus catatan rekam medis ini? Data rekam medis pasien akan dihapus secara permanen."
      />

      {/* Printable Prescription Card Modal */}
      <PrescriptionPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        prescription={selectedRx}
      />
    </div>
  );
}
