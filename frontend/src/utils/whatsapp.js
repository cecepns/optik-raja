import toast from "react-hot-toast";
import { formatRupiah, formatDate, formatDateTime, formatDiopter } from "./formatters";

/**
 * Standardize phone number for WhatsApp wa.me links
 * e.g., "0812-3456-7890" -> "6281234567890"
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return "";
  let clean = String(phone).replace(/[^0-9]/g, "");
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  } else if (clean.startsWith("62")) {
    // already 62
  } else if (clean.length > 0) {
    clean = "62" + clean;
  }
  return clean;
}

/**
 * Open WhatsApp chat with prefilled text
 */
export function sendWhatsAppMessage(phone, message) {
  const waNumber = formatWhatsAppNumber(phone);
  if (!waNumber) {
    toast.error("Nomor WhatsApp/HP pelanggan tidak ditemukan!");
    return false;
  }

  const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
  toast.success("Membuka WhatsApp...");
  return true;
}

/**
 * Build professional WhatsApp message for Prescription (Rekam Medis)
 */
export function buildPrescriptionWhatsAppMessage(rx, settings = {}) {
  const storeName = settings.store_name || "Optik Raja";
  const storePhone = settings.phone || "";
  const storeAddress = settings.address || "";

  const lines = [
    `👓 *REKAM MEDIS & RESEP KACAMATA*`,
    `*${storeName.toUpperCase()}*`,
    `──────────────────────────`,
    `👤 *Nama Pasien:* ${rx.customer_name || "-"}`,
    `📅 *Tgl Periksa:* ${formatDate(rx.exam_date || rx.created_at)}`,
    `🩺 *Pemeriksa:* ${rx.examiner_name || "Refraksionis Optisien"}`,
    ``,
    `*HASIL PEMERIKSAAN REFRAKSI:*`,
    `👁️ *Mata Kanan (OD):*`,
    `• SPH: ${formatDiopter(rx.od_sph)}`,
    `• CYL: ${formatDiopter(rx.od_cyl)}`,
    `• AXIS: ${rx.od_axis !== undefined && rx.od_axis !== null ? `${rx.od_axis}°` : "-"}`,
    `• ADD: ${formatDiopter(rx.od_add)}`,
    `• MPD: ${rx.od_mpd ? `${rx.od_mpd} mm` : "-"}`,
    ``,
    `👁️ *Mata Kiri (OS):*`,
    `• SPH: ${formatDiopter(rx.os_sph)}`,
    `• CYL: ${formatDiopter(rx.os_cyl)}`,
    `• AXIS: ${rx.os_axis !== undefined && rx.os_axis !== null ? `${rx.os_axis}°` : "-"}`,
    `• ADD: ${formatDiopter(rx.os_add)}`,
    `• MPD: ${rx.os_mpd ? `${rx.os_mpd} mm` : "-"}`,
    ``,
    `📏 *Total PD:* ${rx.total_pd ? `${rx.total_pd} mm` : "-"}`,
  ];

  if (rx.complaint_diagnose) {
    lines.push(`📝 *Keluhan/Diagnosa:* ${rx.complaint_diagnose}`);
  }

  lines.push(
    `──────────────────────────`,
    `Simpan resep ini sebagai rujukan pemeriksaan atau pembuatan kacamata Anda.`
  );

  if (storeAddress) {
    lines.push(`📍 ${storeAddress}`);
  }
  if (storePhone) {
    lines.push(`📞 Kontak: ${storePhone}`);
  }
  lines.push(`Terima kasih atas kepercayaan Anda di *${storeName}*! 🙏`);

  return lines.join("\n");
}

/**
 * Build professional WhatsApp message for Transaction History (Riwayat Transaksi / Nota)
 */
export function buildTransactionWhatsAppMessage(trx, settings = {}) {
  const storeName = settings.store_name || "Optik Raja";
  const storePhone = settings.phone || "";
  const storeAddress = settings.address || "";
  const footerNote = settings.receipt_footer || "Garansi adaptasi lensa 30 hari.";

  const items = Array.isArray(trx.items) ? trx.items : [];
  const itemLines = items.map((item, idx) => {
    const qty = item.qty || 1;
    const price = formatRupiah(item.price || item.unit_price || 0);
    const subtotal = formatRupiah(item.subtotal || (item.qty * item.price) || 0);
    return `${idx + 1}. *${item.product_name || item.name || "Item"}*\n   ${qty} x ${price} = ${subtotal}`;
  });

  const isDp = trx.payment_status === "DP";

  const lines = [
    `🧾 *STRUK NOTA TRANSAKSI*`,
    `*${storeName.toUpperCase()}*`,
    `──────────────────────────`,
    `No. Nota : *${trx.invoice_number || "-"}*`,
    `Tanggal  : ${formatDateTime(trx.transaction_date || trx.created_at)}`,
    `Kasir    : ${trx.cashier_name || "-"}`,
    `Pelanggan: *${trx.customer_name || "Umum"}*`,
    `──────────────────────────`,
    `*DETAIL ITEM:*`,
    itemLines.length > 0 ? itemLines.join("\n") : "• Tidak ada item",
    `──────────────────────────`,
    `Subtotal     : ${formatRupiah(trx.subtotal || trx.total_amount)}`,
  ];

  if (Number(trx.discount_amount) > 0) {
    lines.push(`Diskon       : -${formatRupiah(trx.discount_amount)}`);
  }

  lines.push(
    `*TOTAL AKHIR* : *${formatRupiah(trx.total_amount)}*`,
    `Metode Bayar : ${trx.payment_method || "Tunai"}`,
    `Bayar/Uang   : ${formatRupiah(trx.paid_amount || 0)}`,
  );

  if (isDp) {
    lines.push(
      `Status Bayar : *UANG MUKA (DP)*`,
      `*Sisa Tagihan*: *${formatRupiah(trx.remaining_amount || 0)}*`
    );
  } else {
    lines.push(
      `Status Bayar : *LUNAS*`,
      `Kembalian    : ${formatRupiah(trx.change_amount || 0)}`
    );
  }

  lines.push(`──────────────────────────`);
  if (footerNote) {
    lines.push(`ℹ️ _${footerNote}_`);
  }
  if (storeAddress) {
    lines.push(`📍 ${storeAddress}`);
  }
  if (storePhone) {
    lines.push(`📞 Kontak: ${storePhone}`);
  }
  lines.push(`Terima kasih telah berbelanja di *${storeName}*! 🙏`);

  return lines.join("\n");
}
