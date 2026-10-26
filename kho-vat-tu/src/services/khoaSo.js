// Khóa sổ theo năm: năm đã khóa thì các nghiệp vụ có ngày trong năm đó (phiếu nhập / xuất, tồn đầu kỳ, ghi tăng /
// ghi giảm tài sản, kiểm kê) không thêm, sửa, xóa được — chỉ còn xem và xuất báo cáo. Mở khóa phải ghi lý do.
const { db } = require('../db');

const LOI_KHOA = 423; // mã HTTP "Locked"

// Năm của ngày dạng YYYY-MM-DD (null nếu trống hoặc sai dạng).
function namCua(ngay) {
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(String(ngay || ''));
  return m ? Number(m[1]) : null;
}

const cacNamKhoa = () => new Set(db.prepare('SELECT nam FROM khoa_so').all().map((r) => r.nam));

// Năm đã khóa đầu tiên mà một trong các ngày rơi vào (bỏ qua ngày trống), hoặc null.
function namKhoaCua(...cacNgay) {
  const khoa = cacNamKhoa();
  if (!khoa.size) return null;
  for (const ngay of cacNgay.flat()) {
    const nam = namCua(ngay);
    if (nam !== null && khoa.has(nam)) return nam;
  }
  return null;
}

// Câu báo lỗi chuẩn khi đụng năm đã khóa (viec: "sửa phiếu nhập", "ghi giảm tài sản"...), hoặc null.
function loiKhoaSo(viec, ...cacNgay) {
  const nam = namKhoaCua(...cacNgay);
  return nam === null ? null
    : `Năm ${nam} đã khóa sổ: không ${viec} có ngày trong năm ${nam}. Cần sửa thì mở khóa năm ${nam} ở mục "Khóa sổ" (phải ghi lý do).`;
}

module.exports = { LOI_KHOA, namCua, cacNamKhoa, namKhoaCua, loiKhoaSo };
