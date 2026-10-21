# Hướng dẫn tự thao tác: Đồng bộ dữ liệu từ eOffice sang website

Mục tiêu: lấy dữ liệu nhân sự (thông tin cơ bản) từ `eoffice.hnivc.edu.vn` và gửi
sang website của bạn (backend Node.js), chạy tự động theo lịch.

**Nguyên tắc an toàn — đọc trước khi làm:**
- Không bao giờ dán username, password, cookie hoặc token vào chat với AI hoặc bất kỳ nơi công khai.
- Mọi thông tin đăng nhập chỉ lưu trong file `.env` trên máy/server chạy job, không commit file này lên Git.
- Job này phải chạy trên một máy/server **trong mạng nội bộ trường** (hoặc có VPN vào được), vì `eoffice` dùng địa chỉ nội bộ `192.168.108.10`.
- Chỉ đồng bộ dữ liệu bạn được phép dùng theo đúng phạm vi IT đã xác nhận.

---

## Bước 1 — Lấy thông tin request đăng nhập eOffice

1. Mở `https://eoffice.hnivc.edu.vn` trên Chrome/Edge.
2. Nhấn `F12` → tab **Network** → lọc **Fetch/XHR**.
3. Đăng xuất, sau đó đăng nhập lại bằng tài khoản dịch vụ IT cấp.
4. Tìm request đăng nhập (thường có method `POST`, URL dạng `/Account/Login` hoặc tương tự). Ghi lại:
   - **Request URL** (ví dụ: `https://eoffice.hnivc.edu.vn/Account/Login`)
   - **Tên các field gửi lên** trong tab Payload/Form Data (ví dụ: `UserName`, `Password`, `__RequestVerificationToken`, …)
   - Có field "anti-forgery token" (`__RequestVerificationToken`) hay không. Nếu có, thường phải GET trang login trước để lấy token này từ HTML, rồi mới POST.

Điền các giá trị này vào file `sync/config.example.js` (phần `LOGIN_URL`, `LOGIN_FIELDS`) khi bạn nhận code ở Bước 3.

## Bước 2 — Chuẩn bị tài khoản dịch vụ

1. Nhận từ IT: username/password riêng cho job tự động (không dùng tài khoản cá nhân của bạn).
2. Trên máy sẽ chạy job, tạo file `.env` (xem mẫu `.env.example` trong code), điền:
   ```
   EOFFICE_USERNAME=...
   EOFFICE_PASSWORD=...
   WEBSITE_API_URL=https://website-cua-ban/api/sync/nhansu
   WEBSITE_API_KEY=...
   ```
3. Kiểm tra `.env` đã có trong `.gitignore`, không commit lên Git.

## Bước 3 — Nhận code đồng bộ

Khi đã có thông tin Bước 1 và 2, báo lại để nhận:
- `sync/login.js`: đăng nhập eOffice, lấy cookie phiên.
- `sync/fetchNhanSu.js`: gọi `GridReadHoSoNhanSu` với cookie đó, lấy dữ liệu.
- `sync/pushToWebsite.js`: gửi dữ liệu đã lọc sang API website.
- `sync/index.js`: chạy nối tiếp 3 bước trên, có log kết quả.

## Bước 4 — API nhận dữ liệu phía website (Node.js)

Website của bạn cần một endpoint, ví dụ:

```
POST /api/sync/nhansu
Header: X-API-KEY: <WEBSITE_API_KEY>
Body: { "data": [ { "MaNhanSu": "...", "HoTen": "...", "ChucVu": "...", "PhongBan": "...", "DonVi": "...", "TrangThaiHopDong": "..." }, ... ] }
```

Endpoint cần kiểm tra `X-API-KEY` trước khi lưu, để tránh người khác gửi dữ liệu giả vào hệ thống.

## Bước 5 — Chạy thử và lên lịch

1. Chạy thử bằng tay: `node sync/index.js`, kiểm tra log và dữ liệu nhận ở website.
2. Khi ổn, đặt lịch chạy tự động:
   - **Windows**: Task Scheduler, tạo tác vụ chạy `node sync/index.js` theo lịch.
   - **Linux**: `cron`, ví dụ mỗi ngày 2h sáng: `0 2 * * * node /duong/dan/sync/index.js`.
3. Theo dõi log vài lần đầu để chắc job không lỗi khi phiên đăng nhập hết hạn (cần đăng nhập lại mỗi lần chạy, không tái dùng cookie cũ).

---

## Việc cần bạn xác nhận với mình

- [ ] URL và tên field của request đăng nhập eOffice (Bước 1)
- [ ] Website Node.js đang chạy ở đâu (để chốt `WEBSITE_API_URL`)
- [ ] Tần suất chạy mong muốn (hằng ngày / hằng giờ / chạy tay)

Khi có đủ, báo lại để mình viết code thật ở Bước 3 và 4.
