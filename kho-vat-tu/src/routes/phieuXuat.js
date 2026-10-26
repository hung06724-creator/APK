const express = require('express');
const { headerTaiFile } = require('../services/tenFile');
const { db, timVatTuTheoTen, khoaTenVatTu, tonKhoCuaVatTu, layCauHinh } = require('../db');
const { ngayHopLe, soVN } = require('../services/tienIch');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');
const {
  ghepXuatVoiNhap,
  chuanHoaNguonKinhPhi,
  laNguonKinhPhiHopLe,
  chuoiHoacNull,
} = require('../services/ghepNhapXuat');

const {
  chuanHoaSoPhieu, soSanhSoPhieuGiam, goiYSoPhieuKeTiep, giaTriDaDung, soPhieuTrongNam, timPhieuTrungSo, loiTrungSo,
} = require('../services/soPhieu');
const lam3 = (x) => Math.round(x * 1000) / 1000; // số lượng lẻ gọn (0,1 + 0,2 = 0,3 chứ không phải 0,30000000000000004)

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT px.*, (SELECT COUNT(*) FROM phieu_xuat_items WHERE phieu_xuat_id = px.id) AS so_dong
       FROM phieu_xuat px`
    )
    .all();
  res.json(rows.sort(soSanhSoPhieuGiam));
});

// Gợi ý cho form tạo / tách phiếu xuất: số phiếu kế tiếp, người nhận và đơn vị đã dùng (mới dùng gần nhất lên đầu).
// Đơn vị lấy thêm từ phiếu nhập vì thường là cùng các khoa, phòng.
router.get('/goi-y', (req, res) => {
  const cacSo = soPhieuTrongNam(db, 'phieu_xuat', new Date().getFullYear());
  const donVi = [...new Set([...giaTriDaDung(db, 'phieu_xuat', 'don_vi'), ...giaTriDaDung(db, 'phieu_nhap', 'don_vi')])];
  res.json({
    so_phieu: goiYSoPhieuKeTiep('xuat', cacSo),
    nguoi_nhan: giaTriDaDung(db, 'phieu_xuat', 'nguoi_nhan'),
    don_vi: donVi,
  });
});

router.get('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  res.json({ ...phieu, items });
});

router.get('/:id/xuat-excel', async (req, res, next) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  try {
    const wb = taoFilePhieu(phieu, items, 'xuat', layCauHinh());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', headerTaiFile(`PhieuXuatKho_${phieu.so_phieu || phieu.id}.xlsx`));
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// Kiểm tra đủ tồn kho cho một danh sách { vat_tu_id, sl_thuc_xuat } đã GỘP theo vật tư
// (dùng chung cho lưu 1 phiếu và tách nhiều phiếu cùng lúc, để không bị trừ tồn 2 lần).
// congLai (Map vat_tu_id -> số lượng): khi sửa phiếu, số cũ của chính phiếu đó được cộng lại vào tồn.
function kiemTraTonKho(danhSachCanXuat, congLai) {
  const gop = {};
  for (const it of danhSachCanXuat) {
    if (!it.vat_tu_id) continue;
    gop[it.vat_tu_id] = (gop[it.vat_tu_id] || 0) + (Number(it.sl_thuc_xuat) || 0);
  }
  const thieuHut = [];
  for (const [vatTuId, slCan] of Object.entries(gop)) {
    const ton = tonKhoCuaVatTu(Number(vatTuId)) + ((congLai && congLai.get(Number(vatTuId))) || 0);
    if (slCan - ton > 1e-6) { // có sai số: số lẻ (kg, m...) cộng trừ nhiều lần lệch ở chữ số thập phân thứ 15
      const vatTu = db.prepare('SELECT ten_hang FROM vat_tu WHERE id = ?').get(vatTuId);
      thieuHut.push({ ten_hang: vatTu ? vatTu.ten_hang : `#${vatTuId}`, ton_kho: ton, muon_xuat: slCan });
    }
  }
  return thieuHut;
}

