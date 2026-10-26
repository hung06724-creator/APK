// Khung mẫu sổ Excel chung cho mọi bản xuất, lấy theo sổ của Trường Cao đẳng nghề Công nghiệp Hà Nội
// (file "TSCĐ 2025 Bản in sổ"): chữ Times New Roman, góc trái "Đơn vị cấp trên / Tên đơn vị", tiêu đề sổ in đậm
// giữa trang, bảng có tiêu đề cột + dòng chỉ số (A, B, 1, 2...), số 0 để trống, khổ A4 ngang,
// cuối sổ là khối ký tên "Người lập biểu — Kế toán trưởng — Hiệu trưởng" (tên lấy từ cấu hình).
const ExcelJS = require('exceljs');

const FONT = 'Times New Roman';
const SO = '[$-1042A]#,##0;(#,##0);""'; // định dạng số của sổ mẫu: số 0 hiện ô trống
const VIEN = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

const ngayVN = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || ''); };

function taoSo() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Quản lý kho vật tư';
  return wb;
}

function tenSheet(ten, daDung) {
  let s = String(ten || 'Sheet').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Sheet';
  // Excel coi "ABC" và "abc" là trùng tên sheet -> so không phân biệt hoa / thường.
  const goc = s;
  let i = 2;
  while (daDung.has(s.toLocaleLowerCase('vi'))) s = `${goc.slice(0, 28)} ${i++}`;
  daDung.add(s.toLocaleLowerCase('vi'));
  return s;
}

function themSheet(wb, ten, daDung, soCot) {
  const ws = wb.addWorksheet(tenSheet(ten, daDung), {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  ws.getColumn(1).width = 1.4; // cột A trống như sổ mẫu
  ws.soCot = soCot; // số cột bảng (bắt đầu từ cột B)
  return ws;
}

function o(ws, r, c, giaTri, kieu = {}) {
  const x = ws.getCell(r, c);
  x.value = giaTri === undefined ? null : giaTri;
  x.font = { name: FONT, size: kieu.size || 10, bold: Boolean(kieu.bold), italic: Boolean(kieu.italic) };
  x.alignment = { horizontal: kieu.h || 'left', vertical: kieu.v || 'middle', wrapText: kieu.wrap !== false };
  if (kieu.vien) x.border = VIEN;
  if (kieu.fmt) x.numFmt = kieu.fmt;
  if (kieu.nen) x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kieu.nen } };
  return x;
}
function gop(ws, r1, c1, r2, c2) { if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2); }

// Đầu sổ: dòng 1 góc trái đơn vị (+ mẫu số bên phải nếu có), tiêu đề, các dòng phụ đề. Trả về dòng kế tiếp.
function dauSo(ws, { cauHinh, tieuDe, phuDe = [], mauSo, truongGoc }) {
  const n = ws.soCot;
  const cuoi = n + 1;
  const ben = Math.max(2, Math.floor(n * 0.6));
  o(ws, 1, 2, `Đơn vị cấp trên: ${cauHinh.don_vi_cap_tren || ''}\nTên đơn vị: ${cauHinh.ten_don_vi_so || cauHinh.ten_don_vi}`
    + (truongGoc ? `\n(Tài sản tiếp nhận từ ${truongGoc})` : ''), { bold: true, size: 11, v: 'top' });
  gop(ws, 1, 2, 1, ben);
  ws.getRow(1).height = truongGoc ? 48 : 33;
  if (mauSo) { o(ws, 1, ben + 1, mauSo, { bold: true, size: 10, h: 'center', v: 'top' }); gop(ws, 1, ben + 1, 1, cuoi); }
  o(ws, 3, 2, tieuDe, { bold: true, size: 13, h: 'center' });
  gop(ws, 3, 2, 3, cuoi);
  ws.getRow(3).height = 20;
  let r = 4;
  for (const p of phuDe) {
    o(ws, r, 2, p.chu || p, { bold: Boolean(p.dam), italic: !p.dam, size: 11, h: p.trai ? 'left' : 'center' });
    gop(ws, r, 2, r, cuoi);
    r++;
  }
  return r + 1;
}

