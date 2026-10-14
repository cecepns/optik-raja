import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Percent,
  DollarSign,
  ShieldCheck,
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

const initialForm = {
  name: "",
  role: "Kasir",
  phone: "",
  commission_type: "percentage",
  commission_rate: 2.0,
  is_active: 1,
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [roleFilter, setRoleFilter] = useState("");

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
    fetchEmployees();
  }, [page, limit, debouncedSearch, roleFilter]);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
      };
      if (roleFilter) params.role = roleFilter;

      const res = await request.get(API_ENDPOINTS.EMPLOYEES.LIST, params);
      if (res?.success) {
        setEmployees(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat pegawai");
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

  const handleOpenEdit = (emp) => {
    setFormData({
      name: emp.name,
      role: emp.role,
      phone: emp.phone || "",
      commission_type: emp.commission_type || "percentage",
      commission_rate: emp.commission_rate || 0,
      is_active: emp.is_active,
    });
    setIsEditing(true);
    setEditId(emp.id);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.role) {
      toast.error("Nama dan Role Pegawai wajib diisi");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await request.put(API_ENDPOINTS.EMPLOYEES.UPDATE(editId), formData);
        toast.success("Data pegawai berhasil diperbarui");
      } else {
        await request.post(API_ENDPOINTS.EMPLOYEES.CREATE, formData);
        toast.success("Pegawai baru berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan pegawai");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await request.delete(API_ENDPOINTS.EMPLOYEES.DELETE(deleteId));
      toast.success("Pegawai berhasil dihapus");
      setDeleteId(null);
      fetchEmployees();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus pegawai");
    } finally {
      setIsDeleting(false);
    }
  };

  const headers = [
    { label: "Nama Pegawai", align: "left" },
    { label: "Role / Jabatan", align: "center" },
    { label: "Kontak WhatsApp", align: "left" },
    { label: "Tipe Komisi", align: "center" },
    { label: "Besaran Komisi", align: "right" },
    { label: "Status", align: "center" },
    { label: "Aksi", align: "center" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            Master Pegawai, Kasir & Refraksionis (RO)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manajemen data pegawai toko optik dan skema komisi penjualan
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pegawai Baru</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama atau nomor telepon..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">Semua Role</option>
            <option value="Owner">Owner</option>
            <option value="Refraksionis Optisien">Refraksionis Optisien (RO)</option>
            <option value="Kasir">Kasir</option>
            <option value="Teknisi Lab">Teknisi Lab</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Total Pegawai: <span className="font-bold text-gray-800">{totalItems}</span>
        </div>
      </div>

      {/* Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={employees.length === 0}
        emptyMessage="Belum ada data pegawai."
      >
        {employees.map((emp) => (
          <tr key={emp.id} className="hover:bg-gray-50/70 transition-colors">
            {/* Name */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-gray-900">{emp.name}</div>
            </td>

            {/* Role */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  emp.role === "Owner"
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : emp.role === "Refraksionis Optisien"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : emp.role === "Teknisi Lab"
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                }`}
              >
                {emp.role}
              </span>
            </td>

            {/* Phone */}
            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700">
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>{emp.phone || "-"}</span>
              </div>
            </td>

            {/* Commission Type */}
            <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-gray-600">
              {emp.commission_type === "percentage" ? "Persentase Penjualan" : "Nominal Tetap / Order"}
            </td>

            {/* Commission Rate */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900">
              {emp.commission_type === "percentage"
                ? `${parseFloat(emp.commission_rate)}%`
                : formatRupiah(emp.commission_rate)}
            </td>

            {/* Status */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  emp.is_active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {emp.is_active ? "Aktif" : "Non-Aktif"}
              </span>
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(emp)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Edit Data"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(emp.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus Pegawai"
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
        title={isEditing ? "Edit Data Pegawai" : "Tambah Pegawai Baru"}
        subtitle="Kelola petugas kasir, refraksionis, dan teknisi lab"
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
              {isSubmitting ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Simpan Pegawai"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nama Pegawai <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Contoh: Budi Santoso, A.Md.RO"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Role / Jabatan <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="Kasir">Kasir</option>
              <option value="Refraksionis Optisien">Refraksionis Optisien (RO)</option>
              <option value="Teknisi Lab">Teknisi Lab Fasetting</option>
              <option value="Owner">Owner / Pemilik Toko</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">Nomor WhatsApp / HP</label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="0812xxxxxxxx"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Skema Komisi</label>
              <select
                value={formData.commission_type}
                onChange={(e) => setFormData({ ...formData, commission_type: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="percentage">Persentase (%)</option>
                <option value="fixed">Nominal Tetap (Rp)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                {formData.commission_type === "percentage" ? "Rate Komisi (%)" : "Nominal Komisi (Rp)"}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.commission_rate}
                onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
              />
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
        title="Hapus Pegawai"
        message="Apakah Anda yakin ingin menghapus data pegawai ini?"
      />
    </div>
  );
}
