-- Database for Optik Raja POS & Laboratory System
CREATE DATABASE IF NOT EXISTS optik_raja_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE optik_raja_db;

-- -------------------------------------------------------------
-- Nonaktifkan pengecekan foreign key sementara
-- Mencegah error #1451 saat DROP TABLE / CREATE TABLE ulang
-- -------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tabel dalam urutan dependensi terbalik (child tables first)
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS lab_orders;
DROP TABLE IF EXISTS transaction_payments;
DROP TABLE IF EXISTS transaction_items;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS prescriptions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS settings;

-- 1. Table Settings
CREATE TABLE settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  store_name VARCHAR(150) NOT NULL DEFAULT 'Optik Raja',
  optician_permit_no VARCHAR(100) DEFAULT 'SIP.RO/123/SDK-KES/2024',
  phone VARCHAR(50) DEFAULT '0812-3456-7890',
  address TEXT,
  receipt_footer TEXT,
  printer_paper_size VARCHAR(10) DEFAULT '58mm',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO settings (id, store_name, optician_permit_no, phone, address, receipt_footer, printer_paper_size)
VALUES (
  1,
  'Optik Raja Official',
  'KEMENKES RI NO. 445/RO-OPT/JBR/2024',
  '0812-9876-5432',
  'Jl. Merdeka Raya No. 88, Pusat Bisnis Nusantara',
  'Terima kasih atas kepercayaan Anda. Garansi stel kacamata & servis gratis selamanya. Garansi adaptasi lensa 30 hari.',
  '58mm'
);

-- 2. Table Employees
DROP TABLE IF EXISTS employees;
CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  role ENUM('Owner', 'Kasir', 'Refraksionis Optisien', 'Teknisi Lab') NOT NULL DEFAULT 'Kasir',
  phone VARCHAR(30),
  commission_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
  commission_rate DECIMAL(10,2) DEFAULT 2.50,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO employees (id, name, role, phone, commission_type, commission_rate, is_active) VALUES
(1, 'Raja Pratama (Owner)', 'Owner', '0811-2233-4455', 'percentage', 0.00, 1),
(2, 'Budi Santoso, A.Md.RO', 'Refraksionis Optisien', '0812-3344-5566', 'percentage', 5.00, 1),
(3, 'Siti Rahmawati', 'Kasir', '0813-4455-6677', 'percentage', 2.00, 1),
(4, 'Ahmad Fauzi', 'Teknisi Lab', '0815-5566-7788', 'fixed', 15000.00, 1),
(5, 'Dewi Lestari', 'Kasir', '0817-6677-8899', 'percentage', 2.00, 1);

-- 2.1 Table Users (Autentikasi & Manajemen Akun Pengguna)
DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('Owner', 'Kasir', 'Refraksionis Optisien', 'Teknisi Lab') NOT NULL DEFAULT 'Kasir',
  employee_id INT DEFAULT NULL,
  phone VARCHAR(30),
  avatar VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

INSERT INTO users (id, name, username, email, password, role, employee_id, phone, is_active) VALUES
(1, 'Raja Pratama (Owner)', 'owner', 'owner@optikraja.com', '$2b$10$2tj/00TLiJrwO3YLAumBduYMvAEyXSnvc0Lh0e.0YHjwdOk7B3Yty', 'Owner', 1, '0811-2233-4455', 1),
(2, 'Budi Santoso, A.Md.RO', 'optisien', 'budi.ro@optikraja.com', '$2b$10$J1cuNhkQhgIAyUfavxBH3ugO3ErHqNAbxnWN0lzc6E.FAnKxONxT.', 'Refraksionis Optisien', 2, '0812-3344-5566', 1),
(3, 'Siti Rahmawati', 'kasir', 'siti.kasir@optikraja.com', '$2b$10$4.xpV/csaqYFF9DupTEhoenMA0.bX8EOUU8CTU.45zYNJdl0g/imm', 'Kasir', 3, '0813-4455-6677', 1),
(4, 'Ahmad Fauzi', 'teknisi', 'fauzi.lab@optikraja.com', '$2b$10$JtG.q6Ot6rfLSZFcxpyaWeyXb5PElP.EVkEyR5IA8uUfAUu48KBWm', 'Teknisi Lab', 4, '0815-5566-7788', 1);

