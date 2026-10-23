const express = require('express');
const { db, findOrCreateVatTu, tonKhoCuaVatTu } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT px.*, (SELECT COUNT(*) FROM phieu_xuat_items WHERE phieu_xuat_id = px.id) AS so_dong
       FROM phieu_xuat px ORDER BY px.ngay DESC, px.id DESC`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  res.json({ ...phieu, items });
});

router.get('/:id/xuat-excel', async (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  const wb = taoFilePhieu(phieu, items, 'xuat');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PhieuXuatKho_${phieu.so_phieu || phieu.id}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// Kiểm tra đủ tồn kho cho một danh sách { vat_tu_id, sl_thuc_xuat } đã GỘP theo vật tư
// (dùng chung cho lưu 1 phiếu và tách nhiều phiếu cùng lúc, để không bị trừ tồn 2 lần).
function kiemTraTonKho(danhSachCanXuat) {
  const gop = {};
  for (const it of danhSachCanXuat) {
    if (!it.vat_tu_id) continue;
    gop[it.vat_tu_id] = (gop[it.vat_tu_id] || 0) + (Number(it.sl_thuc_xuat) || 0);
  }
  const thieuHut = [];
  for (const [vatTuId, slCan] of Object.entries(gop)) {
    const ton = tonKhoCuaVatTu(Number(vatTuId));
    if (slCan > ton) {
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
  const vatTu = it.vat_tu_id
    ? db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(it.vat_tu_id)
    : findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt });
  return {
    ten_hang: it.ten_hang || (vatTu && vatTu.ten_hang),
    ma_so: it.ma_so || null,
    dvt: it.dvt || (vatTu && vatTu.dvt) || null,
    sl_yeu_cau: Number(it.sl_yeu_cau) || slThucXuat,
    sl_thuc_xuat: slThucXuat,
    don_gia: donGia,
    thanh_tien: Math.round(slThucXuat * donGia),
    ghi_chu: it.ghi_chu || null,
    vat_tu_id: vatTu ? vatTu.id : null,
  };
}

// Lưu 1 phiếu xuất (đã chuẩn hóa dòng hàng) — PHẢI gọi bên trong 1 db.transaction().
function luuMotPhieuXuat(p) {
  const rows = p.items.map((it, idx) => ({ stt: idx + 1, ...it }));
  const tongTienHang = rows.reduce((s, r) => s + r.thanh_tien, 0);
  const thueSuat = Number(p.thue_suat) || 0;
  const tienThue = Math.round((tongTienHang * thueSuat) / 100);
  const tongCong = tongTienHang + tienThue;

  const info = db
    .prepare(
      `INSERT INTO phieu_xuat
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem, so_chung_tu_goc,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi_nhan,@don_vi,@ly_do_xuat,@xuat_tai_kho,@dia_diem,@so_chung_tu_goc,
               @tong_tien_hang,@thue_suat,@tien_thue,@tong_cong,@tong_bang_chu)`
    )
    .run({
      so_phieu: p.so_phieu || null,
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
      tong_bang_chu: p.tong_bang_chu || soTienBangChu(tongCong),
    });

  const phieuId = info.lastInsertRowid;
  const insertItem = db.prepare(
    `INSERT INTO phieu_xuat_items
     (phieu_xuat_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, thanh_tien, ghi_chu)
     VALUES (@phieu_xuat_id,@vat_tu_id,@stt,@ten_hang,@ma_so,@dvt,@sl_yeu_cau,@sl_thuc_xuat,@don_gia,@thanh_tien,@ghi_chu)`
  );
  for (const row of rows) insertItem.run({ phieu_xuat_id: phieuId, ...row });
  return phieuId;
}

// body: { so_phieu, ngay, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem,
//         items: [{ vat_tu_id? , ten_hang, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, ghi_chu }] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const itemsTho = Array.isArray(b.items) ? b.items : [];
  if (itemsTho.length === 0) return res.status(400).json({ error: 'Phiếu xuất cần ít nhất 1 dòng hàng hóa' });

  const items = itemsTho.map(chuanHoaDongHang);
  const thieuHut = kiemTraTonKho(items);
  if (thieuHut.length > 0) {
    return res.status(400).json({ error: 'Không đủ tồn kho cho một số vật tư', chi_tiet: thieuHut });
  }

  const tx = db.transaction(() => luuMotPhieuXuat({ ...b, items }));
  try {
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: 'Lưu phiếu xuất thất bại: ' + err.message });
  }
});

// Tách 1 phiếu nhập kho thành nhiều phiếu xuất cùng lúc.
// body: {
//   phieu_nhap_id, kieu: 'chia-doi' | 'tung-mat-hang',
//   ngay, no_tk, co_tk, ly_do_xuat, xuat_tai_kho, dia_diem, thue_suat,  // áp dụng chung
//   donViA, donViB: { nguoi_nhan, don_vi, so_phieu }   // dùng khi kieu = 'chia-doi'
//   donVi: { nguoi_nhan, don_vi, so_phieu_goc }        // dùng khi kieu = 'tung-mat-hang'
// }
router.post('/tach-tu-nhap', (req, res) => {
  const b = req.body || {};
  const phieuNhap = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(b.phieu_nhap_id);
  if (!phieuNhap) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const itemsNhap = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(phieuNhap.id);
  if (itemsNhap.length === 0) return res.status(400).json({ error: 'Phiếu nhập này không có dòng hàng hóa nào' });

  const chung = {
    ngay: b.ngay || null,
    no_tk: b.no_tk || null,
    co_tk: b.co_tk || null,
    ly_do_xuat: b.ly_do_xuat || null,
    xuat_tai_kho: b.xuat_tai_kho || null,
    dia_diem: b.dia_diem || null,
    thue_suat: Number(b.thue_suat) || 0,
  };

  const canhBao = [];
  let danhSachPhieu = [];

  const dongTu = (it, slXuat) => ({
    vat_tu_id: it.vat_tu_id,
    ten_hang: it.ten_hang,
    ma_so: it.ma_so,
    dvt: it.dvt,
    sl_yeu_cau: slXuat,
    sl_thuc_xuat: slXuat,
    don_gia: it.don_gia,
    thanh_tien: Math.round(slXuat * it.don_gia),
    ghi_chu: it.ghi_chu,
  });

  if (b.kieu === 'chia-doi') {
    const donViA = b.donViA || {};
    const donViB = b.donViB || {};
    const itemsA = [];
    const itemsB = [];
    itemsNhap.forEach((it) => {
      const nuaA = Math.floor(it.sl_thuc_nhap / 2);
      const nuaB = it.sl_thuc_nhap - nuaA;
      if (it.sl_thuc_nhap % 2 !== 0) {
        canhBao.push(`"${it.ten_hang}" số lượng lẻ (${it.sl_thuc_nhap}) — đã chia ${nuaA} / ${nuaB}, kiểm tra lại nếu cần chia khác.`);
      }
      if (nuaA > 0) itemsA.push(dongTu(it, nuaA));
      if (nuaB > 0) itemsB.push(dongTu(it, nuaB));
    });
    if (itemsA.length > 0) danhSachPhieu.push({ ...chung, ...donViA, items: itemsA });
    if (itemsB.length > 0) danhSachPhieu.push({ ...chung, ...donViB, items: itemsB });
  } else if (b.kieu === 'tung-mat-hang') {
    const donVi = b.donVi || {};
    itemsNhap.forEach((it, idx) => {
      danhSachPhieu.push({
        ...chung,
        nguoi_nhan: donVi.nguoi_nhan,
        don_vi: donVi.don_vi,
        so_phieu: donVi.so_phieu_goc ? `${donVi.so_phieu_goc}-${idx + 1}` : null,
        items: [dongTu(it, it.sl_thuc_nhap)],
      });
    });
  } else {
    return res.status(400).json({ error: 'Kiểu tách không hợp lệ (cần "chia-doi" hoặc "tung-mat-hang")' });
  }

  if (danhSachPhieu.length === 0) {
    return res.status(400).json({ error: 'Không tạo được phiếu xuất nào từ lựa chọn này' });
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

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM phieu_xuat WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
