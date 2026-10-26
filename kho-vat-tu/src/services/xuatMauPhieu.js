// Xuất phiếu nhập/xuất kho ra Excel theo mẫu của Phòng Kế hoạch — Tài chính (Mẫu số 01-VT / 02-VT,
// Thông tư số 99/2025/TT-BTC ngày 27/10/2025): font Times New Roman, bố cục, viền, tiêu đề cột như phiếu giấy.
//
// Bản này được làm để TẢI VỀ LÀ IN ĐƯỢC NGAY:
//  - Độ rộng cột số (số lượng, đơn giá, thành tiền) tự nới theo số dài nhất trong phiếu -> không còn "#####".
//  - Định dạng số thường "#,##0" (không dùng định dạng kế toán có ký tự lấp "*" — một số phần mềm hiện thành "******");
//    chỉ hiện phần thập phân khi số thật sự có lẻ.
//  - Khối ký tên chia theo ĐỘ RỘNG THẬT của cột (không chia đều theo số cột), chữ tự xuống dòng, chừa chỗ ký,
//    in tên người ký nếu đã nhập ở "Cấu hình mẫu phiếu".
//  - Trang in: A4 dọc, căn giữa, vừa 1 trang theo chiều ngang (chiều dọc tự sang trang), lặp lại tiêu đề bảng
//    ở mỗi trang, đặt sẵn vùng in.
const ExcelJS = require('exceljs');

const mauDen = { theme: 1 };
const vienMong = { style: 'thin', color: { indexed: 64 } };
const vienMongTheme = { style: 'thin', color: mauDen };
const vienToc = { style: 'hair', color: mauDen };
const vienBox = { left: vienMong, right: vienMong, top: vienMong, bottom: vienMong };

const fontThuong = (tuy = {}) => ({ name: 'Times New Roman', family: 1, color: mauDen, size: 11, ...tuy });
const fontDen = (tuy = {}) => ({ name: 'Times New Roman', family: 1, color: { argb: 'FF000000' }, size: 10, bold: true, ...tuy });

