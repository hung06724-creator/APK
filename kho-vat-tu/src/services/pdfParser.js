// Trích xuất dữ liệu từ hóa đơn GTGT dạng PDF (bản thể hiện hóa đơn điện tử).
//
// QUAN TRỌNG: mỗi phần mềm xuất hóa đơn điện tử (MISA meInvoice, Bkav eHoadon, EasyInvoice,
// VNPT, M-Invoice, AsiaInvoice...) sắp xếp văn bản trong PDF khác nhau: có nơi đúng thứ tự
// đọc, có nơi đảo thứ tự cột hoặc xáo trộn nhãn/giá trị. Vì vậy đây là trích xuất "cố gắng
// tốt nhất" (best-effort): luôn trả về kèm "warnings" và phải cho người dùng xem lại, sửa
// trước khi lưu thành phiếu nhập kho — không bao giờ tự động lưu thẳng vào hệ thống.
//
// Cách làm (không phụ thuộc danh sách ĐVT cố định):
//  - Dòng hàng "xuôi" (STT, tên, ĐVT, SL, ĐG, TT [, %thuế, tiền thuế]): nhận diện bằng phần
//    đuôi toàn số của dòng, ghép các dòng tên bị ngắt dòng lại, STT lấy theo thứ tự 1,2,3...
//  - Dòng hàng "đảo cột" (TT, ĐG, SL, ĐVT, tên, STT — kiểu M-Invoice): nhận diện bằng 3 số đầu
//    dòng thỏa SL×ĐG≈TT, STT nằm cuối khối.
//  - Chạy cả hai, chọn kết quả có tổng thành tiền khớp "Cộng tiền hàng" của hóa đơn nhất.
const { PDFParse } = require('pdf-parse');

const SCHOOL_MST = '0100729188';

const RE_SO = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/; // 1.259.259 | 12.592,59 | 2,00 | 20
const RE_THUE_SUAT = /^(?:(\d{1,2}(?:,\d+)?)%|KCT|KKKNT|KHAC)$/i;
const RE_SO_TIEN_TRONG_DONG = /(?<![\d.,])\d{1,3}(?:\.\d{3})+(?!\d)/g; // chỉ số có dấu chấm nghìn (>= 1.000)

const laSo = (t) => RE_SO.test(t);

function parseSoVN(s) {
  if (s === undefined || s === null) return null;
  const cleaned = String(s).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function layDong(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function soTienTrongDong(dong) {
  return [...dong.matchAll(RE_SO_TIEN_TRONG_DONG)].map((m) => parseSoVN(m[0]));
}

// ===================== Thông tin chung =====================

function timNgay(text) {
  const m = text.match(
    /Ngày\s*(?:\([^)]*\))?\s*(\d{1,2})\s*tháng\s*(?:\([^)]*\))?\s*(\d{1,2})\s*năm\s*(?:\([^)]*\))?\s*(\d{4})/i
  );
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function timKyHieuSoHoaDon(text) {
  let m = text.match(/Ký hiệu\s*(?:\([^)]*\))?\s*:?\s*([A-Z0-9]{5,10})\s*\n?\s*Số\s*(?:\([^)]*\))?\s*:?\s*(\d{1,10})/i);
  if (m) return { kyHieu: m[1], soHoaDon: m[2] };
  // Mẫu số - Ký hiệu (Serial No.): X ... Số (Invoice No.): Y  (có thể cách xa nhau hơn)
  const kh = text.match(/Ký hiệu[^:\n]*:\s*([A-Z0-9]{5,10})/i);
  const sh = text.match(/Số\s*\([^)]*(?:Invoice|No)[^)]*\)\s*:?\s*(\d{1,10})/i) || text.match(/(?:^|\n)Số:\s*(\d{4,10})/m);
  // Hóa đơn bị xáo trộn nhãn (M-Invoice): ký hiệu vẫn có dạng "1C26TCT" (1 số, 1 chữ, 2 số, 2-3 chữ)
  const khDangMau = text.match(/(?<![A-Z0-9])(\d[A-Z]\d{2}[A-Z]{2,3})(?![A-Z0-9])/);
  return {
    kyHieu: kh ? kh[1] : khDangMau ? khDangMau[1] : null,
    soHoaDon: sh ? sh[1] || sh[0].match(/\d+/)[0] : null,
  };
}

