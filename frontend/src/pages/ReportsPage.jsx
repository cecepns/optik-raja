import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Printer,
  Calendar,
  Wallet,
  ShieldCheck,
  CreditCard,
  UserCheck,
  PieChart,
  Layers,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { request } from "@/utils/request";
import { API_ENDPOINTS } from "@/utils/endpoints";
import { formatRupiah, formatDate } from "@/utils/formatters";
import Table from "@/components/common/Table";
import { useApp } from "@/context/AppContext";
import {
  exportReportToPdf,
  exportReportToExcel,
  printReportDocument,
  exportCommissionReportToPdf,
  exportCommissionReportToExcel,
  printCommissionReportDocument,
  getPeriodLabel,
} from "@/utils/reportExporter";

export default function ReportsPage() {
  const { settings } = useApp();
  const [period, setPeriod] = useState("this_month"); // 'today', 'this_week', 'this_month', 'this_year', 'custom'
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [reportData, setReportData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Scope: 'all' (Laporan Gabungan/Lengkap) or 'commission' (Khusus Komisi Pegawai)
  const [exportScope, setExportScope] = useState("all");

  // Export Loading States
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isPrintingDoc, setIsPrintingDoc] = useState(false);
  const [isExportingCommPdf, setIsExportingCommPdf] = useState(false);
  const [isExportingCommExcel, setIsExportingCommExcel] = useState(false);
  const [isPrintingCommDoc, setIsPrintingCommDoc] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [period]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const params = { period };
      if (period === "custom" && dateStart && dateEnd) {
        params.date_start = dateStart;
        params.date_end = dateEnd;
      }

      const res = await request.get(API_ENDPOINTS.REPORTS.DASHBOARD, params);
      if (res?.success) {
        setReportData(res.data);
      }
    } catch (err) {
      toast.error(err.message || "Gagal memuat laporan keuangan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (!reportData) {
      toast.error("Data laporan belum selesai dimuat");
      return;
    }
    if (exportScope === "commission") {
      handleExportCommPdf();
      return;
    }
    try {
      setIsExportingPdf(true);
      const periodLabel = getPeriodLabel(period, dateStart, dateEnd);
      const fileName = exportReportToPdf(reportData, periodLabel, settings);
      toast.success(`Laporan PDF Lengkap berhasil diunduh (${fileName})!`);
    } catch (err) {
      console.error("Gagal export PDF:", err);
      toast.error("Gagal membuat dokumen PDF: " + (err.message || ""));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportExcel = () => {
    if (!reportData) {
      toast.error("Data laporan belum selesai dimuat");
      return;
    }
    if (exportScope === "commission") {
      handleExportCommExcel();
      return;
    }
    try {
      setIsExportingExcel(true);
      const periodLabel = getPeriodLabel(period, dateStart, dateEnd);
      const fileName = exportReportToExcel(reportData, periodLabel, settings);
      toast.success(`Laporan Excel Lengkap berhasil diunduh (${fileName})!`);
    } catch (err) {
      console.error("Gagal export Excel:", err);
      toast.error("Gagal membuat file Excel: " + (err.message || ""));
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrintReport = () => {
    if (!reportData) {
      toast.error("Data laporan belum selesai dimuat");
      return;
    }
    if (exportScope === "commission") {
      handlePrintCommReport();
      return;
    }
    try {
      setIsPrintingDoc(true);
      const periodLabel = getPeriodLabel(period, dateStart, dateEnd);
      printReportDocument(reportData, periodLabel, settings);
      toast.success("Membuka dialog cetak dokumen laporan resmi...");
    } catch (err) {
      console.error("Gagal mencetak dokumen:", err);
      toast.error("Gagal mencetak dokumen: " + (err.message || ""));
    } finally {
      setIsPrintingDoc(false);
    }
  };

  // Dedicated Commission Export Handlers
  const handleExportCommPdf = () => {
    if (!reportData) {
      toast.error("Data laporan belum selesai dimuat");
      return;
    }
    try {
      setIsExportingCommPdf(true);
      const periodLabel = getPeriodLabel(period, dateStart, dateEnd);
      const fileName = exportCommissionReportToPdf(reportData, periodLabel, settings);
      toast.success(`Laporan Komisi PDF berhasil diunduh (${fileName})!`);
    } catch (err) {
      console.error("Gagal export PDF Komisi:", err);
      toast.error("Gagal membuat PDF Komisi: " + (err.message || ""));
    } finally {
      setIsExportingCommPdf(false);
    }
  };

  const handleExportCommExcel = () => {
    if (!reportData) {
      toast.error("Data laporan belum selesai dimuat");
      return;
    }
    try {
      setIsExportingCommExcel(true);
      const periodLabel = getPeriodLabel(period, dateStart, dateEnd);
      const fileName = exportCommissionReportToExcel(reportData, periodLabel, settings);
      toast.success(`Laporan Komisi Excel berhasil diunduh (${fileName})!`);
    } catch (err) {
      console.error("Gagal export Excel Komisi:", err);
      toast.error("Gagal membuat Excel Komisi: " + (err.message || ""));
    } finally {
      setIsExportingCommExcel(false);
    }
  };

  const handlePrintCommReport = () => {
    if (!reportData) {
      toast.error("Data laporan belum selesai dimuat");
      return;
    }
    try {
      setIsPrintingCommDoc(true);
      const periodLabel = getPeriodLabel(period, dateStart, dateEnd);
      printCommissionReportDocument(reportData, periodLabel, settings);
      toast.success("Membuka dialog cetak khusus Laporan Komisi Pegawai...");
    } catch (err) {
      console.error("Gagal mencetak dokumen komisi:", err);
      toast.error("Gagal mencetak dokumen komisi: " + (err.message || ""));
    } finally {
      setIsPrintingCommDoc(false);
    }
  };

  const metrics = reportData?.metrics || {
    totalTransactions: 0,
    totalSales: 0,
    totalCollected: 0,
    totalReceivables: 0,
    totalBpjsSubsidy: 0,
    totalDp: 0,
    totalExpenses: 0,
    totalCogs: 0,
    netProfit: 0,
    totalDiscount: 0,
  };

  const categoryHeaders = [
    { label: "Kategori Produk", align: "left" },
    { label: "Jumlah Item Terjual", align: "center" },
    { label: "Total Omzet Penjualan", align: "right" },
  ];

  const commissionHeaders = [
    { label: "Nama Pegawai", align: "left" },
    { label: "Role / Jabatan", align: "center" },
    { label: "Jumlah Transaksi Dilayani", align: "center" },
    { label: "Total Nilai Penjualan", align: "right" },
    { label: "Skema Komisi", align: "center" },
    { label: "Estimasi Komisi (Rp)", align: "right" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Laporan Keuangan & Kinerja Bisnis
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Analisis omzet penjualan optik, pengeluaran, piutang DP, subsidi BPJS, dan komisi pegawai
          </p>
        </div>

        {/* Action Buttons: Scope Toggle & Export Options */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Scope Selector: All vs Commission Only */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setExportScope("all")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                exportScope === "all"
                  ? "bg-white text-blue-700 shadow-2xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Laporan Lengkap: Ringkasan Finansial, Penjualan Kategori & Komisi Pegawai"
            >
              Laporan Lengkap
            </button>
            <button
              type="button"
              onClick={() => setExportScope("commission")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                exportScope === "commission"
                  ? "bg-white text-blue-700 shadow-2xs font-bold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
              title="Laporan Terpisah: Khusus Perhitungan Komisi Pegawai & RO"
            >
              Khusus Komisi Pegawai
            </button>
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isLoading || isExportingExcel || isExportingCommExcel || !reportData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            title={
              exportScope === "commission"
                ? "Download file Excel khusus perhitungan komisi pegawai"
                : "Download laporan lengkap dalam format spreadsheet Microsoft Excel (.xlsx)"
            }
          >
            {isExportingExcel || isExportingCommExcel ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
            )}
            <span>{exportScope === "commission" ? "Excel Komisi" : "Export Excel"}</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isLoading || isExportingPdf || isExportingCommPdf || !reportData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
            title={
              exportScope === "commission"
                ? "Download dokumen PDF A4 khusus perhitungan komisi pegawai"
                : "Download dokumen resmi laporan keuangan lengkap dalam format PDF A4"
            }
          >
            {isExportingPdf || isExportingCommPdf ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <FileText className="w-4 h-4 shrink-0" />
            )}
            <span>{exportScope === "commission" ? "PDF Komisi" : "Export PDF"}</span>
          </button>

          {/* Print Clean Document Button */}
          <button
            type="button"
            onClick={handlePrintReport}
            disabled={isLoading || isPrintingDoc || isPrintingCommDoc || !reportData}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-700 border border-gray-200 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title={
              exportScope === "commission"
                ? "Cetak langsung dokumen resmi khusus komisi pegawai (bebas elemen navigasi)"
                : "Cetak langsung dokumen laporan resmi lengkap (bebas elemen navigasi)"
            }
          >
            {isPrintingDoc || isPrintingCommDoc ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-600 shrink-0" />
            ) : (
              <Printer className="w-4 h-4 text-gray-600 shrink-0" />
            )}
            <span>{exportScope === "commission" ? "Cetak Komisi" : "Cetak Dokumen"}</span>
          </button>
        </div>
      </div>

      {/* Period Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: "today", label: "Hari Ini" },
            { id: "this_week", label: "Minggu Ini" },
            { id: "this_month", label: "Bulan Ini" },
            { id: "this_year", label: "Tahun Ini" },
            { id: "custom", label: "Kustom Tanggal" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p.id
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === "custom" ? (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50"
            />
            <span className="text-gray-400 text-xs">s/d</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="px-2 py-1 text-xs border border-gray-200 rounded bg-gray-50"
            />
            <button
              type="button"
              onClick={fetchReport}
              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold"
            >
              Terapkan
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Periode data:{" "}
              <strong className="text-gray-800">
                {getPeriodLabel(period, dateStart, dateEnd)}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* 6 Core Financial KPI Cards (SRS Modul 6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Omzet Penjualan</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-gray-900">
              {formatRupiah(metrics.totalSales)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Dari {metrics.totalTransactions} transaksi nota
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Kas Keluar</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-red-600">
              {formatRupiah(metrics.totalExpenses)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Biaya operasional & pengadaan
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Laba Bersih Estimasi</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-xl font-extrabold ${metrics.netProfit >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {formatRupiah(metrics.netProfit)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Penjualan - HPP Bahan - Kas Keluar
            </div>
          </div>
        </div>

        {/* Receivables (Piutang DP) */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Sisa Piutang (DP)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-amber-700">
              {formatRupiah(metrics.totalReceivables)}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              Tertagih saat ambil kacamata
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics (BPJS, Cash In, Discounts) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
              Total Subsidi BPJS Kesehatan
            </span>
            <span className="text-lg font-extrabold text-emerald-900 mt-0.5 block">
              {formatRupiah(metrics.totalBpjsSubsidy)}
            </span>
            <span className="text-[10px] text-emerald-700">Klaim subsidi lensa & frame peserta</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
              Kas Diterima (Uang Masuk)
            </span>
            <span className="text-lg font-extrabold text-blue-900 mt-0.5 block">
              {formatRupiah(metrics.totalCollected)}
            </span>
            <span className="text-[10px] text-blue-700">Total DP + Pelunasan Tunai/Transfer</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-200 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block">
              HPP Modal Bahan & Lensa
            </span>
            <span className="text-lg font-extrabold text-indigo-900 mt-0.5 block">
              {formatRupiah(metrics.totalCogs)}
            </span>
            <span className="text-[10px] text-indigo-700">Harga pokok produk terjual</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Breakdown 1: Category Sales Table */}
      <div className="space-y-2">
        <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
          <PieChart className="w-4 h-4 text-blue-600" />
          Rincian Penjualan Berdasarkan Kategori Produk
        </h3>
        <Table
          headers={categoryHeaders}
          isLoading={isLoading}
          isEmpty={(reportData?.categorySales || []).length === 0}
          emptyMessage="Belum ada data penjualan pada periode ini."
        >
          {(reportData?.categorySales || []).map((cs, idx) => (
            <tr key={idx} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900">
                {cs.category}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap text-xs font-semibold text-gray-700">
                {cs.item_count} item
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-extrabold text-blue-900">
                {formatRupiah(cs.category_revenue)}
              </td>
            </tr>
          ))}
        </Table>
      </div>

      {/* Breakdown 2: Staff Commission Table (SRS Modul 6) */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Laporan Perhitungan Komisi Pegawai, Kasir & Refraksionis (RO)
            </h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Rincian komisi berdasarkan omzet nota penjualan dan skema insentif per pegawai
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportCommExcel}
              disabled={isLoading || isExportingCommExcel || !reportData}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Download Excel khusus laporan komisi pegawai"
            >
              {isExportingCommExcel ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Excel Komisi</span>
            </button>

            <button
              type="button"
              onClick={handleExportCommPdf}
              disabled={isLoading || isExportingCommPdf || !reportData}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Download dokumen PDF khusus laporan komisi pegawai"
            >
              {isExportingCommPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>PDF Komisi</span>
            </button>

            <button
              type="button"
              onClick={handlePrintCommReport}
              disabled={isLoading || isPrintingCommDoc || !reportData}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Cetak langsung dokumen resmi khusus komisi pegawai (bebas navigasi web)"
            >
              {isPrintingCommDoc ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              <span>Cetak Komisi Terpisah</span>
            </button>
          </div>
        </div>
        <Table
          headers={commissionHeaders}
          isLoading={isLoading}
          isEmpty={(reportData?.commissionReport || []).length === 0}
          emptyMessage="Tidak ada data komisi."
        >
          {(reportData?.commissionReport || []).map((cr) => (
            <tr key={cr.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-gray-900">
                {cr.name}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-gray-600">
                {cr.role}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap text-xs font-semibold text-gray-800">
                {cr.transaction_count} transaksi
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-medium text-gray-700">
                {formatRupiah(cr.total_handled_sales)}
              </td>
              <td className="px-4 py-3 text-center whitespace-nowrap text-xs text-gray-500">
                {cr.commission_type === "percentage" ? `${parseFloat(cr.commission_rate)}% Penjualan` : `${formatRupiah(cr.commission_rate)} / Order`}
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-xs font-extrabold text-emerald-700">
                {formatRupiah(cr.estimated_commission)}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
