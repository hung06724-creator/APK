const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'kho.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS vat_tu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ten_hang TEXT NOT NULL,
  ma_so TEXT,
  dvt TEXT,
  ghi_chu TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vat_tu_ten ON vat_tu(ten_hang);

CREATE TABLE IF NOT EXISTS phieu_nhap (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  so_phieu TEXT,
  ngay TEXT,
  no_tk TEXT,
  co_tk TEXT,
  nguoi_nhap TEXT,
  don_vi TEXT,
  ly_do_nhap TEXT,
  nhap_tai_kho TEXT,
  dia_diem TEXT,
  so_chung_tu_goc TEXT,
  nha_cung_cap TEXT,
  tong_tien_hang REAL DEFAULT 0,
  thue_suat REAL DEFAULT 0,
  tien_thue REAL DEFAULT 0,
  tong_cong REAL DEFAULT 0,
  tong_bang_chu TEXT,
  nguon_pdf TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phieu_nhap_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phieu_nhap_id INTEGER NOT NULL REFERENCES phieu_nhap(id) ON DELETE CASCADE,
  vat_tu_id INTEGER REFERENCES vat_tu(id),
  stt INTEGER,
  ten_hang TEXT,
  ma_so TEXT,
  dvt TEXT,
  sl_chung_tu REAL DEFAULT 0,
  sl_thuc_nhap REAL DEFAULT 0,
  don_gia REAL DEFAULT 0,
  thanh_tien REAL DEFAULT 0,
  ghi_chu TEXT
);
CREATE INDEX IF NOT EXISTS idx_pni_phieu ON phieu_nhap_items(phieu_nhap_id);
CREATE INDEX IF NOT EXISTS idx_pni_vattu ON phieu_nhap_items(vat_tu_id);

CREATE TABLE IF NOT EXISTS phieu_xuat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  so_phieu TEXT,
  ngay TEXT,
  no_tk TEXT,
  co_tk TEXT,
  nguoi_nhan TEXT,
  don_vi TEXT,
  ly_do_xuat TEXT,
  xuat_tai_kho TEXT,
  dia_diem TEXT,
  tong_tien_hang REAL DEFAULT 0,
  thue_suat REAL DEFAULT 0,
  tien_thue REAL DEFAULT 0,
  tong_cong REAL DEFAULT 0,
  tong_bang_chu TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phieu_xuat_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phieu_xuat_id INTEGER NOT NULL REFERENCES phieu_xuat(id) ON DELETE CASCADE,
  vat_tu_id INTEGER REFERENCES vat_tu(id),
  stt INTEGER,
  ten_hang TEXT,
  ma_so TEXT,
  dvt TEXT,
  sl_yeu_cau REAL DEFAULT 0,
  sl_thuc_xuat REAL DEFAULT 0,
  don_gia REAL DEFAULT 0,
  thanh_tien REAL DEFAULT 0,
  ghi_chu TEXT
);
CREATE INDEX IF NOT EXISTS idx_pxi_phieu ON phieu_xuat_items(phieu_xuat_id);
CREATE INDEX IF NOT EXISTS idx_pxi_vattu ON phieu_xuat_items(vat_tu_id);
`);

// Tìm vật tư theo đúng tên (không phân biệt hoa thường/khoảng trắng thừa), tạo mới nếu chưa có.
function findOrCreateVatTu({ ten_hang, dvt, ma_so }) {
  const ten = (ten_hang || '').trim();
  if (!ten) return null;
  const existing = db
    .prepare('SELECT * FROM vat_tu WHERE lower(trim(ten_hang)) = lower(?)')
    .get(ten);
  if (existing) return existing;
  const info = db
    .prepare('INSERT INTO vat_tu (ten_hang, dvt, ma_so) VALUES (?, ?, ?)')
    .run(ten, dvt || null, ma_so || null);
  return db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(info.lastInsertRowid);
}

// Tồn kho hiện tại của toàn bộ vật tư = tổng đã nhập - tổng đã xuất.
function tonKhoTatCa() {
  return db
    .prepare(
      `
    SELECT
      v.id, v.ten_hang, v.dvt, v.ma_so,
      COALESCE(nhap.tong, 0) AS tong_nhap,
      COALESCE(xuat.tong, 0) AS tong_xuat,
      COALESCE(nhap.tong, 0) - COALESCE(xuat.tong, 0) AS ton_kho
    FROM vat_tu v
    LEFT JOIN (
      SELECT vat_tu_id, SUM(sl_thuc_nhap) AS tong
      FROM phieu_nhap_items WHERE vat_tu_id IS NOT NULL GROUP BY vat_tu_id
    ) nhap ON nhap.vat_tu_id = v.id
    LEFT JOIN (
      SELECT vat_tu_id, SUM(sl_thuc_xuat) AS tong
      FROM phieu_xuat_items WHERE vat_tu_id IS NOT NULL GROUP BY vat_tu_id
    ) xuat ON xuat.vat_tu_id = v.id
    ORDER BY v.ten_hang COLLATE NOCASE
  `
    )
    .all();
}

function tonKhoCuaVatTu(vatTuId) {
  const row = db
    .prepare(
      `
    SELECT
      COALESCE((SELECT SUM(sl_thuc_nhap) FROM phieu_nhap_items WHERE vat_tu_id = ?), 0) -
      COALESCE((SELECT SUM(sl_thuc_xuat) FROM phieu_xuat_items WHERE vat_tu_id = ?), 0) AS ton_kho
  `
    )
    .get(vatTuId, vatTuId);
  return row.ton_kho || 0;
}

module.exports = { db, findOrCreateVatTu, tonKhoTatCa, tonKhoCuaVatTu };
