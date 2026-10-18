import React, { useState, useEffect } from "react";
import {
  Receipt,
  Search,
  Printer,
  Eye,
  Calendar,
  DollarSign,
  Pencil,
  Trash2,
  Plus,
  Minus,
  Package,
  MessageCircle,
  FileSpreadsheet,
  Loader2,
  ChevronDown,
  XCircle,
  Check,
  Lock,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDateTime, formatRupiah, formatDiopter } from "@/utils/formatters";
import { exportTransactionsToExcel } from "@/utils/bulkDataHandler";
import { useDebounce } from "@/hooks/useDebounce";
import { useApp } from "@/context/AppContext";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ReceiptPrintModal from "@/components/print/ReceiptPrintModal";
import { sendWhatsAppMessage, buildTransactionWhatsAppMessage } from "@/utils/whatsapp";

// Helper date format: "14 Okt 2026 | 17:11:24"
const formatTransactionDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const d = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const time = date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/\./g, ":");
  return `${d} | ${time}`;
};

export default function TransactionsPage() {
  const { settings, currentUser } = useApp();
  const isOwner = currentUser?.role === "Owner";
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);

  // Filter dropdowns & Period (Matching Client Reference)
  const [statusFilter, setStatusFilter] = useState("");
  const [penjaminFilter, setPenjaminFilter] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summaryStats, setSummaryStats] = useState({ total: 0, bpjs: 0, umum: 0 });

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Print Receipt Modal
  const [selectedTrxForPrint, setSelectedTrxForPrint] = useState(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Read-only Prescription Modal (SRS Modul 4 requirement)
  const [prescriptionModalData, setPrescriptionModalData] = useState(null);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [customerRxMap, setCustomerRxMap] = useState({});

  // Pelunasan DP Modal
  const [payModalTrx, setPayModalTrx] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("Tunai");
  const [payNotes, setPayNotes] = useState("");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Lists for Editing & Quick Select
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Delete State
  const [deleteTrx, setDeleteTrx] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [customerRxOptions, setCustomerRxOptions] = useState([]);

  useEffect(() => {
    fetchTransactions();
  }, [page, limit, debouncedSearch, statusFilter, penjaminFilter, startDate, endDate]);

  useEffect(() => {
    loadCustomersAndEmployees();
  }, []);

  const loadCustomersAndEmployees = async () => {
    try {
      const [cRes, eRes] = await Promise.allSettled([
        request.get(API_ENDPOINTS.CUSTOMERS.LIST, { limit: 100 }),
        request.get(API_ENDPOINTS.EMPLOYEES.LIST, { limit: 100 }),
      ]);
      if (cRes.status === "fulfilled" && cRes.value?.data) {
        setCustomers(cRes.value.data);
      }
      if (eRes.status === "fulfilled" && eRes.value?.data) {
        setEmployees(eRes.value.data);
      }
    } catch (err) {
      console.error("Gagal memuat master opsi:", err);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        search: debouncedSearch,
      };
      if (statusFilter) params.payment_status = statusFilter;
      if (penjaminFilter) params.penjamin = penjaminFilter;
      if (startDate) params.date_start = startDate;
      if (endDate) params.date_end = endDate;

      const [res, rxRes] = await Promise.allSettled([
        request.get(API_ENDPOINTS.TRANSACTIONS.LIST, params),
        request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, { limit: 100 }),
      ]);

      if (res.status === "fulfilled" && res.value?.success) {
        setTransactions(res.value.data || []);
        setTotalPages(res.value.pagination?.totalPages || 1);
        setTotalItems(res.value.pagination?.total || 0);
        if (res.value.summary) {
          setSummaryStats(res.value.summary);
        } else {
          setSummaryStats({
            total: res.value.pagination?.total || 0,
            bpjs: (res.value.data || []).filter((t) => Number(t.bpjs_subsidy) > 0).length,
            umum: (res.value.data || []).filter((t) => !t.bpjs_subsidy || Number(t.bpjs_subsidy) <= 0).length,
          });
        }
      }

      if (rxRes.status === "fulfilled" && rxRes.value?.data) {
        const map = {};
        rxRes.value.data.forEach((rx) => {
          if (!map[rx.customer_id]) {
            map[rx.customer_id] = rx;
          }
        });
        setCustomerRxMap(map);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat daftar transaksi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPenjaminFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    toast.success("Filter transaksi di-reset ke semua data");
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.payment_status = statusFilter;
      if (penjaminFilter) params.penjamin = penjaminFilter;
      if (startDate) params.date_start = startDate;
      if (endDate) params.date_end = endDate;

      const res = await request.get(API_ENDPOINTS.TRANSACTIONS.EXPORT, params);
      if (res?.success && res?.data) {
        if (res.data.length === 0) {
          toast.error("Tidak ada data transaksi untuk diekspor");
          return;
        }
        const periodLabel =
          startDate && endDate
            ? `${formatDate(startDate)} s/d ${formatDate(endDate)}`
            : startDate
            ? `Mulai ${formatDate(startDate)}`
            : endDate
            ? `Sampai ${formatDate(endDate)}`
            : "Semua Waktu";

        const fileName = exportTransactionsToExcel(res.data, periodLabel);
        toast.success(`Berhasil mengekspor ${res.data.length} transaksi (${fileName})!`);
      }
    } catch (err) {
      console.error("Gagal ekspor transaksi:", err);
      toast.error(err.message || "Gagal mengekspor data transaksi");
    } finally {
      setIsExporting(false);
    }
  };

  // Quick Change Employee in Card Action Bar
  const handleQuickChangeEmployee = async (trxId, newEmployeeId) => {
    try {
      const res = await request.put(API_ENDPOINTS.TRANSACTIONS.UPDATE(trxId), {
        employee_id: Number(newEmployeeId),
      });
      if (res?.success) {
        toast.success("Petugas kasir berhasil diperbarui");
        setTransactions((prev) =>
          prev.map((t) => {
            if (t.id === trxId) {
              const emp = employees.find((e) => e.id === Number(newEmployeeId));
              return {
                ...t,
                employee_id: Number(newEmployeeId),
                employee_name: emp ? emp.name : t.employee_name,
              };
            }
            return t;
          })
        );
      }
    } catch (err) {
      toast.error(err.message || "Gagal mengubah petugas kasir");
    }
  };

  const handleOpenPrint = async (trx) => {
    try {
      const res = await request.get(API_ENDPOINTS.TRANSACTIONS.DETAIL(trx.id));
      if (res?.data) {
        setSelectedTrxForPrint(res.data);
        setIsPrintModalOpen(true);
      }
    } catch (err) {
      toast.error("Gagal memuat rincian struk transaksi");
    }
  };

  // View Read-Only Prescription Modal with fallback resolution
  const handleViewPrescription = async (trx, targetRxId) => {
    let rxId = targetRxId || trx.prescription_id || customerRxMap[trx.customer_id]?.id;

    if (!rxId && trx.customer_id) {
      try {
        const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, {
          customer_id: trx.customer_id,
        });
        if (res?.data && res.data.length > 0) {
          rxId = res.data[0].id;
        }
      } catch (err) {
        console.error("Prescription fallback fetch error:", err);
      }
    }

    if (!rxId) {
      toast.error("Pasien ini belum memiliki catatan di menu Rekam Medis");
      return;
    }

    try {
      const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.DETAIL(rxId));
      if (res?.data) {
        setPrescriptionModalData(res.data);
        setIsPrescriptionModalOpen(true);
      }
    } catch (err) {
      toast.error("Gagal memuat data resep");
    }
  };

  // Open Pelunasan Modal
  const handleOpenPay = (trx) => {
    setPayModalTrx(trx);
    setPayAmount(trx.remaining_amount);
    setPayMethod("Tunai");
    setPayNotes("");
  };

  const handleProcessPayment = async (e) => {
    e.preventDefault();
    if (!payModalTrx) return;

    if (payAmount <= 0) {
      toast.error("Nominal pelunasan harus lebih dari Rp 0");
      return;
    }

    setIsSubmittingPay(true);
    try {
      const res = await request.post(API_ENDPOINTS.TRANSACTIONS.PAY(payModalTrx.id), {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        notes: payNotes,
      });

      if (res?.success) {
        toast.success(res.message);
        setPayModalTrx(null);
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.message || "Gagal memproses pelunasan");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Open Edit Transaction Modal
  const handleOpenEdit = async (trx) => {
    setIsLoadingDetail(true);
    try {
      if (customers.length === 0 || employees.length === 0) {
        await loadCustomersAndEmployees();
      }

      const res = await request.get(API_ENDPOINTS.TRANSACTIONS.DETAIL(trx.id));
      const data = res?.data || trx;

      let rxOptions = [];
      if (data.customer_id) {
        try {
          const rxRes = await request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, {
            customer_id: data.customer_id,
            limit: 50,
          });
          if (rxRes?.data) {
            rxOptions = rxRes.data;
          }
        } catch (rxErr) {
          console.error("Gagal memuat resep pelanggan:", rxErr);
        }
      }
      setCustomerRxOptions(rxOptions);

      setEditFormData({
        id: data.id,
        invoice_number: data.invoice_number,
        customer_id: data.customer_id,
        employee_id: data.employee_id,
        prescription_id: data.prescription_id || "",
        completion_estimate: data.completion_estimate
          ? data.completion_estimate.slice(0, 10)
          : "",
        transaction_date: data.transaction_date || "",
        payment_status: data.payment_status || "Lunas",
        payment_method: data.payment_method || "Tunai",
        subtotal: Number(data.subtotal) || 0,
        discount_amount: Number(data.discount_amount) || 0,
        bpjs_subsidy: Number(data.bpjs_subsidy) || 0,
        grand_total: Number(data.grand_total) || 0,
        paid_amount: Number(data.paid_amount) || 0,
        remaining_amount: Number(data.remaining_amount) || 0,
        notes: data.notes || "",
        items: (data.items || []).map((it) => ({
          id: it.id,
          product_id: it.product_id,
          product_name: it.product_name,
          category: it.category,
          price: Number(it.price) || 0,
          quantity: Number(it.quantity) || 1,
          discount: Number(it.discount) || 0,
          total_price: Number(it.total_price) || 0,
          notes: it.notes || "",
        })),
      });

      setIsEditModalOpen(true);
    } catch (err) {
      toast.error("Gagal memuat data transaksi untuk diedit");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCustomerChange = async (newCustomerId) => {
    setEditFormData((prev) => ({
      ...prev,
      customer_id: newCustomerId,
      prescription_id: "",
    }));

    if (!newCustomerId) {
      setCustomerRxOptions([]);
      return;
    }

    try {
      const res = await request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, {
        customer_id: newCustomerId,
        limit: 50,
      });
      if (res?.data) {
        setCustomerRxOptions(res.data);
        if (res.data.length > 0) {
          setEditFormData((prev) => ({
            ...prev,
            prescription_id: res.data[0].id,
          }));
        }
      }
    } catch (err) {
      console.error("Gagal memuat rekam medis pasien:", err);
    }
  };

  const updateItemQty = (index, delta) => {
    setEditFormData((prev) => {
      const newItems = [...prev.items];
      const currentItem = newItems[index];
      const newQty = Math.max(1, currentItem.quantity + delta);
      const unitPrice = Math.max(0, currentItem.price - currentItem.discount);
      newItems[index] = {
        ...currentItem,
        quantity: newQty,
        total_price: unitPrice * newQty,
      };

      const newSubtotal = newItems.reduce((acc, it) => acc + it.total_price, 0);
      const newGrandTotal = Math.max(
        0,
        newSubtotal - prev.discount_amount - prev.bpjs_subsidy
      );
      let newPaid = prev.paid_amount;
      if (prev.payment_status === "Lunas") {
        newPaid = newGrandTotal;
      }
      const newRemaining = Math.max(0, newGrandTotal - newPaid);

      return {
        ...prev,
        items: newItems,
        subtotal: newSubtotal,
        grand_total: newGrandTotal,
        paid_amount: newPaid,
        remaining_amount: newRemaining,
      };
    });
  };

  const removeItem = (index) => {
    setEditFormData((prev) => {
      if (prev.items.length <= 1) {
        toast.error("Transaksi harus memiliki minimal 1 produk");
        return prev;
      }
      const newItems = prev.items.filter((_, i) => i !== index);
      const newSubtotal = newItems.reduce((acc, it) => acc + it.total_price, 0);
      const newGrandTotal = Math.max(
        0,
        newSubtotal - prev.discount_amount - prev.bpjs_subsidy
      );
      let newPaid = prev.paid_amount;
      if (prev.payment_status === "Lunas") {
        newPaid = newGrandTotal;
      }
      const newRemaining = Math.max(0, newGrandTotal - newPaid);

      return {
        ...prev,
        items: newItems,
        subtotal: newSubtotal,
        grand_total: newGrandTotal,
        paid_amount: newPaid,
        remaining_amount: newRemaining,
      };
    });
  };

  const handleDiscountOrBpjsChange = (field, val) => {
    const num = Math.max(0, Number(val) || 0);
    setEditFormData((prev) => {
      const newDiscount = field === "discount_amount" ? num : prev.discount_amount;
      const newBpjs = field === "bpjs_subsidy" ? num : prev.bpjs_subsidy;
      const newGrandTotal = Math.max(0, prev.subtotal - newDiscount - newBpjs);
      let newPaid = prev.paid_amount;
      if (prev.payment_status === "Lunas") {
        newPaid = newGrandTotal;
      }
      const newRemaining = Math.max(0, newGrandTotal - newPaid);

      return {
        ...prev,
        [field]: num,
        grand_total: newGrandTotal,
        paid_amount: newPaid,
        remaining_amount: newRemaining,
      };
    });
  };

  const handleStatusChange = (status) => {
    setEditFormData((prev) => {
      let newPaid = prev.paid_amount;
      let newRemaining = prev.remaining_amount;

      if (status === "Lunas") {
        newPaid = prev.grand_total;
        newRemaining = 0;
      } else if (status === "Belum Lunas") {
        newPaid = 0;
        newRemaining = prev.grand_total;
      } else if (status === "DP") {
        if (newPaid >= prev.grand_total || newPaid <= 0) {
          newPaid = Math.round(prev.grand_total / 2);
        }
        newRemaining = Math.max(0, prev.grand_total - newPaid);
      }

      return {
        ...prev,
        payment_status: status,
        paid_amount: newPaid,
        remaining_amount: newRemaining,
      };
    });
  };

  const handlePaidAmountChange = (val) => {
    const num = Math.max(0, Number(val) || 0);
    setEditFormData((prev) => {
      const newRemaining = Math.max(0, prev.grand_total - num);
      let newStatus = prev.payment_status;
      if (newRemaining <= 0) {
        newStatus = "Lunas";
      } else if (num > 0) {
        newStatus = "DP";
      } else {
        newStatus = "Belum Lunas";
      }
      return {
        ...prev,
        paid_amount: num,
        remaining_amount: newRemaining,
        payment_status: newStatus,
      };
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editFormData) return;

    if (!editFormData.customer_id) {
      toast.error("Silakan pilih Pelanggan!");
      return;
    }
    if (!editFormData.employee_id) {
      toast.error("Silakan pilih Kasir / Petugas!");
      return;
    }
    if (editFormData.items.length === 0) {
      toast.error("Transaksi harus memiliki minimal 1 item produk!");
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const payload = {
        customer_id: Number(editFormData.customer_id),
        employee_id: Number(editFormData.employee_id),
        prescription_id: editFormData.prescription_id ? Number(editFormData.prescription_id) : null,
        completion_estimate: editFormData.completion_estimate || null,
        subtotal: editFormData.subtotal,
        discount_amount: editFormData.discount_amount,
        bpjs_subsidy: editFormData.bpjs_subsidy,
        grand_total: editFormData.grand_total,
        paid_amount: editFormData.paid_amount,
        payment_status: editFormData.payment_status,
        payment_method: editFormData.payment_method,
        remaining_amount: editFormData.remaining_amount,
        dp_amount: editFormData.payment_status === "DP" ? editFormData.paid_amount : 0,
        notes: editFormData.notes,
        items: editFormData.items,
      };

      const res = await request.put(
        API_ENDPOINTS.TRANSACTIONS.UPDATE(editFormData.id),
        payload
      );

      if (res?.success) {
        toast.success("Transaksi berhasil diperbarui");
        setIsEditModalOpen(false);
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.message || "Gagal memperbarui transaksi");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTrx) return;
    setIsDeleting(true);
    try {
      const res = await request.delete(
        API_ENDPOINTS.TRANSACTIONS.DELETE(deleteTrx.id)
      );
      if (res?.success) {
        toast.success("Transaksi berhasil dihapus dan stok barang telah dikembalikan");
        setDeleteTrx(null);
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.message || "Gagal menghapus transaksi");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3.5 sm:space-y-4 max-w-4xl mx-auto">
      {/* 1. Search Bar (Matching Client Screenshot) */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Cari Nota, Nama..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs placeholder:text-gray-400"
        />
      </div>

      {/* 2. Dropdown Filter Row: Status & Penjamin (Matching Screenshot) */}
      <div className="grid grid-cols-2 gap-2 w-full">
        {/* Status Dropdown */}
        <div className="relative w-full">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 shadow-2xs appearance-none cursor-pointer pr-9"
          >
            <option value="">Semua Status</option>
            <option value="Lunas">Lunas</option>
            <option value="DP">DP (Uang Muka)</option>
            <option value="Belum Lunas">Belum Lunas</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Penjamin Dropdown */}
        <div className="relative w-full">
          <select
            value={penjaminFilter}
            onChange={(e) => {
              setPenjaminFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3.5 py-2.5 text-xs bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium text-gray-700 shadow-2xs appearance-none cursor-pointer pr-9"
          >
            <option value="">Semua Penjamin</option>
            <option value="Umum">Umum</option>
            <option value="BPJS">BPJS</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 3. Export Button (Full Width Green, Matching Screenshot) */}
      <button
        type="button"
        onClick={handleExport}
        disabled={isLoading || isExporting}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#107c41] hover:bg-[#0c6334] active:scale-[0.99] text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
        )}
        <span>Export</span>
      </button>

      {/* 4. Periode Tanggal Row (Matching Screenshot) */}
      <div className="flex items-center gap-2 text-xs bg-white p-2 sm:p-2.5 rounded-lg border border-gray-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-gray-700 font-semibold shrink-0">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span>Periode:</span>
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
        />
        <span className="text-gray-500 font-medium shrink-0">s/d</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="flex-1 px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500 font-medium text-gray-800"
        />
      </div>

      {/* 5. Reset Filter & Summary Badges Row (Matching Screenshot) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleResetFilters}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 text-gray-700 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5 text-gray-400" />
          <span>Reset</span>
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 shadow-2xs">
          <span>{totalItems} transaksi</span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{summaryStats.bpjs ?? 0} BPJS</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1.5 text-blue-700 font-semibold">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>{summaryStats.umum ?? 0} Umum</span>
          </span>
        </div>
      </div>

      {/* 6. Transaction Cards List (Matching Client Screenshot) */}
      <div className="space-y-3 pt-1">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-2xs">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">Memuat data transaksi...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center shadow-2xs">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-700">Belum ada transaksi ditemukan</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Coba sesuaikan kata kunci pencarian atau rentang periode tanggal
            </p>
          </div>
        ) : (
          transactions.map((trx, idx) => {
            const isBpjs = Number(trx.bpjs_subsidy) > 0;
            const orderStatus =
              trx.lab_status || (trx.payment_status === "Lunas" ? "Selesai" : "Diproses");
            const itemNumber = (page - 1) * limit + idx + 1;

            return (
              <div
                key={trx.id}
                className="bg-white rounded-xl border border-emerald-100/90 hover:border-blue-200 transition-all shadow-2xs overflow-hidden"
              >
                {/* Card Body */}
                <div className="p-3.5 sm:p-4 space-y-2 text-xs">
                  {/* Row 1: No Nota, Date & Time, Index Number */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 font-medium">No Nota</span>
                      <span className="font-bold text-blue-600 font-mono text-xs sm:text-sm">
                        {trx.invoice_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400 font-medium">
                        {formatTransactionDateTime(trx.transaction_date)}
                      </span>
                      <span className="text-xs font-semibold text-gray-400">
                        {itemNumber}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Pelanggan, Name, Penjamin Badge */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-gray-500 font-medium w-24 shrink-0">Pelanggan</span>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm text-center flex-1 truncate px-2">
                      {trx.customer_name}
                    </span>
                    <div className="w-24 shrink-0 flex justify-end">
                      {isBpjs ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>BPJS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                          <span>Umum</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Tagihan, Amount, Payment Status Badge */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-gray-500 font-medium w-24 shrink-0">Tagihan</span>
                    <span className="font-bold text-gray-900 text-xs sm:text-sm text-center flex-1 px-2">
                      {formatRupiah(trx.grand_total)}
                    </span>
                    <div className="w-24 shrink-0 flex justify-end">
                      {trx.payment_status === "Lunas" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-700 text-white shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Lunas</span>
                        </span>
                      ) : trx.payment_status === "DP" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-2xs">
                          <span>DP</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-2xs">
                          <span>Belum Lunas</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Status Pesanan, Order Status Badge */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-gray-500 font-medium">Status Pesanan</span>
                    <div className="flex justify-end">
                      {orderStatus === "Selesai" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-700 text-white shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Selesai</span>
                        </span>
                      ) : orderStatus === "Siap Diambil" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-2xs">
                          <Package className="w-3 h-3" />
                          <span>Siap Diambil</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-2xs">
                          <Clock className="w-3 h-3" />
                          <span>Proses Lab</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer / Action Bar (Locked when Selesai) */}
                <div className="bg-gray-50/80 px-3 py-2 border-t border-gray-100 flex flex-wrap items-center justify-end gap-1.5">
                  {orderStatus === "Selesai" ? (
                    /* Locked State for Selesai: Show read-only employee and lock badge */
                    <div className="mr-auto flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-slate-700 bg-slate-200/80 rounded-md">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>{trx.employee_name || "Kasir"}</span>
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium hidden sm:inline">
                        (Terkunci)
                      </span>
                    </div>
                  ) : (
                    /* Editable State: Kasir / Petugas Selector */
                    <div className="relative inline-block mr-auto">
                      <select
                        value={trx.employee_id}
                        onChange={(e) => handleQuickChangeEmployee(trx.id, e.target.value)}
                        className="appearance-none pl-2.5 pr-6 py-1 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                        title="Ubah Petugas Kasir"
                      >
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-blue-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  )}

                  {/* Resep Button (Always Available) */}
                  <button
                    type="button"
                    onClick={() => handleViewPrescription(trx)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer"
                    title="Lihat Rekam Medis Pasien"
                  >
                    <Eye className="w-3.5 h-3.5 text-gray-500" />
                    <span>Resep</span>
                  </button>

                  {/* Print Button (Always Available) */}
                  <button
                    type="button"
                    onClick={() => handleOpenPrint(trx)}
                    className="p-1.5 text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer"
                    title="Cetak Struk Nota"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  {/* WhatsApp Button (Always Available) */}
                  <button
                    type="button"
                    onClick={() => {
                      const msg = buildTransactionWhatsAppMessage(trx, settings);
                      sendWhatsAppMessage(trx.customer_phone, msg);
                    }}
                    className="p-1.5 text-emerald-600 bg-white border border-gray-300 hover:bg-emerald-50 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer"
                    title="Kirim Nota via WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit Button: Only visible if NOT Selesai */}
                  {orderStatus !== "Selesai" && (
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(trx)}
                      className="p-1.5 text-amber-600 bg-white border border-gray-300 hover:bg-amber-50 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer"
                      title="Edit Data Transaksi"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Button: Khusus Otorisasi Owner */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setDeleteTrx(trx)}
                      className="p-1.5 text-red-500 hover:text-red-700 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-300 active:scale-95 rounded-lg shadow-2xs transition-all cursor-pointer"
                      title="Hapus Transaksi (Khusus Owner)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

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
        itemName="transaksi"
        compact={true}
      />

      {/* ==========================================
          READ-ONLY PRESCRIPTION MODAL (SRS MODUL 4)
         ========================================== */}
      <Modal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        title="Rekam Medis Pasien (Mode Hanya-Baca)"
        subtitle={`Pasien: ${prescriptionModalData?.customer_name || "-"} • Pemeriksa: ${prescriptionModalData?.examiner_name || "-"}`}
        maxWidth="max-w-2xl"
        footer={
          <button
            type="button"
            onClick={() => setIsPrescriptionModalOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer"
          >
            Tutup
          </button>
        }
      >
        {prescriptionModalData && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs flex justify-between">
              <div>
                <span className="text-gray-500 block text-[10px]">Tanggal Pemeriksaan:</span>
                <span className="font-bold text-blue-900">{formatDate(prescriptionModalData.exam_date)}</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 block text-[10px]">Total Pupillary Distance (PD):</span>
                <span className="font-bold text-blue-900">{prescriptionModalData.total_pd} mm</span>
              </div>
            </div>

            {/* Matrix OD & OS Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-center text-xs font-mono">
                <thead className="bg-gray-50 font-sans font-bold text-gray-700">
                  <tr>
                    <th className="p-2 text-left">Mata</th>
                    <th className="p-2">UCVA</th>
                    <th className="p-2">SPH</th>
                    <th className="p-2">CYL</th>
                    <th className="p-2">AXIS</th>
                    <th className="p-2">BCVA</th>
                    <th className="p-2">ADD</th>
                    <th className="p-2">MPD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="bg-white">
                    <td className="p-2 text-left font-bold text-blue-900">OD (Kanan)</td>
                    <td className="p-2">{prescriptionModalData.od_ucva || "-"}</td>
                    <td className="p-2 font-bold">{formatDiopter(prescriptionModalData.od_sph)}</td>
                    <td className="p-2">{formatDiopter(prescriptionModalData.od_cyl)}</td>
                    <td className="p-2">{prescriptionModalData.od_axis}°</td>
                    <td className="p-2 text-emerald-700">{prescriptionModalData.od_bcva || "6/6"}</td>
                    <td className="p-2 font-bold text-indigo-700">{formatDiopter(prescriptionModalData.od_add)}</td>
                    <td className="p-2">{prescriptionModalData.od_mpd} mm</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="p-2 text-left font-bold text-blue-900">OS (Kiri)</td>
                    <td className="p-2">{prescriptionModalData.os_ucva || "-"}</td>
                    <td className="p-2 font-bold">{formatDiopter(prescriptionModalData.os_sph)}</td>
                    <td className="p-2">{formatDiopter(prescriptionModalData.os_cyl)}</td>
                    <td className="p-2">{prescriptionModalData.os_axis}°</td>
                    <td className="p-2 text-emerald-700">{prescriptionModalData.os_bcva || "6/6"}</td>
                    <td className="p-2 font-bold text-indigo-700">{formatDiopter(prescriptionModalData.os_add)}</td>
                    <td className="p-2">{prescriptionModalData.os_mpd} mm</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {prescriptionModalData.complaint_diagnose && (
              <div className="p-3 bg-gray-50 rounded-lg text-xs">
                <span className="font-bold text-gray-700 block text-[10px] uppercase">Keluhan Pasien:</span>
                <p className="text-gray-800 mt-0.5">{prescriptionModalData.complaint_diagnose}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ==========================================
          PELUNASAN SISA TAGIHAN DP MODAL
         ========================================== */}
      <Modal
        isOpen={!!payModalTrx}
        onClose={() => setPayModalTrx(null)}
        title="Pelunasan Sisa Tagihan DP"
        subtitle={`Nota: ${payModalTrx?.invoice_number} • Pasien: ${payModalTrx?.customer_name}`}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayModalTrx(null)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleProcessPayment}
              disabled={isSubmittingPay}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingPay ? "Memproses..." : "Konfirmasi Pelunasan"}
            </button>
          </>
        }
      >
        <form onSubmit={handleProcessPayment} className="space-y-3.5">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs">
            <div className="flex justify-between text-gray-700">
              <span>Total Tagihan:</span>
              <span className="font-bold">{formatRupiah(payModalTrx?.grand_total)}</span>
            </div>
            <div className="flex justify-between text-gray-700 mt-1">
              <span>Sudah Dibayar (DP):</span>
              <span className="font-bold text-emerald-700">{formatRupiah(payModalTrx?.paid_amount)}</span>
            </div>
            <div className="flex justify-between text-red-700 font-extrabold text-sm mt-1 pt-1 border-t border-amber-200">
              <span>Sisa Tagihan:</span>
              <span>{formatRupiah(payModalTrx?.remaining_amount)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Nominal Pelunasan (Rp)
            </label>
            <input
              type="number"
              min="1"
              max={payModalTrx?.remaining_amount}
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Metode Pembayaran
            </label>
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
            >
              <option value="Tunai">Tunai</option>
              <option value="Transfer">Transfer Bank</option>
              <option value="QRIS / Debit">QRIS / Debit Card</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 block mb-1">
              Catatan Pelunasan
            </label>
            <input
              type="text"
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              placeholder="Pelunasan kacamata saat diambil..."
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </form>
      </Modal>

      {/* ==========================================
          RECEIPT PRINT MODAL
         ========================================== */}
      <ReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        transaction={selectedTrxForPrint}
      />

      {/* ==========================================
          DELETE CONFIRMATION DIALOG (KHUSUS OWNER)
         ========================================== */}
      <ConfirmDialog
        isOpen={!!deleteTrx}
        onClose={() => setDeleteTrx(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Hapus Transaksi (Otorisasi Owner)"
        message={
          deleteTrx?.order_status === "Selesai"
            ? `Perhatian (Otorisasi Owner): Nota ${deleteTrx?.invoice_number} berstatus "Selesai". Menghapus transaksi ini akan membatalkan riwayat nota, menghapus order lab, dan mengembalikan seluruh kuantiti produk ke stok gudang secara otomatis. Lanjutkan penghapusan nota ini?`
            : `Apakah Anda yakin ingin menghapus transaksi nota ${deleteTrx?.invoice_number}? Stok seluruh produk dalam transaksi ini akan dikembalikan ke gudang secara otomatis.`
        }
        confirmText="Ya, Hapus Transaksi"
      />

      {/* ==========================================
          EDIT TRANSACTION MODAL
         ========================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Transaksi Penjualan"
        subtitle={`Nota: ${editFormData?.invoice_number} • Total: ${formatRupiah(editFormData?.grand_total || 0)}`}
        maxWidth="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    const currentTrx = transactions.find((t) => t.id === editFormData?.id) || editFormData;
                    setIsEditModalOpen(false);
                    setDeleteTrx(currentTrx);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition-colors"
                  title="Hapus Transaksi (Khusus Owner)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Nota (Owner)</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSubmittingEdit}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                {isSubmittingEdit ? "Menyimpan Perubahan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        }
      >
        {editFormData && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-gray-500 uppercase font-bold block">No Nota</span>
                <span className="text-xs font-mono font-bold text-gray-900">{editFormData.invoice_number}</span>
              </div>
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span className="text-[10px] text-blue-600 uppercase font-bold block">Total Akhir</span>
                <span className="text-xs font-bold text-blue-900">{formatRupiah(editFormData.grand_total)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span className="text-[10px] text-emerald-600 uppercase font-bold block">Terbayar</span>
                <span className="text-xs font-bold text-emerald-900">{formatRupiah(editFormData.paid_amount)}</span>
              </div>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <span className="text-[10px] text-amber-600 uppercase font-bold block">Sisa Piutang</span>
                <span className="text-xs font-bold text-amber-900">{formatRupiah(editFormData.remaining_amount)}</span>
              </div>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Pelanggan <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.customer_id}
                  onChange={(e) => handleCustomerChange(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="">-- Pilih Pelanggan --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Kasir / Petugas <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.employee_id}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      employee_id: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="">-- Pilih Petugas --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Rekam Medis (Resep)
                </label>
                <select
                  value={editFormData.prescription_id}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      prescription_id: e.target.value ? Number(e.target.value) : "",
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="">Tanpa Rekam Medis</option>
                  {customerRxOptions.map((rx) => (
                    <option key={rx.id} value={rx.id}>
                      {formatDate(rx.exam_date)} • {rx.examiner_name} (PD: {rx.total_pd}mm)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time & Payment Status Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Estimasi Selesai Lab
                </label>
                <input
                  type="date"
                  value={editFormData.completion_estimate}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      completion_estimate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Status Pembayaran <span className="text-red-500">*</span>
                </label>
                <select
                  value={editFormData.payment_status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold cursor-pointer"
                >
                  <option value="Lunas">Lunas</option>
                  <option value="DP">DP (Uang Muka)</option>
                  <option value="Belum Lunas">Belum Lunas</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={editFormData.payment_method}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      payment_method: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                >
                  <option value="Tunai">Tunai</option>
                  <option value="Transfer Bank BCA">Transfer Bank BCA</option>
                  <option value="Transfer Bank Mandiri">Transfer Bank Mandiri</option>
                  <option value="Transfer Bank BNI/BRI">Transfer Bank BNI/BRI</option>
                  <option value="QRIS">QRIS</option>
                  <option value="Debit / Kartu Kredit">Debit / Kartu Kredit</option>
                </select>
              </div>
            </div>

            {/* Items Table with Quantity and Price Adjustments */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  Daftar Produk Transaksi ({editFormData.items.length})
                </span>
                <span className="text-[11px] text-gray-500">
                  Subtotal: <strong className="text-gray-900">{formatRupiah(editFormData.subtotal)}</strong>
                </span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                    <tr>
                      <th className="p-2">Produk</th>
                      <th className="p-2 text-right">Harga</th>
                      <th className="p-2 text-center">Jumlah (Qty)</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editFormData.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="p-2">
                          <p className="font-bold text-gray-900">{item.product_name}</p>
                          <span className="inline-block text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded mt-0.5">
                            {item.category}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono">
                          {formatRupiah(item.price - item.discount)}
                        </td>
                        <td className="p-2 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => updateItemQty(idx, -1)}
                              disabled={item.quantity <= 1}
                              className="p-1 hover:bg-white rounded text-gray-600 disabled:opacity-30 transition-colors cursor-pointer"
                              title="Kurangi 1"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center font-bold text-xs">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateItemQty(idx, 1)}
                              className="p-1 hover:bg-white rounded text-gray-600 transition-colors cursor-pointer"
                              title="Tambah 1"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-gray-900">
                          {formatRupiah(item.total_price)}
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Hapus produk dari nota"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Adjustments Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Diskon Transaksi (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editFormData.discount_amount}
                  onChange={(e) => handleDiscountOrBpjsChange("discount_amount", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Subsidi BPJS (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editFormData.bpjs_subsidy}
                  onChange={(e) => handleDiscountOrBpjsChange("bpjs_subsidy", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Jumlah Terbayar (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editFormData.paid_amount}
                  onChange={(e) => handlePaidAmountChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-emerald-700"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">
                Catatan Transaksi
              </label>
              <textarea
                rows={2}
                value={editFormData.notes}
                onChange={(e) =>
                  setEditFormData((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Catatan tambahan untuk kasir / pelanggan..."
                className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
