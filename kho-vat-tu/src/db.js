const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// KHO_DB_PATH cho phép trỏ sang file DB khác (dùng khi chạy thử/kiểm thử song song).
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

// Các trường phục vụ "Sổ tổng hợp nhập xuất vật tư" (form theo dõi chi tiết của Phòng KH-TC).
// Chỉ lưu và xuất ra Excel, màn hình chính không bắt buộc hiển thị.
//   tk_doi_ung     : TK đối ứng (cột J của sổ)
//   tieu_muc       : tiểu mục chi (cột K của sổ)
//   nguon_kinh_phi : '661.2' hoặc '337' — quyết định số liệu rơi vào nhóm cột TK 661.2 hay TK 337
damBaoCoCot('phieu_nhap', 'tk_doi_ung', 'TEXT');
damBaoCoCot('phieu_nhap', 'tieu_muc', 'TEXT');
damBaoCoCot('phieu_nhap', 'nguon_kinh_phi', "TEXT DEFAULT '661.2'");
damBaoCoCot('phieu_xuat', 'tk_doi_ung', 'TEXT');
damBaoCoCot('phieu_xuat', 'tieu_muc', 'TEXT');
damBaoCoCot('phieu_xuat', 'nguon_kinh_phi', "TEXT DEFAULT '661.2'");
// Tiểu mục riêng cho từng dòng hàng (để trống = lấy theo phiếu).
damBaoCoCot('phieu_nhap_items', 'tieu_muc', 'TEXT');
damBaoCoCot('phieu_xuat_items', 'tieu_muc', 'TEXT');
// Dòng xuất này lấy từ dòng nhập nào — để sổ tổng hợp ghép đúng "nhập ↔ xuất" trên cùng 1 dòng.
damBaoCoCot('phieu_xuat_items', 'phieu_nhap_item_id', 'INTEGER');
// Thời điểm sửa phiếu đã lưu gần nhất (giờ máy chủ) — hiện trong chi tiết phiếu.
damBaoCoCot('phieu_nhap', 'sua_luc', 'TEXT');
damBaoCoCot('phieu_xuat', 'sua_luc', 'TEXT');
// Tra các dòng xuất đã ghép với 1 dòng nhập (ghép tự động, kiểm tra số còn lại khi tách / xuất theo phiếu nhập).
db.exec('CREATE INDEX IF NOT EXISTS idx_pxi_pni ON phieu_xuat_items(phieu_nhap_item_id)');

// Tìm vật tư theo đúng tên (không phân biệt hoa thường/khoảng trắng thừa), tạo mới nếu chưa có.
// Khóa so tên vật tư: không phân biệt hoa/thường TIẾNG VIỆT ("ổ" = "Ổ"), "Đ/đ" = "D/d", gộp khoảng trắng,
// chuẩn Unicode NFC (chữ có dấu gõ kiểu tổ hợp vẫn khớp). Các dấu khác giữ nguyên ("ô" ≠ "ổ").
// Trước đây dùng lower() của SQLite — hàm này chỉ đổi chữ không dấu (A-Z) nên "ổ 6DND" và "Ổ 6DND" bị coi là 2 vật tư.
function khoaTenVatTu(ten) {
  return String(ten || '').normalize('NFC').toLowerCase().replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}
if (!db.prepare('PRAGMA table_info(vat_tu)').all().some((c) => c.name === 'ten_khoa')) {
  db.exec('ALTER TABLE vat_tu ADD COLUMN ten_khoa TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_vat_tu_ten_khoa ON vat_tu(ten_khoa)');
(function capNhatKhoaTen() {
  const sua = db.prepare('UPDATE vat_tu SET ten_khoa = ? WHERE id = ?');
  db.transaction(() => {
    for (const r of db.prepare('SELECT id, ten_hang, ten_khoa FROM vat_tu').all()) {
      const k = khoaTenVatTu(r.ten_hang);
      if (r.ten_khoa !== k) sua.run(k, r.id);
    }
  })();
})();

// Sao lưu toàn bộ database ra data/kho.db.bak-YYYYMMDD-HHMMSS (thêm -2, -3... nếu trùng giây) trước khi ghi hàng loạt.
// VACUUM INTO cho bản sao nhất quán kể cả khi máy chủ đang chạy. Trả đường dẫn file sao lưu.
function saoLuuDb() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const goc = path.join(path.dirname(db.name), `kho.db.bak-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`);
  let bak = goc;
  for (let i = 2; fs.existsSync(bak); i++) bak = `${goc}-${i}`;
  db.prepare('VACUUM INTO ?').run(bak);
  return bak;
}

