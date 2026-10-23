# Giao diện phần mềm Bảng lương HNIVC — tài liệu trình bày đầy đủ

Tài liệu này gom **toàn bộ cách trình bày** của phần mềm Quản lý Bảng lương (Trường Cao đẳng nghề Công nghiệp Hà Nội):
bảng màu, font, bố cục, nút, bảng, hộp thoại, mẫu báo cáo in, và **logo** (nhúng sẵn ở phụ lục A để mở một file là thấy đủ).
Nguồn: `web/public/index.html` và `web/public/css/*.css` (12 file, chép nguyên văn ở các phụ lục B).
Lập ngày 23/10/2026.

> **Nguyên tắc số một:** không đưa mã màu rời (hex) vào giao diện mới. Luôn dùng biến CSS ở mục 2 và các lớp có sẵn
> (`.btn-*`, `.ui-*`). Bản thiết kế từ bên ngoài phải quy đổi về token này trước khi dựng.
> Giao diện dùng chung ngôn ngữ thiết kế với ứng dụng CSP (Tra soát sổ phụ): cùng bảng màu xanh lục đậm, cùng nút, thẻ, nhãn.

---

## 1. Nền tảng

| Hạng mục | Giá trị |
|---|---|
| Công nghệ | HTML + JavaScript thuần (không framework), CSS thuần có biến; máy chủ Express |
| Font giao diện chung | **Inter** (300–700), nạp từ Google Fonts |
| Font các trang mới (`.ui-scope`, `.emp-scope`) | **Be Vietnam Pro** (400–700), `font-variant-numeric: tabular-nums`, `-webkit-font-smoothing: antialiased` |
| Font bảng và mẫu in báo cáo | **Times New Roman** (biến `--font-report`) |
| Font phiếu lương Word (.docx) | Calibri |
| Biểu tượng | Font Awesome 6.4.0 (`<i class="fas fa-…">`) |
| Cỡ chữ gốc | 16px mặc định của trình duyệt, `line-height: 1.6` ở `body` |
| Số liệu | Định dạng `vi-VN` (dấu chấm ngăn nghìn, dấu phẩy thập phân) |
| Thư viện Excel phía trình duyệt | `xlsx-js-style@1.2.0` |
| Thứ tự nạp CSS | app → ui → employees → contracts → watch → doichieubhxh → bhxh → bhxh-kiemtra → bhxh-ebh → people → fit → overview (**ui.css phải nạp trước employees.css**) |

Phần `<head>` của trang:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
<link rel="icon" type="image/jpeg" href="/0000001hehe%20(1).jpg">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Qu&#7843;n l&#253; B&#7843;ng l&#432;&#417;ng - C&#272;N CN H&#224; N&#7897;i</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>
<script src="/excel-layout-presets.js"></script>
<script src="/js/excel-print.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/app.css">
<link rel="stylesheet" href="/css/ui.css">
<link rel="stylesheet" href="/css/employees.css">
<link rel="stylesheet" href="/css/contracts.css">
<link rel="stylesheet" href="/css/watch.css">
<link rel="stylesheet" href="/css/doichieubhxh.css">
<link rel="stylesheet" href="/css/bhxh.css">
<link rel="stylesheet" href="/css/bhxh-kiemtra.css">
<link rel="stylesheet" href="/css/bhxh-ebh.css">
<link rel="stylesheet" href="/css/people.css">
<link rel="stylesheet" href="/css/fit.css">
<link rel="stylesheet" href="/css/overview.css">

</head>
<body>
```

---

## 2. Logo

Có hai bản logo, dùng ở hai chỗ khác nhau. Ảnh nhúng sẵn ở phụ lục A, bản gốc nằm trong thư mục `logo/` đi kèm.

| Tệp | Kích thước | Dùng ở đâu |
|---|---|---|
| `logo/logo-hnivc-mau.jpg` (gốc `web/public/0000001hehe (1).jpg`) | 960 × 960, JPEG, nền trắng, huy hiệu răng cưa xanh navy – mặt trời vàng – cổng Hà Nội đỏ – sách mở có chữ "CAO ĐẲNG NGHỀ CÔNG NGHIỆP HÀ NỘI" và "hnivc.edu.vn" | Thanh menu bên (cạnh chữ "BẢNG LƯƠNG") và favicon trình duyệt |
| `logo/logo-hnivc-white.png` (gốc `web/public/logo-hnivc-white.png`) | 303 × 103, PNG nền trong suốt, chữ trắng | Đầu **phiếu lương cá nhân** (nền xanh navy `#1B4F9C`) — cả trên màn hình và file Word `payrollSlipDocx.js` |

