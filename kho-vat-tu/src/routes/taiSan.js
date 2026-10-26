const express = require('express');
const { db, layCauHinh } = require('../db');
const { homNay } = require('../services/haoMon');
const { chuoiTim, soSanhVi } = require('../services/tienIch');
const { loiKhoaSo, namKhoaCua, LOI_KHOA } = require('../services/khoaSo');
// Số liệu tài chính của 1 tài sản: đổi các cột này khi tài sản ghi tăng trong năm đã khóa sổ sẽ làm đổi sổ năm đó.
const COT_TAI_CHINH = {
  don_gia: 'nguyên giá', so_luong: 'số lượng', ngay_ghi_tang: 'ngày ghi tăng', ngay_su_dung: 'ngày bắt đầu sử dụng',
  so_nam_su_dung: 'thời gian sử dụng', hm_luy_ke_ban_dau: 'hao mòn đã có', ngay_chot_hm: 'ngày chốt hao mòn', truong: 'trường',
};
const soHoacNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
function cotTaiChinhDoi(cu, moi) {
  return Object.keys(COT_TAI_CHINH).filter((k) => {
    if (['don_gia', 'so_luong', 'so_nam_su_dung', 'hm_luy_ke_ban_dau'].includes(k)) {
      const a = soHoacNull(cu[k]); const b = soHoacNull(moi[k]);
      return a === null || b === null ? a !== b : Math.abs(a - b) > 0.005;
    }
    if (k === 'ngay_su_dung') return (cu.ngay_su_dung || cu.ngay_ghi_tang || '') !== (moi.ngay_su_dung || moi.ngay_ghi_tang || '');
    return (cu[k] || '') !== (moi[k] || '');
  });
}
const { headerTaiFile } = require('../services/tenFile');
const { xuatSoChiTietTscd, xuatDanhSachTscd, xuatSoCcdc } = require('../services/xuatTaiSan');
const { pngQr, trangInTem, excelTem, noiDungQr } = require('../services/temQr');
const {
  LOAI_HOP_LE, TINH_TRANG_HOP_LE, TINH_TRANG_TEN, COT,
  chuoi, ngayHopLe, chuanHoa, boSung, ghiLichSu, maTiepTheo, themTaiSan, TRUONG_MAC_DINH,
} = require('../services/taiSanDungChung');

const router = express.Router();
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const cauHinhSo = () => ({ ...layCauHinh(), truong_goc: TRUONG_MAC_DINH });

// ---------- Lọc + sắp xếp dùng chung cho danh sách và các bản xuất ----------
const SAP_XEP = {
  ma: (r) => r.ma_tai_san || '',
  ten: (r) => r.ten || '',
  nhom: (r) => r.nhom || '',
  so_luong: (r) => r.so_luong,
  nguyen_gia: (r) => r.thanh_tien,
  hao_mon: (r) => r.hao_mon_luy_ke ?? -1,
  con_lai: (r) => r.gia_tri_con_lai ?? r.thanh_tien,
  ngay: (r) => r.ngay_su_dung || r.ngay_ghi_tang || '',
  noi: (r) => [r.bo_phan, r.nguoi_su_dung, r.vi_tri].filter(Boolean).join(' '),
  tinh_trang: (r) => r.tinh_trang,
};