-- 3. Table Customers
DROP TABLE IF EXISTS customers;
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(20) UNIQUE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  gender ENUM('Laki-laki', 'Perempuan') NOT NULL DEFAULT 'Laki-laki',
  age INT DEFAULT NULL,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO customers (id, code, name, phone, gender, age, address, notes) VALUES
(1, 'CUST-0001', 'Hendro Wicaksono', '0812-8899-1122', 'Laki-laki', 38, 'Jl. Mawar No. 12, Kel. Menteng', 'Pasien lama, prefer frame titanium ringan'),
(2, 'CUST-0002', 'Anisa Permatasari', '0813-7766-5544', 'Perempuan', 26, 'Jl. Melati IV No. 5B', 'Sering bekerja di depan komputer > 8 jam'),
(3, 'CUST-0003', 'Dr. Irwan Syahputra', '0818-0909-3322', 'Laki-laki', 52, 'Komp. Graha Indah Blok C3', 'Membutuhkan kacamata progresif untuk membaca dan mengemudi'),
(4, 'CUST-0004', 'Putri Ayu Andini', '0821-4455-6611', 'Perempuan', 19, 'Kost Mahasiswa Asri No. 10', 'Pengguna lensa kontak dan kacamata cadangan'),
(5, 'CUST-0005', 'Bambang Sudibyo', '0857-1122-9988', 'Laki-laki', 45, 'Jl. Gatot Subroto Kav. 18', 'Peserta BPJS Kesehatan Kelas 1');

-- 4. Table Products
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(50) UNIQUE NOT NULL,
  barcode VARCHAR(50) UNIQUE,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  brand VARCHAR(80),
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  unit VARCHAR(20) DEFAULT 'Pcs',
  specifications TEXT,
  image VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO products (id, sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications) VALUES
-- Frames
(1, 'FRM-RB-5228', '8991001001', 'Frame Ray-Ban Wayfarer RX5228 Black', 'Frame', 'Ray-Ban', 650000.00, 1250000.00, 12, 'Pcs', 'Acetate, Size 53-17-140, Classic Glossy Black'),
(2, 'FRM-MSC-LEMT', '8991001002', 'Frame Moscot Lemtosh Tortoise Vintage', 'Frame', 'Moscot', 450000.00, 950000.00, 8, 'Pcs', 'Cellulose Acetate, Size 46-24-145, Vintage Amber'),
(3, 'FRM-TIT-ULTRA', '8991001003', 'Frame Titanium Rimless Ultra Light Silver', 'Frame', 'TitanTech', 380000.00, 780000.00, 15, 'Pcs', 'Pure Titanium 0.8mm, Berat 8.2g, Rimless'),
(4, 'FRM-KOR-RETRO', '8991001004', 'Frame Bulat Korean Retro TR90 Gold Clear', 'Frame', 'K-Eyewear', 95000.00, 250000.00, 30, 'Pcs', 'TR90 + Metal Temple, Fleksibel & Ringan'),
(5, 'FRM-SPT-FLEX', '8991001005', 'Frame Sporty Active Grip Matte Navy', 'Frame', 'SportOptic', 180000.00, 420000.00, 14, 'Pcs', 'TR90 Rubber Grip, Anti-slip cocok olahraga'),

