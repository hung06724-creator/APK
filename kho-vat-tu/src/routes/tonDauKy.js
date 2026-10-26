// Tồn đầu kỳ: danh sách, nạp từ file Excel (xem trước / ghi), xóa.
const express = require('express');
const multer = require('multer');
const { db, saoLuuDb } = require('../db');
const { docFile, ghi } = require('../services/tonDauKy');
const { ngayHopLe } = require('../services/tienIch');
const { loiKhoaSo, namKhoaCua, LOI_KHOA } = require('../services/khoaSo');

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
    const khoa = loiKhoaSo('nạp tồn đầu kỳ', ngay);
    if (khoa) return res.status(LOI_KHOA).json({ error: khoa });
    const { dong } = await docFile(req.file.buffer);
    // Vật tư đã có tồn đầu kỳ ghi ngày thuộc năm đã khóa sổ: không được thay bằng số mới.
    const layNgayCu = db.prepare('SELECT ngay FROM ton_dau_ky WHERE vat_tu_id = ?');
    dong.forEach((d) => {
      if (d.loi || !d.vat_tu_id) return;
      const cu = layNgayCu.get(d.vat_tu_id);
      const nam = cu ? namKhoaCua(cu.ngay) : null;
      if (nam) d.loi = `Đã có tồn đầu kỳ ngày ${String(cu.ngay).split('-').reverse().join('/')} thuộc năm ${nam} đã khóa sổ — không thay được`;
    });
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
  const row = db.prepare('SELECT id, ngay FROM ton_dau_ky WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
  const khoa = loiKhoaSo('xóa tồn đầu kỳ', row.ngay);
  if (khoa) return res.status(LOI_KHOA).json({ error: khoa });
  db.prepare('DELETE FROM ton_dau_ky WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;
