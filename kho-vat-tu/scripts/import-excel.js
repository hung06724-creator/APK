// Nạp dữ liệu lịch sử từ file Excel "Nhập xuất mẫu" (mẫu 01-VT / 02-VT) vào database.
// Cách chạy:  node scripts/import-excel.js "đường/dẫn/tới/file.xlsx"
//
// File Excel cần có các sheet mà tên chứa "Nhập" hoặc "Xuất" (không phân biệt hoa
// thường), mỗi sheet gồm nhiều khối phiếu nối tiếp nhau, mỗi khối bắt đầu bằng dòng
// có ô cột A chứa chữ "PHIẾU NHẬP KHO" hoặc "PHIẾU XUẤT KHO" — đúng theo mẫu 01-VT/02-VT
// Thông tư 99/2025/TT-BTC mà Phòng Kế hoạch — Tài chính đang dùng.
const path = require('path');
const ExcelJS = require('exceljs');
const { db, findOrCreateVatTu } = require('../src/db');
const { soTienBangChu } = require('../src/services/soTienBangChu');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Thiếu đường dẫn file. Dùng: node scripts/import-excel.js "duong/dan/file.xlsx"');
  process.exit(1);
}

function layChu(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.richText) return cell.richText.map((t) => t.text).join('');
  return String(cell).trim();
}

function laySo(cell) {
  if (cell && typeof cell === 'object' && 'result' in cell) return laySo(cell.result);
  const n = Number(cell);
  return Number.isFinite(n) ? n : 0;
}

// Cột STT trong file nguồn nhiều dòng dùng công thức ROW()-x thay vì gõ số trực tiếp,
// ExcelJS trả về {formula, result} cho các ô này chứ không phải một số thuần.
function laySTT(cell) {
  if (typeof cell === 'number') return cell;
  if (cell && typeof cell === 'object' && 'result' in cell && typeof cell.result === 'number') return cell.result;
  return null;
}

function layGiaTriSauDauHai(text) {
  const idx = text.indexOf(':');
  return idx >= 0 ? text.slice(idx + 1).trim() : text.trim();
}

