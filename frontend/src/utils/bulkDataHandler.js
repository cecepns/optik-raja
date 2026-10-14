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
