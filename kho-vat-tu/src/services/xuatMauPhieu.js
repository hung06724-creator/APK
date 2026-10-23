// Xuất phiếu nhập/xuất kho ra file Excel ĐÚNG Y HỆT mẫu gốc của Phòng Kế hoạch — Tài
// chính (Mẫu số 01-VT / 02-VT, Thông tư số 99/2025/TT-BTC ngày 27/10/2025). Toàn bộ
// font chữ, cỡ chữ, viền, căn lề, định dạng số dưới đây được lấy nguyên văn từ file
// mẫu gốc (không phải tự ước lượng) để khi in ra giống hệt phiếu giấy đang dùng.
const ExcelJS = require('exceljs');

const TEN_DON_VI = 'Trường cao đẳng nghề công nghiệp Hà Nội';
const BO_PHAN = 'Phòng Kế hoạch- Tài chính';
const GHI_CHU_TT = '( Kèm theo Thông tư số 99/2025/TT-BTC';
const GHI_CHU_TT_2 = 'ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính';

const NUMFMT_INT = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';
const NUMFMT_GIA = '#,##0.00';
const NUMFMT_TIEN = '#,##0';

const mauDen = { theme: 1 };
const vienMong64 = { style: 'thin', color: { indexed: 64 } };
const vienMongTheme = { style: 'thin', color: mauDen };
const vienToc = { style: 'hair', color: mauDen };
const vienBox = { left: vienMong64, right: vienMong64, top: vienMong64, bottom: vienMong64 };

const fontThuong = (tuy = {}) => ({ name: 'Times New Roman', family: 1, color: mauDen, size: 11, ...tuy });
const fontDen = (tuy = {}) => ({ name: 'Times New Roman', family: 1, color: { argb: 'FF000000' }, size: 10, bold: true, ...tuy });

