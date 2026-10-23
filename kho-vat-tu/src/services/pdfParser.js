// Trích xuất dữ liệu từ hóa đơn GTGT dạng PDF (bản thể hiện hóa đơn điện tử).
//
// QUAN TRỌNG: mỗi phần mềm xuất hóa đơn điện tử (EInvoice/Thái Sơn, Bkav eHoadon,
// M-Invoice, MISA meInvoice...) sắp xếp văn bản trong file PDF khác nhau, có nơi
// đúng thứ tự đọc, có nơi bị xáo trộn (nhãn và giá trị tách rời nhau). Vì vậy đây
// là trích xuất "cố gắng tốt nhất" (best-effort): luôn trả về kèm "warnings" và
// phải cho người dùng xem lại, sửa trước khi lưu thành phiếu nhập kho — không
// bao giờ tự động lưu thẳng vào hệ thống.
const { PDFParse } = require('pdf-parse');

const SCHOOL_MST = '0100729188';

const DVT_LIST = [
  'Mét', 'Cái', 'Chiếc', 'Bộ', 'Kg', 'Cây', 'Cuộn', 'Gói', 'Hộp', 'Chai',
  'Bình', 'Tờ', 'M²', 'M2', 'Đôi', 'Thùng', 'Tấm', 'Lít', 'Bao', 'Thanh', 'm',
];
const DVT_ALT = DVT_LIST.map((d) => d.replace(/[²]/g, '\\u00b2')).join('|');

const SO_VN = '\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?'; // vd: 1.259.259  hoặc  12.592,59

function parseSoVN(s) {
  if (s === undefined || s === null) return null;
  const cleaned = String(s).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function layDong(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

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
  return {
    kyHieu: kh ? kh[1] : null,
    soHoaDon: sh ? sh[1] || sh[0].match(/\d+/)[0] : null,
  };
}

function timSoTienBangChu(text) {
  let m = text.match(/Số tiền\s*(?:viết)?\s*bằng chữ[^:]*:?\s*([^\n]+)/i);
  if (m) return { text: m[1].replace(/\(.*?\)/g, '').trim(), index: m.index };
  // fallback: dòng đứng riêng toàn chữ, kết thúc bằng "đồng" (kiểu hóa đơn bị xáo trộn thứ tự)
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[\p{L}][\p{L}\s]{8,}đồng(\s*chẵn)?\s*\.?\/?\.?\s*$/u.test(trimmed)) {
      return { text: trimmed, index: offset };
    }
    offset += line.length + 1;
  }
  return { text: null, index: null };
}

function timTongTien(text, bangChuIndex) {
  const idx = bangChuIndex == null ? text.length : bangChuIndex;

  // Ước lượng trước bằng vị trí: 3 số tiền đứng ngay trước dòng "bằng chữ" thường là
  // [tiền hàng, tiền thuế, tổng cộng] theo đúng thứ tự này ở mọi mẫu đã kiểm tra.
  const beforeText = text.slice(Math.max(0, idx - 700), idx);
  const soList = [...beforeText.matchAll(/\d{1,3}(?:\.\d{3})+/g)].map((m) => parseSoVN(m[0]));
  let ketQua = { tongTienHang: null, tienThue: null, tongCong: null };
  if (soList.length >= 3) {
    ketQua = {
      tongTienHang: soList[soList.length - 3],
      tienThue: soList[soList.length - 2],
      tongCong: soList[soList.length - 1],
    };
  } else if (soList.length === 2) {
    ketQua = { tongTienHang: soList[0], tienThue: null, tongCong: soList[1] };
  } else if (soList.length === 1) {
    ketQua = { tongTienHang: null, tienThue: null, tongCong: soList[0] };
  }

  // Ghi đè bằng dòng có nhãn rõ ràng kiểu "Tổng cộng: 363.204.038 29.699.194 392.903.232" —
  // luôn lấy SỐ CUỐI CÙNG trên dòng đó vì cột cuối luôn là tổng tiền thanh toán.
  const windowText = text.slice(Math.max(0, idx - 900), Math.min(text.length, idx + 300));
  const dongNhan = windowText
    .split('\n')
    .find((d) => /(?:Tổng tiền thanh toán|Tổng cộng|Cộng tiền thanh toán)/i.test(d) && /\d{1,3}(?:\.\d{3})+/.test(d));
  if (dongNhan) {
    const soTrenDong = [...dongNhan.matchAll(/\d{1,3}(?:\.\d{3})+/g)].map((m) => parseSoVN(m[0]));
    ketQua.tongCong = soTrenDong[soTrenDong.length - 1];
  }

  return ketQua;
}

