// Xuất phiếu nhập/xuất kho ra file Excel đúng theo Mẫu số 01-VT / 02-VT
// (Thông tư số 99/2025/TT-BTC ngày 27/10/2025 của Bộ trưởng Bộ Tài chính) —
// giữ nguyên bố cục như file mẫu gốc của Phòng Kế hoạch — Tài chính, để in ra ký tay.
const ExcelJS = require('exceljs');

const TEN_DON_VI = 'Trường cao đẳng nghề Công nghiệp Hà Nội';
const BO_PHAN = 'Phòng Kế hoạch- Tài chính';

const VIEN_MONG = { style: 'thin' };
const O_CO_VIEN = { top: VIEN_MONG, left: VIEN_MONG, bottom: VIEN_MONG, right: VIEN_MONG };

function dinhDangNgay(ngayISO) {
  if (!ngayISO) return 'Ngày ….. tháng ….. năm ……..';
  const [y, m, d] = ngayISO.split('-');
  return `Ngày ${d}  tháng  ${m} năm ${y}`;
}

function ghiODong(ws, hang, giaTri, tuy = {}) {
  const cell = ws.getCell(hang);
  cell.value = giaTri;
  if (tuy.dam) cell.font = { ...(cell.font || {}), bold: true };
  if (tuy.co) cell.font = { ...(cell.font || {}), size: tuy.co };
  if (tuy.giua) cell.alignment = { horizontal: 'center', vertical: 'middle' };
  if (tuy.phai) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  return cell;
}

function dinhDangSo(cell) {
  cell.numFmt = '#,##0';
  cell.alignment = { horizontal: 'right' };
}

/**
 * Tạo workbook Excel đúng mẫu 01-VT (nhập) hoặc 02-VT (xuất).
 * @param {object} phieu - bản ghi phiếu (từ phieu_nhap hoặc phieu_xuat)
 * @param {Array} items - danh sách dòng hàng hóa
 * @param {'nhap'|'xuat'} loai
 */