// Chuẩn hóa 1 dòng hàng hóa (từ body người dùng gửi lên, có thể chưa có vat_tu_id).
function chuanHoaDongHang(it) {
  const slThucXuat = Number(it.sl_thuc_xuat) || 0;
  const donGia = Number(it.don_gia) || 0;
  // Chỉ xuất vật tư đã có trong kho: tìm theo id hoặc theo tên, KHÔNG tạo vật tư mới (tạo ở đây sẽ để lại
  // vật tư rác khi phiếu bị từ chối vì không đủ tồn).
  const vatTu = it.vat_tu_id ? db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(it.vat_tu_id) : timVatTuTheoTen(it.ten_hang);
  let loi = null;
  if (!vatTu) loi = `Vật tư "${it.ten_hang || ''}" chưa có trong kho (chưa từng nhập) — kiểm tra lại tên hàng.`;
  else if (it.vat_tu_id && it.ten_hang && khoaTenVatTu(it.ten_hang) !== khoaTenVatTu(vatTu.ten_hang)) {
    loi = `Dòng "${it.ten_hang}" không khớp vật tư đã chọn ("${vatTu.ten_hang}") — chọn lại tên hàng trong danh sách gợi ý.`;
  }
  return {
    ...(loi ? { loi } : {}),
    ten_hang: it.ten_hang || (vatTu && vatTu.ten_hang),
    ma_so: it.ma_so || null,
    dvt: it.dvt || (vatTu && vatTu.dvt) || null,
    sl_yeu_cau: Number(it.sl_yeu_cau) || slThucXuat,
    sl_thuc_xuat: slThucXuat,
    don_gia: donGia,
    thanh_tien: Math.round(slThucXuat * donGia),
    ghi_chu: it.ghi_chu || null,
    tieu_muc: chuoiHoacNull(it.tieu_muc),
    phieu_nhap_item_id: it.phieu_nhap_item_id ? Number(it.phieu_nhap_item_id) : null,
    vat_tu_id: vatTu ? vatTu.id : null,
  };
}

// Kiểm tra phieu_nhap_item_id (nếu có) tồn tại và cùng vật tư với dòng xuất. Trả về chuỗi lỗi hoặc null.
function kiemTraLienKetNhap(items, boQuaPhieuXuatId) {
  const q = db.prepare('SELECT id, vat_tu_id, ten_hang, sl_thuc_nhap FROM phieu_nhap_items WHERE id = ?');
  const gop = new Map(); // phieu_nhap_item_id -> { n, sl }: tổng số lượng xuất theo dòng nhập đó trong lần lưu này
  for (const it of items) {
    if (it.phieu_nhap_item_id === null || it.phieu_nhap_item_id === undefined) continue;
    const n = Number.isInteger(it.phieu_nhap_item_id) ? q.get(it.phieu_nhap_item_id) : null;
    if (!n) return `phieu_nhap_item_id=${it.phieu_nhap_item_id} không tồn tại (dòng "${it.ten_hang}")`;
    if (it.vat_tu_id && n.vat_tu_id && it.vat_tu_id !== n.vat_tu_id) {
      return `Dòng xuất "${it.ten_hang}" không cùng vật tư với dòng nhập phieu_nhap_item_id=${n.id}`;
    }
    gop.set(n.id, { n, sl: ((gop.get(n.id) || {}).sl || 0) + (Number(it.sl_thuc_xuat) || 0) });
  }
  // Xuất theo 1 dòng nhập không được vượt số đã nhập trừ số đã xuất theo dòng đó trước đây (tránh xuất trùng).
  for (const { n, sl } of gop.values()) {
    const con = lam3(n.sl_thuc_nhap - daXuatTheoDongNhap(n.id, boQuaPhieuXuatId));
    if (sl - con > 1e-6) {
      return `"${n.ten_hang}": dòng nhập có ${soVN(n.sl_thuc_nhap)}, đã xuất theo dòng này${boQuaPhieuXuatId ? ' ở các phiếu khác' : ''} ${soVN(n.sl_thuc_nhap - con)}, chỉ còn ${soVN(con)} — đang xuất ${soVN(sl)}.`;
    }
  }
  return null;
}
// Số đã xuất theo 1 dòng nhập (bỏ qua các dòng của phiếu xuất đang sửa, nếu có).
const daXuatTheoDongNhap = (idDongNhap, boQuaPhieuXuatId) =>
  db.prepare('SELECT COALESCE(SUM(sl_thuc_xuat), 0) AS sl FROM phieu_xuat_items WHERE phieu_nhap_item_id = ? AND phieu_xuat_id <> ?')
    .get(idDongNhap, Number(boQuaPhieuXuatId) || -1).sl;

