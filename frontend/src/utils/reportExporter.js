import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatRupiah, formatDate, formatDateTime } from "./formatters.js";

/**
 * Helper to get clean Indonesian label for report period
 */
export function getPeriodLabel(period, dateStart, dateEnd) {
  const now = new Date();
  switch (period) {
    case "today":
      return `Hari Ini (${formatDate(now)})`;
    case "this_week":
      return `Minggu Ini (${formatDate(now)})`;
    case "this_month": {
      const monthYear = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(now);
      return `Bulan Ini (${monthYear})`;
    }
    case "this_year":
      return `Tahun ${now.getFullYear()}`;
    case "custom":
      if (dateStart && dateEnd) {
        return `${formatDate(dateStart)} s/d ${formatDate(dateEnd)}`;
      }
      return "Periode Kustom";
    default:
      return "Semua Periode";
  }
}

/**
 * Helper to create a sanitized filename
 */
function createFileName(prefix, period, extension) {
  const cleanPeriod = (period || "laporan").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStr = new Date().toISOString().slice(0, 10);
  return `${prefix}_${cleanPeriod}_${dateStr}.${extension}`;
}

/**
 * 1. EXPORT TO PDF
 * Generates an executive, official A4 PDF report with letterhead,
 * KPI summary tables, category sales, and employee commissions.
 */
