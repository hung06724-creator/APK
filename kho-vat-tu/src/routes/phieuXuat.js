const express = require('express');
const { db, findOrCreateVatTu, tonKhoCuaVatTu } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');

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

// body: { so_phieu, ngay, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem,
//         items: [{ vat_tu_id? , ten_hang, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, ghi_chu }] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Phiếu xuất cần ít nhất 1 dòng hàng hóa' });

  // Kiểm tra đủ tồn kho trước khi trừ, báo lỗi rõ ràng nếu thiếu.
  const thieuHut = [];
  for (const it of items) {
    const vatTu = it.vat_tu_id
      ? db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(it.vat_tu_id)
      : findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt });
    const slXuat = Number(it.sl_thuc_xuat) || 0;
    const ton = vatTu ? tonKhoCuaVatTu(vatTu.id) : 0;
    if (slXuat > ton) {
      thieuHut.push({ ten_hang: it.ten_hang || (vatTu && vatTu.ten_hang), ton_kho: ton, muon_xuat: slXuat });
    }
  }
  if (thieuHut.length > 0) {
    return res.status(400).json({ error: 'Không đủ tồn kho cho một số vật tư', chi_tiet: thieuHut });
  }

  const tx = db.transaction(() => {
    let tongTienHang = 0;
    const rowsToInsert = items.map((it, idx) => {
      const slThucXuat = Number(it.sl_thuc_xuat) || 0;
      const donGia = Number(it.don_gia) || 0;
      const thanhTien = Math.round(slThucXuat * donGia);
      tongTienHang += thanhTien;
      const vatTu = it.vat_tu_id
        ? db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(it.vat_tu_id)
        : findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt });
      return {
        stt: idx + 1,
        ten_hang: it.ten_hang || (vatTu && vatTu.ten_hang),
        ma_so: it.ma_so || null,
        dvt: it.dvt || (vatTu && vatTu.dvt) || null,
        sl_yeu_cau: Number(it.sl_yeu_cau) || slThucXuat,
        sl_thuc_xuat: slThucXuat,
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
        `INSERT INTO phieu_xuat
         (so_phieu, ngay, no_tk, co_tk, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem,
          tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu)
         VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi_nhan,@don_vi,@ly_do_xuat,@xuat_tai_kho,@dia_diem,
                 @tong_tien_hang,@thue_suat,@tien_thue,@tong_cong,@tong_bang_chu)`
      )
      .run({
        so_phieu: b.so_phieu || null,
        ngay: b.ngay || null,
        no_tk: b.no_tk || null,
        co_tk: b.co_tk || null,
        nguoi_nhan: b.nguoi_nhan || null,
        don_vi: b.don_vi || null,
        ly_do_xuat: b.ly_do_xuat || null,
        xuat_tai_kho: b.xuat_tai_kho || null,
        dia_diem: b.dia_diem || null,
        tong_tien_hang: tongTienHang,
        thue_suat: thueSuat,
        tien_thue: tienThue,
        tong_cong: tongCong,
        tong_bang_chu: b.tong_bang_chu || soTienBangChu(tongCong),
      });

    const phieuId = info.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO phieu_xuat_items
       (phieu_xuat_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, thanh_tien, ghi_chu)
       VALUES (@phieu_xuat_id,@vat_tu_id,@stt,@ten_hang,@ma_so,@dvt,@sl_yeu_cau,@sl_thuc_xuat,@don_gia,@thanh_tien,@ghi_chu)`
    );
    for (const row of rowsToInsert) insertItem.run({ phieu_xuat_id: phieuId, ...row });

    return phieuId;
  });

  try {
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: 'Lưu phiếu xuất thất bại: ' + err.message });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM phieu_xuat WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
