// Nạp SỔ CHI TIẾT TÀI SẢN CỐ ĐỊNH (bản in sổ năm, nhiều sheet: máy móc, ô tô, nhà cửa, vô hình...)
// vào mục "Tài sản cố định" của website.
//
//   node scripts/import-tai-san.js "duong/dan/so-tscd.xlsx" [--dry-run] [--nam=2025] [--sheet=chuoi] [--chi-tiet] [--truong="Tên trường"]
//   (mặc định --truong là trường của bạn; mã tài sản chỉ cần duy nhất trong từng trường)
//
// Cách đọc (tự nhận theo tiêu đề cột, không cố định số cột — mỗi sheet bố trí cột khác nhau):
//  - Dòng tiêu đề bảng = dòng có "Tên TSCĐ" và "Số cuối kỳ". Mỗi sheet có thể có nhiều khối (nhiều năm):
//    chỉ nạp khối của NĂM MỚI NHẤT (hoặc --nam), khối đầu tiên nếu trùng năm.
//  - Dòng tài sản = dòng có mã tài sản dài (T01002999-...), số thứ tự (sheet không có mã dài), hoặc dòng
//    "nâng cấp" không có mã nằm dưới tài sản. Dòng nhóm / tổng cộng / "Ngân sách", "Quỹ", "Khác" bị bỏ qua.
//  - Sổ không có ngày ghi tăng: lấy "Năm đưa vào sử dụng" nếu có (đặt 01/01 năm đó), không thì tạm đặt
//    01/01 của năm sổ (số dư đầu kỳ) hoặc 31/12 (tăng trong kỳ) — cần cập nhật sau.
//  - Hao mòn lũy kế lấy từ cột "LKHM cuối kỳ" làm số dư tại ngày chốt 31/12 của năm sổ; hao mòn các tháng sau
//    tính tiếp theo tỷ lệ hao mòn (thời gian sử dụng = 1 / tỷ lệ).
//  - Tài sản có "Giảm trong kỳ" và số cuối kỳ = 0 được nạp ở trạng thái "Đã ghi giảm".
//  - Chạy lại không bị trùng: bỏ qua tài sản đã có (theo mã, hoặc theo tên + nguyên giá nếu không có mã).
//  - Trước khi ghi thật, tự sao lưu database sang data/kho.db.bak-<thời gian>.

const path = require('path');
const ExcelJS = require('exceljs');
const { db } = require('../src/db');
const { chuanHoa, themTaiSan, ghiLichSu, TRUONG_MAC_DINH } = require('../src/services/taiSanDungChung');
const { namKhoaCua } = require('../src/services/khoaSo');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const chiTiet = args.includes('--chi-tiet');
const namArg = Number((args.find((a) => a.startsWith('--nam=')) || '').slice(6)) || null;
const sheetLoc = (args.find((a) => a.startsWith('--sheet=')) || '').slice(8).toLowerCase() || null;
const TRUONG_ARG = (args.find((a) => a.startsWith('--truong=')) || '').slice(9).trim() || null;
const ngayChotArg = (args.find((a) => a.startsWith('--ngay-chot=')) || '').slice(12).trim() || null;
const filePath = args.find((a) => !a.startsWith('--'));
if (!filePath) {
  console.error('Thiếu đường dẫn file. Dùng: node scripts/import-tai-san.js "duong/dan/file.xlsx" [--dry-run] [--nam=2025]');
  process.exit(1);
}

const {
  giaTriO, chuoiO, soO, chuanChu, lam2, tuTyLe, fmtNgay, timTieuDeS24H, docS24H, timTieuDeTongHop, docTongHop, docSkt03Docx,
} = require('./lib/doc-tai-san');

