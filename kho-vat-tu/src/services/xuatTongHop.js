// "TỔNG HỢP NHẬP XUẤT VẬT TƯ" (sổ theo dõi chi tiết của Phòng KH-TC): xuất ra Excel với
// form lấy nguyên từ file mẫu (3 sheet quý của năm 2013): khổ A4 ngang, header 3 tầng
// dòng 6-8, nhóm cột TK661.2 (M-U) và TK 337 (V-AD), font Arial Narrow 8, viền thin/hair.
// Dữ liệu mẫu 2013 KHÔNG dùng — chỉ lấy cấu trúc/định dạng; số liệu thật lấy từ DB.
//
// Mỗi dòng của sổ = 1 mặt hàng: phần Nhập và phần Xuất nằm cùng 1 dòng (nếu chưa xuất thì
// phần Xuất trống). Một dòng nhập xuất làm nhiều phiếu → dòng xuất đầu ghép chung dòng nhập,
// các dòng xuất sau mỗi cái 1 dòng riêng (phần Nhập trống, không tính nhập 2 lần).
//
// Hàm ghép dòng `taoDongSoTongHop` là hàm THUẦN (không đụng DB) để dễ kiểm thử.
const ExcelJS = require('exceljs');

// ---------------------------------------------------------------------------------
// Hằng số định dạng (lấy từ file mẫu)
// ---------------------------------------------------------------------------------
const NUMFMT = '_(* #,##0_);_(* (#,##0);_(* -??_);_(@_)';
const NUMFMT_2 = '_(* #,##0.00_);_(* (#,##0.00);_(* -??_);_(@_)';

// Mẫu gốc có SUM cả cột Đơn giá ở dòng TỔNG CỘNG, nhưng cộng đơn giá vô nghĩa về nghiệp vụ và
// con số tràn cột hẹp (hiện ####), nên để TRỐNG các ô Đơn giá ở dòng tổng. Đặt true nếu muốn
// SUM đơn giá như mẫu.
const TONG_CA_DON_GIA = false;

const HANG_DAU_DU_LIEU = 9; // dòng dữ liệu đầu tiên (dòng 6-8 là header)
const SO_COT = 30; // A..AD
const CAC_QUY_LA_MA = ['I', 'II', 'III', 'IV'];

// Độ rộng cột: lấy từ sheet "QUÝ III - 2013" của file mẫu (3 sheet mẫu mỗi sheet chỉnh độ rộng
// hơi khác nhau), có 3 chỗ LỆCH CÓ CHỦ Ý:
//  - D và H (Đơn vị công tác) nới từ 3.87/4.5 lên 9.5: tên đơn vị thật như "Phòng QLCSVC TB và DA"
//    quá dài cho cột hẹp (gãy từng chữ, mọi dòng cao 4 dòng chữ). Tổng độ rộng A..L tăng 14.9%.
//  - A và E (ngày) nới ~10%: mẫu dùng font Normal .VnTime 12 còn ExcelJS ghi Calibri 11 nên độ
//    rộng tính theo ký tự lệch pixel; "dd/mm/yyyy" ở 6.37 sát giới hạn.
//  - S..AD trong sheet III chỉ rộng 4.99 (mẫu để trống nhóm Tồn và nhóm TK 337) → quá hẹp để chứa
//    đơn giá / thành tiền; dùng độ rộng nhóm TK661.2 và độ rộng thực tế ở sheet QUÝ I/II của mẫu.
const DO_RONG_661 = [7.25, 7.5, 8.62, 4.5, 9.5, 8.24, 4.62, 7.5, 8.62]; // M..U
const DO_RONG_337 = [7.25, 7.5, 8.62, 6.62, 9.5, 8.99, 6.99, 7.62, 8.87]; // V..AD
const DO_RONG_COT = [
  7.0, 3.74, 10.99, 9.5, 7.15, 4.87, 10.87, 9.5, 16.5, 3.87, 3.62, 4.25,
  ...DO_RONG_661,
  ...DO_RONG_337,
];

// ---------------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------------
const so = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const pad2 = (n) => String(n).padStart(2, '0');
// Ký tự cấm trong XML 1.0 (ExcelJS chỉ bỏ nhóm C0 nên U+FFFE/U+FFFF và surrogate lẻ vẫn làm
// hỏng file): bỏ hết trước khi ghi vào ô hoặc trả JSON.
const KY_TU_CAM_XML =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const sach = (v) => String(v).replace(KY_TU_CAM_XML, '').slice(0, 32000);
const chuoi = (v) => (v === null || v === undefined ? '' : sach(v).trim());
// Làm tròn đến đồng, nửa ra xa số 0 — giống hàm ROUND của Excel.
const lamTron = (x) => Math.sign(x) * Math.round(Math.abs(x));

function chuanNhom(v) {
  return String(v || '').includes('337') ? '337' : '661.2';
}

// Chuẩn hóa về 'YYYY-MM-DD' ('' nếu không đọc được). Nhận 'YYYY-MM-DD...' hoặc 'dd/mm/yyyy'.
function chuanNgay(v) {
  const s = chuoi(v);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  return '';
}

