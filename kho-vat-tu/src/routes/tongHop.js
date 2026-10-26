const express = require('express');
const {
  xacDinhKy,
  layDuLieuKy,
  xuatTongHop,
} = require('../services/xuatTongHop');

const router = express.Router();

// GET /api/tong-hop/xem?quy=1..4&nam=YYYY | ?nam=YYYY | ?tu_ngay=YYYY-MM-DD&den_ngay=YYYY-MM-DD
// Trả JSON các dòng của sổ "Tổng hợp nhập xuất vật tư" (để xem trước trên màn hình).
router.get('/xem', (req, res, next) => {
  try {
    const ky = xacDinhKy(req.query);
    res.json(layDuLieuKy(ky));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/tong-hop/xuat-excel?...  (thêm cac_quy=1&nam=YYYY để xuất 4 sheet quý I-IV)
router.get('/xuat-excel', async (req, res, next) => {
  try {
    const { buffer, tenFile } = await xuatTongHop(req.query);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${tenFile}"; filename*=UTF-8''${encodeURIComponent(tenFile)}`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