-- Lenses (Per Pasang)
(6, 'LNS-CR-SHMC', '8992001001', 'Lensa Single Vision CR-MC Antiradiasi UV400', 'Lensa', 'OptiLens', 120000.00, 280000.00, 40, 'Pasang', 'Index 1.56, Multi Coating Hijau, Anti Debu & Air'),
(7, 'LNS-BLU-BLK', '8992001002', 'Lensa Bluechromic 2-in-1 (Blueray + Photochromic)', 'Lensa', 'VisionShield', 220000.00, 550000.00, 25, 'Pasang', 'Index 1.56, Gelap di luar ruangan + Blok sinar biru gadget'),
(8, 'LNS-ESS-CRZ', '8992001003', 'Lensa Essilor Crizal Sapphire HR 1.60', 'Lensa', 'Essilor', 600000.00, 1350000.00, 10, 'Pasang', 'Index 1.60 Tipis, Perlindungan 360 Kejernihan Ekstrem'),
(9, 'LNS-PROG-DLX', '8992001004', 'Lensa Progresif Leinz Easy View Freeform', 'Lensa', 'Leinz', 550000.00, 1200000.00, 8, 'Pasang', 'Digital Freeform Design, Koridor Luas untuk Jauh & Baca'),
(10, 'LNS-HI-167', '8992001005', 'Lensa Hi-Index 1.67 Aspheric Ultra Thin', 'Lensa', 'OptiLens', 350000.00, 750000.00, 16, 'Pasang', 'Index 1.67, 35% lebih tipis untuk minus tinggi (-4.00 ke atas)'),

-- Accessories
(11, 'ACC-CLN-SPRAY', '8993001001', 'Pembersih Kacamata Spray Antibakterial 60ml', 'Aksesori', 'OptiClean', 12000.00, 35000.00, 50, 'Pcs', 'Formula bebas alkohol aman untuk semua jenis coating lensa'),
(12, 'ACC-MIC-PREM', '8993001002', 'Lap Microfiber Khusus Optik Ultra Soft', 'Aksesori', 'OptiClean', 5000.00, 15000.00, 100, 'Pcs', 'Microfiber tebal 220gsm ukuran 15x18 cm'),
(13, 'ACC-HCS-LEATH', '8993001003', 'Hardcase Kacamata Kulit Sintetis Vintage Magnet', 'Aksesori', 'RajaCase', 25000.00, 65000.00, 35, 'Pcs', 'Desain lipat segitiga magnetik kuat'),
(14, 'ACC-SOL-RENU', '8993001004', 'Cairan Lensa Kontak ReNu Fresh 355ml Multiplus', 'Aksesori', 'Bausch & Lomb', 58000.00, 85000.00, 20, 'Pcs', 'Disinfeksi dan pelumas lensa kontak all-in-one');

-- 5. Table Prescriptions (Rekam Medis & Refraksi Subjektif)
DROP TABLE IF EXISTS prescriptions;
CREATE TABLE prescriptions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  customer_id INT NOT NULL,
  examiner_id INT DEFAULT NULL,
  examiner_name VARCHAR(100) NOT NULL,
  exam_date DATE NOT NULL,

  -- Right Eye (OD - Oculus Dexter)
  od_ucva VARCHAR(20) DEFAULT '6/18',
  od_sph VARCHAR(10) DEFAULT '0.00',
  od_cyl VARCHAR(10) DEFAULT '0.00',
  od_axis INT DEFAULT 0,
  od_bcva VARCHAR(20) DEFAULT '6/6',
  od_add VARCHAR(10) DEFAULT '0.00',
  od_mpd DECIMAL(4,1) DEFAULT 31.0,
  od_pv VARCHAR(20) DEFAULT '10°',
  od_sh VARCHAR(20) DEFAULT '18 mm',

  -- Left Eye (OS - Oculus Sinister)
  os_ucva VARCHAR(20) DEFAULT '6/24',
  os_sph VARCHAR(10) DEFAULT '0.00',
  os_cyl VARCHAR(10) DEFAULT '0.00',
  os_axis INT DEFAULT 0,
  os_bcva VARCHAR(20) DEFAULT '6/6',
  os_add VARCHAR(10) DEFAULT '0.00',
  os_mpd DECIMAL(4,1) DEFAULT 31.5,
  os_pv VARCHAR(20) DEFAULT '10°',
  os_sh VARCHAR(20) DEFAULT '18 mm',

  -- Additional Optical Clinic Data
  total_pd DECIMAL(4,1) DEFAULT 62.5,
  complaint_diagnose TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (examiner_id) REFERENCES employees(id) ON DELETE SET NULL
);

