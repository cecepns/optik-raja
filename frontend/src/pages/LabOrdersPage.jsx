import React, { useState, useEffect } from "react";
import {
  Wrench,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Phone,
  MessageCircle,
  ExternalLink,
  User,
  Calendar,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDateTime, formatRupiah, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";

export default function LabOrdersPage() {
  const [activeTab, setActiveTab] = useState("process"); // 'process', 'ready', 'all'
  const [labOrders, setLabOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // Update Status Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("Menunggu Pengerjaan");
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  useEffect(() => {
    fetchLabOrders();
  }, [page, limit, debouncedSearch, activeTab]);

  const loadTechnicians = async () => {
    try {
      const res = await request.get(API_ENDPOINTS.EMPLOYEES.LIST, { limit: 50 });
      if (res?.data) {
        setEmployees(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLabOrders = async () => {
    setIsLoading(true);
    try {
      const res = await request.get(API_ENDPOINTS.LAB_ORDERS.LIST, {
        page,
        limit,
        search: debouncedSearch,
        tab: activeTab,
      });
      if (res?.success) {
        setLabOrders(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalItems(res.pagination.total);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat status lab");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenUpdate = (order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setSelectedTechnicianId(order.technician_id || "");
    setStatusNotes(order.notes || "");
    setIsUpdateModalOpen(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsUpdating(true);
    try {
      await request.put(API_ENDPOINTS.LAB_ORDERS.UPDATE_STATUS(selectedOrder.id), {
        status: newStatus,
        technician_id: selectedTechnicianId ? Number(selectedTechnicianId) : null,
        notes: statusNotes,
      });
      toast.success(`Status pesanan diperbarui ke ${newStatus}`);
      setIsUpdateModalOpen(false);
      fetchLabOrders();
    } catch (err) {
      toast.error(err.message || "Gagal memperbarui status lab");
    } finally {
      setIsUpdating(false);
    }
  };

  // WhatsApp Pickup Notification
  const handleSendWhatsAppNotification = (order) => {
    const cleanPhone = (order.customer_phone || "").replace(/[^0-9]/g, "");
    const waNumber = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

    const message = encodeURIComponent(
      `Halo Kak ${order.customer_name},\n\n` +
      `Kacamata pesanan Anda (No. Nota: ${order.invoice_number}) sudah *SELESAI DIKERJAKAN & LOLOS QC* di *Optik Raja*.\n` +
      `Status: Siap diambil di gerai kami.\n` +
      (order.payment_status === "DP"
        ? `Sisa tagihan pelunasan: *${formatRupiah(order.remaining_amount)}*.\n\n`
        : `Status Pembayaran: *LUNAS*.\n\n`) +
      `Silakan datang untuk mencoba dan fitting kenyamanan kacamata Anda.\nTerima kasih atas kepercayaannya! 🙏👓`
    );

    window.open(`https://wa.me/${waNumber}?text=${message}`, "_blank");
  };

  const headers = [
    { label: "No Order & Nota", align: "left" },
    { label: "Pelanggan & Kontak", align: "left" },
    { label: "Frame & Lensa", align: "left" },
    { label: "Resep Refraksi", align: "left" },
    { label: "Estimasi Selesai", align: "center" },
    { label: "Status Pengerjaan", align: "center" },
    { label: "Status Bayar", align: "center" },
    { label: "Aksi & Update", align: "center" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            Pelacakan Status Lab & Fasetting Lensa
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitoring antrean proses perakitan, pemotongan fasetting mesin edger, dan quality control (QC)
          </p>
        </div>
      </div>

      {/* Tabs Filter (SRS Modul 5: Monitoring Real-time Proses Lab vs Siap Diambil) */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab("process");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "process"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Antrean / Proses Lab</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("ready");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "ready"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Siap Diambil Pasien</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("all");
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "all"
              ? "bg-gray-800 text-white shadow-xs"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <span>Semua Pesanan</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari order, nomor nota, pasien, atau no HP..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="text-xs text-gray-500">
          Total Data: <span className="font-bold text-gray-800">{totalItems}</span> pesanan
        </div>
      </div>

      {/* Lab Orders Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={labOrders.length === 0}
        emptyMessage="Tidak ada antrean pengerjaan lab pada kategori ini."
      >
        {labOrders.map((order) => (
          <tr key={order.id} className="hover:bg-gray-50/70 transition-colors">
            {/* Order No & Invoice */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-blue-900">{order.order_number}</div>
              <div className="text-[11px] font-mono text-gray-500">{order.invoice_number}</div>
              <div className="text-[10px] text-gray-400">{formatDateTime(order.order_date)}</div>
            </td>

            {/* Customer & Contact */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-gray-900">{order.customer_name}</div>
              <div className="text-[11px] text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400" />
                {order.customer_phone}
              </div>
            </td>

            {/* Frame & Lenses Items */}
            <td className="px-4 py-3 text-xs text-gray-800 max-w-xs whitespace-nowrap">
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="truncate text-[11px]">
                  • <span className="font-semibold">{it.product_name}</span> ({it.quantity}x)
                </div>
              ))}
            </td>

            {/* Prescription details */}
            <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px]">
              {order.od_sph ? (
                <>
                  <div className="text-gray-700">R: {formatDiopter(order.od_sph)} {formatDiopter(order.od_cyl)} {order.od_axis}°</div>
                  <div className="text-gray-700">L: {formatDiopter(order.os_sph)} {formatDiopter(order.os_cyl)} {order.os_axis}°</div>
                </>
              ) : (
                <span className="text-gray-400 text-xs">-</span>
              )}
            </td>

            {/* Estimated Date */}
            <td className="px-4 py-3 text-center whitespace-nowrap text-xs font-semibold text-gray-700">
              {formatDate(order.estimated_date)}
            </td>

            {/* Status Stage */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span
                className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  order.status === "Siap Diambil"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse"
                    : order.status === "Selesai Diambil"
                    ? "bg-gray-100 text-gray-700 border border-gray-200"
                    : order.status === "Quality Control"
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : order.status === "Perakitan"
                    ? "bg-cyan-100 text-cyan-800 border border-cyan-200"
                    : order.status === "Pemotongan Lensa"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}
              >
                {order.status}
              </span>
              {order.technician_name && (
                <span className="block text-[10px] text-gray-400 mt-0.5">
                  Teknisi: {order.technician_name}
                </span>
              )}
            </td>

            {/* Payment Status (Lunas / DP) */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  order.payment_status === "Lunas"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {order.payment_status}
                {order.payment_status === "DP" && ` (${formatRupiah(order.remaining_amount)})`}
              </span>
            </td>

            {/* Actions */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1.5">
                {order.status === "Siap Diambil" && (
                  <button
                    type="button"
                    onClick={() => handleSendWhatsAppNotification(order)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition-colors"
                    title="Kirim Notifikasi WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Chat WA</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenUpdate(order)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Update</span>
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

      {/* Status Update Modal */}
      <Modal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        title="Update Status Pengerjaan Lab & Faset"
        subtitle={`Pesanan: ${selectedOrder?.order_number} (${selectedOrder?.customer_name})`}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsUpdateModalOpen(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUpdateStatus}
              disabled={isUpdating}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              {isUpdating ? "Memperbarui..." : "Simpan Status"}
            </button>
          </>
        }
      >
        <form onSubmit={handleUpdateStatus} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Tahapan Pengerjaan Lab
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
            >
              <option value="Menunggu Pengerjaan">1. Menunggu Pengerjaan (Pending Antrean)</option>
              <option value="Pemotongan Lensa">2. Pemotongan Lensa (Edger Fasetting)</option>
              <option value="Perakitan">3. Perakitan & Pemasangan Frame</option>
              <option value="Quality Control">4. Quality Control (QC & Kalibrasi Fokus)</option>
              <option value="Siap Diambil">5. Siap Diambil Pasien (QC Lolos)</option>
              <option value="Selesai Diambil">6. Selesai Diambil Pasien</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Teknisi Lab / RO Bertugas
            </label>
            <select
              value={selectedTechnicianId}
              onChange={(e) => setSelectedTechnicianId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Pilih Teknisi --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Catatan Pengerjaan / Hasil QC
            </label>
            <textarea
              rows="3"
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="Catatan bevel frame, fitting angle, atau keterangan teknis..."
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