// Tiêu đề bảng 2 tầng + dòng chỉ số. cot: [{ten, nhom?, chiSo, rong}] — "nhom" gộp ô tầng trên cho các cột liền nhau.
function tieuDeBang(ws, r, cot) {
  const coNhom = cot.some((c) => c.nhom);
  cot.forEach((c, i) => {
    const col = i + 2;
    ws.getColumn(col).width = c.rong || 12;
    if (coNhom && c.nhom) {
      o(ws, r + 1, col, c.ten, { bold: true, h: 'center', vien: true });
    } else if (coNhom) {
      o(ws, r, col, c.ten, { bold: true, h: 'center', vien: true });
      o(ws, r + 1, col, null, { vien: true });
      gop(ws, r, col, r + 1, col);
    } else {
      o(ws, r, col, c.ten, { bold: true, h: 'center', vien: true });
    }
  });
  if (coNhom) {
    let i = 0;
    while (i < cot.length) {
      if (cot[i].nhom) {
        let j = i;
        while (j + 1 < cot.length && cot[j + 1].nhom === cot[i].nhom) j++;
        o(ws, r, i + 2, cot[i].nhom, { bold: true, h: 'center', vien: true });
        for (let k = i + 1; k <= j; k++) o(ws, r, k + 2, null, { vien: true });
        gop(ws, r, i + 2, r, j + 2);
        i = j + 1;
      } else i++;
    }
    ws.getRow(r + 1).height = 40;
  } else ws.getRow(r).height = 40;
  const rChiSo = coNhom ? r + 2 : r + 1;
  cot.forEach((c, i) => o(ws, rChiSo, i + 2, c.chiSo === undefined ? '' : c.chiSo, { italic: true, h: 'center', vien: true }));
  ws.views = [{ state: 'frozen', ySplit: rChiSo }]; // giữ tiêu đề bảng khi cuộn
  return rChiSo + 1;
}

// Một dòng dữ liệu. kieu: 'nhom' (đậm, nền nhạt), 'tong' (đậm), mặc định thường.
function dongBang(ws, r, cot, giaTri, kieu) {
  cot.forEach((c, i) => {
    const v = giaTri[i];
    o(ws, r, i + 2, v === undefined ? null : v, {
      size: 9, bold: kieu === 'nhom' || kieu === 'tong', vien: true,
      h: c.h || (typeof v === 'number' ? 'right' : 'left'), fmt: c.fmt || (typeof v === 'number' ? SO : undefined),
      nen: kieu === 'nhom' ? 'FFF2F2F2' : undefined,
    });
  });
}

// Dòng nhóm gộp toàn bộ chiều ngang (vd "Loại công cụ dụng cụ: ...").
function dongTieuDeNhom(ws, r, chu) {
  o(ws, r, 2, chu, { bold: true, italic: true, size: 9, vien: true });
  gop(ws, r, 2, r, ws.soCot + 1);
}

// Ghi chú cuối sổ (mỗi phần tử 1 dòng) rồi khối ký tên. nhan: 3 chức danh. Trả về dòng cuối.
function chanSo(ws, r, { cauHinh, ghiChu = [], nhan, ngayKy, tenKy }) {
  let d = r + 1;
  for (const g of ghiChu) {
    o(ws, d, 2, g, { italic: true, size: 9 });
    gop(ws, d, 2, d, ws.soCot + 1);
    d++;
  }
  const n = ws.soCot;
  const cuoi = n + 1;
  const vt = [[2, Math.max(2, Math.floor(n / 3))], [Math.floor(n / 3) + 2, Math.floor((2 * n) / 3)], [Math.floor((2 * n) / 3) + 1, cuoi]];
  d += 1;
  o(ws, d, vt[2][0], ngayKy || `Ngày ..... tháng ..... năm ${new Date().getFullYear()}`, { italic: true, h: 'center' });
  gop(ws, d, vt[2][0], d, vt[2][1]);
  d++;
  const chucDanh = nhan || ['Người lập biểu', 'Kế toán trưởng', 'Hiệu trưởng'];
  const ky = ['(Ký, họ tên)', '(Ký, họ tên)', '(Ký, họ tên, đóng dấu)'];
  const ten = tenKy || [cauHinh.so_nguoi_lap_bieu, cauHinh.so_ke_toan_truong, cauHinh.so_hieu_truong];
  vt.forEach(([c1, c2], i) => {
    o(ws, d, c1, chucDanh[i], { bold: true, h: 'center' }); gop(ws, d, c1, d, c2);
    o(ws, d + 1, c1, ky[i], { italic: true, h: 'center' }); gop(ws, d + 1, c1, d + 1, c2);
    o(ws, d + 6, c1, ten[i] || '', { bold: true, h: 'center' }); gop(ws, d + 6, c1, d + 6, c2);
  });
  return d + 6;
}

// Bảng đơn giản theo khung mẫu sổ (dùng cho tồn kho, danh sách phiếu...). dong: mảng giá trị theo thứ tự cột.
async function xuatBang({ tenSheet, tieuDe, phuDe, cot, dong, tong, cauHinh }) {
  const wb = taoSo();
  const ws = themSheet(wb, tenSheet || 'Sheet1', new Set(), cot.length);
  let r = dauSo(ws, { cauHinh, tieuDe, phuDe });
  r = tieuDeBang(ws, r, cot);
  for (const d of dong) dongBang(ws, r++, cot, d);
  if (tong) dongBang(ws, r++, cot, tong, 'tong');
  chanSo(ws, r, { cauHinh });
  return wb.xlsx.writeBuffer();
}

module.exports = { FONT, ngayVN, taoSo, themSheet, o, gop, dauSo, tieuDeBang, dongBang, dongTieuDeNhom, chanSo, xuatBang };