function timSoTienBangChu(text) {
  let m = text.match(/Số tiền\s*(?:viết)?\s*bằng chữ[^:]*:\s*([^\n]+)/i);
  if (m && m[1].trim()) return { text: m[1].replace(/\(.*?\)/g, '').trim(), index: m.index };
  // Dòng bằng chữ đứng riêng (có thể kèm nhãn phía sau sau dấu tab), kết thúc bằng "đồng"
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    const mm = line.trim().match(/^([\p{L}][\p{L}\s,]{8,}đồng(?:\s*chẵn)?)\s*[./]*\s*(?:\t|$)/u);
    if (mm) return { text: mm[1].trim(), index: offset };
    offset += line.length + 1;
  }
  return { text: null, index: null };
}

// ----- Bên bán / bên mua -----
// Dòng chân trang giới thiệu phần mềm hóa đơn (có chứa MST của nhà cung cấp phần mềm)
const RE_DONG_PHAN_MEM = /phần mềm|giải pháp|Phát hành|Khởi tạo|truyền, nhận|Ký bởi|Signed|Đã được ký|Tra cứu|Signature|SOFTDREAMS|meInvoice|Bkav|M-?INVOICE|AsiaInvoice/i;

// MST bên bán = MST xuất hiện ĐẦU TIÊN trong hóa đơn (không tính chân trang nhà cung cấp phần mềm):
// hoặc đi liền sau nhãn "MST/Mã số thuế/Tax code", hoặc đứng riêng một dòng dạng cách chữ số
// ("0 7 0 0 7 5 3 4 8 9" — mẫu EasyInvoice/Bkav). Số 10 chữ số trần không nhãn có thể là số điện thoại nên bỏ qua.
function timMstBenBan(text) {
  const sach = text.split('\n').filter((d) => !RE_DONG_PHAN_MEM.test(d)).join('\n');
  const re = /(?:MST|Mã số thuế|Tax ?code)[^\d\n]{0,40}?((?:\d[ \t]){9}\d|\d{10})(?!\d)|^[ \t]*((?:\d[ \t]){9}\d)[ \t]*$/gim;
  const m = re.exec(sach);
  return m ? (m[1] || m[2]).replace(/\s+/g, '') : null;
}

function kiemTraTruongLaNguoiBan(text) {
  return timMstBenBan(text) === SCHOOL_MST;
}

const RE_TEN_CONG_TY = /^(?:TỔNG\s+)?(?:CÔNG TY|DOANH NGHIỆP|HỘ KINH DOANH|CỬA HÀNG|CHI NHÁNH|TRUNG TÂM|NHÀ MÁY|XÍ NGHIỆP|HỢP TÁC XÃ)\b/i;

function timNguoiBan(text) {
  // 1) Nhãn "Đơn vị bán (hàng) (Seller): Tên công ty" có tên ngay cùng dòng
  let m = text.match(/Đơn vị bán(?:\s*hàng)?\s*(?:\([^)]*\))?\s*:?[ \t]*([^\n]*)/i);
  if (m) {
    const ten = m[1].replace(/^[:\s]+/, '').trim();
    if (ten.length >= 5 && !/^(Mã số thuế|MST|Địa chỉ|Tax)/i.test(ten)) return { tenNguoiBan: ten };
  }
  // 2) Tên công ty đứng thành dòng riêng (MISA, EasyInvoice, M-Invoice...): dòng đầu tiên trông
  //    như tên công ty, không phải bên mua (Trường), không phải chân trang phần mềm/chữ ký.
  for (const dong of layDong(text)) {
    if (RE_TEN_CONG_TY.test(dong) && !/TRƯỜNG/i.test(dong) && !RE_DONG_PHAN_MEM.test(dong)) {
      return { tenNguoiBan: dong };
    }
  }
  // 3) Nhãn "Người bán hàng (Seller): Tên" theo sau bởi mã số thuế
  m = text.match(/Người bán hàng\s*\(?Seller\)?:?\s*([^\n]{5,120})\n[\s\S]{0,150}?(?:Mã số thuế|MST)/i);
  if (m) return { tenNguoiBan: m[1].trim() };
  return { tenNguoiBan: null };
}

