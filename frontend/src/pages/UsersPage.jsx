import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Pencil,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  Mail,
  Phone,
  UserCheck,
  UserCog,
  RefreshCw,
} from "lucide-react";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import toast from "react-hot-toast";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' | 'edit'
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    role: "Kasir",
    employee_id: "",
    phone: "",
    is_active: 1,
  });

  // Confirm Delete Dialog State
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search effect (350ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        page,
        limit,
        search: debouncedSearch,
        role: roleFilter,
        is_active: statusFilter,
      };

      const res = await request.get(API_ENDPOINTS.USERS.LIST, params);
      if (res?.success) {
        setUsers(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat data pengguna");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, roleFilter, statusFilter]);

  // Fetch Employees for linking account
  const fetchEmployees = async () => {
    try {
      const res = await request.get(API_ENDPOINTS.EMPLOYEES.LIST, { limit: 100 });
      if (res?.success) {
        setEmployees(res.data || []);
      }
    } catch (err) {
      console.warn("Gagal memuat daftar pegawai:", err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedUser(null);
    setFormData({
      name: "",
      username: "",
      email: "",
      password: "",
      role: "Kasir",
      employee_id: "",
      phone: "",
      is_active: 1,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user) => {
    setModalMode("edit");
    setSelectedUser(user);
    setFormData({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      password: "", // empty by default unless user wants to change
      role: user.role || "Kasir",
      employee_id: user.employee_id || "",
      phone: user.phone || "",
      is_active: user.is_active !== undefined ? user.is_active : 1,
    });
    setIsModalOpen(true);
  };

  // Submit Form
  const handleSubmitForm = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.username.trim()) {
      toast.error("Nama lengkap dan username wajib diisi");
      return;
    }

    if (modalMode === "create" && !formData.password) {
      toast.error("Kata sandi wajib diisi untuk pengguna baru");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        email: formData.email.trim() || null,
        role: formData.role,
        employee_id: formData.employee_id ? Number(formData.employee_id) : null,
        phone: formData.phone.trim() || null,
        is_active: Number(formData.is_active),
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      if (modalMode === "create") {
        await request.post(API_ENDPOINTS.USERS.CREATE, payload);
        toast.success("Pengguna baru berhasil ditambahkan!");
      } else {
        await request.put(API_ENDPOINTS.USERS.UPDATE(selectedUser.id), payload);
        toast.success("Data pengguna berhasil diperbarui!");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan data pengguna");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Confirmation
  const handleOpenDelete = (user) => {
    if (user.id === 1) {
      toast.error("Akun Owner utama tidak dapat dihapus!");
      return;
    }
    setDeleteTarget(user);
    setIsConfirmOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await request.delete(API_ENDPOINTS.USERS.DELETE(deleteTarget.id));
      toast.success(`Pengguna ${deleteTarget.name} berhasil dihapus!`);
      setIsConfirmOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || "Gagal menghapus pengguna");
    } finally {
      setIsDeleting(false);
    }
  };

  // Role Badge Styling
  const getRoleBadge = (role) => {
    switch (role) {
      case "Owner":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Kasir":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "Refraksionis Optisien":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Teknisi Lab":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Table Headers
  const tableHeaders = [
    { label: "No", align: "center", className: "w-14" },
    { label: "Pengguna", align: "left" },
    { label: "Role Hak Akses", align: "left" },
    { label: "Kontak / Email", align: "left" },
    { label: "Pegawai Terhubung", align: "left" },
    { label: "Status", align: "center" },
    { label: "Aksi", align: "center", className: "w-28" },
  ];

  // Calculate Summary KPI Stats
  const totalUsersCount = pagination.total || users.length;
  const ownerCount = users.filter((u) => u.role === "Owner").length;
  const kasirCount = users.filter((u) => u.role === "Kasir").length;
  const clinicalCount = users.filter((u) => u.role === "Refraksionis Optisien" || u.role === "Teknisi Lab").length;

  return (
    <div className="space-y-6">
      {/* Page Title & Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <UserCog className="w-8 h-8 text-blue-600" />
            Manajemen Pengguna Sistem
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Kelola akun login kasir, refraksionis, teknisi lab, dan hak akses administrator Optik Raja.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={fetchUsers}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all shadow-xs"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm hover:shadow transition-all"
          >
            <UserPlus className="w-5 h-5" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Pengguna</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalUsersCount}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Akun Terdaftar</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-purple-600">Owner & Admin</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{ownerCount}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Hak Akses Penuh</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Kasir Toko</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{kasirCount}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Operator POS</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-600">RO & Lab Teknisi</p>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{clinicalCount}</h3>
            <span className="text-xs text-slate-400 mt-0.5 inline-block">Klinis & Produksi</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 sm:gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan nama, username, email, telepon..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div className="w-full md:w-56">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
            >
              <option value="">Semua Role Akses</option>
              <option value="Owner">Owner / Administrator</option>
              <option value="Kasir">Kasir</option>
              <option value="Refraksionis Optisien">Refraksionis Optisien</option>
              <option value="Teknisi Lab">Teknisi Lab</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-xs"
            >
              <option value="">Semua Status</option>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <Table
        headers={tableHeaders}
        isLoading={isLoading}
        isEmpty={!isLoading && users.length === 0}
        emptyMessage="Tidak ada pengguna yang cocok dengan kriteria pencarian"
        emptyAction={
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-xs hover:bg-blue-700 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna Pertama</span>
          </button>
        }
      >
        {users.map((user, idx) => {
          const rowNumber = (pagination.page - 1) * pagination.limit + idx + 1;
          const isActive = user.is_active === 1;

          return (
            <tr
              key={user.id}
              className="hover:bg-blue-50/40 transition-colors border-b border-slate-100 last:border-b-0"
            >
              <td className="px-5 py-4 text-center font-bold text-slate-400 text-sm">
                {rowNumber}
              </td>

              {/* User Identity */}
              <td className="px-5 py-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center font-extrabold text-sm shadow-xs shrink-0">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-base leading-tight">
                      {user.name}
                    </div>
                    <div className="text-xs font-mono font-semibold text-slate-500 mt-1">
                      @{user.username}
                    </div>
                  </div>
                </div>
              </td>

              {/* Role */}
              <td className="px-5 py-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadge(user.role)}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {user.role}
                </span>
              </td>

              {/* Contact */}
              <td className="px-5 py-4">
                <div className="space-y-1">
                  {user.email ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user.email}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                  {user.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>
              </td>

              {/* Linked Employee */}
              <td className="px-5 py-4">
                {user.employee_name ? (
                  <span className="text-sm font-semibold text-slate-800">
                    {user.employee_name}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400 italic">Tidak terhubung</span>
                )}
              </td>

              {/* Status */}
              <td className="px-5 py-4 text-center">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                  {isActive ? "Aktif" : "Nonaktif"}
                </span>
              </td>

              {/* Actions */}
              <td className="px-5 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(user)}
                    className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Edit Pengguna"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDelete(user)}
                    disabled={user.id === 1}
                    className={`p-2 rounded-xl transition-all ${
                      user.id === 1
                        ? "text-slate-300 cursor-not-allowed"
                        : "text-slate-600 hover:text-red-600 hover:bg-red-50"
                    }`}
                    title={user.id === 1 ? "Owner utama tidak dapat dihapus" : "Hapus Pengguna"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {/* Pagination Navigation */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        limit={limit}
        onPageChange={(newPage) => setPage(newPage)}
        onLimitChange={(newLimit) => {
          setLimit(newLimit);
          setPage(1);
        }}
      />

      {/* Modal: Create & Edit User */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Tambah Pengguna Baru" : "Edit Data Pengguna"}
        subtitle={
          modalMode === "create"
            ? "Masukkan kredensial dan hak akses akun baru untuk mengakses sistem"
            : `Perbarui akun ${selectedUser?.name || ""}`
        }
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSubmitForm}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{modalMode === "create" ? "Buat Pengguna" : "Simpan Perubahan"}</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="cth. Hendra Wijaya"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Username Akun <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="cth. hendra_optik"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="cth. hendra@optikraja.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              />
            </div>

            {/* Nomor HP / Telepon */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="cth. 0812-3456-7890"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                {modalMode === "create" ? (
                  <>
                    Kata Sandi (Password) <span className="text-red-500">*</span>
                  </>
                ) : (
                  "Kata Sandi Baru (Kosongkan bila tidak diubah)"
                )}
              </label>
              <input
                type="password"
                required={modalMode === "create"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={modalMode === "create" ? "Minimal 6 karakter" : "Masukkan kata sandi baru"}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Role Hak Akses <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              >
                <option value="Kasir">Kasir (Transaksi & Pelanggan)</option>
                <option value="Refraksionis Optisien">Refraksionis Optisien (Rekam Medis & Resep)</option>
                <option value="Teknisi Lab">Teknisi Lab (Status Lab Fasetting)</option>
                <option value="Owner">Owner (Akses Seluruh Menu & Laporan)</option>
              </select>
            </div>

            {/* Linked Employee */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Tautkan ke Data Pegawai
              </label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              >
                <option value="">-- Tidak ditautkan --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Aktif */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Status Akun
              </label>
              <select
                value={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-base font-semibold text-slate-900 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-500/10 font-medium"
              >
                <option value={1}>Aktif (Bisa Login)</option>
                <option value={0}>Nonaktif (Diblokir)</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Hapus Pengguna"
        message={`Apakah Anda yakin ingin menghapus akun "${deleteTarget?.name}" (@${deleteTarget?.username})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Hapus Pengguna"
        isLoading={isDeleting}
      />
    </div>
  );
}