export function exportReportToPdf(reportData, periodInfo, settings = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const storeName = settings.store_name || "Optik Raja Official";
  const permitNo = settings.optician_permit_no || "KEMENKES RI NO. 445/RO-OPT/JBR/2024";
  const address = settings.address || "Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara";
  const phone = settings.phone || "0812-9876-5432";

  const periodLabel = typeof periodInfo === "string" ? periodInfo : periodInfo?.label || "Periode Terpilih";
  const metrics = reportData?.metrics || {};
  const categorySales = reportData?.categorySales || [];
  const commissionReport = reportData?.commissionReport || [];
  const labStatus = reportData?.labStatus || {};

  // --- KOP SURAT / LETTERHEAD ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(storeName.toUpperCase(), margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Izin Optik (SIP): ${permitNo}`, margin, 23);
  doc.text(`Alamat: ${address}   |   Telp/WA: ${phone}`, margin, 27.5);

  // Decorative Horizontal Rules
  doc.setDrawColor(37, 99, 235); // blue-600
  doc.setLineWidth(0.6);
  doc.line(margin, 31, pageWidth - margin, 31);

  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.2);
  doc.line(margin, 32, pageWidth - margin, 32);

  // --- REPORT TITLE BANNER ---
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, 35.5, contentWidth, 13.5, 1.5, 1.5, "F");
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, 35.5, contentWidth, 13.5, 1.5, 1.5, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text("LAPORAN KEUANGAN & KINERJA BISNIS", margin + 4, 41);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Periode: ${periodLabel}     |     Waktu Dicetak: ${formatDateTime(new Date())}`,
    margin + 4,
    46
  );

  // --- SECTION 1: FINANCIAL METRICS SUMMARY ---
  const summaryRows = [
    [
      "Total Omzet Penjualan",
      formatRupiah(metrics.totalSales || 0),
      `Total dari ${metrics.totalTransactions || 0} transaksi nota`,
    ],
    [
      "Kas Diterima (Uang Masuk)",
      formatRupiah(metrics.totalCollected || 0),
      "Total DP + Pelunasan tunai/transfer",
    ],
    [
      "Sisa Piutang DP Pelanggan",
      formatRupiah(metrics.totalReceivables || 0),
      "Piutang tertagih saat pengambilan kacamata",
    ],
    [
      "Total Subsidi BPJS Kesehatan",
      formatRupiah(metrics.totalBpjsSubsidy || 0),
      "Klaim subsidi lensa & frame peserta BPJS",
    ],
    [
      "Total Diskon Penjualan",
      formatRupiah(metrics.totalDiscount || 0),
      "Potongan harga promosi & voucher",
    ],
    [
      "Total Beban Kas Keluar",
      formatRupiah(metrics.totalExpenses || 0),
      "Biaya operasional, listrik, sewa, gaji & pengadaan",
    ],
    [
      "HPP Modal Bahan & Lensa",
      formatRupiah(metrics.totalCogs || 0),
      "Harga pokok produk terjual & bahan baku",
    ],
    [
      "ESTIMASI LABA BERSIH",
      formatRupiah(metrics.netProfit || 0),
      "Omzet Penjualan - HPP Bahan - Kas Keluar",
    ],
  ];

  autoTable(doc, {
    startY: 52,
    margin: { left: margin, right: margin },
    head: [["Indikator Kinerja Keuangan", "Nilai (Rp / Qty)", "Keterangan"]],
    body: summaryRows,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold" },
      1: { cellWidth: 45, halign: "right", fontStyle: "bold" },
      2: { cellWidth: "auto", textColor: [100, 116, 139] },
    },
    didParseCell: (data) => {
      // Highlight Net Profit Row
      if (data.section === "body" && data.row.index === 7) {
        data.cell.styles.fillColor = [236, 253, 245]; // emerald-50
        if (data.column.index === 1) {
          data.cell.styles.textColor = [5, 150, 105]; // emerald-600
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  let currentY = doc.lastAutoTable.finalY + 8;

  // --- SECTION 2: CATEGORY SALES ---
  if (currentY + 38 > pageHeight - 25) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138);
  doc.text("RINCIAN PENJUALAN PER KATEGORI PRODUK", margin, currentY);

  const totalCatItems = categorySales.reduce((sum, c) => sum + parseInt(c.item_count || 0), 0);
  const totalCatRevenue = categorySales.reduce(
    (sum, c) => sum + parseFloat(c.category_revenue || 0),
    0
  );

  const categoryTableBody =
    categorySales.length > 0
      ? categorySales.map((cs, idx) => {
          const rev = parseFloat(cs.category_revenue || 0);
          const percent =
            totalCatRevenue > 0 ? ((rev / totalCatRevenue) * 100).toFixed(1) + "%" : "0.0%";
          return [
            String(idx + 1),
            cs.category || "-",
            `${cs.item_count} item`,
            formatRupiah(rev),
            percent,
          ];
        })
      : [["-", "Belum ada transaksi pada periode ini", "0 item", "Rp 0", "0%"]];

  const categoryTableFoot =
    categorySales.length > 0
      ? [
          [
            {
              content: "TOTAL KESELURUHAN",
              colSpan: 2,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: `${totalCatItems} item`,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: formatRupiah(totalCatRevenue),
              styles: { halign: "right", fontStyle: "bold" },
            },
            {
              content: "100.0%",
              styles: { halign: "center", fontStyle: "bold" },
            },
          ],
        ]
      : [];

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: margin, right: margin },
    head: [["No", "Kategori Produk", "Jumlah Terjual", "Total Omzet (Rp)", "Kontribusi (%)"]],
    body: categoryTableBody,
    foot: categoryTableFoot,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 60, fontStyle: "bold" },
      2: { cellWidth: 35, halign: "center" },
      3: { cellWidth: 45, halign: "right", fontStyle: "bold" },
      4: { cellWidth: "auto", halign: "center" },
    },
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // --- SECTION 3: EMPLOYEE COMMISSION REPORT ---
  if (currentY + 40 > pageHeight - 25) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138);
  doc.text("LAPORAN PERHITUNGAN KOMISI PEGAWAI & RO", margin, currentY);

  const totalCommTrx = commissionReport.reduce(
    (sum, c) => sum + parseInt(c.transaction_count || 0),
    0
  );
  const totalCommSales = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.total_handled_sales || 0),
    0
  );
  const totalCommEst = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.estimated_commission || 0),
    0
  );

  const commTableBody =
    commissionReport.length > 0
      ? commissionReport.map((cr, idx) => {
          const rateLabel =
            cr.commission_type === "percentage"
              ? `${parseFloat(cr.commission_rate)}% Penjualan`
              : `${formatRupiah(cr.commission_rate)} / Order`;
          return [
            String(idx + 1),
            cr.name || "-",
            cr.role || "-",
            `${cr.transaction_count || 0} trx`,
            formatRupiah(cr.total_handled_sales || 0),
            rateLabel,
            formatRupiah(cr.estimated_commission || 0),
          ];
        })
      : [["-", "Tidak ada data komisi pada periode ini", "-", "-", "-", "-", "-"]];

  const commTableFoot =
    commissionReport.length > 0
      ? [
          [
            {
              content: "TOTAL KESELURUHAN",
              colSpan: 3,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: `${totalCommTrx} trx`,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: formatRupiah(totalCommSales),
              styles: { halign: "right", fontStyle: "bold" },
            },
            {
              content: "-",
              styles: { halign: "center" },
            },
            {
              content: formatRupiah(totalCommEst),
              styles: { halign: "right", fontStyle: "bold" },
            },
          ],
        ]
      : [];

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: margin, right: margin },
    head: [
      [
        "No",
        "Nama Pegawai",
        "Role / Jabatan",
        "Trx Dilayani",
        "Total Penjualan",
        "Skema Komisi",
        "Estimasi Komisi",
      ],
    ],
    body: commTableBody,
    foot: commTableFoot,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: 26, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 24, halign: "center", fontSize: 7.5 },
      6: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
    },
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // --- SECTION 4: SIGNATURE BLOCK ---
  if (currentY + 35 > pageHeight - 20) {
    doc.addPage();
    currentY = 25;
  }

  const signX = pageWidth - margin - 60;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dicetak pada: ${formatDate(new Date())}`, signX, currentY);
  doc.text("Penanggung Jawab Optik,", signX, currentY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`( ${storeName} )`, signX, currentY + 24);

  // --- PAGE NUMBERING & FOOTER ON ALL PAGES ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Halaman ${i} dari ${totalPages}   |   ${storeName} POS & Lab System   |   Dokumen Resmi`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  const fileName = createFileName("Laporan_Keuangan_Optik_Raja", periodLabel, "pdf");
  doc.save(fileName);
  return fileName;
}

/**
 * 2. EXPORT TO EXCEL (.xlsx)
 * Creates a clean multi-sheet workbook:
 *  - Sheet 1: Ringkasan Finansial & KPI
 *  - Sheet 2: Penjualan per Kategori Produk
 *  - Sheet 3: Laporan Komisi Pegawai & RO
 */