Cách đặt logo trong menu bên (`.sidebar-header .school-logo`):

```css
.sidebar-header .school-logo{width:34px;height:34px;object-fit:cover;border-radius:10px;flex-shrink:0;background:#fff;padding:2px;box-shadow:0 6px 18px rgba(0,0,0,0.22)}
```

```html
<link rel="icon" type="image/jpeg" href="/0000001hehe%20(1).jpg">
<h2><img class="school-logo" src="/0000001hehe%20(1).jpg" alt="Logo trường"> <span>BẢNG LƯƠNG</span></h2>
<small>CĐN Công nghiệp Hà Nội</small>
```

Cách đặt logo trắng ở đầu phiếu lương (nền navy, dải vàng 8px bên dưới):

```html
<div style="background:#1B4F9C;padding:22px 26px;display:flex;justify-content:space-between;align-items:center;gap:20px">
  <div>
    <div style="color:#FFD400;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">Phiếu lương cá nhân</div>
    <div style="color:#fff;font-size:25px;font-weight:800;margin-top:4px">HỌ VÀ TÊN</div>
  </div>
  <img src="/logo-hnivc-white.png" alt="Logo HNIVC" style="height:52px;width:auto;object-fit:contain;flex:none">
</div>
<div style="background:#FFD400;height:8px"></div>
```

Quy tắc dùng logo: bản màu luôn đặt trên ô nền trắng (có `padding` và bo góc), bản trắng chỉ đặt trên nền navy; không kéo giãn (giữ tỉ lệ), không đổi màu.

---

## 3. Bảng màu

### 3.1 Giao diện chính — xanh lục đậm (token trong `:root`, `app.css`)

```css
:root {
  --primary: #2f6b5f;
  --primary-dark: #28584f;
  --primary-light: #edf5f2;
  --secondary: #6b7280;
  --success: #2f855a;
  --warning: #c98a2e;
  --danger: #b84747;
  --background: #f6f5f1;
  --sidebar-bg: #16322d;
  --sidebar-hover: #21453e;
  --card-bg: #ffffff;
  --text-main: #1f2937;
  --text-muted: #6b7280;
  --border: #d9e2dc;
  --surface-soft: #f8faf9;
  --surface-hover: #f3f4f2;
  --border-soft: #e6ece8;
  --border-strong: #c8d8d1;
  --text-faint: #7a8883;
  /* Bộ màu nút theo hướng dẫn giao diện CSP — dùng cả làm nhãn trạng thái */
  --btn-primary-bg: #2f6b5f; --btn-primary-hover: #28584f; --btn-primary-text: #ffffff; --btn-primary-border: #2f6b5f;
  --btn-secondary-bg: #edf5f2; --btn-secondary-hover: #dcebe5; --btn-secondary-text: #28584f; --btn-secondary-border: #c8d8d1;
  --btn-neutral-bg: #ffffff; --btn-neutral-hover: #f3f4f2; --btn-neutral-text: #4b5a55; --btn-neutral-border: #d9e2dc;
  --btn-warning-bg: #f6e9cf; --btn-warning-hover: #eeddb8; --btn-warning-text: #9a6516; --btn-warning-border: #e2c78f;
  --btn-danger-bg: #f7e3e3; --btn-danger-hover: #efcfcf; --btn-danger-text: #9e3e3e; --btn-danger-border: #d9a9a9;
  --overlay: rgba(15, 28, 23, .28);
  --shadow-dialog: 0 24px 64px rgba(0, 0, 0, .22);
  --shadow-float: 0 12px 32px rgba(0, 0, 0, .18);
  --focus-ring: 0 0 0 3px rgba(47, 107, 95, .16);
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --font-ui: 'Inter', system-ui, -apple-system, sans-serif;
  --font-report: 'Times New Roman', Times, serif;
}
```

Ý nghĩa nhanh:

| Nhóm | Token | Mã | Dùng cho |
|---|---|---|---|
| Thương hiệu | `--primary` | `#2f6b5f` | Nút chính, mục menu đang chọn, nhãn đang chọn, số tiền nổi bật |
| | `--primary-dark` | `#28584f` | Hover của nút chính, chữ trên nền nhạt |
| | `--primary-light` | `#edf5f2` | Nền nhạt: dòng được rê chuột, ô tổng, ghi chú |
| Trạng thái | `--success` / `--warning` / `--danger` | `#2f855a` / `#c98a2e` / `#b84747` | Thành công / cảnh báo / lỗi, số âm |
| Nền | `--background` | `#f6f5f1` | Nền trang, nền hàng tiêu đề bảng |
| | `--card-bg` | `#ffffff` | Nền thẻ, panel, hộp thoại |
| | `--sidebar-bg` / `--sidebar-hover` | `#16322d` / `#21453e` | Menu bên |
| Chữ | `--text-main` / `--text-muted` / `--text-faint` | `#1f2937` / `#6b7280` / `#7a8883` | Chữ chính / phụ / mờ |
| Viền | `--border` / `--border-soft` / `--border-strong` | `#d9e2dc` / `#e6ece8` / `#c8d8d1` | Viền thẻ, đường kẻ bảng, viền nhấn |

Trong phạm vi `.ui-scope` / `.emp-scope` (các trang mới) một số token được làm đậm hơn để chữ rõ: `--text-main #0f1c17`, `--text-muted #4a5854`, `--background #f7f7f4`, `--secondary #66756f`, `--success #3b7d61`, `--sidebar-hover #265049`.

### 3.2 Bộ màu nút / nhãn trạng thái

| Kiểu | Nền | Hover | Chữ | Viền |
|---|---|---|---|---|
| primary | `#2f6b5f` | `#28584f` | `#ffffff` | `#2f6b5f` |
| secondary | `#edf5f2` | `#dcebe5` | `#28584f` | `#c8d8d1` |
| neutral | `#ffffff` | `#f3f4f2` | `#4b5a55` | `#d9e2dc` |
| warning | `#f6e9cf` | `#eeddb8` | `#9a6516` | `#e2c78f` |
| danger | `#f7e3e3` | `#efcfcf` | `#9e3e3e` | `#d9a9a9` |

### 3.3 Màu thương hiệu HNIVC (phiếu lương, theo logo)

Phiếu lương cá nhân dùng bảng màu riêng của logo trường, không dùng xanh lục của giao diện chính:

| Vai trò | Mã |
|---|---|
| Navy (đầu phiếu, tiêu đề bảng, chữ nhấn) | `#1B4F9C` (đậm hơn: `#143B76`) |
| Vàng (nhãn nhỏ, dải kẻ, dòng nhấn) | `#FFD400` |
| Chữ chính / phụ / mờ | `#1F2937` / `#6B7280` / `#9CA3AF` |
| Đường kẻ / nền nhạt / dải nền | `#DDE3EC` (màn hình `#E4EAF3`) / `#F3F6FB` / `#E6EEF9` |
| Khung phiếu | nền trắng, viền `#E4EAF3`, bo góc 12px, rộng tối đa 900px, font Be Vietnam Pro |

---

## 4. Bố cục tổng thể

- **Menu bên trái** cố định, rộng **280px**, nền `--sidebar-bg`, chữ trắng; đầu menu là logo + chữ **BẢNG LƯƠNG** (20px, đậm 700) và dòng nhỏ "CĐN Công nghiệp Hà Nội".
- **Mục menu** `.nav-item`: cao ~48px, bo góc 12px, lề 4px 12px, chữ 14px/500, màu trắng 70%; rê chuột: nền trắng 5%, dịch sang phải 5px, icon phóng 1.2; **đang chọn**: nền `--primary`, chữ trắng, bóng xanh.
- **Nội dung** `.main`: `margin-left:280px`, `padding:30px`. Mỗi trang `.page` ẩn mặc định, `.page.active` hiện với hiệu ứng mờ dần + trượt lên 10px (0,3s).
- Các trang mới dùng `.ui-page`: cột dọc, khoảng cách 16px, rộng tối đa 1600px, căn giữa, chừa 96px phía dưới.
- **Thanh tab nhóm trang** `.page-tabs` (viên thuốc) hiện ngay trên nội dung khi nhóm menu có từ 2 trang trở lên.
- **Thu gọn**: ≤1024px menu còn 80px (chỉ icon); ≤768px lề nội dung 20px, form một cột.
- Cuối menu là nút bật/tắt **Mạng LAN** (nhãn "Tắt/Bật" dạng viên thuốc, hiện địa chỉ truy cập).

