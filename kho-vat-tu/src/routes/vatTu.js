const express = require('express');
const { tonKhoTatCa, db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(tonKhoTatCa());
});

router.get('/:id/lich-su', (req, res) => {
  const id = Number(req.params.id);
  const nhap = db
    .prepare(
      `SELECT pn.id, pn.so_phieu, pn.ngay, pni.sl_thuc_nhap AS so_luong, pni.don_gia
       FROM phieu_nhap_items pni JOIN phieu_nhap pn ON pn.id = pni.phieu_nhap_id
       WHERE pni.vat_tu_id = ? ORDER BY pn.ngay DESC, pn.id DESC`
    )
    .all(id);
  const xuat = db
    .prepare(
      `SELECT px.id, px.so_phieu, px.ngay, pxi.sl_thuc_xuat AS so_luong, pxi.don_gia
       FROM phieu_xuat_items pxi JOIN phieu_xuat px ON px.id = pxi.phieu_xuat_id
       WHERE pxi.vat_tu_id = ? ORDER BY px.ngay DESC, px.id DESC`
    )
    .all(id);
  res.json({ nhap, xuat });
});

module.exports = router;