export function exportReportToExcel(reportData, periodInfo, settings = {}) {
  const wb = XLSX.utils.book_new();

  const storeName = settings.store_name || "Optik Raja Official";
  const periodLabel = typeof periodInfo === "string" ? periodInfo : periodInfo?.label || "Periode Terpilih";
  const metrics = reportData?.metrics || {};
  const categorySales = reportData?.categorySales || [];
  const commissionReport = reportData?.commissionReport || [];
  const labStatus = reportData?.labStatus || {};

  // --- SHEET 1: RINGKASAN FINANSIAL ---
  const sheet1Data = [
    [storeName.toUpperCase()],
    ["LAPORAN KEUANGAN & KINERJA BISNIS"],
    [`Periode: ${periodLabel}`],
    [`Waktu Export: ${formatDateTime(new Date())}`],
    [],
    ["No", "Indikator Kinerja Keuangan", "Nilai (Rp / Qty)", "Keterangan"],
    [1, "Total Omzet Penjualan", metrics.totalSales || 0, `Dari ${metrics.totalTransactions || 0} transaksi nota`],
    [2, "Jumlah Transaksi Nota", metrics.totalTransactions || 0, "Transaksi lunas & DP"],
    [3, "Kas Diterima (Uang Masuk)", metrics.totalCollected || 0, "Total DP + Pelunasan tunai/transfer"],
    [4, "Sisa Piutang DP Pelanggan", metrics.totalReceivables || 0, "Piutang tertagih saat ambil kacamata"],
    [5, "Total Subsidi BPJS Kesehatan", metrics.totalBpjsSubsidy || 0, "Klaim subsidi lensa & frame"],
    [6, "Total Diskon Penjualan", metrics.totalDiscount || 0, "Potongan harga transaksi"],
    [7, "Total Beban Kas Keluar", metrics.totalExpenses || 0, "Biaya operasional & pengadaan"],
    [8, "HPP Modal Bahan & Lensa", metrics.totalCogs || 0, "Harga pokok barang terjual"],
    [9, "ESTIMASI LABA BERSIH", metrics.netProfit || 0, "Penjualan - HPP Bahan - Kas Keluar"],
    [],
    ["RINGKASAN STATUS LABORATORIUM (ANTREAN LENSA)"],
    ["Status Antrean", "Jumlah Pesanan", "Keterangan"],
    ["Total Pesanan Lab Aktif", labStatus.totalActive || 0, "Belum diserahkan ke pelanggan"],
    ["Sedang Dikerjakan di Lab", labStatus.inProcess || 0, "Proses faset, potong & pasang lensa"],
    ["Siap Diambil Pasien", labStatus.readyForPickup || 0, "Kacamata telah selesai dan lulus QC"],
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1["!cols"] = [{ wch: 6 }, { wch: 34 }, { wch: 22 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan Finansial");

  // --- SHEET 2: PENJUALAN PER KATEGORI ---
  const totalCatItems = categorySales.reduce((sum, c) => sum + parseInt(c.item_count || 0), 0);
  const totalCatRevenue = categorySales.reduce(
    (sum, c) => sum + parseFloat(c.category_revenue || 0),
    0
  );

  const sheet2Data = [
    [storeName.toUpperCase()],
    ["RINCIAN PENJUALAN BERDASARKAN KATEGORI PRODUK"],
    [`Periode: ${periodLabel}`],
    [],
    ["No", "Kategori Produk", "Jumlah Item Terjual", "Total Omzet (Rp)", "Kontribusi (%)"],
  ];

  if (categorySales.length > 0) {
    categorySales.forEach((cs, idx) => {
      const rev = parseFloat(cs.category_revenue || 0);
      const percent =
        totalCatRevenue > 0 ? ((rev / totalCatRevenue) * 100).toFixed(1) + "%" : "0.0%";
      sheet2Data.push([idx + 1, cs.category || "-", cs.item_count || 0, rev, percent]);
    });
    sheet2Data.push(["TOTAL", "", totalCatItems, totalCatRevenue, "100.0%"]);
  } else {
    sheet2Data.push(["-", "Belum ada transaksi pada periode ini", 0, 0, "0%"]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
  ws2["!cols"] = [{ wch: 6 }, { wch: 26 }, { wch: 20 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Penjualan Kategori");

  // --- SHEET 3: KOMISI PEGAWAI & RO ---
  const totalCommTrx = commissionReport.reduce(
    (sum, c) => sum + parseInt(c.transaction_count || 0),
    0
  );
  const totalCommSales = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.total_handled_sales || 0),
    0
  );
  const totalCommEst = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.estimated_commission || 0),
    0
  );

  const sheet3Data = [
    [storeName.toUpperCase()],
    ["LAPORAN KOMISI PEGAWAI, KASIR & REFRAKSIONIS (RO)"],
    [`Periode: ${periodLabel}`],
    [],
    [
      "No",
      "Nama Pegawai",
      "Role / Jabatan",
      "Jumlah Transaksi Dilayani",
      "Total Nilai Penjualan (Rp)",
      "Skema Komisi",
      "Estimasi Komisi (Rp)",
    ],
  ];

  if (commissionReport.length > 0) {
    commissionReport.forEach((cr, idx) => {
      const rateLabel =
        cr.commission_type === "percentage"
          ? `${parseFloat(cr.commission_rate)}% Penjualan`
          : `${formatRupiah(cr.commission_rate)} / Order`;
      sheet3Data.push([
        idx + 1,
        cr.name || "-",
        cr.role || "-",
        cr.transaction_count || 0,
        parseFloat(cr.total_handled_sales || 0),
        rateLabel,
        parseFloat(cr.estimated_commission || 0),
      ]);
    });
    sheet3Data.push([
      "TOTAL",
      "",
      "",
      totalCommTrx,
      totalCommSales,
      "",
      totalCommEst,
    ]);
  } else {
    sheet3Data.push(["-", "Tidak ada data komisi pada periode ini", "-", 0, 0, "-", 0]);
  }

  const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
  ws3["!cols"] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 18 },
    { wch: 24 },
    { wch: 26 },
    { wch: 20 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws3, "Komisi Pegawai");

  const fileName = createFileName("Laporan_Keuangan_Optik_Raja", periodLabel, "xlsx");
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * 3. PRINT REPORT DOCUMENT
 * Renders an isolated, clean official A4 printable HTML document
 * via a hidden iframe. Guarantees that the browser print dialog
 * prints ONLY the official document without any navbar, sidebar,
 * or application buttons.
 */
export function printReportDocument(reportData, periodInfo, settings = {}) {
  const storeName = settings.store_name || "Optik Raja Official";
  const permitNo = settings.optician_permit_no || "KEMENKES RI NO. 445/RO-OPT/JBR/2024";
  const address = settings.address || "Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara";
  const phone = settings.phone || "0812-9876-5432";

  const periodLabel = typeof periodInfo === "string" ? periodInfo : periodInfo?.label || "Periode Terpilih";
  const metrics = reportData?.metrics || {};
  const categorySales = reportData?.categorySales || [];
  const commissionReport = reportData?.commissionReport || [];

  const totalCatItems = categorySales.reduce((sum, c) => sum + parseInt(c.item_count || 0), 0);
  const totalCatRevenue = categorySales.reduce(
    (sum, c) => sum + parseFloat(c.category_revenue || 0),
    0
  );

  const totalCommTrx = commissionReport.reduce(
    (sum, c) => sum + parseInt(c.transaction_count || 0),
    0
  );
  const totalCommSales = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.total_handled_sales || 0),
    0
  );
  const totalCommEst = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.estimated_commission || 0),
    0
  );

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
    <html>
      <head>
        <meta charset="utf-8">
        <title>Laporan Keuangan - ${storeName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 14mm 16mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #fff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .store-name {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: -0.3px;
          }
          .store-meta {
            font-size: 10px;
            color: #475569;
            margin-top: 2px;
          }
          .report-banner {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .report-title {
            font-size: 13px;
            font-weight: 800;
            color: #1e3a8a;
          }
          .report-meta {
            font-size: 10px;
            color: #64748b;
          }
          .section-title {
            font-size: 11px;
            font-weight: 800;
            color: #1e3a8a;
            margin-top: 14px;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 700;
            text-align: left;
            padding: 6px 8px;
            font-size: 10px;
            border: 1px solid #1e3a8a;
          }
          td {
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            font-size: 10px;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .highlight-row td {
            background-color: #ecfdf5 !important;
            font-weight: bold;
            color: #065f46;
          }
          .total-row td {
            background-color: #f1f5f9 !important;
            font-weight: 800;
            color: #0f172a;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          .signature-box {
            margin-top: 24px;
            float: right;
            text-align: right;
            width: 220px;
            page-break-inside: avoid;
          }
          .signature-space {
            height: 45px;
          }
          .footer-note {
            margin-top: 40px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
            font-size: 9px;
            color: #94a3b8;
            text-align: center;
            clear: both;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">${storeName}</div>
          <div class="store-meta">SIP: ${permitNo}</div>
          <div class="store-meta">${address} | Telp: ${phone}</div>
        </div>

        <div class="report-banner">
          <div>
            <div class="report-title">LAPORAN KEUANGAN & KINERJA BISNIS</div>
            <div class="report-meta">Periode: <strong>${periodLabel}</strong></div>
          </div>
          <div class="text-right report-meta">
            <div>Dicetak: ${formatDateTime(new Date())}</div>
            <div>Sistem POS & Lab Optik Raja</div>
          </div>
        </div>

        <div class="section-title">1. Ringkasan Indikator Keuangan</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35%;">Indikator Keuangan</th>
              <th style="width: 25%; text-align: right;">Nilai (Rp / Qty)</th>
              <th style="width: 40%;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-bold">Total Omzet Penjualan</td>
              <td class="text-right font-bold">${formatRupiah(metrics.totalSales || 0)}</td>
              <td>Dari ${metrics.totalTransactions || 0} transaksi nota</td>
            </tr>
            <tr>
              <td class="font-bold">Kas Diterima (Uang Masuk)</td>
              <td class="text-right font-bold">${formatRupiah(metrics.totalCollected || 0)}</td>
              <td>Total DP + Pelunasan tunai/transfer</td>
            </tr>
            <tr>
              <td class="font-bold">Sisa Piutang DP Pelanggan</td>
              <td class="text-right font-bold" style="color: #b45309;">${formatRupiah(metrics.totalReceivables || 0)}</td>
              <td>Piutang tertagih saat pengambilan kacamata</td>
            </tr>
            <tr>
              <td class="font-bold">Total Subsidi BPJS Kesehatan</td>
              <td class="text-right font-bold" style="color: #047857;">${formatRupiah(metrics.totalBpjsSubsidy || 0)}</td>
              <td>Klaim subsidi lensa & frame peserta BPJS</td>
            </tr>
            <tr>
              <td class="font-bold">Total Diskon Penjualan</td>
              <td class="text-right font-bold">${formatRupiah(metrics.totalDiscount || 0)}</td>
              <td>Potongan harga promosi / voucher</td>
            </tr>
            <tr>
              <td class="font-bold">Total Beban Kas Keluar</td>
              <td class="text-right font-bold" style="color: #b91c1c;">${formatRupiah(metrics.totalExpenses || 0)}</td>
              <td>Biaya operasional, pengadaan & beban usaha</td>
            </tr>
            <tr>
              <td class="font-bold">HPP Modal Bahan & Lensa</td>
              <td class="text-right font-bold">${formatRupiah(metrics.totalCogs || 0)}</td>
              <td>Harga pokok produk & bahan terpakai</td>
            </tr>
            <tr class="highlight-row">
              <td class="font-bold">ESTIMASI LABA BERSIH</td>
              <td class="text-right font-bold" style="font-size: 11px;">${formatRupiah(metrics.netProfit || 0)}</td>
              <td>Omzet Penjualan - HPP Bahan - Kas Keluar</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">2. Penjualan Berdasarkan Kategori Produk</div>
        <table>
          <thead>
            <tr>
              <th style="width: 8%; text-align: center;">No</th>
              <th style="width: 40%;">Kategori Produk</th>
              <th style="width: 18%; text-align: center;">Item Terjual</th>
              <th style="width: 22%; text-align: right;">Total Omzet (Rp)</th>
              <th style="width: 12%; text-align: center;">Kontribusi</th>
            </tr>
          </thead>
          <tbody>
            ${
              categorySales.length > 0
                ? categorySales
                    .map((cs, idx) => {
                      const rev = parseFloat(cs.category_revenue || 0);
                      const pct =
                        totalCatRevenue > 0
                          ? ((rev / totalCatRevenue) * 100).toFixed(1) + "%"
                          : "0.0%";
                      return `
                        <tr>
                          <td class="text-center">${idx + 1}</td>
                          <td class="font-bold">${cs.category || "-"}</td>
                          <td class="text-center">${cs.item_count} item</td>
                          <td class="text-right font-bold">${formatRupiah(rev)}</td>
                          <td class="text-center">${pct}</td>
                        </tr>
                      `;
                    })
                    .join("")
                : '<tr><td colspan="5" class="text-center">Belum ada data penjualan pada periode ini.</td></tr>'
            }
            ${
              categorySales.length > 0
                ? `
                <tr class="total-row">
                  <td colspan="2" class="text-center">TOTAL</td>
                  <td class="text-center">${totalCatItems} item</td>
                  <td class="text-right">${formatRupiah(totalCatRevenue)}</td>
                  <td class="text-center">100.0%</td>
                </tr>
              `
                : ""
            }
          </tbody>
        </table>

        <div class="section-title">3. Laporan Komisi Pegawai & Refraksionis (RO)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">No</th>
              <th style="width: 25%;">Nama Pegawai</th>
              <th style="width: 15%; text-align: center;">Role</th>
              <th style="width: 12%; text-align: center;">Trx</th>
              <th style="width: 18%; text-align: right;">Total Penjualan</th>
              <th style="width: 12%; text-align: center;">Skema</th>
              <th style="width: 12%; text-align: right;">Komisi (Rp)</th>
            </tr>
          </thead>
          <tbody>
            ${
              commissionReport.length > 0
                ? commissionReport
                    .map((cr, idx) => {
                      const rateLabel =
                        cr.commission_type === "percentage"
                          ? `${parseFloat(cr.commission_rate)}%`
                          : `${formatRupiah(cr.commission_rate)}`;
                      return `
                        <tr>
                          <td class="text-center">${idx + 1}</td>
                          <td class="font-bold">${cr.name || "-"}</td>
                          <td class="text-center">${cr.role || "-"}</td>
                          <td class="text-center">${cr.transaction_count || 0}</td>
                          <td class="text-right">${formatRupiah(cr.total_handled_sales || 0)}</td>
                          <td class="text-center">${rateLabel}</td>
                          <td class="text-right font-bold" style="color: #047857;">${formatRupiah(cr.estimated_commission || 0)}</td>
                        </tr>
                      `;
                    })
                    .join("")
                : '<tr><td colspan="7" class="text-center">Tidak ada data komisi pada periode ini.</td></tr>'
            }
            ${
              commissionReport.length > 0
                ? `
                <tr class="total-row">
                  <td colspan="3" class="text-center">TOTAL</td>
                  <td class="text-center">${totalCommTrx} trx</td>
                  <td class="text-right">${formatRupiah(totalCommSales)}</td>
                  <td></td>
                  <td class="text-right font-bold" style="color: #047857;">${formatRupiah(totalCommEst)}</td>
                </tr>
              `
                : ""
            }
          </tbody>
        </table>

        <div class="signature-box">
          <div>${formatDate(new Date())}</div>
          <div>Penanggung Jawab Optik,</div>
          <div class="signature-space"></div>
          <div class="font-bold">( ${storeName} )</div>
        </div>

        <div class="footer-note">
          Dokumen ini dicetak otomatis dari Sistem Optik Raja POS. Informasi bersifat rahasia dan untuk kepentingan manajemen internal optik.
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
        console.error("Iframe print error:", err);
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

/**
 * 4. EXPORT COMMISSION REPORT TO PDF (TERPISAH)
 * Generates an executive, official A4 PDF report dedicated specifically
 * to Employee and RO Commission Calculations.
 */
export function exportCommissionReportToPdf(reportData, periodInfo, settings = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const storeName = settings.store_name || "Optik Raja Official";
  const permitNo = settings.optician_permit_no || "KEMENKES RI NO. 445/RO-OPT/JBR/2024";
  const address = settings.address || "Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara";
  const phone = settings.phone || "0812-9876-5432";

  const periodLabel = typeof periodInfo === "string" ? periodInfo : periodInfo?.label || "Periode Terpilih";
  const commissionReport = reportData?.commissionReport || [];

  // --- KOP SURAT / LETTERHEAD ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(storeName.toUpperCase(), margin, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`Izin Optik (SIP): ${permitNo}`, margin, 23);
  doc.text(`Alamat: ${address}   |   Telp/WA: ${phone}`, margin, 27.5);

  // Decorative Horizontal Rules
  doc.setDrawColor(37, 99, 235); // blue-600
  doc.setLineWidth(0.6);
  doc.line(margin, 31, pageWidth - margin, 31);

  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.2);
  doc.line(margin, 32, pageWidth - margin, 32);

  // --- REPORT TITLE BANNER ---
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, 35.5, contentWidth, 13.5, 1.5, 1.5, "F");
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, 35.5, contentWidth, 13.5, 1.5, 1.5, "D");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text("LAPORAN KOMISI PEGAWAI & REFRAKSIONIS (RO)", margin + 4, 41);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    `Periode: ${periodLabel}     |     Waktu Dicetak: ${formatDateTime(new Date())}`,
    margin + 4,
    46
  );

  let currentY = 54;

  // Calculate totals
  const totalCommTrx = commissionReport.reduce(
    (sum, c) => sum + parseInt(c.transaction_count || 0),
    0
  );
  const totalCommSales = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.total_handled_sales || 0),
    0
  );
  const totalCommEst = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.estimated_commission || 0),
    0
  );
  const totalEmployees = commissionReport.length;

  // --- SUMMARY KPI BOXES FOR COMMISSIONS ---
  const boxWidth = (contentWidth - 6) / 3;
  const boxHeight = 16;

  // Box 1: Total Transaksi Dilayani
  doc.setFillColor(239, 246, 255); // blue-50
  doc.setDrawColor(191, 219, 254); // blue-200
  doc.roundedRect(margin, currentY, boxWidth, boxHeight, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 64, 175);
  doc.text("TOTAL TRANSAKSI DILAYANI", margin + 3, currentY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text(`${totalCommTrx} Transaksi`, margin + 3, currentY + 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${totalEmployees} pegawai aktif terdata`, margin + 3, currentY + 14.5);

  // Box 2: Total Penjualan Ditangani
  const box2X = margin + boxWidth + 3;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(box2X, currentY, boxWidth, boxHeight, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("TOTAL PENJUALAN DITANGANI", box2X + 3, currentY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(formatRupiah(totalCommSales), box2X + 3, currentY + 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Akumulasi omzet yang dilayani", box2X + 3, currentY + 14.5);

  // Box 3: Total Komisi Dibayarkan
  const box3X = box2X + boxWidth + 3;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(167, 243, 208); // emerald-200
  doc.roundedRect(box3X, currentY, boxWidth, boxHeight, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text("TOTAL ESTIMASI KOMISI", box3X + 3, currentY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text(formatRupiah(totalCommEst), box3X + 3, currentY + 11.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(5, 150, 105);
  doc.text("Hak komisi yang siap dicairkan", box3X + 3, currentY + 14.5);

  currentY += boxHeight + 8;

  // --- DETAILED TABLE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Rincian Perhitungan Komisi Per Pegawai & RO", margin, currentY);

  const commTableBody =
    commissionReport.length > 0
      ? commissionReport.map((cr, idx) => {
          const rateLabel =
            cr.commission_type === "percentage"
              ? `${parseFloat(cr.commission_rate)}% Penjualan`
              : `${formatRupiah(cr.commission_rate)} / Order`;
          return [
            idx + 1,
            cr.name || "-",
            cr.role || "-",
            `${cr.transaction_count || 0} trx`,
            formatRupiah(cr.total_handled_sales || 0),
            rateLabel,
            formatRupiah(cr.estimated_commission || 0),
          ];
        })
      : [
          [
            {
              content: "Tidak ada data transaksi komisi pada periode ini.",
              colSpan: 7,
              styles: { halign: "center", textColor: [148, 163, 184] },
            },
          ],
        ];

  const commTableFoot =
    commissionReport.length > 0
      ? [
          [
            {
              content: "TOTAL KESELURUHAN",
              colSpan: 3,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: `${totalCommTrx} trx`,
              styles: { halign: "center", fontStyle: "bold" },
            },
            {
              content: formatRupiah(totalCommSales),
              styles: { halign: "right", fontStyle: "bold" },
            },
            {
              content: "-",
              styles: { halign: "center" },
            },
            {
              content: formatRupiah(totalCommEst),
              styles: { halign: "right", fontStyle: "bold", textColor: [4, 120, 87] },
            },
          ],
        ]
      : [];

  autoTable(doc, {
    startY: currentY + 3,
    margin: { left: margin, right: margin },
    head: [
      [
        "No",
        "Nama Pegawai",
        "Role / Posisi",
        "Trx Dilayani",
        "Total Penjualan",
        "Skema Komisi",
        "Estimasi Komisi",
      ],
    ],
    body: commTableBody,
    foot: commTableFoot,
    theme: "grid",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8.5,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 42, fontStyle: "bold" },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 32, halign: "right" },
      5: { cellWidth: 24, halign: "center", fontSize: 7.5 },
      6: { cellWidth: "auto", halign: "right", fontStyle: "bold", textColor: [4, 120, 87] },
    },
  });

  currentY = doc.lastAutoTable.finalY + 14;

  // --- SECTION: SIGNATURE BLOCK ---
  if (currentY + 35 > pageHeight - 20) {
    doc.addPage();
    currentY = 25;
  }

  const signX = pageWidth - margin - 65;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dicetak pada: ${formatDate(new Date())}`, signX, currentY);
  doc.text("Penanggung Jawab Optik,", signX, currentY + 4.5);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`( ${storeName} )`, signX, currentY + 24);

  // Page numbering and footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Halaman ${i} dari ${totalPages}   |   ${storeName} POS & Management System   |   Laporan Komisi Pegawai`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  const fileName = createFileName("Laporan_Komisi_Pegawai", periodLabel, "pdf");
  doc.save(fileName);
  return fileName;
}