Menu bên (HTML):

```html
<!-- Sidebar -->
<nav class="sidebar">
  <div class="sidebar-header">
    <h2><img class="school-logo" src="/0000001hehe%20(1).jpg" alt="Logo tr&#432;&#7901;ng"> <span>B&#7842;NG L&#431;&#416;NG</span></h2>
    <small>C&#272;N C&#244;ng nghi&#7879;p H&#224; N&#7897;i</small>
  </div>
  <div class="nav-section">
    <div class="nav-item" data-nav="dashboard" onclick="showGroup('dashboard')"><span class="icon"><i class="fas fa-chart-line"></i></span>Dashboard</div>
    <div class="nav-item" data-nav="nhansu" onclick="showGroup('nhansu')"><span class="icon"><i class="fas fa-users"></i></span>Nh&#226;n s&#7921;</div>
    <div class="nav-item" data-nav="baohiem" onclick="showGroup('baohiem')"><span class="icon"><i class="fas fa-shield-heart"></i></span>BHXH</div>
    <div class="nav-item" data-nav="luong" onclick="showGroup('luong')"><span class="icon"><i class="fas fa-wallet"></i></span>Qu&#7843;n l&#253; l&#432;&#417;ng<span class="nav-badge" id="nav-badge-luong" style="display:none" title="Nhân sự có thay đổi chờ bạn xác nhận"></span></div>
    <div class="nav-item" data-nav="biendong" onclick="showGroup('biendong')"><span class="icon"><i class="fas fa-money-bill-wave"></i></span>Bi&#7871;n &#273;&#7897;ng l&#432;&#417;ng</div>
    <div class="nav-item" data-nav="thue" onclick="showGroup('thue')"><span class="icon"><i class="fas fa-university"></i></span>Thu&#7871; &amp; B&#7843;o hi&#7875;m</div>
    <div class="nav-item" data-nav="payroll" onclick="showGroup('payroll')"><span class="icon"><i class="fas fa-file-invoice-dollar"></i></span>B&#7843;ng l&#432;&#417;ng</div>
    <div class="nav-item" data-nav="reports" onclick="showGroup('reports')"><span class="icon"><i class="fas fa-chart-pie"></i></span>B&#225;o c&#225;o</div>
    <div class="nav-item" data-nav="tonghop" onclick="showGroup('tonghop')"><span class="icon"><i class="fas fa-layer-group"></i></span>T&#7893;ng h&#7907;p</div>
    <div class="nav-item" data-nav="backup" onclick="showGroup('backup')"><span class="icon"><i class="fas fa-database"></i></span>H&#7879; th&#7889;ng</div>
  </div>
  <div class="nav-section lan-section">
    <button type="button" class="nav-item lan-toggle" id="lan-toggle" onclick="lanToggle()" aria-pressed="false"><span class="icon"><i class="fas fa-wifi"></i></span>M&#7841;ng LAN<span class="lan-state">T&#7855;t</span></button>
    <div class="lan-urls" id="lan-urls" style="display:none"></div>
  </div>
</nav>
```

Các nhóm menu và trang con (`NAV_GROUPS` trong `app.js`):

| Menu | Icon | Trang con |
|---|---|---|
| Dashboard | fa-chart-line | Dashboard |
| Nhân sự | fa-users | Hồ sơ, Bảng tổng, Hợp đồng, Quyết định lương, Lịch sử tăng lương, Nhắc việc |
| BHXH | fa-shield-heart | Kiểm tra hồ sơ, Biến động lương, Biến động người lao động, Đối chiếu eBH |
| Quản lý lương | fa-wallet | Quản lý NV, Điều chỉnh HS |
| Biến động lương | fa-money-bill-wave | Truy lĩnh lương, Truy thu, Thưởng lễ / Ủng hộ |
| Thuế & Bảo hiểm | fa-university | Tính thuế TNCN, Tính BHXH |
| Bảng lương | fa-file-invoice-dollar | Bảng lương |
| Báo cáo | fa-chart-pie | Báo cáo |
| Tổng hợp | fa-layer-group | Tổng hợp các Lương, Tổng hợp Năm |
| Hệ thống | fa-database | Lưu trữ / Backup, Cấu hình biểu in |
| Mạng LAN | fa-wifi | (nút bật/tắt ở cuối menu) |

