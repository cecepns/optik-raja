-- ==============================================================================
-- OPTIK RAJA POS & MANAGEMENT SYSTEM
-- DATABASE MIGRATION SCRIPT
-- File: backend/sql/migration.sql
-- Tanggal: 14 Oktober 2026
-- Deskripsi: Skrip migrasi untuk memperbarui database yang sudah berjalan (Production/Dev)
--            Aman dijalankan berulang kali (Idempotent).
-- ==============================================================================

-- 1. Tabel products: Tambah kolom image (foto produk) jika belum ada
SET @exist_img_col := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'products' 
    AND COLUMN_NAME = 'image'
);
SET @sql_img := IF(
  @exist_img_col = 0, 
  'ALTER TABLE products ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER specifications;', 
  'SELECT "Kolom image di tabel products sudah ada" AS status;'
);
PREPARE stmt_img FROM @sql_img;
EXECUTE stmt_img;
DEALLOCATE PREPARE stmt_img;

-- Update kolom category di tabel products agar mendukung 'Lensa Kontak' dan kategori lainnya
ALTER TABLE products MODIFY COLUMN category VARCHAR(50) NOT NULL;

-- 2. Tabel expenses: Ubah kolom category menjadi VARCHAR(100) agar mendukung kategori pengeluaran dinamis
ALTER TABLE expenses MODIFY COLUMN category VARCHAR(100) NOT NULL;

-- 3. Tabel expense_categories: Buat tabel baru untuk kelola kategori kas operasional (Tambah, Edit, Hapus)
CREATE TABLE IF NOT EXISTS expense_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Isi kategori bawaan (seed) jika tabel masih kosong
INSERT IGNORE INTO expense_categories (id, name, description) VALUES
(1, 'Operasional Toko', 'Biaya umum dan operasional harian toko optik'),
(2, 'Listrik & Air', 'Tagihan rutin utilitas PLN, PDAM, dan internet optik'),
(3, 'Pembelian Bahan/Lensa', 'Pengadaan lensa mentah, sparepart, cairan, dan frame'),
(4, 'Gaji & Bonus', 'Gaji staf, bonus penjualan, dan insentif RO'),
(5, 'Sewa Tempat', 'Biaya sewa outlet ruko atau toko optik'),
(6, 'Perawatan Mesin', 'Servis rutin mesin edger/faset dan kalibrasi alat optik'),
(7, 'Lain-lain', 'Pengeluaran kas kecil lainnya yang belum terklasifikasi');

-- 4. Tabel users: Pastikan role mencakup Refraksionis Optisien dan Teknisi Lab
ALTER TABLE users MODIFY COLUMN role ENUM('Owner', 'Kasir', 'Refraksionis Optisien', 'Teknisi Lab') NOT NULL DEFAULT 'Kasir';

-- 5. Tabel transactions: Sinkronisasi transaksi nota lama dengan ID resep/rekam medis pelanggan
UPDATE transactions t
JOIN (
  SELECT customer_id, MAX(id) AS latest_rx_id 
  FROM prescriptions 
  GROUP BY customer_id
) p ON t.customer_id = p.customer_id
SET t.prescription_id = p.latest_rx_id
WHERE t.prescription_id IS NULL;

-- ==============================================================================
-- Migrasi selesai! Semua tabel siap digunakan dengan fitur-fitur terbaru.
-- ==============================================================================
