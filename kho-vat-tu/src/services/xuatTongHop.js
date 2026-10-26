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

// Mẫu gốc có dòng TỔNG CỘNG cộng cả cột Số lượng lẫn Đơn giá (SUM cho cả 9 cột M-U). Cộng
// đơn giá thì vô nghĩa về nghiệp vụ nhưng là đúng form mẫu; đặt false để bỏ SUM ở cột Đơn giá.
const TONG_CA_DON_GIA = true;

const HANG_DAU_DU_LIEU = 9; // dòng dữ liệu đầu tiên (dòng 6-8 là header)
const SO_COT = 30; // A..AD
const CAC_QUY_LA_MA = ['I', 'II', 'III', 'IV'];

// Độ rộng cột: A..R sao chép đúng sheet "QUÝ III - 2013" của file mẫu (3 sheet mẫu mỗi sheet
// chỉnh độ rộng hơi khác nhau). Cột S..AD trong sheet đó chỉ rộng 4.99 (mẫu để trống nhóm Tồn
// và nhóm TK 337) → quá hẹp để chứa đơn giá / thành tiền (hiện ####), nên lấy độ rộng thực
// tế đã dùng ở các sheet QUÝ I/II của mẫu (lấy giá trị lớn hơn giữa độ rộng nhóm TK661.2
// tương ứng và độ rộng sheet QUÝ II).
const DO_RONG_661 = [7.25, 7.5, 8.62, 4.5, 9.5, 8.24, 4.62, 7.5, 8.62]; // M..U
const DO_RONG_337 = [7.25, 7.5, 8.62, 6.62, 9.5, 8.99, 6.99, 7.62, 8.87]; // V..AD
const DO_RONG_COT = [
  6.37, 3.74, 10.99, 3.87, 6.5, 4.87, 10.87, 4.5, 16.5, 3.87, 3.62, 4.25,
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
const chuoi = (v) => (v === null || v === undefined ? '' : String(v).trim());

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

// Thành tiền trong DB là số được lưu (và là cơ sở của "tổng tiền hàng" trên phiếu); đơn giá
// đôi khi lệch vài đồng do làm tròn. Dòng sổ dùng công thức Thành tiền = SL x Đơn giá, nên nếu
// SL x ĐG lệch thành tiền DB quá 0,5đ thì đơn giá được tính lại = thành tiền / SL để tổng
// khớp phiếu. Trả {dg, tt, tinhLai}.
function chuanDonGia(sl, dg, tt) {
  let dgOut = r6(dg);
  let tinhLai = false;
  if (sl > 0) {
    if (tt > 0 && Math.abs(sl * dgOut - tt) > 0.5) {
      dgOut = r6(tt / sl);
      tinhLai = true;
    } else if (dgOut === 0 && tt > 0) {
      dgOut = r6(tt / sl);
    }
  }
  return { dg: dgOut, tt: r4(sl * dgOut), tinhLai };
}

// ---------------------------------------------------------------------------------
// Ghép dòng sổ tổng hợp (hàm thuần)
// ---------------------------------------------------------------------------------
// phieuNhapList: [{id, so_phieu, ngay, nguoi_nhap, don_vi, tk_doi_ung, tieu_muc, nguon_kinh_phi,
//                  items:[{id, vat_tu_id, stt, ten_hang, dvt, sl_thuc_nhap, don_gia, thanh_tien, tieu_muc}]}]
// phieuXuatList: [{id, so_phieu, ngay, nguoi_nhan, don_vi, tk_doi_ung, tieu_muc, nguon_kinh_phi,
//                  items:[{id, vat_tu_id, stt, ten_hang, dvt, sl_thuc_xuat, don_gia, thanh_tien,
//                          tieu_muc, phieu_nhap_item_id}]}]
// Trả về mảng dòng đã sắp xếp (xem `moDong`). Cần truyền TOÀN BỘ phiếu (không lọc kỳ trước) để
// việc ghép nhập↔xuất đúng; lọc kỳ làm sau bằng `locTheoKy`.
function taoDongSoTongHop(phieuNhapList, phieuXuatList) {
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

  // 3) Dựng dòng.
  const nhom = [];

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
  };
  const dienTon = (d, slTon, dg) => {
    d.co_ton = true;
    d.sl_ton = r6(slTon);
    d.dg_ton = dg;
    d.tt_ton = r4(d.sl_ton * dg);
    if (d.sl_ton < -1e-9) {
      d.canh_bao.push(`Tồn âm (${d.sl_ton}): số lượng xuất vượt số lượng nhập của dòng này.`);
    }
  };

  // 3a) Dòng nhập (+ các dòng xuất tương ứng)
  for (const n of nhapNodes) {
    const ds = n.xuat.slice().sort(
      (a, b) => soSanhChuoi(a.ngay, b.ngay) || (a.q.id || 0) - (b.q.id || 0) || a.thuTu - b.thuTu
    );
    const cung = ds.filter((x) => x.nhom === n.nhom);
    const lech = ds.filter((x) => x.nhom !== n.nhom);

    const dong = [];
    let slTon = n.sl;
    cung.forEach((x, i) => {
      const d = moDong();
      d.nhom = n.nhom;
      d.ten_hang = chuoi(n.it.ten_hang) || chuoi(x.it.ten_hang);
      d.dvt = chuoi(n.it.dvt) || chuoi(x.it.dvt);
      if (i === 0) {
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
      slTon -= x.sl;
      dienTon(d, slTon, n.dg);
      dong.push(d);
    });
    if (cung.length === 0) {
      const d = moDong();
      d.loai = 'chi_nhap';
      d.nhom = n.nhom;
      d.ten_hang = chuoi(n.it.ten_hang);
      d.dvt = chuoi(n.it.dvt);
      d.tk_doi_ung = chuoi(n.p.tk_doi_ung);
      d.tieu_muc = tieuMucCuaNhap(n);
      dienNhap(d, n);
      dienTon(d, slTon, n.dg);
      dong.push(d);
    }
    nhom.push({
      ngay: n.ngay,
      loai: 0,
      soPhieu: chuoi(n.p.so_phieu),
      pid: n.p.id || 0,
      thuTu: n.it.id || n.thuTu,
      dong,
    });

    // Xuất khác nguồn kinh phí với dòng nhập → không thể gộp chung nhóm cột → dòng riêng.
    for (const x of lech) {
      const d = moDong();
      d.loai = 'chi_xuat';
      d.nhom = x.nhom;
      d.ten_hang = chuoi(x.it.ten_hang) || chuoi(n.it.ten_hang);
      d.dvt = chuoi(x.it.dvt) || chuoi(n.it.dvt);
      d.tk_doi_ung = chuoi(x.q.tk_doi_ung);
      d.tieu_muc = tieuMucCuaXuat(x);
      dienXuat(d, x);
      d.canh_bao.push(
        `Xuất theo nguồn TK ${x.nhom} nhưng hàng nhập theo nguồn TK ${n.nhom} (phiếu ${chuoi(n.p.so_phieu)}): ` +
          'tách thành dòng riêng, cột Tồn để trống.'
      );
      nhom.push({
        ngay: x.ngay,
        loai: 1,
        soPhieu: chuoi(x.q.so_phieu),
        pid: x.q.id || 0,
        thuTu: x.it.id || x.thuTu,
        dong: [d],
      });
    }
  }

  // 3b) Dòng chỉ có xuất (không tìm được dòng nhập)
  for (const x of xuatNodes) {
    if (x.nhapNode) continue;
    const d = moDong();
    d.loai = 'chi_xuat';
    d.nhom = x.nhom;
    d.ten_hang = chuoi(x.it.ten_hang);
    d.dvt = chuoi(x.it.dvt);
    d.tk_doi_ung = chuoi(x.q.tk_doi_ung);
    d.tieu_muc = tieuMucCuaXuat(x);
    dienXuat(d, x);
    d.canh_bao.push(
      'Chưa tìm thấy dòng nhập tương ứng (có thể nhập ở kỳ trước hoặc chưa liên kết phiếu nhập): cột Nhập và Tồn để trống.'
    );
    nhom.push({
      ngay: x.ngay,
      loai: 1,
      soPhieu: chuoi(x.q.so_phieu),
      pid: x.q.id || 0,
      thuTu: x.it.id || x.thuTu,
      dong: [d],
    });
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
      d.ngay_loc = g.ngay;
      ketQua.push(d);
    }
  }
  return ketQua;
}