// ---------- Nhận cột theo tiêu đề ----------
const MAU_COT = [
  ['ma', /^nhom tscd/], ['ten', /^ten tscd/], ['sl', /^so luong/], ['namSx', /^nam san xuat/], ['namSd', /^nam dua vao/],
  ['dau', /^so dau ky/], ['tang', /^tang trong ky/], ['giam', /^giam trong ky/], ['cuoi', /^so cuoi ky/],
  ['hmTruoc', /^lkhm nam truoc/], ['hmNam', /^hm tai san trong nam/], ['hmGiam', /^hmts giam/], ['hmCuoi', /^lkhm cuoi ky/],
  ['conLai', /^gia tri con lai/], ['tyLe', /^t[yi] le hm/],
];
function laDongTieuDe(ws, r) {
  const t = [];
  ws.getRow(r).eachCell({ includeEmpty: false }, (c) => t.push(chuanChu(chuoiO(giaTriO(c)))));
  return t.some((x) => /^ten tscd/.test(x)) && t.some((x) => /^so cuoi ky/.test(x));
}
function docCot(ws, r) {
  const cot = {};
  ws.getRow(r).eachCell({ includeEmpty: false }, (c, i) => {
    const t = chuanChu(chuoiO(giaTriO(c)));
    for (const [khoa, re] of MAU_COT) {
      if (cot[khoa] === undefined && re.test(t)) { cot[khoa] = i; break; }
    }
  });
  return cot;
}

// ---------- Tách các khối (mỗi khối = 1 bảng sổ của 1 năm) ----------
function timKhoi(ws) {
  const khoi = [];
  let cur = null;
  let namCho = null;
  for (let r = 1; r <= ws.rowCount; r++) {
    const vanBan = [];
    ws.getRow(r).eachCell({ includeEmpty: false }, (c) => { const s = chuoiO(giaTriO(c)); if (s && s.length < 400) vanBan.push(s); });
    const gop = chuanChu([...new Set(vanBan)].join(' '));
    if (laDongTieuDe(ws, r)) {
      cur = { dongTieuDe: r, cot: docCot(ws, r), nam: namCho, dong: [] };
      khoi.push(cur);
      namCho = null;
      continue;
    }
    // Dòng tiêu đề sổ (mở một sổ mới) hoặc dòng ký tên (kết thúc) đều đóng khối hiện tại.
    const laTieuDeSo = gop.includes('so chi tiet tai san');
    const laKyTen = /(^| )nguoi lap( bieu)?( |$)/.test(gop);
    if (laTieuDeSo || laKyTen) cur = null;
    if (!cur) {
      const m = /nam:?\s*(20\d{2})/.exec(gop);
      if (m) namCho = Number(m[1]);
    } else {
      cur.dong.push(r);
    }
  }
  return khoi;
}

// ---------- Phân loại dòng & dựng tài sản ----------
const RE_MA_DAI = /^[A-Z0-9][A-Z0-9.\-_/]{6,}$/i;
const RE_MA_NGAN = /^[A-Za-z0-9]{1,3}$/;
const RE_PHAN_BO = /^(ngan sach|quy |quy$|khac$|hm giam|dieu chinh|nhap |tong |cong )/;

