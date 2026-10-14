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
  User,
  History,
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
    { label: "Kode & Pasien", align: "left" },
    { label: "Nomor WhatsApp / HP", align: "left" },
    { label: "Gender & Usia", align: "center" },
    { label: "Alamat Lengkap", align: "left" },
    { label: "Catatan Preferensi", align: "left" },
    { label: "Riwayat", align: "center" },
    { label: "Aksi", align: "center" },
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

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pelanggan Baru</span>
        </button>
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
            {/* Code & Name */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-gray-900">{c.name}</div>
              <span className="text-[10px] font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                {c.code}
              </span>
            </td>

            {/* Phone */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-800">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-medium">{c.phone}</span>
              </div>
            </td>

            {/* Gender & Age */}
            <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-gray-700">
              <span className="font-medium">{c.gender}</span>
              {c.age && <span className="text-gray-400 text-[11px] block">{c.age} Tahun</span>}
            </td>

            {/* Address */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 max-w-xs truncate">
              {c.address || "-"}
            </td>

            {/* Notes */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 max-w-xs truncate">
              {c.notes || "-"}
            </td>

            {/* History Button */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleViewHistory(c)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                title="Lihat Rekam Medis & Riwayat Belanja"
              >
                <History className="w-3.5 h-3.5" />
                <span>Riwayat</span>
              </button>
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(c)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Edit Data"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(c.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              Riwayat Resep Kacamata ({historyCustomer?.prescriptions?.length || 0})
            </h4>

            {historyCustomer?.prescriptions?.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Belum ada catatan resep periksa.</p>
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

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Pelanggan"
        message="Apakah Anda yakin ingin menghapus pelanggan ini? Seluruh riwayat transaksi dan resep terkait akan ikut terhapus."
      />
    </div>
  );
}
