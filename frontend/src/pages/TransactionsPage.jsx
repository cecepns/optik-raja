import React, { useState, useEffect } from "react";
import {
  Receipt,
  Search,
  Printer,
  Eye,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  DollarSign,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatDate, formatDateTime, formatRupiah, formatDiopter } from "@/utils/formatters";
import { useDebounce } from "@/hooks/useDebounce";
import Table from "@/components/common/Table";
import Pagination from "@/components/common/Pagination";
import Modal from "@/components/common/Modal";
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

  useEffect(() => {
    fetchTransactions();
  }, [page, limit, debouncedSearch, statusFilter]);

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
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Cetak Struk Nota"
                >
                  <Printer className="w-4 h-4" />
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
    </div>
  );
}
