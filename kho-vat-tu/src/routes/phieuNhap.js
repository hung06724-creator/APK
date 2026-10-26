const express = require('express');
const { db, findOrCreateVatTu, layCauHinh } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');
const { chuanHoaNguonKinhPhi, laNguonKinhPhiHopLe, chuoiHoacNull } = require('../services/ghepNhapXuat');

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
//         dia_diem, so_chung_tu_goc, nha_cung_cap, nguon_pdf,
//         tk_doi_ung, tieu_muc, nguon_kinh_phi ('661.2' | '337', mặc định '661.2'),   // trường cho Sổ tổng hợp
//         items: [{ten_hang, ma_so, dvt, sl_chung_tu, sl_thuc_nhap, don_gia, ghi_chu, tieu_muc}] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const items = Array.isArray(b.items) ? b.items : [];
  if (items.length === 0) return res.status(400).json({ error: 'Phiếu nhập cần ít nhất 1 dòng hàng hóa' });

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
        tieu_muc: chuoiHoacNull(it.tieu_muc),
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
          so_chung_tu_goc, nha_cung_cap, tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu, nguon_pdf,
          tk_doi_ung, tieu_muc, nguon_kinh_phi)
         VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi_nhap,@don_vi,@ly_do_nhap,@nhap_tai_kho,@dia_diem,
                 @so_chung_tu_goc,@nha_cung_cap,@tong_tien_hang,@thue_suat,@tien_thue,@tong_cong,@tong_bang_chu,@nguon_pdf,
                 @tk_doi_ung,@tieu_muc,@nguon_kinh_phi)`
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
        tk_doi_ung: chuoiHoacNull(b.tk_doi_ung),
        tieu_muc: chuoiHoacNull(b.tieu_muc),
        nguon_kinh_phi: chuanHoaNguonKinhPhi(b.nguon_kinh_phi),
      });

    const phieuId = info.lastInsertRowid;
    const insertItem = db.prepare(
      `INSERT INTO phieu_nhap_items
       (phieu_nhap_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_chung_tu, sl_thuc_nhap, don_gia, thanh_tien, ghi_chu, tieu_muc)
       VALUES (@phieu_nhap_id,@vat_tu_id,@stt,@ten_hang,@ma_so,@dvt,@sl_chung_tu,@sl_thuc_nhap,@don_gia,@thanh_tien,@ghi_chu,@tieu_muc)`
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

router.delete('/:id', (req, res) => {
  // phieu_nhap_item_id không có khoá ngoại: gỡ liên kết ở các dòng xuất trước khi xoá để không bị "treo".
  db.transaction(() => {
    db.prepare(
      `UPDATE phieu_xuat_items SET phieu_nhap_item_id = NULL
       WHERE phieu_nhap_item_id IN (SELECT id FROM phieu_nhap_items WHERE phieu_nhap_id = ?)`
    ).run(req.params.id);
    db.prepare('DELETE FROM phieu_nhap WHERE id = ?').run(req.params.id);
  })();
  res.json({ ok: true });
});

module.exports = router;