function phatHienPhanMem(text) {
  if (/ehoadon\.vn|Bkav/i.test(text)) return 'bkav';
  if (/meinvoice\.vn|MISA/i.test(text)) return 'misa';
  if (/easyinvoice|SOFTDREAMS/i.test(text)) return 'easyinvoice';
  if (/vnpt-invoice|VNPT/i.test(text)) return 'vnpt';
  if (/asiainvoice/i.test(text)) return 'asiainvoice';
  if (/einvoice\.vn|Thái Sơn/i.test(text)) return 'einvoice';
  if (/minvoice\.vn|M-INVOICE|M-invoice/i.test(text)) return 'minvoice';
  return 'khac';
}

// ===================== Tổng tiền =====================

// Tìm tiền hàng / tiền thuế / tổng thanh toán theo NHÃN (không theo vị trí), vì mỗi mẫu hóa đơn
// đặt các con số ở chỗ khác nhau (cùng dòng với nhãn, trước nhãn, hoặc trong bảng "Tổng hợp").
function timTongTien(text) {
  const dongList = layDong(text);
  const ketQua = { tongTienHang: null, tienThue: null, tongCong: null };

  // Bảng tổng hợp: "Tổng cộng: <tiền hàng> <tiền thuế> <cộng tiền thanh toán>"
  const dongTongHop = dongList.find((d) => /^(?:Tổng cộng|Tổng)\b[^:\n]*:/i.test(d) && soTienTrongDong(d).length >= 3);
  if (dongTongHop) {
    const so = soTienTrongDong(dongTongHop);
    ketQua.tongTienHang = so[so.length - 3];
    ketQua.tienThue = so[so.length - 2];
    ketQua.tongCong = so[so.length - 1];
  }

  const layBangNhan = (re) => {
    const d = dongList.find((x) => re.test(x) && soTienTrongDong(x).length > 0);
    if (!d) return null;
    const so = soTienTrongDong(d);
    return so[so.length - 1];
  };
  const tongCongNhan = layBangNhan(/(?:Tổng\s*(?:cộng\s*)?(?:số\s*)?tiền\s*thanh\s*toán|Cộng\s*tiền\s*thanh\s*toán|Total payment)/i);
  if (tongCongNhan !== null) ketQua.tongCong = tongCongNhan;
  if (ketQua.tongTienHang === null) {
    ketQua.tongTienHang = layBangNhan(/(?:Cộng tiền hàng|Thành tiền trước thuế|Tổng tiền hàng|Sub ?total)/i);
  }
  if (ketQua.tienThue === null) {
    ketQua.tienThue = layBangNhan(/(?:Tiền thuế GTGT|VAT amount)/i);
  }
  return ketQua;
}

// ===================== Dòng hàng hóa =====================

// Sai số cho phép giữa SL×ĐG và thành tiền: đơn giá in trên hóa đơn thường đã làm tròn.
const khop = (sl, dg, tt) => Math.abs(sl * dg - tt) <= 0.5 * Math.max(sl, 1) + 1;

// Tách phần đuôi toàn số của một dòng (dòng cuối của một dòng hàng "xuôi").
function tachDuoiDong(dong) {
  const t = dong.trim().split(/\s+/);
  const n = t.length;
  const so = (i) => parseSoVN(t[i]);

  // Hàng khuyến mại / tặng kèm: "... Cái 10,00 X X" (đơn giá, thành tiền ghi chữ X)
  if (n >= 3 && /^X$/i.test(t[n - 1]) && /^X$/i.test(t[n - 2]) && laSo(t[n - 3])) {
    return { khuyenMai: true, sl: so(n - 3), dg: 0, tt: 0, thue: 0, tienThue: 0, head: t.slice(0, n - 3).join(' ') };
  }
  // Có cột thuế: "... SL ĐG TT 8% tiền thuế"
  if (n >= 6 && laSo(t[n - 1]) && RE_THUE_SUAT.test(t[n - 2]) && laSo(t[n - 3]) && laSo(t[n - 4]) && laSo(t[n - 5])) {
    const mt = t[n - 2].match(/^(\d{1,2}(?:,\d+)?)%$/);
    return {
      khuyenMai: false, sl: so(n - 5), dg: so(n - 4), tt: so(n - 3),
      thue: mt ? parseSoVN(mt[1]) : 0, tienThue: so(n - 1), head: t.slice(0, n - 5).join(' '),
    };
  }
  // Không có cột thuế: "... SL ĐG TT" — dễ nhầm với dòng tổng nên bắt buộc SL×ĐG≈TT
  if (n >= 3 && laSo(t[n - 1]) && laSo(t[n - 2]) && laSo(t[n - 3]) && khop(so(n - 3), so(n - 2), so(n - 1))) {
    return { khuyenMai: false, sl: so(n - 3), dg: so(n - 2), tt: so(n - 1), thue: null, tienThue: null, head: t.slice(0, n - 3).join(' ') };
  }
  return null;
}