function xuLyKhoi(ws, kh, namSo, thongKe, canhBao) {
  const c = kh.cot;
  if (!c.ten || !c.cuoi) { canhBao.push(`Sheet "${ws.name}": không nhận được cột Tên TSCĐ / Số cuối kỳ`); return []; }
  const lay = (r, khoa) => (c[khoa] ? giaTriO(ws.getCell(r, c[khoa])) : null);
  const lamSo = (r, khoa) => soO(lay(r, khoa));
  const tai = [];
  const doiChieu = []; // [{ dongNhom:[...], leaves:[], ... }]
  let phan = null;
  const moPhan = () => { phan = { nhom: [], la: [] }; doiChieu.push(phan); };
  let nhom = '';
  let leafTruoc = null;

  const dongKhoi = kh.dong.filter((r) => {
    const ten = chuoiO(lay(r, 'ten'));
    return ten && !(chuanChu(ten) === 'b' && chuanChu(chuoiO(lay(r, 'ma'))) === 'a');
  });
  const coMaDai = dongKhoi.some((r) => { const b = chuoiO(lay(r, 'ma')); return b && RE_MA_DAI.test(b) && /\D/.test(b) && /\d/.test(b); });

  const gtri = (r) => {
    const sl = lamSo(r, 'sl');
    const dau = lamSo(r, 'dau'); const tang = lamSo(r, 'tang'); const giam = lamSo(r, 'giam');
    let cuoi = lamSo(r, 'cuoi');
    if (cuoi === null && (dau !== null || tang !== null || giam !== null)) cuoi = (dau || 0) + (tang || 0) - (giam || 0);
    const hmTruoc = lamSo(r, 'hmTruoc'); const hmNam = lamSo(r, 'hmNam'); const hmGiam = lamSo(r, 'hmGiam');
    let hmCuoi = lamSo(r, 'hmCuoi');
    if (hmCuoi === null && (hmTruoc !== null || hmNam !== null || hmGiam !== null)) hmCuoi = (hmTruoc || 0) + (hmNam || 0) - (hmGiam || 0);
    return { sl, dau, tang, giam, cuoi, hmTruoc, hmNam, hmGiam, hmCuoi, tyLe: lamSo(r, 'tyLe'), conLai: lamSo(r, 'conLai') };
  };
  const coSo = (g) => [g.cuoi, g.dau, g.giam].some((v) => v !== null && v !== 0);

  dongKhoi.forEach((r, idx) => {
    const ten = chuoiO(lay(r, 'ten'));
    const bRaw = lay(r, 'ma');
    const bStr = chuoiO(bRaw);
    const bSo = typeof bRaw === 'number' ? bRaw : null;
    const g = gtri(r);
    const tenChuan = chuanChu(ten);
    let loai = 'bo';

    if (bStr && bSo === null && RE_MA_DAI.test(bStr) && /\d/.test(bStr) && /\D/.test(bStr)) {
      loai = coSo(g) ? 'la' : 'bo';
    } else if (!bStr) {
      if (RE_PHAN_BO.test(tenChuan) || !coSo(g)) loai = 'bo';
      else if (leafTruoc) loai = 'la';
      else { loai = 'bo'; canhBao.push(`Sheet "${ws.name}" dòng ${r}: dòng không mã nằm trước mọi tài sản — bỏ qua ("${ten}")`); }
    } else if (bSo !== null || RE_MA_NGAN.test(bStr)) {
      if (!coMaDai) loai = bSo !== null ? 'la' : 'nhom';
      else loai = g.sl === 1 ? 'la' : 'nhom';
      if (loai === 'la' && !coSo(g)) loai = 'bo';
    } else {
      loai = 'bo'; // ghi chú dạng câu dài
    }

    if (loai === 'nhom') {
      nhom = ten;
      if (!phan || phan.la.length) moPhan();
      phan.nhom.push({ dong: r, ten, cuoi: g.cuoi, hmCuoi: g.hmCuoi });
      return;
    }
    if (loai === 'bo') { thongKe.boQua++; return; }

    // ----- dòng tài sản -----
    leafTruoc = r;
    const sl = g.sl && g.sl >= 1 ? Math.round(g.sl) : 1;
    let nguyenGia;
    let hm;
    let giamKy = false;
    if (g.cuoi !== null && g.cuoi > 0) {
      nguyenGia = g.cuoi;
      hm = g.hmCuoi !== null ? g.hmCuoi : (g.conLai !== null ? g.cuoi - g.conLai : 0);
    } else if ((g.giam || 0) > 0 || (g.dau || 0) > 0) {
      nguyenGia = g.giam > 0 ? g.giam : g.dau;
      hm = g.hmGiam !== null && g.hmGiam > 0 ? g.hmGiam : ((g.hmTruoc || 0) + (g.hmNam || 0));
      giamKy = true;
    } else { thongKe.boQua++; return; }
    nguyenGia = lam2(nguyenGia);
    hm = lam2(Math.min(Math.max(hm || 0, 0), nguyenGia));

    // Thời gian sử dụng: 1 / tỷ lệ hao mòn; nếu thiếu tỷ lệ thì suy từ hao mòn cả năm (chỉ khi không tăng trong kỳ).
    let tyLe = g.tyLe && g.tyLe > 0 ? g.tyLe : null;
    if (tyLe === null && g.hmNam > 0 && !(g.tang > 0) && g.cuoi > 0) tyLe = g.hmNam / g.cuoi;
    const soNam = tuTyLe(tyLe);
    if (tyLe !== null && soNam === null) canhBao.push(`Sheet "${ws.name}" dòng ${r}: tỷ lệ hao mòn bất thường (${tyLe}) — bỏ qua thời gian sử dụng`);

    const namSd = (() => {
      const m = /(19|20)\d{2}/.exec(chuoiO(lay(r, 'namSd')));
      const y = m ? Number(m[0]) : null;
      return y && y <= namSo ? y : null;
    })();
    let ngayTang;
    let ghiChuNgay = '';
    if (namSd) { ngayTang = `${namSd}-01-01`; ghiChuNgay = `ngày ghi tăng chỉ biết theo năm đưa vào sử dụng (${namSd})`; }
    else if (g.tang > 0 && !(g.dau > 0)) { ngayTang = `${namSo}-12-31`; ghiChuNgay = `tăng trong năm ${namSo}, chưa rõ ngày`; }
    else { ngayTang = null; ghiChuNgay = 'chưa rõ ngày ghi tăng (số dư đầu kỳ)'; } // để trống = có từ trước năm sổ

    // Mã tài sản
    let ma = null;
    let maTuFile = false;
    if (bStr && bSo === null && RE_MA_DAI.test(bStr) && /\D/.test(bStr)) { ma = bStr; maTuFile = true; }
    else if (bSo !== null && !coMaDai) { ma = `${tienToSheet(ws.name)}-${String(Math.round(bSo)).padStart(4, '0')}`; maTuFile = true; }

    tai.push({
      dong: r, ten, nhom, sl, nguyenGia, hm, soNam, ngayTang, ma, maTuFile, giamKy,
      // Số liệu sổ gốc của năm này: sổ chi tiết năm đó in lại đúng số gốc (cột so_lieu_goc, xem db.js).
      soLieuGoc: { nam: namSo, dau: g.dau, tang: g.tang, giam: g.giam, cuoi: g.cuoi, hmTruoc: g.hmTruoc, hmNam: g.hmNam, hmGiam: g.hmGiam, hmCuoi: g.hmCuoi },
      ghiChu: `Nạp từ sổ TSCĐ ${namSo} (sheet "${ws.name}", dòng ${r}): ${ghiChuNgay}${soNam === null && hm < nguyenGia ? '; chưa xác định được thời gian sử dụng' : ''}.`,
    });
    if (!phan) moPhan();
    phan.la.push({ dong: r, cuoi: giamKy ? 0 : nguyenGia, hmCuoi: giamKy ? 0 : hm });
  });

  // Đối chiếu: dòng nhóm cuối của mỗi cụm nhóm liên tiếp phải bằng tổng các tài sản bên dưới.
  const dc = [];
  doiChieu.forEach((p) => {
    if (!p.nhom.length) return;
    const cuoiNhom = p.nhom[p.nhom.length - 1];
    const tong = p.la.reduce((s, x) => s + x.cuoi, 0);
    const tongHm = p.la.reduce((s, x) => s + x.hmCuoi, 0);
    dc.push({ ten: cuoiNhom.ten, dong: cuoiNhom.dong, soTs: p.la.length, sheetNguyenGia: cuoiNhom.cuoi, tongNguyenGia: tong, sheetHm: cuoiNhom.hmCuoi, tongHm });
  });
  thongKe.doiChieu = dc;
  return tai;
}
function tienToSheet(ten) {
  const t = chuanChu(ten);
  if (t.replace(/\s/g, '').includes('maymoc')) return 'MM';
  if (t.includes('oto') || t.includes('o to') || t.includes('xe')) return 'OTO';
  if (t.includes('nha')) return 'NC';
  if (t.includes('vo hinh')) return 'VH';
  return 'TS';
}