function ngayHienThi(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// Khóa so sánh "tự nhiên" cho số phiếu: 'PN 9' < 'PN 10'.
function soPhieuKey(s) {
  const t = chuoi(s);
  const m = t.match(/^(.*?)(\d+)\s*$/);
  return m ? { tien: m[1].trim().toLowerCase(), so: Number(m[2]) } : { tien: t.toLowerCase(), so: -1 };
}
function soSanhSoPhieu(a, b) {
  const x = soPhieuKey(a);
  const y = soPhieuKey(b);
  if (x.tien !== y.tien) return x.tien < y.tien ? -1 : 1;
  return x.so - y.so;
}
const soSanhChuoi = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function khoaVatTu(it) {
  if (it.vat_tu_id !== null && it.vat_tu_id !== undefined) return `id:${it.vat_tu_id}`;
  return `ten:${chuoi(it.ten_hang).toLowerCase().replace(/\s+/g, ' ')}`;
}

// Thành tiền trên dòng sổ = ROUND(SL x Đơn giá, 0) (phiếu nhập/xuất cũng làm tròn như vậy).
// Thành tiền trong DB là số được lưu (cơ sở của "tổng tiền hàng" trên phiếu); nếu đơn giá lệch
// khiến ROUND(SL x ĐG) khác ROUND(thành tiền DB) thì đơn giá được tính lại = thành tiền / SL để
// tổng khớp phiếu. Trả {dg, tt, tinhLai}.
function chuanDonGia(sl, dg, tt) {
  let dgOut = r6(dg);
  let tinhLai = false;
  if (sl > 0 && tt > 0) {
    if (dgOut === 0) {
      dgOut = r6(tt / sl);
    } else if (lamTron(sl * dgOut) !== lamTron(tt)) {
      dgOut = r6(tt / sl);
      tinhLai = true;
    }
  }
  return { dg: dgOut, tt: lamTron(sl * dgOut), tinhLai };
}

// ---------------------------------------------------------------------------------
// Ghép dòng sổ tổng hợp (hàm thuần)
// ---------------------------------------------------------------------------------
// phieuNhapList: [{id, so_phieu, ngay, nguoi_nhap, don_vi, tk_doi_ung, tieu_muc, nguon_kinh_phi,
//                  items:[{id, vat_tu_id, stt, ten_hang, dvt, sl_thuc_nhap, don_gia, thanh_tien, tieu_muc}]}]
// phieuXuatList: [{id, so_phieu, ngay, nguoi_nhan, don_vi, tk_doi_ung, tieu_muc, nguon_kinh_phi,
//                  items:[{id, vat_tu_id, stt, ten_hang, dvt, sl_thuc_xuat, don_gia, thanh_tien,
//                          tieu_muc, phieu_nhap_item_id}]}]
// ky (tuỳ chọn): {tu, den, gomKhongNgay} ('YYYY-MM-DD'). Không truyền = lấy hết.
//
// Cần truyền TOÀN BỘ phiếu (không lọc kỳ trước) vì việc ghép nhập↔xuất và số tồn lũy kế phải
// tính trên cả chuỗi nhập→xuất. Lọc kỳ (đúng như mẫu: sheet quý = nhập trong quý + xuất trong
// quý) được làm TRONG hàm này, theo từng PHẦN của dòng:
//   - phần NHẬP chỉ hiện nếu ngày nhập thuộc kỳ; phần XUẤT chỉ hiện nếu ngày xuất thuộc kỳ;
//   - dòng nhập kỳ này, xuất kỳ sau: sheet kỳ này chỉ có phần nhập (xuất hiện ở sheet kỳ sau);
//   - dòng xuất kỳ này, nhập kỳ trước: phần Nhập (cả ngày/phiếu/người nhập) để TRỐNG như mẫu,
//     cột Tồn vẫn là số tồn lũy kế theo cả chuỗi (giá trị cố định, tham chiếu nhập ở
//     `tham_chieu_nhap`);
//   - phiếu xuất không ngày nhưng có liên kết: dùng ngày của dòng nhập để xếp kỳ;
//     không ngày và không liên kết: chỉ đưa vào kỳ "cả năm"/"tuỳ chọn" (ky.gomKhongNgay), kèm cảnh báo.
// Trả về mảng dòng đã sắp xếp (xem `moDong`).
function taoDongSoTongHop(phieuNhapList, phieuXuatList, ky) {
  const trongKy = (ngay) => {
    if (!ky) return true;
    return (!ky.tu || ngay >= ky.tu) && (!ky.den || ngay <= ky.den);
  };
  const gomKhongNgay = !ky || !!ky.gomKhongNgay;
  // Phần có ngày thì xét theo kỳ; không có ngày thì chỉ hiện khi gomKhongNgay.
  const hienNgay = (ngay) => (ngay ? trongKy(ngay) : gomKhongNgay);

  const nhapNodes = [];
  const nhapTheoId = new Map();
  for (const p of phieuNhapList || []) {
    (p.items || []).forEach((it, idx) => {
      const sl = so(it.sl_thuc_nhap);
      const g = chuanDonGia(sl, so(it.don_gia), so(it.thanh_tien));
      const node = {
        p, it, sl, dg: g.dg, tt: g.tt, tinhLai: g.tinhLai,
        ngay: chuanNgay(p.ngay),
        nhom: chuanNhom(p.nguon_kinh_phi),
        key: khoaVatTu(it),
        thuTu: idx,
        xuat: [],
        daXuat: 0,
      };
      nhapNodes.push(node);
      if (it.id !== null && it.id !== undefined) nhapTheoId.set(Number(it.id), node);
    });
  }

  const xuatNodes = [];
  for (const q of phieuXuatList || []) {
    (q.items || []).forEach((it, idx) => {
      const sl = so(it.sl_thuc_xuat);
      const g = chuanDonGia(sl, so(it.don_gia), so(it.thanh_tien));
      xuatNodes.push({
        q, it, sl, dg: g.dg, tt: g.tt, tinhLai: g.tinhLai,
        ngay: chuanNgay(q.ngay),
        ngayHL: '', // ngày dùng để xếp kỳ (thiếu ngày thì lấy ngày dòng nhập đã liên kết)
        nhom: chuanNhom(q.nguon_kinh_phi),
        key: khoaVatTu(it),
        thuTu: idx,
        nhapNode: null,
        ghep: '',
      });
    });
  }

  const gan = (x, n, ghep) => {
    x.nhapNode = n;
    x.ghep = ghep;
    n.xuat.push(x);
    n.daXuat += x.sl;
  };

  // 1) Dòng xuất đã có liên kết phieu_nhap_item_id → gắn thẳng.
  const chuaGhep = [];
  for (const x of xuatNodes) {
    const id = x.it.phieu_nhap_item_id;
    const n = id !== null && id !== undefined && id !== '' ? nhapTheoId.get(Number(id)) : null;
    if (n) gan(x, n, 'lien_ket');
    else chuaGhep.push(x);
  }

  // 2) Dự phòng cho dòng xuất chưa liên kết (dữ liệu cũ): cùng vật tư + cùng nguồn kinh phí +
  //    ngày nhập <= ngày xuất, lấy dòng nhập GẦN NHẤT.
  //    Bậc 1: dòng nhập chưa bị xuất lần nào, cùng SL và đơn giá.
  //    Bậc 2: cùng đơn giá và SL còn lại của dòng nhập >= SL xuất (xuất một phần).
  chuaGhep.sort(
    (a, b) =>
      soSanhChuoi(a.ngay, b.ngay) || (a.q.id || 0) - (b.q.id || 0) || a.thuTu - b.thuTu
  );
  const EPS = 1e-9;
  const ganNhat = (ds) =>
    ds.sort((a, b) => soSanhChuoi(b.ngay, a.ngay) || (b.it.id || 0) - (a.it.id || 0))[0] || null;
  for (const x of chuaGhep) {
    const ungVien = nhapNodes.filter(
      (n) =>
        n.key === x.key &&
        n.nhom === x.nhom &&
        n.ngay &&
        x.ngay &&
        n.ngay <= x.ngay &&
        Math.abs(n.dg - x.dg) < 0.01
    );
    const bac1 = ganNhat(
      ungVien.filter((n) => n.xuat.length === 0 && Math.abs(n.sl - x.sl) < EPS)
    );
    if (bac1) {
      gan(x, bac1, 'du_phong');
      continue;
    }
    const bac2 = ganNhat(ungVien.filter((n) => n.sl - n.daXuat >= x.sl - EPS));
    if (bac2) gan(x, bac2, 'du_phong');
  }
  for (const x of xuatNodes) x.ngayHL = x.ngay || (x.nhapNode ? x.nhapNode.ngay : '');

  // 3) Dựng dòng.
  const nhom = [];
  const NGAY_CUOI = '9999-12-31';

  const tieuMucCuaNhap = (n) => chuoi(n.it.tieu_muc) || chuoi(n.p.tieu_muc);
  const tieuMucCuaXuat = (x) => chuoi(x.it.tieu_muc) || chuoi(x.q.tieu_muc);

  const moDong = () => ({
    loai: '',
    nhom: '661.2',
    ngay_loc: '',
    ngay_nhap: '', so_phieu_nhap: '', nguoi_nhap: '', don_vi_nhap: '',
    ngay_xuat: '', so_phieu_xuat: '', nguoi_linh: '', don_vi_xuat: '',
    ten_hang: '', tk_doi_ung: '', tieu_muc: '', dvt: '',
    sl_nhap: null, dg_nhap: null, tt_nhap: null,
    sl_xuat: null, dg_xuat: null, tt_xuat: null,
    sl_ton: null, dg_ton: null, tt_ton: null,
    co_nhap: false, co_xuat: false, co_ton: false, tiep: false,
    // 'chinh' (=Nhập-Xuất), 'tiep' (=Tồn dòng trên-Xuất) hoặc null (giá trị cố định, không
    // thể tính bằng công thức vì dòng nhập/xuất trước nằm ngoài sheet).
    ton_cong_thuc: null,
    tham_chieu_nhap: null, // dòng xuất mà phần Nhập nằm ở kỳ khác: {ngay_nhap, so_phieu_nhap, ...}
    phieu_nhap_id: null, phieu_nhap_item_id: null, phieu_xuat_id: null, phieu_xuat_item_id: null,
    ghep: '',
    dg_tinh_lai: false,
    canh_bao: [],
  });

  const dienNhap = (d, n) => {
    d.co_nhap = true;
    d.ngay_nhap = n.ngay;
    d.so_phieu_nhap = chuoi(n.p.so_phieu);
    d.nguoi_nhap = chuoi(n.p.nguoi_nhap);
    d.don_vi_nhap = chuoi(n.p.don_vi);
    d.sl_nhap = n.sl;
    d.dg_nhap = n.dg;
    d.tt_nhap = n.tt;
    d.phieu_nhap_id = n.p.id ?? null;
    d.phieu_nhap_item_id = n.it.id ?? null;
    if (n.tinhLai) d.dg_tinh_lai = true;
    if (!n.ngay) d.canh_bao.push('Phiếu nhập không có ngày: chỉ hiện trong báo cáo cả năm / tuỳ chọn.');
  };
  const dienXuat = (d, x) => {
    d.co_xuat = true;
    d.ngay_xuat = x.ngay;
    d.so_phieu_xuat = chuoi(x.q.so_phieu);
    d.nguoi_linh = chuoi(x.q.nguoi_nhan);
    d.don_vi_xuat = chuoi(x.q.don_vi);
    d.sl_xuat = x.sl;
    d.dg_xuat = x.dg;
    d.tt_xuat = x.tt;
    d.phieu_xuat_id = x.q.id ?? null;
    d.phieu_xuat_item_id = x.it.id ?? null;
    d.ghep = x.ghep;
    if (x.tinhLai) d.dg_tinh_lai = true;
    if (!x.ngay) {
      d.canh_bao.push(
        x.nhapNode
          ? 'Phiếu xuất không có ngày: xếp kỳ theo ngày của dòng nhập đã liên kết.'
          : 'Phiếu xuất không có ngày và chưa liên kết dòng nhập: chỉ hiện trong báo cáo cả năm / tuỳ chọn.'
      );
    }
  };
  const dienTon = (d, slTon, dg, congThuc) => {
    d.co_ton = true;
    d.ton_cong_thuc = congThuc;
    d.sl_ton = r6(slTon);
    d.dg_ton = dg;
    d.tt_ton = lamTron(d.sl_ton * dg);
    if (d.sl_ton < -1e-9) {
      d.canh_bao.push(`Tồn âm (${d.sl_ton}): số lượng xuất vượt số lượng nhập của dòng này.`);
    }
  };
  const chiXuat = (x, loai, canhBao) => {
    const d = moDong();
    d.loai = loai;
    d.nhom = x.nhom;
    d.ten_hang = chuoi(x.it.ten_hang);
    d.dvt = chuoi(x.it.dvt);
    d.tk_doi_ung = chuoi(x.q.tk_doi_ung);
    d.tieu_muc = tieuMucCuaXuat(x);
    dienXuat(d, x);
    (canhBao || []).forEach((c) => d.canh_bao.push(c));
    nhom.push({
      ngay: x.ngayHL || NGAY_CUOI,
      loai: 1,
      soPhieu: chuoi(x.q.so_phieu),
      pid: x.q.id || 0,
      thuTu: x.it.id || x.thuTu,
      dong: [d],
    });
    return d;
  };

  // 3a) Theo từng dòng nhập (+ chuỗi các dòng xuất của nó)
  for (const n of nhapNodes) {
    const ds = n.xuat.slice().sort(
      (a, b) =>
        soSanhChuoi(a.ngayHL, b.ngayHL) || (a.q.id || 0) - (b.q.id || 0) || a.thuTu - b.thuTu
    );
    const cung = ds.filter((x) => x.nhom === n.nhom);
    const lech = ds.filter((x) => x.nhom !== n.nhom);
    // Tồn lũy kế sau mỗi lần xuất, tính trên TOÀN BỘ chuỗi (kể cả phần ngoài kỳ).
    let con = n.sl;
    const tonSau = cung.map((x) => {
      con -= x.sl;
      return con;
    });

    if (hienNgay(n.ngay)) {
      const dong = [];
      let lienTuc = true; // các lần xuất trước đó đều đã nằm ngay phía trên trong sheet
      let soDaVe = 0;
      cung.forEach((x, i) => {
        if (!hienNgay(x.ngayHL)) {
          lienTuc = false;
          return;
        }
        const d = moDong();
        const dau = dong.length === 0;
        d.nhom = n.nhom;
        d.ten_hang = chuoi(n.it.ten_hang) || chuoi(x.it.ten_hang);
        d.dvt = chuoi(n.it.dvt) || chuoi(x.it.dvt);
        if (dau) {
          d.loai = 'nhap_xuat';
          dienNhap(d, n);
          d.tk_doi_ung = chuoi(n.p.tk_doi_ung) || chuoi(x.q.tk_doi_ung);
          d.tieu_muc = tieuMucCuaNhap(n) || tieuMucCuaXuat(x);
        } else {
          d.loai = 'xuat_tiep';
          d.tiep = true;
          d.tk_doi_ung = chuoi(x.q.tk_doi_ung) || chuoi(n.p.tk_doi_ung);
          d.tieu_muc = tieuMucCuaXuat(x) || tieuMucCuaNhap(n);
        }
        dienXuat(d, x);
        const ct = lienTuc && i === soDaVe ? (dau ? 'chinh' : 'tiep') : null;
        dienTon(d, tonSau[i], n.dg, ct);
        soDaVe += 1;
        dong.push(d);
      });
      if (dong.length === 0) {
        // Chưa xuất (hoặc xuất ở kỳ sau): chỉ có phần nhập; Tồn = số tồn cuối kỳ.
        const d = moDong();
        d.loai = 'chi_nhap';
        d.nhom = n.nhom;
        d.ten_hang = chuoi(n.it.ten_hang);
        d.dvt = chuoi(n.it.dvt);
        d.tk_doi_ung = chuoi(n.p.tk_doi_ung);
        d.tieu_muc = tieuMucCuaNhap(n);
        dienNhap(d, n);
        dienTon(d, n.sl, n.dg, 'chinh');
        dong.push(d);
      }
      nhom.push({
        ngay: n.ngay || NGAY_CUOI,
        loai: 0,
        soPhieu: chuoi(n.p.so_phieu),
        pid: n.p.id || 0,
        thuTu: n.it.id || n.thuTu,
        dong,
      });
    } else {
      // Nhập ở kỳ khác: chỉ những lần xuất nằm trong kỳ này, phần Nhập để trống.
      cung.forEach((x, i) => {
        if (!hienNgay(x.ngayHL)) return;
        const d = chiXuat(x, 'xuat_nhap_ngoai_ky');
        d.ten_hang = chuoi(n.it.ten_hang) || d.ten_hang;
        d.dvt = chuoi(n.it.dvt) || d.dvt;
        d.tk_doi_ung = d.tk_doi_ung || chuoi(n.p.tk_doi_ung);
        d.tieu_muc = d.tieu_muc || tieuMucCuaNhap(n);
        d.tham_chieu_nhap = {
          ngay_nhap: n.ngay,
          so_phieu_nhap: chuoi(n.p.so_phieu),
          phieu_nhap_id: n.p.id ?? null,
          phieu_nhap_item_id: n.it.id ?? null,
        };
        dienTon(d, tonSau[i], n.dg, null);
      });
    }

    // Xuất khác nguồn kinh phí với dòng nhập → không thể gộp chung nhóm cột → dòng riêng.
    for (const x of lech) {
      if (!hienNgay(x.ngayHL)) continue;
      chiXuat(x, 'chi_xuat', [
        `Xuất theo nguồn TK ${x.nhom} nhưng hàng nhập theo nguồn TK ${n.nhom} (phiếu ${chuoi(n.p.so_phieu)}): ` +
          'tách thành dòng riêng, cột Tồn để trống.',
      ]);
    }
  }

  // 3b) Dòng chỉ có xuất (không tìm được dòng nhập)
  for (const x of xuatNodes) {
    if (x.nhapNode || !hienNgay(x.ngay)) continue;
    chiXuat(x, 'chi_xuat', [
      'Chưa tìm thấy dòng nhập tương ứng (có thể nhập ở kỳ trước hoặc chưa liên kết phiếu nhập): cột Nhập và Tồn để trống.',
    ]);
  }

  // 4) Sắp xếp theo ngày nhập (dòng chỉ-có-xuất theo ngày xuất) rồi số phiếu.
  nhom.sort(
    (a, b) =>
      soSanhChuoi(a.ngay, b.ngay) ||
      a.loai - b.loai ||
      soSanhSoPhieu(a.soPhieu, b.soPhieu) ||
      a.pid - b.pid ||
      a.thuTu - b.thuTu
  );
  const ketQua = [];
  for (const g of nhom) {
    for (const d of g.dong) {
      d.ngay_loc = g.ngay === NGAY_CUOI ? '' : g.ngay;
      ketQua.push(d);
    }
  }
  return ketQua;
}

// Tổng cộng theo từng nhóm TK, khớp với dòng "TỔNG CỘNG" của sheet:
// Nhập = SUM các dòng, Xuất = SUM các dòng, Tồn = Nhập − Xuất (KHÔNG cộng cột Tồn từng dòng,
// vì Tồn từng dòng là số lũy kế nên cộng lại sẽ tính trùng).
// Đơn giá cộng lại không có nghĩa nên các trường dg_* trong tổng luôn = 0.
function tinhTong(dong) {
  const moTong = () => ({
    sl_nhap: 0, dg_nhap: 0, tt_nhap: 0,
    sl_xuat: 0, dg_xuat: 0, tt_xuat: 0,
    sl_ton: 0, dg_ton: 0, tt_ton: 0,
    so_dong: 0,
  });
  const tong = { '661.2': moTong(), '337': moTong() };
  for (const d of dong) {
    const t = tong[d.nhom] || tong['661.2'];
    t.so_dong += 1;
    for (const k of ['sl_nhap', 'tt_nhap', 'sl_xuat', 'tt_xuat']) {
      if (d[k] !== null && d[k] !== undefined) t[k] += d[k];
    }
  }
  for (const t of Object.values(tong)) {
    t.sl_ton = t.sl_nhap - t.sl_xuat;
    t.tt_ton = t.tt_nhap - t.tt_xuat;
    for (const k of Object.keys(t)) t[k] = r4(t[k]);
  }
  return tong;
}

// Gom cảnh báo của các dòng thành danh sách phẳng + thống kê.
function gomCanhBao(dong) {
  const ds = [];
  dong.forEach((d, i) => {
    d.canh_bao.forEach((nd) => ds.push({ dong: i, ten_hang: d.ten_hang, noi_dung: nd }));
  });
  return ds;
}

// ---------------------------------------------------------------------------------
// Kỳ báo cáo
// ---------------------------------------------------------------------------------
function loiKy(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

// Ngày lịch thật 'YYYY-MM-DD' (2026-02-30, 2026-13-45 không hợp lệ) → ISO hoặc ''.
function ngayLich(v) {
  const m = chuoi(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

const coGiaTri = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function docNam(q) {
  const nam = coGiaTri(q.nam) ? Number(String(q.nam).trim()) : new Date().getFullYear();
  if (!Number.isInteger(nam) || nam < 2000 || nam > 2100) throw loiKy('nam không hợp lệ (2000-2100).');
  return nam;
}

// query: {quy, nam, tu_ngay, den_ngay, cac_quy}. Trả về mô tả kỳ (1 kỳ); dùng
// `cacQuyCuaNam(nam)` để lấy 4 kỳ. Không cho trộn quy với tu_ngay/den_ngay.
function xacDinhKy(query = {}) {
  const q = query || {};
  const coTu = coGiaTri(q.tu_ngay);
  const coDen = coGiaTri(q.den_ngay);
  if ((coTu || coDen) && coGiaTri(q.quy)) {
    throw loiKy('Chỉ chọn một trong hai: quy (kèm nam) hoặc tu_ngay/den_ngay.');
  }
  if (coTu || coDen) {
    const tu = coTu ? ngayLich(q.tu_ngay) : '';
    const den = coDen ? ngayLich(q.den_ngay) : '';
    if ((coTu && !tu) || (coDen && !den)) {
      throw loiKy('tu_ngay / den_ngay phải là ngày hợp lệ dạng YYYY-MM-DD.');
    }
    if (tu && den && tu > den) throw loiKy('tu_ngay không được sau den_ngay.');
    let tieuDe;
    if (tu && den) tieuDe = `TỪ NGÀY ${ngayHienThi(tu)} ĐẾN NGÀY ${ngayHienThi(den)}`;
    else if (tu) tieuDe = `TỪ NGÀY ${ngayHienThi(tu)}`;
    else tieuDe = `ĐẾN NGÀY ${ngayHienThi(den)}`;
    const nhan = [tu && ngayHienThi(tu).replace(/\//g, '-'), den && ngayHienThi(den).replace(/\//g, '-')]
      .filter(Boolean)
      .join(' - ');
    return {
      loai: 'tuy_chon', tu, den, tieuDe, gomKhongNgay: true,
      tenSheet: tuyChonTenSheet(nhan),
      tenFile: [tu, den].filter(Boolean).join('_den_') || 'tuy_chon',
    };
  }
  const nam = docNam(q);
  if (coGiaTri(q.quy)) {
    const quy = Number(String(q.quy).trim());
    if (!Number.isInteger(quy) || quy < 1 || quy > 4) throw loiKy('quy phải là 1, 2, 3 hoặc 4.');
    return kyQuy(nam, quy);
  }
  return {
    loai: 'nam', nam,
    tu: `${nam}-01-01`, den: `${nam}-12-31`,
    tieuDe: `NĂM ${nam}`,
    tenSheet: `NĂM ${nam}`,
    tenFile: `Nam_${nam}`,
    gomKhongNgay: true,
  };
}

function tuyChonTenSheet(nhan) {
  return String(nhan || 'Tuy chon').replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

function kyQuy(nam, quy) {
  const thangDau = (quy - 1) * 3 + 1;
  const thangCuoi = thangDau + 2;
  const ngayCuoi = new Date(Date.UTC(nam, thangCuoi, 0)).getUTCDate();
  const la = CAC_QUY_LA_MA[quy - 1];
  return {
    loai: 'quy', nam, quy,
    tu: `${nam}-${pad2(thangDau)}-01`,
    den: `${nam}-${pad2(thangCuoi)}-${pad2(ngayCuoi)}`,
    tieuDe: `QUÝ ${la} / NĂM ${nam}`,
    tenSheet: `QUÝ ${la} - ${nam}`,
    tenFile: `Quy_${la}_${nam}`,
    gomKhongNgay: false,
  };
}

function cacQuyCuaNam(nam) {
  return [1, 2, 3, 4].map((q) => kyQuy(nam, q));
}

// ---------------------------------------------------------------------------------
// Đọc dữ liệu từ DB
// ---------------------------------------------------------------------------------
function layDuLieuTuDb() {
  const { db } = require('../db'); // require muộn để hàm thuần phía trên không mở DB
  const gomItem = (phieuList, bangItem, khoaPhieu) => {
    const theoPhieu = new Map(phieuList.map((p) => [p.id, Object.assign(p, { items: [] })]));
    const items = db.prepare(`SELECT * FROM ${bangItem} ORDER BY ${khoaPhieu}, stt, id`).all();
    for (const it of items) {
      const p = theoPhieu.get(it[khoaPhieu]);
      if (p) p.items.push(it);
    }
    return phieuList;
  };
  const phieuNhap = gomItem(
    db.prepare('SELECT * FROM phieu_nhap ORDER BY ngay, id').all(),
    'phieu_nhap_items',
    'phieu_nhap_id'
  );
  const phieuXuat = gomItem(
    db.prepare('SELECT * FROM phieu_xuat ORDER BY ngay, id').all(),
    'phieu_xuat_items',
    'phieu_xuat_id'
  );
  return { phieuNhap, phieuXuat };
}

// Các dòng của 1 kỳ (đã lọc theo từng phần nhập/xuất, xem taoDongSoTongHop).
function dongCuaKy(ky, duLieu) {
  return taoDongSoTongHop(duLieu.phieuNhap, duLieu.phieuXuat, ky);
}

// Dữ liệu 1 kỳ (JSON cho màn xem trước): {ky, dong, tong, canh_bao, so_dong}.
function layDuLieuKy(ky) {
  const dong = dongCuaKy(ky, layDuLieuTuDb());
  return {
    ky: { loai: ky.loai, nam: ky.nam || null, quy: ky.quy || null, tu_ngay: ky.tu, den_ngay: ky.den, tieu_de: ky.tieuDe },
    dong,
    tong: tinhTong(dong),
    canh_bao: gomCanhBao(dong),
    so_dong: dong.length,
  };
}

// ---------------------------------------------------------------------------------
// Dựng Excel
// ---------------------------------------------------------------------------------
const FONT = { name: 'Arial Narrow', family: 2, size: 8 };
const FILL_TRANG = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFFF' },
  bgColor: { argb: 'FFFFFFCC' },
};
const MONG = { style: 'thin' };
const TOC = { style: 'hair' };

function chuCot(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

// Ước lượng số dòng khi chữ tự xuống dòng trong ô rộng `rong` (đơn vị độ rộng cột Excel), để
// đặt chiều cao dòng — tránh ô bị che chữ. Mô hình xấp xỉ cho Arial Narrow 8pt.
function pxChu(ch) {
  if (ch === ' ') return 2.4;
  if (/[0-9]/.test(ch)) return 4.9;
  if (/[mwMW@%]/.test(ch)) return 6.6;
  if (ch !== ch.toLowerCase()) return 5.1; // chữ HOA (kể cả có dấu)
  if (/[iltfjI.,;:!|'()\-]/.test(ch)) return 2.6;
  return 4.4;
}
function demDong(text, rong) {
  const s = chuoi(text);
  if (!s) return 1;
  const sucChua = Math.max(8, rong * 7 + 5 - 4); // px dùng được trong ô
  let tong = 0;
  for (const doan of s.split(/\r?\n/)) {
    let dong = 1;
    let x = 0;
    for (const tu of doan.split(/(?<= )/)) {
      const rongTu = [...tu].reduce((a, c) => a + pxChu(c), 0) * 1.06;
      if (x + rongTu <= sucChua) {
        x += rongTu;
      } else if (rongTu <= sucChua) {
        dong += 1;
        x = rongTu;
      } else {
        // từ dài hơn cả dòng → bị ngắt giữa chừng
        const rongKhongCach = [...tu.trimEnd()].reduce((a, c) => a + pxChu(c), 0) * 1.06;
        if (x > 0) dong += 1;
        const them = Math.ceil(rongKhongCach / sucChua) - 1;
        dong += them;
        x = rongKhongCach - them * sucChua;
      }
    }
    tong += dong;
  }
  return tong;
}

function kieuODuLieu(cot, { dau, dgThapPhan }) {
  const border = { left: MONG, right: MONG, top: dau ? MONG : TOC, bottom: TOC };
  const cb = (h, wrap, numFmt) => ({
    font: { ...FONT },
    fill: FILL_TRANG,
    border,
    alignment: { horizontal: h, vertical: 'middle', wrapText: wrap, shrinkToFit: false, indent: 0, textRotation: 0 },
    numFmt: numFmt || 'General',
  });
  switch (cot) {
    case 1: case 5: return cb('center', false, '@'); // ngày nhập / ngày xuất
    case 2: case 6: return cb('center', true); // phiếu nhập / phiếu xuất
    case 3: case 4: case 7: return cb('left', true); // người nhập, đơn vị, người lĩnh
    case 8: return cb('center', true); // đơn vị công tác (xuất)
    case 9: return cb('left', true); // trích yếu
    case 10: case 11: return cb('center', true); // TK đối ứng, tiểu mục
    case 12: return cb('center', true); // đơn vị tính
    default: {
      const idx = (cot - 13) % 9; // 0 SL, 1 ĐG, 2 TT (x3 nhóm: nhập, xuất, tồn)
      const nhomCot = idx % 3;
      if (nhomCot === 0) return cb('center', false, 'General');
      return cb('right', false, nhomCot === 1 && dgThapPhan ? NUMFMT_2 : NUMFMT);
    }
  }
}

function veTieuDe(ws, tenDonVi, tieuDeKy) {
  ws.getRow(1).height = 12.75;
  ws.getRow(3).height = 21.75;
  ws.getRow(4).height = 21.75;
  ws.getRow(5).height = 12.75;
  ws.getRow(6).height = 15;
  ws.getRow(7).height = 14.25;
  ws.getRow(8).height = 30;

  // Nền trắng cho toàn bộ vùng A..AD, dòng 1-8.
  for (let r = 1; r <= 8; r++) {
    for (let c = 1; c <= SO_COT; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { ...FONT };
      cell.fill = FILL_TRANG;
      cell.alignment = { horizontal: 'general', vertical: 'middle', wrapText: false };
    }
  }

  ws.getCell('A1').value = chuoi(tenDonVi);
  ws.getCell('A1').font = { ...FONT, bold: true, size: 10 };
  ws.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
  ws.getCell('A1').numFmt = '@';

  ws.getCell('A3').value = 'TỔNG HỢP NHẬP XUẤT VẬT TƯ';
  ws.getCell('A4').value = tieuDeKy;
  ws.mergeCells('A3:U3');
  ws.mergeCells('A4:U4');
  for (const dong of [3, 4]) {
    for (let c = 1; c <= 21; c++) {
      const cell = ws.getCell(dong, c);
      cell.font = { ...FONT, bold: true, size: 12 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.numFmt = '[$-409]m/d/yyyy';
    }
  }

  // Header 3 tầng (dòng 6-8)
  const nhanCotDon = [
    'Ngày\nnhập', 'Phiếu\nnhập', 'Người nhập', 'Đơn vị\ncông tác',
    'Ngày\nxuất', 'Phiếu\nxuất', 'Người lĩnh', 'Đơn vị\ncông tác',
    'TRÍCH YẾU', 'TK đối\nứng', 'Tiểu\nmục', 'Đơn\nvị tính',
  ];
  nhanCotDon.forEach((t, i) => {
    ws.getCell(6, i + 1).value = t;
    ws.mergeCells(6, i + 1, 8, i + 1);
  });
  ws.getCell('M6').value = 'TK661.2';
  ws.getCell('V6').value = 'TK 337';
  ws.mergeCells('M6:U6');
  ws.mergeCells('V6:AD6');
  const nhomCap2 = ['Nhập', 'Xuất', 'Tồn'];
  [13, 22].forEach((batDau) => {
    nhomCap2.forEach((t, i) => {
      ws.getCell(7, batDau + i * 3).value = t;
      ws.mergeCells(7, batDau + i * 3, 7, batDau + i * 3 + 2);
    });
    for (let i = 0; i < 3; i++) {
      ['Số lượng', 'Đơn giá', 'Thành tiền'].forEach((t, j) => {
        ws.getCell(8, batDau + i * 3 + j).value = t;
      });
    }
  });
  for (let r = 6; r <= 8; r++) {
    for (let c = 1; c <= SO_COT; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { ...FONT, bold: true };
      cell.border = { left: MONG, right: MONG, top: MONG, bottom: MONG };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, shrinkToFit: false };
    }
  }
  ws.getCell('A6').numFmt = '@';
  ws.getCell('E6').numFmt = '@';
  // Chi tiết nhỏ giống mẫu: tiêu đề nhóm TK (dòng 6) không wrap; cột số có numFmt #,##0.
  for (let c = 13; c <= SO_COT; c++) {
    ws.getCell(6, c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: false, shrinkToFit: false };
    for (let r = 6; r <= 8; r++) {
      if (c <= 21 || r >= 7) ws.getCell(r, c).numFmt = '#,##0';
    }
  }
}

// Viết 1 sheet cho `dong` (đã lọc kỳ). Trả về thông tin vùng in.
function veSheet(wb, { tenSheet, tieuDe, tenDonVi, dong }) {
  const ws = wb.addWorksheet(tenSheet, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 8, showGridLines: false, zoomScale: 100, zoomScaleNormal: 100 }],
    properties: { defaultRowHeight: 12.75, defaultColWidth: 8.99609375 },
  });
  DO_RONG_COT.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  veTieuDe(ws, tenDonVi, tieuDe);

  const coDuLieu = dong.length > 0;
  const hang = coDuLieu ? dong : [null]; // kỳ rỗng: 1 dòng trống có khung để dòng tổng có chỗ SUM
  const hangCuoi = HANG_DAU_DU_LIEU + hang.length - 1;
  const hangTong = hangCuoi + 1;
  const canhBaoGhi = [];
  let coNhom337 = false;
  let soDongTinhLai = 0;
  let soDongNhapNgoaiKy = 0;

  hang.forEach((d, i) => {
    const r = HANG_DAU_DU_LIEU + i;
    const dgThapPhan = (v) => v !== null && v !== undefined && Math.abs(v - Math.round(v)) > 0.005;
    let soDongChu = 1;
    for (let c = 1; c <= SO_COT; c++) {
      const cell = ws.getCell(r, c);
      const kieu = kieuODuLieu(c, {
        dau: i === 0,
        dgThapPhan: c >= 13 ? dgThapPhan(d && cotDonGia(d, c)) : false,
      });
      cell.font = kieu.font;
      cell.fill = kieu.fill;
      cell.border = kieu.border;
      cell.alignment = kieu.alignment;
      cell.numFmt = kieu.numFmt;
    }
    if (!d) {
      ws.getRow(r).height = 15;
      return;
    }

    const chu = [
      [1, ngayHienThi(d.ngay_nhap)], [2, d.so_phieu_nhap], [3, d.nguoi_nhap], [4, d.don_vi_nhap],
      [5, ngayHienThi(d.ngay_xuat)], [6, d.so_phieu_xuat], [7, d.nguoi_linh], [8, d.don_vi_xuat],
      [9, d.ten_hang], [10, d.tk_doi_ung], [11, d.tieu_muc], [12, d.dvt],
    ];
    for (const [c, v] of chu) {
      if (v) ws.getCell(r, c).value = sach(v);
      if (v && ws.getCell(r, c).alignment.wrapText) {
        soDongChu = Math.max(soDongChu, demDong(v, DO_RONG_COT[c - 1]));
      }
    }
    // Excel giới hạn chiều cao dòng 409.5pt.
    ws.getRow(r).height = soDongChu <= 1 ? 15 : Math.min(409.5, Math.round((soDongChu * 10.9 + 0.5) * 4) / 4);
    if (d.dg_tinh_lai) soDongTinhLai += 1;
    if (d.tham_chieu_nhap) soDongNhapNgoaiKy += 1;

    // Số liệu rơi vào nhóm TK661.2 (cột M-U) hay TK 337 (cột V-AD).
    const b = d.nhom === '337' ? 22 : 13;
    if (d.nhom === '337') coNhom337 = true;
    const L = (c) => chuCot(b + c); // L(0)=SL nhập, L(1)=ĐG nhập, L(2)=TT nhập, L(3..5)=xuất, L(6..8)=tồn
    const dat = (c, giaTri, congThuc) => {
      const cell = ws.getCell(r, b + c);
      cell.value = congThuc ? { formula: congThuc, result: giaTri } : giaTri;
    };
    // Thành tiền làm tròn đến đồng (khớp cách tính của phiếu nhập/xuất).
    if (d.co_nhap) {
      dat(0, d.sl_nhap);
      dat(1, d.dg_nhap);
      dat(2, d.tt_nhap, `ROUND(${L(0)}${r}*${L(1)}${r},0)`);
    }
    if (d.co_xuat) {
      dat(3, d.sl_xuat);
      dat(4, d.dg_xuat);
      dat(5, d.tt_xuat, `ROUND(${L(3)}${r}*${L(4)}${r},0)`);
    }
    if (d.co_ton) {
      // Tồn = Nhập − Xuất; dòng xuất tiếp theo trừ dần vào số tồn của dòng ngay trên. Nếu dòng
      // nhập/xuất trước nằm ngoài sheet (kỳ khác) thì Tồn là giá trị lũy kế cố định.
      if (d.ton_cong_thuc === 'chinh') {
        dat(6, d.sl_ton, `${L(0)}${r}-${L(3)}${r}`);
        dat(7, d.dg_ton, `${L(1)}${r}`);
      } else if (d.ton_cong_thuc === 'tiep') {
        dat(6, d.sl_ton, `${L(6)}${r - 1}-${L(3)}${r}`);
        dat(7, d.dg_ton, `${L(7)}${r - 1}`);
      } else {
        dat(6, d.sl_ton);
        dat(7, d.dg_ton);
      }
      dat(8, d.tt_ton, `ROUND(${L(6)}${r}*${L(7)}${r},0)`);
      if (d.sl_ton < -1e-9) {
        const cell = ws.getCell(r, b + 6);
        cell.font = { ...FONT, color: { argb: 'FFFF0000' }, bold: true };
      }
    }
    d.canh_bao.forEach((nd) => canhBaoGhi.push({ r, ten: d.ten_hang, nd }));
  });

  // Dòng tổng cộng. Nhập và Xuất = SUM đúng phạm vi dòng dữ liệu của sheet này; Tồn = Nhập − Xuất
  // (không SUM cột Tồn vì Tồn từng dòng là số lũy kế, cộng lại sẽ tính trùng).
  // Ô Đơn giá ở dòng tổng để trống (TONG_CA_DON_GIA = false).
  const cotNhom = (b) => (k) => chuCot(b + k);
  for (let c = 1; c <= SO_COT; c++) {
    const cell = ws.getCell(hangTong, c);
    cell.font = { ...FONT, bold: true };
    cell.fill = FILL_TRANG;
    cell.border = { left: MONG, right: MONG, top: TOC, bottom: MONG };
    const kieu = kieuODuLieu(c, { dau: false, dgThapPhan: false });
    cell.alignment = { ...kieu.alignment, wrapText: false, horizontal: c >= 13 ? 'right' : 'center' };
    // Số lượng tổng: General để không làm tròn số lẻ (vd 360.5); cột tiền dùng NUMFMT như mẫu.
    cell.numFmt = c >= 13 ? ((c - 13) % 3 === 0 ? 'General' : NUMFMT) : 'General';
    if (c === 9) cell.value = 'TỔNG CỘNG';
    if (c < 13) continue;
    const b = c >= 22 ? 22 : 13;
    const off = c - b;
    const L = cotNhom(b);
    const cl = chuCot(c);
    const sum = () => ({
      formula: `SUM(${cl}${HANG_DAU_DU_LIEU}:${cl}${hangCuoi})`,
      result: tongCot(hang, c),
    });
    if (off === 0 || off === 2 || off === 3 || off === 5) {
      cell.value = sum();
    } else if (off === 1 || off === 4 || off === 7) {
      if (TONG_CA_DON_GIA) cell.value = sum();
    } else if (off === 6) {
      cell.value = {
        formula: `${L(0)}${hangTong}-${L(3)}${hangTong}`,
        result: r4(tongCot(hang, b + 0) - tongCot(hang, b + 3)),
      };
    } else if (off === 8) {
      cell.value = {
        formula: `${L(2)}${hangTong}-${L(5)}${hangTong}`,
        result: r4(tongCot(hang, b + 2) - tongCot(hang, b + 5)),
      };
    }
  }
  ws.getRow(hangTong).height = 15;
  // Bộ lọc dòng tiêu đề (mẫu có autoFilter A8:AD...).
  ws.autoFilter = `A8:${chuCot(SO_COT)}${hangCuoi}`;

  // Ghi chú / cảnh báo bên dưới bảng (ngoài khung) — để không có gì "im lặng": tồn âm, dòng
  // xuất chưa ghép được nhập, nguồn kinh phí lệch...
  const ghiChu = [];
  if (!coDuLieu) ghiChu.push('Không có phát sinh nhập / xuất vật tư trong kỳ này.');
  if (soDongNhapNgoaiKy) {
    ghiChu.push(
      `${soDongNhapNgoaiKy} dòng xuất có phần Nhập để trống vì hàng nhập ở kỳ khác; cột Tồn của các dòng này là số tồn lũy kế theo cả chuỗi nhập-xuất.`
    );
  }
  const tonAm = canhBaoGhi.filter((x) => x.nd.startsWith('Tồn âm'));
  const khacTonAm = canhBaoGhi.filter((x) => !x.nd.startsWith('Tồn âm'));
  tonAm.slice(0, 20).forEach((x) => ghiChu.push(`Dòng ${x.r} - ${x.ten}: ${x.nd}`));
  if (tonAm.length > 20) ghiChu.push(`... và ${tonAm.length - 20} dòng tồn âm khác.`);
  const chiXuat = khacTonAm.filter((x) => x.nd.startsWith('Chưa tìm thấy'));
  if (chiXuat.length) {
    ghiChu.push(
      `Có ${chiXuat.length} dòng xuất chưa tìm thấy dòng nhập tương ứng (nhập ở kỳ trước hoặc chưa liên kết phiếu nhập): ` +
        `cột Nhập và Tồn để trống - dòng ${chiXuat.slice(0, 15).map((x) => x.r).join(', ')}${chiXuat.length > 15 ? ', ...' : ''}.`
    );
  }
  khacTonAm
    .filter((x) => !x.nd.startsWith('Chưa tìm thấy'))
    .slice(0, 20)
    .forEach((x) => ghiChu.push(`Dòng ${x.r} - ${x.ten}: ${x.nd}`));
  if (soDongTinhLai) {
    ghiChu.push(`Có ${soDongTinhLai} dòng đơn giá được tính lại = Thành tiền / Số lượng (đơn giá trên phiếu lệch thành tiền do làm tròn).`);
  }
  let hangCuoiVung = hangTong;
  if (ghiChu.length) {
    ghiChu.forEach((t, i) => {
      const r = hangTong + 2 + i;
      for (let c = 1; c <= SO_COT; c++) {
        const cell = ws.getCell(r, c);
        cell.font = { ...FONT, italic: true };
        cell.fill = FILL_TRANG;
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
      }
      const o = ws.getCell(r, 1);
      o.value = sach((i === 0 ? 'Ghi chú: ' : '') + t);
      if (/Tồn âm/.test(t)) o.font = { ...FONT, italic: true, color: { argb: 'FFFF0000' } };
      ws.getRow(r).height = 12.75;
      hangCuoiVung = r;
    });
  }

  // Cài đặt in: A4 ngang, lề, tiêu đề lặp dòng 6-8, chân trang "Page n" (như mẫu). Mẫu in
  // scale 95; vì cột D/H được nới nên dùng vừa-khít-chiều-ngang (1 trang rộng, nhiều trang dài).
  const cotCuoiIn = coNhom337 ? SO_COT : 21; // mẫu chỉ in A..U; có số liệu TK 337 thì in tới AD
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    horizontalDpi: 300,
    verticalDpi: 300,
    pageOrder: 'downThenOver',
    scale: 95,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.279861111111111, right: 0.159722222222222,
      top: 0.290277777777778, bottom: 0.310416666666667,
      header: 0.511811023622047, footer: 0.170138888888889,
    },
    showGridLines: false,
    showRowColHeaders: false,
    // ExcelJS ghép '$' trước mỗi nửa vùng nên phải viết sẵn dạng A$1:U$292 để ra $A$1:$U$292.
    printArea: `A$1:${chuCot(cotCuoiIn)}$${hangCuoiVung}`,
    printTitlesRow: '6:8',
  };
  ws.headerFooter = { oddFooter: '&CPage &P' };
  return { hangTong, hangDauDuLieu: HANG_DAU_DU_LIEU, hangCuoi };
}

// Đơn giá của dòng d tại cột c (để chọn định dạng có số lẻ hay không).
function cotDonGia(d, c) {
  const idx = (c - 13) % 9;
  if (idx === 1) return d.dg_nhap;
  if (idx === 4) return d.dg_xuat;
  if (idx === 7) return d.dg_ton;
  return null;
}

// Tổng theo cột dữ liệu (chỉ gồm các dòng thuộc đúng nhóm TK của cột đó). Cột c là cột Excel
// 1-based; chỉ dùng cho nhóm Nhập/Xuất (Tồn tính bằng hiệu).
function tongCot(hang, c) {
  const b = c >= 22 ? 22 : 13;
  const off = c - b;
  const khoa = ['sl_nhap', 'dg_nhap', 'tt_nhap', 'sl_xuat', 'dg_xuat', 'tt_xuat', 'sl_ton', 'dg_ton', 'tt_ton'][off];
  const nhomMuc = c >= 22 ? '337' : '661.2';
  let s = 0;
  for (const d of hang) {
    if (d && d.nhom === nhomMuc && d[khoa] !== null && d[khoa] !== undefined) s += d[khoa];
  }
  return r4(s);
}

// kyList: [{tenSheet, tieuDe, tu, den, gomKhongNgay}] — mỗi kỳ 1 sheet.
function taoWorkbook({ tenDonVi, kyList, duLieu }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kho vat tu';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  for (const ky of kyList) {
    veSheet(wb, {
      tenSheet: ky.tenSheet,
      tieuDe: ky.tieuDe,
      tenDonVi,
      dong: dongCuaKy(ky, duLieu),
    });
  }
  return wb;
}

// Xuất buffer .xlsx. query như route: {quy, nam, tu_ngay, den_ngay, cac_quy}.
async function xuatTongHop(query) {
  const q = query || {};
  const dl = layDuLieuTuDb();
  const tenDonVi = require('../db').layCauHinh().ten_don_vi;

  let kyList;
  let tenFile;
  const cacQuy = ['1', 'true', 'yes', 'on'].includes(String(q.cac_quy || '').toLowerCase());
  if (cacQuy) {
    if (coGiaTri(q.quy) || coGiaTri(q.tu_ngay) || coGiaTri(q.den_ngay)) {
      throw loiKy('cac_quy=1 chỉ đi với nam; không kèm quy / tu_ngay / den_ngay.');
    }
    const nam = docNam(q);
    kyList = cacQuyCuaNam(nam);
    tenFile = `Cac_quy_${nam}`;
  } else {
    const ky = xacDinhKy(q);
    kyList = [ky];
    tenFile = ky.tenFile;
  }
  const wb = taoWorkbook({ tenDonVi, kyList, duLieu: dl });
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, tenFile: `Tong_hop_nhap_xuat_vat_tu_${tenFile}.xlsx`, kyList };
}

module.exports = { xacDinhKy, layDuLieuKy, xuatTongHop };
