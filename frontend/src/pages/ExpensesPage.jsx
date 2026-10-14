import React, { useState, useEffect } from "react";
import {
  WalletCards,
  Plus,
  Search,
  Edit2,
  Trash2,
  Printer,
  Calendar,
  DollarSign,
  User,
  Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatRupiah } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";

const initialForm = {
  expense_date: new Date().toISOString().slice(0, 10),
  category: "Operasional Toko",
  amount: "",
  description: "",
  recipient: "",
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [totalExpenseSum, setTotalExpenseSum] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [page, limit, debouncedSearch, categoryFilter]);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
      };
      if (categoryFilter) params.category = categoryFilter;

      const res = await request.get(API_ENDPOINTS.EXPENSES.LIST, params);
      if (res?.success) {
        setExpenses(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
        setTotalExpenseSum(res.summary?.totalExpenseSum || 0);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat pengeluaran");
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

  const handleOpenEdit = (ex) => {
    setFormData({
      expense_date: ex.expense_date ? ex.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      category: ex.category,
      amount: ex.amount,
      description: ex.description,
      recipient: ex.recipient || "",
    });
    setIsEditing(true);
    setEditId(ex.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) {
      toast.error("Jumlah pengeluaran dan Keterangan wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await request.put(API_ENDPOINTS.EXPENSES.UPDATE(editId), formData);
        toast.success("Catatan pengeluaran diperbarui");
      } else {
        await request.post(API_ENDPOINTS.EXPENSES.CREATE, formData);
        toast.success("Pengeluaran kas berhasil dicatat");
      }
      setIsModalOpen(false);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan pengeluaran");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await request.delete(API_ENDPOINTS.EXPENSES.DELETE(deleteId));
      toast.success("Pengeluaran berhasil dihapus");
      setDeleteId(null);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus pengeluaran");
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrintExpenses = () => {
    window.print();
  };

  const headers = [
    { label: "Tanggal Pengeluaran", align: "left" },
    { label: "Kategori Kas", align: "center" },
    { label: "Keterangan & Rincian", align: "left" },
    { label: "Penerima / Vendor", align: "left" },
    { label: "Jumlah Biaya", align: "right" },
    { label: "Aksi", align: "center" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-blue-600" />
            Pengeluaran Kas & Biaya Operasional
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pencatatan kas keluar harian toko optik (listrik, bahan lab, servis mesin, gaji, sewa)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintExpenses}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span>Cetak Rekap</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pengeluaran</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
              Total Pengeluaran Filter
            </span>
            <span className="text-xl font-extrabold text-red-600">
              {formatRupiah(totalExpenseSum)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari keterangan atau penerima..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">Semua Kategori</option>
            <option value="Listrik & Air">Listrik & Air</option>
            <option value="Pembelian Bahan/Lensa">Pembelian Bahan/Lensa</option>
            <option value="Gaji & Bonus">Gaji & Bonus</option>
            <option value="Sewa Tempat">Sewa Tempat</option>
            <option value="Operasional Toko">Operasional Toko</option>
            <option value="Perawatan Mesin">Perawatan Mesin Edger</option>
            <option value="Lain-lain">Lain-lain</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Total Entri: <span className="font-bold text-gray-800">{totalItems}</span>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={expenses.length === 0}
        emptyMessage="Belum ada data pengeluaran."
      >
        {expenses.map((ex) => (
          <tr key={ex.id} className="hover:bg-gray-50/70 transition-colors">
            {/* Date */}
            <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-gray-800">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {formatDate(ex.expense_date)}
              </div>
            </td>

            {/* Category */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                {ex.category}
              </span>
            </td>

            {/* Description */}
            <td className="px-4 py-3 text-xs text-gray-900 font-medium whitespace-nowrap max-w-sm truncate">
              {ex.description}
            </td>

            {/* Recipient */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
              {ex.recipient || "-"}
            </td>

            {/* Amount */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-bold text-red-600">
              {formatRupiah(ex.amount)}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(ex)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Edit Pengeluaran"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(ex.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus Pengeluaran"
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? "Edit Catatan Pengeluaran" : "Catat Pengeluaran Operasional"}
        subtitle="Form arus kas keluar toko optik"
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
              {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Pengeluaran"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Tanggal Kas Keluar <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.expense_date}
                onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value="Operasional Toko">Operasional Toko</option>
                <option value="Listrik & Air">Listrik & Air</option>
                <option value="Pembelian Bahan/Lensa">Pembelian Bahan/Lensa</option>
                <option value="Perawatan Mesin">Perawatan Mesin Edger</option>
                <option value="Gaji & Bonus">Gaji & Bonus</option>
                <option value="Sewa Tempat">Sewa Tempat</option>
                <option value="Lain-lain">Lain-lain</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Jumlah Nominal (Rp) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm font-bold bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Keterangan Pengeluaran <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Beli kertas struk thermal & lap microfiber..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Penerima / Vendor</label>
            <input
              type="text"
              value={formData.recipient}
              onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Toko ATK Merdeka / PLN"
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Pengeluaran"
        message="Apakah Anda yakin ingin menghapus catatan pengeluaran ini?"
      />
    </div>
  );
}