INSERT INTO prescriptions (
  id, customer_id, examiner_id, examiner_name, exam_date,
  od_ucva, od_sph, od_cyl, od_axis, od_bcva, od_add, od_mpd, od_pv, od_sh,
  os_ucva, os_sph, os_cyl, os_axis, os_bcva, os_add, os_mpd, os_pv, os_sh,
  total_pd, complaint_diagnose, notes
) VALUES
(
  1, 1, 2, 'Budi Santoso, A.Md.RO', '2026-10-10',
  '6/18', '-2.25', '-0.50', 85, '6/6', '+0.00', 31.0, '10°', '19 mm',
  '6/24', '-2.75', '-0.75', 95, '6/6', '+0.00', 31.5, '10°', '19 mm',
  62.5, 'Penglihatan buram saat melihat jauh dan silau malam hari', 'Disarankan lensa Bluechromic index 1.56 untuk kenyamanan berkendara malam'
),
(
  2, 2, 2, 'Budi Santoso, A.Md.RO', '2026-10-11',
  '6/12', '-1.50', '-0.25', 180, '6/6', '+0.00', 30.0, '9°', '18 mm',
  '6/15', '-1.75', '-0.50', 175, '6/6', '+0.00', 30.5, '9°', '18 mm',
  60.5, 'Mata cepat lelah, perih, dan sering pusing saat menatap laptop kantor lama', 'Rekomendasi lensa Anti-Radiasi Blue Light Filter Crizal'
),
(
  3, 3, 2, 'Budi Santoso, A.Md.RO', '2026-10-12',
  '6/30', '+1.25', '-0.50', 90, '6/6', '+2.25', 32.0, '12°', '21 mm',
  '6/30', '+1.50', '-0.75', 90, '6/6', '+2.25', 32.0, '12°', '21 mm',
  64.0, 'Presbiopia usia 52 tahun, membaca tulisan kecil harus menjauhkan buku, sering pusing bila berganti fokus jauh-dekat', 'Resep Progresif Digital Leinz Easy View Freeform'
);

-- 6. Table Transactions
DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id INT NOT NULL,
  employee_id INT NOT NULL,
  prescription_id INT DEFAULT NULL,
  transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completion_estimate DATE DEFAULT NULL,

  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bpjs_subsidy DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  change_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('Lunas', 'DP', 'Belum Lunas') NOT NULL DEFAULT 'Lunas',
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Tunai',

  dp_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE SET NULL
);

-- 7. Table Transaction Items
DROP TABLE IF EXISTS transaction_items;
CREATE TABLE transaction_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL,
  product_id INT DEFAULT NULL,
  product_name VARCHAR(150) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  quantity INT NOT NULL DEFAULT 1,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_price DECIMAL(12,2) NOT NULL,
  notes TEXT,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 8. Table Transaction Payments (Pelunasan & Log Pembayaran)
DROP TABLE IF EXISTS transaction_payments;
CREATE TABLE transaction_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  transaction_id INT NOT NULL,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_type ENUM('DP', 'Pelunasan', 'Pembayaran Penuh') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Tunai',
  notes VARCHAR(255),
  employee_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- 9. Table Lab Orders (Pelacakan Status Fasetting Lab)
