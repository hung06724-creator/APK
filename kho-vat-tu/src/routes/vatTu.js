const express = require('express');
const { tonKhoTatCa, db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(tonKhoTatCa());
});

// Lịch sử 1 vật tư: thông tin vật tư, tồn đầu kỳ (nếu có), các dòng nhập và xuất (kèm người nhập / nhận).
router.get('/:id/lich-su', (req, res) => {
  const id = Number(req.params.id);
  const vatTu = db.prepare('SELECT id, ten_hang, dvt, ma_so FROM vat_tu WHERE id = ?').get(id);
  if (!vatTu) return res.status(404).json({ error: 'Không tìm thấy vật tư' });
  const tonDauKy = db.prepare('SELECT ngay, so_luong, don_gia FROM ton_dau_ky WHERE vat_tu_id = ?').get(id) || null;
  const nhap = db
    .prepare(
      `SELECT pn.id, pn.so_phieu, pn.ngay, pn.nguoi_nhap AS nguoi, pni.sl_thuc_nhap AS so_luong, pni.don_gia
       FROM phieu_nhap_items pni JOIN phieu_nhap pn ON pn.id = pni.phieu_nhap_id
       WHERE pni.vat_tu_id = ? ORDER BY pn.ngay, pn.id`
    )
    .all(id);
  const xuat = db
    .prepare(
      `SELECT px.id, px.so_phieu, px.ngay, px.nguoi_nhan AS nguoi, pxi.sl_thuc_xuat AS so_luong, pxi.don_gia
       FROM phieu_xuat_items pxi JOIN phieu_xuat px ON px.id = pxi.phieu_xuat_id
       WHERE pxi.vat_tu_id = ? ORDER BY px.ngay, px.id`
    )
    .all(id);
  res.json({ vat_tu: vatTu, ton_dau_ky: tonDauKy, nhap, xuat });
});

module.exports = router;