const KIEU = {
  donVi: { font: fontThuong({ bold: true }), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  mauSo: { font: fontThuong({ bold: true, size: 12 }), alignment: { horizontal: 'center', vertical: 'middle' } },
  kemTheo: { font: fontThuong({ bold: true, italic: true }), alignment: { horizontal: 'center', vertical: 'middle' } },
  tieuDe: { font: fontThuong({ bold: true, size: 16 }), alignment: { horizontal: 'center', vertical: 'middle' } },
  ngay: { font: fontThuong({ italic: true, size: 12 }), alignment: { horizontal: 'center' } },
  soPhieuGoc: { font: fontThuong({ bold: true, size: 10 }) },
  noCo: { font: fontThuong({ bold: true, size: 10 }), alignment: { horizontal: 'left' } },
  nguoiNhap: { font: fontThuong(), alignment: { vertical: 'middle' } },
  lyDoNhap: { font: fontThuong(), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } },
  lyDoXuat: { font: fontThuong(), alignment: { horizontal: 'left', vertical: 'middle', wrapText: true } },
  noiKho: { font: fontThuong(), alignment: { horizontal: 'left', vertical: 'top', wrapText: true } },
  diaDiem: { font: fontThuong(), alignment: { horizontal: 'center' }, border: { bottom: vienMong64 } },
  thTieuDe: { font: fontThuong({ bold: true }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: vienBox },
  thChiSo: { font: fontThuong({ size: 11 }), alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: vienBox },
  bangChu: { font: fontThuong({ bold: true, italic: true }), alignment: { horizontal: 'left', vertical: 'middle' }, border: { top: vienMong64 } },
  chungTuGoc: { font: fontThuong({ bold: true }), alignment: { horizontal: 'left', vertical: 'middle' } },
  nhanKy: { font: fontThuong({ bold: true }), alignment: { horizontal: 'center' } },
};

function vienDongHang(viTri) {
  // viTri: 'dau' | 'giua' | 'cuoi' — dòng hàng hóa đầu tiên viền trên dày, giữa viền
  // tóc cả trên dưới, dòng cuối viền dưới dày để khép bảng trước phần tổng.
  const top = viTri === 'dau' ? vienMong64 : vienToc;
  const bottom = viTri === 'cuoi' ? vienMong64 : vienToc;
  return { left: vienMongTheme, right: vienMongTheme, top, bottom };
}

function oDongHang(cot, viTri) {
  const vien = vienDongHang(viTri);
  const font = fontThuong({ size: 10 });
  switch (cot) {
    case 1: return { font, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: vien };
    case 2: return { font, alignment: { horizontal: 'left', vertical: 'middle' }, border: vien };
    case 3: return { font, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: vien };
    case 4: return { font, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: vien };
    case 5: case 6: return { font, alignment: { horizontal: 'center', vertical: 'middle' }, border: vien, numFmt: NUMFMT_INT };
    case 7: return { font, alignment: { horizontal: 'right', vertical: 'middle', indent: 1 }, border: vien, numFmt: NUMFMT_GIA };
    case 8: return { font, alignment: { vertical: 'middle' }, border: vien, numFmt: NUMFMT_TIEN };
    case 9: return { font, alignment: { vertical: 'middle' }, border: vien };
    default: return { font, border: vien };
  }
}

function dongTong() {
  return { font: fontDen(), alignment: { vertical: 'middle', wrapText: true }, border: vienBox };
}
function dongTongVal() {
  return { font: fontDen(), alignment: { horizontal: 'center', vertical: 'middle' }, border: vienBox, numFmt: NUMFMT_INT };
}

const NHAN_KY_NHAP = ' Người lập phiếu                         Người giao hàng                               Thủ kho                             Kế toán trưởng';
const KY_HO_TEN_NHAP = '( Ký , họ tên)                                ( Ký , họ tên)                           ( Ký , họ tên)                             ( Ký , họ tên)                    ';
const NHAN_KY_XUAT = ' Người lập phiếu     Người nhận hàng              Thủ kho                Kế toán trưởng                     P. Hiệu trưởng ';
const KY_HO_TEN_XUAT = '( Ký , họ tên)         ( Ký , họ tên)                ( Ký , họ tên)                ( Ký , họ tên)                         ( Ký , họ tên)      ';

function datO(ws, diaChi, giaTri, kieu) {
  const cell = ws.getCell(diaChi);
  cell.value = giaTri;
  Object.assign(cell, kieu);
  return cell;
}

function taoFilePhieu(phieu, items, loai) {
  const laNhap = loai === 'nhap';
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(laNhap ? 'Phiếu nhập kho' : 'Phiếu xuất kho', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  const doRong = laNhap
    ? [3.33, 27.66, 5.11, 4.55, 5.66, 4.89, 9.11, 9.55, 8.22]
    : [4, 25.66, 5.11, 6.33, 6.78, 6.55, 7.66, 9.33, 10.78];
  ws.columns = doRong.map((width) => ({ width }));

  // ---- Khối đầu phiếu ----
  ws.mergeCells('A1:D1'); datO(ws, 'A1', `Đơn vị: ${TEN_DON_VI}`, KIEU.donVi);
  ws.mergeCells('E1:I1'); datO(ws, 'E1', laNhap ? 'Mẫu số 01-VT' : 'Mẫu số 02-VT', KIEU.mauSo);
  ws.mergeCells('A2:D2'); datO(ws, 'A2', `Bộ phận: ${BO_PHAN}`, KIEU.donVi);
  ws.mergeCells('E2:I2'); datO(ws, 'E2', GHI_CHU_TT, KIEU.kemTheo);
  ws.mergeCells('E3:I3'); datO(ws, 'E3', GHI_CHU_TT_2, KIEU.kemTheo);
  ws.mergeCells('A4:I4'); datO(ws, 'A4', laNhap ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO', KIEU.tieuDe);
  ws.mergeCells('A5:I5'); datO(ws, 'A5', dinhDangNgay(phieu.ngay), KIEU.ngay);
  datO(ws, 'G6', `Số: ${phieu.so_phieu || ''}`, KIEU.soPhieuGoc);
  datO(ws, 'G7', `Nợ : ${phieu.no_tk || ''}`, KIEU.noCo);
  datO(ws, 'G8', `Có : ${phieu.co_tk || ''}`, KIEU.noCo);

  const tenNguoi = laNhap ? phieu.nguoi_nhap || '' : phieu.nguoi_nhan || '';
  datO(ws, 'A9', `Họ và tên người nhập: ${tenNguoi}            Đơn vị : ${phieu.don_vi || ''}`, KIEU.nguoiNhap);

  ws.mergeCells('A10:I10');
  datO(
    ws, 'A10',
    laNhap ? phieu.ly_do_nhap || '' : `Lý do xuất kho : ${phieu.ly_do_xuat || ''}`,
    laNhap ? KIEU.lyDoNhap : KIEU.lyDoXuat
  );

  ws.mergeCells('A11:F11');
  datO(ws, 'A11', laNhap ? `Nhập tại kho: ${phieu.nhap_tai_kho || ''}` : `Xuất tại kho: ${phieu.xuat_tai_kho || ''}`, KIEU.noiKho);
  ws.mergeCells('G11:H11');
  datO(ws, 'G11', `Địa điểm ${phieu.dia_diem || ''}`, KIEU.diaDiem);

  // ---- Tiêu đề bảng hàng hóa ----
  ws.mergeCells('A12:A13'); ws.mergeCells('B12:B13'); ws.mergeCells('C12:C13'); ws.mergeCells('D12:D13');
  ws.mergeCells('E12:F12'); ws.mergeCells('G12:G13'); ws.mergeCells('H12:H13'); ws.mergeCells('I12:I13');
  datO(ws, 'A12', 'STT', KIEU.thTieuDe);
  datO(ws, 'B12', 'Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá', KIEU.thTieuDe);
  datO(ws, 'C12', 'Mã số', KIEU.thTieuDe);
  datO(ws, 'D12', 'ĐVT', KIEU.thTieuDe);
  datO(ws, 'E12', 'Số lượng ', KIEU.thTieuDe);
  datO(ws, 'G12', 'Đơn giá ', KIEU.thTieuDe);
  datO(ws, 'H12', 'Thành tiền', KIEU.thTieuDe);
  datO(ws, 'I12', 'Ghi chú', KIEU.thTieuDe);
  datO(ws, 'E13', laNhap ? 'Theo chứng từ' : 'Yêu cầu', KIEU.thTieuDe);
  datO(ws, 'F13', laNhap ? 'Thực nhập' : 'Thực xuất', KIEU.thTieuDe);
  ['A', 'B', 'C', 'D'].forEach((c, i) => datO(ws, `${c}14`, c, KIEU.thChiSo));
  [1, 2, 3, 4, 5].forEach((n, i) => datO(ws, `${String.fromCharCode(69 + i)}14`, n, KIEU.thChiSo));

  // ---- Dòng hàng hóa ----
  let r = 15;
  items.forEach((it, idx) => {
    const viTri = idx === 0 ? 'dau' : idx === items.length - 1 ? 'cuoi' : 'giua';
    datO(ws, `A${r}`, it.stt, oDongHang(1, viTri));
    datO(ws, `B${r}`, it.ten_hang, oDongHang(2, viTri));
    datO(ws, `C${r}`, it.ma_so || '', oDongHang(3, viTri));
    datO(ws, `D${r}`, it.dvt || '', oDongHang(4, viTri));
    datO(ws, `E${r}`, laNhap ? it.sl_chung_tu : it.sl_yeu_cau, oDongHang(5, viTri));
    datO(ws, `F${r}`, laNhap ? it.sl_thuc_nhap : it.sl_thuc_xuat, oDongHang(6, viTri));
    datO(ws, `G${r}`, it.don_gia, oDongHang(7, viTri));
    datO(ws, `H${r}`, it.thanh_tien, oDongHang(8, viTri));
    datO(ws, `I${r}`, it.ghi_chu || '', oDongHang(9, viTri));
    r++;
  });

  // ---- Tổng / thuế / tổng cộng ----
  datO(ws, `B${r}`, 'Tổng ', dongTong());
  datO(ws, `H${r}`, phieu.tong_tien_hang, dongTongVal());
  r++;
  datO(ws, `B${r}`, `Thuế ${phieu.thue_suat || 0} %`, dongTong());
  datO(ws, `H${r}`, phieu.tien_thue, dongTongVal());
  r++;
  datO(ws, `B${r}`, 'Tổng cộng', dongTong());
  datO(ws, `H${r}`, phieu.tong_cong, dongTongVal());
  r++;

  ws.mergeCells(`A${r}:I${r}`);
  datO(ws, `A${r}`, `Tổng số tiền (viết bằng chữ) : ${phieu.tong_bang_chu || ''}./.`, KIEU.bangChu);
  r++;
  ws.mergeCells(`A${r}:I${r}`);
  datO(ws, `A${r}`, `Số chứng từ gốc kèm theo : ${phieu.so_chung_tu_goc || ''}`, KIEU.chungTuGoc);
  r++; // dòng nhãn chữ ký nằm ngay sau, không có dòng trống (đúng theo mẫu gốc)

  ws.mergeCells(`A${r}:I${r}`);
  datO(ws, `A${r}`, laNhap ? NHAN_KY_NHAP : NHAN_KY_XUAT, KIEU.nhanKy);
  r++;
  ws.mergeCells(`A${r}:I${r}`);
  datO(ws, `A${r}`, laNhap ? KY_HO_TEN_NHAP : KY_HO_TEN_XUAT, { font: fontThuong({ italic: true }), alignment: { horizontal: 'center' } });

  return wb;
}

function dinhDangNgay(ngayISO) {
  if (!ngayISO) return 'Ngày ….. tháng ….. năm ……..';
  const [y, m, d] = ngayISO.split('-');
  return `Ngày ${d}  tháng  ${m} năm ${y}`;
}

module.exports = { taoFilePhieu };
