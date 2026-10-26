// Chuẩn hóa số phiếu: phiếu nhập luôn có tiền tố "PN", phiếu xuất luôn có "PX"
// (vd "01" -> "PN 01", "PX35" -> "PX 35", "21A" -> "PN 21A").
// Sắp xếp theo số phiếu: so sánh phần số (rồi đến hậu tố chữ), không so theo ngày.

function chuanHoaSoPhieu(loai, soPhieu) {
  const tienTo = loai === 'xuat' ? 'PX' : 'PN';
  let s = String(soPhieu === null || soPhieu === undefined ? '' : soPhieu).trim();
  if (!s) return null;
  s = s.replace(/^số\s*:?\s*/i, '').replace(/^(?:P[NX]\b\s*[-.:]?\s*|P[NX](?=\d))/i, '').trim();
  if (!s) return null;
  return `${tienTo} ${s}`;
}

function khoaSoPhieu(soPhieu) {
  const m = String(soPhieu || '').match(/(\d+)\s*(.*)$/);
  return m ? { so: parseInt(m[1], 10), hauTo: m[2].toUpperCase() } : { so: -1, hauTo: String(soPhieu || '') };
}

// Số phiếu giảm dần (phiếu mới nhất lên đầu); phiếu không có số xuống cuối; bằng nhau thì id giảm dần.
function soSanhSoPhieuGiam(a, b) {
  const ka = khoaSoPhieu(a.so_phieu);
  const kb = khoaSoPhieu(b.so_phieu);
  if (ka.so !== kb.so) return kb.so - ka.so;
  if (ka.hauTo !== kb.hauTo) return ka.hauTo < kb.hauTo ? 1 : -1;
  return b.id - a.id;
}

// Gợi ý số phiếu kế tiếp: lấy số lớn nhất dạng "PN 12" / "PX 12" rồi cộng dần, giữ độ rộng (PN 07, PN 08...).
function goiYSoPhieuKeTiep(loai, cacSoPhieu, soLuong = 5) {
  const tienTo = loai === 'xuat' ? 'PX' : 'PN';
  const mau = loai === 'xuat' ? /^PX\s*(\d+)$/i : /^PN\s*(\d+)$/i;
  let lonNhat = 0;
  let doRong = 2;
  for (const so of cacSoPhieu) {
    const m = mau.exec(String(so || '').trim());
    if (!m) continue;
    lonNhat = Math.max(lonNhat, parseInt(m[1], 10));
    doRong = Math.max(doRong, m[1].length);
  }
  return Array.from({ length: soLuong }, (_, i) => `${tienTo} ${String(lonNhat + i + 1).padStart(doRong, '0')}`);
}

// Các giá trị đã dùng của 1 cột (bỏ trống, bỏ trùng), dùng gần nhất lên đầu — cho dropdown gợi ý trên form.
// bang / cot là hằng số trong mã nguồn, không lấy từ người dùng.
function giaTriDaDung(db, bang, cot) {
  return db
    .prepare(
      `SELECT TRIM(${cot}) AS v FROM ${bang} WHERE ${cot} IS NOT NULL AND TRIM(${cot}) <> ''
       GROUP BY TRIM(${cot}) ORDER BY MAX(id) DESC`
    )
    .all()
    .map((r) => r.v);
}

// Số phiếu đánh lại từ đầu mỗi năm: các số đã dùng trong 1 năm (để gợi ý số kế tiếp).
function soPhieuTrongNam(db, bang, nam) {
  return db.prepare(`SELECT so_phieu FROM ${bang} WHERE substr(ngay, 1, 4) = ?`).all(String(nam)).map((r) => r.so_phieu);
}

// Phiếu đã có cùng số trong cùng năm (bang là hằng số trong mã nguồn). boQuaId: phiếu đang sửa (không tính trùng với
// chính nó). Trả { id, so_phieu, ngay } hoặc null.
function timPhieuTrungSo(db, bang, soPhieu, ngay, boQuaId) {
  if (!soPhieu || !ngay) return null;
  return db.prepare(`SELECT id, so_phieu, ngay FROM ${bang} WHERE so_phieu = ? AND substr(ngay, 1, 4) = ? AND id <> ? LIMIT 1`)
    .get(soPhieu, String(ngay).slice(0, 4), Number(boQuaId) || -1) || null;
}
const loiTrungSo = (p) => `Số phiếu "${p.so_phieu}" đã có trong năm ${String(p.ngay).slice(0, 4)} (phiếu ngày ${String(p.ngay).split('-').reverse().join('/')}). Hãy dùng số khác.`;

module.exports = { chuanHoaSoPhieu, soSanhSoPhieuGiam, goiYSoPhieuKeTiep, giaTriDaDung, soPhieuTrongNam, timPhieuTrungSo, loiTrungSo };
