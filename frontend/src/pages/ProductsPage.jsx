import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  Upload,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Printer,
  Eye,
  ChevronDown,
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
import ProductImportModal from "@/components/common/ProductImportModal";
import { exportProductsToExcel } from "@/utils/bulkDataHandler";
import { useApp } from "@/context/AppContext";

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

/**
 * Clean iframe print function for master products stock & catalog
 */
function printProductCatalog(products, categoryFilter, settings = {}) {
  const storeName = settings.store_name || "Optik Raja Official";
  const permitNo = settings.optician_permit_no || "KEMENKES RI NO. 445/RO-OPT/JBR/2024";
  const address = settings.address || "Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara";
  const phone = settings.phone || "0812-9876-5432";

  const totalStock = products.reduce((acc, p) => acc + (parseInt(p.stock) || 0), 0);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8" />
        <title>Katalog Master Produk - ${storeName}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm 14mm; }
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
          body { color: #0f172a; margin: 0; padding: 0; font-size: 11px; }
          .letterhead { border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
          .store-name { font-size: 16px; font-weight: 800; color: #0f172a; }
          .store-meta { font-size: 9px; color: #475569; margin-top: 2px; }
          .title-banner { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; }
          .title { font-size: 12px; font-weight: 800; color: #1e3a8a; }
          .subtitle { font-size: 9px; color: #64748b; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
          th { background: #1e3a8a; color: #ffffff; font-weight: 700; padding: 6px 8px; border: 1px solid #1e3a8a; }
          td { padding: 6px 8px; border: 1px solid #e2e8f0; color: #1e293b; }
          tr:nth-child(even) td { background-color: #f8fafc; }
          .total-row td { background: #f1f5f9; font-weight: 800; border-top: 2px solid #cbd5e1; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .signature-box { margin-top: 24px; float: right; width: 200px; text-align: center; }
          .signature-space { height: 50px; }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <div class="store-name">${storeName.toUpperCase()}</div>
          <div class="store-meta">Izin: ${permitNo} | Alamat: ${address} | Telp: ${phone}</div>
        </div>
        <div class="title-banner">
          <div class="title">KATALOG MASTER PRODUK & INVENTARIS OPTIK</div>
          <div class="subtitle">Kategori: ${categoryFilter || "Semua Jenis"} | Waktu Cetak: ${new Date().toLocaleString("id-ID")}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 18%;">Barcode / SKU</th>
              <th style="width: 37%;">Nama Produk & Spesifikasi</th>
              <th style="width: 15%; text-align: center;">Kategori</th>
              <th style="width: 10%; text-align: center;">Stok</th>
              <th style="width: 15%; text-align: right;">Harga Jual</th>
            </tr>
          </thead>
          <tbody>
            ${
              products.length > 0
                ? products.map((p, idx) => `
                  <tr>
                    <td class="text-center">${idx + 1}</td>
                    <td style="font-family: monospace;">${p.barcode || p.sku}</td>
                    <td class="font-bold">
                      ${p.name}
                      ${p.specifications ? `<br/><span style="font-size: 8.5px; color: #2563eb; font-weight: normal;">${p.specifications}</span>` : ""}
                    </td>
                    <td class="text-center">${p.category}</td>
                    <td class="text-center font-bold">${p.stock} ${p.unit || "Pcs"}</td>
                    <td class="text-right font-bold" style="color: #047857;">${formatRupiah(p.selling_price)}</td>
                  </tr>
                `).join("")
                : '<tr><td colspan="6" class="text-center">Tidak ada produk yang terdaftar.</td></tr>'
            }
            <tr class="total-row">
              <td colspan="4" class="text-center">TOTAL PRODUK (${products.length} Item)</td>
              <td class="text-center font-bold">${totalStock} Pcs</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div class="signature-box">
          <div>${new Date().toLocaleDateString("id-ID")}</div>
          <div>Penanggung Jawab Optik,</div>
          <div class="signature-space"></div>
          <div class="font-bold">( ${storeName} )</div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 60000);
      }
    }, 250);
  };
}

export default function ProductsPage() {
  const { settings } = useApp();
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

  // Detail Modal State (Eye icon)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Delete Confirm State
  const [deleteId, setDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Bulk Import & Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportProducts = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await request.get(API_ENDPOINTS.PRODUCTS.EXPORT, params);
      if (res?.success && res?.data) {
        if (res.data.length === 0) {
          toast.error("Tidak ada data produk untuk diekspor");
          return;
        }
        const fileName = exportProductsToExcel(res.data);
        toast.success(`Berhasil mengekspor ${res.data.length} produk (${fileName})!`);
      }
    } catch (err) {
      console.error("Gagal ekspor produk:", err);
      toast.error(err.message || "Gagal mengekspor data produk");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintCatalog = () => {
    if (products.length === 0) {
      toast.error("Tidak ada data produk untuk dicetak");
      return;
    }
    printProductCatalog(products, categoryFilter, settings);
    toast.success("Membuka dialog cetak katalog produk...");
  };

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
      sku: p.sku || "",
      barcode: p.barcode || "",
      name: p.name || "",
      category: p.category || "Frame",
      brand: p.brand || "",
      cost_price: p.cost_price || "",
      selling_price: p.selling_price || "",
      stock: p.stock !== undefined ? p.stock : 10,
      unit: p.unit || "Pcs",
      specifications: p.specifications || "",
      image: p.image || "",
      is_active: p.is_active !== undefined ? p.is_active : 1,
    });
    setIsEditing(true);
    setEditId(p.id);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (p) => {
    setSelectedProduct(p);
    setIsDetailModalOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 2MB");
      return;
    }

    setIsUploadingImage(true);
    const form = new FormData();
    form.append("image", file);

    try {
      const res = await request.post(API_ENDPOINTS.UPLOAD, form);
      if (res?.success) {
        setFormData((prev) => ({ ...prev, image: res.data.url }));
        toast.success("Foto produk berhasil diunggah");
      }
    } catch (err) {
      toast.error(err.message || "Gagal mengunggah foto produk");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.selling_price || !formData.sku) {
      toast.error("SKU, Nama Produk, dan Harga Jual wajib diisi");
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

  // Compact 4-Column Table Header (Matching User's Reference Screenshot)
  const headers = [
    { label: "NAMA PRODUK", align: "left", className: "px-2.5 sm:px-4" },
    { label: "STOK", align: "center", className: "w-16 sm:w-20 px-1 sm:px-3 text-center" },
    { label: "HARGA JUAL", align: "right", className: "w-28 sm:w-36 px-2 sm:px-4 text-right" },
    { label: "AKSI", align: "center", className: "w-28 sm:w-36 px-1 sm:px-3 text-center" },
  ];

  return (
    <div className="space-y-3.5 sm:space-y-5">
      {/* Search Input Bar (Matching Screenshot) */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari Nama, Barcode, Ukuran..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs placeholder:text-gray-400"
        />
      </div>

      {/* Category Dropdown (Matching Screenshot) */}
      <div className="relative w-full">
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="w-full px-3.5 py-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 shadow-2xs appearance-none cursor-pointer pr-10"
        >
          <option value="">Semua Jenis</option>
          <option value="Frame">Frame Kacamata</option>
          <option value="Lensa">Lensa Optik</option>
          <option value="Aksesori">Aksesori & Cairan</option>
          <option value="Lensa Kontak">Lensa Kontak</option>
        </select>
        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* 4 Action Buttons Grid (Print, Export, Import, Tambah) - Matching Screenshot */}
      <div className="grid grid-cols-4 gap-2">
        {/* 1. Print Button */}
        <button
          type="button"
          onClick={handlePrintCatalog}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
          title="Cetak katalog & inventaris produk"
        >
          <Printer className="w-3.5 h-3.5 shrink-0" />
          <span>Print</span>
        </button>

        {/* 2. Export Button */}
        <button
          type="button"
          onClick={handleExportProducts}
          disabled={isLoading || isExporting}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-600 border border-emerald-500 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          title="Download data produk format Excel"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
          )}
          <span>Export</span>
        </button>

        {/* 3. Import Button */}
        <button
          type="button"
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-white hover:bg-cyan-50 active:scale-[0.98] text-cyan-600 border border-cyan-500 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
          title="Import masal produk dari Excel/CSV"
        >
          <Upload className="w-3.5 h-3.5 shrink-0 text-cyan-600" />
          <span>Import</span>
        </button>

        {/* 4. Tambah Button */}
        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-1.5 px-2 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
          title="Tambah produk baru"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Product Table (Compact, Anti-Overflow, Responsive) */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={products.length === 0}
        emptyMessage="Belum ada data produk."
      >
        {products.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
            {/* 1. NAMA PRODUK + SIZE/SPEC + BARCODE & KATEGORI */}
            <td className="px-2.5 sm:px-4 py-3 align-middle">
              {/* Product Name */}
              <div className="font-bold text-xs sm:text-sm text-gray-900 leading-tight">
                {p.name}
              </div>

              {/* Specifications / Size (e.g. Size: S:00 C:0 A:+175) */}
              {p.specifications && (
                <div className="text-[11px] font-semibold text-blue-600 mt-0.5 leading-tight">
                  {p.specifications.toLowerCase().startsWith("size:")
                    ? p.specifications
                    : p.category === "Lensa"
                    ? `Size: ${p.specifications}`
                    : p.specifications}
                </div>
              )}

              {/* Barcode & Category Badges (Matching Screenshot) */}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-gray-600 bg-gray-50 border border-gray-200">
                  <Barcode className="w-3 h-3 text-gray-400" />
                  <span>{p.barcode || p.sku}</span>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold text-white bg-slate-600">
                  {p.category}
                </span>
                {p.brand && (
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-gray-500 bg-gray-100">
                    {p.brand}
                  </span>
                )}
              </div>
            </td>

            {/* 2. STOK (Blue Rounded Pill Badge) */}
            <td className="px-1 sm:px-3 py-3 text-center align-middle whitespace-nowrap">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold text-white bg-blue-600 shadow-2xs">
                {p.stock}
              </span>
            </td>

            {/* 3. HARGA JUAL (Green Bold Text) */}
            <td className="px-2 sm:px-4 py-3 text-right align-middle whitespace-nowrap">
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600">
                {formatRupiah(p.selling_price)}
              </span>
            </td>

            {/* 4. AKSI (Eye, Edit, Trash Outline Buttons) */}
            <td className="px-1 sm:px-3 py-3 text-center align-middle whitespace-nowrap">
              <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5">
                {/* Detail (Eye) Button - Cyan outline */}
                <button
                  type="button"
                  onClick={() => handleOpenDetail(p)}
                  className="p-1.5 rounded-lg border border-cyan-400 text-cyan-600 bg-white hover:bg-cyan-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="Lihat Rincian Produk"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>

                {/* Edit (Pencil) Button - Amber outline */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(p)}
                  className="p-1.5 rounded-lg border border-amber-400 text-amber-600 bg-white hover:bg-amber-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="Edit Data Produk"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                {/* Delete (Trash) Button - Rose outline */}
                <button
                  type="button"
                  onClick={() => setDeleteId(p.id)}
                  className="p-1.5 rounded-lg border border-rose-400 text-rose-600 bg-white hover:bg-rose-50 active:scale-95 transition-all cursor-pointer shadow-2xs"
                  title="Hapus Produk"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
        itemName="produk"
        compact={true}
      />

      {/* ==========================================
          PRODUCT DETAIL MODAL (EYE ICON TRIGGER)
         ========================================== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedProduct(null);
        }}
        title="Rincian Master Produk"
        subtitle={selectedProduct ? `${selectedProduct.category} • ${selectedProduct.sku}` : ""}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                setIsDetailModalOpen(false);
                setSelectedProduct(null);
              }}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={() => {
                const prod = selectedProduct;
                setIsDetailModalOpen(false);
                handleOpenEdit(prod);
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Produk</span>
            </button>
          </div>
        }
      >
        {selectedProduct && (
          <div className="space-y-4">
            {/* Foto Produk Preview sementara disembunyikan */}

            {/* Nama Produk & Kategori */}
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white bg-slate-600">
                  {selectedProduct.category}
                </span>
                {selectedProduct.brand && (
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-gray-700 bg-gray-100 border border-gray-200">
                    Merk: {selectedProduct.brand}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-gray-900 mt-1.5">
                {selectedProduct.name}
              </h3>
              {selectedProduct.specifications && (
                <p className="text-xs font-semibold text-blue-600 mt-0.5">
                  Ukuran / Spesifikasi: {selectedProduct.specifications}
                </p>
              )}
            </div>

            {/* Detailed Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">SKU Produk</span>
                <span className="font-mono font-bold text-gray-800">{selectedProduct.sku}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Barcode Fisik</span>
                <span className="font-mono font-bold text-gray-800">{selectedProduct.barcode || "-"}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Harga Modal (HPP)</span>
                <span className="font-bold text-gray-700">{formatRupiah(selectedProduct.cost_price)}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Harga Jual</span>
                <span className="font-extrabold text-emerald-600">{formatRupiah(selectedProduct.selling_price)}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Sisa Stok</span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-white bg-blue-600 mt-0.5">
                  {selectedProduct.stock} {selectedProduct.unit}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Estimasi Margin</span>
                <span className="font-bold text-blue-700">
                  {formatRupiah((selectedProduct.selling_price || 0) - (selectedProduct.cost_price || 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ==========================================
          CREATE / EDIT PRODUCT MODAL
         ========================================== */}
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
                <option value="Lensa Kontak">Lensa Kontak</option>
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

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Ukuran / Spesifikasi (Misal: S:00 C:0 A:+175)
            </label>
            <input
              type="text"
              value={formData.specifications}
              onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Size: S:00 C:0 A:+175 / Single Vision Index 1.56"
            />
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

          {/* Foto Produk Input & Preview sementara disembunyikan sesuai permintaan */}
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

      {/* Bulk Product Import Modal */}
      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchProducts}
      />
    </div>
  );
}
