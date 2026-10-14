import { jsPDF } from "jspdf";
import { formatRupiah, formatDateTime, formatDate } from "./formatters";

/**
 * 1. Print Standard via Isolated Invisible Iframe
 * Guarantees zero blank-page bugs across all browsers and devices.
 */
export function printReceiptStandard(transaction, settings = {}) {
  const isDp = transaction.payment_status === "DP";
  const isLunas = transaction.payment_status === "Lunas";
  const paperSize = settings.printer_paper_size === "80mm" ? "80mm" : "58mm";
  const printWidth = paperSize === "80mm" ? "300px" : "240px";

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
        <title>Struk - ${transaction.invoice_number || "Kasir"}</title>
        <style>
          @page {
            size: auto;
            margin: 0mm;
          }
          body {
            margin: 0;
            padding: 8px 6px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            width: ${printWidth};
            max-width: 100%;
            word-break: break-word;
          }
          * {
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .uppercase { text-transform: uppercase; }
          .dashed {
            border-bottom: 1px dashed #000;
            margin: 6px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .item-title {
            font-weight: bold;
            margin-top: 3px;
          }
          .stamp {
            display: inline-block;
            padding: 3px 8px;
            border: 1px solid #000;
            font-weight: bold;
            font-size: 10.5px;
            margin: 6px 0;
          }
          .small {
            font-size: 10px;
          }
          .tiny {
            font-size: 9px;
            color: #333;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="font-bold uppercase" style="font-size: 13px;">${settings.store_name || "OPTIK RAJA"}</div>
          ${settings.optician_permit_no ? `<div class="tiny">SIP: ${settings.optician_permit_no}</div>` : ""}
          ${settings.address ? `<div class="tiny">${settings.address}</div>` : ""}
          ${settings.phone ? `<div class="tiny">Telp/WA: ${settings.phone}</div>` : ""}
        </div>

        <div class="dashed"></div>

        <div class="row"><span>No Nota:</span><span class="font-bold">${transaction.invoice_number || "-"}</span></div>
        <div class="row"><span>Tanggal:</span><span>${formatDateTime(transaction.transaction_date)}</span></div>
        <div class="row"><span>Kasir:</span><span>${transaction.employee_name || "Kasir"}</span></div>
        <div class="row"><span>Pelanggan:</span><span class="font-bold">${transaction.customer_name || "Umum"}</span></div>
        ${transaction.completion_estimate ? `<div class="row"><span>Est. Selesai:</span><span class="font-bold">${formatDate(transaction.completion_estimate)}</span></div>` : ""}

        <div class="dashed"></div>

        <div class="row font-bold small"><span>ITEM & QTY</span><span>TOTAL</span></div>
        <div class="dashed"></div>

        ${(transaction.items || []).map((item) => `
          <div class="item-title">${item.product_name}</div>
          <div class="row tiny">
            <span>${item.quantity} x ${formatRupiah(item.price)}${item.discount > 0 ? ` (-${formatRupiah(item.discount)})` : ""}</span>
            <span class="font-bold" style="color: #000;">${formatRupiah(item.total_price)}</span>
          </div>
        `).join("")}

        <div class="dashed"></div>

        <div class="row"><span>Subtotal:</span><span>${formatRupiah(transaction.subtotal)}</span></div>
        ${transaction.discount_amount > 0 ? `<div class="row"><span>Diskon:</span><span>-${formatRupiah(transaction.discount_amount)}</span></div>` : ""}
        ${transaction.bpjs_subsidy > 0 ? `<div class="row"><span>Subsidi BPJS:</span><span>-${formatRupiah(transaction.bpjs_subsidy)}</span></div>` : ""}
        <div class="row font-bold" style="font-size: 11.5px; margin-top: 3px;"><span>TOTAL TAGIHAN:</span><span>${formatRupiah(transaction.grand_total)}</span></div>
        <div class="row"><span>Metode Bayar:</span><span>${transaction.payment_method || "Tunai"}</span></div>
        <div class="row font-bold"><span>${isDp ? "Nominal DP:" : "Dibayar:"}</span><span>${formatRupiah(transaction.paid_amount)}</span></div>
        ${isDp ? `<div class="row font-bold"><span>SISA TAGIHAN:</span><span>${formatRupiah(transaction.remaining_amount)}</span></div>` : ""}
        ${!isDp && transaction.change_amount > 0 ? `<div class="row"><span>Kembalian:</span><span>${formatRupiah(transaction.change_amount)}</span></div>` : ""}

        <div class="dashed"></div>

        <div class="text-center">
          <div class="stamp">${isLunas ? "STATUS: LUNAS" : `STATUS: DP (SISA ${formatRupiah(transaction.remaining_amount)})`}</div>
        </div>

        <div class="text-center tiny" style="margin-top: 6px;">
          ${settings.receipt_footer ? `<div>${settings.receipt_footer}</div>` : ""}
          <div>--- Simpan struk ini sebagai bukti ---</div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 250);
}

/**
 * 2. Download Clean Thermal PDF Receipt using jsPDF
 * Fixes text wrapping (SIP, Address, Customer name, Dates) and dynamic height so nothing is ever cut off.
 */
export function downloadReceiptPdf(transaction, settings = {}) {
  const isDp = transaction.payment_status === "DP";
  const isLunas = transaction.payment_status === "Lunas";
  const paperSize = settings.printer_paper_size === "80mm" ? 80 : 58;

  const margin = 4;
  const contentWidth = paperSize - margin * 2;
  const centerX = paperSize / 2;

  // 1. Pre-calculate exact content height with a temporary measurer
  const testDoc = new jsPDF({ unit: "mm", format: [paperSize, 400] });
  testDoc.setFont("courier", "bold");
  testDoc.setFontSize(paperSize === 80 ? 11 : 9.5);
  const storeNameLines = testDoc.splitTextToSize((settings.store_name || "OPTIK RAJA").toUpperCase(), contentWidth);

  testDoc.setFont("courier", "normal");
  testDoc.setFontSize(paperSize === 80 ? 7.5 : 6.8);

  let measuredY = 10; // Top padding
  measuredY += storeNameLines.length * 4.2;

  if (settings.optician_permit_no) {
    const sipLines = testDoc.splitTextToSize(`SIP: ${settings.optician_permit_no}`, contentWidth);
    measuredY += sipLines.length * 3.4;
  }
  if (settings.address) {
    const addressLines = testDoc.splitTextToSize(settings.address, contentWidth);
    measuredY += addressLines.length * 3.4;
  }
  if (settings.phone) {
    const phoneLines = testDoc.splitTextToSize(`Telp/WA: ${settings.phone}`, contentWidth);
    measuredY += phoneLines.length * 3.4;
  }
  measuredY += 4.5; // Divider

  // Meta rows: No Nota, Tanggal, Kasir, Pelanggan, Est. Selesai
  measuredY += 4 * 4;
  if (transaction.completion_estimate) measuredY += 4;
  measuredY += 4.5; // Divider

  // Items Header
  measuredY += 5;
  (transaction.items || []).forEach((item) => {
    testDoc.setFontSize(paperSize === 80 ? 8 : 7.2);
    const nameLines = testDoc.splitTextToSize(item.product_name, contentWidth);
    measuredY += nameLines.length * 3.6 + 4.5; // name + price details
  });
  measuredY += 4.5; // Divider

  // Totals & Payments
  measuredY += 4 * 4; // Subtotal, Total, Metode, Paid
  if (transaction.discount_amount > 0) measuredY += 4;
  if (transaction.bpjs_subsidy > 0) measuredY += 4;
  if (isDp || transaction.change_amount > 0) measuredY += 4;
  measuredY += 4.5; // Divider

  // Status Stamp
  measuredY += 9;

  // Footer & Closing text
  if (settings.receipt_footer) {
    testDoc.setFontSize(paperSize === 80 ? 7 : 6.5);
    const footerLines = testDoc.splitTextToSize(settings.receipt_footer, contentWidth);
    measuredY += footerLines.length * 3.4 + 3;
  }
  measuredY += 8; // "Simpan struk ini..."

  // Generous safety buffer so content never cuts off or touches bottom edge
  const finalPageHeight = Math.max(160, Math.ceil(measuredY + 20));

  // 2. Create the real document with exact height
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [paperSize, finalPageHeight],
  });

  // Solid white background for whole ticket
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, paperSize, finalPageHeight, "F");
  doc.setTextColor(0, 0, 0);

  let y = 8;

  // Store Header
  doc.setFont("courier", "bold");
  doc.setFontSize(paperSize === 80 ? 11 : 9.5);
  doc.text(storeNameLines, centerX, y, { align: "center" });
  y += storeNameLines.length * 4;

  doc.setFont("courier", "normal");
  doc.setFontSize(paperSize === 80 ? 7.5 : 6.8);
  if (settings.optician_permit_no) {
    const sipLines = doc.splitTextToSize(`SIP: ${settings.optician_permit_no}`, contentWidth);
    doc.text(sipLines, centerX, y, { align: "center" });
    y += sipLines.length * 3.2;
  }
  if (settings.address) {
    const addressLines = doc.splitTextToSize(settings.address, contentWidth);
    doc.text(addressLines, centerX, y, { align: "center" });
    y += addressLines.length * 3.2;
  }
  if (settings.phone) {
    const phoneLines = doc.splitTextToSize(`Telp/WA: ${settings.phone}`, contentWidth);
    doc.text(phoneLines, centerX, y, { align: "center" });
    y += phoneLines.length * 3.2;
  }

  // Divider helper
  const drawDivider = () => {
    doc.setFont("courier", "normal");
    doc.setFontSize(paperSize === 80 ? 8 : 7);
    doc.text("-".repeat(paperSize === 80 ? 44 : 32), centerX, y, { align: "center" });
    y += 3.6;
  };

  drawDivider();

  // Smart row drawer that handles text wrapping and prevents collisions
  const drawRow = (left, right, isBold = false) => {
    doc.setFont("courier", isBold ? "bold" : "normal");
    doc.setFontSize(paperSize === 80 ? 8 : 7.2);
    doc.text(left, margin, y);

    const valStr = String(right || "-");
    const maxValWidth = contentWidth - 18;
    const valWidth = doc.getTextWidth(valStr);

    if (valWidth > maxValWidth) {
      const wrapped = doc.splitTextToSize(valStr, maxValWidth);
      doc.text(wrapped[0], paperSize - margin, y, { align: "right" });
      if (wrapped.length > 1) {
        y += 3.3;
        doc.text(wrapped.slice(1).join(" "), paperSize - margin, y, { align: "right" });
      }
    } else {
      doc.text(valStr, paperSize - margin, y, { align: "right" });
    }
    y += 3.8;
  };

  drawRow("No Nota:", transaction.invoice_number || "-");
  drawRow("Tanggal:", formatDateTime(transaction.transaction_date));
  drawRow("Kasir:", transaction.employee_name || "Kasir");
  drawRow("Pelanggan:", transaction.customer_name || "Umum", true);
  if (transaction.completion_estimate) {
    drawRow("Est. Selesai:", formatDate(transaction.completion_estimate));
  }

  drawDivider();

  // Items Header
  doc.setFont("courier", "bold");
  doc.setFontSize(paperSize === 80 ? 8 : 7.2);
  doc.text("ITEM & QTY", margin, y);
  doc.text("TOTAL", paperSize - margin, y, { align: "right" });
  y += 4;

  // Items List
  (transaction.items || []).forEach((item) => {
    doc.setFont("courier", "bold");
    doc.setFontSize(paperSize === 80 ? 8 : 7.2);
    const nameLines = doc.splitTextToSize(item.product_name, contentWidth);
    doc.text(nameLines, margin, y);
    y += nameLines.length * 3.4;

    doc.setFont("courier", "normal");
    doc.setFontSize(paperSize === 80 ? 7.5 : 6.8);
    const detailText = `${item.quantity} x ${formatRupiah(item.price)}${item.discount > 0 ? ` (-${formatRupiah(item.discount)})` : ""}`;
    doc.text(detailText, margin, y);

    doc.setFont("courier", "bold");
    doc.text(formatRupiah(item.total_price), paperSize - margin, y, { align: "right" });
    y += 3.8;
  });

  drawDivider();

  // Totals
  drawRow("Subtotal:", formatRupiah(transaction.subtotal));
  if (transaction.discount_amount > 0) {
    drawRow("Diskon:", `-${formatRupiah(transaction.discount_amount)}`);
  }
  if (transaction.bpjs_subsidy > 0) {
    drawRow("Subsidi BPJS:", `-${formatRupiah(transaction.bpjs_subsidy)}`);
  }
  drawRow("TOTAL:", formatRupiah(transaction.grand_total), true);
  drawRow("Metode Bayar:", transaction.payment_method || "Tunai");
  drawRow(isDp ? "Nominal DP:" : "Dibayar:", formatRupiah(transaction.paid_amount), true);
  if (isDp) {
    drawRow("SISA TAGIHAN:", formatRupiah(transaction.remaining_amount), true);
  } else if (transaction.change_amount > 0) {
    drawRow("Kembalian:", formatRupiah(transaction.change_amount));
  }

  drawDivider();

  // Status Stamp
  doc.setFont("courier", "bold");
  doc.setFontSize(paperSize === 80 ? 9 : 8);
  const statusText = isLunas ? "[ STATUS: LUNAS ]" : `[ STATUS: DP (SISA ${formatRupiah(transaction.remaining_amount)}) ]`;
  doc.text(statusText, centerX, y, { align: "center" });
  y += 5;

  // Footer & Thank You Notes
  if (settings.receipt_footer) {
    doc.setFont("courier", "normal");
    doc.setFontSize(paperSize === 80 ? 7 : 6.5);
    const footerLines = doc.splitTextToSize(settings.receipt_footer, contentWidth);
    doc.text(footerLines, centerX, y, { align: "center" });
    y += footerLines.length * 3.2 + 2;
  }

  doc.setFont("courier", "normal");
  doc.setFontSize(paperSize === 80 ? 6.5 : 6);
  const closingLines = doc.splitTextToSize("--- Simpan struk ini sebagai bukti transaksi ---", contentWidth);
  doc.text(closingLines, centerX, y, { align: "center" });

  doc.save(`struk-${transaction.invoice_number || "transaksi"}.pdf`);
}

