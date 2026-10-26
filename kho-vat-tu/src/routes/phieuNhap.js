const express = require('express');
const { headerTaiFile } = require('../services/tenFile');
const { db, findOrCreateVatTu, timVatTuTheoTen, tonKhoCuaVatTu, layCauHinh } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');
const {
  chuanHoaSoPhieu, soSanhSoPhieuGiam, goiYSoPhieuKeTiep, giaTriDaDung, soPhieuTrongNam, timPhieuTrungSo, loiTrungSo,
} = require('../services/soPhieu');
const { ngayHopLe, soVN } = require('../services/tienIch');
const { chuanHoaNguonKinhPhi, laNguonKinhPhiHopLe, chuoiHoacNull } = require('../services/ghepNhapXuat');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT pn.*, (SELECT COUNT(*) FROM phieu_nhap_items WHERE phieu_nhap_id = pn.id) AS so_dong
       FROM phieu_nhap pn`
    )
    .all();
  res.json(rows.sort(soSanhSoPhieuGiam));
});

// Gợi ý cho form tạo phiếu nhập: số phiếu kế tiếp, đơn vị và người nhập đã dùng (mới dùng gần nhất lên đầu).
router.get('/goi-y', (req, res) => {
  const cacSo = soPhieuTrongNam(db, 'phieu_nhap', new Date().getFullYear()); // số phiếu đánh lại mỗi năm
  res.json({
    so_phieu: goiYSoPhieuKeTiep('nhap', cacSo),
    don_vi: giaTriDaDung(db, 'phieu_nhap', 'don_vi'),
    nguoi_nhap: giaTriDaDung(db, 'phieu_nhap', 'nguoi_nhap'),
  });
});

router.get('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const items = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(req.params.id);
  res.json({ ...phieu, items });
});

router.get('/:id/xuat-excel', async (req, res, next) => {
  const phieu = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const items = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(req.params.id);
  try {
    const wb = taoFilePhieu(phieu, items, 'nhap', layCauHinh());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', headerTaiFile(`PhieuNhapKho_${phieu.so_phieu || phieu.id}.xlsx`));
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ---------- Tạo / sửa phiếu nhập ----------
// body: { so_phieu, ngay, no_tk, co_tk, nguoi_nhap, don_vi, ly_do_nhap, nhap_tai_kho, dia_diem, so_chung_tu_goc,
//         nha_cung_cap, nguon_pdf, thue_suat,
//         tk_doi_ung, tieu_muc, nguon_kinh_phi ('661.2' | '337', mặc định '661.2'),   // trường cho Sổ tổng hợp
//         items: [{ id?, ten_hang, ma_so, dvt, sl_chung_tu, sl_thuc_nhap, don_gia, ghi_chu, tieu_muc }] }
// id của dòng hàng chỉ dùng khi sửa: dòng cũ giữ nguyên id để các dòng xuất đã ghép theo không mất liên kết.

// Kiểm tra dữ liệu gửi lên (dùng chung cho tạo mới và sửa). idDangSua: phiếu đang sửa. Trả chuỗi lỗi hoặc null.
function kiemTraPhieuNhap(b, idDangSua) {
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return 'Phiếu nhập cần ít nhất 1 dòng hàng hóa';
  if (items.some((it) => !it || typeof it !== 'object')) return 'Dòng hàng hóa không hợp lệ';
  if (items.some((it) => (Number(it.sl_thuc_nhap) || 0) < 0 || (Number(it.don_gia) || 0) < 0)) return 'Số lượng và đơn giá không được âm';
  if (items.some((it) => !String(it.ten_hang || '').trim())) return 'Có dòng hàng chưa có tên hàng';
  if (items.some((it) => !((Number(it.sl_thuc_nhap) || 0) > 0))) return 'Số lượng thực nhập của mỗi dòng phải lớn hơn 0';
  if (!b.ngay || !ngayHopLe(b.ngay)) return 'Ngày nhập không hợp lệ (cần đủ ngày/tháng/năm).';
  const trung = timPhieuTrungSo(db, 'phieu_nhap', chuanHoaSoPhieu('nhap', b.so_phieu), b.ngay, idDangSua);
  return trung ? loiTrungSo(trung) : null;
}

// 1 dòng hàng để ghi: tìm hoặc tạo vật tư theo tên (gọi trong transaction: lỗi thì không để lại vật tư thừa).
const COT_DONG_NHAP = ['stt', 'ten_hang', 'ma_so', 'dvt', 'sl_chung_tu', 'sl_thuc_nhap', 'don_gia', 'thanh_tien', 'ghi_chu', 'tieu_muc', 'vat_tu_id'];
function dongNhapDeGhi(it, idx) {
  const slThucNhap = Number(it.sl_thuc_nhap) || 0;
  const donGia = Number(it.don_gia) || 0;
  const vatTu = findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt, ma_so: it.ma_so });
  return {
    stt: idx + 1,
    ten_hang: String(it.ten_hang).trim(),
    ma_so: it.ma_so || null,
    dvt: it.dvt || null,
    sl_chung_tu: Number(it.sl_chung_tu) || slThucNhap,
    sl_thuc_nhap: slThucNhap,
    don_gia: donGia,
    thanh_tien: Math.round(slThucNhap * donGia),
    ghi_chu: it.ghi_chu || null,
    tieu_muc: chuoiHoacNull(it.tieu_muc),
    vat_tu_id: vatTu ? vatTu.id : null,
  };
}

// Thông tin chung của phiếu (các cột bảng phieu_nhap) từ body + tổng tiền hàng (đã làm tròn từng dòng).
function dauPhieuNhap(b, tongTienHang) {
  const thueSuat = Math.min(100, Math.max(0, Number(b.thue_suat) || 0));
  const tienThue = Math.round((tongTienHang * thueSuat) / 100);
  const tongCong = tongTienHang + tienThue;
  return {
    so_phieu: chuanHoaSoPhieu('nhap', b.so_phieu),
    ngay: b.ngay,
    no_tk: b.no_tk || null,
    co_tk: b.co_tk || null,
    nguoi_nhap: b.nguoi_nhap || null,
    don_vi: b.don_vi || null,
    ly_do_nhap: b.ly_do_nhap || null,
    nhap_tai_kho: b.nhap_tai_kho || null,
    dia_diem: b.dia_diem || null,
    so_chung_tu_goc: b.so_chung_tu_goc || null,
    nha_cung_cap: b.nha_cung_cap || null,
    tong_tien_hang: tongTienHang,
    thue_suat: thueSuat,
    tien_thue: tienThue,
    tong_cong: tongCong,
    tong_bang_chu: soTienBangChu(tongCong),
    tk_doi_ung: chuoiHoacNull(b.tk_doi_ung),
    tieu_muc: chuoiHoacNull(b.tieu_muc),
    nguon_kinh_phi: chuanHoaNguonKinhPhi(b.nguon_kinh_phi),
  };
}
const themDongNhap = () => db.prepare(`INSERT INTO phieu_nhap_items (phieu_nhap_id, ${COT_DONG_NHAP.join(', ')})
  VALUES (@phieu_nhap_id, ${COT_DONG_NHAP.map((k) => '@' + k).join(', ')})`);

// Vật tư không còn dòng nhập / xuất / tồn đầu kỳ nào (vd. chỉ có trong phiếu vừa xóa / vừa sửa tên) thì xóa cho danh mục gọn.
function xoaVatTuKhongDung(cacId) {
  const xoa = db.prepare(`DELETE FROM vat_tu WHERE id = ?
    AND NOT EXISTS (SELECT 1 FROM phieu_nhap_items WHERE vat_tu_id = vat_tu.id)
    AND NOT EXISTS (SELECT 1 FROM phieu_xuat_items WHERE vat_tu_id = vat_tu.id)
    AND NOT EXISTS (SELECT 1 FROM ton_dau_ky WHERE vat_tu_id = vat_tu.id)`);
  cacId.filter(Boolean).forEach((id) => xoa.run(id));
}

router.post('/', (req, res) => {
  const b = req.body || {};
  const loi = kiemTraPhieuNhap(b);
  if (loi) return res.status(400).json({ error: loi });
  const tx = db.transaction(() => {
    const dong = b.items.map(dongNhapDeGhi);
    const dau = { ...dauPhieuNhap(b, dong.reduce((s, r) => s + r.thanh_tien, 0)), nguon_pdf: b.nguon_pdf || null };
    const info = db.prepare(`INSERT INTO phieu_nhap (${Object.keys(dau).join(', ')})
      VALUES (${Object.keys(dau).map((k) => '@' + k).join(', ')})`).run(dau);
    const them = themDongNhap();
    dong.forEach((r) => them.run({ phieu_nhap_id: info.lastInsertRowid, ...r }));
    return info.lastInsertRowid;
  });
  try {
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: 'Lưu phiếu nhập thất bại: ' + err.message });
  }
});

// Sửa phiếu nhập đã lưu: thông tin chung + dòng hàng. Dòng gửi kèm id = dòng cũ (giữ id), không có id = dòng mới,
// dòng cũ không gửi lại = bỏ. Không cho sửa khi:
//  - dòng đã có phiếu xuất lấy theo (ghép) mà bị giảm dưới số đã xuất, hoặc đổi sang vật tư khác;
//  - sau khi sửa, vật tư nào đó bị âm kho (hàng của phiếu này đã xuất đi).
router.put('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const b = req.body || {};
  const loi = kiemTraPhieuNhap(b, phieu.id);
  if (loi) return res.status(400).json({ error: loi });

  const cu = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ?').all(phieu.id);
  const cuTheoId = new Map(cu.map((x) => [x.id, x]));
  const idGui = b.items.filter((it) => it.id !== undefined && it.id !== null && it.id !== '').map((it) => Number(it.id));
  const idLa = idGui.find((i) => !cuTheoId.has(i));
  if (idLa !== undefined) return res.status(400).json({ error: `Dòng hàng id=${idLa} không thuộc phiếu này — mở lại phiếu rồi sửa lại` });
  if (new Set(idGui).size < idGui.length) return res.status(400).json({ error: 'Một dòng hàng bị gửi 2 lần' });

  // Dòng đã có phiếu xuất lấy theo: không giảm dưới số đã xuất, không đổi sang vật tư khác.
  const daXuatTheoDong = db.prepare('SELECT COALESCE(SUM(sl_thuc_xuat), 0) AS sl FROM phieu_xuat_items WHERE phieu_nhap_item_id = ?');
  for (const it of b.items) {
    const c = it.id ? cuTheoId.get(Number(it.id)) : null;
    const daXuat = c ? daXuatTheoDong.get(c.id).sl : 0;
    if (daXuat <= 1e-6) continue;
    const vtMoi = timVatTuTheoTen(it.ten_hang);
    if (!vtMoi || vtMoi.id !== c.vat_tu_id) {
      return res.status(400).json({ error: `Dòng "${c.ten_hang}" đã có phiếu xuất lấy theo (đã xuất ${soVN(daXuat)}) — không đổi sang vật tư khác được.` });
    }
    if ((Number(it.sl_thuc_nhap) || 0) - daXuat < -1e-6) {
      return res.status(400).json({ error: `Dòng "${c.ten_hang}" đã xuất ${soVN(daXuat)} theo dòng này — số lượng thực nhập không được nhỏ hơn ${soVN(daXuat)}.` });
    }
  }

  // Tồn kho sau khi sửa (theo từng vật tư) = tồn hiện tại - số cũ của phiếu + số mới: không được âm.
  const cuTheoVt = new Map();
  cu.forEach((x) => { if (x.vat_tu_id) cuTheoVt.set(x.vat_tu_id, (cuTheoVt.get(x.vat_tu_id) || 0) + (x.sl_thuc_nhap || 0)); });
  const moiTheoVt = new Map();
  b.items.forEach((it) => { const vt = timVatTuTheoTen(it.ten_hang); if (vt) moiTheoVt.set(vt.id, (moiTheoVt.get(vt.id) || 0) + (Number(it.sl_thuc_nhap) || 0)); });
  const thieuHut = [];
  for (const [vtId, slCu] of cuTheoVt) {
    const ton = tonKhoCuaVatTu(vtId);
    const tonSau = ton - slCu + (moiTheoVt.get(vtId) || 0);
    if (tonSau < -1e-6) {
      const vt = db.prepare('SELECT ten_hang FROM vat_tu WHERE id = ?').get(vtId);
      thieuHut.push({ ten_hang: vt ? vt.ten_hang : `#${vtId}`, ton_kho: ton, ton_sau: tonSau });
    }
  }
  if (thieuHut.length) {
    const ds = thieuHut.slice(0, 3).map((t) => `${t.ten_hang} (tồn hiện tại ${soVN(t.ton_kho)}, sau khi sửa còn ${soVN(t.ton_sau)})`).join('; ');
    return res.status(409).json({
      error: `Không lưu được: hàng của phiếu này đã xuất đi, sửa như vậy làm tồn kho âm — ${ds}${thieuHut.length > 3 ? ` và ${thieuHut.length - 3} vật tư khác` : ''}. Sửa hoặc xóa các phiếu xuất liên quan trước.`,
      chi_tiet: thieuHut,
    });
  }

  const tx = db.transaction(() => {
    const dong = b.items.map(dongNhapDeGhi);
    const dau = dauPhieuNhap(b, dong.reduce((s, r) => s + r.thanh_tien, 0));
    db.prepare(`UPDATE phieu_nhap SET ${Object.keys(dau).map((k) => `${k} = @${k}`).join(', ')}, sua_luc = datetime('now', 'localtime')
      WHERE id = @id`).run({ ...dau, id: phieu.id });
    const sua = db.prepare(`UPDATE phieu_nhap_items SET ${COT_DONG_NHAP.map((k) => `${k} = @${k}`).join(', ')}
      WHERE id = @id AND phieu_nhap_id = @phieu_nhap_id`);
    const them = themDongNhap();
    b.items.forEach((it, i) => {
      const r = { phieu_nhap_id: phieu.id, ...dong[i] };
      if (it.id !== undefined && it.id !== null && it.id !== '') sua.run({ ...r, id: Number(it.id) });
      else them.run(r);
    });
    // Dòng cũ bị bỏ: gỡ liên kết ở các dòng xuất đã ghép theo (như khi xóa cả phiếu) rồi xóa dòng.
    const giu = new Set(idGui);
    cu.filter((x) => !giu.has(x.id)).forEach((x) => {
      db.prepare('UPDATE phieu_xuat_items SET phieu_nhap_item_id = NULL WHERE phieu_nhap_item_id = ?').run(x.id);
      db.prepare('DELETE FROM phieu_nhap_items WHERE id = ?').run(x.id);
    });
    xoaVatTuKhongDung([...cuTheoVt.keys()]);
  });
  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: 'Lưu thay đổi phiếu nhập thất bại: ' + err.message });
  }
  const moi = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(phieu.id);
  res.json({ ...moi, items: db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(phieu.id) });
});