function locDanhSach(query) {
  const loai = query.loai;
  if (!LOAI_HOP_LE.includes(loai)) return { loi: 'loai phải là TSCD hoặc CCDC' };
  const den = query.den ? String(query.den) : homNay();
  if (!ngayHopLe(den)) return { loi: 'Ngày "tính đến" không hợp lệ' };
  let rows = db.prepare('SELECT * FROM tai_san WHERE loai = ?').all(loai);
  // Xem "tính đến" 1 ngày đã qua: bỏ tài sản ghi tăng sau ngày đó; tài sản ghi giảm sau ngày đó vẫn đang quản lý tại ngày đó.
  if (den < homNay()) {
    rows = rows.filter((r) => !(r.ngay_ghi_tang && r.ngay_ghi_tang > den))
      .map((r) => (r.tinh_trang === 'da_giam' && r.ngay_giam && r.ngay_giam > den ? { ...r, tinh_trang: 'dang_su_dung', giam_sau_ngay_xem: r.ngay_giam } : r));
  }
  // Tìm không phân biệt dấu, hoa / thường ("may tinh" tìm được "Máy tính").
  const q = chuoiTim(query.q);
  if (q) rows = rows.filter((r) => chuoiTim([r.ma_tai_san, r.ten, r.nhom, r.nguoi_su_dung, r.vi_tri, r.bo_phan, r.so_chung_tu, r.ghi_chu].join(' ')).includes(q));
  if (query.ids) { // xuất / xem đúng các dòng đã tick
    const chon = new Set(String(query.ids).split(',').map(Number).filter(Boolean));
    rows = rows.filter((r) => chon.has(r.id));
  }
  for (const k of ['tinh_trang', 'bo_phan', 'truong', 'nhom']) {
    if (query[k]) rows = rows.filter((r) => (r[k] || '') === query[k]);
  }
  let items = rows.map((r) => boSung(r, den));
  // gia_tri: con = còn giá trị, het = đã hết khấu hao (giá trị còn lại 0), chua = chưa có thời gian sử dụng
  if (query.gia_tri === 'con') items = items.filter((r) => (r.gia_tri_con_lai ?? r.thanh_tien) > 0.5);
  if (query.gia_tri === 'het') items = items.filter((r) => r.gia_tri_con_lai !== null && r.gia_tri_con_lai !== undefined && r.gia_tri_con_lai <= 0.5);
  if (query.gia_tri === 'chua') items = items.filter((r) => r.hao_mon_luy_ke === null);
  const khoa = SAP_XEP[query.sap_xep] || SAP_XEP.ma;
  const dao = query.chieu === 'giam' ? -1 : 1;
  items.sort((a, b) => {
    const x = khoa(a); const y = khoa(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : soSanhVi(x, y);
    return c * dao || a.id - b.id;
  });
  const moTa = [
    query.truong && `Trường: ${query.truong}`, query.nhom && `Nhóm: ${query.nhom}`, query.bo_phan && `Bộ phận: ${query.bo_phan}`,
    query.tinh_trang && `Tình trạng: ${TINH_TRANG_TEN[query.tinh_trang] || query.tinh_trang}`,
    query.gia_tri && { con: 'Còn giá trị', het: 'Đã hết khấu hao', chua: 'Chưa có thời gian sử dụng' }[query.gia_tri],
    q && `Tìm: "${query.q}"`,
  ].filter(Boolean).join(' · ');
  return { loai, den, items, moTaLoc: moTa };
}

function tongHop(loai, items) {
  const dangQuanLy = items.filter((r) => r.tinh_trang !== 'da_giam');
  const tong = {
    so_ban_ghi: items.length,
    tong_so_luong: dangQuanLy.reduce((s, r) => s + r.so_luong, 0),
    tong_nguyen_gia: dangQuanLy.reduce((s, r) => s + r.thanh_tien, 0),
    dang_su_dung: items.filter((r) => r.tinh_trang === 'dang_su_dung').length,
    hong: items.filter((r) => r.tinh_trang === 'hong').length,
    da_giam: items.filter((r) => r.tinh_trang === 'da_giam').length,
  };
  if (loai === 'TSCD') {
    tong.tong_hao_mon_luy_ke = dangQuanLy.reduce((s, r) => s + (r.hao_mon_luy_ke || 0), 0);
    tong.tong_gia_tri_con_lai = dangQuanLy.reduce((s, r) => s + (r.gia_tri_con_lai === null ? r.thanh_tien : r.gia_tri_con_lai), 0);
    tong.chua_co_thoi_gian_su_dung = dangQuanLy.filter((r) => r.hao_mon_luy_ke === null).length;
    tong.het_khau_hao = dangQuanLy.filter((r) => r.gia_tri_con_lai !== null && r.gia_tri_con_lai <= 0.5).length;
  }
  return tong;
}

const theoTruong = (items) => {
  const m = new Map();
  [TRUONG_MAC_DINH, ...items.map((r) => r.truong)].forEach((t) => { if (!m.has(t)) m.set(t, []); });
  items.forEach((r) => m.get(r.truong).push(r));
  return [...m].filter(([, ds]) => ds.length);
};

// Danh sách chỉ trả các cột màn hình dùng (form sửa tự tải đủ chi tiết qua GET /:id) — nhẹ hơn nhiều với ~2.400 tài sản.
const COT_DANH_SACH = ['id', 'ma_tai_san', 'ten', 'nhom', 'dvt', 'so_luong', 'don_gia', 'thanh_tien', 'hao_mon_luy_ke', 'gia_tri_con_lai',
  'bo_phan', 'nguoi_su_dung', 'vi_tri', 'tinh_trang', 'ngay_giam', 'giam_sau_ngay_xem', 'truong'];
router.get('/', (req, res) => {
  const kq = locDanhSach(req.query);
  if (kq.loi) return res.status(400).json({ error: kq.loi });
  const items = kq.items.map((r) => Object.fromEntries(COT_DANH_SACH.map((k) => [k, r[k] === undefined ? null : r[k]])));
  res.json({ den: kq.den, tong: tongHop(kq.loai, kq.items), items });
});

// Gợi ý cho form: mã tiếp theo + các giá trị đã dùng (dùng gần nhất lên đầu).
router.get('/goi-y', (req, res) => {
  const loai = req.query.loai;
  if (!LOAI_HOP_LE.includes(loai)) return res.status(400).json({ error: 'loai phải là TSCD hoặc CCDC' });
  const lay = (cot) =>
    db
      .prepare(
        `SELECT TRIM(${cot}) AS v FROM tai_san WHERE loai = ? AND ${cot} IS NOT NULL AND TRIM(${cot}) <> ''
         GROUP BY TRIM(${cot}) ORDER BY MAX(id) DESC`
      )
      .all(loai)
      .map((r) => r.v);
  const truongCoDuLieu = db
    .prepare("SELECT TRIM(truong) AS v FROM tai_san WHERE truong IS NOT NULL AND TRIM(truong) <> '' GROUP BY TRIM(truong) ORDER BY MIN(id)")
    .all()
    .map((r) => r.v);
  const truong = [TRUONG_MAC_DINH, ...truongCoDuLieu.filter((t) => t !== TRUONG_MAC_DINH)];
  res.json({
    truong,
    truong_mac_dinh: TRUONG_MAC_DINH,
    ma_tai_san: maTiepTheo(loai, chuoi(req.query.truong) || TRUONG_MAC_DINH),
    nhom: lay('nhom').sort(soSanhVi),
    dvt: lay('dvt'),
    bo_phan: lay('bo_phan'),
    nguoi_su_dung: lay('nguoi_su_dung'),
    vi_tri: lay('vi_tri'),
    nha_cung_cap: lay('nha_cung_cap'),
  });
});

// ---------- Xuất Excel ----------
// Danh sách đang lọc: TSCĐ -> danh sách TSCĐ; CCDC -> sổ theo dõi CCDC tại nơi sử dụng (SKT03).
router.get('/xuat-excel', async (req, res, next) => {
  try {
    // Sổ CCDC có kỳ riêng (từ ngày - đến ngày): không áp "tính đến" của màn danh sách.
    const kq = locDanhSach(req.query.loai === 'CCDC' ? { ...req.query, den: '' } : req.query);
    if (kq.loi) return res.status(400).json({ error: kq.loi });
    let buf; let ten;
    if (kq.loai === 'TSCD') {
      buf = await xuatDanhSachTscd({ items: kq.items, den: kq.den, moTaLoc: kq.moTaLoc, cauHinh: cauHinhSo() });
      ten = `DanhSachTSCD_${kq.den}.xlsx`;
    } else {
      const nam = new Date().getFullYear();
      const tuNgay = ngayHopLe(String(req.query.tu || '')) ? req.query.tu : `${nam}-01-01`;
      const denNgay = ngayHopLe(String(req.query.den_ngay || '')) ? req.query.den_ngay : homNay();
      buf = await xuatSoCcdc({ theoTruong: theoTruong(kq.items), tuNgay, denNgay, noiSuDung: req.query.bo_phan || '', cauHinh: cauHinhSo() });
      ten = `SoTheoDoiCCDC_SKT03_${tuNgay}_${denNgay}.xlsx`;
    }
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', headerTaiFile(ten));
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

// Sổ chi tiết TSCĐ năm N (theo mẫu sổ của trường), mỗi trường 1 sheet; áp dụng bộ lọc trường/nhóm/bộ phận/tình trạng.
router.get('/so-chi-tiet', async (req, res, next) => {
  try {
    const nam = Number(req.query.nam) || new Date().getFullYear();
    if (nam < 1990 || nam > 2100) return res.status(400).json({ error: 'Năm không hợp lệ' });
    const kq = locDanhSach({ ...req.query, loai: 'TSCD', gia_tri: '', sap_xep: 'ma', den: '' }); // sổ năm N tự lọc theo ngày
    if (kq.loi) return res.status(400).json({ error: kq.loi });
    const { buffer } = await xuatSoChiTietTscd({ nam, theoTruong: theoTruong(kq.items), cauHinh: cauHinhSo(), nhomLoc: req.query.nhom || '' });
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', headerTaiFile(`SoChiTietTSCD_${nam}.xlsx`));
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

// ---------- Mã QR ----------
// Tem QR cho danh sách đang lọc / dòng chọn (ids): kieu=html (trang in A4) | xlsx (Excel tem). cot = số tem mỗi hàng.
router.get('/tem-qr', async (req, res, next) => {
  try {
    const kq = locDanhSach({ ...req.query, den: '' }); // in tem theo tài sản hiện có, không theo "tính đến"
    if (kq.loi) return res.status(400).json({ error: kq.loi });
    const items = kq.items.filter((r) => req.query.ca_da_giam === '1' || r.tinh_trang !== 'da_giam');
    const tieuDe = `Tem QR ${kq.loai === 'TSCD' ? 'tài sản cố định' : 'công cụ dụng cụ'}`;
    const thamSo = { items, cot: req.query.cot, cauHinh: layCauHinh(), truongGoc: TRUONG_MAC_DINH, tieuDe };
    if (req.query.kieu === 'xlsx') {
      const buf = await excelTem(thamSo);
      res.setHeader('Content-Type', XLSX);
      res.setHeader('Content-Disposition', headerTaiFile(`TemQR_${kq.loai}_${homNay()}.xlsx`));
      return res.send(Buffer.from(buf));
    }
    res.type('html').send(await trangInTem(thamSo));
  } catch (err) { next(err); }
});

// Ảnh QR của 1 tài sản (?size=, ?tai=1 để tải về).
router.get('/:id/qr.png', async (req, res, next) => {
  try {
    const r = db.prepare('SELECT id, ma_tai_san FROM tai_san WHERE id = ?').get(req.params.id);
    if (!r) return res.status(404).json({ error: 'Không tìm thấy tài sản' });
    const buf = await pngQr(noiDungQr(r), req.query.size);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    if (req.query.tai) res.setHeader('Content-Disposition', headerTaiFile(`QR_${noiDungQr(r)}.png`));
    res.send(buf);
  } catch (err) { next(err); }
});

// ---------- Thao tác hàng loạt ----------
// body: { ids: [..], hanh_dong: 'dieu_chuyen'|'tinh_trang'|'cap_nhat'|'ghi_giam'|'xoa', du_lieu: {...} }
router.post('/hang-loat', (req, res) => {
  const b = req.body || {};
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) return res.status(400).json({ error: 'Chưa chọn tài sản nào' });
  const d = b.du_lieu || {};
  const ngay = chuoi(d.ngay) || homNay();
  if (!ngayHopLe(ngay)) return res.status(400).json({ error: 'Ngày không hợp lệ' });
  if (b.hanh_dong !== 'xoa') { // nghiệp vụ ghi theo ngày (điều chuyển, đổi tình trạng, cập nhật, ghi giảm)
    const khoa = loiKhoaSo('ghi nghiệp vụ tài sản', ngay);
    if (khoa) return res.status(LOI_KHOA).json({ error: khoa });
  }
  const rows = db.prepare(`SELECT * FROM tai_san WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids);
  if (rows.length !== ids.length) return res.status(404).json({ error: 'Có tài sản không còn tồn tại, hãy tải lại trang' });
  const ghiChu = chuoi(d.ghi_chu);
  let capNhat = 0;
  const boQua = [];

  try {
    db.transaction(() => {
      if (b.hanh_dong === 'dieu_chuyen') {
        const moi = {};
        for (const k of ['bo_phan', 'nguoi_su_dung', 'vi_tri']) if (chuoi(d[k])) moi[k] = chuoi(d[k]);
        if (!Object.keys(moi).length) throw Object.assign(new Error('Cần nhập ít nhất bộ phận, người sử dụng hoặc vị trí mới'), { status: 400 });
        const nhan = { bo_phan: 'Bộ phận', nguoi_su_dung: 'Người sử dụng', vi_tri: 'Vị trí' };
        for (const r of rows) {
          const doi = Object.keys(moi).filter((k) => (r[k] || '') !== moi[k]);
          if (!doi.length) { boQua.push(`${r.ma_tai_san}: đã ở đúng nơi`); continue; }
          db.prepare(`UPDATE tai_san SET ${doi.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...moi, id: r.id });
          ghiLichSu(r.id, ngay, 'Điều chuyển / đổi nơi sử dụng',
            doi.map((k) => `${nhan[k]}: ${r[k] || '(trống)'} → ${moi[k]}`).join('; ') + (ghiChu ? ` (${ghiChu})` : ''));
          capNhat++;
        }
      } else if (b.hanh_dong === 'tinh_trang') {
        const tt = d.tinh_trang;
        if (!TINH_TRANG_HOP_LE.includes(tt) || tt === 'da_giam') throw Object.assign(new Error('Tình trạng không hợp lệ (dùng "Ghi giảm" để ghi giảm)'), { status: 400 });
        for (const r of rows) {
          if (r.tinh_trang === tt) { boQua.push(`${r.ma_tai_san}: đã ở tình trạng này`); continue; }
          const namGiam = r.tinh_trang === 'da_giam' ? namKhoaCua(r.ngay_giam) : null;
          if (namGiam) { boQua.push(`${r.ma_tai_san}: ghi giảm trong năm ${namGiam} đã khóa sổ, không khôi phục được`); continue; }
          db.prepare("UPDATE tai_san SET tinh_trang = ?, ngay_giam = NULL, ly_do_giam = NULL, updated_at = datetime('now') WHERE id = ?").run(tt, r.id);
          ghiLichSu(r.id, ngay, r.tinh_trang === 'da_giam' ? 'Khôi phục' : 'Đổi tình trạng',
            `${TINH_TRANG_TEN[r.tinh_trang]} → ${TINH_TRANG_TEN[tt]}` + (ghiChu ? ` (${ghiChu})` : ''));
          capNhat++;
        }
      } else if (b.hanh_dong === 'cap_nhat') {
        const moi = {};
        if (chuoi(d.nhom)) moi.nhom = chuoi(d.nhom);
        if (chuoi(d.nguon_kinh_phi)) moi.nguon_kinh_phi = String(chuoi(d.nguon_kinh_phi)).replace(/^TK\s*/i, '');
        if (chuoi(d.truong)) moi.truong = chuoi(d.truong);
        if (chuoi(d.dvt)) moi.dvt = chuoi(d.dvt);
        if (d.so_nam_su_dung !== undefined && d.so_nam_su_dung !== '') {
          const n = Number(d.so_nam_su_dung);
          if (!(n > 0)) throw Object.assign(new Error('Thời gian sử dụng phải lớn hơn 0'), { status: 400 });
          moi.so_nam_su_dung = n;
        }
        if (!Object.keys(moi).length) throw Object.assign(new Error('Chưa nhập thông tin cần cập nhật'), { status: 400 });
        const nhan = { nhom: 'Nhóm', nguon_kinh_phi: 'Nguồn KP', truong: 'Trường', dvt: 'ĐVT', so_nam_su_dung: 'Thời gian sử dụng (năm)' };
        for (const r of rows) {
          const doi = Object.keys(moi).filter((k) => String(r[k] ?? '') !== String(moi[k]));
          if (!doi.length) { boQua.push(`${r.ma_tai_san}: không có gì thay đổi`); continue; }
          if (moi.so_nam_su_dung && r.loai !== 'TSCD') { boQua.push(`${r.ma_tai_san}: CCDC không có thời gian sử dụng`); continue; }
          const namTang = (doi.includes('so_nam_su_dung') || doi.includes('truong')) ? namKhoaCua(r.ngay_ghi_tang) : null;
          if (namTang) { boQua.push(`${r.ma_tai_san}: ghi tăng năm ${namTang} đã khóa sổ, không đổi thời gian sử dụng / trường`); continue; }
          db.prepare(`UPDATE tai_san SET ${doi.map((k) => `${k} = @${k}`).join(', ')}, updated_at = datetime('now') WHERE id = @id`).run({ ...moi, id: r.id });
          ghiLichSu(r.id, ngay, 'Cập nhật thông tin', doi.map((k) => `${nhan[k]}: ${r[k] ?? '(trống)'} → ${moi[k]}`).join('; '));
          capNhat++;
        }
      } else if (b.hanh_dong === 'ghi_giam') {
        const lyDo = chuoi(d.ly_do);
        if (!lyDo) throw Object.assign(new Error('Cần nhập lý do ghi giảm'), { status: 400 });
        for (const r of rows) {
          if (r.tinh_trang === 'da_giam') { boQua.push(`${r.ma_tai_san}: đã ghi giảm từ trước`); continue; }
          if (r.ngay_ghi_tang && ngay < r.ngay_ghi_tang) { boQua.push(`${r.ma_tai_san}: ngày ghi giảm trước ngày ghi tăng (${r.ngay_ghi_tang})`); continue; }
          db.prepare("UPDATE tai_san SET tinh_trang = 'da_giam', ngay_giam = ?, ly_do_giam = ?, updated_at = datetime('now') WHERE id = ?").run(ngay, lyDo, r.id);
          ghiLichSu(r.id, ngay, 'Ghi giảm', lyDo + (ghiChu ? ` (${ghiChu})` : ''));
          capNhat++;
        }
      } else if (b.hanh_dong === 'xoa') {
        // Tài sản ghi tăng / ghi giảm trong năm đã khóa sổ thì không xóa được (sổ năm đó đã chốt).
        const xoaDuoc = [];
        for (const r of rows) {
          const nam = namKhoaCua(r.ngay_ghi_tang, r.tinh_trang === 'da_giam' ? r.ngay_giam : null);
          if (nam) boQua.push(`${r.ma_tai_san}: có nghiệp vụ trong năm ${nam} đã khóa sổ`);
          else xoaDuoc.push(r.id);
        }
        if (xoaDuoc.length) capNhat = db.prepare(`DELETE FROM tai_san WHERE id IN (${xoaDuoc.map(() => '?').join(',')})`).run(...xoaDuoc).changes;
      } else {
        throw Object.assign(new Error('Thao tác không hợp lệ'), { status: 400 });
      }
    })();
  } catch (err) {
    const trung = /UNIQUE/.test(err.message);
    return res.status(err.status || (trung ? 409 : 500)).json({
      error: trung ? 'Không đổi được: trường đích đã có tài sản trùng mã với tài sản đang chọn' : err.message,
    });
  }
  res.json({ cap_nhat: capNhat, bo_qua: boQua.length, chi_tiet_bo_qua: boQua.slice(0, 20) });
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM tai_san WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy tài sản' });
  const lichSu = db.prepare('SELECT * FROM tai_san_lich_su WHERE tai_san_id = ? ORDER BY id DESC').all(row.id);
  res.json({ ...boSung(row), lich_su: lichSu });
});

function loiTrungMa(err, loai) {
  if (err && /UNIQUE/.test(err.message)) return `Mã tài sản đã tồn tại trong danh sách ${loai === 'TSCD' ? 'TSCĐ' : 'CCDC'} của trường này`;
  return null;
}

router.post('/', (req, res) => {
  const b = req.body || {};
  const loai = b.loai;
  if (!LOAI_HOP_LE.includes(loai)) return res.status(400).json({ error: 'loai phải là TSCD hoặc CCDC' });
  const kq = chuanHoa(loai, b);
  if (kq.loi) return res.status(400).json({ error: kq.loi });
  const khoa = loiKhoaSo('ghi tăng tài sản', kq.gia_tri.ngay_ghi_tang);
  if (khoa) return res.status(LOI_KHOA).json({ error: khoa });
  try {
    const id = db.transaction(() => themTaiSan(loai, kq.gia_tri))();
    res.status(201).json(boSung(db.prepare('SELECT * FROM tai_san WHERE id = ?').get(id)));
  } catch (err) {
    const loi = loiTrungMa(err, loai);
    res.status(loi ? 409 : 500).json({ error: loi || 'Lưu tài sản thất bại: ' + err.message });
  }
});

// Sửa thông tin; thay đổi nơi sử dụng / tình trạng được ghi vào lịch sử theo dõi.
router.put('/:id', (req, res) => {
  const cu = db.prepare('SELECT * FROM tai_san WHERE id = ?').get(req.params.id);
  if (!cu) return res.status(404).json({ error: 'Không tìm thấy tài sản' });
  const b = req.body || {};
  const kq = chuanHoa(cu.loai, {
    ...b,
    ma_tai_san: b.ma_tai_san === undefined ? cu.ma_tai_san : b.ma_tai_san,
    truong: b.truong === undefined ? cu.truong : b.truong,
  });
  if (kq.loi) return res.status(400).json({ error: kq.loi });
  const g = kq.gia_tri;
  if (!g.ma_tai_san) g.ma_tai_san = cu.ma_tai_san;
  let tinhTrang = cu.tinh_trang;
  if (b.tinh_trang !== undefined && b.tinh_trang !== cu.tinh_trang) {
    if (b.tinh_trang === 'da_giam') return res.status(400).json({ error: 'Dùng chức năng "Ghi giảm" để ghi giảm tài sản' });
    if (!TINH_TRANG_HOP_LE.includes(b.tinh_trang)) return res.status(400).json({ error: 'Tình trạng không hợp lệ' });
    tinhTrang = b.tinh_trang;
  }
  const homNayStr = homNay();
  // Năm đã khóa sổ: không đổi số liệu tài chính của tài sản ghi tăng trong năm đó (hay chuyển ngày ghi tăng vào năm đó),
  // không khôi phục tài sản ghi giảm trong năm đó, không ghi điều chuyển / đổi tình trạng khi năm hiện tại đã khóa.
  const doiTaiChinh = cotTaiChinhDoi(cu, g);
  const doiNoiDung = ['bo_phan', 'nguoi_su_dung', 'vi_tri'].some((k) => (cu[k] || '') !== (g[k] || '')) || tinhTrang !== cu.tinh_trang;
  const khoa = (doiTaiChinh.length && loiKhoaSo(`sửa ${doiTaiChinh.map((k) => COT_TAI_CHINH[k]).join(', ')} của tài sản ghi tăng`, cu.ngay_ghi_tang, g.ngay_ghi_tang))
    || (cu.tinh_trang === 'da_giam' && tinhTrang !== 'da_giam' && loiKhoaSo('khôi phục tài sản đã ghi giảm', cu.ngay_giam))
    || (doiNoiDung && loiKhoaSo('ghi điều chuyển hoặc đổi tình trạng tài sản', homNayStr));
  if (khoa) return res.status(LOI_KHOA).json({ error: khoa });
  try {
    db.transaction(() => {
      db.prepare(
        `UPDATE tai_san SET ${COT.map((c) => `${c} = @${c}`).join(', ')}, tinh_trang = @tinh_trang,
         ngay_giam = CASE WHEN @tinh_trang = 'da_giam' THEN ngay_giam ELSE NULL END,
         ly_do_giam = CASE WHEN @tinh_trang = 'da_giam' THEN ly_do_giam ELSE NULL END,
         updated_at = datetime('now') WHERE id = @id`
      ).run({ ...g, tinh_trang: tinhTrang, id: cu.id });
      const doi = [];
      for (const [cot, nhan] of [['bo_phan', 'Bộ phận'], ['nguoi_su_dung', 'Người sử dụng'], ['vi_tri', 'Vị trí']]) {
        if ((cu[cot] || '') !== (g[cot] || '')) doi.push(`${nhan}: ${cu[cot] || '(trống)'} → ${g[cot] || '(trống)'}`);
      }
      if (doi.length) ghiLichSu(cu.id, homNayStr, 'Điều chuyển / đổi nơi sử dụng', doi.join('; '));
      if (tinhTrang !== cu.tinh_trang) {
        ghiLichSu(cu.id, homNayStr, cu.tinh_trang === 'da_giam' ? 'Khôi phục' : 'Đổi tình trạng',
          `${TINH_TRANG_TEN[cu.tinh_trang]} → ${TINH_TRANG_TEN[tinhTrang]}`);
      }
    })();
    res.json(boSung(db.prepare('SELECT * FROM tai_san WHERE id = ?').get(cu.id)));
  } catch (err) {
    const loi = loiTrungMa(err, cu.loai);
    res.status(loi ? 409 : 500).json({ error: loi || 'Lưu tài sản thất bại: ' + err.message });
  }
});

// Ghi giảm / xóa tài sản: dùng POST /hang-loat (1 hoặc nhiều tài sản cùng lúc, có ghi lịch sử).

module.exports = router;