/**
 * 3. Build Raw ESC/POS Binary Commands for 58mm / 80mm Bluetooth Thermal Printers
 */
export function buildEscPosReceipt(transaction, settings = {}) {
  const isDp = transaction.payment_status === "DP";
  const isLunas = transaction.payment_status === "Lunas";
  const paperSize = settings.printer_paper_size === "80mm" ? 80 : 58;
  const width = paperSize === 80 ? 48 : 32;

  const parts = [];

  const ESC = 0x1b;
  const GS = 0x1d;
  const CMD_INIT = [ESC, 0x40];
  const CMD_ALIGN_CENTER = [ESC, 0x61, 0x01];
  const CMD_ALIGN_LEFT = [ESC, 0x61, 0x00];
  const CMD_ALIGN_RIGHT = [ESC, 0x61, 0x02];
  const CMD_BOLD_ON = [ESC, 0x45, 0x01];
  const CMD_BOLD_OFF = [ESC, 0x45, 0x00];
  const CMD_DOUBLE_SIZE = [GS, 0x21, 0x11];
  const CMD_NORMAL_SIZE = [GS, 0x21, 0x00];

  const encoder = new TextEncoder();

  const addBytes = (bytes) => parts.push(new Uint8Array(bytes));
  const addText = (text) => parts.push(encoder.encode(text));

  const formatTwoCols = (left, right) => {
    const maxLeft = width - right.length - 1;
    const l = left.length > maxLeft ? left.slice(0, maxLeft) : left;
    const spaces = " ".repeat(Math.max(1, width - l.length - right.length));
    return l + spaces + right + "\n";
  };

  const divider = "-".repeat(width) + "\n";

  // Initialize
  addBytes(CMD_INIT);

  // Store Header
  addBytes(CMD_ALIGN_CENTER);
  addBytes(CMD_BOLD_ON);
  addBytes(CMD_DOUBLE_SIZE);
  addText((settings.store_name || "OPTIK RAJA") + "\n");
  addBytes(CMD_NORMAL_SIZE);
  addBytes(CMD_BOLD_OFF);

  if (settings.optician_permit_no) {
    addText(`SIP: ${settings.optician_permit_no}\n`);
  }
  if (settings.address) {
    addText(settings.address + "\n");
  }
  if (settings.phone) {
    addText(`Telp/WA: ${settings.phone}\n`);
  }

  addText(divider);

  // Metadata
  addBytes(CMD_ALIGN_LEFT);
  addText(formatTwoCols("No Nota:", transaction.invoice_number || "-"));
  addText(formatTwoCols("Tanggal:", formatDateTime(transaction.transaction_date)));
  addText(formatTwoCols("Kasir:", transaction.employee_name || "Kasir"));
  addText(formatTwoCols("Pelanggan:", transaction.customer_name || "Umum"));
  if (transaction.completion_estimate) {
    addText(formatTwoCols("Est. Selesai:", formatDate(transaction.completion_estimate)));
  }

  addText(divider);

  // Items
  addText(formatTwoCols("ITEM & QTY", "TOTAL"));
  addText(divider);

  (transaction.items || []).forEach((item) => {
    addBytes(CMD_BOLD_ON);
    addText(item.product_name + "\n");
    addBytes(CMD_BOLD_OFF);
    const detail = `  ${item.quantity} x ${formatRupiah(item.price)}${item.discount > 0 ? ` (-${formatRupiah(item.discount)})` : ""}`;
    addText(formatTwoCols(detail, formatRupiah(item.total_price)));
  });

  addText(divider);

  // Totals
  addText(formatTwoCols("Subtotal:", formatRupiah(transaction.subtotal)));
  if (transaction.discount_amount > 0) {
    addText(formatTwoCols("Diskon:", `-${formatRupiah(transaction.discount_amount)}`));
  }
  if (transaction.bpjs_subsidy > 0) {
    addText(formatTwoCols("Subsidi BPJS:", `-${formatRupiah(transaction.bpjs_subsidy)}`));
  }
  addBytes(CMD_BOLD_ON);
  addText(formatTwoCols("TOTAL TAGIHAN:", formatRupiah(transaction.grand_total)));
  addBytes(CMD_BOLD_OFF);
  addText(formatTwoCols("Metode Bayar:", transaction.payment_method || "Tunai"));
  addBytes(CMD_BOLD_ON);
  addText(formatTwoCols(isDp ? "Nominal DP:" : "Dibayar:", formatRupiah(transaction.paid_amount)));
  if (isDp) {
    addText(formatTwoCols("SISA TAGIHAN:", formatRupiah(transaction.remaining_amount)));
  } else if (transaction.change_amount > 0) {
    addText(formatTwoCols("Kembalian:", formatRupiah(transaction.change_amount)));
  }
  addBytes(CMD_BOLD_OFF);

  addText(divider);

  // Status Stamp
  addBytes(CMD_ALIGN_CENTER);
  addBytes(CMD_BOLD_ON);
  const statusStr = isLunas ? "[ STATUS: LUNAS ]" : `[ STATUS: DP (SISA ${formatRupiah(transaction.remaining_amount)}) ]`;
  addText(statusStr + "\n");
  addBytes(CMD_BOLD_OFF);

  // Footer
  if (settings.receipt_footer) {
    addText(settings.receipt_footer + "\n");
  }
  addText("--- Simpan struk ini sebagai bukti ---\n");

  // Feed & Cut
  addText("\n\n\n\n");
  addBytes([GS, 0x56, 0x41, 0x00]);

  // Combine
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    combined.set(p, offset);
    offset += p.length;
  }
  return combined;
}

