import React, { useState, useEffect, useCallback } from "react";
import {
  Hourglass,
  ShoppingBag,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageCircle,
  Inbox,
  Eye,
  Calendar,
  Lock,
  Check,
  RotateCcw,
  History,
  X,
  FileText,
  User,
  Phone,
  Layers,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDateTime, formatRupiah, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";

// Format date time helper matching mobile view: "03 Sep 2026 20:14"
const formatCardDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = date.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
};

const formatEstDate = (dateString) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
};

export default function LabOrdersPage() {
  const { settings, currentUser } = useApp();
  const [labOrders, setLabOrders] = useState([]);
  const [summary, setSummary] = useState({ proses_lab: 0, siap_diambil: 0, selesai: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  // Search
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Completed Orders Modal (Riwayat)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  // Prescription Detail Modal
  const [selectedRxOrder, setSelectedRxOrder] = useState(null);

  // Complete Order Confirm Modal
  const [confirmCompleteOrder, setConfirmCompleteOrder] = useState(null);
  const [isCompleting, setIsCompleting] = useState(false);

  // Move to Siap Diambil Confirm / Action state
  const [isMoving, setIsMoving] = useState(false);

  // Fetch Lab Orders
  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await request.get(API_ENDPOINTS.LAB_ORDERS.LIST, {
        limit: 100,
        search: debouncedSearch,
      });
      if (res?.success) {
        setLabOrders(res.data || []);
        if (res.summary) {
          setSummary(res.summary);
        }
        const now = new Date();
        const timeStr = [
          String(now.getHours()).padStart(2, "0"),
          String(now.getMinutes()).padStart(2, "0"),
          String(now.getSeconds()).padStart(2, "0"),
        ].join(":");
        setLastUpdated(timeStr);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat status pesanan");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fetch Completed Orders for Riwayat Modal
  const fetchCompletedOrders = async () => {
    setIsHistoryLoading(true);
    try {
      const res = await request.get(API_ENDPOINTS.LAB_ORDERS.LIST, {
        limit: 50,
        tab: "completed",
        search: historySearch,
      });
      if (res?.success) {
        setHistoryOrders(res.data || []);
      }
    } catch (err) {
      toast.error("Gagal memuat riwayat pesanan selesai");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleOpenHistory = () => {
    setIsHistoryModalOpen(true);
    fetchCompletedOrders();
  };

  // Move from "Proses Lab" to "Siap Diambil"
  const handleMoveToReady = async (order) => {
    setIsMoving(true);
    try {
      const res = await request.put(API_ENDPOINTS.LAB_ORDERS.UPDATE_STATUS(order.id), {
        status: "Siap Diambil",
      });
      if (res?.success) {
        toast.success(`Pesanan ${order.invoice_number} berpindah ke Siap Diambil!`);
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.message || "Gagal mengubah status pesanan");
    } finally {
      setIsMoving(false);
    }
  };

  // Mark as "Selesai" (Triggered after confirmation)
  const handleConfirmFinish = async () => {
    if (!confirmCompleteOrder) return;
    setIsCompleting(true);
    try {
      const res = await request.put(
        API_ENDPOINTS.LAB_ORDERS.UPDATE_STATUS(confirmCompleteOrder.id),
        {
          status: "Selesai",
        }
      );
      if (res?.success) {
        toast.success(
          `Pesanan ${confirmCompleteOrder.invoice_number} selesai & pembayaran otomatis lunas!`
        );
        setConfirmCompleteOrder(null);
        fetchOrders();
      }
    } catch (err) {
      toast.error(err.message || "Gagal menyelesaikan pesanan");
    } finally {
      setIsCompleting(false);
    }
  };

  // Send WhatsApp Notification (Ready for Pickup)
  const handleSendWhatsAppNotification = (order) => {
    const cleanPhone = (order.customer_phone || "").replace(/[^0-9]/g, "");
    const waNumber = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

    const remainingNum = Number(order.remaining_amount || 0);
    const isLunas = order.payment_status === "Lunas" || remainingNum <= 0;

    const message = encodeURIComponent(
      `Halo Kak *${order.customer_name}*,\n\n` +
      `Kabar baik! Kacamata pesanan Anda di *${settings?.store_name || "Optik Raja"}* (No. Nota: *${order.invoice_number}*) sudah *SELESAI DIPROSES & SIAP DIAMBIL* 👓✨.\n\n` +
      (isLunas
        ? `Status Pembayaran: *LUNAS* ✅\n`
        : `Sisa Pelunasan: *${formatRupiah(remainingNum)}* (Dapat dilunasi saat pengambilan kacamata).\n`) +
      `\nSilakan datang ke gerai kami untuk fitting dan penyetelan kenyamanan frame kacamata Anda.\n` +
      `Alamat: ${settings?.address || "Gerai Optik Raja"}\n\n` +
      `Terima kasih atas kepercayaannya! 🙏`
    );

    window.open(`https://wa.me/${waNumber}?text=${message}`, "_blank");
  };

  // Filter orders by column
  const prosesLabOrders = labOrders.filter((o) => o.status === "Proses Lab");
  const siapDiambilOrders = labOrders.filter((o) => o.status === "Siap Diambil");

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Header Matching Screenshot */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Status Pesanan
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Riwayat Selesai Button */}
          <button
            type="button"
            onClick={handleOpenHistory}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Lihat riwayat pesanan yang sudah selesai"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Riwayat</span>
            <span className="text-[11px] px-1.5 py-0.2 bg-slate-100 rounded-full font-bold">
              {summary.selesai || 0}
            </span>
          </button>

          {/* Refresh Button (Square Matching Screenshot) */}
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-2 sm:px-3 sm:py-2 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Perbarui data antrean pesanan"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Perbarui</span>
          </button>
        </div>
      </div>

      {/* 2. Search Input Matching Screenshot */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari Nota atau Nama Pelanggan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-2xs placeholder:text-slate-400 font-medium"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Sub-bar: Diperbarui Timestamp + Counter Pills Matching Screenshot */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs px-1">
        <div className="text-slate-500 font-medium text-[11px] sm:text-xs">
          Diperbarui: <strong className="text-slate-800 font-bold">{lastUpdated || "03:38:43"}</strong>
        </div>

        <div className="flex items-center gap-2">
          {/* Pill 1: Proses Lab (Red/Coral) */}
          <div className="px-3 py-1 bg-[#d94841] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
            <span>{summary.proses_lab ?? prosesLabOrders.length} Proses Lab</span>
          </div>

          {/* Pill 2: Siap Diambil (Amber/Yellow) */}
          <div className="px-3 py-1 bg-[#e59a1d] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5">
            <span>{summary.siap_diambil ?? siapDiambilOrders.length} Siap Diambil</span>
          </div>
        </div>
      </div>

      {/* 4. Dual-Column Kanban Board Matching Screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* ======================================================== */}
        {/* COLUMN 1: PROSES LAB (RED/CORAL HEADER) */}
        {/* ======================================================== */}
        <div className="space-y-3">
          {/* Column Header */}
          <div className="bg-[#d94841] text-white px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2 font-black text-sm tracking-wide">
              <Hourglass className="w-4 h-4" />
              <span>Proses Lab</span>
            </div>
            <span className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-black">
              {prosesLabOrders.length}
            </span>
          </div>

          {/* Column Content */}
          <div className="space-y-3 min-h-[300px]">
            {prosesLabOrders.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-slate-300 shadow-2xs">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-xs font-medium">Tidak ada pesanan dalam proses lab</p>
              </div>
            ) : (
              prosesLabOrders.map((order) => {
                const estFormatted = formatEstDate(order.completion_estimate || order.estimated_completion);
                const isLunas = order.payment_status === "Lunas";

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200/90 border-l-[5px] border-l-[#d94841] p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
                  >
                    {/* Line 1: Invoice Number in Blue */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600 font-mono text-xs sm:text-sm">
                        {order.invoice_number}
                      </span>
                      {order.prescription_id && (
                        <button
                          type="button"
                          onClick={() => setSelectedRxOrder(order)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Lihat Detail Resep Kacamata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Resep</span>
                        </button>
                      )}
                    </div>

                    {/* Line 2: Customer Name */}
                    <div className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                      {order.customer_name}
                    </div>

                    {/* Line 3: Date & Est Date */}
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatCardDateTime(order.order_date || order.created_at)}</span>
                      </span>
                      {estFormatted && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Est. {estFormatted}</span>
                        </span>
                      )}
                    </div>

                    {/* Product / Item Summary Preview */}
                    {order.items && order.items.length > 0 && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="truncate max-w-[200px]">
                          {order.items[0].product_name}
                          {order.items.length > 1 && ` (+${order.items.length - 1} item)`}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {order.items[0].category || "Kacamata"}
                        </span>
                      </div>
                    )}

                    {/* Dotted Divider */}
                    <div className="border-b border-dashed border-slate-200 my-1" />

                    {/* Line 4: Price & Payment Pill */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {formatRupiah(order.grand_total)}
                      </span>

                      {isLunas ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Lunas</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300">
                          <span>DP (Sisa {formatRupiah(order.remaining_amount)})</span>
                        </span>
                      )}
                    </div>

                    {/* Action Button: Ubah Status -> Siap Diambil */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleMoveToReady(order)}
                        disabled={isMoving}
                        className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 active:scale-[0.99] text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                      >
                        <span>Ubah Status ke Siap Diambil</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: SIAP DIAMBIL (AMBER/YELLOW HEADER) */}
        {/* ======================================================== */}
        <div className="space-y-3">
          {/* Column Header */}
          <div className="bg-[#e59a1d] text-white px-4 py-2.5 rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2 font-black text-sm tracking-wide">
              <ShoppingBag className="w-4 h-4" />
              <span>Siap Diambil</span>
            </div>
            <span className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-xs font-black">
              {siapDiambilOrders.length}
            </span>
          </div>

          {/* Column Content */}
          <div className="space-y-3 min-h-[300px]">
            {siapDiambilOrders.length === 0 ? (
              <div className="py-20 text-center text-slate-400 space-y-2.5 flex flex-col items-center justify-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
                <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center text-slate-300 shadow-2xs">
                  <Inbox className="w-7 h-7" />
                </div>
                <p className="text-xs font-medium text-slate-400">Tidak ada pesanan</p>
              </div>
            ) : (
              siapDiambilOrders.map((order) => {
                const estFormatted = formatEstDate(order.completion_estimate || order.estimated_completion);
                const isLunas = order.payment_status === "Lunas";

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200/90 border-l-[5px] border-l-[#e59a1d] p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all space-y-2.5"
                  >
                    {/* Line 1: Invoice Number in Blue */}
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600 font-mono text-xs sm:text-sm">
                        {order.invoice_number}
                      </span>
                      {order.prescription_id && (
                        <button
                          type="button"
                          onClick={() => setSelectedRxOrder(order)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Lihat Detail Resep Kacamata"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Resep</span>
                        </button>
                      )}
                    </div>

                    {/* Line 2: Customer Name */}
                    <div className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                      {order.customer_name}
                    </div>

                    {/* Line 3: Date & Est Date */}
                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{formatCardDateTime(order.order_date || order.created_at)}</span>
                      </span>
                      {estFormatted && (
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Est. {estFormatted}</span>
                        </span>
                      )}
                    </div>

                    {/* Product / Item Summary Preview */}
                    {order.items && order.items.length > 0 && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="truncate max-w-[200px]">
                          {order.items[0].product_name}
                          {order.items.length > 1 && ` (+${order.items.length - 1} item)`}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {order.items[0].category || "Kacamata"}
                        </span>
                      </div>
                    )}

                    {/* Dotted Divider */}
                    <div className="border-b border-dashed border-slate-200 my-1" />

                    {/* Line 4: Price & Payment Pill */}
                    <div className="flex items-center justify-between pt-0.5">
                      <span className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {formatRupiah(order.grand_total)}
                      </span>

                      {isLunas ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Lunas</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300">
                          <span>DP (Sisa {formatRupiah(order.remaining_amount)})</span>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons: Selesai + WhatsApp Notification */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* Selesai Button (Green) */}
                      <button
                        type="button"
                        onClick={() => setConfirmCompleteOrder(order)}
                        className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                        title="Tandai pesanan selesai dan lunaskan pembayaran otomatis"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Selesai</span>
                      </button>

                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={() => handleSendWhatsAppNotification(order)}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                        title="Kirim pesan WhatsApp kacamata siap diambil"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. CONFIRMATION DIALOG: MARK COMPLETE & AUTO-LUNAS */}
      {/* ======================================================== */}
      <ConfirmDialog
        isOpen={Boolean(confirmCompleteOrder)}
        onClose={() => setConfirmCompleteOrder(null)}
        onConfirm={handleConfirmFinish}
        isLoading={isCompleting}
        title="Konfirmasi Selesaikan Pesanan"
        message={
          confirmCompleteOrder
            ? `Tandai pesanan nota "${confirmCompleteOrder.invoice_number}" (${confirmCompleteOrder.customer_name}) sebagai Selesai? Pembayaran akan otomatis dilunasi dan transaksi akan langsung terkunci.`
            : ""
        }
        confirmText="Ya, Selesaikan & Lunaskan"
        confirmVariant="success"
      />

      {/* ======================================================== */}
      {/* 6. MODAL: RIWAYAT PESANAN SELESAI */}
      {/* ======================================================== */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title="Riwayat Pesanan Selesai"
        size="2xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Daftar seluruh pesanan kacamata yang telah diambil oleh pasien dan pembayarannya telah lunas.
          </p>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari berdasarkan nota atau nama pelanggan..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchCompletedOrders()}
              className="w-full pl-10 pr-20 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <button
              type="button"
              onClick={fetchCompletedOrders}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold"
            >
              Cari
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {isHistoryLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs">Memuat data riwayat...</div>
            ) : historyOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Belum ada pesanan yang selesai.
              </div>
            ) : (
              historyOrders.map((h) => (
                <div
                  key={h.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 font-mono">{h.invoice_number}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <Lock className="w-3 h-3" />
                        <span>Selesai & Lunas</span>
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 mt-0.5">{h.customer_name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {formatCardDateTime(h.completed_date || h.created_at)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-slate-900 text-sm">
                      {formatRupiah(h.grand_total)}
                    </div>
                    <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                      100% Terbayar
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* 7. MODAL: DETAIL RESEP KACAMATA */}
      {/* ======================================================== */}
      {selectedRxOrder && (
        <Modal
          isOpen={Boolean(selectedRxOrder)}
          onClose={() => setSelectedRxOrder(null)}
          title={`Resep Lensa: ${selectedRxOrder.customer_name}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100 text-xs flex justify-between items-center">
              <div>
                <span className="text-blue-600 font-bold font-mono">
                  {selectedRxOrder.invoice_number}
                </span>
                <span className="text-slate-400 mx-2">|</span>
                <span className="text-slate-700 font-bold">{selectedRxOrder.customer_name}</span>
              </div>
              <span className="text-slate-500 font-medium text-[11px]">
                {formatCardDateTime(selectedRxOrder.order_date)}
              </span>
            </div>

            {/* Diopter Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-center">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-2 px-3 text-left">Mata</th>
                    <th className="py-2 px-3">SPH</th>
                    <th className="py-2 px-3">CYL</th>
                    <th className="py-2 px-3">AXIS</th>
                    <th className="py-2 px-3">PD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-left text-blue-700">R (Kanan)</td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {formatDiopter(selectedRxOrder.od_sph)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {formatDiopter(selectedRxOrder.od_cyl)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {selectedRxOrder.od_axis ? `${selectedRxOrder.od_axis}°` : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {selectedRxOrder.od_mpd || selectedRxOrder.total_pd || "-"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-bold text-left text-emerald-700">L (Kiri)</td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {formatDiopter(selectedRxOrder.os_sph)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {formatDiopter(selectedRxOrder.os_cyl)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {selectedRxOrder.os_axis ? `${selectedRxOrder.os_axis}°` : "-"}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {selectedRxOrder.os_mpd || selectedRxOrder.total_pd || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {selectedRxOrder.total_pd && (
              <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-right">
                Total Pupillary Distance (PD):{" "}
                <strong className="text-slate-900">{selectedRxOrder.total_pd} mm</strong>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
