const express = require('express');
const multer = require('multer');
const { parsePdfBuffer } = require('../services/pdfParser');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Chỉ nhận file PDF'));
    cb(null, true);
  },
});

// Chỉ đọc & trích xuất, KHÔNG lưu vào database. Kết quả trả về để người dùng xem
// lại, sửa trên form trước khi tự bấm "Lưu phiếu nhập".
router.post('/hoa-don', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Chưa chọn file PDF' });
  try {
    const ketQua = await parsePdfBuffer(req.file.buffer);
    res.json({ ...ketQua, tenFileGoc: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'Không đọc được file PDF: ' + err.message });
  }
});

module.exports = router;