DROP TABLE IF EXISTS lab_orders;
CREATE TABLE lab_orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  transaction_id INT NOT NULL,
  customer_id INT NOT NULL,
  technician_id INT DEFAULT NULL,
  order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estimated_date DATE DEFAULT NULL,
  completed_date DATETIME DEFAULT NULL,
  status ENUM('Menunggu Pengerjaan', 'Pemotongan Lensa', 'Perakitan', 'Quality Control', 'Siap Diambil', 'Selesai Diambil') NOT NULL DEFAULT 'Menunggu Pengerjaan',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (technician_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- 10. Table Expense Categories (Kategori Pengeluaran Kas)
DROP TABLE IF EXISTS expense_categories;
CREATE TABLE expense_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO expense_categories (id, name, description) VALUES
(1, 'Operasional Toko', 'Biaya umum dan kebutuhan harian operasional toko optik'),
(2, 'Listrik & Air', 'Tagihan rutin PLN, PDAM, dan internet optik'),
(3, 'Pembelian Bahan/Lensa', 'Pengadaan lensa mentah, frame display, dan sparepart optik'),
(4, 'Gaji & Bonus', 'Gaji staf, bonus penjualan, dan insentif RO'),
(5, 'Sewa Tempat', 'Biaya sewa outlet ruko atau toko optik'),
(6, 'Perawatan Mesin', 'Servis rutin mesin faset/edger dan kalibrasi auto-refraktor'),
(7, 'Lain-lain', 'Pengeluaran kas kecil lainnya yang belum terklasifikasi');

-- 11. Table Expenses (Pengeluaran Operasional)
DROP TABLE IF EXISTS expenses;
CREATE TABLE expenses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  recipient VARCHAR(100),
  employee_id INT DEFAULT NULL,
  attachment VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- Sample Transactions & Lab Data
-- Transaction 1: Lunas (Ray-Ban + Lensa Bluechromic)
INSERT INTO transactions (
  id, invoice_number, customer_id, employee_id, prescription_id,
  transaction_date, completion_estimate,
  subtotal, discount_amount, bpjs_subsidy, grand_total,
  paid_amount, change_amount, payment_status, payment_method,
  dp_amount, remaining_amount, notes
) VALUES (
  1, 'TRX-20261011-0001', 1, 3, 1,
  '2026-10-11 10:30:00', '2026-10-13',
  1800000.00, 50000.00, 0.00, 1750000.00,
  1750000.00, 0.00, 'Lunas', 'Transfer',
  1750000.00, 0.00, 'Kacamata kerja Hendro'
);

INSERT INTO transaction_items (transaction_id, product_id, product_name, category, price, cost_price, quantity, discount, total_price) VALUES
(1, 1, 'Frame Ray-Ban Wayfarer RX5228 Black', 'Frame', 1250000.00, 650000.00, 1, 50000.00, 1200000.00),
(1, 7, 'Lensa Bluechromic 2-in-1 (Blueray + Photochromic)', 'Lensa', 550000.00, 220000.00, 1, 0.00, 550000.00);

INSERT INTO transaction_payments (transaction_id, payment_date, payment_type, amount, payment_method, notes, employee_id) VALUES
(1, '2026-10-11 10:30:00', 'Pembayaran Penuh', 1750000.00, 'Transfer', 'Lunas via BCA', 3);

INSERT INTO lab_orders (id, order_number, transaction_id, customer_id, technician_id, order_date, estimated_date, status, notes) VALUES
(1, 'LAB-20261011-001', 1, 1, 4, '2026-10-11 10:45:00', '2026-10-13', 'Siap Diambil', 'Sudah lolos QC, lensa presisi dan bersih');

-- Transaction 2: DP (Titanium Rimless + Essilor Crizal)
INSERT INTO transactions (
  id, invoice_number, customer_id, employee_id, prescription_id,
  transaction_date, completion_estimate,
  subtotal, discount_amount, bpjs_subsidy, grand_total,
  paid_amount, change_amount, payment_status, payment_method,
  dp_amount, remaining_amount, notes
) VALUES (
  2, 'TRX-20261012-0002', 2, 5, 2,
  '2026-10-12 14:15:00', '2026-10-14',
  2130000.00, 0.00, 0.00, 2130000.00,
  1000000.00, 0.00, 'DP', 'Tunai',
  1000000.00, 1130000.00, 'DP 1 Juta, sisa tagihan 1.130.000 saat ambil kacamata'
);

INSERT INTO transaction_items (transaction_id, product_id, product_name, category, price, cost_price, quantity, discount, total_price) VALUES
(2, 3, 'Frame Titanium Rimless Ultra Light Silver', 'Frame', 780000.00, 380000.00, 1, 0.00, 780000.00),
(2, 8, 'Lensa Essilor Crizal Sapphire HR 1.60', 'Lensa', 1350000.00, 600000.00, 1, 0.00, 1350000.00);

INSERT INTO transaction_payments (transaction_id, payment_date, payment_type, amount, payment_method, notes, employee_id) VALUES
(2, '2026-10-12 14:15:00', 'DP', 1000000.00, 'Tunai', 'DP Tunai Pertama', 5);

INSERT INTO lab_orders (id, order_number, transaction_id, customer_id, technician_id, order_date, estimated_date, status, notes) VALUES
(2, 'LAB-20261012-002', 2, 2, 4, '2026-10-12 14:30:00', '2026-10-14', 'Pemotongan Lensa', 'Sedang proses fasetting mesin edger');

-- Transaction 3: Progresif + Subsidi BPJS
INSERT INTO transactions (
  id, invoice_number, customer_id, employee_id, prescription_id,
  transaction_date, completion_estimate,
  subtotal, discount_amount, bpjs_subsidy, grand_total,
  paid_amount, change_amount, payment_status, payment_method,
  dp_amount, remaining_amount, notes
) VALUES (
  3, 'TRX-20261013-0003', 3, 3, 3,
  '2026-10-13 09:20:00', '2026-10-15',
  2150000.00, 0.00, 330000.00, 1820000.00,
  1820000.00, 0.00, 'Lunas', 'BPJS + Tunai',
  1820000.00, 0.00, 'Klaim BPJS Kelas 1 (Rp 330.000)'
);

INSERT INTO transaction_items (transaction_id, product_id, product_name, category, price, cost_price, quantity, discount, total_price) VALUES
(3, 2, 'Frame Moscot Lemtosh Tortoise Vintage', 'Frame', 950000.00, 450000.00, 1, 0.00, 950000.00),
(3, 9, 'Lensa Progresif Leinz Easy View Freeform', 'Lensa', 1200000.00, 550000.00, 1, 0.00, 1200000.00);

INSERT INTO transaction_payments (transaction_id, payment_date, payment_type, amount, payment_method, notes, employee_id) VALUES
(3, '2026-10-13 09:20:00', 'Pembayaran Penuh', 1820000.00, 'Tunai', 'Pelunasan sisa setelah subsidi BPJS', 3);

INSERT INTO lab_orders (id, order_number, transaction_id, customer_id, technician_id, order_date, estimated_date, status, notes) VALUES
(3, 'LAB-20261013-003', 3, 3, 4, '2026-10-13 09:40:00', '2026-10-15', 'Menunggu Pengerjaan', 'Bahan lensa baru masuk antrean lab');

-- Sample Expenses
INSERT INTO expenses (expense_date, category, amount, description, recipient, employee_id) VALUES
('2026-10-01', 'Sewa Tempat', 3500000.00, 'Pembayaran sewa ruko operasional bulan Oktober', 'Ibu Hj. Aminah', 1),
('2026-10-05', 'Pembelian Bahan/Lensa', 1850000.00, 'Restok bahan lensa CR-MC dan cairan pembersih dari distributor', 'CV Optik Distribusi Prima', 1),
('2026-10-08', 'Listrik & Air', 485000.00, 'Tagihan PLN pascabayar & PAM toko optik', 'PLN & PDAM', 3),
('2026-10-10', 'Perawatan Mesin', 350000.00, 'Kalibrasi dan penggantian mata pisau edger fasetting', 'Teknisi Servis Edger Mandiri', 4),
('2026-10-12', 'Operasional Toko', 125000.00, 'Pembelian kertas struk thermal 58mm & tisu optik', 'Toko ATK Berkah', 3);

-- -------------------------------------------------------------
-- Aktifkan kembali pengecekan foreign key
-- -------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 1;