function taoFilePhieu(phieu, items, loai) {
  const laNhap = loai === 'nhap';
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(laNhap ? 'Phiếu nhập kho' : 'Phiếu xuất kho', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { width: 5 }, { width: 38 }, { width: 10 }, { width: 8 },
    { width: 11 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 14 },
  ];

  ws.mergeCells('A1:D1');
  ghiODong(ws, 'A1', `Đơn vị: ${TEN_DON_VI}`);
  ws.mergeCells('E1:I1');
  ghiODong(ws, 'E1', laNhap ? 'Mẫu số 01-VT' : 'Mẫu số 02-VT', { phai: true });

  ws.mergeCells('A2:D2');
  ghiODong(ws, 'A2', `Bộ phận: ${BO_PHAN}`);
  ws.mergeCells('E2:I2');
  ghiODong(ws, 'E2', '(Kèm theo Thông tư số 99/2025/TT-BTC', { phai: true });
  ws.mergeCells('E3:I3');
  ghiODong(ws, 'E3', 'ngày 27 tháng 10 năm 2025 của Bộ trưởng Bộ Tài chính)', { phai: true });

  ws.mergeCells('A4:I4');
  ghiODong(ws, 'A4', laNhap ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO', { dam: true, co: 16, giua: true });

  ws.mergeCells('A5:F5');
  ghiODong(ws, 'A5', dinhDangNgay(phieu.ngay), { giua: true });
  ghiODong(ws, 'G6', `Số: ${phieu.so_phieu || ''}`);
  ghiODong(ws, 'G7', `Nợ : ${phieu.no_tk || ''}`);
  ghiODong(ws, 'G8', `Có : ${phieu.co_tk || ''}`);

  ws.mergeCells('A9:I9');
  ghiODong(
    ws,
    'A9',
    `Họ và tên người ${laNhap ? 'nhập' : 'nhập'}: ${laNhap ? phieu.nguoi_nhap || '' : phieu.nguoi_nhan || ''}            Đơn vị : ${phieu.don_vi || ''}`
  );

  ws.mergeCells('A10:I10');
  ghiODong(ws, 'A10', laNhap ? phieu.ly_do_nhap || '' : `Lý do xuất kho : ${phieu.ly_do_xuat || ''}`);

  ws.mergeCells('A11:F11');
  ghiODong(ws, 'A11', laNhap ? `Nhập tại kho: ${phieu.nhap_tai_kho || ''}` : `Xuất tại kho: ${phieu.xuat_tai_kho || ''}`);
  ws.mergeCells('G11:I11');
  ghiODong(ws, 'G11', `Địa điểm ${phieu.dia_diem || ''}`);

  // Bảng hàng hóa: dòng 12-14 là tiêu đề
  const tieuDe = ['STT', 'Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá', 'Mã số', 'ĐVT', 'Số lượng', '', 'Đơn giá', 'Thành tiền', 'Ghi chú'];
  ws.getRow(12).values = tieuDe;
  ws.mergeCells('A12:A14');
  ws.mergeCells('B12:B14');
  ws.mergeCells('C12:C14');
  ws.mergeCells('D12:D14');
  ws.mergeCells('E12:F12');
  ws.mergeCells('G12:G14');
  ws.mergeCells('H12:H14');
  ws.mergeCells('I12:I14');
  ws.getRow(13).getCell(5).value = laNhap ? 'Theo chứng từ' : 'Yêu cầu';
  ws.getRow(13).getCell(6).value = laNhap ? 'Thực nhập' : 'Thực xuất';
  ws.getRow(14).values = ['A', 'B', 'C', 'D', 1, 2, 3, 4, 5];
  for (let r = 12; r <= 14; r++) {
    ws.getRow(r).eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = O_CO_VIEN;
    });
  }

  let r = 15;
  for (const it of items) {
    const row = ws.getRow(r);
    row.values = [
      it.stt,
      it.ten_hang,
      it.ma_so || '',
      it.dvt || '',
      laNhap ? it.sl_chung_tu : it.sl_yeu_cau,
      laNhap ? it.sl_thuc_nhap : it.sl_thuc_xuat,
      it.don_gia,
      it.thanh_tien,
      it.ghi_chu || '',
    ];
    row.eachCell((cell, colIdx) => {
      cell.border = O_CO_VIEN;
      if ([5, 6, 7, 8].includes(colIdx)) dinhDangSo(cell);
      if (colIdx === 2) cell.alignment = { wrapText: true, vertical: 'middle' };
    });
    r++;
  }

  const rTong = r;
  ws.getCell(`B${rTong}`).value = 'Tổng ';
  dinhDangSo(ghiODong(ws, `H${rTong}`, phieu.tong_tien_hang));
  const rThue = rTong + 1;
  ws.getCell(`B${rThue}`).value = `Thuế ${phieu.thue_suat || 0} %`;
  dinhDangSo(ghiODong(ws, `H${rThue}`, phieu.tien_thue));
  const rTongCong = rThue + 1;
  ws.getCell(`B${rTongCong}`).value = 'Tổng cộng';
  ws.getCell(`B${rTongCong}`).font = { bold: true };
  dinhDangSo(ghiODong(ws, `H${rTongCong}`, phieu.tong_cong));
  ws.getCell(`H${rTongCong}`).font = { bold: true };

  let rr = rTongCong + 1;
  ws.mergeCells(`A${rr}:I${rr}`);
  ghiODong(ws, `A${rr}`, `Tổng số tiền (viết bằng chữ) : ${phieu.tong_bang_chu || ''}./.`);
  rr++;
  ws.mergeCells(`A${rr}:I${rr}`);
  ghiODong(ws, `A${rr}`, `Số chứng từ gốc kèm theo : ${phieu.so_chung_tu_goc || ''}`);

  rr += 2;
  const nguoiKy = laNhap
    ? ['Người lập phiếu', 'Người giao hàng', 'Thủ kho', 'Kế toán trưởng']
    : ['Người lập phiếu', 'Người nhận hàng', 'Thủ kho', 'Kế toán trưởng', 'P. Hiệu trưởng'];
  ws.mergeCells(`A${rr}:I${rr}`);
  ghiODong(ws, `A${rr}`, '    ' + nguoiKy.join('                    '), { dam: true, giua: true });
  rr++;
  ws.mergeCells(`A${rr}:I${rr}`);
  ghiODong(ws, `A${rr}`, '    ' + nguoiKy.map(() => '(Ký, họ tên)').join('                    '), { giua: true });

  return wb;
}

module.exports = { taoFilePhieu };