// Sửa riêng các trường sổ sách của phiếu đã lưu (không đụng số liệu hàng hóa/tiền).
// body: { tk_doi_ung?, tieu_muc?, nguon_kinh_phi?, items?: [{ id, tieu_muc }] }
// Trường nào không gửi thì giữ nguyên; gửi null/"" với tk_doi_ung/tieu_muc thì xoá về null.
router.put('/:id/so-sach', (req, res) => {
  const b = req.body || {};
  const phieu = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });

  if (b.nguon_kinh_phi !== undefined && b.nguon_kinh_phi !== null && String(b.nguon_kinh_phi).trim() !== '' && !laNguonKinhPhiHopLe(b.nguon_kinh_phi)) {
    return res.status(400).json({ error: "nguon_kinh_phi chỉ nhận '661.2' hoặc '337'" });
  }
  const itemsGui = b.items === undefined ? [] : b.items;
  if (!Array.isArray(itemsGui)) return res.status(400).json({ error: 'items phải là mảng' });
  const idHopLe = new Set(
    db.prepare('SELECT id FROM phieu_nhap_items WHERE phieu_nhap_id = ?').all(phieu.id).map((r) => r.id)
  );
  for (const it of itemsGui) {
    if (!it || !idHopLe.has(Number(it.id))) {
      return res.status(400).json({ error: `Dòng hàng id=${it && it.id} không thuộc phiếu nhập ${phieu.id}` });
    }
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE phieu_nhap SET tk_doi_ung = ?, tieu_muc = ?, nguon_kinh_phi = ? WHERE id = ?').run(
      b.tk_doi_ung !== undefined ? chuoiHoacNull(b.tk_doi_ung) : phieu.tk_doi_ung,
      b.tieu_muc !== undefined ? chuoiHoacNull(b.tieu_muc) : phieu.tieu_muc,
      b.nguon_kinh_phi !== undefined ? chuanHoaNguonKinhPhi(b.nguon_kinh_phi) : phieu.nguon_kinh_phi,
      phieu.id
    );
    const updItem = db.prepare('UPDATE phieu_nhap_items SET tieu_muc = ? WHERE id = ? AND phieu_nhap_id = ?');
    for (const it of itemsGui) {
      if ('tieu_muc' in it) updItem.run(chuoiHoacNull(it.tieu_muc), Number(it.id), phieu.id);
    }
  });
  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: 'Cập nhật sổ sách thất bại: ' + err.message });
  }
  const moi = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(phieu.id);
  const items = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(phieu.id);
  res.json({ ...moi, items });
});

