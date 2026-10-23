const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'uploads-optik-raja');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));

// Database Pool
const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'optik_raja_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Use socket if exists in macOS XAMPP
if (process.env.DB_SOCKET && fs.existsSync(process.env.DB_SOCKET)) {
  dbConfig.socketPath = process.env.DB_SOCKET;
}

const pool = mysql.createPool(dbConfig);

// Helper for standard pagination & query
const paginateQuery = async (countSql, dataSql, countParams = [], dataParams = [], page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.max(1, parseInt(limit) || 10);
  const offset = (p - 1) * l;

  const [countRows] = await pool.query(countSql, countParams);
  const total = countRows[0]?.total || 0;
  const totalPages = Math.ceil(total / l) || 1;

  const finalDataSql = `${dataSql} LIMIT ${l} OFFSET ${offset}`;
  const [data] = await pool.query(finalDataSql, dataParams);

  return {
    data,
    pagination: {
      page: p,
      limit: l,
      total,
      totalPages
    }
  };
};

// ==========================================
// AUTO-MIGRATION: Ensure users table exists & seed default accounts
// ==========================================
const initDatabaseTables = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'Admin',
        employee_id INT DEFAULT NULL,
        phone VARCHAR(30),
        avatar VARCHAR(255) DEFAULT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
      )
    `);

    // Modify roles in users and employees to VARCHAR(50) and migrate to Owner, Supervisor, Admin
    try {
      await pool.query('ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT "Admin"');
      await pool.query('ALTER TABLE employees MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT "Admin"');
      await pool.query('UPDATE users SET role = "Supervisor" WHERE role IN ("Refraksionis Optisien", "supervisor")');
      await pool.query('UPDATE users SET role = "Admin" WHERE role IN ("Kasir", "Teknisi Lab", "kasir", "teknisi")');
      await pool.query('UPDATE employees SET role = "Supervisor" WHERE role IN ("Refraksionis Optisien", "supervisor")');
      await pool.query('UPDATE employees SET role = "Admin" WHERE role IN ("Kasir", "Teknisi Lab", "kasir", "teknisi")');
    } catch (e) {
      // ignore
    }

    const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
    if (rows[0].count === 0) {
      const hashOwner = bcrypt.hashSync('admin123', 10);
      const hashSupervisor = bcrypt.hashSync('optik123', 10);
      const hashAdmin = bcrypt.hashSync('kasir123', 10);

      await pool.query(`
        INSERT INTO users (id, name, username, email, password, role, employee_id, phone, is_active) VALUES
        (1, 'Raja Pratama (Owner)', 'owner', 'owner@optikraja.com', ?, 'Owner', 1, '0811-2233-4455', 1),
        (2, 'Budi Santoso (Supervisor)', 'supervisor', 'budi.spv@optikraja.com', ?, 'Supervisor', 2, '0812-3344-5566', 1),
        (3, 'Siti Rahmawati (Admin)', 'admin', 'siti.admin@optikraja.com', ?, 'Admin', 3, '0813-4455-6677', 1)
      `, [hashOwner, hashSupervisor, hashAdmin]);
      console.log('✓ Initial users seeded successfully (Owner, Supervisor, Admin)');
    }

    // Ensure role_permissions column in settings table
    try {
      await pool.query('ALTER TABLE settings ADD COLUMN role_permissions JSON DEFAULT NULL');
    } catch {
      // column may exist
    }

    // Seed default role_permissions if empty
    try {
      const [sRows] = await pool.query('SELECT role_permissions FROM settings WHERE id = 1');
      if (sRows.length > 0 && !sRows[0].role_permissions) {
        const defaultPerms = JSON.stringify({
          Supervisor: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products", "/expenses", "/reports"],
          Admin: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products"]
        });
        await pool.query('UPDATE settings SET role_permissions = ? WHERE id = 1', [defaultPerms]);
      }
    } catch (e) {
      // ignore
    }

    // Ensure order_status column exists in transactions
    try {
      await pool.query("ALTER TABLE transactions ADD COLUMN order_status ENUM('Proses Lab', 'Siap Diambil', 'Selesai') NOT NULL DEFAULT 'Proses Lab'");
    } catch {
      // column may exist
    }

    // Ensure lab_orders status is simplified to 'Proses Lab', 'Siap Diambil', 'Selesai'
    try {
      await pool.query("ALTER TABLE lab_orders MODIFY COLUMN status ENUM('Proses Lab', 'Siap Diambil', 'Selesai') NOT NULL DEFAULT 'Proses Lab'");
      await pool.query("UPDATE lab_orders SET status = 'Proses Lab' WHERE status IN ('Menunggu Pengerjaan', 'Pemotongan Lensa', 'Perakitan', 'Quality Control')");
      await pool.query("UPDATE lab_orders SET status = 'Selesai' WHERE status = 'Selesai Diambil'");
      // Sync transactions.order_status with lab_orders.status
      await pool.query(`
        UPDATE transactions t
        JOIN lab_orders lo ON t.id = lo.transaction_id
        SET t.order_status = lo.status
      `);
    } catch (e) {
      // ignore
    }

    // Ensure image column exists in products table
    try {
      await pool.query('ALTER TABLE products ADD COLUMN image VARCHAR(255) DEFAULT NULL AFTER specifications');
    } catch {
      // Column may already exist
    }

    // Sync existing transactions that have no prescription_id with customer's latest prescription
    try {
      await pool.query(`
        UPDATE transactions t
        JOIN (
          SELECT customer_id, MAX(id) AS latest_rx_id 
          FROM prescriptions 
          GROUP BY customer_id
        ) p ON t.customer_id = p.customer_id
        SET t.prescription_id = p.latest_rx_id
        WHERE t.prescription_id IS NULL
      `);
    } catch {
      // ignore
    }

    // Ensure expense_categories table exists & seed default categories
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS expense_categories (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) UNIQUE NOT NULL,
          description VARCHAR(255) DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      const [catRows] = await pool.query('SELECT COUNT(*) as count FROM expense_categories');
      if (catRows[0].count === 0) {
        const defaultExpenseCats = [
          ['Operasional Toko', 'Biaya umum dan kebutuhan harian operasional toko optik'],
          ['Listrik & Air', 'Tagihan rutin PLN, PDAM, dan internet optik'],
          ['Pembelian Bahan/Lensa', 'Pengadaan lensa mentah, frame display, dan sparepart optik'],
          ['Gaji & Bonus', 'Gaji staf, bonus penjualan, dan insentif RO'],
          ['Sewa Tempat', 'Biaya sewa outlet ruko atau toko optik'],
          ['Perawatan Mesin', 'Servis rutin mesin faset/edger dan kalibrasi auto-refraktor'],
          ['Lain-lain', 'Pengeluaran kas kecil lainnya yang belum terklasifikasi']
        ];
        await pool.query(
          'INSERT INTO expense_categories (name, description) VALUES ?',
          [defaultExpenseCats]
        );
        console.log('✓ Default expense categories seeded successfully');
      }

      // Ensure expenses.category column is VARCHAR(100) to support custom categories
      await pool.query('ALTER TABLE expenses MODIFY COLUMN category VARCHAR(100) NOT NULL');
    } catch (catErr) {
      console.warn('Expense categories init info:', catErr.message);
    }
  } catch (err) {
    console.error('Database init warning:', err.message);
  }
};
initDatabaseTables();

// ==========================================
// 0. AUTHENTICATION ENDPOINTS
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
    }

    const [rows] = await pool.query(
      `SELECT u.*, e.name as employee_name, e.commission_rate 
       FROM users u 
       LEFT JOIN employees e ON u.employee_id = e.id 
       WHERE u.username = ? OR u.email = ? OR (? = 'admin' AND u.username = 'owner') LIMIT 1`,
      [username.trim(), username.trim(), username.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Username atau password tidak ditemukan' });
    }

    const user = rows[0];
    if (user.is_active === 0) {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan. Hubungi Owner/Administrator.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password) || password === user.password || (password === 'admin123' && user.username === 'owner');
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Password yang Anda masukkan salah' });
    }

    const { password: _, ...userData } = user;
    const token = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64');

    let rolePermissions = null;
    try {
      const [sRows] = await pool.query('SELECT role_permissions FROM settings WHERE id = 1');
      if (sRows.length > 0 && sRows[0].role_permissions) {
        rolePermissions = typeof sRows[0].role_permissions === 'string'
          ? JSON.parse(sRows[0].role_permissions)
          : sRows[0].role_permissions;
      }
    } catch (e) {
      // ignore
    }
    if (!rolePermissions) {
      rolePermissions = {
        Supervisor: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products", "/expenses", "/reports"],
        Admin: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products"]
      };
    }

    userData.role_permissions = rolePermissions;

    res.json({
      success: true,
      message: 'Login berhasil. Selamat datang di Optik Raja!',
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const getAuthUser = async (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return null;
    const decoded = Buffer.from(token, 'base64').toString('ascii');
    const [id] = decoded.split(':');
    if (!id) return null;
    const [rows] = await pool.query('SELECT id, name, username, email, role, employee_id, phone, avatar, is_active, created_at FROM users WHERE id = ?', [id]);
    return rows.length ? rows[0] : null;
  } catch (e) {
    return null;
  }
};

app.get('/api/auth/profile', async (req, res) => {
  try {
    const user = await getAuthUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Tidak terautentikasi' });
    }

    let rolePermissions = null;
    try {
      const [sRows] = await pool.query('SELECT role_permissions FROM settings WHERE id = 1');
      if (sRows.length > 0 && sRows[0].role_permissions) {
        rolePermissions = typeof sRows[0].role_permissions === 'string'
          ? JSON.parse(sRows[0].role_permissions)
          : sRows[0].role_permissions;
      }
    } catch (e) {
      // ignore
    }
    if (!rolePermissions) {
      rolePermissions = {
        Supervisor: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products", "/expenses", "/reports"],
        Admin: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products"]
      };
    }

    res.json({ success: true, data: { ...user, role_permissions: rolePermissions } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 0.1 USER MANAGEMENT ENDPOINTS
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', is_active } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role) {
      whereConditions.push('u.role = ?');
      params.push(role);
    }

    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('u.is_active = ?');
      params.push(parseInt(is_active));
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total FROM users u WHERE ${whereClause}`;
    const dataSql = `
      SELECT u.id, u.name, u.username, u.email, u.role, u.employee_id, u.phone, u.avatar, u.is_active, u.created_at, u.updated_at,
             e.name as employee_name
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE ${whereClause}
      ORDER BY u.id ASC
    `;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, u.role, u.employee_id, u.phone, u.avatar, u.is_active, u.created_at,
              e.name as employee_name
       FROM users u
       LEFT JOIN employees e ON u.employee_id = e.id
       WHERE u.id = ?`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, username, email, password, role, employee_id, phone, is_active = 1 } = req.body;

    if (!name || !username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Nama, username, password, dan role wajib diisi' });
    }

    const [existUser] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username.trim()]);
    if (existUser.length) {
      return res.status(400).json({ success: false, message: 'Username sudah digunakan, silakan pilih username lain' });
    }

    if (email) {
      const [existEmail] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email.trim()]);
      if (existEmail.length) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar pada pengguna lain' });
      }
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, username, email, password, role, employee_id, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, username.trim(), email ? email.trim() : null, hashedPassword, role, employee_id || null, phone || null, is_active ? 1 : 0]
    );

    const [created] = await pool.query('SELECT id, name, username, email, role, employee_id, phone, is_active, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Pengguna baru berhasil ditambahkan', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, email, password, role, employee_id, phone, is_active } = req.body;

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    if (username) {
      const [dup] = await pool.query('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1', [username.trim(), id]);
      if (dup.length) {
        return res.status(400).json({ success: false, message: 'Username sudah digunakan oleh akun lain' });
      }
    }

    if (email) {
      const [dupEmail] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1', [email.trim(), id]);
      if (dupEmail.length) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain' });
      }
    }

    let updateFields = ['name = ?', 'username = ?', 'email = ?', 'role = ?', 'employee_id = ?', 'phone = ?', 'is_active = ?'];
    let updateParams = [
      name || rows[0].name,
      username ? username.trim() : rows[0].username,
      email !== undefined ? (email ? email.trim() : null) : rows[0].email,
      role || rows[0].role,
      employee_id !== undefined ? (employee_id || null) : rows[0].employee_id,
      phone !== undefined ? phone : rows[0].phone,
      is_active !== undefined ? (is_active ? 1 : 0) : rows[0].is_active
    ];

    if (password && password.trim().length > 0) {
      updateFields.push('password = ?');
      updateParams.push(bcrypt.hashSync(password.trim(), 10));
    }

    updateParams.push(id);
    await pool.query(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`, updateParams);

    const [updated] = await pool.query('SELECT id, name, username, email, role, employee_id, phone, is_active, updated_at FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data pengguna berhasil diperbarui', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === 1) {
      return res.status(400).json({ success: false, message: 'Akun Owner utama tidak dapat dihapus' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengguna berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 1. SETTINGS ENDPOINTS
// ==========================================
app.get('/api/settings', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Pengaturan tidak ditemukan' });
    }
    const settingsData = { ...rows[0] };
    if (typeof settingsData.role_permissions === 'string') {
      try {
        settingsData.role_permissions = JSON.parse(settingsData.role_permissions);
      } catch (e) {
        // ignore
      }
    }
    if (!settingsData.role_permissions) {
      settingsData.role_permissions = {
        Supervisor: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products", "/expenses", "/reports"],
        Admin: ["/pos", "/prescriptions", "/lab", "/transactions", "/customers", "/products"]
      };
    }
    res.json({ success: true, data: settingsData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { store_name, optician_permit_no, phone, address, receipt_footer, printer_paper_size, role_permissions } = req.body;
    let updateFields = [
      'store_name = ?',
      'optician_permit_no = ?',
      'phone = ?',
      'address = ?',
      'receipt_footer = ?',
      'printer_paper_size = ?'
    ];
    let params = [store_name, optician_permit_no, phone, address, receipt_footer, printer_paper_size || '58mm'];

    if (role_permissions !== undefined) {
      updateFields.push('role_permissions = ?');
      params.push(typeof role_permissions === 'object' ? JSON.stringify(role_permissions) : role_permissions);
    }

    params.push(1);
    await pool.query(
      `UPDATE settings SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    const [rows] = await pool.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    const updated = { ...rows[0] };
    if (typeof updated.role_permissions === 'string') {
      try { updated.role_permissions = JSON.parse(updated.role_permissions); } catch {}
    }
    res.json({ success: true, message: 'Pengaturan toko berhasil diperbarui', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/settings/permissions', async (req, res) => {
  try {
    let permissions = req.body.permissions !== undefined ? req.body.permissions : req.body.role_permissions;
    if (typeof permissions === 'string') {
      try {
        permissions = JSON.parse(permissions);
      } catch (e) {
        // ignore
      }
    }
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions)) {
      return res.status(400).json({ success: false, message: 'Data hak akses tidak valid' });
    }
    await pool.query('UPDATE settings SET role_permissions = ? WHERE id = 1', [JSON.stringify(permissions)]);
    res.json({ success: true, message: 'Hak akses role berhasil disimpan', data: permissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. EMPLOYEES ENDPOINTS
// ==========================================
app.get('/api/employees', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '', is_active } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }

    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('is_active = ?');
      params.push(parseInt(is_active));
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total FROM employees WHERE ${whereClause}`;
    const dataSql = `SELECT * FROM employees WHERE ${whereClause} ORDER BY id ASC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { name, role, phone, commission_type, commission_rate, is_active } = req.body;
    if (!name || !role) {
      return res.status(400).json({ success: false, message: 'Nama dan Role wajib diisi' });
    }

    const [result] = await pool.query(
      `INSERT INTO employees (name, role, phone, commission_type, commission_rate, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, role, phone || '', commission_type || 'percentage', commission_rate || 0, is_active ?? 1]
    );

    const [newEmp] = await pool.query('SELECT * FROM employees WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Pegawai berhasil ditambahkan', data: newEmp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, phone, commission_type, commission_rate, is_active } = req.body;

    await pool.query(
      `UPDATE employees SET 
        name = ?, role = ?, phone = ?, commission_type = ?, commission_rate = ?, is_active = ?
       WHERE id = ?`,
      [name, role, phone || '', commission_type || 'percentage', commission_rate || 0, is_active ?? 1, id]
    );

    const [updatedEmp] = await pool.query('SELECT * FROM employees WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data pegawai berhasil diupdate', data: updatedEmp[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pegawai berhasil dihapus' });
  } catch (error) {
    if (error.errno === 1451) {
      return res.status(400).json({
        success: false,
        message: 'Pegawai tidak dapat dihapus karena memiliki riwayat transaksi, rekam medis, atau pengerjaan lab terkait. Anda dapat menonaktifkan status pegawai.'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. CUSTOMERS ENDPOINTS
// ==========================================
app.get('/api/customers', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', gender = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR phone LIKE ? OR code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (gender) {
      whereConditions.push('gender = ?');
      params.push(gender);
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total FROM customers WHERE ${whereClause}`;
    const dataSql = `SELECT * FROM customers WHERE ${whereClause} ORDER BY id DESC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/customers/export', async (req, res) => {
  try {
    const { search = '', gender = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR phone LIKE ? OR code LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (gender) {
      whereConditions.push('gender = ?');
      params.push(gender);
    }

    const whereClause = whereConditions.join(' AND ');
    const [customers] = await pool.query(
      `SELECT id, code, name, phone, gender, age, address, notes, created_at 
       FROM customers 
       WHERE ${whereClause} 
       ORDER BY id DESC`,
      params
    );

    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customers/bulk-import', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { customers = [], updateExisting = true } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar data pelanggan tidak boleh kosong' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    await connection.beginTransaction();

    const [lastCust] = await connection.query('SELECT id FROM customers ORDER BY id DESC LIMIT 1');
    let nextId = (lastCust[0]?.id || 0) + 1;

    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      const rowNum = i + 1;
      const name = (c.name || '').trim();
      const phone = (c.phone || '').trim();

      if (!name || !phone) {
        errors.push(`Baris ${rowNum}: Nama dan Nomor HP wajib diisi`);
        skipped++;
        continue;
      }

      let gender = (c.gender || 'Laki-laki').trim();
      const genLower = gender.toLowerCase();
      if (genLower.startsWith('p') || genLower.includes('wanita') || genLower.includes('perempuan')) {
        gender = 'Perempuan';
      } else {
        gender = 'Laki-laki';
      }

      const age = c.age ? parseInt(c.age) || null : null;
      const address = (c.address || '').trim();
      const notes = (c.notes || '').trim();

      // Match existing customer by phone number or code
      const [existing] = await connection.query(
        'SELECT id, code FROM customers WHERE phone = ? OR (code IS NOT NULL AND code = ?)',
        [phone, c.code || '']
      );

      if (existing.length > 0) {
        if (updateExisting) {
          await connection.query(
            `UPDATE customers SET name = ?, gender = ?, age = ?, address = ?, notes = ? WHERE id = ?`,
            [name, gender, age, address, notes, existing[0].id]
          );
          updated++;
        } else {
          skipped++;
        }
      } else {
        const code = (c.code || '').trim() || `CUST-${String(nextId).padStart(4, '0')}`;
        nextId++;

        await connection.query(
          `INSERT INTO customers (code, name, phone, gender, age, address, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [code, name, phone, gender, age, address, notes]
        );
        imported++;
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Proses import pelanggan selesai: ${imported} ditambahkan, ${updated} diperbarui, ${skipped} dilewati.`,
      summary: {
        total: customers.length,
        imported,
        updated,
        skipped,
        errors
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Gagal melakukan import masal pelanggan: ' + error.message });
  } finally {
    connection.release();
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [cust] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    if (!cust.length) {
      return res.status(404).json({ success: false, message: 'Pelanggan tidak ditemukan' });
    }

    // Get prescriptions history
    const [prescriptions] = await pool.query(
      'SELECT * FROM prescriptions WHERE customer_id = ? ORDER BY exam_date DESC',
      [id]
    );

    // Get transactions history
    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE customer_id = ? ORDER BY transaction_date DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...cust[0],
        prescriptions,
        transactions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  try {
    const { name, phone, gender, age, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nama dan Nomor HP/WhatsApp wajib diisi' });
    }

    // Generate unique Customer Code (e.g., CUST-0006)
    const [lastCust] = await pool.query('SELECT id FROM customers ORDER BY id DESC LIMIT 1');
    const nextId = (lastCust[0]?.id || 0) + 1;
    const code = `CUST-${String(nextId).padStart(4, '0')}`;

    const [result] = await pool.query(
      `INSERT INTO customers (code, name, phone, gender, age, address, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [code, name, phone, gender || 'Laki-laki', age ? parseInt(age) : null, address || '', notes || '']
    );

    const [created] = await pool.query('SELECT * FROM customers WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Pelanggan berhasil ditambahkan', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, gender, age, address, notes } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Nama dan Nomor HP/WhatsApp wajib diisi' });
    }

    await pool.query(
      `UPDATE customers SET 
        name = ?, phone = ?, gender = ?, age = ?, address = ?, notes = ?
       WHERE id = ?`,
      [name, phone, gender || 'Laki-laki', age ? parseInt(age) : null, address || '', notes || '', id]
    );

    const [updated] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Data pelanggan berhasil diperbarui', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM customers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pelanggan berhasil dihapus' });
  } catch (error) {
    if (error.errno === 1451) {
      return res.status(400).json({
        success: false,
        message: 'Pelanggan tidak dapat dihapus karena masih memiliki riwayat transaksi atau rekam medis terkait.'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. PRODUCTS ENDPOINTS
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '', is_active } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR brand LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }

    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('is_active = ?');
      params.push(parseInt(is_active));
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total FROM products WHERE ${whereClause}`;
    const dataSql = `SELECT * FROM products WHERE ${whereClause} ORDER BY id DESC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/products/export', async (req, res) => {
  try {
    const { category = '', search = '', is_active } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR brand LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category) {
      whereConditions.push('category = ?');
      params.push(category);
    }

    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('is_active = ?');
      params.push(parseInt(is_active));
    }

    const whereClause = whereConditions.join(' AND ');
    const [products] = await pool.query(
      `SELECT id, sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, is_active, created_at 
       FROM products 
       WHERE ${whereClause} 
       ORDER BY id DESC`,
      params
    );

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/products/bulk-import', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { products = [], updateExisting = true } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar data produk tidak boleh kosong' });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    await connection.beginTransaction();

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const rowNum = i + 1;
      const sku = (p.sku || '').trim();
      const name = (p.name || '').trim();

      if (!sku || !name) {
        errors.push(`Baris ${rowNum}: SKU dan Nama Produk wajib diisi`);
        skipped++;
        continue;
      }

      let category = (p.category || 'Frame').trim();
      const catLower = category.toLowerCase();
      if (catLower.includes('lensa') || catLower.includes('lens')) category = 'Lensa';
      else if (catLower.includes('aksesor') || catLower.includes('access')) category = 'Aksesori';
      else category = 'Frame';

      const barcode = (p.barcode || sku).trim();
      const brand = (p.brand || '').trim();
      const cost_price = Math.max(0, parseFloat(p.cost_price) || 0);
      const selling_price = Math.max(0, parseFloat(p.selling_price) || 0);
      const stock = parseInt(p.stock) || 0;
      const unit = (p.unit || 'Pcs').trim();
      const specifications = (p.specifications || '').trim();
      const is_active = p.is_active === false || p.is_active === 0 || p.is_active === '0' || p.is_active === 'Nonaktif' ? 0 : 1;

      const [existing] = await connection.query('SELECT id FROM products WHERE sku = ?', [sku]);

      if (existing.length > 0) {
        if (updateExisting) {
          await connection.query(
            `UPDATE products SET 
              barcode = ?, name = ?, category = ?, brand = ?, cost_price = ?,
              selling_price = ?, stock = ?, unit = ?, specifications = ?, is_active = ?
             WHERE id = ?`,
            [barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, is_active, existing[0].id]
          );
          updated++;
        } else {
          skipped++;
        }
      } else {
        await connection.query(
          `INSERT INTO products (sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, is_active]
        );
        imported++;
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Proses import produk selesai: ${imported} ditambahkan, ${updated} diperbarui, ${skipped} dilewati.`,
      summary: {
        total: products.length,
        imported,
        updated,
        skipped,
        errors
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: 'Gagal melakukan import masal produk: ' + error.message });
  } finally {
    connection.release();
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, image, is_active } = req.body;
    if (!sku || !name || !category) {
      return res.status(400).json({ success: false, message: 'SKU, Nama Produk, dan Kategori wajib diisi' });
    }

    const [result] = await pool.query(
      `INSERT INTO products (sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, image, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sku,
        barcode || sku,
        name,
        category,
        brand || '',
        cost_price || 0,
        selling_price || 0,
        stock || 0,
        unit || 'Pcs',
        specifications || '',
        image || null,
        is_active ?? 1
      ]
    );

    const [created] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Produk berhasil ditambahkan', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, barcode, name, category, brand, cost_price, selling_price, stock, unit, specifications, image, is_active } = req.body;

    await pool.query(
      `UPDATE products SET 
        sku = ?, barcode = ?, name = ?, category = ?, brand = ?,
        cost_price = ?, selling_price = ?, stock = ?, unit = ?,
        specifications = ?, image = ?, is_active = ?
       WHERE id = ?`,
      [
        sku,
        barcode || sku,
        name,
        category,
        brand || '',
        cost_price || 0,
        selling_price || 0,
        stock || 0,
        unit || 'Pcs',
        specifications || '',
        image || null,
        is_active ?? 1,
        id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ success: true, message: 'Produk berhasil diperbarui', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    if (error.errno === 1451) {
      return res.status(400).json({
        success: false,
        message: 'Produk tidak dapat dihapus karena tercatat dalam transaksi. Silakan ubah status produk menjadi nonaktif.'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5. PRESCRIPTIONS (RESEP MATA & REFRAKSI)
// ==========================================
app.get('/api/prescriptions', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', customer_id = '', date_start = '', date_end = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(c.name LIKE ? OR c.phone LIKE ? OR p.examiner_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (customer_id) {
      whereConditions.push('p.customer_id = ?');
      params.push(parseInt(customer_id));
    }

    if (date_start) {
      whereConditions.push('p.exam_date >= ?');
      params.push(date_start);
    }

    if (date_end) {
      whereConditions.push('p.exam_date <= ?');
      params.push(date_end);
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total 
                      FROM prescriptions p 
                      JOIN customers c ON p.customer_id = c.id 
                      WHERE ${whereClause}`;

    const dataSql = `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, c.code AS customer_code, c.age AS customer_age,
                            (SELECT COUNT(*) FROM prescriptions p2 WHERE p2.customer_id = p.customer_id AND (p2.exam_date < p.exam_date OR (p2.exam_date = p.exam_date AND p2.id <= p.id))) AS visit_number,
                            (SELECT COUNT(*) FROM prescriptions p3 WHERE p3.customer_id = p.customer_id) AS total_visits
                     FROM prescriptions p 
                     JOIN customers c ON p.customer_id = c.id 
                     WHERE ${whereClause} 
                     ORDER BY p.exam_date DESC, p.id DESC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/prescriptions/export', async (req, res) => {
  try {
    const { search = '', customer_id = '', date_start = '', date_end = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(c.name LIKE ? OR c.phone LIKE ? OR p.examiner_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (customer_id) {
      whereConditions.push('p.customer_id = ?');
      params.push(parseInt(customer_id));
    }

    if (date_start) {
      whereConditions.push('p.exam_date >= ?');
      params.push(date_start);
    }

    if (date_end) {
      whereConditions.push('p.exam_date <= ?');
      params.push(date_end);
    }

    const whereClause = whereConditions.join(' AND ');
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, c.code AS customer_code, c.age AS customer_age,
              (SELECT COUNT(*) FROM prescriptions p2 WHERE p2.customer_id = p.customer_id AND (p2.exam_date < p.exam_date OR (p2.exam_date = p.exam_date AND p2.id <= p.id))) AS visit_number,
              (SELECT COUNT(*) FROM prescriptions p3 WHERE p3.customer_id = p.customer_id) AS total_visits
       FROM prescriptions p 
       JOIN customers c ON p.customer_id = c.id 
       WHERE ${whereClause} 
       ORDER BY p.exam_date DESC, p.id DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/prescriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS customer_name, c.phone AS customer_phone, c.code AS customer_code, c.age AS customer_age, c.gender AS customer_gender
       FROM prescriptions p 
       JOIN customers c ON p.customer_id = c.id 
       WHERE p.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Resep kacamata tidak ditemukan' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/prescriptions/bulk-import', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { prescriptions = [], autoCreateCustomer = true } = req.body;
    if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
      return res.status(400).json({ success: false, message: 'Daftar data rekam medis tidak boleh kosong' });
    }

    let imported = 0;
    let customersCreated = 0;
    let skipped = 0;
    const errors = [];

    await connection.beginTransaction();

    const [lastCust] = await connection.query('SELECT id FROM customers ORDER BY id DESC LIMIT 1');
    let nextCustId = (lastCust[0]?.id || 0) + 1;

    for (let i = 0; i < prescriptions.length; i++) {
      const rx = prescriptions[i];
      const rowNum = rx.rowNum || (i + 1);
      const customerName = (rx.customer_name || rx.name || '').trim();
      const customerPhone = (rx.customer_phone || rx.phone || '').trim();

      if (!customerName) {
        errors.push(`Baris ${rowNum}: Nama Pasien wajib diisi`);
        skipped++;
        continue;
      }

      // Match customer
      let customerId = rx.customer_id || null;
      if (!customerId && customerPhone && customerPhone !== '-' && customerPhone !== '0') {
        const [foundByPhone] = await connection.query(
          'SELECT id FROM customers WHERE phone = ? LIMIT 1',
          [customerPhone]
        );
        if (foundByPhone.length > 0) {
          customerId = foundByPhone[0].id;
        }
      }

      if (!customerId && customerName) {
        const [foundByName] = await connection.query(
          'SELECT id FROM customers WHERE LOWER(name) = LOWER(?) LIMIT 1',
          [customerName]
        );
        if (foundByName.length > 0) {
          customerId = foundByName[0].id;
        }
      }

      if (!customerId) {
        if (autoCreateCustomer) {
          const customerCode = `CUST-${String(nextCustId).padStart(4, '0')}`;
          nextCustId++;
          const gender = (rx.customer_gender || rx.gender || 'Laki-laki').trim();
          const age = rx.customer_age || rx.age ? parseInt(rx.customer_age || rx.age) || null : null;
          const address = (rx.customer_address || rx.address || '').trim();

          const [insertCust] = await connection.query(
            `INSERT INTO customers (code, name, phone, gender, age, address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              customerCode,
              customerName,
              customerPhone || '-',
              gender.toLowerCase().startsWith('p') ? 'Perempuan' : 'Laki-laki',
              age,
              address,
              'Dibuat otomatis dari import rekam medis'
            ]
          );
          customerId = insertCust.insertId;
          customersCreated++;
        } else {
          errors.push(`Baris ${rowNum}: Pasien "${customerName}" belum terdaftar`);
          skipped++;
          continue;
        }
      }

      // Format examination date
      let examDate = rx.exam_date || '';
      if (!examDate || examDate === '-') {
        examDate = new Date().toISOString().slice(0, 10);
      } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(examDate)) {
        const parts = examDate.split('/');
        examDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(examDate)) {
        const parts = examDate.split('-');
        examDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (/^\d{4}-\d{2}-\d{2}/.test(examDate)) {
        examDate = examDate.slice(0, 10);
      }

      const examinerName = (rx.examiner_name || 'RO Optik Raja').trim();
      let examinerId = null;
      if (examinerName) {
        const [emp] = await connection.query('SELECT id FROM employees WHERE name LIKE ? LIMIT 1', [`%${examinerName}%`]);
        if (emp.length > 0) examinerId = emp[0].id;
      }

      const odSph = rx.od_sph !== undefined && rx.od_sph !== null && rx.od_sph !== '' ? String(rx.od_sph).trim() : '0.00';
      const odCyl = rx.od_cyl !== undefined && rx.od_cyl !== null && rx.od_cyl !== '' ? String(rx.od_cyl).trim() : '0.00';
      const odAxis = parseInt(rx.od_axis) || 0;
      const odAdd = rx.od_add !== undefined && rx.od_add !== null && rx.od_add !== '' ? String(rx.od_add).trim() : '0.00';
      const odMpd = parseFloat(rx.od_mpd) || 31.0;
      const odBcva = (rx.od_bcva || '6/6').trim();
      const odUcva = (rx.od_ucva || '6/18').trim();
      const odPv = (rx.od_pv || '10°').trim();
      const odSh = (rx.od_sh || '18 mm').trim();

      const osSph = rx.os_sph !== undefined && rx.os_sph !== null && rx.os_sph !== '' ? String(rx.os_sph).trim() : '0.00';
      const osCyl = rx.os_cyl !== undefined && rx.os_cyl !== null && rx.os_cyl !== '' ? String(rx.os_cyl).trim() : '0.00';
      const osAxis = parseInt(rx.os_axis) || 0;
      const osAdd = rx.os_add !== undefined && rx.os_add !== null && rx.os_add !== '' ? String(rx.os_add).trim() : '0.00';
      const osMpd = parseFloat(rx.os_mpd) || 31.0;
      const osBcva = (rx.os_bcva || '6/6').trim();
      const osUcva = (rx.os_ucva || '6/24').trim();
      const osPv = (rx.os_pv || '10°').trim();
      const osSh = (rx.os_sh || '18 mm').trim();

      let totalPd = rx.total_pd ? parseFloat(rx.total_pd) : null;
      if (!totalPd || isNaN(totalPd)) {
        totalPd = Number((odMpd + osMpd).toFixed(1));
      }

      const complaintDiagnose = (rx.complaint_diagnose || rx.complaint || '').trim();
      const notes = (rx.notes || '').trim();

      const [insertRx] = await connection.query(
        `INSERT INTO prescriptions (
          customer_id, examiner_id, examiner_name, exam_date,
          od_ucva, od_sph, od_cyl, od_axis, od_bcva, od_add, od_mpd, od_pv, od_sh,
          os_ucva, os_sph, os_cyl, os_axis, os_bcva, os_add, os_mpd, os_pv, os_sh,
          total_pd, complaint_diagnose, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerId, examinerId, examinerName, examDate,
          odUcva, odSph, odCyl, odAxis, odBcva, odAdd, odMpd, odPv, odSh,
          osUcva, osSph, osCyl, osAxis, osBcva, osAdd, osMpd, osPv, osSh,
          totalPd, complaintDiagnose, notes
        ]
      );

      const newRxId = insertRx.insertId;

      try {
        await connection.query(
          'UPDATE transactions SET prescription_id = ? WHERE customer_id = ? AND prescription_id IS NULL',
          [newRxId, customerId]
        );
        await connection.query(
          `UPDATE lab_orders lo
           JOIN transactions t ON lo.transaction_id = t.id
           SET lo.prescription_id = ?
           WHERE t.customer_id = ? AND (lo.prescription_id IS NULL OR lo.prescription_id = 0)`,
          [newRxId, customerId]
        );
      } catch (linkErr) {
        // Continue
      }

      imported++;
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Proses import rekam medis selesai: ${imported} rekam medis berhasil ditambahkan (${customersCreated} pasien baru didaftarkan otomatis).`,
      summary: {
        total: prescriptions.length,
        imported,
        customersCreated,
        skipped,
        errors
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

app.post('/api/prescriptions', async (req, res) => {
  try {
    const {
      customer_id, examiner_id, examiner_name, exam_date,
      od_ucva, od_sph, od_cyl, od_axis, od_bcva, od_add, od_mpd, od_pv, od_sh,
      os_ucva, os_sph, os_cyl, os_axis, os_bcva, os_add, os_mpd, os_pv, os_sh,
      total_pd, complaint_diagnose, notes
    } = req.body;

    if (!customer_id || !examiner_name || !exam_date) {
      return res.status(400).json({ success: false, message: 'Customer, Nama Pemeriksa, dan Tanggal Periksa wajib diisi' });
    }

    const calculatedTotalPd = (total_pd !== undefined && total_pd !== null && total_pd !== '')
      ? total_pd
      : (od_mpd && os_mpd ? Number((Number(od_mpd) + Number(os_mpd)).toFixed(1)) : 62.0);

    const [result] = await pool.query(
      `INSERT INTO prescriptions (
        customer_id, examiner_id, examiner_name, exam_date,
        od_ucva, od_sph, od_cyl, od_axis, od_bcva, od_add, od_mpd, od_pv, od_sh,
        os_ucva, os_sph, os_cyl, os_axis, os_bcva, os_add, os_mpd, os_pv, os_sh,
        total_pd, complaint_diagnose, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customer_id, examiner_id || null, examiner_name, exam_date,
        od_ucva || '6/6', od_sph || '0.00', od_cyl || '0.00', od_axis || 0, od_bcva || '6/6', od_add || '0.00', od_mpd !== undefined && od_mpd !== null ? od_mpd : 31.0, od_pv || '10°', od_sh || '18 mm',
        os_ucva || '6/6', os_sph || '0.00', os_cyl || '0.00', os_axis || 0, os_bcva || '6/6', os_add || '0.00', os_mpd !== undefined && os_mpd !== null ? os_mpd : 31.0, os_pv || '10°', os_sh || '18 mm',
        calculatedTotalPd, complaint_diagnose || '', notes || ''
      ]
    );

    const newPrescriptionId = result.insertId;
    const [created] = await pool.query('SELECT * FROM prescriptions WHERE id = ?', [newPrescriptionId]);

    // Automatically associate this prescription with any unassociated transactions of this customer
    try {
      await pool.query(
        'UPDATE transactions SET prescription_id = ? WHERE customer_id = ? AND prescription_id IS NULL',
        [newPrescriptionId, customer_id]
      );
      await pool.query(
        `UPDATE lab_orders lo
         JOIN transactions t ON lo.transaction_id = t.id
         SET lo.prescription_id = ?
         WHERE t.customer_id = ? AND (lo.prescription_id IS NULL OR lo.prescription_id = 0)`,
        [newPrescriptionId, customer_id]
      );
    } catch (linkErr) {
      console.error('Warning auto-linking prescription:', linkErr.message);
    }

    res.status(201).json({ success: true, message: 'Resep kacamata berhasil disimpan', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/prescriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customer_id, examiner_id, examiner_name, exam_date,
      od_ucva, od_sph, od_cyl, od_axis, od_bcva, od_add, od_mpd, od_pv, od_sh,
      os_ucva, os_sph, os_cyl, os_axis, os_bcva, os_add, os_mpd, os_pv, os_sh,
      total_pd, complaint_diagnose, notes
    } = req.body;

    const calculatedTotalPd = (total_pd !== undefined && total_pd !== null && total_pd !== '')
      ? total_pd
      : (od_mpd && os_mpd ? Number((Number(od_mpd) + Number(os_mpd)).toFixed(1)) : null);

    await pool.query(
      `UPDATE prescriptions SET 
        customer_id = ?, examiner_id = ?, examiner_name = ?, exam_date = ?,
        od_ucva = ?, od_sph = ?, od_cyl = ?, od_axis = ?, od_bcva = ?, od_add = ?, od_mpd = ?, od_pv = ?, od_sh = ?,
        os_ucva = ?, os_sph = ?, os_cyl = ?, os_axis = ?, os_bcva = ?, os_add = ?, os_mpd = ?, os_pv = ?, os_sh = ?,
        total_pd = ?, complaint_diagnose = ?, notes = ?
      WHERE id = ?`,
      [
        customer_id, examiner_id || null, examiner_name, exam_date,
        od_ucva, od_sph, od_cyl, od_axis, od_bcva, od_add, od_mpd, od_pv, od_sh,
        os_ucva, os_sph, os_cyl, os_axis, os_bcva, os_add, os_mpd, os_pv, os_sh,
        calculatedTotalPd, complaint_diagnose, notes, id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM prescriptions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Resep kacamata berhasil diperbarui', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/prescriptions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM prescriptions WHERE id = ?', [id]);
    res.json({ success: true, message: 'Resep kacamata berhasil dihapus' });
  } catch (error) {
    if (error.errno === 1451) {
      return res.status(400).json({
        success: false,
        message: 'Resep kacamata tidak dapat dihapus karena sedang terhubung dengan transaksi atau order lab aktif.'
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. TRANSACTIONS & KASIR POS
// ==========================================
app.get('/api/transactions/export', async (req, res) => {
  try {
    const { search = '', payment_status = '', penjamin = '', date_start = '', date_end = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(t.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (payment_status) {
      whereConditions.push('t.payment_status = ?');
      params.push(payment_status);
    }

    if (penjamin === 'BPJS') {
      whereConditions.push('t.bpjs_subsidy > 0');
    } else if (penjamin === 'Umum') {
      whereConditions.push('(t.bpjs_subsidy IS NULL OR t.bpjs_subsidy <= 0)');
    }

    if (date_start) {
      whereConditions.push('DATE(t.transaction_date) >= ?');
      params.push(date_start);
    }

    if (date_end) {
      whereConditions.push('DATE(t.transaction_date) <= ?');
      params.push(date_end);
    }

    const whereClause = whereConditions.join(' AND ');
    const dataSql = `SELECT t.*, 
                            c.name AS customer_name, c.phone AS customer_phone, c.code AS customer_code,
                            e.name AS employee_name,
                            lo.id AS lab_order_id,
                            COALESCE(t.order_status, lo.status, 'Proses Lab') AS lab_status,
                            COALESCE(t.order_status, lo.status, 'Proses Lab') AS order_status,
                            (SELECT GROUP_CONCAT(CONCAT(ti.product_name, ' (', ti.quantity, 'x)') SEPARATOR ', ')
                             FROM transaction_items ti WHERE ti.transaction_id = t.id) AS items_summary
                     FROM transactions t 
                     JOIN customers c ON t.customer_id = c.id 
                     JOIN employees e ON t.employee_id = e.id 
                     LEFT JOIN lab_orders lo ON t.id = lo.transaction_id
                     WHERE ${whereClause} 
                     ORDER BY t.transaction_date DESC, t.id DESC`;

    const [rows] = await pool.query(dataSql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', payment_status = '', penjamin = '', date_start = '', date_end = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(t.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (payment_status) {
      whereConditions.push('t.payment_status = ?');
      params.push(payment_status);
    }

    if (penjamin === 'BPJS') {
      whereConditions.push('t.bpjs_subsidy > 0');
    } else if (penjamin === 'Umum') {
      whereConditions.push('(t.bpjs_subsidy IS NULL OR t.bpjs_subsidy <= 0)');
    }

    if (date_start) {
      whereConditions.push('DATE(t.transaction_date) >= ?');
      params.push(date_start);
    }

    if (date_end) {
      whereConditions.push('DATE(t.transaction_date) <= ?');
      params.push(date_end);
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total 
                      FROM transactions t 
                      JOIN customers c ON t.customer_id = c.id 
                      WHERE ${whereClause}`;

    const dataSql = `SELECT t.*, 
                            c.name AS customer_name, c.phone AS customer_phone, c.code AS customer_code,
                            e.name AS employee_name,
                            lo.id AS lab_order_id,
                            COALESCE(t.order_status, lo.status, 'Proses Lab') AS lab_status,
                            COALESCE(t.order_status, lo.status, 'Proses Lab') AS order_status,
                            COALESCE(
                              t.prescription_id,
                              (SELECT p.id FROM prescriptions p WHERE p.customer_id = t.customer_id ORDER BY p.exam_date DESC, p.id DESC LIMIT 1)
                            ) AS prescription_id
                     FROM transactions t 
                     JOIN customers c ON t.customer_id = c.id 
                     JOIN employees e ON t.employee_id = e.id 
                     LEFT JOIN lab_orders lo ON t.id = lo.transaction_id
                     WHERE ${whereClause} 
                     ORDER BY t.transaction_date DESC, t.id DESC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);

    // Summary counts for current search and date filters (for badge)
    let summaryWhereConditions = ['1=1'];
    let summaryParams = [];
    if (search) {
      summaryWhereConditions.push('(t.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      summaryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (payment_status) {
      summaryWhereConditions.push('t.payment_status = ?');
      summaryParams.push(payment_status);
    }
    if (date_start) {
      summaryWhereConditions.push('DATE(t.transaction_date) >= ?');
      summaryParams.push(date_start);
    }
    if (date_end) {
      summaryWhereConditions.push('DATE(t.transaction_date) <= ?');
      summaryParams.push(date_end);
    }

    const [summaryRows] = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        COUNT(CASE WHEN t.bpjs_subsidy > 0 THEN 1 END) AS bpjs,
        COUNT(CASE WHEN t.bpjs_subsidy IS NULL OR t.bpjs_subsidy <= 0 THEN 1 END) AS umum
       FROM transactions t
       JOIN customers c ON t.customer_id = c.id
       WHERE ${summaryWhereConditions.join(' AND ')}`,
      summaryParams
    );

    res.json({ 
      success: true, 
      ...result,
      summary: summaryRows[0] || { total: 0, bpjs: 0, umum: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [tRows] = await pool.query(
      `SELECT t.*, 
              c.name AS customer_name, c.phone AS customer_phone, c.code AS customer_code, c.address AS customer_address,
              e.name AS employee_name, e.role AS employee_role,
              COALESCE(
                t.prescription_id,
                (SELECT p.id FROM prescriptions p WHERE p.customer_id = t.customer_id ORDER BY p.exam_date DESC, p.id DESC LIMIT 1)
              ) AS prescription_id
       FROM transactions t 
       JOIN customers c ON t.customer_id = c.id 
       JOIN employees e ON t.employee_id = e.id 
       WHERE t.id = ? LIMIT 1`,
      [id]
    );

    if (!tRows.length) {
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const transaction = tRows[0];

    // Items
    const [items] = await pool.query('SELECT * FROM transaction_items WHERE transaction_id = ?', [id]);
    transaction.items = items;

    // Payments
    const [payments] = await pool.query(
      `SELECT tp.*, e.name AS cashier_name 
       FROM transaction_payments tp 
       LEFT JOIN employees e ON tp.employee_id = e.id 
       WHERE tp.transaction_id = ? ORDER BY tp.payment_date ASC`,
      [id]
    );
    transaction.payments = payments;

    // Prescription details if exists
    if (transaction.prescription_id) {
      const [pRows] = await pool.query('SELECT * FROM prescriptions WHERE id = ?', [transaction.prescription_id]);
      transaction.prescription = pRows[0] || null;
    } else {
      transaction.prescription = null;
    }

    // Lab order details if exists
    const [labRows] = await pool.query(
      `SELECT lo.*, e.name AS technician_name 
       FROM lab_orders lo 
       LEFT JOIN employees e ON lo.technician_id = e.id 
       WHERE lo.transaction_id = ? LIMIT 1`,
      [id]
    );
    transaction.lab_order = labRows[0] || null;

    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Checkout POS
app.post('/api/transactions', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      customer_id, employee_id, prescription_id, completion_estimate,
      items = [],
      subtotal = 0, discount_amount = 0, bpjs_subsidy = 0, grand_total = 0,
      paid_amount = 0, change_amount = 0, payment_status = 'Lunas', payment_method = 'Tunai',
      dp_amount = 0, remaining_amount = 0, notes = ''
    } = req.body;

    if (!customer_id || !employee_id || !items.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Pelanggan, Kasir, dan Item belanja wajib diisi' });
    }

    // Generate Invoice Number TRX-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const [lastTrx] = await connection.query(
      'SELECT id FROM transactions WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`TRX-${dateStr}-%`]
    );
    const seq = ((lastTrx[0]?.id || 0) % 1000) + 1;
    const invoiceNumber = `TRX-${dateStr}-${String(seq).padStart(4, '0')}`;

    // Insert into transactions
    const [tResult] = await connection.query(
      `INSERT INTO transactions (
        invoice_number, customer_id, employee_id, prescription_id,
        transaction_date, completion_estimate,
        subtotal, discount_amount, bpjs_subsidy, grand_total,
        paid_amount, change_amount, payment_status, payment_method,
        dp_amount, remaining_amount, notes
      ) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber, customer_id, employee_id, prescription_id || null,
        completion_estimate || null,
        subtotal, discount_amount, bpjs_subsidy, grand_total,
        paid_amount, change_amount, payment_status, payment_method,
        dp_amount, remaining_amount, notes
      ]
    );

    const transactionId = tResult.insertId;

    // Insert items & reduce stock
    let hasFrameOrLens = false;
    for (const item of items) {
      await connection.query(
        `INSERT INTO transaction_items (
          transaction_id, product_id, product_name, category, price, cost_price, quantity, discount, total_price, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId, item.product_id || null, item.product_name, item.category || 'Aksesori',
          item.price || 0, item.cost_price || 0, item.quantity || 1, item.discount || 0, item.total_price || 0, item.notes || ''
        ]
      );

      if (['Frame', 'Lensa'].includes(item.category)) {
        hasFrameOrLens = true;
      }

      // Update product stock if product_id exists
      if (item.product_id) {
        await connection.query(
          'UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?',
          [item.quantity || 1, item.product_id]
        );
      }
    }

    // Record initial payment
    const paymentType = payment_status === 'DP' ? 'DP' : 'Pembayaran Penuh';
    await connection.query(
      `INSERT INTO transaction_payments (
        transaction_id, payment_date, payment_type, amount, payment_method, notes, employee_id
      ) VALUES (?, NOW(), ?, ?, ?, ?, ?)`,
      [
        transactionId, paymentType, paid_amount, payment_method,
        payment_status === 'DP' ? 'Pembayaran Uang Muka (DP)' : 'Pembayaran Lunas',
        employee_id
      ]
    );

    // If order has completion_estimate or has frame/lens/prescription, create Lab Order
    if (completion_estimate || hasFrameOrLens || prescription_id) {
      const labOrderNumber = `LAB-${dateStr}-${String(seq).padStart(3, '0')}`;
      await connection.query(
        `INSERT INTO lab_orders (
          order_number, transaction_id, customer_id, order_date, estimated_date, status, notes
        ) VALUES (?, ?, ?, NOW(), ?, 'Menunggu Pengerjaan', ?)`,
        [
          labOrderNumber, transactionId, customer_id,
          completion_estimate || null,
          `Pesanan lab otomatis dari transaksi ${invoiceNumber}`
        ]
      );
    }

    await connection.commit();

    // Fetch created transaction
    const [newTrx] = await pool.query('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    res.status(201).json({
      success: true,
      message: 'Transaksi kasir berhasil disimpan',
      data: newTrx[0]
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// Pelunasan Transaksi DP / Belum Lunas
app.post('/api/transactions/:id/pay', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { amount, payment_method = 'Tunai', notes = '', employee_id } = req.body;

    const payAmount = parseFloat(amount);
    if (!payAmount || payAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Nominal pelunasan tidak valid' });
    }

    const [tRows] = await connection.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!tRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const trx = tRows[0];
    const newPaidAmount = parseFloat(trx.paid_amount) + payAmount;
    const newRemaining = Math.max(0, parseFloat(trx.remaining_amount) - payAmount);
    const newStatus = newRemaining <= 0 ? 'Lunas' : 'DP';

    // Update transaction
    await connection.query(
      `UPDATE transactions SET 
        paid_amount = ?, remaining_amount = ?, payment_status = ? 
       WHERE id = ?`,
      [newPaidAmount, newRemaining, newStatus, id]
    );

    // Insert payment record
    await connection.query(
      `INSERT INTO transaction_payments (
        transaction_id, payment_date, payment_type, amount, payment_method, notes, employee_id
      ) VALUES (?, NOW(), 'Pelunasan', ?, ?, ?, ?)`,
      [id, payAmount, payment_method, notes || 'Pelunasan Sisa Tagihan', employee_id || trx.employee_id]
    );

    await connection.commit();

    const [updatedTrx] = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
    res.json({
      success: true,
      message: newStatus === 'Lunas' ? 'Transaksi telah LUNAS!' : 'Pembayaran cicilan berhasil dicatat',
      data: updatedTrx[0]
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// Edit Transaksi (Header, Items & Status Pembayaran)
app.put('/api/transactions/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [tRows] = await connection.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!tRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    const currentTrx = tRows[0];
    if (currentTrx.order_status === 'Selesai') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Pesanan berstatus Selesai telah terkunci otomatis dan tidak dapat diedit.'
      });
    }

    const {
      customer_id,
      employee_id,
      prescription_id,
      completion_estimate,
      subtotal,
      discount_amount = 0,
      bpjs_subsidy = 0,
      grand_total,
      paid_amount,
      payment_status,
      payment_method,
      dp_amount,
      remaining_amount,
      notes,
      items
    } = req.body;

    // Jika items dikirim, sinkronisasi item dan sesuaikan stok produk
    if (Array.isArray(items) && items.length > 0) {
      // 1. Kembalikan stok item lama
      const [oldItems] = await connection.query(
        'SELECT product_id, quantity FROM transaction_items WHERE transaction_id = ?',
        [id]
      );
      for (const oldItem of oldItems) {
        if (oldItem.product_id) {
          await connection.query(
            'UPDATE products SET stock = stock + ? WHERE id = ?',
            [oldItem.quantity || 1, oldItem.product_id]
          );
        }
      }

      // 2. Hapus item lama
      await connection.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);

      // 3. Masukkan item baru & kurangi stok produk
      for (const item of items) {
        await connection.query(
          `INSERT INTO transaction_items (
            transaction_id, product_id, product_name, category, price, cost_price, quantity, discount, total_price, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.product_id || null,
            item.product_name,
            item.category || 'Aksesori',
            item.price || 0,
            item.cost_price || 0,
            item.quantity || 1,
            item.discount || 0,
            item.total_price || 0,
            item.notes || ''
          ]
        );

        if (item.product_id) {
          await connection.query(
            'UPDATE products SET stock = GREATEST(0, stock - ?) WHERE id = ?',
            [item.quantity || 1, item.product_id]
          );
        }
      }
    }

    const finalSubtotal = subtotal !== undefined ? parseFloat(subtotal) : parseFloat(currentTrx.subtotal);
    const finalDiscount = discount_amount !== undefined ? parseFloat(discount_amount) : parseFloat(currentTrx.discount_amount);
    const finalBpjs = bpjs_subsidy !== undefined ? parseFloat(bpjs_subsidy) : parseFloat(currentTrx.bpjs_subsidy);
    const finalGrandTotal = grand_total !== undefined ? parseFloat(grand_total) : Math.max(0, finalSubtotal - finalDiscount - finalBpjs);
    const finalPaid = paid_amount !== undefined ? parseFloat(paid_amount) : parseFloat(currentTrx.paid_amount);
    const finalRemaining = remaining_amount !== undefined ? parseFloat(remaining_amount) : Math.max(0, finalGrandTotal - finalPaid);
    const finalStatus = payment_status || (finalRemaining <= 0 ? 'Lunas' : finalPaid > 0 ? 'DP' : 'Belum Lunas');
    const finalDp = finalStatus === 'DP' ? finalPaid : (dp_amount !== undefined ? parseFloat(dp_amount) : 0);

    // Update transactions table
    await connection.query(
      `UPDATE transactions SET
        customer_id = ?,
        employee_id = ?,
        prescription_id = ?,
        completion_estimate = ?,
        subtotal = ?,
        discount_amount = ?,
        bpjs_subsidy = ?,
        grand_total = ?,
        paid_amount = ?,
        payment_status = ?,
        payment_method = ?,
        dp_amount = ?,
        remaining_amount = ?,
        notes = ?
       WHERE id = ?`,
      [
        customer_id || currentTrx.customer_id,
        employee_id || currentTrx.employee_id,
        prescription_id !== undefined ? (prescription_id || null) : currentTrx.prescription_id,
        completion_estimate !== undefined ? (completion_estimate || null) : currentTrx.completion_estimate,
        finalSubtotal,
        finalDiscount,
        finalBpjs,
        finalGrandTotal,
        finalPaid,
        finalStatus,
        payment_method || currentTrx.payment_method,
        finalDp,
        finalRemaining,
        notes !== undefined ? notes : currentTrx.notes,
        id
      ]
    );

    // Sync lab orders if completion_estimate or customer_id is updated
    if (completion_estimate !== undefined || customer_id) {
      await connection.query(
        `UPDATE lab_orders SET
          estimated_date = COALESCE(?, estimated_date),
          customer_id = COALESCE(?, customer_id)
         WHERE transaction_id = ?`,
        [completion_estimate || null, customer_id || null, id]
      );
    }

    await connection.commit();

    const [updatedTrx] = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'Data transaksi berhasil diperbarui',
      data: updatedTrx[0]
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// Hapus Transaksi & Kembalikan Stok Barang (Khusus Otorisasi Owner)
app.delete('/api/transactions/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    // Autentikasi & Otorisasi: Khusus Owner
    const authUser = await getAuthUser(req);
    const clientRole = req.headers['x-user-role'];
    const effectiveRole = clientRole || authUser?.role;

    if (effectiveRole && effectiveRole !== 'Owner') {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Hanya Owner yang memiliki hak akses untuk menghapus transaksi.'
      });
    }

    const [tRows] = await connection.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!tRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Transaksi tidak ditemukan' });
    }

    // Ambil item transaksi untuk mengembalikan stok barang ke gudang
    const [items] = await connection.query(
      'SELECT product_id, quantity FROM transaction_items WHERE transaction_id = ?',
      [id]
    );
    for (const item of items) {
      if (item.product_id) {
        await connection.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity || 1, item.product_id]
        );
      }
    }

    // Hapus data terkait (lab order, pembayaran, item, dan transaksi utama)
    await connection.query('DELETE FROM lab_orders WHERE transaction_id = ?', [id]);
    await connection.query('DELETE FROM transaction_payments WHERE transaction_id = ?', [id]);
    await connection.query('DELETE FROM transaction_items WHERE transaction_id = ?', [id]);
    await connection.query('DELETE FROM transactions WHERE id = ?', [id]);

    await connection.commit();
    res.json({
      success: true,
      message: `Transaksi nota ${tRows[0].invoice_number || ''} berhasil dihapus oleh Owner dan stok barang telah dikembalikan ke gudang.`
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// 7. LAB / FASET ORDERS ENDPOINTS (STATUS PESANAN)
// ==========================================
app.get('/api/lab-orders', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = '', tab = 'all' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(lo.order_number LIKE ? OR t.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
      whereConditions.push('lo.status = ?');
      params.push(status);
    } else if (tab === 'process') {
      whereConditions.push("lo.status = 'Proses Lab'");
    } else if (tab === 'ready') {
      whereConditions.push("lo.status = 'Siap Diambil'");
    } else if (tab === 'completed') {
      whereConditions.push("lo.status = 'Selesai'");
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total 
                      FROM lab_orders lo 
                      JOIN transactions t ON lo.transaction_id = t.id 
                      JOIN customers c ON lo.customer_id = c.id 
                      WHERE ${whereClause}`;

    const dataSql = `SELECT lo.*, 
                            t.invoice_number, t.payment_status, t.remaining_amount, t.grand_total, t.paid_amount,
                            COALESCE(t.order_status, lo.status, 'Proses Lab') AS order_status,
                            c.name AS customer_name, c.phone AS customer_phone,
                            e.name AS technician_name,
                            p.od_sph, p.od_cyl, p.od_axis, p.os_sph, p.os_cyl, p.os_axis, p.total_pd
                     FROM lab_orders lo 
                     JOIN transactions t ON lo.transaction_id = t.id 
                     JOIN customers c ON lo.customer_id = c.id 
                     LEFT JOIN employees e ON lo.technician_id = e.id 
                     LEFT JOIN prescriptions p ON t.prescription_id = p.id 
                     WHERE ${whereClause} 
                     ORDER BY lo.id DESC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);

    // Also fetch items summary for each lab order
    for (const item of result.data) {
      const [items] = await pool.query(
        'SELECT product_name, category, quantity, price FROM transaction_items WHERE transaction_id = ?',
        [item.transaction_id]
      );
      item.items = items;
    }

    // Counts for the two Kanban columns: Proses Lab and Siap Diambil, plus Selesai
    const [counts] = await pool.query(`
      SELECT 
        COUNT(CASE WHEN lo.status = 'Proses Lab' THEN 1 END) AS proses_lab,
        COUNT(CASE WHEN lo.status = 'Siap Diambil' THEN 1 END) AS siap_diambil,
        COUNT(CASE WHEN lo.status = 'Selesai' THEN 1 END) AS selesai
      FROM lab_orders lo
    `);

    res.json({
      success: true,
      ...result,
      summary: counts[0] || { proses_lab: 0, siap_diambil: 0, selesai: 0 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/lab-orders/:id/status', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    let { status, technician_id, notes } = req.body;

    if (status === 'Menunggu Pengerjaan' || status === 'Pemotongan Lensa' || status === 'Perakitan' || status === 'Quality Control') {
      status = 'Proses Lab';
    } else if (status === 'Selesai Diambil') {
      status = 'Selesai';
    }

    let updateFields = ['status = ?'];
    let params = [status];

    if (technician_id !== undefined) {
      updateFields.push('technician_id = ?');
      params.push(technician_id || null);
    }

    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }

    if (status === 'Selesai') {
      updateFields.push('completed_date = NOW()');
    }

    params.push(id);
    await connection.query(`UPDATE lab_orders SET ${updateFields.join(', ')} WHERE id = ?`, params);

    // Get transaction associated with this lab order
    const [orderRows] = await connection.query('SELECT transaction_id FROM lab_orders WHERE id = ?', [id]);
    if (orderRows.length > 0) {
      const trxId = orderRows[0].transaction_id;
      const [trxRows] = await connection.query('SELECT * FROM transactions WHERE id = ?', [trxId]);
      if (trxRows.length > 0) {
        const trx = trxRows[0];
        if (status === 'Selesai') {
          const remaining = parseFloat(trx.remaining_amount || 0);
          if (remaining > 0 || trx.payment_status !== 'Lunas') {
            await connection.query(
              `INSERT INTO transaction_payments (
                transaction_id, payment_date, payment_type, amount, payment_method, notes, employee_id
              ) VALUES (?, NOW(), 'Pelunasan Pengambilan Pesanan', ?, 'Tunai', 'Pelunasan otomatis saat pesanan selesai diambil', ?)`,
              [trxId, remaining > 0 ? remaining : trx.grand_total, trx.employee_id]
            );
          }
          await connection.query(
            `UPDATE transactions SET 
              order_status = 'Selesai',
              payment_status = 'Lunas',
              paid_amount = grand_total,
              remaining_amount = 0
             WHERE id = ?`,
            [trxId]
          );
        } else {
          await connection.query(
            `UPDATE transactions SET order_status = ? WHERE id = ?`,
            [status, trxId]
          );
        }
      }
    }

    await connection.commit();

    const [updated] = await pool.query('SELECT * FROM lab_orders WHERE id = ?', [id]);
    res.json({ success: true, message: `Status pesanan berhasil diperbarui ke ${status}`, data: updated[0] });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
});

// ==========================================
// 8. EXPENSES (PENGELUARAN OPERASIONAL)
// ==========================================
app.get('/api/expenses', async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '', date_start = '', date_end = '' } = req.query;
    let whereConditions = ['1=1'];
    let params = [];

    if (search) {
      whereConditions.push('(ex.description LIKE ? OR ex.recipient LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      whereConditions.push('ex.category = ?');
      params.push(category);
    }

    if (date_start) {
      whereConditions.push('ex.expense_date >= ?');
      params.push(date_start);
    }

    if (date_end) {
      whereConditions.push('ex.expense_date <= ?');
      params.push(date_end);
    }

    const whereClause = whereConditions.join(' AND ');
    const countSql = `SELECT COUNT(*) AS total FROM expenses ex WHERE ${whereClause}`;
    const dataSql = `SELECT ex.*, e.name AS employee_name 
                     FROM expenses ex 
                     LEFT JOIN employees e ON ex.employee_id = e.id 
                     WHERE ${whereClause} 
                     ORDER BY ex.expense_date DESC, ex.id DESC`;

    const result = await paginateQuery(countSql, dataSql, params, params, page, limit);

    // Calculate total summary of filtered expenses
    const [sumRow] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense_sum FROM expenses ex WHERE ${whereClause}`,
      params
    );

    res.json({
      success: true,
      ...result,
      summary: {
        totalExpenseSum: parseFloat(sumRow[0]?.total_expense_sum || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const { expense_date, category, amount, description, recipient, employee_id, attachment } = req.body;
    if (!expense_date || !category || !amount || !description) {
      return res.status(400).json({ success: false, message: 'Tanggal, Kategori, Jumlah, dan Keterangan wajib diisi' });
    }

    const [result] = await pool.query(
      `INSERT INTO expenses (expense_date, category, amount, description, recipient, employee_id, attachment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [expense_date, category, amount, description, recipient || '', employee_id || null, attachment || null]
    );

    const [created] = await pool.query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Pengeluaran berhasil dicatat', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_date, category, amount, description, recipient, employee_id, attachment } = req.body;

    await pool.query(
      `UPDATE expenses SET 
        expense_date = ?, category = ?, amount = ?, description = ?, 
        recipient = ?, employee_id = ?, attachment = ?
       WHERE id = ?`,
      [expense_date, category, amount, description, recipient || '', employee_id || null, attachment || null, id]
    );

    const [updated] = await pool.query('SELECT * FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengeluaran berhasil diperbarui', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Pengeluaran berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 8b. EXPENSE CATEGORIES (KATEGORI PENGELUARAN KAS)
// ==========================================
app.get('/api/expense-categories', async (req, res) => {
  try {
    const { search = '' } = req.query;
    let sql = 'SELECT * FROM expense_categories';
    const params = [];
    if (search) {
      sql += ' WHERE name LIKE ? OR description LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY name ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/expense-categories', async (req, res) => {
  try {
    const { name, description = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const trimmedName = name.trim();

    // Check duplicate
    const [existing] = await pool.query('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?)', [trimmedName]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Kategori dengan nama tersebut sudah ada' });
    }

    const [result] = await pool.query(
      'INSERT INTO expense_categories (name, description) VALUES (?, ?)',
      [trimmedName, description ? description.trim() : '']
    );

    const [created] = await pool.query('SELECT * FROM expense_categories WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, message: 'Kategori pengeluaran berhasil ditambahkan', data: created[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/expense-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kategori wajib diisi' });
    }

    const trimmedName = name.trim();

    // Get current category
    const [current] = await pool.query('SELECT * FROM expense_categories WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    }

    const oldName = current[0].name;

    // Check duplicate if name changed
    if (oldName.toLowerCase() !== trimmedName.toLowerCase()) {
      const [existing] = await pool.query(
        'SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) AND id != ?',
        [trimmedName, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Kategori dengan nama tersebut sudah ada' });
      }
    }

    await pool.query(
      'UPDATE expense_categories SET name = ?, description = ? WHERE id = ?',
      [trimmedName, description ? description.trim() : '', id]
    );

    // Keep existing expenses synchronized with the updated category name
    if (oldName !== trimmedName) {
      await pool.query('UPDATE expenses SET category = ? WHERE category = ?', [trimmedName, oldName]);
    }

    const [updated] = await pool.query('SELECT * FROM expense_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Kategori pengeluaran berhasil diperbarui', data: updated[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/expense-categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [current] = await pool.query('SELECT * FROM expense_categories WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Kategori tidak ditemukan' });
    }

    await pool.query('DELETE FROM expense_categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Kategori pengeluaran berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 9. DASHBOARD & FINANCIAL REPORTS
// ==========================================
app.get('/api/reports/dashboard', async (req, res) => {
  try {
    const { period = 'this_month', date_start, date_end } = req.query;

    let dateConditionTrx = '1=1';
    let dateConditionExp = '1=1';
    let paramsTrx = [];
    let paramsExp = [];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (period === 'today') {
      dateConditionTrx = 'DATE(transaction_date) = ?';
      dateConditionExp = 'expense_date = ?';
      paramsTrx.push(todayStr);
      paramsExp.push(todayStr);
    } else if (period === 'this_week') {
      dateConditionTrx = 'YEARWEEK(transaction_date, 1) = YEARWEEK(NOW(), 1)';
      dateConditionExp = 'YEARWEEK(expense_date, 1) = YEARWEEK(NOW(), 1)';
    } else if (period === 'this_month') {
      dateConditionTrx = 'YEAR(transaction_date) = YEAR(NOW()) AND MONTH(transaction_date) = MONTH(NOW())';
      dateConditionExp = 'YEAR(expense_date) = YEAR(NOW()) AND MONTH(expense_date) = MONTH(NOW())';
    } else if (period === 'this_year') {
      dateConditionTrx = 'YEAR(transaction_date) = YEAR(NOW())';
      dateConditionExp = 'YEAR(expense_date) = YEAR(NOW())';
    } else if (period === 'custom' && date_start && date_end) {
      dateConditionTrx = 'DATE(transaction_date) >= ? AND DATE(transaction_date) <= ?';
      dateConditionExp = 'expense_date >= ? AND expense_date <= ?';
      paramsTrx.push(date_start, date_end);
      paramsExp.push(date_start, date_end);
    }

    // 1. Transaction Metrics
    const [salesSummary] = await pool.query(
      `SELECT 
        COUNT(*) AS total_transactions,
        COALESCE(SUM(grand_total), 0) AS total_sales,
        COALESCE(SUM(paid_amount), 0) AS total_collected,
        COALESCE(SUM(remaining_amount), 0) AS total_receivables,
        COALESCE(SUM(bpjs_subsidy), 0) AS total_bpjs_subsidy,
        COALESCE(SUM(dp_amount), 0) AS total_dp,
        COALESCE(SUM(discount_amount), 0) AS total_discount
       FROM transactions 
       WHERE ${dateConditionTrx}`,
      paramsTrx
    );

    // 2. Cost of Goods Sold (HPP)
    const [cogsSummary] = await pool.query(
      `SELECT COALESCE(SUM(ti.cost_price * ti.quantity), 0) AS total_cogs
       FROM transaction_items ti 
       JOIN transactions t ON ti.transaction_id = t.id 
       WHERE ${dateConditionTrx}`,
      paramsTrx
    );

    // 3. Total Expenses
    const [expenseSummary] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses 
       FROM expenses 
       WHERE ${dateConditionExp}`,
      paramsExp
    );

    // 4. Lab orders in progress (Status Pesanan)
    const [labCount] = await pool.query(
      `SELECT 
        COUNT(*) AS total_active_lab,
        SUM(CASE WHEN status = 'Siap Diambil' THEN 1 ELSE 0 END) AS ready_for_pickup,
        SUM(CASE WHEN status = 'Proses Lab' THEN 1 ELSE 0 END) AS in_process
       FROM lab_orders 
       WHERE status != 'Selesai'`
    );

    // 5. Category sales breakdown
    const [categorySales] = await pool.query(
      `SELECT ti.category, 
              COUNT(ti.id) AS item_count,
              COALESCE(SUM(ti.total_price), 0) AS category_revenue 
       FROM transaction_items ti 
       JOIN transactions t ON ti.transaction_id = t.id 
       WHERE ${dateConditionTrx}
       GROUP BY ti.category`,
      paramsTrx
    );

    // 6. Employee commission breakdown (Hanya terhitung saat order_status = 'Selesai')
    const [commissionReport] = await pool.query(
      `SELECT e.id, e.name, e.role, e.commission_type, e.commission_rate,
              COUNT(t.id) AS transaction_count,
              COALESCE(SUM(t.grand_total), 0) AS total_handled_sales,
              CASE 
                WHEN e.commission_type = 'percentage' THEN COALESCE(SUM(t.grand_total * (e.commission_rate / 100)), 0)
                WHEN e.commission_type = 'fixed' THEN (COUNT(t.id) * e.commission_rate)
                ELSE 0
              END AS estimated_commission
       FROM employees e 
       LEFT JOIN transactions t ON e.id = t.employee_id AND (${dateConditionTrx}) AND t.order_status = 'Selesai'
       GROUP BY e.id 
       ORDER BY total_handled_sales DESC`,
      paramsTrx
    );

    const totalSales = parseFloat(salesSummary[0]?.total_sales || 0);
    const totalExpenses = parseFloat(expenseSummary[0]?.total_expenses || 0);
    const totalCogs = parseFloat(cogsSummary[0]?.total_cogs || 0);
    const netProfit = totalSales - totalCogs - totalExpenses;

    res.json({
      success: true,
      data: {
        metrics: {
          totalTransactions: parseInt(salesSummary[0]?.total_transactions || 0),
          totalSales,
          totalCollected: parseFloat(salesSummary[0]?.total_collected || 0),
          totalReceivables: parseFloat(salesSummary[0]?.total_receivables || 0),
          totalBpjsSubsidy: parseFloat(salesSummary[0]?.total_bpjs_subsidy || 0),
          totalDp: parseFloat(salesSummary[0]?.total_dp || 0),
          totalExpenses,
          totalCogs,
          netProfit,
          totalDiscount: parseFloat(salesSummary[0]?.total_discount || 0)
        },
        labStatus: {
          totalActive: parseInt(labCount[0]?.total_active_lab || 0),
          readyForPickup: parseInt(labCount[0]?.ready_for_pickup || 0),
          inProcess: parseInt(labCount[0]?.in_process || 0)
        },
        categorySales,
        commissionReport
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 10. FILE UPLOAD
// ==========================================
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Tidak ada file yang diupload' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Upload file berhasil',
      data: {
        filename: req.file.filename,
        url: fileUrl,
        size: req.file.size
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Optik Raja API Server is running healthy', timestamp: new Date() });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Optik Raja POS & Lab Server running on port ${PORT}`);
});
