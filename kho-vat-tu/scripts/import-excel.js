// Nạp dữ liệu lịch sử từ file Excel "Nhập xuất mẫu" (mẫu 01-VT / 02-VT) vào database.
// Cách chạy:
//   node scripts/import-excel.js "đường/dẫn/tới/file.xlsx" [--dry-run] [--tu=2026-01-01] [--den=2026-06-30]
//
//   --dry-run     chỉ đọc file và in báo cáo (số phiếu, bất thường), KHÔNG ghi gì vào database.
//   --tu / --den  (tuỳ chọn) cảnh báo phiếu có ngày nằm ngoài khoảng này (YYYY-MM-DD).
//
// Mỗi sheet gồm nhiều khối phiếu nối tiếp nhau; mỗi khối bắt đầu bằng dòng có ô cột A chứa
// chữ "PHIẾU NHẬP KHO" hoặc "PHIẾU XUẤT KHO" (đúng mẫu 01-VT/02-VT). Loại phiếu được xác định
// theo CHÍNH tiêu đề của khối (không phụ thuộc tên sheet — vd. sheet "xuat kho 2026" không dấu).
//
// Chống nạp trùng: phiếu đã có trong database cùng loại + số phiếu + ngày + tổng cộng sẽ bị
// bỏ qua (chạy lại cùng file nhiều lần không tạo bản sao). Toàn bộ lần nạp nằm trong 1 transaction.
const path = require('path');
const ExcelJS = require('exceljs');
const { db, findOrCreateVatTu } = require('../src/db');
const { soTienBangChu } = require('../src/services/soTienBangChu');
const { ghepXuatVoiNhap } = require('../src/services/ghepNhapXuat');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const tuNgay = (args.find((a) => a.startsWith('--tu=')) || '').slice(5) || null;
const denNgay = (args.find((a) => a.startsWith('--den=')) || '').slice(6) || null;
const filePath = args.find((a) => !a.startsWith('--'));
if (!filePath) {
  console.error('Thiếu đường dẫn file. Dùng: node scripts/import-excel.js "duong/dan/file.xlsx" [--dry-run]');
  process.exit(1);
}

function layChu(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.richText) return cell.richText.map((t) => t.text).join('');
  if (typeof cell === 'object' && 'result' in cell) return layChu(cell.result);
  return String(cell).trim();
}

function laySo(cell) {
  if (cell && typeof cell === 'object' && 'result' in cell) return laySo(cell.result);
  const n = Number(cell);
  return Number.isFinite(n) ? n : 0;
}