// Dòng nhãn tiêu đề cột của bảng hàng hóa (và dòng chỉ số cột "1 2 3 4 5 6 = 4 x 5")
const RE_DONG_TIEU_DE_BANG = /^(?:STT|Tên hàng|Đơn vị\b|tính\b|Số lượng|SL\b|ĐVT|Đơn giá|Thành tiền|Thuế suất|GTGT|Tiền thuế|\((?:No|Unit|Quantity|Amount|Description|Name|Tax|VAT|Total))/i;
const RE_DONG_CHI_SO_COT = /^[\d\s=x()+*/.-]+$/i;

const laDongTieuDe = (d) => RE_DONG_TIEU_DE_BANG.test(d) || RE_DONG_CHI_SO_COT.test(d);

// Tách "tên + ĐVT": ĐVT là từ cuối nếu trông như đơn vị tính (chữ, tối đa 12 ký tự, có thể có ²/³/chữ số cuối).
function tachTenVaDvt(chuoi) {
  const tu = chuoi.split(' ');
  if (tu.length >= 2) {
    const cuoi = tu[tu.length - 1];
    if (/^[\p{L}]{1,12}[²³23]?$/u.test(cuoi) && !/^\d+$/.test(cuoi)) {
      return { ten: tu.slice(0, -1).join(' '), dvt: cuoi };
    }
  }
  return { ten: chuoi, dvt: null };
}

function taoDongHang(stt, ten, dvt, tail) {
  const sl = tail.sl;
  const row = {
    stt,
    ten_hang: ten.replace(/\s+/g, ' ').trim(),
    dvt,
    sl_thuc_nhap: sl,
    sl_chung_tu: sl,
    don_gia: tail.dg,
    thanh_tien: tail.tt,
    thue_suat: tail.thue,
    tien_thue: tail.tienThue,
    khuyen_mai: !!tail.khuyenMai,
  };
  // Đơn giá in trên hóa đơn đã làm tròn → SL×ĐG lệch thành tiền vài đồng. Đơn giá "khớp" = TT/SL
  // để phiếu nhập (tự tính lại thành tiền = SL×ĐG) cộng ra đúng tổng tiền hàng của hóa đơn.
  if (sl > 0 && Math.round(sl * tail.dg) !== Math.round(tail.tt)) {
    row.don_gia_khop = Math.round((tail.tt / sl) * 10000) / 10000;
  }
  return row;
}

// ----- Kiểu "xuôi": STT, tên, ĐVT, SL, ĐG, TT [, %thuế, tiền thuế] -----
function trichDongHangXuoi(pages) {
  const items = [];
  let kTiep = 1;

  for (const trang of pages) {
    const dong = layDong(trang);
    const diemKetThuc = dong.map((d) => !!tachDuoiDong(d));
    const dongDauTien = diemKetThuc.indexOf(true);
    if (dongDauTien === -1) continue;

    // Bỏ phần tiêu đề của trang: đến dòng tiêu đề bảng CUỐI CÙNG đứng trước dòng hàng đầu tiên.
    let batDau = 0;
    for (let i = 0; i < dongDauTien; i++) if (laDongTieuDe(dong[i])) batDau = i + 1;

    let dem = [];
    for (let i = batDau; i < dong.length; i++) {
      const tail = diemKetThuc[i] ? tachDuoiDong(dong[i]) : null;
      if (!tail) {
        dem.push(dong[i]);
        continue;
      }
      const head = (dem.join(' ') + ' ' + tail.head).replace(/\s+/g, ' ').trim();
      dem = [];

      // STT mong đợi = số kế tiếp (cho phép rác phía trước ở dòng đầu trang, và nhảy cóc nếu thiếu dòng)
      let stt = null;
      let sauStt = null;
      const mk = head.match(new RegExp(`(?:^|\\s)(${kTiep})(?=\\s)`));
      if (mk) {
        stt = kTiep;
        sauStt = head.slice(mk.index + mk[0].length);
      } else {
        const ml = head.match(/^(\d{1,3})\s+(.*)$/);
        if (ml && Number(ml[1]) > kTiep) {
          stt = Number(ml[1]);
          sauStt = ml[2];
        }
      }
      if (stt === null || !sauStt) continue; // dòng tổng / rác, không phải dòng hàng
      const { ten, dvt } = tachTenVaDvt(sauStt.trim());
      if (!ten) continue;
      items.push(taoDongHang(stt, ten, dvt, tail));
      kTiep = stt + 1;
    }
  }
  return items;
}

// ----- Kiểu "đảo cột": TT, ĐG, SL, ĐVT, tên ..., STT (M-Invoice) -----
function trichDongHangDaoCot(text) {
  const dong = layDong(text);
  const laDongBatDau = (d) => {
    const t = d.split(/\s+/);
    if (t.length < 4 || !laSo(t[0]) || !laSo(t[1]) || !laSo(t[2])) return null;
    if (!/^[\p{L}]{1,12}[²³23]?$/u.test(t[3])) return null;
    const tt = parseSoVN(t[0]);
    const dg = parseSoVN(t[1]);
    const sl = parseSoVN(t[2]);
    if (!khop(sl, dg, tt)) return null;
    return { tt, dg, sl, dvt: t[3], conLai: t.slice(4).join(' ') };
  };

  const items = [];
  let k = 1;
  for (let i = 0; i < dong.length; i++) {
    const bd = laDongBatDau(dong[i]);
    if (!bd) continue;
    const ketThucBangK = new RegExp(`(?:^|\\s)${k}$`);
    let noiDung = bd.conLai;
    let j = i + 1;
    // tên có thể ngắt thành nhiều dòng; STT của dòng nằm CUỐI khối
    while (!ketThucBangK.test(noiDung) && j < dong.length && j - i <= 8 && !laDongBatDau(dong[j])) {
      noiDung += ' ' + dong[j];
      j++;
    }
    if (!ketThucBangK.test(noiDung)) continue;
    const ten = noiDung.replace(ketThucBangK, '').trim();
    items.push(taoDongHang(k, ten, bd.dvt, { sl: bd.sl, dg: bd.dg, tt: bd.tt, thue: null, tienThue: null, khuyenMai: bd.tt === 0 }));
    k++;
    i = j - 1;
  }
  return items;
}

// ===================== Thuế suất =====================

function timThueSuatChung(text) {
  const m =
    text.match(/\((?:VAT|Tax) rate\)\s*:?\s*(\d{1,2}(?:,\d+)?)\s*%/i) ||
    text.match(/(\d{1,2}(?:,\d+)?)\s*%\s*\((?:VAT|Tax) rate\)/i) ||
    text.match(/Thuế suất(?:\s*GTGT)?\s*:?\s*(\d{1,2}(?:,\d+)?)\s*%/i);
  return m ? parseSoVN(m[1]) : null;
}

// ===================== Điều phối =====================

function phanTichVanBan(text, pages) {
  const warnings = [];
  const phanMem = phatHienPhanMem(text);
  const ngay = timNgay(text);
  const { kyHieu, soHoaDon } = timKyHieuSoHoaDon(text);
  const { tenNguoiBan } = timNguoiBan(text);
  const bangChu = timSoTienBangChu(text);
  const tongTien = timTongTien(text);
  const truongLaNguoiBan = kiemTraTruongLaNguoiBan(text);

  if (truongLaNguoiBan) {
    warnings.push(
      'Hóa đơn này có vẻ do Trường xuất ra (Trường là bên bán), không phải hóa đơn mua vật tư. Kiểm tra kỹ trước khi tạo phiếu nhập kho.'
    );
  }

  const cacTrang = pages && pages.length > 0 ? pages.map((p) => p.text) : [text];
  const tongCacDong = (ds) => ds.reduce((s, it) => s + (it.thanh_tien || 0), 0);

  // Chạy cả hai kiểu bố cục, chọn kết quả khớp "Cộng tiền hàng" nhất (hòa thì nhiều dòng hơn).
  const ungVien = [trichDongHangXuoi(cacTrang), trichDongHangDaoCot(cacTrang.join('\n'))];
  const diem = (ds) => {
    if (ds.length === 0) return [Infinity, 0];
    return [tongTien.tongTienHang != null ? Math.abs(tongCacDong(ds) - tongTien.tongTienHang) : 0, -ds.length];
  };
  ungVien.sort((a, b) => {
    const [da, na] = diem(a);
    const [db, nb] = diem(b);
    return da !== db ? da - db : na - nb;
  });
  const items = ungVien[0];

  const tongDong = tongCacDong(items);

  // Hóa đơn không in tiền hàng/tiền thuế bằng nhãn (VD: số nằm trơ trọi dưới bảng): suy ra từ các dòng.
  let tongTienHang = tongTien.tongTienHang;
  let tienThue = tongTien.tienThue;
  if (tongTienHang == null && tongTien.tongCong != null && items.length > 0) {
    const thue = tongTien.tongCong - tongDong;
    if (thue >= 0 && thue <= 0.11 * tongDong) {
      tongTienHang = tongDong;
      if (tienThue == null) tienThue = thue;
    }
  }

  // ----- Thuế suất -----
  const cacMuc = new Map(); // thuế suất -> { thanh_tien, tien_thue }
  items.filter((it) => !it.khuyen_mai && it.thue_suat != null).forEach((it) => {
    const g = cacMuc.get(it.thue_suat) || { thue_suat: it.thue_suat, thanh_tien: 0, tien_thue: 0 };
    g.thanh_tien += it.thanh_tien;
    g.tien_thue += it.tien_thue || 0;
    cacMuc.set(it.thue_suat, g);
  });
  let thueSuat = null;
  let nhieuMucThue = false;
  const mucThue = [...cacMuc.values()];
  if (mucThue.length > 1) {
    nhieuMucThue = true;
    // Phiếu nhập chỉ có 1 ô thuế suất → quy về thuế suất bình quân để tiền thuế vẫn gần đúng hóa đơn.
    const th = tienThue != null ? tienThue : mucThue.reduce((s, g) => s + g.tien_thue, 0);
    const hang = tongTienHang != null ? tongTienHang : tongDong;
    thueSuat = hang > 0 ? Math.round((th / hang) * 100000000) / 1000000 : null;
    warnings.push(
      `Hóa đơn có nhiều mức thuế suất (${mucThue.map((g) => `${g.thue_suat}%: ${g.thanh_tien.toLocaleString('vi-VN')}`).join('; ')}). Phiếu chỉ có 1 ô thuế suất nên đã quy về thuế suất bình quân ${thueSuat}% — tiền thuế có thể lệch vài đồng so với hóa đơn.`
    );
  } else if (mucThue.length === 1) {
    thueSuat = mucThue[0].thue_suat;
  } else {
    thueSuat = timThueSuatChung(text);
    if (thueSuat == null && tienThue != null && tongTienHang > 0) {
      const eff = (tienThue / tongTienHang) * 100;
      thueSuat = [0, 5, 8, 10].find((r) => Math.abs(r - eff) < 0.3) ?? Math.round(eff * 100) / 100;
    }
    // Hóa đơn không có cột thuế trong bảng hàng: gán thuế suất chung cho từng dòng có tiền
    items.forEach((it) => {
      if (it.thue_suat == null) it.thue_suat = it.khuyen_mai ? 0 : thueSuat;
    });
  }

  // Tiền thuế in trên hóa đơn không bằng thuế suất × tiền hàng (quá sai số làm tròn): số tiền trên hóa đơn
  // mới là số kế toán ghi nhận → dùng thuế suất thực tế để phiếu cộng ra đúng tổng hóa đơn, và báo người dùng.
  if (!nhieuMucThue && thueSuat != null && tongTienHang > 0 && tienThue != null) {
    const thueTinh = Math.round((tongTienHang * thueSuat) / 100);
    if (Math.abs(thueTinh - tienThue) > 5) {
      const thueSuatThucTe = Math.round((tienThue / tongTienHang) * 100000000) / 1000000;
      warnings.push(
        `Tiền thuế trên hóa đơn (${tienThue.toLocaleString('vi-VN')}) khác ${thueSuat}% × tiền hàng (${thueTinh.toLocaleString('vi-VN')}) — hóa đơn gốc có thể tính thuế chưa chuẩn. Đã dùng thuế suất thực tế ${thueSuatThucTe}% để tổng khớp hóa đơn.`
      );
      thueSuat = thueSuatThucTe;
    }
  }

  // ----- Cảnh báo -----
  if (items.length === 0) {
    warnings.push('Không tự nhận diện được bảng hàng hóa trong file này. Vui lòng tự thêm từng dòng hàng hóa.');
  } else {
    const soKhuyenMai = items.filter((it) => it.khuyen_mai).length;
    if (soKhuyenMai > 0) {
      warnings.push(`Có ${soKhuyenMai} dòng hàng khuyến mại không thu tiền (đơn giá 0, vẫn nhập vào kho). Kiểm tra lại số lượng.`);
    }
    const stt = items.map((it) => it.stt);
    const thieu = [];
    for (let s = 1; s <= Math.max(...stt); s++) if (!stt.includes(s)) thieu.push(s);
    if (thieu.length > 0) {
      warnings.push(`Thiếu dòng hàng số ${thieu.slice(0, 10).join(', ')}${thieu.length > 10 ? '...' : ''} (STT nhảy cóc) — hãy đối chiếu với hóa đơn và thêm tay.`);
    }
    if (tongTien.tongTienHang != null && Math.abs(tongDong - tongTien.tongTienHang) > 1) {
      warnings.push(
        `Tổng thành tiền các dòng trích được (${tongDong.toLocaleString('vi-VN')}) khác tiền hàng trên hóa đơn (${tongTien.tongTienHang.toLocaleString('vi-VN')}) — có thể còn thiếu/sai dòng hàng, hãy đối chiếu với hóa đơn.`
      );
    }
    const soLamTron = items.filter((it) => it.don_gia_khop !== undefined).length;
    if (soLamTron > 0) {
      warnings.push(`${soLamTron} dòng có đơn giá trên hóa đơn đã làm tròn; đơn giá điền vào phiếu được tính lại (thành tiền ÷ số lượng) để tổng khớp hóa đơn.`);
    }
  }
  if (tongTien.tongCong == null) {
    warnings.push('Không xác định được rõ tổng tiền thanh toán. Vui lòng kiểm tra và nhập lại nếu cần.');
  } else if (tongTienHang != null && tienThue != null && Math.abs(tongTienHang + tienThue - tongTien.tongCong) > 5) {
    warnings.push('Tiền hàng + tiền thuế không bằng tổng thanh toán trên hóa đơn — kiểm tra lại các con số.');
  }
  if (!ngay) warnings.push('Không đọc được ngày hóa đơn, vui lòng nhập tay.');
  if (!tenNguoiBan) warnings.push('Không xác định được tên nhà cung cấp, vui lòng nhập tay.');
  if (!soHoaDon) warnings.push('Không đọc được số hóa đơn, vui lòng nhập tay.');

  return {
    phanMem,
    ngay,
    kyHieu,
    soHoaDon,
    tenNguoiBan,
    tongBangChu: bangChu.text,
    tongTienHang,
    tienThue,
    tongCong: tongTien.tongCong,
    thueSuat,
    nhieuMucThue,
    mucThue,
    truongLaNguoiBan,
    items,
    warnings,
  };
}

async function parsePdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const { text, pages } = await parser.getText();
    return phanTichVanBan(text, pages);
  } finally {
    await parser.destroy(); // giải phóng bộ nhớ cả khi file PDF hỏng
  }
}

module.exports = { parsePdfBuffer };