// Ngày hợp lệ + số phiếu chưa dùng trong năm đó. Trả chuỗi lỗi hoặc null.
function kiemTraDauPhieu(soPhieu, ngay, boQuaId) {
  if (!ngay || !ngayHopLe(ngay)) return 'Ngày xuất không hợp lệ (cần đủ ngày/tháng/năm).';
  const trung = timPhieuTrungSo(db, 'phieu_xuat', chuanHoaSoPhieu('xuat', soPhieu), ngay, boQuaId);
  return trung ? loiTrungSo(trung) : null;
}

// Thông tin chung + tổng tiền của 1 phiếu xuất (các cột bảng phieu_xuat), từ body và các dòng đã chuẩn hóa.
function dauPhieuXuat(p, dong) {
  const tongTienHang = dong.reduce((s, r) => s + r.thanh_tien, 0);
  const thueSuat = Math.min(100, Math.max(0, Number(p.thue_suat) || 0));
  const tienThue = Math.round((tongTienHang * thueSuat) / 100);
  const tongCong = tongTienHang + tienThue;
  return {
    so_phieu: chuanHoaSoPhieu('xuat', p.so_phieu),
    ngay: p.ngay || null,
    no_tk: p.no_tk || null,
    co_tk: p.co_tk || null,
    nguoi_nhan: p.nguoi_nhan || null,
    don_vi: p.don_vi || null,
    ly_do_xuat: p.ly_do_xuat || null,
    xuat_tai_kho: p.xuat_tai_kho || null,
    dia_diem: p.dia_diem || null,
    so_chung_tu_goc: p.so_chung_tu_goc || null,
    tong_tien_hang: tongTienHang,
    thue_suat: thueSuat,
    tien_thue: tienThue,
    tong_cong: tongCong,
    tong_bang_chu: soTienBangChu(tongCong),
    tk_doi_ung: chuoiHoacNull(p.tk_doi_ung),
    tieu_muc: chuoiHoacNull(p.tieu_muc),
    nguon_kinh_phi: chuanHoaNguonKinhPhi(p.nguon_kinh_phi),
  };
}

// Ghi các dòng hàng (đã chuẩn hóa) của 1 phiếu xuất, số thứ tự theo thứ tự gửi lên.
const COT_DONG_XUAT = ['stt', 'vat_tu_id', 'ten_hang', 'ma_so', 'dvt', 'sl_yeu_cau', 'sl_thuc_xuat', 'don_gia', 'thanh_tien', 'ghi_chu', 'tieu_muc', 'phieu_nhap_item_id'];
function ghiDongXuat(phieuId, dong) {
  const them = db.prepare(`INSERT INTO phieu_xuat_items (phieu_xuat_id, ${COT_DONG_XUAT.join(', ')})
    VALUES (@phieu_xuat_id, ${COT_DONG_XUAT.map((k) => '@' + k).join(', ')})`);
  dong.forEach((it, idx) => {
    const r = { phieu_xuat_id: phieuId };
    COT_DONG_XUAT.forEach((k) => { r[k] = it[k] === undefined ? null : it[k]; });
    r.stt = idx + 1;
    r.tieu_muc = chuoiHoacNull(it.tieu_muc);
    r.phieu_nhap_item_id = it.phieu_nhap_item_id || null;
    them.run(r);
  });
}

// Lưu 1 phiếu xuất mới (dòng hàng đã chuẩn hóa) — PHẢI gọi bên trong 1 db.transaction().
function luuMotPhieuXuat(p) {
  const dau = dauPhieuXuat(p, p.items);
  const info = db.prepare(`INSERT INTO phieu_xuat (${Object.keys(dau).join(', ')})
    VALUES (${Object.keys(dau).map((k) => '@' + k).join(', ')})`).run(dau);
  ghiDongXuat(info.lastInsertRowid, p.items);
  return info.lastInsertRowid;
}

