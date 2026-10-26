// Tiện ích chuỗi / ngày / sắp xếp dùng chung cho các route và service.

// Chuỗi để so khớp tìm kiếm: bỏ dấu tiếng Việt, đ -> d, chữ thường, gộp khoảng trắng
// ("o cam" tìm được "Ổ cắm", "DIEN" tìm được "điện").
function chuoiTim(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

// Ngày hôm nay theo giờ máy chủ (YYYY-MM-DD). Không dùng toISOString(): trước 7h sáng (UTC+7) nó trả về ngày hôm qua.
function homNayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Ngày dạng YYYY-MM-DD và có thật (chặn 2026-02-30, 2026-13-01...).
const RE_NGAY = /^\d{4}-\d{2}-\d{2}$/;
function ngayHopLe(v) {
  if (!RE_NGAY.test(String(v || ''))) return false;
  const d = new Date(v + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// So sánh chuỗi theo tiếng Việt, số trong chuỗi so theo giá trị (TS-2 < TS-10). Dựng 1 lần, nhanh hơn
// nhiều so với gọi localeCompare(..., 'vi', ...) cho từng cặp.
const BO_SO_SANH = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const soSanhVi = (a, b) => BO_SO_SANH.compare(String(a === null || a === undefined ? '' : a), String(b === null || b === undefined ? '' : b));

// Số lượng trong thông báo lỗi: kiểu Việt Nam, tối đa 3 số lẻ (1,5 / 1.250 — không phải 0,30000000000000004).
const soVN = (x) => (Math.round((Number(x) || 0) * 1000) / 1000).toLocaleString('vi-VN');

module.exports = { chuoiTim, homNayISO, ngayHopLe, soSanhVi, soVN };
