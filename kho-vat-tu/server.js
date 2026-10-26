const express = require('express');
const http = require('http');
const os = require('os');
const path = require('path');

require('./src/db'); // khởi tạo database + schema ngay khi start

const app = express();

// Chặn trang web lạ dùng trình duyệt của người dùng để gọi vào máy chủ này (ứng dụng không có đăng nhập):
//  - Host phải là localhost, địa chỉ IP hoặc tên máy này (chặn kiểu tấn công "DNS rebinding");
//  - yêu cầu ghi (POST/PUT/PATCH/DELETE) có Origin thì Origin phải đúng trang này (chặn gửi form chéo trang).
// Trên Render (RENDER=true) Host là tên miền của dịch vụ nên bỏ qua kiểm tra Host.
const TEN_MAY = os.hostname().toLowerCase();
function hostHopLe(host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return h === 'localhost' || h.endsWith('.localhost') || h === TEN_MAY || /^[\d.]+$/.test(h) || h.includes(':');
}
app.use((req, res, next) => {
  if (!process.env.RENDER && !hostHopLe(req.headers.host)) return res.status(403).json({ error: 'Host không hợp lệ' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
    let nguon = null;
    try { nguon = new URL(req.headers.origin).host; } catch (e) { /* Origin hỏng */ }
    if (nguon !== req.headers.host) return res.status(403).json({ error: 'Yêu cầu từ trang web khác bị chặn' });
  }
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/vat-tu', require('./src/routes/vatTu'));
app.use('/api/phieu-nhap', require('./src/routes/phieuNhap'));
app.use('/api/phieu-xuat', require('./src/routes/phieuXuat'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/cau-hinh', require('./src/routes/cauHinh'));
app.use('/api/tong-hop', require('./src/routes/tongHop'));
app.use('/api/tai-san', require('./src/routes/taiSan'));
app.use('/api/xuat', require('./src/routes/xuatBang'));
app.use('/api/kiem-ke', require('./src/routes/kiemKe'));
app.use('/api/ton-dau-ky', require('./src/routes/tonDauKy'));
app.use('/api/khoa-so', require('./src/routes/khoaSo'));
// Đường dẫn API không tồn tại: trả JSON (giao diện hiện được thông báo) thay vì trang HTML mặc định của Express.
app.use('/api', (req, res) => res.status(404).json({ error: 'Chức năng này không có trên máy chủ (đường dẫn API không tồn tại).' }));

app.use((err, req, res, next) => {
  console.error(err);
  // Lỗi do người dùng gửi (JSON hỏng, file sai loại, file quá lớn...) là 4xx, không phải lỗi server.
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: err.message || 'Lỗi không xác định' });
});

// Mặc định chỉ máy này truy cập được (127.0.0.1 và ::1), vì ứng dụng không có đăng nhập.
// Muốn cho máy khác trong mạng nội bộ dùng: đặt biến môi trường HOST=0.0.0.0 trước khi chạy.
// Trên Render (RENDER=true) mặc định mở cho mọi địa chỉ như dịch vụ web yêu cầu.
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : null);
const cacDiaChi = HOST ? [HOST] : ['127.0.0.1', '::1'];
let daBao = false;
cacDiaChi.forEach((diaChi) => {
  const sv = http.createServer(app);
  sv.on('error', (err) => {
    // Máy không bật IPv6 thì bỏ qua ::1; lỗi khác (vd. cổng đang bận) thì báo và dừng.
    if (diaChi === '::1' && ['EADDRNOTAVAIL', 'EAFNOSUPPORT'].includes(err.code)) return;
    console.error(`Không mở được cổng ${PORT} trên ${diaChi}: ${err.message}`);
    process.exit(1);
  });
  sv.listen(PORT, diaChi, () => {
    if (daBao) return;
    daBao = true;
    console.log(`Website quản lý kho vật tư đang chạy tại: http://localhost:${PORT}`
      + (HOST ? ` (mở trên ${HOST})` : ' (chỉ máy này truy cập được; đặt HOST=0.0.0.0 để cho máy khác trong mạng dùng)'));
  });
});
