const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(process.env.KHO_DB_PATH || path.join(DATA_DIR, 'kho.db'));
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
  so_chung_tu_goc TEXT,
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

CREATE TABLE IF NOT EXISTS cau_hinh (
  khoa TEXT PRIMARY KEY,
  gia_tri TEXT
);

CREATE TABLE IF NOT EXISTS theo_doi_sheet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ten_sheet TEXT NOT NULL UNIQUE,
  tieu_de TEXT,
  thu_tu INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS theo_doi_dong (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_id INTEGER NOT NULL REFERENCES theo_doi_sheet(id) ON DELETE CASCADE,
  thu_tu INTEGER DEFAULT 0,
  ngay_nhap TEXT,
  phieu_nhap TEXT,
  nguoi_nhap TEXT,
  don_vi_nhap TEXT,
  ngay_xuat TEXT,
  phieu_xuat TEXT,
  nguoi_linh TEXT,
  don_vi_linh TEXT,
  trich_yeu TEXT,
  tk_doi_ung TEXT,
  tieu_muc TEXT,
  dvt TEXT,
  sl_nhap_661 REAL,
  don_gia_nhap_661 REAL,
  thanh_tien_nhap_661 REAL,
  sl_xuat_661 REAL,
  don_gia_xuat_661 REAL,
  thanh_tien_xuat_661 REAL,
  sl_ton_661 REAL,
  don_gia_ton_661 REAL,
  thanh_tien_ton_661 REAL,
  sl_nhap_337 REAL,
  don_gia_nhap_337 REAL,
  thanh_tien_nhap_337 REAL,
  sl_xuat_337 REAL,
  don_gia_xuat_337 REAL,
  thanh_tien_xuat_337 REAL,
  sl_ton_337 REAL,
  don_gia_ton_337 REAL,
  thanh_tien_ton_337 REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_theo_doi_dong_sheet ON theo_doi_dong(sheet_id);
`);

// Thêm cột mới cho database cũ đã tạo từ trước (CREATE TABLE IF NOT EXISTS không tự
// thêm cột vào bảng đã có sẵn).
function damBaoCoCot(bang, cot, dinhNghia) {
  const cotHienCo = db.prepare(`PRAGMA table_info(${bang})`).all().map((c) => c.name);
  if (!cotHienCo.includes(cot)) {
    db.exec(`ALTER TABLE ${bang} ADD COLUMN ${cot} ${dinhNghia}`);
  }
}
damBaoCoCot('phieu_xuat', 'so_chung_tu_goc', 'TEXT');

const THEO_DOI_SHEET_MAC_DINH = [
  { ten_sheet: 'QUÝ I - 2013', tieu_de: 'QUÝ I / NĂM ____', thu_tu: 1 },
  { ten_sheet: 'QUÝ II - 2013 ', tieu_de: 'QUÝ II / NĂM ____', thu_tu: 2 },
  { ten_sheet: 'QUÝ III - 2013 ', tieu_de: 'QUÝ III / NĂM ____', thu_tu: 3 },
];

function damBaoTheoDoiSheetMacDinh() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM theo_doi_sheet').get().n;
  if (count > 0) return;
  const ins = db.prepare(
    'INSERT INTO theo_doi_sheet (ten_sheet, tieu_de, thu_tu) VALUES (@ten_sheet, @tieu_de, @thu_tu)'
  );
  const tx = db.transaction(() => THEO_DOI_SHEET_MAC_DINH.forEach((s) => ins.run(s)));
  tx();
}
damBaoTheoDoiSheetMacDinh();

const THEO_DOI_DONG_FIELDS = [
  'ngay_nhap', 'phieu_nhap', 'nguoi_nhap', 'don_vi_nhap', 'ngay_xuat', 'phieu_xuat', 'nguoi_linh', 'don_vi_linh',
  'trich_yeu', 'tk_doi_ung', 'tieu_muc', 'dvt',
  'sl_nhap_661', 'don_gia_nhap_661', 'thanh_tien_nhap_661',
  'sl_xuat_661', 'don_gia_xuat_661', 'thanh_tien_xuat_661',
  'sl_ton_661', 'don_gia_ton_661', 'thanh_tien_ton_661',
  'sl_nhap_337', 'don_gia_nhap_337', 'thanh_tien_nhap_337',
  'sl_xuat_337', 'don_gia_xuat_337', 'thanh_tien_xuat_337',
  'sl_ton_337', 'don_gia_ton_337', 'thanh_tien_ton_337',
];

function tinhThanhTienDong(dong) {
  const out = { ...dong };
  const cap = [
    ['sl_nhap_661', 'don_gia_nhap_661', 'thanh_tien_nhap_661'],
    ['sl_xuat_661', 'don_gia_xuat_661', 'thanh_tien_xuat_661'],
    ['sl_nhap_337', 'don_gia_nhap_337', 'thanh_tien_nhap_337'],
    ['sl_xuat_337', 'don_gia_xuat_337', 'thanh_tien_xuat_337'],
  ];
  cap.forEach(([sl, dg, tt]) => {
    if (out[tt] === null || out[tt] === undefined || out[tt] === '') {
      const s = Number(out[sl]);
      const d = Number(out[dg]);
      if (!Number.isNaN(s) && !Number.isNaN(d)) out[tt] = s * d;
    }
  });
  return out;
}

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

// Cấu hình các trường hiển thị trên mẫu phiếu Excel (tên đơn vị, bộ phận, người ký...).
// Lưu kiểu khóa-giá trị để dễ thêm trường mới sau này mà không cần đổi schema.
const CAU_HINH_MAC_DINH = {
  ten_don_vi: 'Trường cao đẳng nghề công nghiệp Hà Nội',
  bo_phan: 'Phòng Kế hoạch- Tài chính',
  ghi_chu_thong_tu: '( Kèm theo Thông tư số 99/2025/TT-BTC',
  ghi_chu_thong_tu_2: 'ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính',
  nguoi_ky_nhap: 'Người lập phiếu, Người giao hàng, Thủ kho, Kế toán trưởng',
  nguoi_ky_xuat: 'Người lập phiếu, Người nhận hàng, Thủ kho, Kế toán trưởng, P. Hiệu trưởng',
  // Tên người ký thật (theo đúng thứ tự chức danh ở trên), in sẵn dưới dòng "(Ký, họ
  // tên)" — để trống thì không in dòng tên (chỉ còn dòng chức danh + chỗ ký tay).
  ten_nguoi_ky_nhap: '',
  ten_nguoi_ky_xuat: '',
};

function layCauHinh() {
  const rows = db.prepare('SELECT khoa, gia_tri FROM cau_hinh').all();
  const luu = {};
  rows.forEach((r) => { luu[r.khoa] = r.gia_tri; });
  return { ...CAU_HINH_MAC_DINH, ...luu };
}

function luuCauHinh(doiTuong) {
  const upsert = db.prepare(
    'INSERT INTO cau_hinh (khoa, gia_tri) VALUES (@khoa, @gia_tri) ON CONFLICT(khoa) DO UPDATE SET gia_tri = @gia_tri'
  );
  const tx = db.transaction(() => {
    Object.keys(CAU_HINH_MAC_DINH).forEach((khoa) => {
      if (doiTuong[khoa] !== undefined) upsert.run({ khoa, gia_tri: String(doiTuong[khoa]) });
    });
  });
  tx();
  return layCauHinh();
}

module.exports = {
  db,
  findOrCreateVatTu,
  tonKhoTatCa,
  tonKhoCuaVatTu,
  layCauHinh,
  luuCauHinh,
  CAU_HINH_MAC_DINH,
  THEO_DOI_DONG_FIELDS,
  tinhThanhTienDong,
};
