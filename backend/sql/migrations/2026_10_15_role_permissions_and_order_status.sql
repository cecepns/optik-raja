-- ==============================================================================
-- OPTIK RAJA POS & MANAGEMENT SYSTEM
-- MIGRATION: 2026_10_15_role_permissions_and_order_status.sql
-- Tanggal: 15 Oktober 2026
-- Deskripsi: 
-- 1. Tambah kolom role_permissions di tabel settings untuk manajemen hak akses menu
-- 2. Ubah kolom role di tabel employees & users menjadi VARCHAR(50) dan migrasi ke Owner, Supervisor, Admin
-- 3. Tambah kolom order_status di tabel transactions
-- 4. Standarisasi status lab_orders menjadi 3 tahap: 'Proses Lab', 'Siap Diambil', 'Selesai'
-- 5. Sinkronisasi order_status pada transaksi lama
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Tabel settings: Tambah kolom role_permissions (JSON) jika belum ada
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 2. Tabel employees & users: Ubah kolom role menjadi VARCHAR(50) fleksibel
-- ------------------------------------------------------------------------------
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

-- Sinkronisasi username dan email default jika masih memakai optisien lama
UPDATE users
SET username = 'supervisor', email = 'budi.supervisor@optikraja.com'
WHERE username = 'optisien';

UPDATE users
SET username = 'admin', email = 'siti.admin@optikraja.com'
WHERE username = 'kasir';


-- ------------------------------------------------------------------------------
-- 3. Tabel transactions: Tambah kolom order_status jika belum ada
-- ------------------------------------------------------------------------------
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


-- ------------------------------------------------------------------------------
-- 4. Tabel lab_orders: Sederhanakan status pengerjaan menjadi 3 tahap
--    ('Proses Lab', 'Siap Diambil', 'Selesai')
-- ------------------------------------------------------------------------------
-- Ubah sementara ke VARCHAR agar migrasi data tidak memicu data truncation error
ALTER TABLE lab_orders MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Proses Lab';

-- Konversi data status lama ke status baru
UPDATE lab_orders 
SET status = 'Proses Lab' 
WHERE status IN ('Menunggu Pengerjaan', 'Pemotongan Lensa', 'Perakitan', 'Quality Control');

UPDATE lab_orders 
SET status = 'Selesai' 
WHERE status IN ('Selesai Diambil', 'selesai');

-- Kembalikan tipe kolom ke ENUM baru yang ramping
ALTER TABLE lab_orders MODIFY COLUMN status ENUM('Proses Lab', 'Siap Diambil', 'Selesai') NOT NULL DEFAULT 'Proses Lab';


-- ------------------------------------------------------------------------------
-- 5. Sinkronisasi order_status transaksi dengan lab_orders & status pelunasan
-- ------------------------------------------------------------------------------
-- Update order_status transaksi berdasarkan status di lab_orders
UPDATE transactions t
JOIN lab_orders lo ON t.id = lo.transaction_id
SET t.order_status = lo.status;

-- Transaksi lunas yang tidak memiliki lab order pending otomatis berstatus 'Selesai'
UPDATE transactions
SET order_status = 'Selesai'
WHERE payment_status = 'Lunas' 
  AND (order_status IS NULL OR order_status = 'Proses Lab')
  AND id NOT IN (
    SELECT transaction_id 
    FROM lab_orders 
    WHERE status != 'Selesai'
  );

-- ==============================================================================
-- Migrasi selesai! Database telah sinkron dengan fitur permission & status pesanan.
-- ==============================================================================