const KIEU = {
  donVi: { font: fontThuong({ bold: true }), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  mauSo: { font: fontThuong({ bold: true, size: 12 }), alignment: { horizontal: 'center', vertical: 'middle' } },
  kemTheo: { font: fontThuong({ bold: true, italic: true, size: 10 }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
  tieuDe: { font: fontThuong({ bold: true, size: 16 }), alignment: { horizontal: 'center', vertical: 'middle' } },
  ngay: { font: fontThuong({ italic: true, size: 12 }), alignment: { horizontal: 'center' } },
  soPhieu: { font: fontThuong({ bold: true, size: 10 }), alignment: { horizontal: 'left', vertical: 'middle' } },
  nguoiNhap: { font: fontThuong(), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  lyDo: { font: fontThuong(), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  noiKho: { font: fontThuong(), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  diaDiem: { font: fontThuong(), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  thTieuDe: { font: fontThuong({ bold: true, size: 10 }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: vienBox },
  thChiSo: { font: fontThuong({ size: 10, italic: true }), alignment: { horizontal: 'center', vertical: 'middle' }, border: vienBox },
  bangChu: { font: fontThuong({ bold: true, italic: true }), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  chungTuGoc: { font: fontThuong({ bold: true }), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  nhanKy: { font: fontThuong({ bold: true }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
  chuKy: { font: fontThuong({ italic: true, size: 10 }), alignment: { horizontal: 'center', vertical: 'top', wrapText: true } },
  tenKy: { font: fontThuong({ bold: true }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
};

// ---------- Định dạng số ----------
const laSo = (v) => typeof v === 'number' && Number.isFinite(v);
const coLe = (v) => laSo(v) && Math.abs(v - Math.round(v)) > 1e-9;
function dinhDangSo(v, toiDaLe = 2) {
  if (!laSo(v)) return undefined;
  if (!coLe(v)) return '#,##0';
  return toiDaLe >= 3 ? '#,##0.###' : '#,##0.00';
}
// Chuỗi hiển thị (để ước độ rộng cột) — khớp định dạng ở trên.
function chuoiSo(v, toiDaLe = 2) {
  if (!laSo(v)) return String(v ?? '');
  const so = coLe(v) ? (toiDaLe >= 3 ? Math.round(v * 1000) / 1000 : v.toFixed(2)) : Math.round(v);
  return Number(so).toLocaleString('en-US', { minimumFractionDigits: coLe(v) && toiDaLe < 3 ? 2 : 0, maximumFractionDigits: toiDaLe });
}

// ---------- Tiện ích ô ----------
function datO(ws, diaChi, giaTri, kieu) {
  const cell = ws.getCell(diaChi);
  cell.value = giaTri === undefined ? null : giaTri;
  Object.assign(cell, kieu);
  return cell;
}
const chuCot = (so) => String.fromCharCode(64 + so); // 1 -> A
// Ước số dòng chữ khi xuống dòng trong vùng rộng `rong` (đơn vị độ rộng cột Excel ~ 1 ký tự cỡ 11).
function soDongChu(text, rong, coChu = 11) {
  const kyTuMotDong = Math.max(4, Math.floor((rong * 11) / coChu * 0.95));
  return String(text || '').split('\n').reduce((s, d) => s + Math.max(1, Math.ceil(d.length / kyTuMotDong)), 0);
}
const caoDong = (soDong, coChu = 11, toiThieu = 15.75) => Math.max(toiThieu, soDong * (coChu * 1.35) + 3);

// ---------- Khối ký tên ----------
// Chia các cột A..I thành N cụm liền nhau theo ĐỘ RỘNG THẬT: chọn cách chia có cụm hẹp nhất là rộng nhất
// (để chức danh nào cũng đủ chỗ), hòa thì chọn cách có cụm rộng nhất là hẹp nhất (cân đối hơn).
function chiaCumTheoDoRong(doRong, n) {
  const m = doRong.length;
  n = Math.max(1, Math.min(n, m));
  const tien = [0];
  doRong.forEach((w) => tien.push(tien[tien.length - 1] + w));
  const rong = (a, b) => tien[b] - tien[a]; // cột a..b-1 (0-based, b loại trừ)
  const nho = new Map();
  // tot(i, k): chia cột i..m-1 cho k người -> { min, max, cat: [vị trí cắt] }
  const tot = (i, k) => {
    const khoa = `${i}|${k}`;
    if (nho.has(khoa)) return nho.get(khoa);
    let kq;
    if (k === 1) kq = { min: rong(i, m), max: rong(i, m), cat: [] };
    else {
      for (let j = i + 1; j <= m - (k - 1); j++) {
        const sau = tot(j, k - 1);
        const ung = { min: Math.min(rong(i, j), sau.min), max: Math.max(rong(i, j), sau.max), cat: [j, ...sau.cat] };
        if (!kq || ung.min > kq.min + 1e-9 || (Math.abs(ung.min - kq.min) < 1e-9 && ung.max < kq.max)) kq = ung;
      }
    }
    nho.set(khoa, kq);
    return kq;
  };
  const diem = [0, ...tot(0, n).cat, m];
  return diem.slice(0, -1).map((a, i) => ({ start: a + 1, end: diem[i + 1] }));
}

// Ô tên của "Người giao hàng" / "Người nhận hàng" để trống trong cấu hình = tự lấy người ghi trên từng phiếu.
const laNguoiTheoPhieu = (chucDanh) => /người\s+(giao|nhận)\s+hàng/i.test(chucDanh);

function vietKhoiKy(ws, r, doRong, chucDanhCsv, tenCsv, nguoiTrenPhieu) {
  const ds = String(chucDanhCsv || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ds.length) return r;
  const tenCauHinh = String(tenCsv || '').split(',').map((s) => s.trim());
  const tenDs = ds.map((cd, i) => tenCauHinh[i] || (laNguoiTheoPhieu(cd) ? String(nguoiTrenPhieu || '').trim() : ''));
  const coTen = tenDs.some(Boolean);
  const cum = chiaCumTheoDoRong(doRong, ds.length);
  let dongNhan = 1;
  let dongTen = 1;
  ds.forEach((cd, i) => {
    const { start, end } = cum[i];
    const rong = doRong.slice(start - 1, end).reduce((a, b) => a + b, 0);
    dongNhan = Math.max(dongNhan, soDongChu(cd, rong));
    dongTen = Math.max(dongTen, soDongChu(tenDs[i], rong));
    const gop = (hang) => { if (end > start) ws.mergeCells(`${chuCot(start)}${hang}:${chuCot(end)}${hang}`); };
    gop(r); datO(ws, `${chuCot(start)}${r}`, cd, KIEU.nhanKy);
    gop(r + 1); datO(ws, `${chuCot(start)}${r + 1}`, '(Ký, họ tên)', KIEU.chuKy);
    gop(r + 2); datO(ws, `${chuCot(start)}${r + 2}`, coTen ? (tenDs[i] || '') : '', KIEU.tenKy);
  });
  ws.getRow(r).height = caoDong(dongNhan);
  ws.getRow(r + 1).height = 62; // chỗ ký
  ws.getRow(r + 2).height = caoDong(dongTen, 11, 18); // tên dài (vd "Hoàng Thị Minh Phương") tự xuống dòng, không bị che
  return r + 3;
}

function dinhDangNgay(ngayISO) {
  if (!ngayISO) return 'Ngày ….. tháng ….. năm ……..';
  const [y, m, d] = ngayISO.split('-');
  return `Ngày ${d} tháng ${m} năm ${y}`;
}

function taoFilePhieu(phieu, items, loai, cauHinh = {}) {
  const laNhap = loai === 'nhap';
  const ch = {
    ten_don_vi: 'Trường cao đẳng nghề công nghiệp Hà Nội',
    bo_phan: 'Phòng Kế hoạch- Tài chính',
    ghi_chu_thong_tu: '( Kèm theo Thông tư số 99/2025/TT-BTC',
    ghi_chu_thong_tu_2: 'ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính',
    nguoi_ky_nhap: 'Người lập phiếu, Người giao hàng, Thủ kho, Kế toán trưởng',
    nguoi_ky_xuat: 'Người lập phiếu, Người nhận hàng, Thủ kho, Kế toán trưởng, P. Hiệu trưởng',
    ten_nguoi_ky_nhap: '',
    ten_nguoi_ky_xuat: '',
    ...cauHinh,
  };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(laNhap ? 'Phiếu nhập kho' : 'Phiếu xuất kho', {
    pageSetup: {
      paperSize: 9, orientation: 'portrait', horizontalCentered: true,
      fitToPage: true, fitToWidth: 1, fitToHeight: 0, // vừa 1 trang ngang, chiều dọc tự sang trang
      margins: { left: 0.45, right: 0.35, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 },
    },
    headerFooter: { oddFooter: `&C&"Times New Roman,Italic"&9${laNhap ? 'Phiếu nhập kho' : 'Phiếu xuất kho'} ${phieu.so_phieu || ''} — Trang &P/&N` },
  });

  // ---- Độ rộng cột: nền theo mẫu, nới các cột số theo số dài nhất ----
  const slCt = (it) => (laNhap ? it.sl_chung_tu : it.sl_yeu_cau);
  const slTt = (it) => (laNhap ? it.sl_thuc_nhap : it.sl_thuc_xuat);
  const dai = (arr, le) => arr.reduce((m, v) => Math.max(m, chuoiSo(v, le).length), 0);
  const doRong = [5, 30, 8, 6.5, 8, 8, 11, 13, 10]; // A STT, B tên, C mã, D ĐVT, E/F số lượng, G đơn giá, H thành tiền, I ghi chú
  doRong[4] = Math.max(doRong[4], dai(items.map(slCt), 3) + 2);
  doRong[5] = Math.max(doRong[5], dai(items.map(slTt), 3) + 2);
  doRong[6] = Math.max(doRong[6], dai(items.map((it) => it.don_gia), 2) + 2);
  doRong[7] = Math.max(doRong[7], dai([...items.map((it) => it.thanh_tien), phieu.tong_tien_hang, phieu.tien_thue, phieu.tong_cong], 2) + 3);
  doRong[2] = Math.max(doRong[2], Math.min(14, dai(items.map((it) => it.ma_so || ''), 0) + 2));
  // ExcelJS bỏ qua cột có độ rộng đúng 9 (coi là mặc định) -> nhích nhẹ để cột nào cũng được ghi độ rộng.
  ws.columns = doRong.map((width) => ({ width: width === 9 ? 9.01 : width }));
  const rongTu = (a, b) => doRong.slice(a - 1, b).reduce((s, x) => s + x, 0);

  // ---- Khối đầu phiếu ----
  ws.mergeCells('A1:D1'); datO(ws, 'A1', `Đơn vị: ${ch.ten_don_vi}`, KIEU.donVi);
  ws.mergeCells('E1:I1'); datO(ws, 'E1', laNhap ? 'Mẫu số 01-VT' : 'Mẫu số 02-VT', KIEU.mauSo);
  ws.mergeCells('A2:D2'); datO(ws, 'A2', `Bộ phận: ${ch.bo_phan}`, KIEU.donVi);
  ws.mergeCells('E2:I2'); datO(ws, 'E2', ch.ghi_chu_thong_tu, KIEU.kemTheo);
  ws.mergeCells('E3:I3'); datO(ws, 'E3', ch.ghi_chu_thong_tu_2, KIEU.kemTheo);
  ws.getRow(1).height = caoDong(soDongChu(`Đơn vị: ${ch.ten_don_vi}`, rongTu(1, 4)));
  ws.getRow(2).height = caoDong(Math.max(soDongChu(`Bộ phận: ${ch.bo_phan}`, rongTu(1, 4)), soDongChu(ch.ghi_chu_thong_tu, rongTu(5, 9), 10)));
  ws.getRow(3).height = caoDong(soDongChu(ch.ghi_chu_thong_tu_2, rongTu(5, 9), 10), 10);
  ws.mergeCells('A4:I4'); datO(ws, 'A4', laNhap ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO', KIEU.tieuDe);
  ws.getRow(4).height = 24;
  ws.mergeCells('A5:I5'); datO(ws, 'A5', dinhDangNgay(phieu.ngay), KIEU.ngay);
  ws.mergeCells('G6:I6'); datO(ws, 'G6', `Số: ${phieu.so_phieu || ''}`, KIEU.soPhieu);
  ws.mergeCells('G7:I7'); datO(ws, 'G7', `Nợ: ${phieu.no_tk || ''}`, KIEU.soPhieu);
  ws.mergeCells('G8:I8'); datO(ws, 'G8', `Có: ${phieu.co_tk || ''}`, KIEU.soPhieu);

  const tenNguoi = laNhap ? phieu.nguoi_nhap || '' : phieu.nguoi_nhan || '';
  const dongNguoi = `${laNhap ? 'Họ và tên người nhập' : 'Họ và tên người nhận hàng'}: ${tenNguoi}        Đơn vị: ${phieu.don_vi || ''}`;
  ws.mergeCells('A9:I9'); datO(ws, 'A9', dongNguoi, KIEU.nguoiNhap);
  ws.getRow(9).height = caoDong(soDongChu(dongNguoi, rongTu(1, 9)));
  const dongLyDo = laNhap ? (phieu.ly_do_nhap || '') : `Lý do xuất kho: ${phieu.ly_do_xuat || ''}`;
  ws.mergeCells('A10:I10'); datO(ws, 'A10', dongLyDo, KIEU.lyDo);
  ws.getRow(10).height = caoDong(soDongChu(dongLyDo, rongTu(1, 9)));
  const dongNoiKho = laNhap ? `Nhập tại kho: ${phieu.nhap_tai_kho || ''}` : `Xuất tại kho: ${phieu.xuat_tai_kho || ''}`;
  const dongDiaDiem = `Địa điểm: ${phieu.dia_diem || ''}`;
  ws.mergeCells('A11:E11'); datO(ws, 'A11', dongNoiKho, KIEU.noiKho);
  ws.mergeCells('F11:I11'); datO(ws, 'F11', dongDiaDiem, KIEU.diaDiem);
  ws.getRow(11).height = caoDong(Math.max(soDongChu(dongNoiKho, rongTu(1, 5)), soDongChu(dongDiaDiem, rongTu(6, 9))));

  // ---- Tiêu đề bảng hàng hóa (lặp lại ở đầu mỗi trang in) ----
  ws.mergeCells('A12:A13'); ws.mergeCells('B12:B13'); ws.mergeCells('C12:C13'); ws.mergeCells('D12:D13');
  ws.mergeCells('E12:F12'); ws.mergeCells('G12:G13'); ws.mergeCells('H12:H13'); ws.mergeCells('I12:I13');
  datO(ws, 'A12', 'STT', KIEU.thTieuDe);
  datO(ws, 'B12', 'Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá', KIEU.thTieuDe);
  datO(ws, 'C12', 'Mã số', KIEU.thTieuDe);
  datO(ws, 'D12', 'ĐVT', KIEU.thTieuDe);
  datO(ws, 'E12', 'Số lượng', KIEU.thTieuDe);
  datO(ws, 'G12', 'Đơn giá', KIEU.thTieuDe);
  datO(ws, 'H12', 'Thành tiền', KIEU.thTieuDe);
  datO(ws, 'I12', 'Ghi chú', KIEU.thTieuDe);
  datO(ws, 'E13', laNhap ? 'Theo chứng từ' : 'Yêu cầu', KIEU.thTieuDe);
  datO(ws, 'F13', laNhap ? 'Thực nhập' : 'Thực xuất', KIEU.thTieuDe);
  ['F12', 'A13', 'B13', 'C13', 'D13', 'G13', 'H13', 'I13'].forEach((d) => { ws.getCell(d).border = vienBox; });
  ['A', 'B', 'C', 'D'].forEach((c) => datO(ws, `${c}14`, c, KIEU.thChiSo));
  [1, 2, 3, 4, 5].forEach((n, i) => datO(ws, `${String.fromCharCode(69 + i)}14`, n, KIEU.thChiSo));
  ws.getRow(12).height = 18;
  ws.getRow(13).height = caoDong(Math.max(soDongChu('Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá', doRong[1], 10), 2), 10);
  ws.getRow(14).height = 15;

  // ---- Dòng hàng hóa ----
  let r = 15;
  const font10 = fontThuong({ size: 10 });
  items.forEach((it, idx) => {
    const top = idx === 0 ? vienMong : vienToc;
    const bottom = idx === items.length - 1 ? vienMong : vienToc;
    const vien = { left: vienMongTheme, right: vienMongTheme, top, bottom };
    const o = (cot, v, align, fmt) => datO(ws, `${cot}${r}`, v, { font: font10, border: vien, alignment: { vertical: 'middle', wrapText: true, ...align }, ...(fmt ? { numFmt: fmt } : {}) });
    o('A', it.stt, { horizontal: 'center' });
    o('B', it.ten_hang, { horizontal: 'left' });
    o('C', it.ma_so || '', { horizontal: 'center' });
    o('D', it.dvt || '', { horizontal: 'center' });
    o('E', slCt(it), { horizontal: 'right', wrapText: false }, dinhDangSo(slCt(it), 3));
    o('F', slTt(it), { horizontal: 'right', wrapText: false }, dinhDangSo(slTt(it), 3));
    o('G', it.don_gia, { horizontal: 'right', wrapText: false }, dinhDangSo(it.don_gia));
    o('H', it.thanh_tien, { horizontal: 'right', wrapText: false }, dinhDangSo(it.thanh_tien));
    o('I', it.ghi_chu || '', { horizontal: 'left' });
    const dong = Math.max(soDongChu(it.ten_hang, doRong[1], 10), soDongChu(it.ghi_chu, doRong[8], 10), soDongChu(it.ma_so, doRong[2], 10));
    ws.getRow(r).height = caoDong(dong, 10);
    r++;
  });

  // ---- Tổng / thuế / tổng cộng (viền đủ cả dòng) ----
  const dongTong = (nhan, giaTri) => {
    for (let c = 1; c <= 9; c++) ws.getCell(r, c).border = vienBox;
    ws.mergeCells(`B${r}:G${r}`);
    datO(ws, `B${r}`, nhan, { font: fontDen(), alignment: { horizontal: 'left', vertical: 'middle' }, border: vienBox });
    datO(ws, `H${r}`, laSo(giaTri) ? giaTri : 0, { font: fontDen(), alignment: { horizontal: 'right', vertical: 'middle' }, border: vienBox, numFmt: dinhDangSo(laSo(giaTri) ? giaTri : 0) });
    ws.getRow(r).height = 17;
    r++;
  };
  dongTong('Tổng', phieu.tong_tien_hang);
  dongTong(`Thuế ${phieu.thue_suat || 0} %`, phieu.tien_thue);
  dongTong('Tổng cộng', phieu.tong_cong);

  const dongBangChu = `Tổng số tiền (viết bằng chữ): ${phieu.tong_bang_chu || ''}./.`;
  ws.mergeCells(`A${r}:I${r}`); datO(ws, `A${r}`, dongBangChu, KIEU.bangChu);
  ws.getRow(r).height = caoDong(soDongChu(dongBangChu, rongTu(1, 9)));
  r++;
  const dongChungTu = `Số chứng từ gốc kèm theo: ${phieu.so_chung_tu_goc || ''}`;
  ws.mergeCells(`A${r}:I${r}`); datO(ws, `A${r}`, dongChungTu, KIEU.chungTuGoc);
  ws.getRow(r).height = caoDong(soDongChu(dongChungTu, rongTu(1, 9)));
  r++; // khối ký tên nằm ngay sau (đúng theo mẫu gốc)

  const rCuoi = vietKhoiKy(ws, r, doRong, laNhap ? ch.nguoi_ky_nhap : ch.nguoi_ky_xuat,
    laNhap ? ch.ten_nguoi_ky_nhap : ch.ten_nguoi_ky_xuat, tenNguoi) - 1;
  ws.pageSetup.printArea = `A1:I${rCuoi}`;
  ws.pageSetup.printTitlesRow = '12:14';
  return wb;
}

module.exports = { taoFilePhieu };