function ngayTuChuoiExcel(text) {
  // "Ngày 14  tháng  07 năm 2026" -> "2026-07-14"
  const m = text.match(/(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function docSheet(ws, laPhieuNhap) {
  const soDong = ws.rowCount;
  const dongA = (r) => layChu(ws.getRow(r).getCell(1).value);
  const dongG = (r) => layChu(ws.getRow(r).getCell(7).value);

  const diemBatDau = [];
  for (let r = 1; r <= soDong; r++) {
    const a = dongA(r).toUpperCase();
    if (a.includes('PHIẾU NHẬP KHO') || a.includes('PHIẾU XUẤT KHO')) diemBatDau.push(r);
  }

  const phieuList = [];
  for (let k = 0; k < diemBatDau.length; k++) {
    const rBatDau = diemBatDau[k];
    const rKetThuc = k + 1 < diemBatDau.length ? diemBatDau[k + 1] - 1 : soDong;

    const header = {
      ngay: ngayTuChuoiExcel(dongA(rBatDau + 1)),
      so_phieu: layGiaTriSauDauHai(dongG(rBatDau + 2)),
      no_tk: layGiaTriSauDauHai(dongG(rBatDau + 3)),
      co_tk: laPhieuNhap ? layGiaTriSauDauHai(dongG(rBatDau + 4)) : null,
      nguoi: null,
      don_vi: null,
      ly_do: null,
      noi_kho: null,
      dia_diem: null,
    };

    // Dòng "Họ và tên người nhập: X     Đơn vị : Y"
    const dongNguoi = dongA(rBatDau + 5);
    const mNguoi = dongNguoi.match(/:\s*([^\n]*?)\s{2,}Đơn vị\s*:\s*(.*)$/i);
    if (mNguoi) {
      header.nguoi = mNguoi[1].trim();
      header.don_vi = mNguoi[2].trim();
    } else {
      header.nguoi = layGiaTriSauDauHai(dongNguoi);
    }

    // Dòng "lý do" của sheet Nhập là một câu tự nhiên (không có nhãn cố định kiểu
    // "Nhãn : nội dung"), nên giữ nguyên. Dòng của sheet Xuất luôn có nhãn
    // "Lý do xuất kho :" ở đầu — bỏ nhãn đó đi để khi xuất Excel không bị lặp
    // (chỗ xuất Excel sẽ tự thêm lại nhãn này).
    const dongLyDo = dongA(rBatDau + 6).replace(/\s+/g, ' ').trim();
    header.ly_do = laPhieuNhap ? dongLyDo : dongLyDo.replace(/^Lý do xuất kho\s*:\s*/i, '');

    const dongKho = dongA(rBatDau + 7);
    header.noi_kho = layGiaTriSauDauHai(dongKho);
    header.dia_diem = layGiaTriSauDauHai(dongG(rBatDau + 7));

    // Tìm dòng bắt đầu bảng hàng hóa: dòng có cột A = "STT"
    let rHangHoa = null;
    for (let r = rBatDau + 8; r <= Math.min(rBatDau + 14, rKetThuc); r++) {
      if (dongA(r).toUpperCase() === 'STT') {
        rHangHoa = r + 3; // bỏ qua dòng "STT...", dòng phụ đề "Theo chứng từ/Thực nhập", dòng "A B C D 1 2 3 4 5"
        break;
      }
    }
    if (!rHangHoa) continue; // không nhận diện được bảng hàng hóa, bỏ qua khối này

    const items = [];
    let r = rHangHoa;
    while (r <= rKetThuc) {
      const row = ws.getRow(r);
      const stt = laySTT(row.getCell(1).value);
      // Hết bảng hàng hóa khi không còn STT hợp lệ ở cột A — đáng tin cậy hơn dò
      // theo chữ "Tổng" ở cột B, vì một số phiếu gốc bị thiếu/xóa nhãn đó.
      if (stt === null) break;
      const cotB = layChu(row.getCell(2).value);
      if (cotB) {
        items.push({
          stt,
          ten_hang: cotB.replace(/\s+/g, ' ').trim(),
          ma_so: layChu(row.getCell(3).value) || null,
          dvt: layChu(row.getCell(4).value) || null,
          sl_chung_tu: laySo(row.getCell(5).value),
          sl_thuc: laySo(row.getCell(6).value),
          don_gia: laySo(row.getCell(7).value),
          thanh_tien: laySo(row.getCell(8).value),
          ghi_chu: layChu(row.getCell(9).value) || null,
        });
      }
      r++;
    }

    // Ngay sau dòng item cuối là dòng "Tổng" (tiền hàng trước thuế) — lấy theo VỊ TRÍ,
    // không dò nhãn, vì một số phiếu gốc bị thiếu/xóa chữ "Tổng" ở ô này.
    let tongTienHang = laySo(ws.getRow(r).getCell(8).value);
    if (!tongTienHang) tongTienHang = items.reduce((s, it) => s + it.thanh_tien, 0);

    // Sau đó dò tới đúng dòng có nhãn "Tổng cộng" — thường chỉ có 1 dòng thuế ở giữa,
    // nhưng vài phiếu có hóa đơn gộp 2 mức thuế suất (8% và 10%) nên có 2 dòng thuế liên
    // tiếp; cộng dồn mọi dòng gặp giữa "Tổng" và "Tổng cộng" vào tiền thuế cho đúng.
    let tienThue = 0;
    let tongCong = 0;
    let thueSuat = 0;
    let rTim = r + 1;
    let timThayTongCong = false;
    while (rTim <= Math.min(r + 6, rKetThuc)) {
      const nhan = layChu(ws.getRow(rTim).getCell(2).value);
      const giaTri = laySo(ws.getRow(rTim).getCell(8).value);
      if (nhan.toLowerCase().startsWith('tổng cộng')) {
        tongCong = giaTri;
        timThayTongCong = true;
        break;
      }
      tienThue += giaTri;
      const mThue = nhan.match(/(\d+)\s*%/);
      if (mThue && !thueSuat) thueSuat = Number(mThue[1]);
      rTim++;
    }
    if (!timThayTongCong) tongCong = tongTienHang + tienThue;

    if (items.length > 0) {
      phieuList.push({ ...header, items, tongTienHang, thueSuat, tienThue, tongCong });
    }
  }
  return phieuList;
}

function luuPhieuNhap(p) {
  const info = db
    .prepare(
      `INSERT INTO phieu_nhap
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhap, don_vi, ly_do_nhap, nhap_tai_kho, dia_diem,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu, nguon_pdf)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi,@don_vi,@ly_do,@noi_kho,@dia_diem,
               @tongTienHang,@thueSuat,@tienThue,@tongCong,@tongBangChu,'import-excel')`
    )
    .run({ ...p, tongBangChu: soTienBangChu(p.tongCong) });
  const phieuId = info.lastInsertRowid;
  const insertItem = db.prepare(
    `INSERT INTO phieu_nhap_items
     (phieu_nhap_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_chung_tu, sl_thuc_nhap, don_gia, thanh_tien, ghi_chu)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  for (const it of p.items) {
    const vatTu = findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt, ma_so: it.ma_so });
    insertItem.run(phieuId, vatTu ? vatTu.id : null, it.stt, it.ten_hang, it.ma_so, it.dvt, it.sl_chung_tu, it.sl_thuc, it.don_gia, it.thanh_tien, it.ghi_chu);
  }
}

function luuPhieuXuat(p) {
  const info = db
    .prepare(
      `INSERT INTO phieu_xuat
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi,@don_vi,@ly_do,@noi_kho,@dia_diem,
               @tongTienHang,@thueSuat,@tienThue,@tongCong,@tongBangChu)`
    )
    .run({ ...p, tongBangChu: soTienBangChu(p.tongCong) });
  const phieuId = info.lastInsertRowid;
  const insertItem = db.prepare(
    `INSERT INTO phieu_xuat_items
     (phieu_xuat_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, thanh_tien, ghi_chu)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  for (const it of p.items) {
    const vatTu = findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt, ma_so: it.ma_so });
    insertItem.run(phieuId, vatTu ? vatTu.id : null, it.stt, it.ten_hang, it.ma_so, it.dvt, it.sl_chung_tu, it.sl_thuc, it.don_gia, it.thanh_tien, it.ghi_chu);
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(filePath));

  let tongSoNhap = 0;
  let tongSoXuat = 0;

  wb.worksheets.forEach((ws) => {
    const ten = ws.name.toLowerCase();
    if (ten.includes('nhập')) {
      const list = docSheet(ws, true);
      list.forEach(luuPhieuNhap);
      tongSoNhap += list.length;
      console.log(`Sheet "${ws.name}": nạp ${list.length} phiếu nhập kho.`);
    } else if (ten.includes('xuất')) {
      const list = docSheet(ws, false);
      list.forEach(luuPhieuXuat);
      tongSoXuat += list.length;
      console.log(`Sheet "${ws.name}": nạp ${list.length} phiếu xuất kho.`);
    }
  });

  console.log(`\nHoàn tất: ${tongSoNhap} phiếu nhập, ${tongSoXuat} phiếu xuất đã được nạp vào database.`);
  console.log('Mở website và xem lại mục "Tồn kho" / "Phiếu nhập" / "Phiếu xuất" để kiểm tra.');
}

main().catch((err) => {
  console.error('Lỗi khi nạp dữ liệu:', err);
  process.exit(1);
});