// Kiểm tra 1 phiếu xuất gửi lên (tạo mới hoặc sửa). idDangSua: phiếu đang sửa — không tính trùng số với chính nó,
// số cũ của chính nó được cộng lại vào tồn (sửa 10 thành 12 chỉ cần còn thêm 2), và dòng xuất cũ của nó không tính
// vào phần đã xuất của dòng nhập. Trả { loi, chi_tiet? } hoặc { items } (dòng đã chuẩn hóa).
function kiemTraPhieuXuat(b, idDangSua) {
  const itemsTho = Array.isArray(b.items) ? b.items : [];
  if (itemsTho.length === 0) return { loi: 'Phiếu xuất cần ít nhất 1 dòng hàng hóa' };
  if (itemsTho.some((it) => !it || typeof it !== 'object')) return { loi: 'Dòng hàng hóa không hợp lệ' };
  // Số lượng âm sẽ làm TĂNG tồn kho thay vì trừ — chặn từ đầu.
  if (itemsTho.some((it) => (Number(it.sl_thuc_xuat) || 0) < 0 || (Number(it.don_gia) || 0) < 0)) return { loi: 'Số lượng và đơn giá không được âm' };
  if (itemsTho.some((it) => !((Number(it.sl_thuc_xuat) || 0) > 0))) return { loi: 'Số lượng thực xuất của mỗi dòng phải lớn hơn 0' };
  const loiDau = kiemTraDauPhieu(b.so_phieu, b.ngay, idDangSua);
  if (loiDau) return { loi: loiDau };
  const items = itemsTho.map(chuanHoaDongHang);
  const dongLoi = items.find((x) => x.loi);
  if (dongLoi) return { loi: dongLoi.loi };
  const loiLienKet = kiemTraLienKetNhap(items, idDangSua);
  if (loiLienKet) return { loi: loiLienKet };
  const congLai = new Map();
  if (idDangSua) {
    db.prepare('SELECT vat_tu_id, sl_thuc_xuat FROM phieu_xuat_items WHERE phieu_xuat_id = ?').all(idDangSua)
      .forEach((x) => { if (x.vat_tu_id) congLai.set(x.vat_tu_id, (congLai.get(x.vat_tu_id) || 0) + (x.sl_thuc_xuat || 0)); });
  }
  const thieuHut = kiemTraTonKho(items, congLai);
  if (thieuHut.length > 0) return { loi: 'Không đủ tồn kho cho một số vật tư', chi_tiet: thieuHut };
  return { items };
}

// body: { so_phieu, ngay, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem, so_chung_tu_goc, no_tk, co_tk, thue_suat,
//         tk_doi_ung, tieu_muc, nguon_kinh_phi ('661.2' | '337', mặc định '661.2'),   // trường cho Sổ tổng hợp
//         items: [{ vat_tu_id? , ten_hang, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, ghi_chu,
//                   tieu_muc?, phieu_nhap_item_id? (dòng nhập mà dòng xuất này lấy từ) }] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const kt = kiemTraPhieuXuat(b);
  if (kt.loi) return res.status(400).json({ error: kt.loi, chi_tiet: kt.chi_tiet });
  const tx = db.transaction(() => luuMotPhieuXuat({ ...b, items: kt.items }));
  try {
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: 'Lưu phiếu xuất thất bại: ' + err.message });
  }
});

