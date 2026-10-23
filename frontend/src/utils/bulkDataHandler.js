import * as XLSX from "xlsx";
import { formatDateTime, formatDate } from "./formatters.js";

/**
 * Helper to generate timestamped filename
 */
function createFileName(prefix, extension = "xlsx") {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `${prefix}_${dateStr}.${extension}`;
}

// ==========================================
// 1. PRODUCT BULK EXPORT & IMPORT UTILITIES
// ==========================================

/**
 * Downloads a clean Excel template for bulk product import
 */
export function downloadProductTemplate() {
  const wb = XLSX.utils.book_new();

  const headers = [
    "SKU *",
    "Barcode",
    "Nama Produk *",
    "Kategori (Frame/Lensa/Aksesori) *",
    "Merek",
    "Harga Beli (Rp)",
    "Harga Jual (Rp) *",
    "Stok",
    "Satuan (Pcs/Pasang/Botol)",
    "Spesifikasi",
    "Status (Aktif/Nonaktif)",
  ];

  const sampleRows = [
    [
      "FRM-RAY-001",
      "8991001001",
      "Frame Ray-Ban Aviator Classic Gold",
      "Frame",
      "Ray-Ban",
      750000,
      1450000,
      15,
      "Pcs",
      "Material Metal, Size 58-14-135, Warna Gold",
      "Aktif",
    ],
    [
      "LNS-BLU-001",
      "8992001001",
      "Lensa Bluechromic 1.56 Anti Radiasi",
      "Lensa",
      "VisionShield",
      200000,
      500000,
      30,
      "Pasang",
      "Index 1.56, Gelap di luar ruangan & filter sinar biru",
      "Aktif",
    ],
    [
      "ACC-SPRAY-60",
      "8993001001",
      "Pembersih Lensa Spray Optik 60ml",
      "Aksesori",
      "OptiClean",
      12000,
      35000,
      50,
      "Pcs",
      "Formula bebas alkohol, aman untuk semua jenis coating",
      "Aktif",
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 18 }, // SKU
    { wch: 16 }, // Barcode
    { wch: 38 }, // Nama Produk
    { wch: 32 }, // Kategori
    { wch: 18 }, // Merek
    { wch: 18 }, // Harga Beli
    { wch: 18 }, // Harga Jual
    { wch: 10 }, // Stok
    { wch: 25 }, // Satuan
    { wch: 45 }, // Spesifikasi
    { wch: 22 }, // Status
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Template Produk");
  XLSX.writeFile(wb, "Template_Import_Produk_Optik_Raja.xlsx");
}

/**
 * Parses an uploaded product Excel/CSV file and normalizes columns
 */
export async function parseProductsExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target.result);
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const valid = [];
        const invalid = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2; // header is row 1
          const sku = String(
            row["SKU *"] || row["SKU"] || row["sku"] || row["Kode Produk"] || ""
          ).trim();
          const name = String(
            row["Nama Produk *"] ||
              row["Nama Produk"] ||
              row["Nama"] ||
              row["name"] ||
              ""
          ).trim();
          const rawCategory = String(
            row["Kategori (Frame/Lensa/Aksesori) *"] ||
              row["Kategori *"] ||
              row["Kategori"] ||
              row["category"] ||
              "Frame"
          ).trim();

          // Normalization
          let category = "Frame";
          const catLower = rawCategory.toLowerCase();
          if (catLower.includes("lensa") || catLower.includes("lens")) {
            category = "Lensa";
          } else if (
            catLower.includes("aksesor") ||
            catLower.includes("access")
          ) {
            category = "Aksesori";
          } else {
            category = "Frame";
          }

          const barcode = String(
            row["Barcode"] || row["barcode"] || row["Kode Barcode"] || sku
          ).trim();
          const brand = String(
            row["Merek"] || row["Brand"] || row["brand"] || ""
          ).trim();
          const cost_price = Math.max(
            0,
            parseFloat(
              row["Harga Beli (Rp)"] ||
                row["Harga Beli"] ||
                row["cost_price"] ||
                row["HPP"] ||
                0
            ) || 0
          );
          const selling_price = Math.max(
            0,
            parseFloat(
              row["Harga Jual (Rp) *"] ||
                row["Harga Jual *"] ||
                row["Harga Jual"] ||
                row["selling_price"] ||
                row["Harga"] ||
                0
            ) || 0
          );
          const stock =
            parseInt(
              row["Stok"] ||
                row["stock"] ||
                row["Qty"] ||
                row["Jumlah"] ||
                0
            ) || 0;
          const unit = String(
            row["Satuan (Pcs/Pasang/Botol)"] ||
              row["Satuan"] ||
              row["unit"] ||
              "Pcs"
          ).trim();
          const specifications = String(
            row["Spesifikasi"] ||
              row["Deskripsi"] ||
              row["specifications"] ||
              ""
          ).trim();

          const rawStatus = String(
            row["Status (Aktif/Nonaktif)"] ||
              row["Status"] ||
              row["is_active"] ||
              "Aktif"
          ).toLowerCase();
          const is_active =
            rawStatus === "nonaktif" ||
            rawStatus === "0" ||
            rawStatus === "false"
              ? 0
              : 1;

          const productObj = {
            rowNum,
            sku,
            barcode: barcode || sku,
            name,
            category,
            brand,
            cost_price,
            selling_price,
            stock,
            unit: unit || "Pcs",
            specifications,
            is_active,
          };

          if (!sku || !name) {
            const errorMsg = !sku
              ? "SKU tidak boleh kosong"
              : "Nama produk tidak boleh kosong";
            invalid.push({ ...productObj, error: errorMsg });
          } else {
            valid.push(productObj);
          }
        });

        resolve({
          valid,
          invalid,
          totalCount: rawRows.length,
        });
      } catch (err) {
        reject(new Error("Gagal membaca file Excel/CSV: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports products array to a formatted Excel file
 */
export function exportProductsToExcel(products, customFilename) {
  const wb = XLSX.utils.book_new();

  const headers = [
    "No",
    "SKU",
    "Barcode",
    "Nama Produk",
    "Kategori",
    "Merek",
    "Harga Beli (Rp)",
    "Harga Jual (Rp)",
    "Stok",
    "Satuan",
    "Spesifikasi",
    "Status",
    "Tanggal Dibuat",
  ];

  const rows = (products || []).map((p, idx) => [
    idx + 1,
    p.sku || "",
    p.barcode || "",
    p.name || "",
    p.category || "",
    p.brand || "",
    parseFloat(p.cost_price || 0),
    parseFloat(p.selling_price || 0),
    parseInt(p.stock || 0),
    p.unit || "Pcs",
    p.specifications || "",
    p.is_active ? "Aktif" : "Nonaktif",
    p.created_at ? formatDateTime(p.created_at) : "-",
  ]);

  const wsData = [
    ["OPTIK RAJA OFFICIAL"],
    ["DAFTAR KATALOG PRODUK & INVENTARIS"],
    [`Total Data: ${products.length} produk   |   Tanggal Ekspor: ${formatDateTime(new Date())}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 18 }, // SKU
    { wch: 16 }, // Barcode
    { wch: 36 }, // Nama Produk
    { wch: 16 }, // Kategori
    { wch: 18 }, // Merek
    { wch: 18 }, // Harga Beli
    { wch: 18 }, // Harga Jual
    { wch: 10 }, // Stok
    { wch: 14 }, // Satuan
    { wch: 40 }, // Spesifikasi
    { wch: 14 }, // Status
    { wch: 20 }, // Tanggal
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Daftar Produk");
  const fileName = customFilename || createFileName("Daftar_Produk_Optik_Raja");
  XLSX.writeFile(wb, fileName);
  return fileName;
}

// ==========================================
// 2. CUSTOMER BULK EXPORT & IMPORT UTILITIES
// ==========================================

/**
 * Downloads a clean Excel template for bulk customer import
 */
export function downloadCustomerTemplate() {
  const wb = XLSX.utils.book_new();

  const headers = [
    "Nama Lengkap *",
    "No HP/WhatsApp *",
    "Jenis Kelamin (Laki-laki/Perempuan)",
    "Usia",
    "Alamat",
    "Catatan Khusus",
  ];

  const sampleRows = [
    [
      "Hendro Wicaksono",
      "0812-8899-1122",
      "Laki-laki",
      38,
      "Jl. Mawar No. 12, Kel. Menteng",
      "Prefer frame titanium ringan, minus tinggi",
    ],
    [
      "Anisa Permatasari",
      "0813-7766-5544",
      "Perempuan",
      26,
      "Jl. Melati IV No. 5B",
      "Sering bekerja di depan komputer > 8 jam sehari",
    ],
    [
      "Dr. Irwan Syahputra",
      "0818-0909-3322",
      "Laki-laki",
      52,
      "Komp. Graha Indah Blok C3",
      "Kacamata progresif untuk membaca dan mengemudi",
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 28 }, // Nama Lengkap
    { wch: 20 }, // No HP
    { wch: 34 }, // Jenis Kelamin
    { wch: 10 }, // Usia
    { wch: 40 }, // Alamat
    { wch: 45 }, // Catatan Khusus
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Template Pelanggan");
  XLSX.writeFile(wb, "Template_Import_Pelanggan_Optik_Raja.xlsx");
}

/**
 * Parses an uploaded customer Excel/CSV file and normalizes columns
 */
export async function parseCustomersExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target.result);
        const wb = XLSX.read(buffer, { type: "array" });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const valid = [];
        const invalid = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2;
          const name = String(
            row["Nama Lengkap *"] ||
              row["Nama Lengkap"] ||
              row["Nama"] ||
              row["name"] ||
              ""
          ).trim();
          const phone = String(
            row["No HP/WhatsApp *"] ||
              row["No HP *"] ||
              row["No HP"] ||
              row["Nomor HP"] ||
              row["Telepon"] ||
              row["phone"] ||
              ""
          ).trim();

          const rawGender = String(
            row["Jenis Kelamin (Laki-laki/Perempuan)"] ||
              row["Jenis Kelamin"] ||
              row["gender"] ||
              "Laki-laki"
          ).trim();
          let gender = "Laki-laki";
          const genLower = rawGender.toLowerCase();
          if (
            genLower.startsWith("p") ||
            genLower.includes("wanita") ||
            genLower.includes("perempuan")
          ) {
            gender = "Perempuan";
          } else {
            gender = "Laki-laki";
          }

          const ageVal = parseInt(
            row["Usia"] || row["Umur"] || row["age"] || ""
          );
          const age = isNaN(ageVal) || ageVal <= 0 ? null : ageVal;
          const address = String(
            row["Alamat"] || row["address"] || ""
          ).trim();
          const notes = String(
            row["Catatan Khusus"] || row["Catatan"] || row["notes"] || ""
          ).trim();

          const customerObj = {
            rowNum,
            name,
            phone,
            gender,
            age,
            address,
            notes,
          };

          if (!name || !phone) {
            const errorMsg = !name
              ? "Nama pelanggan wajib diisi"
              : "Nomor HP wajib diisi";
            invalid.push({ ...customerObj, error: errorMsg });
          } else {
            valid.push(customerObj);
          }
        });

        resolve({
          valid,
          invalid,
          totalCount: rawRows.length,
        });
      } catch (err) {
        reject(new Error("Gagal membaca file Excel/CSV: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports customers array to a formatted Excel file
 */
export function exportCustomersToExcel(customers, customFilename) {
  const wb = XLSX.utils.book_new();

  const headers = [
    "No",
    "Kode Pelanggan",
    "Nama Lengkap",
    "Nomor HP / WA",
    "Jenis Kelamin",
    "Usia",
    "Alamat",
    "Catatan Khusus",
    "Tanggal Terdaftar",
  ];

  const rows = (customers || []).map((c, idx) => [
    idx + 1,
    c.code || "-",
    c.name || "",
    c.phone || "",
    c.gender || "Laki-laki",
    c.age ? `${c.age} Tahun` : "-",
    c.address || "-",
    c.notes || "-",
    c.created_at ? formatDateTime(c.created_at) : "-",
  ]);

  const wsData = [
    ["OPTIK RAJA OFFICIAL"],
    ["DATABASE DATA PELANGGAN & PASIEN OPTIK"],
    [`Total Data: ${customers.length} pelanggan   |   Tanggal Ekspor: ${formatDateTime(new Date())}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 16 }, // Kode
    { wch: 28 }, // Nama
    { wch: 20 }, // No HP
    { wch: 16 }, // Gender
    { wch: 12 }, // Usia
    { wch: 40 }, // Alamat
    { wch: 40 }, // Catatan
    { wch: 20 }, // Tanggal
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Daftar Pelanggan");
  const fileName = customFilename || createFileName("Daftar_Pelanggan_Optik_Raja");
  XLSX.writeFile(wb, fileName);
  return fileName;
}

// ==========================================
// 3. PRESCRIPTION (REKAM MEDIS) BULK UTILITIES
// ==========================================

/**
 * Exports prescriptions array to a formatted Excel file
 */
export function exportPrescriptionsToExcel(prescriptions, periodLabel, customFilename) {
  const wb = XLSX.utils.book_new();

  const headers = [
    "No",
    "Tanggal Periksa",
    "Nama Pasien",
    "Usia",
    "No HP / WhatsApp",
    "Kunjungan Ke",
    "OD Spheris",
    "OD Cylinder",
    "OD Axis",
    "OD Addition",
    "OD MPD",
    "OD BCVA",
    "OS Spheris",
    "OS Cylinder",
    "OS Axis",
    "OS Addition",
    "OS MPD",
    "OS BCVA",
    "Total PD",
    "Pemeriksa (RO)",
    "Keluhan / Diagnosa",
    "Catatan Klinis",
  ];

  const rows = (prescriptions || []).map((rx, idx) => [
    idx + 1,
    rx.exam_date ? formatDate(rx.exam_date) : "-",
    rx.customer_name || "-",
    rx.customer_age ? `${rx.customer_age} Thn` : "-",
    rx.customer_phone || "-",
    rx.visit_number || 1,
    rx.od_sph || "0.00",
    rx.od_cyl || "0.00",
    rx.od_axis !== undefined ? `${rx.od_axis}°` : "0°",
    rx.od_add || "0.00",
    rx.od_mpd || 31,
    rx.od_bcva || "6/6",
    rx.os_sph || "0.00",
    rx.os_cyl || "0.00",
    rx.os_axis !== undefined ? `${rx.os_axis}°` : "0°",
    rx.os_add || "0.00",
    rx.os_mpd || 31,
    rx.os_bcva || "6/6",
    rx.total_pd ? `${rx.total_pd} mm` : "62.0 mm",
    rx.examiner_name || "-",
    rx.complaint_diagnose || "-",
    rx.notes || "-",
  ]);

  const wsData = [
    ["OPTIK RAJA OFFICIAL"],
    ["DATA REKAM MEDIS & HASIL REFRAKSI PASIEN"],
    [`Periode: ${periodLabel || "Semua Data"}   |   Total Data: ${prescriptions.length} rekam medis   |   Tanggal Ekspor: ${formatDateTime(new Date())}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 16 }, // Tgl
    { wch: 26 }, // Nama
    { wch: 10 }, // Usia
    { wch: 18 }, // No HP
    { wch: 14 }, // Kunjungan
    { wch: 12 }, // OD Sph
    { wch: 12 }, // OD Cyl
    { wch: 10 }, // OD Axis
    { wch: 12 }, // OD Add
    { wch: 10 }, // OD MPD
    { wch: 10 }, // OD BCVA
    { wch: 12 }, // OS Sph
    { wch: 12 }, // OS Cyl
    { wch: 10 }, // OS Axis
    { wch: 12 }, // OS Add
    { wch: 10 }, // OS MPD
    { wch: 10 }, // OS BCVA
    { wch: 12 }, // Total PD
    { wch: 24 }, // Pemeriksa
    { wch: 32 }, // Keluhan
    { wch: 32 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Rekam Medis");
  const fileName = customFilename || createFileName("Rekam_Medis_Pasien_Optik_Raja");
  XLSX.writeFile(wb, fileName);
  return fileName;
}

/**
 * Helper to normalize diopter value (Sph, Cyl, Add)
 */
function cleanDiopter(val) {
  if (val === undefined || val === null || val === "" || String(val).trim() === "-") {
    return "0.00";
  }
  let str = String(val).trim().replace(",", ".");
  if (str.toLowerCase() === "plano" || str.toLowerCase() === "normal" || str === "0") {
    return "0.00";
  }
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  if (num > 0) return `+${num.toFixed(2)}`;
  if (num === 0) return "0.00";
  return num.toFixed(2);
}

/**
 * Downloads a clean Excel template for bulk prescription import
 */
export function downloadPrescriptionTemplate() {
  const wb = XLSX.utils.book_new();

  const headers = [
    "Tanggal Periksa (YYYY-MM-DD) *",
    "Nama Pasien *",
    "No HP / WhatsApp *",
    "Usia",
    "Jenis Kelamin (Laki-laki/Perempuan)",
    "Pemeriksa (RO)",
    "OD Spheris",
    "OD Cylinder",
    "OD Axis",
    "OD Addition",
    "OD MPD",
    "OD BCVA",
    "OS Spheris",
    "OS Cylinder",
    "OS Axis",
    "OS Addition",
    "OS MPD",
    "OS BCVA",
    "Total PD",
    "Keluhan / Diagnosa",
    "Catatan Klinis",
  ];

  const todayStr = new Date().toISOString().slice(0, 10);

  const sampleRows = [
    [
      todayStr,
      "Ahmad Fauzi",
      "081234567890",
      32,
      "Laki-laki",
      "RO Bambang",
      "-1.50",
      "-0.50",
      90,
      "+1.25",
      31.0,
      "6/6",
      "-2.00",
      "0.00",
      0,
      "+1.25",
      31.0,
      "6/6",
      62.0,
      "Mata cepat lelah saat bekerja di depan laptop",
      "Disarankan lensa Bluechromic anti-radiasi",
    ],
    [
      todayStr,
      "Siti Nurhaliza",
      "085712345678",
      48,
      "Perempuan",
      "RO Siti Rahma",
      "+1.00",
      "-0.75",
      180,
      "+2.00",
      30.5,
      "6/6",
      "+0.75",
      "-0.50",
      175,
      "+2.00",
      30.5,
      "6/6",
      61.0,
      "Kesulitan membaca huruf kecil pada jarak dekat",
      "Disarankan kacamata baca progressive",
    ],
    [
      todayStr,
      "Kevin Sanjaya",
      "087811223344",
      24,
      "Laki-laki",
      "RO Bambang",
      "-3.25",
      "-1.00",
      15,
      "0.00",
      32.0,
      "6/6",
      "-3.00",
      "-0.75",
      165,
      "0.00",
      32.0,
      "6/6",
      64.0,
      "Silau saat berkendara malam hari dan pandangan kabur",
      "Kontrol berkala setiap 1 tahun",
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 28 }, // Tanggal Periksa
    { wch: 26 }, // Nama Pasien
    { wch: 18 }, // No HP
    { wch: 10 }, // Usia
    { wch: 25 }, // Jenis Kelamin
    { wch: 20 }, // Pemeriksa
    { wch: 14 }, // OD Spheris
    { wch: 14 }, // OD Cylinder
    { wch: 12 }, // OD Axis
    { wch: 14 }, // OD Addition
    { wch: 12 }, // OD MPD
    { wch: 12 }, // OD BCVA
    { wch: 14 }, // OS Spheris
    { wch: 14 }, // OS Cylinder
    { wch: 12 }, // OS Axis
    { wch: 14 }, // OS Addition
    { wch: 12 }, // OS MPD
    { wch: 12 }, // OS BCVA
    { wch: 14 }, // Total PD
    { wch: 38 }, // Keluhan / Diagnosa
    { wch: 38 }, // Catatan Klinis
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Template Rekam Medis");
  XLSX.writeFile(wb, "Template_Import_Rekam_Medis_Optik_Raja.xlsx");
}

/**
 * Parses an uploaded prescription Excel/CSV file and normalizes columns
 */
export async function parsePrescriptionsExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = new Uint8Array(e.target.result);
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

        const valid = [];
        const invalid = [];

        rawRows.forEach((row, index) => {
          const rowNum = index + 2;

          // Nama Pasien
          const customer_name = String(
            row["Nama Pasien *"] ||
              row["Nama Pasien"] ||
              row["Nama Lengkap *"] ||
              row["Nama Lengkap"] ||
              row["Nama"] ||
              row["customer_name"] ||
              row["name"] ||
              ""
          ).trim();

          // No HP
          const customer_phone = String(
            row["No HP / WhatsApp *"] ||
              row["No HP / WhatsApp"] ||
              row["No HP/WhatsApp *"] ||
              row["No HP/WhatsApp"] ||
              row["No HP *"] ||
              row["No HP"] ||
              row["Nomor HP"] ||
              row["Telepon"] ||
              row["phone"] ||
              row["customer_phone"] ||
              ""
          ).trim();

          // Tanggal Periksa
          const exam_date_val =
            row["Tanggal Periksa (YYYY-MM-DD) *"] ||
            row["Tanggal Periksa *"] ||
            row["Tanggal Periksa"] ||
            row["Tgl Periksa"] ||
            row["Tanggal"] ||
            row["exam_date"] ||
            "";

          let exam_date = "";
          if (exam_date_val instanceof Date && !isNaN(exam_date_val.getTime())) {
            exam_date = exam_date_val.toISOString().slice(0, 10);
          } else if (typeof exam_date_val === "number") {
            const parsedD = new Date(Math.round((exam_date_val - 25569) * 86400 * 1000));
            exam_date = isNaN(parsedD.getTime()) ? "" : parsedD.toISOString().slice(0, 10);
          } else {
            const strDate = String(exam_date_val).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(strDate)) {
              exam_date = strDate.slice(0, 10);
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(strDate)) {
              const [d, m, y] = strDate.split("/");
              exam_date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(strDate)) {
              const [d, m, y] = strDate.split("-");
              exam_date = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            } else if (!strDate || strDate === "-") {
              exam_date = new Date().toISOString().slice(0, 10);
            } else {
              exam_date = strDate;
            }
          }

          // Usia & Gender
          const ageNum = parseInt(row["Usia"] || row["Umur"] || row["age"] || "");
          const customer_age = isNaN(ageNum) || ageNum <= 0 ? null : ageNum;

          const rawGender = String(
            row["Jenis Kelamin (Laki-laki/Perempuan)"] ||
              row["Jenis Kelamin"] ||
              row["Gender"] ||
              row["gender"] ||
              "Laki-laki"
          ).trim().toLowerCase();
          const customer_gender =
            rawGender.startsWith("p") || rawGender.includes("wanita") || rawGender.includes("perempuan")
              ? "Perempuan"
              : "Laki-laki";

          // Pemeriksa
          const examiner_name = String(
            row["Pemeriksa (RO)"] ||
              row["Pemeriksa"] ||
              row["RO"] ||
              row["examiner_name"] ||
              "RO Optik Raja"
          ).trim();

          // OD
          const od_sph = cleanDiopter(row["OD Spheris"] || row["OD Sph"] || row["od_sph"]);
          const od_cyl = cleanDiopter(row["OD Cylinder"] || row["OD Cyl"] || row["od_cyl"]);
          const od_axis_num = parseInt(
            String(row["OD Axis"] || row["od_axis"] || "0").replace(/[^0-9]/g, "")
          );
          const od_axis = isNaN(od_axis_num) ? 0 : od_axis_num;
          const od_add = cleanDiopter(row["OD Addition"] || row["OD Add"] || row["od_add"]);
          const od_mpd_num = parseFloat(
            String(row["OD MPD"] || row["od_mpd"] || "31").replace(",", ".")
          );
          const od_mpd = isNaN(od_mpd_num) ? 31.0 : od_mpd_num;
          const od_bcva = String(row["OD BCVA"] || row["od_bcva"] || "6/6").trim() || "6/6";
          const od_ucva = String(row["OD UCVA"] || row["od_ucva"] || "6/18").trim() || "6/18";

          // OS
          const os_sph = cleanDiopter(row["OS Spheris"] || row["OS Sph"] || row["os_sph"]);
          const os_cyl = cleanDiopter(row["OS Cylinder"] || row["OS Cyl"] || row["os_cyl"]);
          const os_axis_num = parseInt(
            String(row["OS Axis"] || row["os_axis"] || "0").replace(/[^0-9]/g, "")
          );
          const os_axis = isNaN(os_axis_num) ? 0 : os_axis_num;
          const os_add = cleanDiopter(row["OS Addition"] || row["OS Add"] || row["os_add"]);
          const os_mpd_num = parseFloat(
            String(row["OS MPD"] || row["os_mpd"] || "31").replace(",", ".")
          );
          const os_mpd = isNaN(os_mpd_num) ? 31.0 : os_mpd_num;
          const os_bcva = String(row["OS BCVA"] || row["os_bcva"] || "6/6").trim() || "6/6";
          const os_ucva = String(row["OS UCVA"] || row["os_ucva"] || "6/24").trim() || "6/24";

          // Total PD
          const total_pd_input = parseFloat(
            String(row["Total PD"] || row["total_pd"] || "").replace(",", ".")
          );
          const total_pd =
            !isNaN(total_pd_input) && total_pd_input > 0
              ? total_pd_input
              : Number((od_mpd + os_mpd).toFixed(1));

          // Keluhan & Catatan
          const complaint_diagnose = String(
            row["Keluhan / Diagnosa"] ||
              row["Keluhan"] ||
              row["Diagnosa"] ||
              row["complaint_diagnose"] ||
              ""
          ).trim();
          const notes = String(
            row["Catatan Klinis"] ||
              row["Catatan"] ||
              row["Keterangan"] ||
              row["notes"] ||
              ""
          ).trim();

          const rxObj = {
            rowNum,
            customer_name,
            customer_phone,
            customer_age,
            customer_gender,
            exam_date,
            examiner_name,
            od_sph,
            od_cyl,
            od_axis,
            od_add,
            od_mpd,
            od_bcva,
            od_ucva,
            os_sph,
            os_cyl,
            os_axis,
            os_add,
            os_mpd,
            os_bcva,
            os_ucva,
            total_pd,
            complaint_diagnose,
            notes,
          };

          if (!customer_name) {
            invalid.push({ ...rxObj, error: "Nama pasien wajib diisi" });
          } else {
            valid.push(rxObj);
          }
        });

        resolve({
          valid,
          invalid,
          totalCount: rawRows.length,
        });
      } catch (err) {
        reject(new Error("Gagal membaca file Excel/CSV: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsArrayBuffer(file);
  });
}

// ==========================================
// 4. TRANSACTION BULK EXPORT UTILITIES
// ==========================================

/**
 * Exports transactions array to a formatted Excel file
 */
export function exportTransactionsToExcel(transactions, periodLabel, customFilename) {
  const wb = XLSX.utils.book_new();

  const headers = [
    "No",
    "Nomor Nota",
    "Tanggal & Waktu",
    "Nama Pelanggan",
    "Nomor Telepon",
    "Kasir / Petugas",
    "Penjamin",
    "Total Tagihan (Rp)",
    "Diskon (Rp)",
    "Subsidi BPJS (Rp)",
    "Terbayar (Rp)",
    "Sisa Piutang (Rp)",
    "Status Bayar",
    "Metode Bayar",
    "Status Pesanan",
    "Rincian Produk",
    "Catatan",
  ];

  const rows = (transactions || []).map((t, idx) => {
    const isBpjs = Number(t.bpjs_subsidy) > 0;
    const penjamin = isBpjs ? "BPJS" : "Umum";
    const labStatus = t.lab_status || (t.payment_status === "Lunas" ? "Selesai" : "Diproses");

    return [
      idx + 1,
      t.invoice_number || "-",
      t.transaction_date ? formatDateTime(t.transaction_date) : "-",
      t.customer_name || "-",
      t.customer_phone || "-",
      t.employee_name || "-",
      penjamin,
      parseFloat(t.grand_total || 0),
      parseFloat(t.discount_amount || 0),
      parseFloat(t.bpjs_subsidy || 0),
      parseFloat(t.paid_amount || 0),
      parseFloat(t.remaining_amount || 0),
      t.payment_status || "Lunas",
      t.payment_method || "Tunai",
      labStatus,
      t.items_summary || "-",
      t.notes || "-",
    ];
  });

  const wsData = [
    ["OPTIK RAJA OFFICIAL"],
    ["REKAP DAFTAR TRANSAKSI & NOTA PENJUALAN"],
    [`Periode: ${periodLabel || "Semua Data"}   |   Total Data: ${transactions.length} transaksi   |   Tanggal Ekspor: ${formatDateTime(new Date())}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 6 },  // No
    { wch: 20 }, // Nomor Nota
    { wch: 20 }, // Tanggal & Waktu
    { wch: 24 }, // Nama Pelanggan
    { wch: 18 }, // Telepon
    { wch: 20 }, // Kasir
    { wch: 14 }, // Penjamin
    { wch: 18 }, // Tagihan
    { wch: 14 }, // Diskon
    { wch: 16 }, // Subsidi BPJS
    { wch: 16 }, // Terbayar
    { wch: 16 }, // Sisa Piutang
    { wch: 16 }, // Status Bayar
    { wch: 18 }, // Metode Bayar
    { wch: 20 }, // Status Pesanan
    { wch: 36 }, // Rincian Produk
    { wch: 30 }, // Catatan
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Daftar Transaksi");
  const fileName = customFilename || createFileName("Daftar_Transaksi_Optik_Raja");
  XLSX.writeFile(wb, fileName);
  return fileName;
}
