// Xuất Excel cho tài sản, theo khung mẫu sổ của trường (xem mauSo.js):
//  (1) Sổ chi tiết TSCĐ năm N — đúng các cột của sổ mẫu: Nhóm TSCĐ | Tên TSCĐ | Năm đưa vào sử dụng | Số lượng |
//      Nguyên giá (đầu kỳ, tăng, giảm, cuối kỳ) | Hao mòn (LKHM năm trước, HM trong năm, HMTS giảm, LKHM cuối kỳ) |
//      Giá trị còn lại | Tỷ lệ HM. Mỗi trường 1 sheet, dòng nhóm có cộng nhóm.
//  (2) Danh sách TSCĐ đang lọc (đủ thông tin quản lý).
//  (3) Sổ theo dõi CCDC tại nơi sử dụng — mẫu SKT03.
const { tinhHaoMon, docSoLieuGoc } = require('./haoMon');
const M = require('./mauSo');
const { soSanhVi } = require('./tienIch');

const { TINH_TRANG_TEN } = require('./taiSanDungChung');

const sapXepMa = (a, b) => soSanhVi(a.ma_tai_san, b.ma_tai_san);
const theoNhom = (ds) => {
  const m = new Map();
  [...ds].sort((a, b) => soSanhVi(a.nhom, b.nhom) || sapXepMa(a, b))
    .forEach((r) => { const k = r.nhom || '(Chưa phân nhóm)'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
  return m;
};
const namCua = (v) => { const m = /^(\d{4})/.exec(v || ''); return m ? Number(m[1]) : null; };

// ---------- (1) Sổ chi tiết TSCĐ năm N ----------
function dongSoChiTiet(r, nam) {
  // Năm của sổ gốc đã nạp (vd. bản in sổ 2025): in lại đúng số liệu sổ gốc.
  const sg = docSoLieuGoc(r);
  if (sg && Number(sg.nam) === nam) {
    const so = ['dau', 'tang', 'giam', 'cuoi', 'hmTruoc', 'hmNam', 'hmGiam', 'hmCuoi'].map((k) => Math.round(Number(sg[k]) || 0));
    so.push(so[3] - so[7]);
    const n = Number(r.so_nam_su_dung) || 0;
    return { so, tyLe: n > 0 ? Math.round((1 / n) * 10000) / 10000 : null, chotSauDauNam: false, chotSauCuoiNam: false, chuaCoHm: false };
  }
  const batDau = `${nam}-01-01`;
  const dauNam = `${nam - 1}-12-31`;
  const cuoiNam = `${nam}-12-31`;
  const ng = Math.round((Number(r.don_gia) || 0) * (Number(r.so_luong) || 0)); // sổ ghi theo đồng
  const tang = r.ngay_ghi_tang && r.ngay_ghi_tang >= batDau ? ng : 0;
  const dau = tang ? 0 : ng;
  const giam = r.tinh_trang === 'da_giam' && r.ngay_giam && r.ngay_giam >= batDau && r.ngay_giam <= cuoiNam ? ng : 0;
  const cuoi = dau + tang - giam;
  const a = tinhHaoMon(r, dauNam);
  const b = tinhHaoMon(r, cuoiNam);
  const coHm = b.hao_mon_luy_ke !== null;
  const lkTruoc = tang || !coHm ? 0 : Math.min(ng, Math.round(a.hao_mon_luy_ke));
  const hmNam = coHm ? Math.max(0, Math.min(ng, Math.round(b.hao_mon_luy_ke)) - lkTruoc) : 0;
  const hmGiam = giam ? lkTruoc + hmNam : 0;
  const lkCuoi = lkTruoc + hmNam - hmGiam;
  const nam_ = Number(r.so_nam_su_dung) || 0;
  return {
    so: [dau, tang, giam, cuoi, lkTruoc, hmNam, hmGiam, lkCuoi, cuoi - lkCuoi],
    tyLe: nam_ > 0 ? Math.round((1 / nam_) * 10000) / 10000 : null,
    chotSauDauNam: Boolean(r.ngay_chot_hm && r.ngay_chot_hm > dauNam && r.ngay_chot_hm <= cuoiNam && !tang),
    chotSauCuoiNam: Boolean(r.ngay_chot_hm && r.ngay_chot_hm > cuoiNam),
    chuaCoHm: !coHm && ng > 0,
  };
}

async function xuatSoChiTietTscd({ nam, theoTruong, cauHinh, nhomLoc }) {
  const wb = M.taoSo();
  const daDung = new Set();
  const cot = [
    { ten: 'Nhóm TSCĐ', chiSo: 'A', rong: 16 },
    { ten: 'Tên TSCĐ', chiSo: 'B', rong: 34 },
    { ten: 'Năm đưa vào sử dụng', chiSo: '', rong: 8, h: 'center' },
    { ten: 'Số lượng', chiSo: '1', rong: 7, h: 'right' },
    { ten: 'Số đầu kỳ', nhom: 'Nguyên giá tài sản', chiSo: '2', rong: 15 },
    { ten: 'Tăng trong kỳ', nhom: 'Nguyên giá tài sản', chiSo: '3', rong: 14 },
    { ten: 'Giảm trong kỳ', nhom: 'Nguyên giá tài sản', chiSo: '4', rong: 14 },
    { ten: 'Số cuối kỳ', nhom: 'Nguyên giá tài sản', chiSo: '5', rong: 15 },
    { ten: 'LKHM năm trước', nhom: 'Hao mòn tài sản', chiSo: '6', rong: 15 },
    { ten: 'HM tài sản trong năm', nhom: 'Hao mòn tài sản', chiSo: '7', rong: 14 },
    { ten: 'HMTS giảm trong năm', nhom: 'Hao mòn tài sản', chiSo: '8', rong: 14 },
    { ten: 'LKHM cuối kỳ', nhom: 'Hao mòn tài sản', chiSo: '9', rong: 15 },
    { ten: 'Giá trị còn lại', chiSo: '10', rong: 15 },
    { ten: 'Tỷ lệ HM', chiSo: '11', rong: 7, fmt: '0.0%', h: 'right' },
  ];
  const cuoiNam = `${nam}-12-31`;
  const thongKe = [];
  for (const [truong, rows] of theoTruong) {
    const ws = M.themSheet(wb, truong, daDung, cot.length);
    const ds = rows.filter((r) => !(r.ngay_ghi_tang && r.ngay_ghi_tang > cuoiNam))
      .filter((r) => !(r.tinh_trang === 'da_giam' && r.ngay_giam && r.ngay_giam < `${nam}-01-01`));
    let r = M.dauSo(ws, {
      cauHinh,
      truongGoc: truong !== cauHinh.truong_goc ? truong : null,
      tieuDe: `SỔ CHI TIẾT TÀI SẢN CỐ ĐỊNH${nhomLoc ? ' - ' + nhomLoc.toUpperCase() : ''}`,
      phuDe: [{ chu: `Năm ${nam}`, dam: true }],
    });
    r = M.tieuDeBang(ws, r, cot);
    const dongTong = r++;
    const tongAll = new Array(9).fill(0);
    let slAll = 0; let soChot = 0; let soChotSau = 0; let soChuaHm = 0;
    for (const [tenNhom, dsNhom] of theoNhom(ds)) {
      const dongNhom = r++;
      const tongNhom = new Array(9).fill(0);
      let slNhom = 0;
      for (const x of dsNhom) {
        const k = dongSoChiTiet(x, nam);
        if (k.chotSauDauNam) soChot++;
        if (k.chotSauCuoiNam) soChotSau++;
        if (k.chuaCoHm) soChuaHm++;
        const tenDayDu = x.tinh_trang === 'da_giam' ? `${x.ten} (ghi giảm ${M.ngayVN(x.ngay_giam)})` : x.ten;
        // Không rõ ngày ghi tăng (để trống) thì cột năm đưa vào sử dụng cũng để trống.
        M.dongBang(ws, r++, cot, [x.ma_tai_san, tenDayDu, namCua(x.ngay_su_dung || x.ngay_ghi_tang) || '', x.so_luong, ...k.so, k.tyLe]);
        k.so.forEach((v, i) => { tongNhom[i] += v; tongAll[i] += v; });
        slNhom += x.so_luong; slAll += x.so_luong;
      }
      M.dongBang(ws, dongNhom, cot, ['', tenNhom, '', slNhom, ...tongNhom, null], 'nhom');
    }
    M.dongBang(ws, dongTong, cot, ['', `TỔNG CỘNG`, '', slAll, ...tongAll, null], 'tong');
    const ghiChu = [];
    if (soChot) ghiChu.push(`- ${soChot} tài sản nạp từ sổ có số dư hao mòn chốt trong năm ${nam}: LKHM năm trước (31/12/${nam - 1}) là số ước tính lùi từ số chốt theo tỷ lệ hao mòn; hao mòn trong năm = các tháng trước ngày chốt (ước tính) + các tháng sau ngày chốt.`);
    if (soChotSau) ghiChu.push(`- ${soChotSau} tài sản có số dư hao mòn chốt sau năm ${nam}: số liệu năm ${nam} là số ước tính lùi từ số chốt.`);
    if (soChuaHm) ghiChu.push(`- ${soChuaHm} tài sản chưa có thời gian sử dụng / tỷ lệ hao mòn nên chưa tính hao mòn.`);
    M.chanSo(ws, r, { cauHinh, ghiChu });
    thongKe.push({ truong, so: ds.length });
  }
  if (!theoTruong.length) M.themSheet(wb, 'Trống', daDung, 1).getCell(1, 2).value = 'Không có tài sản cố định nào.';
  return { buffer: await wb.xlsx.writeBuffer(), thongKe };
}

// ---------- (2) Danh sách TSCĐ đang lọc ----------
async function xuatDanhSachTscd({ items, den, moTaLoc, cauHinh }) {
  const wb = M.taoSo();
  const nhieuTruong = new Set(items.map((r) => r.truong)).size > 1;
  const cot = [
    { ten: 'STT', chiSo: 'A', rong: 5, h: 'center' },
    ...(nhieuTruong ? [{ ten: 'Trường / đơn vị gốc', chiSo: 'B', rong: 24 }] : []),
    { ten: 'Mã tài sản', chiSo: 'C', rong: 16 },
    { ten: 'Tên tài sản', chiSo: 'D', rong: 34 },
    { ten: 'Nhóm', chiSo: 'E', rong: 18 },
    { ten: 'Năm đưa vào sử dụng', chiSo: 'F', rong: 8, h: 'center' },
    { ten: 'Số lượng', chiSo: '1', rong: 7 },
    { ten: 'Nguyên giá', chiSo: '2', rong: 15 },
    { ten: 'Tỷ lệ HM', chiSo: '3', rong: 7, fmt: '0.0%' },
    { ten: `Hao mòn lũy kế đến ${M.ngayVN(den)}`, chiSo: '4', rong: 15 },
    { ten: 'Giá trị còn lại', chiSo: '5=2-4', rong: 15 },
    { ten: 'Nguồn KP', chiSo: 'G', rong: 8, h: 'center' },
    { ten: 'Bộ phận sử dụng', chiSo: 'H', rong: 18 },
    { ten: 'Người sử dụng', chiSo: 'I', rong: 16 },
    { ten: 'Vị trí', chiSo: 'K', rong: 12 },
    { ten: 'Tình trạng', chiSo: 'L', rong: 12 },
    { ten: 'Ghi chú', chiSo: 'M', rong: 30 },
  ];
  const ws = M.themSheet(wb, 'Danh sách TSCĐ', new Set(), cot.length);
  let r = M.dauSo(ws, { cauHinh, tieuDe: 'DANH SÁCH TÀI SẢN CỐ ĐỊNH', phuDe: [moTaLoc || 'Toàn bộ danh sách', `Hao mòn tính đến ngày ${M.ngayVN(den)}`] });
  r = M.tieuDeBang(ws, r, cot);
  const tong = [0, 0, 0, 0];
  items.forEach((x, i) => {
    const giam = x.tinh_trang === 'da_giam';
    const hm = x.hao_mon_luy_ke || 0;
    const cl = x.gia_tri_con_lai === null || x.gia_tri_con_lai === undefined ? x.thanh_tien : x.gia_tri_con_lai;
    if (!giam) { tong[0] += x.so_luong; tong[1] += x.thanh_tien; tong[2] += hm; tong[3] += cl; }
    const nam_ = Number(x.so_nam_su_dung) || 0;
    M.dongBang(ws, r++, cot, [
      i + 1, ...(nhieuTruong ? [x.truong] : []), x.ma_tai_san, x.ten, x.nhom, namCua(x.ngay_su_dung || x.ngay_ghi_tang),
      x.so_luong, x.thanh_tien, nam_ > 0 ? Math.round((1 / nam_) * 10000) / 10000 : null, hm, cl,
      `TK ${x.nguon_kinh_phi || '661.2'}`, x.bo_phan, x.nguoi_su_dung, x.vi_tri,
      TINH_TRANG_TEN[x.tinh_trang] + (giam && x.ngay_giam ? ` ${M.ngayVN(x.ngay_giam)}` : ''),
      [x.ly_do_giam ? `Lý do giảm: ${x.ly_do_giam}` : '', x.ghi_chu].filter(Boolean).join('. '),
    ]);
  });
  const dongT = cot.map(() => null);
  const lech = nhieuTruong ? 1 : 0;
  dongT[2 + lech] = 'TỔNG CỘNG (không tính tài sản đã ghi giảm)';
  dongT[5 + lech] = tong[0]; dongT[6 + lech] = tong[1]; dongT[8 + lech] = tong[2]; dongT[9 + lech] = tong[3];
  M.dongBang(ws, r++, cot, dongT, 'tong');
  M.chanSo(ws, r, { cauHinh });
  return wb.xlsx.writeBuffer();
}

// ---------- (3) Sổ theo dõi CCDC tại nơi sử dụng (SKT03) ----------
async function xuatSoCcdc({ theoTruong, tuNgay, denNgay, noiSuDung, cauHinh }) {
  const wb = M.taoSo();
  const daDung = new Set();
  const cot = [
    { ten: 'Ngày, tháng ghi sổ', chiSo: 'A', rong: 10, h: 'center' },
    { ten: 'Số hiệu', nhom: 'Chứng từ (ghi tăng)', chiSo: 'B', rong: 10 },
    { ten: 'Ngày tháng', nhom: 'Chứng từ (ghi tăng)', chiSo: 'C', rong: 10, h: 'center' },
    { ten: 'Tên công cụ, dụng cụ', nhom: 'Ghi tăng công cụ, dụng cụ', chiSo: 'D', rong: 30 },
    { ten: 'Mã CCDC', nhom: 'Ghi tăng công cụ, dụng cụ', chiSo: 'H', rong: 13 },
    { ten: 'Đơn vị tính', nhom: 'Ghi tăng công cụ, dụng cụ', chiSo: '1', rong: 7, h: 'center' },
    { ten: 'Số lượng', nhom: 'Ghi tăng công cụ, dụng cụ', chiSo: '2', rong: 7 },
    { ten: 'Đơn giá', nhom: 'Ghi tăng công cụ, dụng cụ', chiSo: '3', rong: 12 },
    { ten: 'Thành tiền', nhom: 'Ghi tăng công cụ, dụng cụ', chiSo: '4', rong: 14 },
    { ten: 'Số hiệu', nhom: 'Chứng từ (ghi giảm)', chiSo: 'E', rong: 9 },
    { ten: 'Ngày tháng', nhom: 'Chứng từ (ghi giảm)', chiSo: 'F', rong: 10, h: 'center' },
    { ten: 'Lý do', nhom: 'Ghi giảm công cụ, dụng cụ', chiSo: 'G', rong: 18 },
    { ten: 'Số lượng', nhom: 'Ghi giảm công cụ, dụng cụ', chiSo: '5', rong: 7 },
    { ten: 'Thành tiền', nhom: 'Ghi giảm công cụ, dụng cụ', chiSo: '6', rong: 13 },
    { ten: 'Ghi chú', chiSo: '7', rong: 22 },
  ];
  const trongKy = (v) => v && v >= tuNgay && v <= denNgay;
  for (const [truong, rows] of theoTruong) {
    const ws = M.themSheet(wb, truong, daDung, cot.length);
    const ds = rows.filter((x) => !(x.ngay_ghi_tang && x.ngay_ghi_tang > denNgay))
      .filter((x) => !(x.tinh_trang === 'da_giam' && x.ngay_giam && x.ngay_giam < tuNgay));
    let r = M.dauSo(ws, {
      cauHinh,
      truongGoc: truong !== cauHinh.truong_goc ? truong : null,
      mauSo: 'Mẫu số SKT03',
      tieuDe: 'SỔ THEO DÕI CÔNG CỤ, DỤNG CỤ TẠI NƠI SỬ DỤNG',
      phuDe: [`Từ ngày ${M.ngayVN(tuNgay)} đến ngày ${M.ngayVN(denNgay)}`, { chu: `Tên đơn vị; Phòng, Ban (hoặc người sử dụng): ${noiSuDung || 'Toàn trường'}`, trai: true, dam: true }],
    });
    r = M.tieuDeBang(ws, r, cot);
    let slT = 0; let ttT = 0; let slG = 0; let ttG = 0;
    for (const [tenNhom, dsNhom] of theoNhom(ds)) {
      M.dongTieuDeNhom(ws, r++, `Loại công cụ dụng cụ: ${tenNhom}`);
      for (const x of dsNhom) {
        const tt = Math.round((Number(x.don_gia) || 0) * (Number(x.so_luong) || 0));
        // Không rõ ngày ghi tăng (số dư có từ trước khi mở sổ) thì không phải phát sinh tăng trong kỳ.
        const tang = trongKy(x.ngay_ghi_tang);
        const giam = x.tinh_trang === 'da_giam' && trongKy(x.ngay_giam);
        slT += x.so_luong; ttT += tt;
        if (giam) { slG += x.so_luong; ttG += tt; }
        const ghi = [x.vi_tri, x.nguoi_su_dung, x.tinh_trang === 'hong' ? 'Hỏng' : ''].filter(Boolean).join(' · ');
        M.dongBang(ws, r++, cot, [
          tang ? M.ngayVN(x.ngay_ghi_tang) : '', x.so_chung_tu || '', tang ? M.ngayVN(x.ngay_ghi_tang) : '',
          x.ten, x.ma_tai_san, x.dvt || '', x.so_luong, x.don_gia, tt,
          '', giam ? M.ngayVN(x.ngay_giam) : '', giam ? x.ly_do_giam : '', giam ? x.so_luong : null, giam ? tt : null, ghi,
        ]);
      }
    }
    M.dongBang(ws, r++, cot, ['', '', '', 'Tổng cộng', '', '', slT, null, ttT, '', '', '', slG, ttG, ''], 'tong');
    M.chanSo(ws, r, {
      cauHinh,
      nhan: ['Người lập báo cáo', 'Kế toán trưởng', 'Hiệu trưởng'],
      ghiChu: ['- Sổ này có ..... trang, đánh số từ trang số 01 đến trang .....', `- Ngày mở sổ: ${M.ngayVN(tuNgay)}`],
    });
  }
  if (!theoTruong.length) M.themSheet(wb, 'Trống', daDung, 1).getCell(1, 2).value = 'Không có công cụ dụng cụ nào.';
  return wb.xlsx.writeBuffer();
}

module.exports = { xuatSoChiTietTscd, xuatDanhSachTscd, xuatSoCcdc, dongSoChiTiet };
