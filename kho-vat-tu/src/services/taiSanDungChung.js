// Logic dùng chung cho tài sản cố định (TSCD) / công cụ dụng cụ (CCDC): kiểm tra dữ liệu, mã tự động, lịch sử, thêm mới.
const { db, TRUONG_MAC_DINH } = require('../db');
const { tinhHaoMon, homNay } = require('./haoMon');
const { ngayHopLe } = require('./tienIch');

const LOAI_HOP_LE = ['TSCD', 'CCDC'];
const TINH_TRANG_HOP_LE = ['dang_su_dung', 'tam_ngung', 'hong', 'da_giam'];
const TINH_TRANG_TEN = { dang_su_dung: 'Đang sử dụng', tam_ngung: 'Tạm ngưng', hong: 'Hỏng', da_giam: 'Đã ghi giảm' };

function chuoi(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function so(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}


// Làm sạch + kiểm tra dữ liệu gửi lên. Trả { loi } hoặc { gia_tri }.
function chuanHoa(loai, b) {
  const ten = chuoi(b.ten);
  if (!ten) return { loi: 'Cần nhập tên tài sản' };
  const soLuong = so(b.so_luong === undefined || b.so_luong === '' ? 1 : b.so_luong);
  if (!(soLuong > 0)) return { loi: 'Số lượng phải lớn hơn 0' };
  if (loai === 'TSCD' && !Number.isInteger(soLuong)) return { loi: 'Số lượng TSCĐ phải là số nguyên' };
  const donGia = so(b.don_gia === undefined || b.don_gia === '' ? 0 : b.don_gia);
  if (!(donGia >= 0)) return { loi: 'Đơn giá không được âm' };
  // Không gửi ngày ghi tăng thì lấy hôm nay; gửi trống = chưa rõ ngày (tài sản có từ trước, vd. số dư nạp từ sổ cũ).
  const ngayGhiTang = chuoi(b.ngay_ghi_tang) || (b.ngay_ghi_tang === undefined ? homNay() : null);
  if (ngayGhiTang && !ngayHopLe(ngayGhiTang)) return { loi: 'Ngày ghi tăng không hợp lệ' };
  let ngaySuDung = null;
  let soNam = null;
  let hmDau = null;
  let ngayChot = null;
  if (loai === 'TSCD') {
    ngaySuDung = chuoi(b.ngay_su_dung) || ngayGhiTang;
    if (ngaySuDung && !ngayHopLe(ngaySuDung)) return { loi: 'Ngày bắt đầu sử dụng không hợp lệ' };
    soNam = so(b.so_nam_su_dung);
    if (soNam !== null && !(soNam > 0)) return { loi: 'Thời gian sử dụng (năm) phải lớn hơn 0' };
    hmDau = so(b.hm_luy_ke_ban_dau);
    ngayChot = chuoi(b.ngay_chot_hm);
    if (hmDau !== null && !(hmDau >= 0)) return { loi: 'Hao mòn lũy kế không được âm' };
    if (hmDau !== null && !(ngayChot && ngayHopLe(ngayChot))) return { loi: 'Nhập hao mòn lũy kế thì cần nhập đúng "ngày chốt" số hao mòn đó' };
    if (hmDau === null) ngayChot = null;
    if (hmDau !== null && hmDau > donGia * soLuong + 0.5) return { loi: 'Hao mòn lũy kế không được lớn hơn nguyên giá' };
    if (soNam !== null && hmDau === null && !ngaySuDung) return { loi: 'Cần ngày bắt đầu sử dụng để tính hao mòn (hoặc nhập hao mòn lũy kế tại ngày chốt)' };
  }
  const nguon = String(chuoi(b.nguon_kinh_phi) || '661.2').replace(/^TK\s*/i, '');
  return {
    gia_tri: {
      truong: chuoi(b.truong) || TRUONG_MAC_DINH,
      ma_tai_san: chuoi(b.ma_tai_san),
      ten,
      nhom: chuoi(b.nhom),
      dvt: chuoi(b.dvt),
      so_luong: soLuong,
      don_gia: donGia,
      ngay_ghi_tang: ngayGhiTang,
      ngay_su_dung: ngaySuDung,
      so_nam_su_dung: soNam,
      hm_luy_ke_ban_dau: hmDau,
      ngay_chot_hm: ngayChot,
      nguon_kinh_phi: nguon,
      nha_cung_cap: chuoi(b.nha_cung_cap),
      so_chung_tu: chuoi(b.so_chung_tu),
      bo_phan: chuoi(b.bo_phan),
      nguoi_su_dung: chuoi(b.nguoi_su_dung),
      vi_tri: chuoi(b.vi_tri),
      ghi_chu: chuoi(b.ghi_chu),
    },
  };
}

function boSung(row, den) {
  const thanhTien = (row.don_gia || 0) * (row.so_luong || 0);
  const hm = row.loai === 'TSCD' ? tinhHaoMon(row, den) : { nguyen_gia: thanhTien };
  return { ...row, tinh_trang_ten: TINH_TRANG_TEN[row.tinh_trang] || row.tinh_trang, thanh_tien: thanhTien, ...hm };
}

function ghiLichSu(taiSanId, ngay, suKien, noiDung) {
  db.prepare('INSERT INTO tai_san_lich_su (tai_san_id, ngay, su_kien, noi_dung) VALUES (?,?,?,?)').run(taiSanId, ngay, suKien, noiDung || null);
}

function maTiepTheo(loai, truong) {
  let lon = 0;
  let rong = 3;
  const rows = db
    .prepare('SELECT ma_tai_san FROM tai_san WHERE loai = ? AND COALESCE(truong, \'\') = ? AND ma_tai_san IS NOT NULL')
    .all(loai, truong || TRUONG_MAC_DINH);
  for (const r of rows) {
    const m = /^(?:TSCD|CCDC)[\s-]*(\d+)$/i.exec(r.ma_tai_san.trim());
    if (!m) continue;
    lon = Math.max(lon, parseInt(m[1], 10));
    rong = Math.max(rong, m[1].length);
  }
  return `${loai}-${String(lon + 1).padStart(rong, '0')}`;
}

const COT = ['truong', 'ma_tai_san', 'ten', 'nhom', 'dvt', 'so_luong', 'don_gia', 'ngay_ghi_tang', 'ngay_su_dung', 'so_nam_su_dung',
  'hm_luy_ke_ban_dau', 'ngay_chot_hm', 'nguon_kinh_phi', 'nha_cung_cap', 'so_chung_tu', 'bo_phan', 'nguoi_su_dung', 'vi_tri', 'ghi_chu'];

// Thêm 1 tài sản đã chuẩn hóa (gia_tri lấy từ chuanHoa). Tự đánh mã nếu thiếu, ghi lịch sử "Ghi tăng".
// Gọi trong transaction của người dùng nếu cần nhiều bản ghi. Trả id mới.
function themTaiSan(loai, g, ghiChuLichSu) {
  const gt = { ...g };
  if (!gt.ma_tai_san) gt.ma_tai_san = maTiepTheo(loai, gt.truong);
  const info = db
    .prepare(`INSERT INTO tai_san (loai, ${COT.join(',')}) VALUES (@loai, ${COT.map((c) => '@' + c).join(',')})`)
    .run({ loai, ...gt });
  ghiLichSu(
    info.lastInsertRowid,
    gt.ngay_ghi_tang || homNay(),
    'Ghi tăng',
    ghiChuLichSu || [gt.bo_phan, gt.nguoi_su_dung, gt.vi_tri].filter(Boolean).join(' · ') || null
  );
  return info.lastInsertRowid;
}

module.exports = {
  LOAI_HOP_LE, TINH_TRANG_HOP_LE, TINH_TRANG_TEN, COT,
  chuoi, ngayHopLe, chuanHoa, boSung, ghiLichSu, maTiepTheo, themTaiSan, TRUONG_MAC_DINH,
};