// Lọc dòng theo kỳ [tu, den] ('YYYY-MM-DD', bao gồm 2 đầu) theo ngày nhập của dòng (dòng chỉ
// có xuất: theo ngày xuất; dòng xuất tiếp theo đi cùng dòng nhập gốc nên cùng ngày_loc).
function locTheoKy(dong, tu, den) {
  return dong.filter((d) => d.ngay_loc && (!tu || d.ngay_loc >= tu) && (!den || d.ngay_loc <= den));
}

// Tổng cộng theo từng nhóm TK (khớp với các công thức SUM ở dòng cuối sheet).
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
    for (const k of ['sl_nhap', 'dg_nhap', 'tt_nhap', 'sl_xuat', 'dg_xuat', 'tt_xuat', 'sl_ton', 'dg_ton', 'tt_ton']) {
      if (d[k] !== null && d[k] !== undefined) t[k] += d[k];
    }
  }
  for (const t of Object.values(tong)) {
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

// query: {quy, nam, tu_ngay, den_ngay, cac_quy}. Trả về mô tả kỳ (1 kỳ), hoặc dùng
// `cacQuyCuaNam(nam)` để lấy 4 kỳ.
function xacDinhKy(query = {}) {
  const q = query || {};
  const coTu = chuoi(q.tu_ngay);
  const coDen = chuoi(q.den_ngay);
  if (coTu || coDen) {
    const tu = coTu ? chuanNgay(coTu) : '';
    const den = coDen ? chuanNgay(coDen) : '';
    if ((coTu && !tu) || (coDen && !den)) throw loiKy('tu_ngay / den_ngay phải có dạng YYYY-MM-DD.');
    if (tu && den && tu > den) throw loiKy('tu_ngay không được sau den_ngay.');
    let tieuDe;
    if (tu && den) tieuDe = `TỪ NGÀY ${ngayHienThi(tu)} ĐẾN NGÀY ${ngayHienThi(den)}`;
    else if (tu) tieuDe = `TỪ NGÀY ${ngayHienThi(tu)}`;
    else tieuDe = `ĐẾN NGÀY ${ngayHienThi(den)}`;
    const nhan = [tu && ngayHienThi(tu).replace(/\//g, '-'), den && ngayHienThi(den).replace(/\//g, '-')]
      .filter(Boolean)
      .join(' - ');
    return {
      loai: 'tuy_chon', tu, den, tieuDe,
      tenSheet: tuyChonTenSheet(nhan),
      tenFile: [tu, den].filter(Boolean).join('_den_') || 'tuy_chon',
    };
  }
  const nam = q.nam !== undefined && q.nam !== '' ? Number(q.nam) : new Date().getFullYear();
  if (!Number.isInteger(nam) || nam < 2000 || nam > 2100) throw loiKy('nam không hợp lệ (2000-2100).');
  if (q.quy !== undefined && q.quy !== '') {
    const quy = Number(q.quy);
    if (!Number.isInteger(quy) || quy < 1 || quy > 4) throw loiKy('quy phải là 1, 2, 3 hoặc 4.');
    return kyQuy(nam, quy);
  }
  return {
    loai: 'nam', nam,
    tu: `${nam}-01-01`, den: `${nam}-12-31`,
    tieuDe: `NĂM ${nam}`,
    tenSheet: `NĂM ${nam}`,
    tenFile: `Nam_${nam}`,
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

// Dữ liệu 1 kỳ (JSON cho màn xem trước): {ky, dong, tong, canh_bao, so_dong}.
function layDuLieuKy(ky, duLieu) {
  const dl = duLieu || layDuLieuTuDb();
  const tatCa = taoDongSoTongHop(dl.phieuNhap, dl.phieuXuat);
  return duLieuKyTuDong(ky, tatCa);
}

function duLieuKyTuDong(ky, tatCaDong) {
  const dong = locTheoKy(tatCaDong, ky.tu, ky.den);
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
      if (v) ws.getCell(r, c).value = v;
      if (v && ws.getCell(r, c).alignment.wrapText) {
        soDongChu = Math.max(soDongChu, demDong(v, DO_RONG_COT[c - 1]));
      }
    }
    ws.getRow(r).height = soDongChu <= 1 ? 15 : Math.round((soDongChu * 10.9 + 0.5) * 4) / 4;
    if (d.dg_tinh_lai) soDongTinhLai += 1;

    // Số liệu rơi vào nhóm TK661.2 (cột M-U) hay TK 337 (cột V-AD).
    const b = d.nhom === '337' ? 22 : 13;
    if (d.nhom === '337') coNhom337 = true;
    const L = (c) => chuCot(b + c); // L(0)=SL nhập, L(1)=ĐG nhập, L(2)=TT nhập, L(3..5)=xuất, L(6..8)=tồn
    const dat = (c, giaTri, congThuc) => {
      const cell = ws.getCell(r, b + c);
      cell.value = congThuc ? { formula: congThuc, result: giaTri } : giaTri;
    };
    if (d.co_nhap) {
      dat(0, d.sl_nhap);
      dat(1, d.dg_nhap);
      dat(2, d.tt_nhap, `${L(0)}${r}*${L(1)}${r}`);
    }
    if (d.co_xuat) {
      dat(3, d.sl_xuat);
      dat(4, d.dg_xuat);
      dat(5, d.tt_xuat, `${L(3)}${r}*${L(4)}${r}`);
    }
    if (d.co_ton) {
      // Tồn = Nhập − Xuất; dòng xuất tiếp theo trừ dần vào số tồn của dòng ngay trên.
      dat(6, d.sl_ton, d.tiep ? `${L(6)}${r - 1}-${L(3)}${r}` : `${L(0)}${r}-${L(3)}${r}`);
      dat(7, d.dg_ton, d.tiep ? `${L(7)}${r - 1}` : `${L(1)}${r}`);
      dat(8, d.tt_ton, `${L(6)}${r}*${L(7)}${r}`);
      if (d.sl_ton < -1e-9) {
        const cell = ws.getCell(r, b + 6);
        cell.font = { ...FONT, color: { argb: 'FFFF0000' }, bold: true };
      }
    }
    d.canh_bao.forEach((nd) => canhBaoGhi.push({ r, ten: d.ten_hang, nd }));
  });

  // Dòng tổng cộng: SUM đúng phạm vi dòng dữ liệu của sheet này.
  const duocTong = (c) => {
    const idx = (c - 13) % 9;
    return TONG_CA_DON_GIA || idx % 3 !== 1;
  };
  for (let c = 1; c <= SO_COT; c++) {
    const cell = ws.getCell(hangTong, c);
    cell.font = { ...FONT, bold: true };
    cell.fill = FILL_TRANG;
    cell.border = { left: MONG, right: MONG, top: TOC, bottom: MONG };
    const kieu = kieuODuLieu(c, { dau: false, dgThapPhan: false });
    cell.alignment = { ...kieu.alignment, wrapText: false, horizontal: c >= 13 ? 'right' : 'center' };
    // Tổng số lượng nằm ở cột hẹp (4.5-4.6) nên dùng #,##0 (không đệm 2 bên như NUMFMT) để không hiện ###.
    cell.numFmt = c >= 13 ? ((c - 13) % 3 === 0 ? '#,##0' : NUMFMT) : 'General';
    if (c >= 13 && duocTong(c)) {
      const cl = chuCot(c);
      cell.value = { formula: `SUM(${cl}${HANG_DAU_DU_LIEU}:${cl}${hangCuoi})`, result: tongCot(hang, c) };
    }
  }
  ws.getRow(hangTong).height = 15;

  // Ghi chú / cảnh báo bên dưới bảng (ngoài khung) — để không có gì "im lặng": tồn âm, dòng
  // xuất chưa ghép được nhập, nguồn kinh phí lệch...
  const ghiChu = [];
  if (!coDuLieu) ghiChu.push('Không có phát sinh nhập / xuất vật tư trong kỳ này.');
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
      o.value = (i === 0 ? 'Ghi chú: ' : '') + t;
      if (/Tồn âm/.test(t)) o.font = { ...FONT, italic: true, color: { argb: 'FFFF0000' } };
      ws.getRow(r).height = 12.75;
      hangCuoiVung = r;
    });
  }

  // Cài đặt in (sao chép từ mẫu): A4 ngang, lề, tiêu đề lặp dòng 6-8, chân trang "Page n".
  const cotCuoiIn = coNhom337 ? SO_COT : 21; // mẫu chỉ in A..U; có số liệu TK 337 thì in tới AD
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    horizontalDpi: 300,
    verticalDpi: 300,
    pageOrder: 'downThenOver',
    scale: 95,
    fitToPage: coNhom337,
    ...(coNhom337 ? { fitToWidth: 1, fitToHeight: 0 } : {}),
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

