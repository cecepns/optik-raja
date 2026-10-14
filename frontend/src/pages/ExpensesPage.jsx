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
  Tag,
  Check,
  X,
  Loader2,
  FolderKanban,
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

const EXPENSE_CATEGORIES_STORAGE_KEY = "optik_raja_expense_categories";

const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 1, name: "Operasional Toko", description: "Biaya umum dan operasional harian toko optik" },
  { id: 2, name: "Listrik & Air", description: "Tagihan rutin utilitas PLN, PDAM, dan internet optik" },
  { id: 3, name: "Pembelian Bahan/Lensa", description: "Pengadaan lensa mentah, sparepart, cairan, dan frame" },
  { id: 4, name: "Gaji & Bonus", description: "Gaji pokok, insentif nota kasir, dan komisi RO" },
  { id: 5, name: "Sewa Tempat", description: "Biaya sewa outlet ruko atau toko optik" },
  { id: 6, name: "Perawatan Mesin", description: "Servis rutin mesin edger/faset dan kalibrasi alat optik" },
  { id: 7, name: "Lain-lain", description: "Pengeluaran kas kecil lainnya yang belum terklasifikasi" },
];

function getInitialCategories() {
  try {
    const saved = localStorage.getItem(EXPENSE_CATEGORIES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("Gagal membaca cache kategori:", err);
  }
  return DEFAULT_EXPENSE_CATEGORIES;
}

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

  // Dynamic Categories State
  const [categories, setCategories] = useState(getInitialCategories);
  const [isCatLoading, setIsCatLoading] = useState(false);

  // Category Management Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);

  // Inline Category Edit State
  const [editingCatId, setEditingCatId] = useState(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");
  const [isSavingEditCat, setIsSavingEditCat] = useState(false);

  // Delete Category Confirm State
  const [deleteCatTarget, setDeleteCatTarget] = useState(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modal State (Expense)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirm State (Expense)
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Categories on Mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsCatLoading(true);
    try {
      const res = await request.get(API_ENDPOINTS.EXPENSE_CATEGORIES.LIST);
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setCategories(res.data);
        localStorage.setItem(EXPENSE_CATEGORIES_STORAGE_KEY, JSON.stringify(res.data));
      }
    } catch (err) {
      console.warn("API kategori tidak tersedia, menggunakan data lokal:", err.message);
    } finally {
      setIsCatLoading(false);
    }
  };

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
    const defaultCat = categories[0]?.name || "Operasional Toko";
    setFormData({
      ...initialForm,
      category: defaultCat,
    });
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

  // ==========================================
  // Category Management Handlers (Tambah, Edit, Hapus)
  // ==========================================
  const handleAddCategory = async (e) => {
    e?.preventDefault();
    if (!newCatName || !newCatName.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }

    const trimmed = newCatName.trim();
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`Kategori "${trimmed}" sudah ada`);
      return;
    }

    setIsSubmittingCat(true);
    try {
      let createdCategory = {
        id: Date.now(),
        name: trimmed,
        description: newCatDesc.trim(),
      };

      try {
        const res = await request.post(API_ENDPOINTS.EXPENSE_CATEGORIES.CREATE, {
          name: trimmed,
          description: newCatDesc.trim(),
        });
        if (res?.success && res.data) {
          createdCategory = res.data;
        }
      } catch (apiErr) {
        console.warn("API simpan kategori gagal, disimpan di penyimpanan lokal:", apiErr.message);
      }

      const updated = [...categories, createdCategory];
      setCategories(updated);
      localStorage.setItem(EXPENSE_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));

      setNewCatName("");
      setNewCatDesc("");
      toast.success(`Kategori "${trimmed}" berhasil ditambahkan!`);
    } catch (err) {
      toast.error(err.message || "Gagal menambah kategori");
    } finally {
      setIsSubmittingCat(false);
    }
  };

  const handleStartEditCategory = (cat) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatDesc(cat.description || "");
  };

  const handleCancelEditCategory = () => {
    setEditingCatId(null);
    setEditCatName("");
    setEditCatDesc("");
  };

  const handleSaveEditCategory = async (e) => {
    e?.preventDefault();
    if (!editCatName || !editCatName.trim()) {
      toast.error("Nama kategori wajib diisi");
      return;
    }

    const trimmed = editCatName.trim();
    if (
      categories.some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== editingCatId
      )
    ) {
      toast.error(`Kategori "${trimmed}" sudah digunakan`);
      return;
    }

    const currentCat = categories.find((c) => c.id === editingCatId);
    const oldName = currentCat?.name;

    setIsSavingEditCat(true);
    try {
      try {
        await request.put(API_ENDPOINTS.EXPENSE_CATEGORIES.UPDATE(editingCatId), {
          name: trimmed,
          description: editCatDesc.trim(),
        });
      } catch (apiErr) {
        console.warn("API update kategori gagal, diperbarui di penyimpanan lokal:", apiErr.message);
      }

      const updated = categories.map((c) =>
        c.id === editingCatId
          ? { ...c, name: trimmed, description: editCatDesc.trim() }
          : c
      );
      setCategories(updated);
      localStorage.setItem(EXPENSE_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));

      // Synchronize in-flight form & active filters
      if (categoryFilter === oldName) {
        setCategoryFilter(trimmed);
      }
      if (formData.category === oldName) {
        setFormData((prev) => ({ ...prev, category: trimmed }));
      }

      setEditingCatId(null);
      toast.success(`Kategori berhasil diperbarui menjadi "${trimmed}"`);
      fetchExpenses();
    } catch (err) {
      toast.error(err.message || "Gagal memperbarui kategori");
    } finally {
      setIsSavingEditCat(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCatTarget) return;
    setIsDeletingCat(true);
    try {
      try {
        await request.delete(API_ENDPOINTS.EXPENSE_CATEGORIES.DELETE(deleteCatTarget.id));
      } catch (apiErr) {
        console.warn("API delete kategori gagal, dihapus dari penyimpanan lokal:", apiErr.message);
      }

      const updated = categories.filter((c) => c.id !== deleteCatTarget.id);
      setCategories(updated);
      localStorage.setItem(EXPENSE_CATEGORIES_STORAGE_KEY, JSON.stringify(updated));

      if (categoryFilter === deleteCatTarget.name) {
        setCategoryFilter("");
      }
      if (formData.category === deleteCatTarget.name) {
        setFormData((prev) => ({
          ...prev,
          category: updated[0]?.name || "Operasional Toko",
        }));
      }

      toast.success(`Kategori "${deleteCatTarget.name}" berhasil dihapus`);
      setDeleteCatTarget(null);
    } catch (err) {
      toast.error(err.message || "Gagal menghapus kategori");
    } finally {
      setIsDeletingCat(false);
    }
  };

  // Filtered categories in modal search
  const filteredCategories = categories.filter((c) => {
    if (!catSearch) return true;
    const q = catSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

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

        <div className="flex flex-wrap items-center gap-2">
          {/* Kelola Kategori Button */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-700 border border-gray-200 rounded-lg text-xs font-bold shadow-2xs transition-all shrink-0 cursor-pointer"
            title="Tambah, edit nama, atau hapus kategori pengeluaran kas"
          >
            <Tag className="w-4 h-4 text-blue-600" />
            <span>Kelola Kategori</span>
            <span className="px-1.5 py-0.2 bg-blue-50 text-blue-700 rounded-full text-[10px] font-extrabold">
              {categories.length}
            </span>
          </button>

          {/* Cetak Rekap Button */}
          <button
            type="button"
            onClick={handlePrintExpenses}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold shadow-2xs transition-all shrink-0 cursor-pointer"
            title="Cetak lembar rekapitulasi pengeluaran kas"
          >
            <Printer className="w-4 h-4 text-gray-600" />
            <span>Cetak Rekap</span>
          </button>

          {/* Catat Pengeluaran Button */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-xs transition-all shrink-0 cursor-pointer"
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

          {/* Dynamic Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">Semua Kategori ({categories.length})</option>
            {categories.map((cat) => (
              <option key={cat.id || cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span>
            Total Entri: <strong className="text-gray-800">{totalItems}</strong>
          </span>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="text-blue-600 hover:text-blue-700 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Kelola Kategori</span>
          </button>
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
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
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
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Pengeluaran"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(ex.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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

      {/* Create / Edit Expense Modal */}
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-700">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-[10px] text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                  title="Tambah atau kelola kategori pengeluaran"
                >
                  + Kelola
                </button>
              </div>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                {categories.map((cat) => (
                  <option key={cat.id || cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
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

      {/* ==========================================
          CATEGORY MANAGEMENT MODAL (TAMBAH, EDIT, HAPUS)
         ========================================== */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          handleCancelEditCategory();
        }}
        title="Kelola Kategori Pengeluaran Kas"
        subtitle="Tambah, ubah nama, atau hapus kategori biaya operasional"
        maxWidth="max-w-2xl"
        footer={
          <button
            type="button"
            onClick={() => {
              setIsCategoryModalOpen(false);
              handleCancelEditCategory();
            }}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
          >
            Tutup
          </button>
        }
      >
        <div className="space-y-4">
          {/* Quick Add Category Form */}
          <form
            onSubmit={handleAddCategory}
            className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-200 space-y-2.5"
          >
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-blue-900">
              <Plus className="w-4 h-4 text-blue-600" />
              <span>Tambah Kategori Baru</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Nama Kategori <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Biaya Marketing / Pajak Toko"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-700 block mb-1">
                  Keterangan / Deskripsi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Iklan medsos, brosur, promo optik"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSubmittingCat || !newCatName.trim()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingCat ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Simpan Kategori</span>
              </button>
            </div>
          </form>

          {/* Search Categories */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kategori..."
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium shrink-0">
              Total: <strong className="text-gray-800">{categories.length}</strong> Kategori
            </div>
          </div>

          {/* Categories List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-xl bg-white shadow-2xs">
            {filteredCategories.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Tidak ada kategori yang cocok.
              </div>
            ) : (
              filteredCategories.map((cat) => (
                <div
                  key={cat.id || cat.name}
                  className="p-3 hover:bg-gray-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  {editingCatId === cat.id ? (
                    /* Inline Editing Mode */
                    <form
                      onSubmit={handleSaveEditCategory}
                      className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                    >
                      <input
                        type="text"
                        required
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        className="px-2.5 py-1 text-xs font-bold bg-white border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 sm:w-44"
                        placeholder="Nama kategori"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editCatDesc}
                        onChange={(e) => setEditCatDesc(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex-1"
                        placeholder="Deskripsi kategori"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="submit"
                          disabled={isSavingEditCat || !editCatName.trim()}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          title="Simpan Perubahan Kategori"
                        >
                          {isSavingEditCat ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Simpan</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditCategory}
                          className="p-1 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                          title="Batal Edit"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Normal Display Mode */
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            {cat.name}
                          </span>
                        </div>
                        {cat.description && (
                          <p className="text-[11px] text-gray-500 mt-1 truncate">
                            {cat.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title={`Ubah nama kategori "${cat.name}"`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteCatTarget(cat)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title={`Hapus kategori "${cat.name}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Expense Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Pengeluaran"
        message="Apakah Anda yakin ingin menghapus catatan pengeluaran ini?"
      />

      {/* Delete Category Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteCatTarget}
        onClose={() => setDeleteCatTarget(null)}
        onConfirm={handleConfirmDeleteCategory}
        isLoading={isDeletingCat}
        title="Hapus Kategori Pengeluaran"
        message={`Apakah Anda yakin ingin menghapus kategori "${deleteCatTarget?.name}"? Pengeluaran yang sudah tercatat sebelumnya tetap akan tersimpan.`}
      />
    </div>
  );
}