// ---------- Chạy ----------
function nhanDangSheet(ws) {
  if (timKhoi(ws).length) return 'so-chi-tiet';
  if (timTieuDeS24H(ws)) return 's24h';
  if (timTieuDeTongHop(ws)) return 'tong-hop';
  return null;
}
const TEN_DINH_DANG = {
  'so-chi-tiet': 'Sổ chi tiết TSCĐ (bản in sổ theo năm)', s24h: 'Sổ TSCĐ mẫu S24-H', 'tong-hop': 'Bảng tổng hợp danh mục tài sản',
  skt03: 'Sổ theo dõi CCDC tại nơi sử dụng (SKT03, Word) → nạp vào Công cụ dụng cụ',
};

async function chay() {
  console.log(`${dryRun ? '=== DRY-RUN: chỉ đọc, KHÔNG ghi database ===\n' : ''}File: ${path.basename(filePath)}`);
  const canhBao = [];
  const theoSheet = [];
  const tatCaKhoi = [];
  const laWord = /\.docx$/i.test(filePath);
  const wb = new ExcelJS.Workbook();
  if (!laWord) await wb.xlsx.readFile(filePath);
  for (const ws of laWord ? [] : wb.worksheets) {
    if (sheetLoc && !ws.name.toLowerCase().includes(sheetLoc)) continue;
    const dd = nhanDangSheet(ws);
    if (!dd) { console.log(`Sheet "${ws.name}": không có bảng sổ tài sản nhận dạng được (bỏ qua).`); continue; }
    const muc = { ws, dd };
    if (dd === 'so-chi-tiet') {
      muc.khoi = timKhoi(ws);
      muc.khoi.forEach((k) => { if (k.nam) tatCaKhoi.push(k.nam); });
    }
    theoSheet.push(muc);
  }
  const namMacDinh = namArg || (tatCaKhoi.length ? Math.max(...tatCaKhoi) : new Date().getFullYear());

  const ketQua = [];
  if (laWord) {
    // Sổ theo dõi CCDC tại nơi sử dụng (SKT03) dạng Word.
    const r = await docSkt03Docx(filePath);
    canhBao.push(...r.canhBao.map((c) => `File Word: ${c}`));
    ketQua.push({
      ws: { name: 'Word' }, dd: 'skt03', loai: 'CCDC', khoi: { dongTieuDe: r.dongTieuDe }, namSo: null,
      ngayChot: ngayChotArg || r.ngayChot || new Date().toISOString().slice(0, 10), nhan: r.nhan,
      truong: TRUONG_ARG || r.truongPhatHien || TRUONG_MAC_DINH, tai: r.tai, thongKe: r.thongKe,
    });
  }
  for (const { ws, dd, khoi } of theoSheet) {
    if (dd === 'so-chi-tiet') {
      // Chọn khối: khối đầu tiên của năm đích (--nam hoặc năm mới nhất của sheet); khối không rõ năm tính là năm mặc định.
      const gan = khoi.map((k) => ({ ...k, namHd: k.nam || namMacDinh }));
      const namSheet = namArg || Math.max(...gan.map((k) => k.namHd));
      const ungVien = gan.filter((k) => k.namHd === namSheet);
      if (!ungVien.length) { console.log(`Sheet "${ws.name}": không có khối năm ${namSheet} (bỏ qua).`); continue; }
      const chon = ungVien[0];
      const bo = gan.filter((k) => k !== chon);
      if (bo.length) {
        canhBao.push(`Sheet "${ws.name}": có ${gan.length} khối (${gan.map((k) => `dòng ${k.dongTieuDe}: năm ${k.namHd}`).join('; ')}). `
          + `Chỉ nạp khối dòng ${chon.dongTieuDe} (năm ${chon.namHd}); các khối còn lại bị bỏ qua${ungVien.length > 1 ? ' — có KHỐI KHÁC CÙNG NĂM, số liệu có thể khác nhau, cần kiểm tra' : ''}.`);
      }
      const thongKe = { boQua: 0 };
      const tai = xuLyKhoi(ws, chon, chon.namHd, thongKe, canhBao);
      ketQua.push({
        ws, dd, khoi: chon, namSo: chon.namHd, ngayChot: ngayChotArg || `${chon.namHd}-12-31`, nhan: `sổ TSCĐ ${chon.namHd}`,
        truong: TRUONG_ARG || TRUONG_MAC_DINH, tai, thongKe,
      });
    } else {
      const r = dd === 's24h' ? docS24H(ws) : docTongHop(ws);
      canhBao.push(...r.canhBao.map((c) => `Sheet "${ws.name}": ${c}`));
      let ngayChot = ngayChotArg || r.ngayChot;
      if (!ngayChot && dd === 'tong-hop') {
        // Bảng tổng hợp không ghi "giá trị còn lại tính đến ngày nào" -> không đoán, bắt buộc người dùng chỉ định.
        console.error(`Sheet "${ws.name}": bảng tổng hợp danh mục không ghi ngày tính "giá trị còn lại".`
          + ' Hãy chạy lại kèm --ngay-chot=YYYY-MM-DD (vd --ngay-chot=2026-09-30 nếu số liệu tính đến hết tháng 9/2026).');
        process.exit(1);
      }
      if (!ngayChot) ngayChot = new Date().toISOString().slice(0, 10);
      ketQua.push({
        ws, dd, khoi: { dongTieuDe: r.dongTieuDe }, namSo: null, ngayChot, nhan: r.nhan,
        truong: TRUONG_ARG || r.truongPhatHien || TRUONG_MAC_DINH, tai: r.tai, thongKe: r.thongKe,
      });
    }
  }
  for (const kq of ketQua) {
    console.log(`Sheet "${kq.ws.name}": ${TEN_DINH_DANG[kq.dd]} → trường "${kq.truong}", ${kq.loai === 'CCDC' ? 'sổ đến ngày' : 'ngày chốt hao mòn'} ${fmtNgay(kq.ngayChot)}.`);
  }
  console.log('');

  // ----- Dedupe + báo cáo -----
  const daCoTheoTruong = new Map();
  const daCoCua = (loai, truong) => {
    const k = `${loai}|${truong}`;
    if (!daCoTheoTruong.has(k)) {
      const s = new Set();
      for (const r of db.prepare('SELECT ma_tai_san, ten, don_gia, so_luong, nhom FROM tai_san WHERE loai = ? AND truong = ?').all(loai, truong)) {
        if (r.ma_tai_san) s.add('ma:' + r.ma_tai_san);
        s.add(`ten:${r.ten}|${lam2(r.don_gia * r.so_luong)}|${r.nhom || ''}`);
      }
      daCoTheoTruong.set(k, s);
    }
    return daCoTheoTruong.get(k);
  };
  ketQua.forEach((kq) => { kq.loai = kq.loai || 'TSCD'; });
  const trongFile = new Map();
  const choNap = [];
  let boDaCo = 0;
  for (const kq of ketQua) {
    const daCo = daCoCua(kq.loai, kq.truong);
    let nap = 0; let tren = 0; let giam = 0;
    for (const t of kq.tai) {
      tren++;
      let ma = t.ma;
      if (ma) {
        const khoaMa = `${kq.loai}|${kq.truong}|${ma}`;
        const dem = (trongFile.get(khoaMa) || 0) + 1;
        trongFile.set(khoaMa, dem);
        if (dem > 1) { canhBao.push(`Sheet "${kq.ws.name}" dòng ${t.dong}: mã "${ma}" xuất hiện ${dem} lần trong sổ — tài sản này được đặt mã "${ma}-${dem}"`); ma = `${ma}-${dem}`; }
      }
      const khoaTen = `ten:${t.ten}|${t.nguyenGia}|${t.nhom || ''}`;
      if ((ma && daCo.has('ma:' + ma)) || (!ma && daCo.has(khoaTen))) { boDaCo++; continue; }
      t.maCuoi = ma;
      choNap.push({ kq, t });
      daCo.add(ma ? 'ma:' + ma : khoaTen);
      nap++; if (t.giamKy) giam++;
    }
    console.log(`Sheet "${kq.ws.name}" (${kq.nhan}, tiêu đề dòng ${kq.khoi.dongTieuDe}): đọc ${tren} tài sản → nạp ${nap} (trong đó ${giam} đã ghi giảm), bỏ qua dòng không phải tài sản/không có số ${kq.thongKe.boQua}.`);
    for (const d of kq.thongKe.doiChieu || []) {
      const lechNg = Math.round(d.tongNguyenGia - (d.sheetNguyenGia || 0));
      const lechHm = Math.round(d.tongHm - (d.sheetHm || 0));
      const khop = Math.abs(lechNg) <= 1 && (d.sheetHm === null || Math.abs(lechHm) <= 1);
      console.log(`    ${khop ? 'KHỚP' : 'LỆCH'} nhóm "${d.ten.slice(0, 60)}" (dòng ${d.dong}): ${d.soTs} tài sản; nguyên giá ${khop ? 'bằng sổ' : `sổ ${fmt(d.sheetNguyenGia)} / cộng lại ${fmt(d.tongNguyenGia)} (lệch ${fmt(lechNg)})`}`
        + (d.sheetHm !== null && d.sheetHm !== undefined ? `; hao mòn lũy kế ${Math.abs(lechHm) <= 1 ? 'bằng sổ' : `sổ ${fmt(d.sheetHm)} / cộng lại ${fmt(d.tongHm)} (lệch ${fmt(lechHm)})`}` : ''));
    }
  }
  if (boDaCo) console.log(`\nBỏ qua ${boDaCo} tài sản đã có trong database.`);

  // ----- Kiểm tra từng bản ghi bằng đúng bộ kiểm tra của form -----
  const hopLe = [];
  const loi = [];
  for (const x of choNap) {
    const { t, kq } = x;
    const dauVao = {
      loai: kq.loai, truong: kq.truong, ma_tai_san: t.maCuoi, ten: t.ten, nhom: t.nhom, dvt: t.dvt, vi_tri: t.viTri,
      so_luong: t.sl, don_gia: t.donGia ?? lam2(t.nguyenGia / t.sl), so_chung_tu: t.soChungTu,
      ngay_ghi_tang: t.ngayTang || null, ngay_su_dung: t.ngaySuDung || t.ngayTang || null, so_nam_su_dung: t.soNam, // không rõ ngày: để trống
      hm_luy_ke_ban_dau: t.khongChot ? null : t.hm, ngay_chot_hm: t.khongChot ? null : kq.ngayChot, nguon_kinh_phi: '661.2', ghi_chu: t.ghiChu,
    };
    const kt = chuanHoa(kq.loai, dauVao);
    // Năm đã khóa sổ: không nạp tài sản ghi tăng / ghi giảm trong năm đó (mở khóa ở mục "Khóa sổ" trước).
    const namKhoa = kt.loi ? null : namKhoaCua(kt.gia_tri.ngay_ghi_tang, t.giamKy ? t.ngayGiam || kq.ngayChot : null);
    if (kt.loi) loi.push(`Sheet "${kq.ws.name}" dòng ${t.dong} ("${t.ten}"): ${kt.loi}`);
    else if (namKhoa) loi.push(`Sheet "${kq.ws.name}" dòng ${t.dong} ("${t.ten}"): năm ${namKhoa} đã khóa sổ — mở khóa trước khi nạp`);
    else hopLe.push({ ...x, gt: kt.gia_tri });
  }
  const tongNg = hopLe.reduce((s, x) => s + (x.t.giamKy ? 0 : x.t.nguyenGia), 0);
  const tongHm = hopLe.reduce((s, x) => s + (x.t.giamKy ? 0 : x.t.hm), 0);
  console.log(`\nSẵn sàng nạp ${hopLe.length} tài sản (đang quản lý: nguyên giá ${fmt(tongNg)}, hao mòn lũy kế ${fmt(tongHm)}); lỗi dữ liệu ${loi.length}.`);
  if (loi.length) { console.log('\n--- LỖI DỮ LIỆU (các dòng này KHÔNG được nạp) ---'); loi.slice(0, 30).forEach((l) => console.log('  • ' + l)); if (loi.length > 30) console.log(`  ... và ${loi.length - 30} lỗi nữa`); }
  if (canhBao.length) { console.log('\n--- CẢNH BÁO ---'); canhBao.slice(0, 40).forEach((l) => console.log('  • ' + l)); if (canhBao.length > 40) console.log(`  ... và ${canhBao.length - 40} cảnh báo nữa`); }
  const hienMau = chiTiet ? hopLe : hopLe.filter((_, i) => i < 5 || i % Math.ceil(hopLe.length / 6) === 0).slice(0, 12);
  console.log(`\n--- ${chiTiet ? 'TOÀN BỘ' : 'MẪU'} ---`);
  hienMau.forEach(({ t }) => console.log(`  ${(t.maCuoi || '(tự đánh mã)').padEnd(26)} ${t.ten.slice(0, 40).padEnd(40)} SL ${String(t.sl).padStart(3)}  NG ${fmt(t.nguyenGia).padStart(16)}  HM ${fmt(t.hm).padStart(16)}  ${t.soNam ? t.soNam + ' năm' : 'không HM tiếp'}${t.giamKy ? '  [GIẢM]' : ''}${t.tinhTrang === 'hong' ? '  [HỎNG]' : ''}`));

  if (dryRun) { console.log('\n(Dry-run: chưa ghi gì vào database.)'); return; }
  if (!hopLe.length) { console.log('\nKhông có gì để nạp.'); return; }

  // Sao lưu rồi ghi thật.
  const bak = require('../src/db').saoLuuDb();
  console.log(`\nĐã sao lưu database: ${bak} (${(require('fs').statSync(bak).size / 1048576).toFixed(1)} MB)`);

  const tx = db.transaction(() => {
    let n = 0;
    for (const { t, kq, gt } of hopLe) {
      const id = themTaiSan(kq.loai, gt, `Nạp từ ${kq.nhan} (${kq.dd === 'skt03' ? 'file Word' : `sheet "${kq.ws.name}"`}, dòng ${t.dong})`);
      if (t.soLieuGoc) db.prepare('UPDATE tai_san SET so_lieu_goc = ? WHERE id = ?').run(JSON.stringify(t.soLieuGoc), id);
      if (t.giamKy) {
        const ngay = t.ngayGiam || kq.ngayChot;
        const lyDo = t.lyDoGiam || `Giảm theo ${kq.nhan} (chưa rõ ngày/lý do)`;
        db.prepare("UPDATE tai_san SET tinh_trang = 'da_giam', ngay_giam = ?, ly_do_giam = ? WHERE id = ?").run(ngay, lyDo, id);
        ghiLichSu(id, ngay, 'Ghi giảm', lyDo);
      } else if (t.tinhTrang === 'hong') {
        db.prepare("UPDATE tai_san SET tinh_trang = 'hong' WHERE id = ?").run(id);
        ghiLichSu(id, kq.ngayChot, 'Đổi tình trạng', `Đang sử dụng → Hỏng (theo ${kq.nhan})`);
      }
      n++;
    }
    return n;
  });
  const n = tx();
  console.log(`Đã nạp ${n} tài sản.`);
  for (const k of new Set(hopLe.map((x) => `${x.kq.loai}|${x.kq.truong}`))) {
    const [loai, truong] = k.split('|');
    const tong = db.prepare('SELECT COUNT(*) c FROM tai_san WHERE loai = ? AND truong = ?').get(loai, truong).c;
    console.log(`  Tổng ${loai === 'TSCD' ? 'TSCĐ' : 'CCDC'} của "${truong}" trong database: ${tong}.`);
  }
}

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return Math.round(n).toLocaleString('vi-VN');
}

chay().catch((e) => { console.error('Lỗi:', e); process.exit(1); });