function layCongThuc(cell) {
  return cell && typeof cell === 'object' && cell.formula ? String(cell.formula) : null;
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

// "Nợ: .........." / "Có:.........." (mẫu để trống) -> ''
function layTaiKhoan(text) {
  return layGiaTriSauDauHai(text).replace(/^[.\s…]+$/, '');
}

function boDau(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toUpperCase();
}

function ngayTuChuoiExcel(text) {
  // "Ngày 14  tháng  07 năm 2026" -> "2026-07-14"
  const m = text.match(/(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const fmt = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Đọc 1 sheet -> { phieuList, khongNhanDien: [dòng bắt đầu khối bị bỏ qua] }
function docSheet(ws) {
  const soDong = ws.rowCount;
  const dongA = (r) => layChu(ws.getRow(r).getCell(1).value);
  const dongG = (r) => layChu(ws.getRow(r).getCell(7).value);

  const diemBatDau = [];
  for (let r = 1; r <= soDong; r++) {
    const a = boDau(dongA(r));
    if (a.includes('PHIEU NHAP KHO')) diemBatDau.push({ r, loai: 'nhap' });
    else if (a.includes('PHIEU XUAT KHO')) diemBatDau.push({ r, loai: 'xuat' });
  }

  const phieuList = [];
  const khongNhanDien = [];
  for (let k = 0; k < diemBatDau.length; k++) {
    const { r: rBatDau, loai } = diemBatDau[k];
    const laPhieuNhap = loai === 'nhap';
    const rKetThuc = k + 1 < diemBatDau.length ? diemBatDau[k + 1].r - 1 : soDong;
    const canhBao = [];

    const header = {
      loai,
      dong_bat_dau: rBatDau,
      ngay: ngayTuChuoiExcel(dongA(rBatDau + 1)),
      // "Số: PN 27" nằm ở cột G (file tháng 7) hoặc gộp ô từ cột A (file tháng 1–6)
      so_phieu: (dongG(rBatDau + 2) || dongA(rBatDau + 2)).replace(/^\s*Số\s*:?\s*/i, '').trim(),
      no_tk: layTaiKhoan(dongG(rBatDau + 3)),
      co_tk: layTaiKhoan(dongG(rBatDau + 4)),
      nguoi: null,
      don_vi: null,
      ly_do: null,
      noi_kho: null,
      dia_diem: null,
    };

    // Dòng "Họ và tên người nhập: X     Đơn vị : Y"
    const dongNguoi = dongA(rBatDau + 5).replace(/\s+/g, ' ');
    const mNguoi = dongNguoi.match(/^[^:]*:\s*(.*?)\s*Đơn vị\s*:\s*(.*)$/i);
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

    header.noi_kho = layGiaTriSauDauHai(dongA(rBatDau + 7));
    // Dòng "Địa điểm ..." ở cột G không có dấu hai chấm nên layGiaTriSauDauHai không
    // tách được nhãn ra khỏi nội dung — tự bỏ chữ "Địa điểm" ở đầu để khi xuất Excel
    // (chỗ tự thêm lại nhãn này) không bị lặp.
    header.dia_diem = dongG(rBatDau + 7).replace(/\s+/g, ' ').trim().replace(/^Địa điểm\s*/i, '');

    // Tìm dòng bắt đầu bảng hàng hóa: dòng tiêu đề có cột A = "STT" (bỏ qua nó, dòng phụ đề
    // "Theo chứng từ/Thực nhập" và dòng chỉ số cột "A B C D 1 2 3 4 5"), hoặc — khi ô "STT" bị
    // trống như file tháng 1–6 — dòng chỉ số cột (A = "A", B = "B") ngay trước dòng hàng đầu tiên.
    let rHangHoa = null;
    for (let r = rBatDau + 8; r <= Math.min(rBatDau + 16, rKetThuc); r++) {
      if (dongA(r).toUpperCase() === 'STT') {
        rHangHoa = r + 3;
        break;
      }
      if (dongA(r) === 'A' && layChu(ws.getRow(r).getCell(2).value) === 'B') {
        rHangHoa = r + 1;
        break;
      }
    }
    if (!rHangHoa) {
      khongNhanDien.push({ loai, dong: rBatDau, ly_do: 'không thấy tiêu đề bảng hàng hóa (cột A = "STT" hoặc dòng chỉ số cột A/B/C…)' });
      continue;
    }

    const items = [];
    let r = rHangHoa;
    let soDongNhomBoQua = 0;
    const laRongDong = (rr) => ![1, 2, 5, 6, 7, 8].some((c) => layChu(ws.getRow(rr).getCell(c).value) !== '');
    while (r <= rKetThuc) {
      const row = ws.getRow(r);
      const stt = laySTT(row.getCell(1).value);
      if (stt === null) {
        // Dòng tiêu đề nhóm chen giữa bảng (vd A="a", B="Nghề ĐCN", không có số liệu) — bỏ qua, đọc tiếp.
        const cotA = layChu(row.getCell(1).value);
        const khongSoLieu = [5, 6, 7, 8].every((c) => layChu(row.getCell(c).value) === '');
        if (cotA !== '' && layChu(row.getCell(2).value) !== '' && khongSoLieu) {
          soDongNhomBoQua++;
          r++;
          continue;
        }
        // Dòng trống lọt giữa bảng: chỉ bỏ qua nếu ngay sau đó (trong 2 dòng) vẫn còn dòng hàng có STT.
        if (laRongDong(r) && [1, 2].some((d) => r + d <= rKetThuc && laySTT(ws.getRow(r + d).getCell(1).value) !== null)) {
          r++;
          continue;
        }
        // Hết bảng hàng hóa khi không còn STT hợp lệ ở cột A — đáng tin cậy hơn dò
        // theo chữ "Tổng" ở cột B, vì một số phiếu gốc bị thiếu/xóa nhãn đó.
        break;
      }
      const cotB = layChu(row.getCell(2).value);
      if (cotB) {
        items.push({
          stt: items.length + 1, // đánh số lại liên tục (file gốc có thể đánh số lại từ 1 sau mỗi nhóm)
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
    const rHangDau = rHangHoa;
    const rHangCuoi = r - 1;

    // ===== Khối tổng ngay dưới bảng hàng =====
    // Các dòng có số ở cột H (có thể có dòng trống xen giữa, nhãn cột B có thể thiếu hoặc khác nhau:
    // "Tổng"/"Cộng tiền hàng", "Thuế 8%"/"Thuế VAT 10%", "Tổng cộng"/"Tổng"/không nhãn). Đọc theo CẤU TRÚC:
    //   dòng 1 = tiền hàng; dòng cuối = tổng cộng; các dòng giữa = thuế (có thể 2 mức thuế).
    //   Chỉ 2 dòng: dòng 2 là thuế nếu nhãn bắt đầu bằng "Thuế", ngược lại coi là tổng cộng.
    //   Chỉ 1 dòng: không có thuế, tổng cộng = tiền hàng.
    // Nhãn "Tổng cộng" (nếu có) luôn được ưu tiên làm dòng tổng cộng.
    const cacDongTong = [];
    let rTim = r;
    while (rTim <= Math.min(r + 10, rKetThuc) && !boDau(dongA(rTim)).startsWith('TONG SO TIEN')) {
      const cellH = ws.getRow(rTim).getCell(8).value;
      const giaTriH = laySo(cellH);
      if (cellH !== null && cellH !== undefined && cellH !== '' && Number.isFinite(Number(typeof cellH === 'object' ? cellH.result : cellH))) {
        cacDongTong.push({
          nhan: boDau(layChu(ws.getRow(rTim).getCell(2).value)).trim(),
          gia_tri: giaTriH,
          cong_thuc: layCongThuc(cellH),
          nhan_goc: layChu(ws.getRow(rTim).getCell(2).value),
        });
      }
      rTim++;
    }
    let congThucTong = null;
    let tongTienHang = 0;
    let tienThue = 0;
    let tongCong = 0;
    let thueSuat = 0;
    const congThucThue = [];
    if (cacDongTong.length > 0) {
      const iTongCong = cacDongTong.findIndex((d, i) => i > 0 && d.nhan.startsWith('TONG CONG'));
      const iCuoi = iTongCong >= 0 ? iTongCong : cacDongTong.length - 1;
      tongTienHang = cacDongTong[0].gia_tri;
      congThucTong = cacDongTong[0].cong_thuc;
      let cacDongThue = cacDongTong.slice(1, iCuoi);
      if (cacDongTong.length === 1) {
        tongCong = tongTienHang;
      } else if (cacDongTong.length === 2 && iTongCong < 0) {
        if (cacDongTong[1].nhan.startsWith('THUE')) {
          cacDongThue = [cacDongTong[1]];
          tongCong = tongTienHang + cacDongTong[1].gia_tri;
          canhBao.push('không thấy dòng tổng cộng — tự tính = tiền hàng + thuế');
        } else {
          tongCong = cacDongTong[1].gia_tri;
          cacDongThue = [];
          tienThue = tongCong - tongTienHang;
        }
      } else {
        tongCong = cacDongTong[iCuoi].gia_tri;
      }
      for (const d of cacDongThue) {
        tienThue += d.gia_tri;
        if (d.cong_thuc) congThucThue.push(d.cong_thuc);
        const mThue = d.nhan_goc.match(/(\d+)\s*%/);
        if (mThue && !thueSuat) thueSuat = Number(mThue[1]);
      }
      if (cacDongTong.length === 1) {
        canhBao.push('chỉ có 1 dòng tổng (không thấy thuế/tổng cộng) — coi như không thuế, tổng cộng = tiền hàng');
      }
    } else {
      tongTienHang = items.reduce((s, it) => s + it.thanh_tien, 0);
      tongCong = tongTienHang;
      canhBao.push('không thấy dòng tổng nào — tự tính từ các dòng hàng');
    }
    // Thuế không có nhãn % (dòng thuế để trống nhãn): suy ra mức thuế gần nhất từ tỷ lệ thực tế.
    if (!thueSuat && tienThue > 0 && tongTienHang > 0) {
      const hieuDung = (tienThue / tongTienHang) * 100;
      const muc = [5, 8, 10].find((m) => Math.abs(m - hieuDung) < 0.6);
      thueSuat = muc || Math.round(hieuDung);
    }

    // Một số phiếu gốc bị xóa mất dòng "Số chứng từ gốc kèm theo" — nếu không dò theo nhãn
    // sẽ đọc nhầm sang dòng chữ ký ngay phía dưới.
    let rChungTu = null;
    for (let q = rTim; q <= Math.min(rTim + 4, rKetThuc); q++) {
      if (/^Số chứng từ/i.test(dongA(q))) {
        rChungTu = q;
        break;
      }
    }
    header.so_chung_tu_goc = rChungTu ? layGiaTriSauDauHai(dongA(rChungTu)) : '';

    // ===== Kiểm tra bất thường (chỉ cảnh báo — KHÔNG tự sửa số liệu gốc) =====
    if (items.length === 0) {
      khongNhanDien.push({ loai, dong: rBatDau, ly_do: 'bảng hàng hóa không có dòng nào' });
      continue;
    }
    if (!header.ngay) canhBao.push('không đọc được ngày');
    if (header.ngay && ((tuNgay && header.ngay < tuNgay) || (denNgay && header.ngay > denNgay))) {
      canhBao.push(`ngày ${header.ngay} nằm ngoài khoảng ${tuNgay || '…'} → ${denNgay || '…'}`);
    }
    if (!header.so_phieu) canhBao.push('thiếu số phiếu');
    const tongCacDong = items.reduce((s, it) => s + it.thanh_tien, 0);
    if (Math.abs(tongCacDong - tongTienHang) > 1) {
      canhBao.push(`Σ thành tiền các dòng (${fmt(tongCacDong)}) ≠ tiền hàng (${fmt(tongTienHang)}), lệch ${fmt(tongCacDong - tongTienHang)}`);
    }
    if (Math.abs(tongTienHang + tienThue - tongCong) > 1) {
      canhBao.push(`tiền hàng + thuế (${fmt(tongTienHang + tienThue)}) ≠ tổng cộng (${fmt(tongCong)})`);
    }
    // Đơn giá trong file gốc thường đã làm tròn nên SL×đơn giá lệch vài đồng so với thành tiền là bình thường —
    // chỉ cảnh báo khi lệch đáng kể (> 0,5% thành tiền và > 10đ).
    const dongLech = items.filter((it) => {
      const lech = Math.abs(it.sl_thuc * it.don_gia - it.thanh_tien);
      return lech > 10 && lech > 0.005 * Math.abs(it.thanh_tien);
    });
    if (dongLech.length > 0) {
      canhBao.push(`${dongLech.length} dòng có SL×đơn giá ≠ thành tiền đáng kể (vd STT ${dongLech.slice(0, 3).map((d) => d.stt).join(', ')})`);
    }
    if (soDongNhomBoQua > 0) canhBao.push(`${soDongNhomBoQua} dòng tiêu đề nhóm hàng chen trong bảng (đã bỏ qua, không phải hàng hóa)`);
    const dongThieuSl = items.filter((it) => it.sl_thuc === 0 && it.thanh_tien > 0);
    if (dongThieuSl.length > 0) {
      canhBao.push(`${dongThieuSl.length} dòng không có SL thực nhập/xuất nhưng có thành tiền (vd STT ${dongThieuSl.slice(0, 3).map((d) => d.stt).join(', ')})`);
    }
    if (tongTienHang > 0 && tienThue !== 0) {
      const hieuDung = (tienThue / tongTienHang) * 100;
      if (thueSuat && Math.abs(hieuDung - thueSuat) > 0.6) {
        canhBao.push(`nhãn thuế ${thueSuat}% nhưng tiền thuế thực tính ≈ ${hieuDung.toFixed(2)}% tiền hàng`);
      }
    }
    if (tienThue < 0) canhBao.push(`tiền thuế ÂM (${fmt(tienThue)}) — công thức gốc có thể hỏng`);
    // Mẫu gốc thường viết SUM(H<dòng chỉ số cột>:H<dòng cuối>)-4: lấy cả dòng chỉ số cột ("4" ở cột H)
    // rồi trừ 4 để bù — hợp lệ. Cảnh báo khi vùng cộng lệch dòng hàng, hoặc hằng số cộng/trừ khác mức bù đó.
    const mSum = congThucTong && congThucTong.match(/SUM\(\s*H(\d+)\s*:\s*H(\d+)\s*\)\s*([+-]\s*\d+)?/i);
    if (mSum) {
      const dau = Number(mSum[1]);
      const cuoi = Number(mSum[2]);
      const hangSo = mSum[3] ? Number(mSum[3].replace(/\s+/g, '')) : 0;
      const hangSoDung = dau === rHangDau - 1 ? -4 : 0;
      if ((dau !== rHangDau && dau !== rHangDau - 1) || cuoi !== rHangCuoi) {
        canhBao.push(`công thức tổng ${congThucTong} không khớp vùng dòng hàng H${rHangDau}:H${rHangCuoi}`);
      } else if (hangSo !== hangSoDung) {
        canhBao.push(`công thức tổng có cộng/trừ hằng số lạ: ${congThucTong}`);
      }
    }
    const thueBatThuong = congThucThue.filter((ct) => /%\s*[+-]\s*\d/.test(ct) || /[A-Z]\d+\s*[+-]\s*\d+\s*$/.test(ct));
    if (thueBatThuong.length > 0) canhBao.push(`công thức thuế có cộng/trừ hằng số: ${thueBatThuong.join(' ; ')}`);
    const tenLanSo = items.filter((it) => /\d{1,3}(?:[.,]\d{3})+\s/.test(it.ten_hang) || /^\d+$/.test(it.ten_hang));
    if (tenLanSo.length > 0) canhBao.push(`${tenLanSo.length} tên hàng nghi lẫn số liệu (vd "${tenLanSo[0].ten_hang.slice(0, 50)}")`);
    if (!header.so_chung_tu_goc) header.thieu_chung_tu = true;

    phieuList.push({ ...header, items, tongTienHang, thueSuat, tienThue, tongCong, canhBao });
  }
  return { phieuList, khongNhanDien };
}

function luuPhieuNhap(p) {
  const info = db
    .prepare(
      `INSERT INTO phieu_nhap
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhap, don_vi, ly_do_nhap, nhap_tai_kho, dia_diem, so_chung_tu_goc,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu, nguon_pdf)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi,@don_vi,@ly_do,@noi_kho,@dia_diem,@so_chung_tu_goc,
               @tongTienHang,@thueSuat,@tienThue,@tongCong,@tongBangChu,'import-excel')`
    )
    .run({
      so_phieu: p.so_phieu, ngay: p.ngay, no_tk: p.no_tk, co_tk: p.co_tk, nguoi: p.nguoi, don_vi: p.don_vi,
      ly_do: p.ly_do, noi_kho: p.noi_kho, dia_diem: p.dia_diem, so_chung_tu_goc: p.so_chung_tu_goc,
      tongTienHang: p.tongTienHang, thueSuat: p.thueSuat, tienThue: p.tienThue, tongCong: p.tongCong,
      tongBangChu: soTienBangChu(p.tongCong),
    });
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
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem, so_chung_tu_goc,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi,@don_vi,@ly_do,@noi_kho,@dia_diem,@so_chung_tu_goc,
               @tongTienHang,@thueSuat,@tienThue,@tongCong,@tongBangChu)`
    )
    .run({
      so_phieu: p.so_phieu, ngay: p.ngay, no_tk: p.no_tk, co_tk: p.co_tk, nguoi: p.nguoi, don_vi: p.don_vi,
      ly_do: p.ly_do, noi_kho: p.noi_kho, dia_diem: p.dia_diem, so_chung_tu_goc: p.so_chung_tu_goc,
      tongTienHang: p.tongTienHang, thueSuat: p.thueSuat, tienThue: p.tienThue, tongCong: p.tongCong,
      tongBangChu: soTienBangChu(p.tongCong),
    });
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

const BANG = { nhap: 'phieu_nhap', xuat: 'phieu_xuat' };
const timTrung = {
  nhap: db.prepare('SELECT id FROM phieu_nhap WHERE so_phieu IS ? AND ngay IS ? AND ABS(tong_cong - ?) < 0.5'),
  xuat: db.prepare('SELECT id FROM phieu_xuat WHERE so_phieu IS ? AND ngay IS ? AND ABS(tong_cong - ?) < 0.5'),
};
const tenLoai = { nhap: 'phiếu nhập', xuat: 'phiếu xuất' };

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(filePath));

  console.log(dryRun ? '=== DRY-RUN: chỉ đọc, KHÔNG ghi database ===' : '=== NẠP DỮ LIỆU vào database ===');
  const tongKet = { nhap: { doc: 0, nap: 0, boQuaDb: 0, boQuaFile: 0 }, xuat: { doc: 0, nap: 0, boQuaDb: 0, boQuaFile: 0 } };
  const canhBaoTatCa = [];
  const canhBaoNhe = { tổng: [], thuế: [], nhóm: [] };
  const choNap = [];
  const daThayTrongFile = new Set();

  for (const ws of wb.worksheets) {
    const { phieuList, khongNhanDien } = docSheet(ws);
    const demSheet = { nhap: { doc: 0, nap: 0, db: 0, file: 0 }, xuat: { doc: 0, nap: 0, db: 0, file: 0 } };
    for (const p of phieuList) {
      const nhan = `[${p.loai === 'nhap' ? 'NHẬP' : 'XUẤT'}] dòng ${p.dong_bat_dau} số "${p.so_phieu}" ${p.ngay || '(không ngày)'}`;
      tongKet[p.loai].doc++;
      demSheet[p.loai].doc++;
      const khoa = `${p.loai}|${p.so_phieu}|${p.ngay}|${Math.round(p.tongCong)}`;
      let trangThai = 'NẠP';
      if (timTrung[p.loai].get(p.so_phieu, p.ngay, p.tongCong)) {
        trangThai = 'BỎ QUA (đã có trong DB)';
        tongKet[p.loai].boQuaDb++;
        demSheet[p.loai].db++;
      } else if (daThayTrongFile.has(khoa)) {
        trangThai = 'BỎ QUA (trùng khối khác trong file)';
        tongKet[p.loai].boQuaFile++;
        demSheet[p.loai].file++;
      } else {
        daThayTrongFile.add(khoa);
        choNap.push(p);
        tongKet[p.loai].nap++;
        demSheet[p.loai].nap++;
      }
      console.log(`  ${nhan} | ${p.items.length} dòng | hàng ${fmt(p.tongTienHang)} + thuế ${fmt(p.tienThue)} = ${fmt(p.tongCong)} → ${trangThai}`);
      p.canhBao.forEach((c) => {
        // Cảnh báo "nhẹ" (hằng số bù làm tròn trong công thức gốc, tiêu đề nhóm) gom lại thành 1 dòng cho mỗi loại.
        const nhe = /hằng số|tiêu đề nhóm/.test(c) ? (/công thức thuế/.test(c) ? 'thuế' : /hằng số/.test(c) ? 'tổng' : 'nhóm') : null;
        if (nhe) canhBaoNhe[nhe].push(`${p.loai === 'nhap' ? 'N' : 'X'}${p.so_phieu}`);
        else canhBaoTatCa.push(`${nhan}: ${c}`);
      });
    }
    khongNhanDien.forEach((k) => canhBaoTatCa.push(`[${k.loai === 'nhap' ? 'NHẬP' : 'XUẤT'}] dòng ${k.dong}: KHỐI BỊ BỎ QUA — ${k.ly_do}`));
    for (const loai of ['nhap', 'xuat']) {
      const d = demSheet[loai];
      if (d.doc === 0) continue;
      console.log(`Sheet "${ws.name}": ${d.doc} ${tenLoai[loai]} đọc được → nạp ${d.nap}, bỏ qua do đã có trong DB ${d.db}, bỏ qua do trùng trong file ${d.file}.`);
    }
  }

  // Trùng số phiếu (khác ngày/tổng) — thông tin để người dùng rà soát, vẫn nạp
  const demSo = new Map();
  choNap.forEach((p) => demSo.set(`${p.loai}|${p.so_phieu}`, (demSo.get(`${p.loai}|${p.so_phieu}`) || 0) + 1));
  [...demSo.entries()].filter(([, n]) => n > 1).forEach(([k, n]) => {
    const [loai, so] = k.split('|');
    canhBaoTatCa.push(`[${loai === 'nhap' ? 'NHẬP' : 'XUẤT'}] số phiếu "${so}" xuất hiện ${n} lần trong file (khác ngày/tổng tiền) — kiểm tra có bị đánh số trùng không`);
  });
  if (canhBaoNhe.tổng.length) canhBaoTatCa.push(`công thức "tiền hàng" có cộng/trừ hằng số bù (làm tròn) ở ${canhBaoNhe.tổng.length} phiếu: ${canhBaoNhe.tổng.join(', ')}`);
  if (canhBaoNhe.thuế.length) canhBaoTatCa.push(`công thức "thuế" có cộng/trừ hằng số bù ở ${canhBaoNhe.thuế.length} phiếu: ${canhBaoNhe.thuế.join(', ')}`);
  if (canhBaoNhe.nhóm.length) canhBaoTatCa.push(`bảng hàng có dòng tiêu đề nhóm chen giữa (đã bỏ qua) ở ${canhBaoNhe.nhóm.length} phiếu: ${canhBaoNhe.nhóm.join(', ')}`);
  const thieuCt = choNap.filter((p) => p.thieu_chung_tu).length;
  if (thieuCt > 0) canhBaoTatCa.push(`${thieuCt}/${choNap.length} phiếu không có dòng "Số chứng từ gốc kèm theo" (để trống)`);

  if (!dryRun && choNap.length > 0) {
    const tx = db.transaction(() => {
      for (const p of choNap) (p.loai === 'nhap' ? luuPhieuNhap : luuPhieuXuat)(p);
    });
    tx();
  }

  console.log('\n--- BẤT THƯỜNG / CẢNH BÁO TRONG FILE GỐC (không tự sửa) ---');
  if (canhBaoTatCa.length === 0) console.log('(không có)');
  canhBaoTatCa.forEach((c) => console.log('  • ' + c));

  const tn = tongKet.nhap;
  const tx = tongKet.xuat;
  console.log(
    `\n${dryRun ? 'Sẽ nạp' : 'Đã nạp'}: ${tn.nap}/${tn.doc} phiếu nhập, ${tx.nap}/${tx.doc} phiếu xuất ` +
      `(bỏ qua do đã có trong DB: ${tn.boQuaDb} nhập, ${tx.boQuaDb} xuất; trùng trong file: ${tn.boQuaFile} nhập, ${tx.boQuaFile} xuất).`
  );

  if (!dryRun) {
    // Gắn phieu_nhap_item_id cho các dòng xuất (phục vụ Sổ tổng hợp nhập xuất) bằng heuristic
    // an toàn; dòng nào không ghép được thì để trống, có thể gắn tay sau trong màn hình sổ.
    const kq = ghepXuatVoiNhap({ db });
    console.log(
      `Ghép dòng xuất với dòng nhập: ghép được ${kq.ghep_duoc}/${kq.tong_xem_xet} dòng, ` +
        `không ghép được ${kq.khong_ghep_duoc} dòng (để trống).`
    );
    const dem = (b) => db.prepare(`SELECT COUNT(*) c FROM ${b}`).get().c;
    console.log(`Tổng trong DB: ${dem('phieu_nhap')} phiếu nhập, ${dem('phieu_xuat')} phiếu xuất, ${dem('vat_tu')} vật tư.`);
    console.log('Mở website và xem lại mục "Tồn kho" / "Phiếu nhập" / "Phiếu xuất" để kiểm tra.');
  }
}

main().catch((err) => {
  console.error('Lỗi khi nạp dữ liệu:', err);
  process.exit(1);
});