// Sửa phiếu xuất đã lưu: thông tin chung + toàn bộ dòng hàng (body như khi tạo). Kiểm tra như khi tạo mới, có tính lại
// số cũ của chính phiếu này (xem kiemTraPhieuXuat). Dòng hàng được ghi lại toàn bộ.
router.put('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const b = req.body || {};
  const kt = kiemTraPhieuXuat(b, phieu.id);
  if (kt.loi) return res.status(400).json({ error: kt.loi, chi_tiet: kt.chi_tiet });
  const tx = db.transaction(() => {
    const dau = dauPhieuXuat(b, kt.items);
    db.prepare(`UPDATE phieu_xuat SET ${Object.keys(dau).map((k) => `${k} = @${k}`).join(', ')}, sua_luc = datetime('now', 'localtime')
      WHERE id = @id`).run({ ...dau, id: phieu.id });
    db.prepare('DELETE FROM phieu_xuat_items WHERE phieu_xuat_id = ?').run(phieu.id);
    ghiDongXuat(phieu.id, kt.items);
  });
  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: 'Lưu thay đổi phiếu xuất thất bại: ' + err.message });
  }
  const moi = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(phieu.id);
  res.json({ ...moi, items: db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(phieu.id) });
});

// Tách 1 phiếu nhập kho thành NHIỀU phiếu xuất tùy ý — bảng phân bổ linh hoạt: bao
// nhiêu nhóm (phiếu xuất) cũng được, mỗi dòng hàng tự gõ số lượng chia cho từng nhóm
// (gộp nhiều mặt hàng vào 1 phiếu, chia đều 2/3/4/5 nhóm, hay bất kỳ cách chia nào).
// body: {
//   phieu_nhap_id,
//   nhom: [ { nguoi_nhan, don_vi, so_phieu }, ... ],   // mỗi phần tử = 1 phiếu xuất sẽ tạo
//   phan_bo: { [phieu_nhap_item_id]: [slNhom0, slNhom1, ...] },  // số lượng chia cho từng nhóm, theo đúng thứ tự "nhom" ở trên
//   ngay, no_tk, co_tk, ly_do_xuat, xuat_tai_kho, dia_diem, thue_suat   // áp dụng chung cho mọi phiếu tạo ra
// }
router.post('/phan-bo', (req, res) => {
  const b = req.body || {};
  const phieuNhap = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(b.phieu_nhap_id);
  if (!phieuNhap) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const itemsNhap = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(phieuNhap.id);
  if (itemsNhap.length === 0) return res.status(400).json({ error: 'Phiếu nhập này không có dòng hàng hóa nào' });

  const nhom = Array.isArray(b.nhom) ? b.nhom : [];
  if (nhom.length === 0) return res.status(400).json({ error: 'Cần ít nhất 1 nhóm (phiếu xuất) để phân bổ' });
  const phanBo = b.phan_bo || {};
  if (!b.ngay || !ngayHopLe(b.ngay)) return res.status(400).json({ error: 'Ngày xuất không hợp lệ (cần đủ ngày/tháng/năm).' });
  const cacSo = nhom.map((n) => chuanHoaSoPhieu('xuat', n && n.so_phieu)).filter(Boolean);
  if (new Set(cacSo).size < cacSo.length) return res.status(400).json({ error: 'Các nhóm đang trùng số phiếu — mỗi nhóm cần 1 số phiếu khác nhau.' });
  for (const n of nhom) {
    const loiDau = kiemTraDauPhieu(n && n.so_phieu, b.ngay);
    if (loiDau) return res.status(400).json({ error: loiDau });
  }

  const chung = {
    ngay: b.ngay,
    no_tk: b.no_tk || null,
    co_tk: b.co_tk || null,
    ly_do_xuat: b.ly_do_xuat || null,
    xuat_tai_kho: b.xuat_tai_kho || null,
    dia_diem: b.dia_diem || null,
    thue_suat: Math.min(100, Math.max(0, Number(b.thue_suat) || 0)),
    // Thừa hưởng trường sổ sách từ phiếu nhập gốc, trừ khi body ghi đè.
    tk_doi_ung: chuoiHoacNull(b.tk_doi_ung) || phieuNhap.tk_doi_ung || null,
    tieu_muc: chuoiHoacNull(b.tieu_muc) || phieuNhap.tieu_muc || null,
    nguon_kinh_phi: chuanHoaNguonKinhPhi(chuoiHoacNull(b.nguon_kinh_phi) || phieuNhap.nguon_kinh_phi),
  };

  const canhBao = [];
  // Mỗi phần tử: danh sách dòng hàng của 1 phiếu xuất sẽ tạo (theo đúng thứ tự "nhom").
  const dongHangTheoNhom = nhom.map(() => []);

  for (const it of itemsNhap) {
    const phanBoDong = phanBo[it.id];
    if (phanBoDong !== undefined && !Array.isArray(phanBoDong)) {
      return res.status(400).json({ error: 'phan_bo phải là mảng số lượng theo từng nhóm' });
    }
    const soLuongTheoNhom = (phanBoDong || []).map((v) => Number(v) || 0);
    if (soLuongTheoNhom.some((v) => v < 0)) return res.status(400).json({ error: 'Số lượng và đơn giá không được âm' });
    const tongDaChia = soLuongTheoNhom.reduce((s, v) => s + v, 0);
    // Đã xuất theo dòng nhập này từ trước (vd. đã tách 1 lần): chỉ được chia phần còn lại — tránh xuất trùng khi tách lại.
    const daXuat = daXuatTheoDongNhap(it.id);
    const conLai = lam3(it.sl_thuc_nhap - daXuat);
    if (tongDaChia - conLai > 1e-6) {
      return res.status(400).json({ error: `"${it.ten_hang}": chia ${soVN(tongDaChia)} nhưng chỉ còn ${soVN(conLai)}${daXuat ? ` (phiếu nhập có ${soVN(it.sl_thuc_nhap)}, đã xuất ${soVN(daXuat)} theo phiếu này)` : ''} — sửa lại bảng phân bổ.` });
    }
    if (tongDaChia > 0 && conLai - tongDaChia > 1e-6) {
      canhBao.push(`"${it.ten_hang}": chỉ phân bổ ${soVN(tongDaChia)}/${soVN(conLai)}, còn ${soVN(conLai - tongDaChia)} chưa đưa vào phiếu xuất nào.`);
    }
    nhom.forEach((_, i) => {
      const sl = soLuongTheoNhom[i] || 0;
      if (sl > 0) {
        dongHangTheoNhom[i].push({
          vat_tu_id: it.vat_tu_id,
          ten_hang: it.ten_hang,
          ma_so: it.ma_so,
          dvt: it.dvt,
          sl_yeu_cau: sl,
          sl_thuc_xuat: sl,
          don_gia: it.don_gia,
          thanh_tien: Math.round(sl * it.don_gia),
          ghi_chu: it.ghi_chu,
          tieu_muc: it.tieu_muc || null,
          phieu_nhap_item_id: it.id,
        });
      }
    });
  }

  const danhSachPhieu = nhom
    .map((n, i) => ({ ...chung, ...n, items: dongHangTheoNhom[i] }))
    .filter((p) => p.items.length > 0);

  if (danhSachPhieu.length === 0) {
    return res.status(400).json({ error: 'Chưa phân bổ số lượng nào cho nhóm nào cả — hãy nhập số lượng vào bảng phân bổ.' });
  }

  const tatCaDongHang = danhSachPhieu.flatMap((p) => p.items);
  const thieuHut = kiemTraTonKho(tatCaDongHang);
  if (thieuHut.length > 0) {
    return res.status(400).json({ error: 'Không đủ tồn kho cho một số vật tư', chi_tiet: thieuHut });
  }

  const tx = db.transaction(() => danhSachPhieu.map((p) => luuMotPhieuXuat(p)));
  try {
    const ids = tx();
    res.status(201).json({ so_phieu_da_tao: ids.length, ids, canh_bao: canhBao });
  } catch (err) {
    res.status(500).json({ error: 'Tách phiếu thất bại: ' + err.message });
  }
});

