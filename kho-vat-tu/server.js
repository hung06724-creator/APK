const express = require('express');
const path = require('path');

require('./src/db'); // khởi tạo database + schema ngay khi start

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/vat-tu', require('./src/routes/vatTu'));
app.use('/api/phieu-nhap', require('./src/routes/phieuNhap'));
app.use('/api/phieu-xuat', require('./src/routes/phieuXuat'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/cau-hinh', require('./src/routes/cauHinh'));
app.use('/api/tong-hop', require('./src/routes/tongHop'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Lỗi không xác định' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Website quản lý kho vật tư đang chạy tại: http://localhost:${PORT}`);
});
