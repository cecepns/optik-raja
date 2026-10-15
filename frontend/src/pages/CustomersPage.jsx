import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  FileText,
  Receipt,
  History,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Eye,
  MessageCircle,
  MapPin,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDateTime, formatRupiah } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import CustomerImportModal from "@/components/common/CustomerImportModal";
import { exportCustomersToExcel } from "@/utils/bulkDataHandler";

const initialForm = {
  name: "",
  phone: "",
  gender: "Laki-laki",
  age: "",
  address: "",
  notes: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [genderFilter, setGenderFilter] = useState("");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail / History Modal State
  const [historyCustomer, setHistoryCustomer] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedDetailCustomer, setSelectedDetailCustomer] = useState(null);

  // Bulk Import & Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCustomers = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (genderFilter) params.gender = genderFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await request.get(API_ENDPOINTS.CUSTOMERS.EXPORT, params);
      if (res?.success && res?.data) {
        if (res.data.length === 0) {
          toast.error("Tidak ada data pelanggan untuk diekspor");
          return;
        }
        const fileName = exportCustomersToExcel(res.data);
        toast.success(`Berhasil mengekspor ${res.data.length} pelanggan (${fileName})!`);
      }
    } catch (err) {
      console.error("Gagal ekspor data pelanggan:", err);
      toast.error(err.message || "Gagal mengekspor data pelanggan");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, limit, debouncedSearch, genderFilter]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
      };
      if (genderFilter) params.gender = genderFilter;

      const res = await request.get(API_ENDPOINTS.CUSTOMERS.LIST, params);
      if (res?.success) {
        setCustomers(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat data pelanggan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormData(initialForm);
    setIsEditing(false);
    setEditId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setFormData({
      name: c.name,
      phone: c.phone,
      gender: c.gender || "Laki-laki",
      age: c.age || "",
      address: c.address || "",
      notes: c.notes || "",
    });
    setIsEditing(true);
    setEditId(c.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error("Nama pelanggan dan No WhatsApp wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await request.put(API_ENDPOINTS.CUSTOMERS.UPDATE(editId), formData);
        toast.success("Data pelanggan berhasil diperbarui");
      } else {
        await request.post(API_ENDPOINTS.CUSTOMERS.CREATE, formData);
        toast.success("Pelanggan baru berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan pelanggan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await request.delete(API_ENDPOINTS.CUSTOMERS.DELETE(deleteId));
      toast.success("Pelanggan berhasil dihapus");
      setDeleteId(null);
      fetchCustomers();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus data pelanggan");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewHistory = async (cust) => {
    try {
      const res = await request.get(API_ENDPOINTS.CUSTOMERS.DETAIL(cust.id));
      if (res?.data) {
        setHistoryCustomer(res.data);
        setIsHistoryModalOpen(true);
      }
    } catch (err) {
      toast.error("Gagal memuat riwayat pasien");
    }
  };

  const headers = [
    { label: "Pasien & Kode", align: "left" },
    { label: "Kontak & Usia", align: "left" },
    { label: "Riwayat Medis", align: "center" },
    { label: "Aksi", align: "center", className: "w-32" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Master Pelanggan & Rekam Pasien
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Database profil pelanggan optik, kontak WhatsApp, dan riwayat pemeriksaan kacamata
          </p>
        </div>

        {/* Action Button Group */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportCustomers}
            disabled={isLoading || isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            title="Download seluruh data pelanggan berformat Microsoft Excel (.xlsx)"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
            )}
            <span>Export Excel</span>
          </button>

          {/* Import Masal Button */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            title="Unggah file Excel/CSV untuk menambah atau memperbarui data pelanggan secara masal"
          >
            <FileUp className="w-4 h-4 shrink-0" />
            <span>Import Masal</span>
          </button>

          {/* Tambah Pelanggan Button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Tambah Pelanggan Baru</span>
          </button>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kode, nama pelanggan, atau no HP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={genderFilter}
            onChange={(e) => {
              setGenderFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">Semua Gender</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Total Pelanggan: <span className="font-bold text-gray-800">{totalItems}</span>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={customers.length === 0}
        emptyMessage="Belum ada data pelanggan ditemukan."
      >
        {customers.map((c) => (
          <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
            {/* 1. Pasien & Kode */}
            <td className="px-4 py-3 align-middle">
              <div className="font-bold text-xs sm:text-sm text-gray-900 leading-tight">
                {c.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  {c.code}
                </span>
                {c.address && (
                  <span
                    className="text-[11px] text-gray-500 truncate max-w-[220px]"
                    title={c.address}
                  >
                    {c.address}
                  </span>
                )}
              </div>
            </td>

            {/* 2. Kontak & Usia */}
            <td className="px-4 py-3 align-middle text-xs text-gray-800">
              <div className="flex items-center gap-1.5 font-medium">
                <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{c.phone}</span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {c.gender} {c.age ? `· ${c.age} Tahun` : ""}
              </div>
            </td>

            {/* 3. Riwayat Medis */}
            <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleViewHistory(c)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors cursor-pointer"
                title="Lihat Rekam Medis & Riwayat Belanja"
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat</span>
              </button>
            </td>

            {/* 4. Aksi (Eye detail, Edit, Delete) */}
            <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedDetailCustomer(c)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Lihat Detail Pasien Lengkap"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(c)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Data"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(c.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Hapus Data"
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

      {/* Create / Edit Modal (SRS Modul 2 Pelanggan) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? "Edit Data Pelanggan" : "Tambah Pelanggan Baru"}
        subtitle="Form profil pasien dan kontak kacamata"
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
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
              {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Pelanggan"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nama Pelanggan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Hendro Wicaksono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nomor WhatsApp / HP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="081234567890"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Jenis Kelamin</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Usia (Tahun)</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Contoh: 35"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Alamat Lengkap</label>
            <textarea
              rows="2"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Alamat tempat tinggal / kantor..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Catatan Khusus</label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Preferensi lensa, frame titanium, dll..."
            />
          </div>
        </form>
      </Modal>

      {/* History Modal (Riwayat Resep & Transaksi) */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Riwayat Rekam Medis: ${historyCustomer?.name}`}
        subtitle={`Kode: ${historyCustomer?.code} • Telp: ${historyCustomer?.phone}`}
        maxWidth="max-w-3xl"
        footer={
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
          >
            Tutup
          </button>
        }
      >
        <div className="space-y-5">
          {/* Prescriptions History */}
          <div>
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Riwayat Rekam Medis ({historyCustomer?.prescriptions?.length || 0})
            </h4>

            {historyCustomer?.prescriptions?.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Belum ada catatan rekam medis periksa.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historyCustomer?.prescriptions?.map((rx) => (
                  <div key={rx.id} className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 text-xs">
                    <div className="flex justify-between font-bold text-gray-800">
                      <span>Periksa: {formatDate(rx.exam_date)}</span>
                      <span className="text-blue-700">Pemeriksa: {rx.examiner_name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1 font-mono text-[11px] text-gray-700">
                      <div>R (OD): Sph {rx.od_sph} Cyl {rx.od_cyl} Ax {rx.od_axis}° Add {rx.od_add}</div>
                      <div>L (OS): Sph {rx.os_sph} Cyl {rx.os_cyl} Ax {rx.os_axis}° Add {rx.os_add}</div>
                    </div>
                    {rx.complaint_diagnose && (
                      <p className="text-[11px] text-gray-500 mt-1">Diagnosa: {rx.complaint_diagnose}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transactions History */}
          <div>
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600" />
              Riwayat Transaksi Pembelian ({historyCustomer?.transactions?.length || 0})
            </h4>

            {historyCustomer?.transactions?.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Belum ada transaksi pembelian.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historyCustomer?.transactions?.map((t) => (
                  <div key={t.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-gray-900">{t.invoice_number}</span>
                      <span className="text-gray-400 text-[10px] block">{formatDateTime(t.transaction_date)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-900 block">{formatRupiah(t.grand_total)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        t.payment_status === "Lunas" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {t.payment_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Detail Pelanggan Modal (Eye icon) */}
      {selectedDetailCustomer && (
        <Modal
          isOpen={Boolean(selectedDetailCustomer)}
          onClose={() => setSelectedDetailCustomer(null)}
          title={`Detail Pasien: ${selectedDetailCustomer.name}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded">
                  {selectedDetailCustomer.code}
                </span>
                <h3 className="font-extrabold text-sm sm:text-base text-gray-900 mt-1">
                  {selectedDetailCustomer.name}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-gray-500 font-medium block">
                  {selectedDetailCustomer.gender}
                </span>
                {selectedDetailCustomer.age && (
                  <span className="font-bold text-gray-800">
                    {selectedDetailCustomer.age} Tahun
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2.5 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-400 block text-[11px]">Nomor WhatsApp / HP:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {selectedDetailCustomer.phone}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-gray-200/80">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-400 block text-[11px]">Alamat Lengkap:</span>
                  <span className="text-gray-800 font-medium leading-relaxed">
                    {selectedDetailCustomer.address || "-"}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 pt-2 border-t border-gray-200/80">
                <FileText className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-400 block text-[11px]">Catatan Preferensi / Pasien:</span>
                  <span className="text-gray-800 font-medium leading-relaxed">
                    {selectedDetailCustomer.notes || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const cust = selectedDetailCustomer;
                  setSelectedDetailCustomer(null);
                  handleViewHistory(cust);
                }}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Buka Riwayat Medis</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const cleanPhone = (selectedDetailCustomer.phone || "").replace(/[^0-9]/g, "");
                  const waNumber = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
                  window.open(`https://wa.me/${waNumber}`, "_blank");
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat WhatsApp</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Pelanggan"
        message="Apakah Anda yakin ingin menghapus pelanggan ini? Seluruh riwayat transaksi dan rekam medis terkait akan ikut terhapus."
      />

      {/* Bulk Customer Import Modal */}
      <CustomerImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchCustomers}
      />
    </div>
  );
}