/**
 * 4. Direct Bluetooth ESC/POS Thermal Printing via Web Bluetooth API
 */
export async function printReceiptBluetooth(transaction, settings = {}, onStatus) {
  if (!navigator.bluetooth) {
    throw new Error(
      "Browser tidak mendukung Web Bluetooth API. Gunakan browser Google Chrome atau Edge di Laptop/Android, dan pastikan Bluetooth menyala."
    );
  }

  onStatus?.("Mencari printer bluetooth...");
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      "000018f0-0000-1000-8000-00805f9b34fb", // Standard ESC/POS
      "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
      "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent
      0x18f0,
      0xffe0, // HM-10 / Serial
      0xff00,
    ],
  });

  onStatus?.(`Menghubungkan ke ${device.name || "Printer"}...`);
  const server = await device.gatt.connect();

  let targetCharacteristic = null;
  const services = await server.getPrimaryServices();

  for (const service of services) {
    try {
      const characteristics = await service.getCharacteristics();
      for (const c of characteristics) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          targetCharacteristic = c;
          break;
        }
      }
      if (targetCharacteristic) break;
    } catch (e) {
      // Continue checking next service
    }
  }

  if (!targetCharacteristic) {
    throw new Error("Gagal menemukan port printer writable pada perangkat bluetooth ini.");
  }

  onStatus?.("Mengirim data struk ke printer...");
  const data = buildEscPosReceipt(transaction, settings);

  // Send in 60-byte chunks to prevent BLE buffer overflow
  const CHUNK_SIZE = 60;
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    const chunk = data.slice(i, i + CHUNK_SIZE);
    if (targetCharacteristic.properties.writeWithoutResponse) {
      await targetCharacteristic.writeValueWithoutResponse(chunk);
    } else {
      await targetCharacteristic.writeValue(chunk);
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  onStatus?.("Struk berhasil dicetak!");
  return device.name || "Printer Bluetooth";
}
