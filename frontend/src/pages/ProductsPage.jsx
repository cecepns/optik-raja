import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  Tag,
  AlertTriangle,
  Upload,
  Image,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatRupiah } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ProductImage from "@/components/common/ProductImage";

const initialForm = {
  sku: "",
  barcode: "",
  name: "",
  category: "Frame",
  brand: "",
  cost_price: "",
  selling_price: "",
  stock: 10,
  unit: "Pcs",
  specifications: "",
  image: "",
  is_active: 1,
};

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [page, limit, debouncedSearch, categoryFilter]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
      };
      if (categoryFilter) params.category = categoryFilter;

      const res = await request.get(API_ENDPOINTS.PRODUCTS.LIST, params);
      if (res?.success) {
        setProducts(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat produk");
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

  const handleOpenEdit = (p) => {
    setFormData({
      sku: p.sku,
      barcode: p.barcode || "",
      name: p.name,
      category: p.category,
      brand: p.brand || "",
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      stock: p.stock,
      unit: p.unit || "Pcs",
      specifications: p.specifications || "",
      image: p.image || "",
      is_active: p.is_active,
    });
    setIsEditing(true);
    setEditId(p.id);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file gambar maksimal 5MB");
      return;
    }

    try {
      setIsUploadingImage(true);
      const res = await request.upload(API_ENDPOINTS.UPLOAD, file);
      if (res?.url) {
        setFormData((prev) => ({ ...prev, image: res.url }));
        toast.success("Foto produk berhasil diunggah!");
      }
    } catch (err) {
      toast.error(err.message || "Gagal mengunggah foto produk");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.category) {
      toast.error("SKU, Nama Produk, dan Kategori wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await request.put(API_ENDPOINTS.PRODUCTS.UPDATE(editId), formData);
        toast.success("Produk berhasil diperbarui");
      } else {
        await request.post(API_ENDPOINTS.PRODUCTS.CREATE, formData);
        toast.success("Produk baru berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan produk");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await request.delete(API_ENDPOINTS.PRODUCTS.DELETE(deleteId));
      toast.success("Produk berhasil dihapus");
      setDeleteId(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus produk");
    } finally {
      setIsDeleting(false);
    }
  };

  const headers = [
    { label: "Foto", align: "center", className: "w-16" },
    { label: "SKU & Barcode", align: "left" },
    { label: "Nama Produk & Brand", align: "left" },
    { label: "Kategori", align: "center" },
    { label: "Harga Modal", align: "right" },
    { label: "Harga Jual", align: "right" },
    { label: "Sisa Stok", align: "center" },
    { label: "Spesifikasi", align: "left" },
    { label: "Aksi", align: "center" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Master Produk & Inventaris Optik
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Katalog frame kacamata, lensa optik ber-index, serta aksesori dan cairan pembersih
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Produk Baru</span>
        </button>
      </div>

      {/* Toolbar Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari SKU, barcode, nama produk, brand..."
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
            <option value="Frame">Frame Kacamata</option>
            <option value="Lensa">Lensa Optik</option>
            <option value="Aksesori">Aksesori & Cairan</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Total Katalog: <span className="font-bold text-gray-800">{totalItems}</span> item
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={products.length === 0}
        emptyMessage="Belum ada data produk."
      >
        {products.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
            {/* Foto Produk */}
            <td className="px-4 py-3 text-center">
              <ProductImage
                src={p.image}
                name={p.name}
                category={p.category}
                className="w-12 h-12 rounded-xl mx-auto"
                iconSize={15}
              />
            </td>

            {/* SKU & Barcode */}
            <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
              <span className="font-bold text-blue-900 block">{p.sku}</span>
              <span className="text-[10px] text-gray-400">{p.barcode || "-"}</span>
            </td>

            {/* Name & Brand */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-gray-900">{p.name}</div>
              {p.brand && <span className="text-[11px] text-gray-500">{p.brand}</span>}
            </td>

            {/* Category */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  p.category === "Frame"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : p.category === "Lensa"
                    ? "bg-cyan-50 text-cyan-700 border border-cyan-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {p.category}
              </span>
            </td>

            {/* Cost Price */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-gray-500">
              {formatRupiah(p.cost_price)}
            </td>

            {/* Selling Price */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900">
              {formatRupiah(p.selling_price)}
            </td>

            {/* Stock */}
            <td className="px-4 py-3 text-center whitespace-nowrap text-xs font-bold">
              <span
                className={`inline-block px-2 py-0.5 rounded ${
                  p.stock <= 5
                    ? "bg-red-50 text-red-700 font-extrabold"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {p.stock} {p.unit}
              </span>
            </td>

            {/* Specifications */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 max-w-xs truncate">
              {p.specifications || "-"}
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(p)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Edit Produk"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(p.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus Produk"
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
        title={isEditing ? "Edit Katalog Produk" : "Tambah Produk Baru"}
        subtitle="Kelola data frame, lensa, dan aksesoris optik"
        maxWidth="max-w-xl"
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
              {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Produk"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Kode SKU <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="FRM-RB-5228"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Barcode Scanner</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="8991001001"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nama Produk <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Frame Ray-Ban Wayfarer RX5228 Black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Kategori <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                <option value="Frame">Frame Kacamata</option>
                <option value="Lensa">Lensa Optik</option>
                <option value="Aksesori">Aksesori & Cairan</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Merk / Brand</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Ray-Ban, Essilor, Moscot..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Harga Modal Beli (Rp)</label>
              <input
                type="number"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Harga Jual (Rp) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Stok Tersedia</label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Satuan</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="Pcs">Pcs</option>
                <option value="Pasang">Pasang (Lensa)</option>
                <option value="Box">Box</option>
                <option value="Botol">Botol</option>
              </select>
            </div>
          </div>

          {/* Foto Produk Input & Preview */}
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1.5">
              Foto Produk (Opsional)
            </label>
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <ProductImage
                src={formData.image}
                name={formData.name || "Produk"}
                category={formData.category}
                className="w-16 h-16 rounded-xl shrink-0"
                iconSize={20}
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? "Mengunggah..." : "Unggah Foto"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploadingImage}
                      className="hidden"
                    />
                  </label>
                  {formData.image && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, image: "" })}
                      className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="Atau tempel URL gambar langsung (https://...)"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-normal"
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Hapus Produk"
        message="Apakah Anda yakin ingin menghapus produk ini dari katalog?"
      />
    </div>
  );
}