---

## 5. Thành phần

### 5.1 Nút (`.btn`)

- Hình dạng: bo góc 8px (`.5rem`), viền 1px, chữ đậm 600, icon cách chữ 8px, không bóng, `focus-visible` có vòng `--focus-ring`.
- Kích thước: `btn-sm` (6px 12px, 12px) · `btn-md` (8px 16px, 14px) · `btn-lg` (10px 18px, 14px) · `btn-pill` (bo tròn).
- Kiểu: `btn-primary` · `btn-secondary` · `btn-neutral` · `btn-warning` · `btn-danger` · `btn-ghost`; trạng thái "sẵn sàng xóa" `.is-armed` (nền đỏ đặc).
- `btn-success` và `btn-print` trong trang mới được quy về kiểu secondary / neutral.
- Nút vô hiệu: độ mờ 55%, con trỏ cấm.

### 5.2 Ô nhập

`.ui-input`: cao 38px, viền `--border`, bo 8px, chữ 13px (14px trong `.ui-field`); focus: viền `--primary` + `--focus-ring` (`0 0 0 3px rgba(47,107,95,.16)`). Biến thể: `.cell` (ô trong bảng, cao 30px, chữ 12px, căn phải), `.mono`, `.w-sm` 140px, `.w-md` 220px; ô tìm kiếm `.ui-search` bo tròn, icon kính lúp bên trái. Nhãn trường `.ui-field`: 12px, màu `--text-muted`, cách ô nhập 5px.

### 5.3 Thẻ, tiêu đề trang

- `.ui-card`: nền trắng, viền `--border`, bo 12px, **không đổ bóng**. `.ui-card-head` (14px 16px, viền dưới), `.ui-card-body` (padding 16px, cột cách 12px).
- Tiêu đề trang `.ui-head h1`: 1.5rem, đậm 700, `letter-spacing:-.025em`; dòng mô tả 13px màu `--text-muted`; nhóm nút bên phải `.ui-head-actions`.
- Thẻ số liệu `.stat-card` (`.ui-scope`): bo 12px, padding 16px 20px, số 1.5rem đậm 700, nhãn 12px; rê chuột chỉ đổi màu viền.
- Ô tổng `.report-total-box`: nền `--primary-light`, bo 12px, nhãn in hoa 13px, giá trị 1.5rem đậm màu `--primary`.

### 5.4 Nhãn và thanh chọn

- Nhãn `.ui-pill` 11px/600, bo tròn, các tông `ui-tone-primary|warning|danger|neutral` lấy màu từ bộ màu nút.
- Thanh chọn viên thuốc `.ui-seg` / `.page-tabs`: viền 1px, bo tròn hoàn toàn, nút đang chọn `.on`/`.active` nền `--primary` chữ trắng.
- Ghi chú `.ui-note` nền `--btn-secondary-bg`; thanh thống kê `.ui-statbar`; khối thao tác hàng loạt `.ui-bulk`; phần gập `details.ui-fold`.

### 5.5 Bảng dữ liệu

| Loại | Lớp | Đặc điểm |
|---|---|---|
| Bảng thao tác (trang mới) | `table.ui-table` | 13px, tiêu đề dính trên (cao 34px, nền `--background`, chữ 12px/600 màu muted), dòng kẻ `--border-soft`, rê chuột `--btn-neutral-hover`, số căn phải `.num`, dòng tổng dính dưới `.ui-total`, dòng cảnh báo `.is-danger` |
| Bảng cũ | `table.data-table` | font báo cáo Times New Roman, tiêu đề in hoa 13px; trong `.ui-scope` được đưa về giống `ui-table` |
| Bảng báo cáo | `table.report-table` | viền đen 1px, chữ đen 14px Times New Roman, tiêu đề nền `#f8fafc`, dòng tổng nền `#fefce8` đậm |
| Bảng tổng (nhân sự) | `.ov-table` | rộng theo nội dung, cột tên ghim trái, tiêu đề ghim trên, vạch dọc đậm hơn ở đầu mỗi nhóm, dòng chẵn lẻ xen màu |
| Gọn bảng trên màn hình | `.cp-*` (compact-table.js) | thanh công cụ + phân trang viên thuốc; chỉ áp dụng khi xem, không ảnh hưởng in/Excel |