// kyList: [{tenSheet, tieuDe, tu, den}] — mỗi kỳ 1 sheet. tatCaDong: kết quả taoDongSoTongHop.
function taoWorkbook({ tenDonVi, kyList, tatCaDong }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kho vat tu';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };
  for (const ky of kyList) {
    veSheet(wb, {
      tenSheet: ky.tenSheet,
      tieuDe: ky.tieuDe,
      tenDonVi,
      dong: locTheoKy(tatCaDong, ky.tu, ky.den),
    });
  }
  return wb;
}

// Xuất buffer .xlsx. query như route: {quy, nam, tu_ngay, den_ngay, cac_quy}.
async function xuatTongHop(query, tuyChon = {}) {
  const q = query || {};
  const dl = tuyChon.duLieu || layDuLieuTuDb();
  const tenDonVi =
    tuyChon.tenDonVi !== undefined ? tuyChon.tenDonVi : require('../db').layCauHinh().ten_don_vi;
  const tatCaDong = taoDongSoTongHop(dl.phieuNhap, dl.phieuXuat);

  let kyList;
  let tenFile;
  const cacQuy = ['1', 'true', 'yes', 'on'].includes(String(q.cac_quy || '').toLowerCase());
  if (cacQuy) {
    const nam = q.nam !== undefined && q.nam !== '' ? Number(q.nam) : new Date().getFullYear();
    if (!Number.isInteger(nam) || nam < 2000 || nam > 2100) throw loiKy('nam không hợp lệ (2000-2100).');
    kyList = cacQuyCuaNam(nam);
    tenFile = `Cac_quy_${nam}`;
  } else {
    const ky = xacDinhKy(q);
    kyList = [ky];
    tenFile = ky.tenFile;
  }
  const wb = taoWorkbook({ tenDonVi, kyList, tatCaDong });
  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, tenFile: `Tong_hop_nhap_xuat_vat_tu_${tenFile}.xlsx`, kyList };
}

module.exports = {
  taoDongSoTongHop,
  locTheoKy,
  tinhTong,
  gomCanhBao,
  xacDinhKy,
  cacQuyCuaNam,
  layDuLieuTuDb,
  layDuLieuKy,
  duLieuKyTuDong,
  taoWorkbook,
  xuatTongHop,
};