function timNguoiBan(text) {
  // Ưu tiên khối "Tên công ty" đứng ngay trước dòng "Mã số thuế" (kiểu MISA, EInvoice).
  let m = text.match(/([^\n]*CÔNG TY[^\n]*)\n\s*Mã số thuế\s*(?:\([^)]*\))?:?\s*[\d\s]{10,14}/i);
  if (m) return { tenNguoiBan: m[1].trim() };
  // Nhãn "Đơn vị bán (Seller): Tên" — chỉ nhận khi có "Mã số thuế" theo ngay sau,
  // để không bắt nhầm vào dòng tiêu đề chữ ký "Người bán hàng (Seller)" ở cuối hóa đơn.
  m = text.match(/(?:Đơn vị bán|Người bán hàng)\s*\(?Seller\)?:?\s*([^\n]{5,120})\n[\s\S]{0,150}?(?:Mã số thuế|MST)/i);
  if (m) return { tenNguoiBan: m[1].trim() };
  return { tenNguoiBan: null };
}

// Cắt bỏ phần header phía trên bảng hàng hóa (tên đơn vị, địa chỉ, mã số thuế...)
// để tránh dòng hàng đầu tiên "nuốt" nhầm toàn bộ văn bản phía trước nó.
function vungVanBanHangHoa(text) {
  const m = text.match(/Tiền thuế[^\n]*\n?/i) || text.match(/Thành tiền[^\n]*\n?/i);
  const start = m ? m.index + m[0].length : 0;

  // Bỏ các dòng nhiễu ngay sau tiêu đề bảng: dòng chỉ có "(Tax Amount)", hoặc dòng
  // chỉ số cột kiểu "1 2 3 4 5 6 = 4 x 5 7 8 = 6 x 7" — nếu không bỏ, dòng hàng đầu
  // tiên sẽ bị "nuốt" nhầm các dòng này vào tên hàng.
  const dongList = text.slice(start).split('\n');
  let i = 0;
  while (i < dongList.length) {
    const d = dongList[i].trim();
    const laDongNgoacDon = /^\([^)]*\)$/.test(d);
    const laDongChiSoCot = d !== '' && /^[\d\s=x]+$/i.test(d);
    if (d === '' || laDongNgoacDon || laDongChiSoCot) {
      i++;
      continue;
    }
    break;
  }
  return dongList.slice(i).join('\n');
}

function kiemTraTruongLaNguoiBan(text) {
  const matches = [...text.matchAll(/\b(\d[\d\s]{8,12}\d)\b/g)]
    .map((m) => m[1].replace(/\s+/g, ''))
    .filter((s) => s.length === 10);
  return matches.length > 0 && matches[0] === SCHOOL_MST;
}

// Trích các dòng hàng hóa dạng có cột Thuế suất/Tiền thuế (Bkav, MISA...)
function trichDongHangCoThue(text) {
  const re = new RegExp(
    `(\\d{1,3})\\s+([\\s\\S]+?)\\s+(${DVT_ALT})\\s+(${SO_VN})\\s+(${SO_VN})\\s+(${SO_VN})\\s+(\\d{1,2})%\\s+(${SO_VN})`,
    'g'
  );
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      stt: parseInt(m[1], 10),
      ten_hang: m[2].replace(/\s+/g, ' ').trim(),
      dvt: m[3],
      sl_thuc_nhap: parseSoVN(m[4]),
      sl_chung_tu: parseSoVN(m[4]),
      don_gia: parseSoVN(m[5]),
      thanh_tien: parseSoVN(m[6]),
      thue_suat: parseInt(m[7], 10),
      tien_thue: parseSoVN(m[8]),
    });
  }
  return out;
}

