const express = require('express');
const { db, findOrCreateVatTu, tonKhoCuaVatTu, layCauHinh } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT pn.*, (SELECT COUNT(*) FROM phieu_nhap_items WHERE phieu_nhap_id = pn.id) AS so_dong
       FROM phieu_nhap pn ORDER BY pn.ngay DESC, pn.id DESC`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const items = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(req.params.id);
  res.json({ ...phieu, items });
});

router.get('/:id/xuat-excel', async (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const items = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(req.params.id);
  const wb = taoFilePhieu(phieu, items, 'nhap', layCauHinh());
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PhieuNhapKho_${phieu.so_phieu || phieu.id}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

// body: { so_phieu, ngay, no_tk, co_tk, nguoi_nhap, don_vi, ly_do_nhap, nhap_tai_kho,
//         dia_diem, so_chung_tu_goc, nha_cung_cap, nguon_pdf, items: [{ten_hang, ma_so, dvt, sl_chung_tu, sl_thuc_nhap, don_gia, ghi_chu}] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Phiếu nhập cần ít nhất 1 dòng hàng hóa' });
  if (items.some((it) => (Number(it.sl_thuc_nhap) || 0) < 0 || (Number(it.don_gia) || 0) < 0)) {
    return res.status(400).json({ error: 'Số lượng và đơn giá không được âm' });
  }

  const tx = db.transaction(() => {
    let tongTienHang = 0;
    const rowsToInsert = items.map((it, idx) => {
      const slThucNhap = Number(it.sl_thuc_nhap) || 0;
      const donGia = Number(it.don_gia) || 0;
      const thanhTien = Math.round(slThucNhap * donGia);
      tongTienHang += thanhTien;
      const vatTu = findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt, ma_so: it.ma_so });
      return {
        stt: idx + 1,
        ten_hang: it.ten_hang,
        ma_so: it.ma_so || null,
        dvt: it.dvt || null,
        sl_chung_tu: Number(it.sl_chung_tu) || slThucNhap,
        sl_thuc_nhap: slThucNhap,
        don_gia: donGia,
        thanh_tien: thanhTien,
        ghi_chu: it.ghi_chu || null,
        vat_tu_id: vatTu ? vatTu.id : null,
      };
    });

    const thueSuat = Number(b.thue_suat) || 0;
    const tienThue = Math.round((tongTienHang * thueSuat) / 100);
    const tongCong = tongTienHang + tienThue;

    const info = db
      .prepare(
        `INSERT INTO phieu_nhap
         (so_phieu, ngay, no_tk, co_tk, nguoi_nhap, don_vi, ly_do_nhap, nhap_tai_kho, dia_diem,
          so_chung_tu_goc, nha_cung_cap, tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu, nguon_pdf)
         VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi_nhap,@don_vi,@ly_do_nhap,@nhap_tai_kho,@dia_diem,
                 @so_chung_tu_goc,@nha_cung_cap,@tong_tien_hang,@thue_suat,@tien_thue,@tong_cong,@tong_bang_chu,@nguon_pdf)`
      )
      .run({
        so_phieu: b.so_phieu || null,
        ngay: b.ngay || null,
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
        tong_bang_chu: b.tong_bang_chu || soTienBangChu(tongCong),
        nguon_pdf: b.nguon_pdf || null,
      });

    const phieuId = info.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO phieu_nhap_items
       (phieu_nhap_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_chung_tu, sl_thuc_nhap, don_gia, thanh_tien, ghi_chu)
       VALUES (@phieu_nhap_id,@vat_tu_id,@stt,@ten_hang,@ma_so,@dvt,@sl_chung_tu,@sl_thuc_nhap,@don_gia,@thanh_tien,@ghi_chu)`
    );
    for (const row of rowsToInsert) insertItem.run({ phieu_nhap_id: phieuId, ...row });

    return phieuId;
  });

  try {
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: 'Lưu phiếu nhập thất bại: ' + err.message });
  }
});

// Không cho xóa phiếu nhập nếu hàng của phiếu đó đã xuất đi một phần/toàn bộ — xóa sẽ làm tồn kho âm.
router.delete('/:id', (req, res) => {
  const items = db.prepare('SELECT vat_tu_id, SUM(sl_thuc_nhap) AS sl FROM phieu_nhap_items WHERE phieu_nhap_id = ? AND vat_tu_id IS NOT NULL GROUP BY vat_tu_id').all(req.params.id);
  const thieuHut = [];
  for (const it of items) {
    const ton = tonKhoCuaVatTu(it.vat_tu_id);
    if (ton - it.sl < 0) {
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
  db.prepare('DELETE FROM phieu_nhap WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
