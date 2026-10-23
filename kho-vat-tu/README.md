# Quản lý kho vật tư

## Dùng ngay qua link, không cần cài gì

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hung06724-creator/APK)

Bấm nút trên, đăng nhập/tạo tài khoản Render (miễn phí) nếu được hỏi, rồi bấm
**"Apply"**. Sau 2-3 phút, Render cho một link dạng `https://kho-vat-tu-xxxx.onrender.com`
— mở link đó là dùng được, không cần Node.js hay PowerShell.

**Lưu ý về gói miễn phí của Render:**
- Server "ngủ" sau 15 phút không ai truy cập, lần mở lại đầu tiên sẽ chậm khoảng
  30-50 giây để "thức dậy" — bình thường, không phải lỗi.
- Dữ liệu (database) có thể bị xóa mỗi khi triển khai lại bản mới (không phải mỗi lần
  server ngủ/thức). Nếu cần giữ dữ liệu chắc chắn lâu dài, nên chạy trên máy cá nhân
  (xem phần dưới) hoặc nâng cấp gói có ổ đĩa riêng của Render.

Website chạy trên máy cá nhân (localhost), giúp:
- Upload hóa đơn PDF → tự động trích xuất → tạo **phiếu nhập kho**.
- Tạo **phiếu xuất kho**, tự kiểm tra không cho xuất vượt tồn.
- Theo dõi **tồn kho** từng vật tư (tồn = tổng nhập − tổng xuất).
- Nạp dữ liệu lịch sử từ file Excel phiếu nhập/xuất mẫu cũ.

## Cài đặt & chạy

Cần có [Node.js](https://nodejs.org) (bản 18 trở lên) trên máy.

```bash
cd kho-vat-tu
npm install
npm start
```

Mở trình duyệt vào **http://localhost:3000**.

Dữ liệu được lưu trong file `data/kho.db` (SQLite), nằm ngay trong thư mục này —
không cần cài đặt cơ sở dữ liệu riêng. File này không được đưa lên Git.

## Nạp dữ liệu lịch sử từ Excel

```bash
node scripts/import-excel.js "duong/dan/file-nhap-xuat-mau.xlsx"
```

File Excel cần có các sheet mà tên chứa chữ "Nhập" hoặc "Xuất", theo đúng mẫu
01-VT / 02-VT (Thông tư 99/2025/TT-BTC) mà Phòng Kế hoạch — Tài chính đang dùng:
mỗi phiếu là một khối bắt đầu bằng dòng "PHIẾU NHẬP KHO" / "PHIẾU XUẤT KHO".

**Lưu ý:** đây là nạp "cố gắng tốt nhất". Với file mẫu thực tế (24 phiếu/tháng),
script nhận đúng toàn bộ các khối chuẩn. Một vài dòng hàng hóa có tên bị ngắt dòng
bất thường trong Excel gốc (merge ô thủ công) có thể bị đọc lẫn lộn — sau khi nạp,
vào mục **Tồn kho** rà soát nhanh, nếu thấy tên hàng nào trông bất thường (có lẫn số
liệu vào giữa tên) thì sửa trực tiếp trong database hoặc báo lại để chỉnh script.

## Tạo phiếu nhập từ hóa đơn PDF

Vào tab **"+ Phiếu nhập mới"**, kéo thả file PDF hóa đơn GTGT vào ô upload.

Hệ thống nhận diện tốt với hóa đơn xuất từ **Bkav eHoadon** và **MISA meInvoice**
(hai nhà cung cấp hóa đơn điện tử phổ biến nhất) — trích đúng toàn bộ bảng hàng hóa,
số lượng, đơn giá, thành tiền. Với hóa đơn từ nhà cung cấp khác, hoặc nếu hóa đơn có
bố cục đặc biệt, bảng hàng hóa có thể không trích được tự động — hệ thống sẽ báo rõ
bằng cảnh báo màu vàng, khi đó tự thêm từng dòng bằng tay.

**Luôn kiểm tra lại toàn bộ thông tin trước khi bấm "Lưu phiếu nhập kho"** — đây là
công cụ hỗ trợ nhập liệu nhanh, không phải tự động hoàn toàn chính xác 100%. Hệ thống
cũng tự cảnh báo nếu hóa đơn đó là do Trường **xuất ra** (bán) thay vì mua vào, để
tránh tạo nhầm phiếu nhập kho.

## Cấu trúc thư mục

```
server.js              Điểm khởi động Express
src/db.js               Schema SQLite + hàm tính tồn kho
src/services/pdfParser.js    Trích xuất dữ liệu từ hóa đơn PDF
src/services/soTienBangChu.js Chuyển số tiền sang chữ tiếng Việt
src/routes/              API: /api/vat-tu, /api/phieu-nhap, /api/phieu-xuat, /api/upload
public/                   Giao diện (HTML/CSS/JS thuần, không cần build)
scripts/import-excel.js  Nạp dữ liệu lịch sử từ Excel
```

## Giới hạn hiện tại (biết trước để không bất ngờ)

- Chỉ chạy single-user trên máy cá nhân, chưa có đăng nhập/phân quyền.
- Trích xuất PDF là "cố gắng tốt nhất", luôn cần xem lại trước khi lưu.
- Xuất phiếu ra Excel đúng mẫu 01-VT/02-VT để in ký tay (nút "Xuất Excel" ở danh sách
  phiếu nhập/xuất).
- Chưa có sửa phiếu đã lưu (chỉ xóa rồi tạo lại).