/**
 * 5. EXPORT COMMISSION REPORT TO EXCEL (TERPISAH)
 * Creates a focused single-sheet Excel workbook for staff commissions.
 */
export function exportCommissionReportToExcel(reportData, periodInfo, settings = {}) {
  const wb = XLSX.utils.book_new();

  const storeName = settings.store_name || "Optik Raja Official";
  const periodLabel = typeof periodInfo === "string" ? periodInfo : periodInfo?.label || "Periode Terpilih";
  const commissionReport = reportData?.commissionReport || [];

  const totalCommTrx = commissionReport.reduce(
    (sum, c) => sum + parseInt(c.transaction_count || 0),
    0
  );
  const totalCommSales = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.total_handled_sales || 0),
    0
  );
  const totalCommEst = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.estimated_commission || 0),
    0
  );

  const sheetData = [
    [storeName.toUpperCase()],
    ["LAPORAN KOMISI PEGAWAI, KASIR & REFRAKSIONIS (RO)"],
    [`Periode: ${periodLabel}`],
    [`Waktu Export: ${formatDateTime(new Date())}`],
    [],
    ["RINGKASAN TOTAL KOMISI"],
    ["Total Pegawai Terdata", commissionReport.length, "Orang"],
    ["Total Transaksi Dilayani", totalCommTrx, "Transaksi"],
    ["Total Penjualan Ditangani", totalCommSales, "Rupiah"],
    ["Total Estimasi Komisi", totalCommEst, "Rupiah"],
    [],
    [
      "No",
      "Nama Pegawai",
      "Role / Jabatan",
      "Jumlah Transaksi Dilayani",
      "Total Nilai Penjualan (Rp)",
      "Skema Komisi",
      "Estimasi Komisi (Rp)",
    ],
  ];

  if (commissionReport.length > 0) {
    commissionReport.forEach((cr, idx) => {
      const rateLabel =
        cr.commission_type === "percentage"
          ? `${parseFloat(cr.commission_rate)}% Penjualan`
          : `${formatRupiah(cr.commission_rate)} / Order`;
      sheetData.push([
        idx + 1,
        cr.name || "-",
        cr.role || "-",
        cr.transaction_count || 0,
        parseFloat(cr.total_handled_sales || 0),
        rateLabel,
        parseFloat(cr.estimated_commission || 0),
      ]);
    });
    sheetData.push([
      "TOTAL",
      "",
      "",
      totalCommTrx,
      totalCommSales,
      "",
      totalCommEst,
    ]);
  } else {
    sheetData.push(["-", "Tidak ada data komisi pada periode ini", "-", 0, 0, "-", 0]);
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 20 },
    { wch: 24 },
    { wch: 26 },
    { wch: 22 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Komisi Pegawai");

  const fileName = createFileName("Laporan_Komisi_Pegawai", periodLabel, "xlsx");
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * 6. PRINT COMMISSION REPORT DOCUMENT (TERPISAH)
 * Renders an isolated, clean official printable document for employee commissions.
 */
export function printCommissionReportDocument(reportData, periodInfo, settings = {}) {
  const storeName = settings.store_name || "Optik Raja Official";
  const permitNo = settings.optician_permit_no || "KEMENKES RI NO. 445/RO-OPT/JBR/2024";
  const address = settings.address || "Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara";
  const phone = settings.phone || "0812-9876-5432";

  const periodLabel = typeof periodInfo === "string" ? periodInfo : periodInfo?.label || "Periode Terpilih";
  const commissionReport = reportData?.commissionReport || [];

  const totalCommTrx = commissionReport.reduce(
    (sum, c) => sum + parseInt(c.transaction_count || 0),
    0
  );
  const totalCommSales = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.total_handled_sales || 0),
    0
  );
  const totalCommEst = commissionReport.reduce(
    (sum, c) => sum + parseFloat(c.estimated_commission || 0),
    0
  );

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
        <title>Laporan Komisi Pegawai - ${storeName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 14mm;
          }
          * {
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.4;
          }
          .letterhead {
            border-bottom: 2px solid #2563eb;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }
          .store-name {
            font-size: 18px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .store-meta {
            font-size: 9.5px;
            color: #475569;
            margin-top: 3px;
          }
          .report-banner {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 14px;
          }
          .report-title {
            font-size: 13px;
            font-weight: 800;
            color: #1e3a8a;
          }
          .report-subtitle {
            font-size: 9.5px;
            color: #64748b;
            margin-top: 2px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            margin-bottom: 14px;
          }
          .kpi-card {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px 10px;
            background: #f8fafc;
          }
          .kpi-card.highlight {
            background: #ecfdf5;
            border-color: #a7f3d0;
          }
          .kpi-label {
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
          }
          .kpi-card.highlight .kpi-label {
            color: #047857;
          }
          .kpi-value {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          .kpi-card.highlight .kpi-value {
            color: #065f46;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 10px;
          }
          th {
            background-color: #1e3a8a;
            color: #ffffff;
            font-weight: 700;
            padding: 6px 8px;
            border: 1px solid #1e3a8a;
            text-align: left;
          }
          td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            color: #1e293b;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .total-row td {
            background-color: #f1f5f9 !important;
            font-weight: 800;
            color: #0f172a;
            border-top: 2px solid #cbd5e1;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .signature-box {
            margin-top: 24px;
            float: right;
            width: 220px;
            text-align: center;
          }
          .signature-space {
            height: 60px;
          }
          .footer-note {
            clear: both;
            margin-top: 40px;
            padding-top: 8px;
            border-top: 1px dashed #cbd5e1;
            font-size: 8.5px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="letterhead">
          <div class="store-name">${storeName.toUpperCase()}</div>
          <div class="store-meta">Izin Optik (SIP): ${permitNo}</div>
          <div class="store-meta">Alamat: ${address} | Telp/WA: ${phone}</div>
        </div>

        <div class="report-banner">
          <div class="report-title">LAPORAN KOMISI PEGAWAI & REFRAKSIONIS (RO)</div>
          <div class="report-subtitle">Periode: ${periodLabel} | Waktu Dicetak: ${formatDateTime(new Date())}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Transaksi Dilayani</div>
            <div class="kpi-value">${totalCommTrx} Trx</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">${commissionReport.length} pegawai aktif</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Nilai Penjualan</div>
            <div class="kpi-value">${formatRupiah(totalCommSales)}</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Total omzet ditangani</div>
          </div>
          <div class="kpi-card highlight">
            <div class="kpi-label">Total Estimasi Komisi</div>
            <div class="kpi-value">${formatRupiah(totalCommEst)}</div>
            <div style="font-size: 8px; color: #059669; margin-top: 2px;">Total hak komisi staf</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">No</th>
              <th style="width: 24%;">Nama Pegawai</th>
              <th style="width: 16%; text-align: center;">Role / Posisi</th>
              <th style="width: 12%; text-align: center;">Trx Dilayani</th>
              <th style="width: 16%; text-align: right;">Total Penjualan</th>
              <th style="width: 13%; text-align: center;">Skema Komisi</th>
              <th style="width: 13%; text-align: right;">Estimasi Komisi</th>
            </tr>
          </thead>
          <tbody>
            ${
              commissionReport.length > 0
                ? commissionReport
                    .map((cr, idx) => {
                      const rateLabel =
                        cr.commission_type === "percentage"
                          ? `${parseFloat(cr.commission_rate)}%`
                          : `${formatRupiah(cr.commission_rate)}`;
                      return `
                        <tr>
                          <td class="text-center">${idx + 1}</td>
                          <td class="font-bold">${cr.name || "-"}</td>
                          <td class="text-center">${cr.role || "-"}</td>
                          <td class="text-center">${cr.transaction_count || 0} trx</td>
                          <td class="text-right">${formatRupiah(cr.total_handled_sales || 0)}</td>
                          <td class="text-center">${rateLabel}</td>
                          <td class="text-right font-bold" style="color: #047857;">${formatRupiah(cr.estimated_commission || 0)}</td>
                        </tr>
                      `;
                    })
                    .join("")
                : '<tr><td colspan="7" class="text-center">Tidak ada data komisi pada periode ini.</td></tr>'
            }
            ${
              commissionReport.length > 0
                ? `
                <tr class="total-row">
                  <td colspan="3" class="text-center">TOTAL KESELURUHAN</td>
                  <td class="text-center">${totalCommTrx} trx</td>
                  <td class="text-right">${formatRupiah(totalCommSales)}</td>
                  <td></td>
                  <td class="text-right font-bold" style="color: #047857;">${formatRupiah(totalCommEst)}</td>
                </tr>
              `
                : ""
            }
          </tbody>
        </table>

        <div class="signature-box">
          <div>${formatDate(new Date())}</div>
          <div>Penanggung Jawab Optik,</div>
          <div class="signature-space"></div>
          <div class="font-bold">( ${storeName} )</div>
        </div>

        <div class="footer-note">
          Dokumen ini dicetak otomatis dari Sistem Optik Raja POS. Informasi bersifat rahasia dan untuk kepentingan manajemen internal optik.
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
        console.error("Iframe print error:", err);
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
