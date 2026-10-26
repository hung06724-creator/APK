// Nạp tồn đầu kỳ từ file "Danh sách vật tư tồn âm" (sheet "Tổng hợp") sau khi kế toán điền cột
// "Kế toán xác nhận tồn đầu kỳ" (Số lượng, Đơn giá). Khớp vật tư theo tên (không phân biệt hoa/thường, Đ/D).
const ExcelJS = require('exceljs');
const { db, khoaTenVatTu } = require('../db');

function giaTri(cell) {
  let v = cell.value;
  if (v && typeof v === 'object') {
    if (v.richText) v = v.richText.map((t) => t.text).join('');
    else if ('result' in v) v = v.result;
    else if (v instanceof Date) v = v.toISOString().slice(0, 10);
    else v = null;
  }
  return v;
}
const chu = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const { chuoiTim: chuan } = require('./tienIch'); // bỏ dấu, đ -> d, chữ thường
function so(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = chu(v).replace(/\s/g, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ''));
  if (/^-?\d+([.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return NaN;
}

// Trả { dong: [...], canhBao: [...] }. Mỗi dòng: { dongExcel, ten, nhom, vat_tu_id, ten_kho, so_luong, don_gia,
// don_gia_de_xuat, ton_hien_tai, ton_sau, dau_ky_cu, loi, canh_bao }
async function docFile(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.getWorksheet('Tổng hợp') || wb.worksheets[0];
  if (!ws) throw Object.assign(new Error('File không có sheet nào'), { status: 400 });

  // Tìm dòng tiêu đề: có ô "Tên vật tư, hàng hóa" và ô nhóm "Kế toán xác nhận tồn đầu kỳ".
  let rTieuDe = null; let cTen = null; let cXacNhan = null; let cDeXuatGia = null; let cNhom = null;
  for (let r = 1; r <= Math.min(40, ws.rowCount) && !rTieuDe; r++) {
    ws.getRow(r).eachCell((cell, c) => {
      const t = chuan(giaTri(cell));
      if (t.startsWith('ten vat tu') && !cTen) cTen = c;
      if (t.startsWith('ke toan xac nhan ton dau ky') && !cXacNhan) cXacNhan = c;
      if (t.startsWith('de xuat bo sung') && !cDeXuatGia) cDeXuatGia = c; // cụm đề xuất: SL, Đơn giá, Thành tiền
      if (t === 'nhom' && !cNhom) cNhom = c;
    });
    if (cTen && cXacNhan) rTieuDe = r;
  }
  if (!rTieuDe) {
    throw Object.assign(new Error('Không thấy cột "Tên vật tư, hàng hóa" và cụm cột "Kế toán xác nhận tồn đầu kỳ" — hãy dùng đúng file "Danh sách vật tư tồn âm" xuất từ phần mềm.'), { status: 400 });
  }
  // Dòng tiêu đề con (Số lượng / Đơn giá) nằm ngay dưới; cột Số lượng = cột đầu của cụm, Đơn giá = cột kế tiếp.
  const cSl = cXacNhan;
  const cGia = cXacNhan + 1;
  const cGiaDeXuat = cDeXuatGia ? cDeXuatGia + 1 : null;

  const vatTuTheoKhoa = new Map();
  for (const v of db.prepare('SELECT id, ten_hang, ten_khoa FROM vat_tu').all()) {
    if (!vatTuTheoKhoa.has(v.ten_khoa)) vatTuTheoKhoa.set(v.ten_khoa, v);
  }
  const tonHienTai = db.prepare(`SELECT COALESCE((SELECT SUM(sl_thuc_nhap) FROM phieu_nhap_items WHERE vat_tu_id = @id), 0)
    - COALESCE((SELECT SUM(sl_thuc_xuat) FROM phieu_xuat_items WHERE vat_tu_id = @id), 0) AS nx,
    (SELECT so_luong FROM ton_dau_ky WHERE vat_tu_id = @id) AS dk`);

  const dong = [];
  const daGap = new Map();
  for (let r = rTieuDe + 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const ten = chu(giaTri(row.getCell(cTen)));
    const slRaw = giaTri(row.getCell(cSl));
    const giaRaw = giaTri(row.getCell(cGia));
    // bỏ dòng chỉ số (A, B, 1...), dòng tiêu đề nhóm, dòng cộng, ghi chú, khối ký tên
    if (/^cong/.test(chuan(ten))) break; // hết bảng — phía dưới là ghi chú + khối ký tên
    if (!ten || ten.length <= 2 || /^(nhom [ab]|tong|nguoi lap|ke toan|hieu truong|\(ky)/.test(chuan(ten)) || /^- /.test(ten)) continue;
    const sl = so(slRaw);
    const gia = so(giaRaw);
    if (sl === null && gia === null) continue; // kế toán không điền -> bỏ qua dòng này
    const d = { dongExcel: r, ten, nhom: cNhom ? chu(giaTri(row.getCell(cNhom))) : '', so_luong: sl, don_gia: gia, loi: null, canh_bao: [] };
    d.don_gia_de_xuat = cGiaDeXuat ? so(giaTri(row.getCell(cGiaDeXuat))) : null;
    const v = vatTuTheoKhoa.get(khoaTenVatTu(ten));
    if (!v) d.loi = 'Không tìm thấy vật tư này trong kho (tên đã bị sửa?)';
    else if (sl === null || Number.isNaN(sl)) d.loi = 'Số lượng xác nhận để trống hoặc không phải số';
    else if (sl < 0) d.loi = 'Số lượng tồn đầu kỳ không được âm';
    else if (Number.isNaN(gia) || (gia !== null && gia < 0)) d.loi = 'Đơn giá không hợp lệ';
    if (v) {
      d.vat_tu_id = v.id;
      d.ten_kho = v.ten_hang;
      if (daGap.has(v.id)) d.loi = d.loi || `Trùng với dòng ${daGap.get(v.id)} trong file`;
      daGap.set(v.id, r);
      const t = tonHienTai.get({ id: v.id });
      d.dau_ky_cu = t.dk;
      d.ton_hien_tai = (t.dk || 0) + t.nx;
      if (!d.loi) d.ton_sau = sl + t.nx;
    }
    if (!d.loi) {
      if (gia === null) {
        if (d.don_gia_de_xuat > 0) { d.don_gia = d.don_gia_de_xuat; d.canh_bao.push('Chưa điền đơn giá — lấy đơn giá đề xuất'); } else d.canh_bao.push('Chưa có đơn giá');
      }
      if (d.nhom === 'B') d.canh_bao.push('Vật tư nhóm B (nghi phiếu xuất ghi trùng) — chỉ nạp nếu đã đối chiếu chứng từ');
      if (d.dau_ky_cu !== null && d.dau_ky_cu !== undefined) d.canh_bao.push(`Đã có tồn đầu kỳ ${d.dau_ky_cu} — sẽ được thay bằng số mới`);
      if (d.ton_sau < 0) d.canh_bao.push(`Sau khi nạp vẫn còn âm ${d.ton_sau}`);
    }
    dong.push(d);
  }
  return { dong };
}

// Ghi các dòng hợp lệ (upsert theo vật tư). Trả số dòng đã ghi.
function ghi(dong, ngay, nguon) {
  const up = db.prepare(`INSERT INTO ton_dau_ky (vat_tu_id, ngay, so_luong, don_gia, ghi_chu, nguon)
    VALUES (@vat_tu_id, @ngay, @so_luong, @don_gia, @ghi_chu, @nguon)
    ON CONFLICT(vat_tu_id) DO UPDATE SET ngay = excluded.ngay, so_luong = excluded.so_luong, don_gia = excluded.don_gia,
      ghi_chu = excluded.ghi_chu, nguon = excluded.nguon, updated_at = datetime('now')`);
  let n = 0;
  db.transaction(() => {
    for (const d of dong) {
      if (d.loi) continue;
      up.run({ vat_tu_id: d.vat_tu_id, ngay, so_luong: d.so_luong, don_gia: d.don_gia ?? null, ghi_chu: d.canh_bao.join('; ') || null, nguon });
      n++;
    }
  })();
  return n;
}

module.exports = { docFile, ghi };