// Tìm vật tư theo tên (không phân biệt hoa/thường, dấu cách thừa, Đ/D) — KHÔNG tạo mới.
function timVatTuTheoTen(ten) {
  const t = (ten || '').trim();
  return t ? db.prepare('SELECT * FROM vat_tu WHERE ten_khoa = ? ORDER BY id LIMIT 1').get(khoaTenVatTu(t)) || null : null;
}

function findOrCreateVatTu({ ten_hang, dvt, ma_so }) {
  const ten = (ten_hang || '').trim();
  if (!ten) return null;
  const khoa = khoaTenVatTu(ten);
  const existing = db.prepare('SELECT * FROM vat_tu WHERE ten_khoa = ? ORDER BY id LIMIT 1').get(khoa);
  if (existing) return existing;
  const info = db
    .prepare('INSERT INTO vat_tu (ten_hang, dvt, ma_so, ten_khoa) VALUES (?, ?, ?, ?)')
    .run(ten, dvt || null, ma_so || null, khoa);
  return db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(info.lastInsertRowid);
}

// Tồn kho hiện tại của toàn bộ vật tư = tổng đã nhập - tổng đã xuất.
// Tồn đầu kỳ: số dư của vật tư tại 1 ngày (vd hàng nhập trước kỳ dữ liệu). Mỗi vật tư tối đa 1 dòng.
// Tồn kho = tồn đầu kỳ + tổng nhập - tổng xuất.
db.exec(`
CREATE TABLE IF NOT EXISTS ton_dau_ky (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vat_tu_id INTEGER NOT NULL UNIQUE REFERENCES vat_tu(id) ON DELETE CASCADE,
  ngay TEXT NOT NULL,
  so_luong REAL NOT NULL,
  don_gia REAL,
  ghi_chu TEXT,
  nguon TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

function tonKhoTatCa() {
  return db
    .prepare(
      `
    SELECT
      v.id, v.ten_hang, v.dvt, v.ma_so,
      COALESCE(tdk.so_luong, 0) AS ton_dau_ky,
      tdk.ngay AS ngay_dau_ky,
      tdk.don_gia AS don_gia_dau_ky,
      ROUND(COALESCE(nhap.tong, 0), 6) + 0 AS tong_nhap,
      ROUND(COALESCE(xuat.tong, 0), 6) + 0 AS tong_xuat,
      -- làm tròn 6 số lẻ: 0,3 - 0,1 - 0,2 phải ra 0 chứ không phải -0,0000000000000000555 (bị coi là âm kho)
      ROUND(COALESCE(tdk.so_luong, 0) + COALESCE(nhap.tong, 0) - COALESCE(xuat.tong, 0), 6) + 0 AS ton_kho
    FROM vat_tu v
    LEFT JOIN ton_dau_ky tdk ON tdk.vat_tu_id = v.id
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
    SELECT ROUND(
      COALESCE((SELECT so_luong FROM ton_dau_ky WHERE vat_tu_id = ?), 0) +
      COALESCE((SELECT SUM(sl_thuc_nhap) FROM phieu_nhap_items WHERE vat_tu_id = ?), 0) -
      COALESCE((SELECT SUM(sl_thuc_xuat) FROM phieu_xuat_items WHERE vat_tu_id = ?), 0), 6) + 0 AS ton_kho
  `
    )
    .get(vatTuId, vatTuId, vatTuId);
  return row.ton_kho || 0;
}

// Tài sản cố định (TSCD) và công cụ dụng cụ (CCDC): dùng chung 1 bảng, phân biệt bằng cột loai.
db.exec(`
CREATE TABLE IF NOT EXISTS tai_san (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loai TEXT NOT NULL CHECK (loai IN ('TSCD','CCDC')),
  ma_tai_san TEXT,
  ten TEXT NOT NULL,
  nhom TEXT,
  dvt TEXT,
  so_luong REAL NOT NULL DEFAULT 1,
  don_gia REAL NOT NULL DEFAULT 0,
  ngay_ghi_tang TEXT,
  ngay_su_dung TEXT,
  so_nam_su_dung REAL,
  nguon_kinh_phi TEXT DEFAULT '661.2',
  nha_cung_cap TEXT,
  so_chung_tu TEXT,
  bo_phan TEXT,
  nguoi_su_dung TEXT,
  vi_tri TEXT,
  tinh_trang TEXT NOT NULL DEFAULT 'dang_su_dung',
  ngay_giam TEXT,
  ly_do_giam TEXT,
  ghi_chu TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tai_san_loai ON tai_san(loai);

CREATE TABLE IF NOT EXISTS tai_san_lich_su (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tai_san_id INTEGER NOT NULL REFERENCES tai_san(id) ON DELETE CASCADE,
  ngay TEXT,
  su_kien TEXT NOT NULL,
  noi_dung TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tai_san_ls ON tai_san_lich_su(tai_san_id);
`);

// Bổ sung cột cho DB đã tạo từ trước: hao mòn lũy kế tại ngày chốt (dùng khi nạp tài sản từ sổ cũ không có ngày ghi tăng).
// so_lieu_goc: số liệu sổ gốc của năm nạp (JSON: nam, dau, tang, giam, cuoi, hmTruoc, hmNam, hmGiam, hmCuoi). Sổ chi tiết
// của đúng năm đó in lại đúng số sổ gốc; hmTruoc (LKHM 31/12 năm trước) là mốc thứ 2 để ước tính lùi hao mòn chính xác hơn.
for (const [cot, kieu] of [['hm_luy_ke_ban_dau', 'REAL'], ['ngay_chot_hm', 'TEXT'], ['so_lieu_goc', 'TEXT']]) {
  if (!db.prepare('PRAGMA table_info(tai_san)').all().some((c) => c.name === cot)) {
    db.exec(`ALTER TABLE tai_san ADD COLUMN ${cot} ${kieu}`);
  }
}

// Tài sản thuộc trường nào: trường tôi + các trường sáp nhập về (mỗi trường có sổ riêng, mã tài sản có thể trùng nhau
// giữa các trường nên mã chỉ cần duy nhất trong từng trường).
const TRUONG_MAC_DINH = 'Trường cao đẳng nghề công nghiệp Hà Nội';
if (!db.prepare('PRAGMA table_info(tai_san)').all().some((c) => c.name === 'truong')) {
  db.exec('ALTER TABLE tai_san ADD COLUMN truong TEXT');
}
db.prepare("UPDATE tai_san SET truong = ? WHERE truong IS NULL OR TRIM(truong) = ''").run(TRUONG_MAC_DINH);
db.exec(`
DROP INDEX IF EXISTS idx_tai_san_ma;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tai_san_ma_truong ON tai_san(loai, truong, ma_tai_san) WHERE ma_tai_san IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tai_san_truong ON tai_san(truong);
`);

// Kiểm kê tài sản: mỗi đợt chụp lại (snapshot) danh sách tài sản theo phạm vi lúc tạo; mỗi dòng ghi kết quả kiểm.
db.exec(`
CREATE TABLE IF NOT EXISTS kiem_ke (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ten TEXT NOT NULL,
  loai TEXT NOT NULL,              -- TSCD | CCDC | TAT_CA
  truong TEXT, bo_phan TEXT, nhom TEXT,   -- phạm vi (trống = tất cả)
  ngay TEXT NOT NULL,              -- ngày kiểm kê (thời điểm tính số liệu sổ sách)
  ban_kiem_ke TEXT,                -- mỗi dòng: Họ tên - Chức vụ - Vai trò (dòng đầu = Trưởng ban)
  ghi_chu TEXT,
  trang_thai TEXT NOT NULL DEFAULT 'dang_kiem',  -- dang_kiem | da_chot
  chot_luc TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS kiem_ke_dong (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kiem_ke_id INTEGER NOT NULL REFERENCES kiem_ke(id) ON DELETE CASCADE,
  tai_san_id INTEGER REFERENCES tai_san(id) ON DELETE SET NULL,
  loai TEXT, truong TEXT, ma_tai_san TEXT, ten TEXT, nhom TEXT, dvt TEXT,
  bo_phan TEXT, nguoi_su_dung TEXT, vi_tri TEXT,
  so_luong REAL, nguyen_gia REAL, gia_tri_con_lai REAL,   -- theo sổ kế toán tại ngày kiểm kê
  ket_qua TEXT,                    -- NULL = chưa kiểm | co | khong_thay | hong
  so_luong_thuc_te REAL,
  ghi_chu TEXT,
  kiem_luc TEXT
);
CREATE INDEX IF NOT EXISTS idx_kkd_dot ON kiem_ke_dong(kiem_ke_id);
`);

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
  // Đầu sổ + người ký cho các sổ/bảng xuất Excel (TSCĐ, CCDC, tồn kho, danh sách phiếu) — theo sổ TSCĐ của trường.
  don_vi_cap_tren: 'UBNDTP Hà Nội',
  ten_don_vi_so: 'Trường Cao Đẳng Nghề Công Nghiệp Hà Nội',
  so_nguoi_lap_bieu: 'Đỗ Thị Minh Sang',
  so_ke_toan_truong: 'Vũ Thị Trang',
  so_hieu_truong: 'Phạm Thị Hường',
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

// Chuẩn hóa số phiếu đã lưu: phiếu nhập luôn "PN ...", phiếu xuất luôn "PX ..." (chạy lại nhiều lần vẫn an toàn).
(function chuanHoaSoPhieuDaLuu() {
  const { chuanHoaSoPhieu } = require('./services/soPhieu');
  const lam = db.transaction(() => {
    for (const [bang, loai] of [['phieu_nhap', 'nhap'], ['phieu_xuat', 'xuat']]) {
      const capNhat = db.prepare(`UPDATE ${bang} SET so_phieu = ? WHERE id = ?`);
      for (const r of db.prepare(`SELECT id, so_phieu FROM ${bang} WHERE so_phieu IS NOT NULL`).all()) {
        const moi = chuanHoaSoPhieu(loai, r.so_phieu);
        if (moi !== r.so_phieu) capNhat.run(moi, r.id);
      }
    }
  });
  lam();
})();

// Khóa sổ theo năm (xem src/services/khoaSo.js): năm đã khóa thì mọi nghiệp vụ có ngày trong năm đó chỉ còn xem và
// xuất báo cáo. khoa_so_lich_su ghi mọi lần khóa / mở khóa (mở khóa phải có lý do).
db.exec(`
CREATE TABLE IF NOT EXISTS khoa_so (
  nam INTEGER PRIMARY KEY,
  khoa_luc TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  ghi_chu TEXT
);
CREATE TABLE IF NOT EXISTS khoa_so_lich_su (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nam INTEGER NOT NULL,
  hanh_dong TEXT NOT NULL CHECK (hanh_dong IN ('khoa', 'mo')),
  noi_dung TEXT,
  luc TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
`);

module.exports = {
  db, TRUONG_MAC_DINH, findOrCreateVatTu, timVatTuTheoTen, khoaTenVatTu, tonKhoTatCa, tonKhoCuaVatTu, layCauHinh, luuCauHinh, saoLuuDb,
};