// Trích các dòng hàng hóa dạng không có cột thuế (EInvoice, M-Invoice đơn giản)
function trichDongHangKhongThue(text) {
  const re = new RegExp(
    `(\\d{1,3})\\s+([\\s\\S]+?)\\s+(${DVT_ALT})\\s+(${SO_VN})\\s+(${SO_VN})\\s+(${SO_VN})(?=\\s|$)`,
    'g'
  );
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      stt: parseInt(m[1], 10),
      ten_hang: m[2].replace(/\s+/g, ' ').trim(),
      dvt: m[3],
      sl_thuc_nhap: parseSoVN(m[4]),
      sl_chung_tu: parseSoVN(m[4]),
      don_gia: parseSoVN(m[5]),
      thanh_tien: parseSoVN(m[6]),
    });
  }
  return out;
}

function phatHienNhaCungCapPhanMem(text) {
  if (/ehoadon\.vn|Bkav/i.test(text)) return 'bkav';
  if (/meinvoice\.vn|MISA/i.test(text)) return 'misa';
  if (/einvoice\.vn|Thái Sơn/i.test(text)) return 'einvoice';
  if (/minvoice\.vn|M-INVOICE|M-invoice/i.test(text)) return 'minvoice';
  return 'khac';
}

async function parsePdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  await parser.destroy();

  const warnings = [];
  const phanMem = phatHienNhaCungCapPhanMem(text);
  const ngay = timNgay(text);
  const { kyHieu, soHoaDon } = timKyHieuSoHoaDon(text);
  const { tenNguoiBan } = timNguoiBan(text);
  const bangChu = timSoTienBangChu(text);
  const tongTien = timTongTien(text, bangChu.index);
  const truongLaNguoiBan = kiemTraTruongLaNguoiBan(text);

  if (truongLaNguoiBan) {
    warnings.push(
      'Hóa đơn này có vẻ do Trường xuất ra (Trường là bên bán), không phải hóa đơn mua vật tư. Kiểm tra kỹ trước khi tạo phiếu nhập kho.'
    );
  }

  const vungHangHoa = vungVanBanHangHoa(text);
  let items = trichDongHangCoThue(vungHangHoa);
  if (items.length === 0) items = trichDongHangKhongThue(vungHangHoa);
  if (items.length === 0) {
    warnings.push('Không tự nhận diện được bảng hàng hóa trong file này. Vui lòng tự thêm từng dòng hàng hóa.');
  } else if (phanMem !== 'bkav' && phanMem !== 'misa') {
    warnings.push('Định dạng hóa đơn này ít gặp hơn, bảng hàng hóa trích ra có thể thiếu/sai. Kiểm tra kỹ số lượng và đơn giá từng dòng.');
  }
  if (!tongTien.tongCong) {
    warnings.push('Không xác định được rõ tổng tiền thanh toán. Vui lòng kiểm tra và nhập lại nếu cần.');
  }
  if (!ngay) warnings.push('Không đọc được ngày hóa đơn, vui lòng nhập tay.');
  if (!tenNguoiBan) warnings.push('Không xác định được tên nhà cung cấp, vui lòng nhập tay.');

  return {
    phanMem,
    ngay,
    kyHieu,
    soHoaDon,
    tenNguoiBan,
    tongBangChu: bangChu.text,
    tongTienHang: tongTien.tongTienHang,
    tienThue: tongTien.tienThue,
    tongCong: tongTien.tongCong,
    truongLaNguoiBan,
    items,
    warnings,
  };
}

module.exports = { parsePdfBuffer, parseSoVN };
