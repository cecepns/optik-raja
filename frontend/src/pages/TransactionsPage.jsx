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
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDateTime, formatRupiah, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ReceiptPrintModal from "@/components/print/ReceiptPrintModal";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Pagination & Search
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState("");

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

  // Lists for Editing
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
    loadCustomersAndEmployees();
  }, [page, limit, debouncedSearch, statusFilter]);

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

      const [res, rxRes] = await Promise.allSettled([
        request.get(API_ENDPOINTS.TRANSACTIONS.LIST, params),
        request.get(API_ENDPOINTS.PRESCRIPTIONS.LIST, { limit: 100 }),
      ]);

      if (res.status === "fulfilled" && res.value?.success) {
        setTransactions(res.value.data);
        setTotalPages(res.value.pagination.totalPages);
        setTotalItems(res.value.pagination.total);
      }

      if (rxRes.status === "fulfilled" && rxRes.value?.data) {
        const map = {};
        rxRes.value.data.forEach((rx) => {
          // Keep newest prescription for each customer
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

  const handleOpenPrint = async (trx) => {
    try {
      // Get complete transaction with items
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

    // Fallback: If not resolved, query backend specifically for this customer
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

      // Load customer's prescriptions
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

  const headers = [
    { label: "Nomor Nota & Waktu", align: "left" },
    { label: "Pelanggan", align: "left" },
    { label: "Total Tagihan", align: "right" },
    { label: "Terbayar (DP)", align: "right" },
    { label: "Sisa Piutang", align: "right" },
    { label: "Status Bayar", align: "center" },
    { label: "Rekam Medis", align: "center" },
    { label: "Aksi", align: "center" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            Daftar Transaksi & Rekap Nota Penjualan
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Rekap transaksi kasir optik, manajemen pembayaran DP, pelunasan sisa tagihan, dan cetak struk
          </p>
        </div>
      </div>

      {/* Toolbar Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nomor nota, nama pelanggan, no telepon..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-auto px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">Semua Status Bayar</option>
            <option value="Lunas">Status: Lunas</option>
            <option value="DP">Status: Uang Muka (DP)</option>
            <option value="Belum Lunas">Status: Belum Lunas</option>
          </select>
        </div>

        <div className="text-xs text-gray-500">
          Total Transaksi: <span className="font-bold text-gray-800">{totalItems}</span>
        </div>
      </div>

      {/* Transactions Table */}
      <Table
        headers={headers}
        isLoading={isLoading}
        isEmpty={transactions.length === 0}
        emptyMessage="Belum ada transaksi ditemukan."
      >
        {transactions.map((trx) => (
          <tr key={trx.id} className="hover:bg-gray-50/70 transition-colors">
            {/* Invoice & Date */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-blue-900 font-mono">{trx.invoice_number}</div>
              <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-gray-400" />
                {formatDateTime(trx.transaction_date)}
              </div>
              <div className="text-[10px] text-gray-400">Kasir: {trx.employee_name}</div>
            </td>

            {/* Customer */}
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="font-bold text-xs text-gray-900">{trx.customer_name}</div>
              <div className="text-[11px] text-gray-500">{trx.customer_phone}</div>
              {trx.customer_code && (
                <span className="text-[10px] text-gray-400 font-mono">{trx.customer_code}</span>
              )}
            </td>

            {/* Grand Total */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-bold text-gray-900">
              {formatRupiah(trx.grand_total)}
              {trx.bpjs_subsidy > 0 && (
                <div className="text-[10px] text-emerald-600 font-normal">
                  BPJS: {formatRupiah(trx.bpjs_subsidy)}
                </div>
              )}
            </td>

            {/* Paid / DP */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-semibold text-gray-700">
              {formatRupiah(trx.paid_amount)}
              <div className="text-[10px] text-gray-400">{trx.payment_method}</div>
            </td>

            {/* Remaining (Piutang) */}
            <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-bold">
              {trx.remaining_amount > 0 ? (
                <span className="text-red-600">{formatRupiah(trx.remaining_amount)}</span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </td>

            {/* Payment Status */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  trx.payment_status === "Lunas"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}
              >
                {trx.payment_status}
              </span>
            </td>

            {/* Prescription Button (Read-only modal as specified in SRS Modul 4) */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              {(() => {
                const effectiveRxId =
                  trx.prescription_id || customerRxMap[trx.customer_id]?.id;
                if (effectiveRxId) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleViewPrescription(trx, effectiveRxId)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 active:scale-95 border border-blue-200 rounded-lg transition-all cursor-pointer shadow-2xs"
                      title="Lihat Rekam Medis Pasien"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Rekam Medis</span>
                    </button>
                  );
                }
                return <span className="text-gray-400 text-xs">Tanpa Rekam Medis</span>;
              })()}
            </td>

            {/* Action Buttons */}
            <td className="px-4 py-3 text-center whitespace-nowrap">
              <div className="flex items-center justify-center gap-1.5">
                {/* Pelunasan Button for DP / Belum Lunas */}
                {trx.payment_status !== "Lunas" && trx.remaining_amount > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenPay(trx)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-2xs transition-colors"
                    title="Pelunasan Sisa Tagihan"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Pelunasan</span>
                  </button>
                )}

                {/* Print Receipt */}
                <button
                  type="button"
                  onClick={() => handleOpenPrint(trx)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Cetak Struk Nota"
                >
                  <Printer className="w-4 h-4" />
                </button>

                {/* Edit Transaction */}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(trx)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Edit Transaksi"
                >
                  <Pencil className="w-4 h-4" />
                </button>

                {/* Delete Transaction */}
                <button
                  type="button"
                  onClick={() => setDeleteTrx(trx)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Hapus Transaksi"
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

      {/* Read-Only Prescription Modal (SRS Modul 4 requirement) */}
      <Modal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        title="Rekam Medis Pasien (Mode Hanya-Baca)"
        subtitle={`Pasien: ${prescriptionModalData?.customer_name} • Pemeriksa: ${prescriptionModalData?.examiner_name}`}
        maxWidth="max-w-2xl"
        footer={
          <button
            type="button"
            onClick={() => setIsPrescriptionModalOpen(false)}
            className="px-4 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
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

      {/* Pelunasan Sisa Tagihan Modal */}
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
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleProcessPayment}
              disabled={isSubmittingPay}
              className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50"
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
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
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

      {/* Receipt Print Modal */}
      <ReceiptPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        transaction={selectedTrxForPrint}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTrx}
        onClose={() => setDeleteTrx(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Hapus Transaksi Penjualan"
        message={`Apakah Anda yakin ingin menghapus transaksi nota ${deleteTrx?.invoice_number}? Stok seluruh produk dalam transaksi ini akan dikembalikan ke gudang secara otomatis.`}
        confirmText="Ya, Hapus Transaksi"
      />

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Transaksi Penjualan"
        subtitle={`Nota: ${editFormData?.invoice_number} • Total: ${formatRupiah(editFormData?.grand_total || 0)}`}
        maxWidth="max-w-4xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isSubmittingEdit}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              {isSubmittingEdit ? "Menyimpan Perubahan..." : "Simpan Perubahan"}
            </button>
          </>
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
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
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
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
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
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
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
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold"
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
                  className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
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
                              className="p-1 hover:bg-white rounded text-gray-600 disabled:opacity-30 transition-colors"
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
                              className="p-1 hover:bg-white rounded text-gray-600 transition-colors"
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
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
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