### 5.6 Hộp thoại, thông báo

- `.ui-dialog`: lớp phủ `--overlay`, hộp `.ui-dialog-box` rộng tối đa 1180px, bo 14px, đổ bóng `--shadow-dialog`; đầu hộp (tiêu đề 1.25rem/700 + chú thích 13px), thân cuộn riêng, chân nền `--background`.
- `.modal` (cũ): lớp phủ xanh đậm mờ + `backdrop-filter: blur(4px)`, hộp trắng bo 20px, nút đóng tròn 36px.
- `.toast`: góc dưới phải, nền `--success` (lỗi: `--danger`), bo 12px, trượt lên khi hiện.
- Gợi ý tìm kiếm `.ui-dropdown`: bo 12px, tối đa 260px cao, đổ bóng.

### 5.7 Hiệu ứng

`app-fade-up` (0,2s, lên 8px), `app-slide-in` (0,22s, từ phải 24px), `fadeIn` khi đổi trang (0,3s); tắt khi người dùng bật `prefers-reduced-motion`.

---

## 6. Báo cáo và in ấn

- Khổ in: **A4 ngang**, lề 10mm (`@page { size: landscape; margin: 10mm }`). Khi in ẩn menu, nút thao tác, thanh tab, thông báo, thanh gọn bảng; `.main` bỏ lề; chỉ trang đang mở được in.
- Đầu báo cáo `.report-header`: căn giữa, chữ đen; dòng cơ quan chủ quản 12px in hoa, tên đơn vị 14px đậm in hoa, **tiêu đề 20px đậm in hoa**, dòng phụ 15px nghiêng.
- Cuối báo cáo: ghi chú nghiêng 13px, ngày lập căn phải nghiêng 14px, khối ký tên 3 cột (`.signers`): chức danh in hoa đậm, chừa ~60px để ký, họ tên đậm.
- Bảng kê 23,5% (`.bhxh235-*`): rộng tối thiểu 1420px, Times New Roman, viền đen mảnh, tiêu đề 19px in hoa; thanh tóm tắt xanh nhạt chỉ hiện trên màn hình.
- Bảng Excel xuất ra dùng cấu hình trong `excel-layout-presets.js` (mẫu cột/độ rộng/khổ giấy) và `excel-print.js`.

---

## 7. Lớp riêng của từng trang

| Tiền tố / tệp | Trang |
|---|---|
| `emp-*` — `employees.css` | Quản lý nhân viên |
| `ct-*` — `contracts.css` | Hợp đồng lao động (hai cột: form + xem trước) |
| `wi-*`, `ct-grid` — `watch.css` | Nhắc việc, Quy tắc theo dõi |
| `bx-*` — `bhxh.css` | Thành phần dùng chung menu BHXH (thẻ chỉ số, nút lọc) |
| `dc-*` — `doichieubhxh.css` | Biến động lương, Đối chiếu eBH, Biến động người lao động |
| `kt-*` — `bhxh-kiemtra.css` | BHXH › Kiểm tra hồ sơ và ngăn chi tiết bên phải |
| `hs-*` — `people.css` | Nhân sự › Hồ sơ (danh sách 300px bên trái + thẻ chi tiết) |
| `fit-*` — `fit.css` | Trang vừa một màn hình, khối chính tự cuộn bên trong |
| `ov-*` — `overview.css` | Nhân sự › Bảng tổng |

---

## 8. Quy ước khi viết thêm giao diện

1. Màu chỉ lấy từ token ở mục 3; không viết mã hex trong component (trừ phiếu lương theo mục 3.3).
2. Nút, ô nhập, thẻ, nhãn, hộp thoại dùng lớp `ui-*` / `btn-*` ở `ui.css`; CSS riêng của trang đặt ở file riêng và lấy màu từ token.
3. Trang mới bọc trong `.ui-scope` (hoặc dùng `.ui-page`) để nhận font Be Vietnam Pro và token đậm hơn.
4. Số liệu căn phải, `tabular-nums`, định dạng `vi-VN`.
5. Số âm/giảm dùng `--danger` (`.ui-neg`, `.delta-down`), số dương/tăng dùng `--primary` (`.ui-pos`, `.delta-up`).
6. Mọi phần chỉ dành cho màn hình phải ẩn khi in (`.no-print`, `@media print`).
7. Tôn trọng `prefers-reduced-motion`.

---