// Ghép tự động các dòng xuất CHƯA có phieu_nhap_item_id với dòng nhập tương ứng trên toàn DB
// (heuristic ở src/services/ghepNhapXuat.js). Không đụng các dòng đã có liên kết.
// body (tuỳ chọn): { cho_phep_lech_don_gia: true }  — mặc định đơn giá phải bằng nhau.
router.post('/ghep-tu-dong', (req, res) => {
  const b = req.body || {};
  try {
    const kq = ghepXuatVoiNhap({ db, choPhepLechDonGia: b.cho_phep_lech_don_gia === true });
    res.json(kq);
  } catch (err) {
    res.status(500).json({ error: 'Ghép tự động thất bại: ' + err.message });
  }
});

// Sửa riêng các trường sổ sách của phiếu xuất đã lưu (không đụng số liệu hàng hóa/tiền/tồn kho).
// body: { tk_doi_ung?, tieu_muc?, nguon_kinh_phi?, items?: [{ id, tieu_muc?, phieu_nhap_item_id? }] }
// Trường nào không gửi thì giữ nguyên; null/"" với tk_doi_ung/tieu_muc/phieu_nhap_item_id = xoá về null.
router.put('/:id/so-sach', (req, res) => {
  const b = req.body || {};
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });

  if (b.nguon_kinh_phi !== undefined && b.nguon_kinh_phi !== null && String(b.nguon_kinh_phi).trim() !== '' && !laNguonKinhPhiHopLe(b.nguon_kinh_phi)) {
    return res.status(400).json({ error: "nguon_kinh_phi chỉ nhận '661.2' hoặc '337'" });
  }
  const itemsGui = b.items === undefined ? [] : b.items;
  if (!Array.isArray(itemsGui)) return res.status(400).json({ error: 'items phải là mảng' });
  const dongHienCo = new Map(
    db.prepare('SELECT id, vat_tu_id, ten_hang FROM phieu_xuat_items WHERE phieu_xuat_id = ?').all(phieu.id).map((r) => [r.id, r])
  );
  const layNhap = db.prepare('SELECT id, vat_tu_id FROM phieu_nhap_items WHERE id = ?');
  for (const it of itemsGui) {
    const dong = it && dongHienCo.get(Number(it.id));
    if (!dong) return res.status(400).json({ error: `Dòng hàng id=${it && it.id} không thuộc phiếu xuất ${phieu.id}` });
    if ('phieu_nhap_item_id' in it && it.phieu_nhap_item_id !== null && it.phieu_nhap_item_id !== '') {
      const idNhap = Number(it.phieu_nhap_item_id);
      const n = Number.isInteger(idNhap) ? layNhap.get(idNhap) : null;
      if (!n) return res.status(400).json({ error: `phieu_nhap_item_id=${it.phieu_nhap_item_id} không tồn tại` });
      if (dong.vat_tu_id && n.vat_tu_id && dong.vat_tu_id !== n.vat_tu_id) {
        return res.status(400).json({ error: `Dòng xuất "${dong.ten_hang}" không cùng vật tư với dòng nhập ${n.id}` });
      }
    }
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE phieu_xuat SET tk_doi_ung = ?, tieu_muc = ?, nguon_kinh_phi = ? WHERE id = ?').run(
      b.tk_doi_ung !== undefined ? chuoiHoacNull(b.tk_doi_ung) : phieu.tk_doi_ung,
      b.tieu_muc !== undefined ? chuoiHoacNull(b.tieu_muc) : phieu.tieu_muc,
      b.nguon_kinh_phi !== undefined ? chuanHoaNguonKinhPhi(b.nguon_kinh_phi) : phieu.nguon_kinh_phi,
      phieu.id
    );
    const updTieuMuc = db.prepare('UPDATE phieu_xuat_items SET tieu_muc = ? WHERE id = ? AND phieu_xuat_id = ?');
    const updNhap = db.prepare('UPDATE phieu_xuat_items SET phieu_nhap_item_id = ? WHERE id = ? AND phieu_xuat_id = ?');
    for (const it of itemsGui) {
      if ('tieu_muc' in it) updTieuMuc.run(chuoiHoacNull(it.tieu_muc), Number(it.id), phieu.id);
      if ('phieu_nhap_item_id' in it) {
        const v = it.phieu_nhap_item_id === null || it.phieu_nhap_item_id === '' ? null : Number(it.phieu_nhap_item_id);
        updNhap.run(v, Number(it.id), phieu.id);
      }
    }
  });
  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: 'Cập nhật sổ sách thất bại: ' + err.message });
  }
  const moi = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(phieu.id);
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(phieu.id);
  res.json({ ...moi, items });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM phieu_xuat WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
