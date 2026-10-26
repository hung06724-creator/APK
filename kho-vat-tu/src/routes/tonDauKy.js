// Tồn đầu kỳ: danh sách, nạp từ file Excel (xem trước / ghi), xóa.
const express = require('express');
const multer = require('multer');
const { db, saoLuuDb } = require('../db');
const { docFile, ghi } = require('../services/tonDauKy');
const { ngayHopLe } = require('../services/tienIch');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/\.xlsx$/i.test(file.originalname)) return cb(Object.assign(new Error('Chỉ nhận file Excel .xlsx'), { status: 400 }));
    cb(null, true);
  },
});

router.get('/', (req, res) => {
  res.json(db.prepare(`SELECT t.*, v.ten_hang, v.dvt FROM ton_dau_ky t JOIN vat_tu v ON v.id = t.vat_tu_id
    ORDER BY v.ten_hang COLLATE NOCASE`).all());
});

// multipart: file, ngay (YYYY-MM-DD), ghi=1 để ghi thật (không có = chỉ xem trước)
router.post('/nap', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });
    const ngay = String(req.body.ngay || '');
    if (!ngayHopLe(ngay)) return res.status(400).json({ error: 'Ngày tồn đầu kỳ không hợp lệ' });
    const { dong } = await docFile(req.file.buffer);
    const hopLe = dong.filter((d) => !d.loi);
    let daGhi = 0;
    if (req.body.ghi === '1') {
      if (!hopLe.length) return res.status(400).json({ error: 'Không có dòng hợp lệ để ghi', dong });
      saoLuuDb(); // sao lưu database trước khi ghi
      daGhi = ghi(dong, ngay, req.file.originalname);
    }
    res.json({ dong, tong: dong.length, hop_le: hopLe.length, loi: dong.length - hopLe.length, da_ghi: daGhi });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM ton_dau_ky WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json({ ok: true });
});

module.exports = router;
