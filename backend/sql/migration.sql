-- ==============================================================================
-- OPTIK RAJA POS & MANAGEMENT SYSTEM
-- MASTER DATABASE MIGRATION SCRIPT
-- File: backend/sql/migration.sql
-- Pembaruan Terakhir: 15 Oktober 2026
-- Deskripsi: Skrip migrasi terpusat untuk memperbarui database yang sudah berjalan
--            (Production / Development). Aman dijalankan berulang kali (Idempotent).
-- ==============================================================================

-- ==============================================================================
-- BAGIAN 1: PEMBARUAN 14 OKTOBER 2026
-- ==============================================================================

-- 1.1 Tabel products: Tambah kolom image (foto produk) jika belum ada
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

-- 1.2 Tabel expenses: Ubah kolom category menjadi VARCHAR(100) agar dinamis
ALTER TABLE expenses MODIFY COLUMN category VARCHAR(100) NOT NULL;

-- 1.3 Tabel expense_categories: Buat tabel baru untuk kelola kategori kas operasional
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

-- 1.4 Tabel transactions: Sinkronisasi transaksi nota lama dengan ID resep pelanggan
UPDATE transactions t
JOIN (
  SELECT customer_id, MAX(id) AS latest_rx_id 
  FROM prescriptions 
  GROUP BY customer_id
) p ON t.customer_id = p.customer_id
SET t.prescription_id = p.latest_rx_id
WHERE t.prescription_id IS NULL;


-- ==============================================================================
-- BAGIAN 2: PEMBARUAN 15 OKTOBER 2026 (ROLE PERMISSIONS & ORDER STATUS)
-- ==============================================================================

-- 2.1 Tabel settings: Tambah kolom role_permissions (JSON) jika belum ada
SET @exist_role_perm_col := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'settings' 
    AND COLUMN_NAME = 'role_permissions'
);

SET @sql_role_perm := IF(
  @exist_role_perm_col = 0, 
  'ALTER TABLE settings ADD COLUMN role_permissions JSON DEFAULT NULL AFTER printer_paper_size;', 
  'SELECT "Kolom role_permissions di tabel settings sudah ada" AS status;'
);
PREPARE stmt_role_perm FROM @sql_role_perm;
EXECUTE stmt_role_perm;
DEALLOCATE PREPARE stmt_role_perm;

-- Set default hak akses role Supervisor & Admin pada settings id = 1 jika masih NULL
UPDATE settings 
SET role_permissions = '{"Supervisor": ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products", "/expenses", "/reports"], "Admin": ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products"]}'
WHERE id = 1 AND (role_permissions IS NULL OR role_permissions = '');

-- 2.2 Tabel employees & users: Ubah kolom role menjadi VARCHAR(50) fleksibel
ALTER TABLE employees MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'Admin';
ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'Admin';

-- Migrasi role lama ke struktur hak akses baru:
-- Refraksionis Optisien -> Supervisor
-- Kasir & Teknisi Lab -> Admin
UPDATE employees 
SET role = 'Supervisor' 
WHERE role IN ('Refraksionis Optisien', 'supervisor');

UPDATE employees 
SET role = 'Admin' 
WHERE role IN ('Kasir', 'Teknisi Lab', 'kasir', 'teknisi');

UPDATE users 
SET role = 'Supervisor' 
WHERE role IN ('Refraksionis Optisien', 'supervisor');

UPDATE users 
SET role = 'Admin' 
WHERE role IN ('Kasir', 'Teknisi Lab', 'kasir', 'teknisi');

-- Sinkronisasi username dan email default jika masih memakai optisien/kasir lama
UPDATE users
SET username = 'supervisor', email = 'budi.supervisor@optikraja.com'
WHERE username = 'optisien';

UPDATE users
SET username = 'admin', email = 'siti.admin@optikraja.com'
WHERE username = 'kasir';

-- 2.3 Tabel transactions: Tambah kolom order_status jika belum ada
SET @exist_order_status_col := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'order_status'
);

SET @sql_order_status := IF(
  @exist_order_status_col = 0, 
  'ALTER TABLE transactions ADD COLUMN order_status ENUM("Proses Lab", "Siap Diambil", "Selesai") NOT NULL DEFAULT "Proses Lab" AFTER remaining_amount;', 
  'SELECT "Kolom order_status di tabel transactions sudah ada" AS status;'
);
PREPARE stmt_order_status FROM @sql_order_status;
EXECUTE stmt_order_status;
DEALLOCATE PREPARE stmt_order_status;

-- 2.4 Tabel lab_orders: Sederhanakan status pengerjaan menjadi 3 tahap
--    ('Proses Lab', 'Siap Diambil', 'Selesai')
-- Ubah sementara ke VARCHAR agar migrasi data tidak memicu data truncation error
ALTER TABLE lab_orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Proses Lab';

-- Konversi data status lama ke status baru
UPDATE lab_orders 
SET status = 'Proses Lab' 
WHERE status IN ('Menunggu Pengerjaan', 'Pemotongan Lensa', 'Perakitan', 'Quality Control');

UPDATE lab_orders 
SET status = 'Selesai' 
WHERE status IN ('Selesai Diambil', 'selesai');

-- Kembalikan tipe kolom ke ENUM baru
ALTER TABLE lab_orders MODIFY COLUMN status ENUM('Proses Lab', 'Siap Diambil', 'Selesai') NOT NULL DEFAULT 'Proses Lab';

-- 2.5 Sinkronisasi order_status transaksi dengan lab_orders & status pelunasan
UPDATE transactions t
JOIN lab_orders lo ON t.id = lo.transaction_id
SET t.order_status = lo.status;

UPDATE transactions t
LEFT JOIN lab_orders lo ON t.id = lo.transaction_id AND lo.status != 'Selesai'
SET t.order_status = 'Selesai'
WHERE t.payment_status = 'Lunas' 
  AND (t.order_status IS NULL OR t.order_status = 'Proses Lab')
  AND lo.id IS NULL;

-- ==============================================================================
-- Migrasi selesai! Seluruh tabel & relasi database telah mutakhir.
-- ==============================================================================
