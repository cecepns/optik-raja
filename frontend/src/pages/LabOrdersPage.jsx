import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Hourglass,
  ShoppingBag,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  Inbox,
  Eye,
  Calendar,
  Lock,
  Check,
  History,
  X,
  GripVertical,
  MoveHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatRupiah, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";

// Helper format tanggal: "03 Sep 2026 20:14"
const formatCardDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const day = String(date.getDate()).padStart(2, "0");
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
  const { settings } = useApp();
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

  // ========================================================
  // DRAG & DROP STATE (DESKTOP + MOBILE TOUCH)
  // ========================================================
  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null); // 'Proses Lab' | 'Siap Diambil'
  const [touchDrag, setTouchDrag] = useState(null); // { order, currentX, currentY, isDragging, width }

  // Column Refs for touch hit testing
  const colProsesRef = useRef(null);
  const colSiapRef = useRef(null);
  const touchStateRef = useRef(null);

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

  // ========================================================
  // CORE STATUS TRANSITION (OPTIMISTIC + API)
  // ========================================================
  const handleMoveStatus = async (order, targetStatus) => {
    if (!order || order.status === targetStatus) return;

    const previousStatus = order.status;

    // 1. Optimistic UI update: Instan pindah kartu tanpa jeda
    setLabOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === order.id ? { ...o, status: targetStatus } : o))
    );

    // 2. Optimistic summary count
    setSummary((prev) => {
      const isToReady = targetStatus === "Siap Diambil";
      return {
        ...prev,
        proses_lab: isToReady ? Math.max(0, (prev.proses_lab || 1) - 1) : (prev.proses_lab || 0) + 1,
        siap_diambil: isToReady ? (prev.siap_diambil || 0) + 1 : Math.max(0, (prev.siap_diambil || 1) - 1),
      };
    });

    try {
      const res = await request.put(API_ENDPOINTS.LAB_ORDERS.UPDATE_STATUS(order.id), {
        status: targetStatus,
      });

      if (res?.success) {
        if (targetStatus === "Siap Diambil") {
          toast.success(`Pesanan ${order.invoice_number} berpindah ke Siap Diambil!`);
        } else {
          toast.success(`Pesanan ${order.invoice_number} dikembalikan ke Proses Lab`);
        }
      } else {
        throw new Error(res?.message || "Gagal mengubah status pesanan");
      }
    } catch (err) {
      toast.error(err.message || "Gagal memperbarui status di server");
      // Rollback jika terjadi kegagalan jaringan
      setLabOrders((prevOrders) =>
        prevOrders.map((o) => (o.id === order.id ? { ...o, status: previousStatus } : o))
      );
      fetchOrders();
    }
  };

  // Mark as "Selesai" (Triggered after confirmation modal)
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
          `Pesanan ${confirmCompleteOrder.invoice_number} selesai & otomatis lunas!`
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

  // ========================================================
  // DESKTOP DRAG & DROP HANDLERS (HTML5 NATIVE)
  // ========================================================
  const handleDragStart = (e, order) => {
    e.dataTransfer.setData("text/plain", String(order.id));
    e.dataTransfer.effectAllowed = "move";
    setDraggingOrderId(order.id);
  };

  const handleDragEnd = () => {
    setDraggingOrderId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e, targetStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== targetStatus) {
      setDragOverColumn(targetStatus);
    }
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggingOrderId(null);
    const orderId = e.dataTransfer.getData("text/plain");
    const order = labOrders.find((o) => String(o.id) === String(orderId));
    if (order && order.status !== targetStatus) {
      handleMoveStatus(order, targetStatus);
    }
  };

  // ========================================================
  // MOBILE TOUCH DRAG & DROP HANDLERS (TRELLO GESTURE)
  // ========================================================
  const handleTouchStart = (e, order) => {
    const touch = e.touches[0];
    const targetElement = e.currentTarget;
    const rect = targetElement.getBoundingClientRect();

    touchStateRef.current = {
      order,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      width: rect.width,
      height: rect.height,
      isDragging: false,
      overCol: null,
    };
  };

  const handleTouchMove = (e) => {
    if (!touchStateRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStateRef.current.startX;
    const dy = touch.clientY - touchStateRef.current.startY;

    // Jika digeser lebih dari 8px, mulai mode drag & cegah scroll browser
    if (!touchStateRef.current.isDragging) {
      if (Math.hypot(dx, dy) > 8) {
        touchStateRef.current.isDragging = true;
        setTouchDrag({ ...touchStateRef.current });
        if (e.cancelable) e.preventDefault();
      }
    } else {
      if (e.cancelable) e.preventDefault();
      touchStateRef.current.currentX = touch.clientX;
      touchStateRef.current.currentY = touch.clientY;

      // Deteksi kolom tujuan via Bounding Rect
      const prosesRect = colProsesRef.current?.getBoundingClientRect();
      const siapRect = colSiapRef.current?.getBoundingClientRect();

      let detectedCol = null;
      if (
        prosesRect &&
        touch.clientX >= prosesRect.left &&
        touch.clientX <= prosesRect.right &&
        touch.clientY >= prosesRect.top - 50 &&
        touch.clientY <= prosesRect.bottom + 100
      ) {
        detectedCol = "Proses Lab";
      } else if (
        siapRect &&
        touch.clientX >= siapRect.left &&
        touch.clientX <= siapRect.right &&
        touch.clientY >= siapRect.top - 50 &&
        touch.clientY <= siapRect.bottom + 100
      ) {
        detectedCol = "Siap Diambil";
      }

      touchStateRef.current.overCol = detectedCol;
      setDragOverColumn(detectedCol);
      setTouchDrag({ ...touchStateRef.current, overCol: detectedCol });
    }
  };

  const handleTouchEnd = () => {
    if (!touchStateRef.current) return;

    const { order, isDragging, overCol } = touchStateRef.current;
    touchStateRef.current = null;
    setTouchDrag(null);
    setDragOverColumn(null);

    if (isDragging && overCol && overCol !== order.status) {
      // Haptic feedback saat drop di ponsel jika didukung
      if (typeof window !== "undefined" && window.navigator?.vibrate) {
        try {
          window.navigator.vibrate(40);
        } catch {
          // ignore
        }
      }
      handleMoveStatus(order, overCol);
    }
  };

  // Filter orders by column
  const prosesLabOrders = labOrders.filter((o) => o.status === "Proses Lab");
  const siapDiambilOrders = labOrders.filter((o) => o.status === "Siap Diambil");

  return (
    <div className="space-y-3 sm:space-y-4 max-w-7xl mx-auto select-none">
      {/* 1. Header Matching Screenshot */}
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
            Status Pesanan
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Riwayat Selesai Button */}
          <button
            type="button"
            onClick={handleOpenHistory}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer"
            title="Lihat riwayat pesanan yang sudah selesai"
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Riwayat</span>
            <span className="text-[10px] sm:text-[11px] px-1.5 py-0.2 bg-slate-100 rounded-full font-bold">
              {summary.selesai || 0}
            </span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isLoading}
            className="p-1.5 sm:px-3 sm:py-2 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-700 rounded-xl text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Perbarui data status pesanan"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Perbarui</span>
          </button>
        </div>
      </div>

      {/* 2. Search Input Matching Screenshot */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari Nota atau Nama Pelanggan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none shadow-2xs placeholder:text-slate-400 font-medium"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Sub-bar: Diperbarui Timestamp + Counter Pills Matching Screenshot */}
      <div className="flex items-center justify-between gap-1.5 text-xs px-0.5">
        <div className="text-slate-500 font-medium text-[11px] sm:text-xs">
          Diperbarui: <strong className="text-slate-800 font-bold">{lastUpdated || "03:38:43"}</strong>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Pill 1: Proses Lab (Red/Coral) */}
          <div className="px-2.5 sm:px-3 py-1 bg-[#d94841] text-white rounded-lg text-[11px] sm:text-xs font-bold shadow-2xs flex items-center gap-1">
            <span>{summary.proses_lab ?? prosesLabOrders.length} Proses Lab</span>
          </div>

          {/* Pill 2: Siap Diambil (Amber/Yellow) */}
          <div className="px-2.5 sm:px-3 py-1 bg-[#e59a1d] text-white rounded-lg text-[11px] sm:text-xs font-bold shadow-2xs flex items-center gap-1">
            <span>{summary.siap_diambil ?? siapDiambilOrders.length} Siap Diambil</span>
          </div>
        </div>
      </div>

      {/* 4. Dual-Column Kanban Board (Side by Side di Mobile & Desktop seperti Trello) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 items-start pb-6">
        {/* ======================================================== */}
        {/* COLUMN 1: PROSES LAB (RED/CORAL HEADER) */}
        {/* ======================================================== */}
        <div
          ref={colProsesRef}
          data-column-status="Proses Lab"
          onDragOver={(e) => handleDragOver(e, "Proses Lab")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "Proses Lab")}
          className={`space-y-2 sm:space-y-3 rounded-2xl transition-all duration-200 ${
            dragOverColumn === "Proses Lab"
              ? "ring-2 ring-dashed ring-[#d94841] bg-rose-50/60 p-1 sm:p-1.5"
              : ""
          }`}
        >
          {/* Column Header */}
          <div className="bg-[#d94841] text-white px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-2 font-black text-xs sm:text-sm tracking-wide">
              <Hourglass className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Proses Lab</span>
            </div>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/25 flex items-center justify-center text-[11px] sm:text-xs font-black shrink-0">
              {prosesLabOrders.length}
            </span>
          </div>

          {/* Drop indicator if hovering from Siap Diambil */}
          {dragOverColumn === "Proses Lab" && (
            <div className="p-3 border-2 border-dashed border-[#d94841] rounded-xl text-center bg-white/90 text-[#d94841] text-xs font-bold animate-pulse flex items-center justify-center gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              <span>Lepas untuk kembalikan ke Lab</span>
            </div>
          )}

          {/* Column Content */}
          <div className="space-y-2 sm:space-y-3 min-h-[350px]">
            {prosesLabOrders.length === 0 ? (
              <div className="py-14 sm:py-20 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center bg-slate-50/60 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 p-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center text-slate-300 shadow-2xs">
                  <Inbox className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-[11px] sm:text-xs font-medium">Tidak ada pesanan</p>
              </div>
            ) : (
              prosesLabOrders.map((order) => {
                const estFormatted = formatEstDate(order.completion_estimate || order.estimated_completion);
                const isLunas = order.payment_status === "Lunas";
                const isBeingDragged =
                  draggingOrderId === order.id || touchDrag?.order?.id === order.id;

                return (
                  <div
                    key={order.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, order)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(e, order)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 border-l-[4px] sm:border-l-[5px] border-l-[#d94841] p-2.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all space-y-1.5 sm:space-y-2.5 cursor-grab active:cursor-grabbing touch-pan-y ${
                      isBeingDragged
                        ? "opacity-35 scale-95 border-dashed border-slate-300"
                        : "hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Line 1: Invoice Number in Blue + Drag Handle / Resep */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-blue-600 font-mono text-[11px] sm:text-sm truncate">
                        {order.invoice_number}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {order.prescription_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRxOrder(order);
                            }}
                            className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
                            title="Lihat Detail Resep Kacamata"
                          >
                            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Resep</span>
                          </button>
                        )}
                        <span
                          className="text-slate-300 hover:text-slate-500 cursor-grab p-0.5"
                          title="Tahan & geser kartu ini"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    {/* Line 2: Customer Name */}
                    <div className="font-bold text-slate-900 text-xs sm:text-base leading-tight truncate">
                      {order.customer_name}
                    </div>

                    {/* Line 3: Date & Est Date */}
                    <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className="flex items-center gap-0.5 sm:gap-1">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{formatCardDateTime(order.order_date || order.created_at)}</span>
                      </span>
                      {estFormatted && (
                        <span className="flex items-center gap-0.5 sm:gap-1 text-slate-600 font-medium">
                          <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                          <span className="truncate">Est. {estFormatted}</span>
                        </span>
                      )}
                    </div>

                    {/* Dotted Divider */}
                    <div className="border-b border-dashed border-slate-200 my-0.5 sm:my-1" />

                    {/* Line 4: Price & Payment Pill */}
                    <div className="flex items-center justify-between gap-1 pt-0.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-base">
                        {formatRupiah(order.grand_total)}
                      </span>

                      {isLunas ? (
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                          <span>Lunas</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300">
                          <span>DP</span>
                        </span>
                      )}
                    </div>

                    {/* Quick Move Button (Untuk pengguna yang lebih suka sekali tap/klik) */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStatus(order, "Siap Diambil");
                        }}
                        className="w-full py-1.5 px-2 bg-amber-50 hover:bg-amber-100 active:scale-[0.98] text-amber-900 border border-amber-300/80 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
                        title="Geser atau klik untuk pindah ke Siap Diambil"
                      >
                        <span className="truncate">Siap Diambil</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
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
        <div
          ref={colSiapRef}
          data-column-status="Siap Diambil"
          onDragOver={(e) => handleDragOver(e, "Siap Diambil")}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, "Siap Diambil")}
          className={`space-y-2 sm:space-y-3 rounded-2xl transition-all duration-200 ${
            dragOverColumn === "Siap Diambil"
              ? "ring-2 ring-dashed ring-[#e59a1d] bg-amber-50/60 p-1 sm:p-1.5"
              : ""
          }`}
        >
          {/* Column Header */}
          <div className="bg-[#e59a1d] text-white px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-2 font-black text-xs sm:text-sm tracking-wide">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Siap Diambil</span>
            </div>
            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white/25 flex items-center justify-center text-[11px] sm:text-xs font-black shrink-0">
              {siapDiambilOrders.length}
            </span>
          </div>

          {/* Drop indicator if hovering from Proses Lab */}
          {dragOverColumn === "Siap Diambil" && (
            <div className="p-3 border-2 border-dashed border-[#e59a1d] rounded-xl text-center bg-white/90 text-[#e59a1d] text-xs font-bold animate-pulse flex items-center justify-center gap-1.5">
              <ArrowRight className="w-4 h-4" />
              <span>Lepas untuk pindahkan ke Siap Diambil</span>
            </div>
          )}

          {/* Column Content */}
          <div className="space-y-2 sm:space-y-3 min-h-[350px]">
            {siapDiambilOrders.length === 0 ? (
              <div className="py-14 sm:py-20 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center bg-slate-50/60 rounded-xl sm:rounded-2xl border border-dashed border-slate-200 p-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white flex items-center justify-center text-slate-300 shadow-2xs">
                  <Inbox className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <p className="text-[11px] sm:text-xs font-medium text-slate-400">Tidak ada pesanan</p>
              </div>
            ) : (
              siapDiambilOrders.map((order) => {
                const estFormatted = formatEstDate(order.completion_estimate || order.estimated_completion);
                const isLunas = order.payment_status === "Lunas";
                const isBeingDragged =
                  draggingOrderId === order.id || touchDrag?.order?.id === order.id;

                return (
                  <div
                    key={order.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, order)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(e, order)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 border-l-[4px] sm:border-l-[5px] border-l-[#e59a1d] p-2.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all space-y-1.5 sm:space-y-2.5 cursor-grab active:cursor-grabbing touch-pan-y ${
                      isBeingDragged
                        ? "opacity-35 scale-95 border-dashed border-slate-300"
                        : "hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Line 1: Invoice Number in Blue + Resep & Drag Handle */}
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-blue-600 font-mono text-[11px] sm:text-sm truncate">
                        {order.invoice_number}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {order.prescription_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRxOrder(order);
                            }}
                            className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-500 hover:text-blue-600 cursor-pointer"
                            title="Lihat Detail Resep Kacamata"
                          >
                            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span className="hidden sm:inline">Resep</span>
                          </button>
                        )}
                        <span
                          className="text-slate-300 hover:text-slate-500 cursor-grab p-0.5"
                          title="Tahan & geser kartu ini"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    {/* Line 2: Customer Name */}
                    <div className="font-bold text-slate-900 text-xs sm:text-base leading-tight truncate">
                      {order.customer_name}
                    </div>

                    {/* Line 3: Date & Est Date */}
                    <div className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1 sm:gap-2 flex-wrap">
                      <span className="flex items-center gap-0.5 sm:gap-1">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{formatCardDateTime(order.order_date || order.created_at)}</span>
                      </span>
                      {estFormatted && (
                        <span className="flex items-center gap-0.5 sm:gap-1 text-slate-600 font-medium">
                          <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
                          <span className="truncate">Est. {estFormatted}</span>
                        </span>
                      )}
                    </div>

                    {/* Dotted Divider */}
                    <div className="border-b border-dashed border-slate-200 my-0.5 sm:my-1" />

                    {/* Line 4: Price & Payment Pill */}
                    <div className="flex items-center justify-between gap-1 pt-0.5 flex-wrap">
                      <span className="font-extrabold text-slate-900 text-xs sm:text-base">
                        {formatRupiah(order.grand_total)}
                      </span>

                      {isLunas ? (
                        <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300">
                          <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                          <span>Lunas</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300">
                          <span>DP</span>
                        </span>
                      )}
                    </div>

                    {/* Action Buttons: Selesai + WhatsApp + Kembalikan */}
                    <div className="flex items-center gap-1.5 pt-1">
                      {/* Selesai Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmCompleteOrder(order);
                        }}
                        className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 transition-all shadow-2xs cursor-pointer"
                        title="Tandai pesanan selesai dan lunaskan otomatis"
                      >
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                        <span>Selesai</span>
                      </button>

                      {/* WhatsApp Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendWhatsAppNotification(order);
                        }}
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg sm:rounded-xl transition-all cursor-pointer shadow-2xs shrink-0"
                        title="Kirim pesan WhatsApp Siap Diambil"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>

                      {/* Quick Move Back Button (Untuk kembalikan ke Lab dengan sekali klik) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStatus(order, "Proses Lab");
                        }}
                        className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg sm:rounded-xl transition-all cursor-pointer shrink-0"
                        title="Kembalikan ke Proses Lab"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
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
      {/* FLOATING GHOST PREVIEW SAAT DRAG DI PONSEL / TOUCH */}
      {/* ======================================================== */}
      {touchDrag?.isDragging && touchDrag.order && (
        <div
          style={{
            position: "fixed",
            left: `${touchDrag.currentX}px`,
            top: `${touchDrag.currentY}px`,
            width: `${Math.min(touchDrag.width || 180, 240)}px`,
            transform: "translate(-50%, -50%) rotate(3deg)",
            pointerEvents: "none",
            zIndex: 9999,
          }}
          className="shadow-2xl opacity-95 transition-transform"
        >
          <div
            className={`bg-white rounded-xl border-2 p-3 shadow-2xl space-y-1.5 ${
              touchDrag.order.status === "Proses Lab"
                ? "border-[#d94841] border-l-[6px]"
                : "border-[#e59a1d] border-l-[6px]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-600 font-mono text-xs">
                {touchDrag.order.invoice_number}
              </span>
              <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">
                Geser...
              </span>
            </div>
            <div className="font-bold text-slate-900 text-xs truncate">
              {touchDrag.order.customer_name}
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-extrabold text-slate-900">
                {formatRupiah(touchDrag.order.grand_total)}
              </span>
              <span className="text-emerald-700 font-bold">
                {touchDrag.order.payment_status || "Lunas"}
              </span>
            </div>
          </div>
        </div>
      )}

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