// Không cho xóa phiếu nhập nếu hàng của phiếu đó đã xuất đi một phần/toàn bộ — xóa sẽ làm tồn kho âm.
router.delete('/:id', (req, res) => {
  const items = db.prepare('SELECT vat_tu_id, SUM(sl_thuc_nhap) AS sl FROM phieu_nhap_items WHERE phieu_nhap_id = ? AND vat_tu_id IS NOT NULL GROUP BY vat_tu_id').all(req.params.id);
  const thieuHut = [];
  for (const it of items) {
    const ton = tonKhoCuaVatTu(it.vat_tu_id);
    if (ton - it.sl < -1e-6) { // có sai số cho số lẻ (kg, m...)
      const vatTu = db.prepare('SELECT ten_hang FROM vat_tu WHERE id = ?').get(it.vat_tu_id);
      thieuHut.push({ ten_hang: vatTu ? vatTu.ten_hang : `#${it.vat_tu_id}`, ton_kho: ton, sl_phieu_nhap: it.sl });
    }
  }
  if (thieuHut.length > 0) {
    const ds = thieuHut.slice(0, 3).map((t) => `${t.ten_hang} (tồn ${t.ton_kho}, phiếu nhập ${t.sl_phieu_nhap})`).join('; ');
    return res.status(409).json({
      error: `Không xóa được: hàng của phiếu nhập này đã xuất đi, xóa sẽ làm tồn kho âm — ${ds}${thieuHut.length > 3 ? ` và ${thieuHut.length - 3} vật tư khác` : ''}. Hãy xóa các phiếu xuất liên quan trước.`,
      chi_tiet: thieuHut,
    });
  }
  // phieu_nhap_item_id không có khoá ngoại: gỡ liên kết ở các dòng xuất trước khi xoá để không bị "treo".
  db.transaction(() => {
    db.prepare(
      `UPDATE phieu_xuat_items SET phieu_nhap_item_id = NULL
       WHERE phieu_nhap_item_id IN (SELECT id FROM phieu_nhap_items WHERE phieu_nhap_id = ?)`
    ).run(req.params.id);
    db.prepare('DELETE FROM phieu_nhap WHERE id = ?').run(req.params.id);
    xoaVatTuKhongDung(items.map((it) => it.vat_tu_id));
  })();
  res.json({ ok: true });
});

module.exports = router;
