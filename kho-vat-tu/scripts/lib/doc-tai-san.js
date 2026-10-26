// Hàm đọc ô Excel dùng chung + bộ đọc cho 2 định dạng sổ tài sản của các trường sáp nhập:
//  - Sổ TSCĐ mẫu S24-H (xuất từ QLTS.VN, TT 24/2024/TT-BTC): có nhóm "Loại tài sản: ...", tháng/năm đưa vào sử dụng,
//    tỷ lệ hao mòn, lũy kế hao mòn, ghi giảm.
//  - Bảng tổng hợp danh mục tài sản công: nguyên giá, số lượng, giá trị còn lại, năm mua / năm đưa vào sử dụng,
//    thời gian dự kiến sử dụng, tình trạng.
// Mỗi bộ đọc trả về { tai[], thongKe{boQua, doiChieu[]}, ngayChot, truongPhatHien, dongTieuDe, nhan, canhBao[] }.

// ---------- Tiện ích đọc ô ----------
function giaTriO(cell) {
  let v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('result' in v) v = v.result;
    else return null; // công thức không có kết quả đã tính
    if (v && typeof v === 'object') return v instanceof Date ? v.toISOString().slice(0, 10) : null;
  }
  return v === undefined ? null : v;
}
function chuoiO(v) {
  return v === null || v === undefined ? '' : String(v).replace(/\s+/g, ' ').trim();
}
function soO(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().replace(/\s/g, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d+([.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return null;
}
function chuanChu(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}
const lam2 = (n) => Math.round(n * 100) / 100;

// Tỷ lệ hao mòn/năm -> số năm sử dụng. Làm tròn về số nguyên khi tỷ lệ đã bị làm tròn (0.067 ≈ 1/15, 0.143 ≈ 1/7).
function tuTyLe(r) {
  if (!(r > 0) || r > 2) return null;
  const n = Math.round(1 / r);
  if (n >= 1 && Math.abs(r - 1 / n) / (1 / n) < 0.012) return n;
  const s = lam2(1 / r);
  return s >= 0.5 && s <= 100 ? s : null;
}

function docDong(ws, r) {
  const o = [];
  ws.getRow(r).eachCell({ includeEmpty: false }, (c, i) => o.push({ i, t: chuoiO(giaTriO(c)), n: chuanChu(chuoiO(giaTriO(c))) }));
  return o;
}
function cotDauTien(dong, re) {
  const x = dong.find((c) => re.test(c.n));
  return x ? x.i : null;
}
function cacCot(dong, re) {
  return dong.filter((c) => re.test(c.n)).map((c) => c.i);
}
function thangNam(v) {
  const s = chuoiO(v);
  let m = /(\d{1,2})\s*[/.-]\s*((?:19|20)\d{2})/.exec(s);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, '0')}-01`;
  m = /^((?:19|20)\d{2})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /((?:19|20)\d{2})/.exec(s);
  return m ? `${m[1]}-01-01` : null;
}
function ngayTuChu(s) {
  const m = /(\d{1,2})\/(\d{1,2})\/((?:19|20)\d{2})/.exec(String(s || ''));
  return m ? `${m[3]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}` : null;
}
const fmtNgay = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

// ---------- Sổ S24-H ----------
function timTieuDeS24H(ws) {
  for (let r = 1; r <= Math.min(60, ws.rowCount); r++) {
    const d = docDong(ws, r);
    if (d.some((c) => /^ten, dac diem, ky hieu tscd/.test(c.n)) && d.some((c) => /^thang, nam dua vao su dung/.test(c.n))) return r;
  }
  return null;
}

function docS24H(ws) {
  const canhBao = [];
  const r0 = timTieuDeS24H(ws);
  const h = docDong(ws, r0);
  const h2 = docDong(ws, r0 + 1);
  const cot = {
    ten: cotDauTien(h, /^ten, dac diem, ky hieu tscd/),
    sx: cotDauTien(h, /^nuoc san xuat/),
    tn: cotDauTien(h, /^thang, nam dua vao su dung/),
    soHieu: cotDauTien(h, /^so hieu tscd/),
    the: cotDauTien(h, /^the tscd/),
    ng: cotDauTien(h, /^nguyen gia tscd/),
    luyKe: cotDauTien(h, /^luy ke/),
    lyDo: cotDauTien(h, /^ly do ghi giam/),
    conLai: cotDauTien(h, /^gia tri con lai/),
  };
  const tyLe = cacCot(h2, /^ty le %/); // [khấu hao, hao mòn]
  const ngayCt = cacCot(h2, /^ngay, thang/); // [ngày chứng từ ghi tăng, ngày chứng từ ghi giảm]
  const soHieuCt = cacCot(h2, /^so hieu/);
  cot.tyLeKh = tyLe[0] || null; cot.tyLeHm = tyLe[1] || null;
  cot.ngayGiam = ngayCt[1] || null; cot.soHieuGiam = soHieuCt[1] || null;
  if (!cot.ten || !cot.ng) { canhBao.push('Không nhận được cột Tên TSCĐ / Nguyên giá trong sổ S24-H'); return { tai: [], thongKe: { boQua: 0, doiChieu: [] }, canhBao }; }

  let truong = null;
  let ngayChot = null;
  for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
    for (const c of docDong(ws, r)) {
      if (!truong && /^don vi:/.test(c.n)) truong = c.t.replace(/^[^:]*:\s*/, '').trim();
      if (!ngayChot && /^ngay \d/.test(c.n)) ngayChot = ngayTuChu(c.t);
    }
  }

  // Sổ QLTS in giữa năm: lũy kế hao mòn tính đến hết tháng in sổ (vd in 20/09/2026 -> lũy kế đến hết 30/09/2026).
  const chotHm = ngayChot ? (() => { const [y, m] = ngayChot.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); })() : null;
  const tai = [];
  const thongKe = { boQua: 0, doiChieu: [] };
  let nhom = '';
  let phan = null;
  const daThay = new Map();
  const dongPhan = () => { phan = { nhom: null, la: [] }; thongKe.doiChieu.push(phan); };
  const lay = (r, c) => (c ? giaTriO(ws.getCell(r, c)) : null);
  const so = (r, c) => soO(lay(r, c));

  for (let r = r0 + 2; r <= ws.rowCount; r++) {
    const c1 = chuoiO(lay(r, 1));
    const c1n = chuanChu(c1);
    if (/^loai tai san/.test(c1n)) {
      nhom = c1.replace(/^[^:]*:\s*/, '').trim();
      dongPhan();
      phan.nhom = { dong: r, ten: nhom, cuoi: so(r, cot.ng), hmCuoi: so(r, cot.luyKe) };
      continue;
    }
    if (!/^\d+$/.test(c1)) continue; // dòng tiêu đề lặp lại ở mỗi trang, chân trang...
    const ten = chuoiO(lay(r, cot.ten));
    const ng = so(r, cot.ng);
    if (!ten) { thongKe.boQua++; continue; }
    if (!(ng > 0)) { thongKe.boQua++; canhBao.push(`Dòng ${r} ("${ten}"): không có nguyên giá — bỏ qua`); continue; }
    const luyKe = Math.min(Math.max(so(r, cot.luyKe) || 0, 0), ng);
    const ty = so(r, cot.tyLeHm) || so(r, cot.tyLeKh);
    const soNam = tuTyLe(ty);
    const ngay = thangNam(lay(r, cot.tn));
    const ngayGiamRaw = chuoiO(lay(r, cot.ngayGiam));
    const lyDo = chuoiO(lay(r, cot.lyDo));
    const giamKy = Boolean(ngayGiamRaw || lyDo);
    const maRaw = chuoiO(lay(r, cot.soHieu)) || chuoiO(lay(r, cot.the));
    const khoaTrung = maRaw ? `${maRaw}|${ten}|${ng}|${luyKe}|${ngay}` : null;
    if (khoaTrung && daThay.has(khoaTrung)) {
      thongKe.boQua++;
      canhBao.push(`Dòng ${r} ("${ten}", mã ${maRaw}, nguyên giá ${Math.round(ng).toLocaleString('vi-VN')}): trùng hoàn toàn dòng ${daThay.get(khoaTrung)} (cùng mã, tên, nguyên giá, hao mòn) — bỏ qua dòng này, có thể bị nhập đôi trong sổ`);
      continue;
    }
    if (khoaTrung) daThay.set(khoaTrung, r);
    const sx = chuoiO(lay(r, cot.sx));
    const ghi = [`Nạp từ sổ TSCĐ mẫu S24-H${ngayChot ? ' ngày ' + fmtNgay(ngayChot) : ''} (dòng ${r})`];
    if (sx) ghi.push(`nước sản xuất: ${sx}`);
    if (!ngay) ghi.push('chưa rõ tháng/năm đưa vào sử dụng');
    else if (ngay.endsWith('-01-01') && !/\//.test(chuoiO(lay(r, cot.tn)))) ghi.push('ngày ghi tăng chỉ biết theo năm');
    if (soNam === null && luyKe < ng) ghi.push('chưa xác định được thời gian sử dụng');
    tai.push({
      dong: r, ten, nhom, sl: 1, nguyenGia: lam2(ng), hm: lam2(luyKe), soNam, ngayTang: ngay, ngaySuDung: ngay,
      ma: maRaw || null, maTuFile: Boolean(maRaw), giamKy, ngayGiam: ngayTuChu(ngayGiamRaw) || null, lyDoGiam: lyDo || null,
      // Đưa vào sử dụng sau ngày chốt và chưa có lũy kế: tính hao mòn từ ngày sử dụng, không dùng số dư chốt.
      khongChot: Boolean(ngay && chotHm && ngay > chotHm && !(luyKe > 0)),
      ghiChu: ghi.join('; ') + '.',
    });
    if (!phan) dongPhan();
    phan.la.push({ dong: r, cuoi: giamKy ? 0 : lam2(ng), hmCuoi: giamKy ? 0 : lam2(luyKe) });
  }
  thongKe.doiChieu = thongKe.doiChieu
    .filter((p) => p.nhom)
    .map((p) => ({
      ten: p.nhom.ten, dong: p.nhom.dong, soTs: p.la.length,
      sheetNguyenGia: p.nhom.cuoi, tongNguyenGia: p.la.reduce((s, x) => s + x.cuoi, 0),
      sheetHm: p.nhom.hmCuoi === null ? 0 : p.nhom.hmCuoi, tongHm: p.la.reduce((s, x) => s + x.hmCuoi, 0),
    }));
  if (chotHm && chotHm !== ngayChot) canhBao.push(`Sổ in ngày ${fmtNgay(ngayChot)}: lũy kế hao mòn được hiểu là số đến hết ${fmtNgay(chotHm)}. Dùng --ngay-chot=YYYY-MM-DD nếu khác.`);
  return {
    tai, thongKe, ngayChot: chotHm, truongPhatHien: truong, dongTieuDe: r0, canhBao,
    nhan: `sổ TSCĐ mẫu S24-H${ngayChot ? ' ngày ' + fmtNgay(ngayChot) : ''}`,
  };
}

// ---------- Bảng tổng hợp danh mục tài sản ----------
function timTieuDeTongHop(ws) {
  for (let r = 1; r <= Math.min(30, ws.rowCount); r++) {
    const d = docDong(ws, r);
    if (d.some((c) => /^ten, dac diem, ky hieu tscd/.test(c.n)) && d.some((c) => /^nguyen gia/.test(c.n))
      && d.some((c) => /^gia tri con lai/.test(c.n)) && d.some((c) => /^nam dua vao su dung/.test(c.n))) return r;
  }
  return null;
}

function docTongHop(ws) {
  const canhBao = [];
  const r0 = timTieuDeTongHop(ws);
  const h = docDong(ws, r0);
  const cot = {
    stt: cotDauTien(h, /^stt/) || 1,
    ten: cotDauTien(h, /^ten, dac diem, ky hieu tscd/),
    soHieu: cotDauTien(h, /^so hieu tscd/),
    dvt: cotDauTien(h, /^don vi tinh/),
    ng: cotDauTien(h, /^nguyen gia/),
    sl: cotDauTien(h, /^so luong/),
    conLai: cotDauTien(h, /^gia tri con lai/),
    namMua: cotDauTien(h, /^nam mua/),
    namSd: cotDauTien(h, /^nam dua vao su dung/),
    tg: cotDauTien(h, /^thoi gian du kien su dung/),
    tt: cotDauTien(h, /^tinh trang/),
    mc: cotDauTien(h, /^ho so minh chung/),
  };
  let truong = null;
  for (let r = 1; r < r0 && !truong; r++) {
    for (const c of docDong(ws, r)) { if (/^truong /.test(c.n)) { truong = c.t.replace(/\s+thành phố\s+.*$/i, '').trim(); break; } }
  }
  const tai = [];
  const thongKe = { boQua: 0, doiChieu: [] };
  let nhom = '';
  const daThay = new Map();
  const lay = (r, c) => (c ? giaTriO(ws.getCell(r, c)) : null);
  const so = (r, c) => soO(lay(r, c));

  for (let r = r0 + 1; r <= ws.rowCount; r++) {
    const c1 = chuoiO(lay(r, cot.stt));
    const ten = chuoiO(lay(r, cot.ten));
    if (/^[A-Z]$/.test(c1) && ten) { nhom = ten; continue; }
    if (!/^\d+$/.test(c1)) continue;
    const ng = so(r, cot.ng);
    if (!ten) { thongKe.boQua++; continue; }
    if (!(ng > 0)) { thongKe.boQua++; canhBao.push(`Dòng ${r} ("${ten}"): không có nguyên giá — bỏ qua`); continue; }
    const sl = Math.max(1, Math.round(so(r, cot.sl) || 1));
    const conLai = Math.min(Math.max(so(r, cot.conLai) || 0, 0), ng); // để trống = đã hết giá trị
    const hm = lam2(ng - conLai);
    const tg = so(r, cot.tg);
    const soNam = tg > 0 ? tg : null;
    const namMua = thangNam(lay(r, cot.namMua));
    const namSd = thangNam(lay(r, cot.namSd));
    const ngayTang = namMua || namSd;
    const maRaw = chuoiO(lay(r, cot.soHieu));
    const khoaTrung = maRaw ? `${maRaw}|${ten}|${ng}|${conLai}` : null;
    if (khoaTrung && daThay.has(khoaTrung)) {
      thongKe.boQua++;
      canhBao.push(`Dòng ${r} ("${ten}", mã ${maRaw}): trùng hoàn toàn dòng ${daThay.get(khoaTrung)} (cùng mã, tên, nguyên giá, giá trị còn lại) — bỏ qua dòng này, có thể bị nhập đôi trong sổ`);
      continue;
    }
    if (khoaTrung) daThay.set(khoaTrung, r);
    const tt = chuoiO(lay(r, cot.tt));
    const mc = chuoiO(lay(r, cot.mc));
    const ghi = [`Nạp từ bảng tổng hợp danh mục tài sản (dòng ${r}); năm mua/đưa vào sử dụng chỉ biết theo năm`];
    let tinhTrang = null;
    let viTri = null;
    if (/hu hong|hong/.test(chuanChu(tt))) { tinhTrang = 'hong'; ghi.push(`tình trạng: ${tt}`); }
    else if (tt) ghi.push(`ghi chú: ${tt}`);
    if (mc) {
      if (/^hong/.test(chuanChu(mc))) { tinhTrang = 'hong'; ghi.push(`ghi chú: ${mc}`); }
      else if (/giao truong|^\d/.test(chuanChu(mc))) ghi.push(`ghi chú: ${/^\d{4}-\d{2}-\d{2}$/.test(mc) ? fmtNgay(mc) : mc}`);
      else viTri = mc;
    }
    if (soNam === null && conLai > 0) ghi.push('chưa xác định được thời gian sử dụng');
    tai.push({
      dong: r, ten, nhom, sl, nguyenGia: lam2(ng), hm, soNam, ngayTang, ngaySuDung: namSd || ngayTang,
      ma: maRaw || null, maTuFile: Boolean(maRaw), giamKy: false, tinhTrang, viTri, dvt: chuoiO(lay(r, cot.dvt)) || null,
      ghiChu: ghi.join('; ') + '.',
    });
  }
  return { tai, thongKe, ngayChot: null, truongPhatHien: truong, dongTieuDe: r0, canhBao, nhan: 'bảng tổng hợp danh mục tài sản' };
}

// ---------- Sổ theo dõi CCDC tại nơi sử dụng (mẫu SKT03, file Word xuất từ QLTS.VN) ----------
// Bảng 15 cột: A ngày ghi sổ | B,C chứng từ ghi tăng | D tên | H mã | ĐVT | SL | đơn giá | thành tiền |
// E,F chứng từ ghi giảm | G lý do | SL giảm | thành tiền giảm | ghi chú. Nhóm: dòng "Loại công cụ dụng cụ: ...".
async function docSkt03Docx(duongDan) {
  const fs = require('fs');
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(fs.readFileSync(duongDan));
  const tep = zip.file('word/document.xml');
  if (!tep) throw new Error('File Word không có nội dung (thiếu word/document.xml)');
  const xml = await tep.async('string');
  const giaiMa = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const chu = (s) => giaiMa((s.match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')).replace(/\s+/g, ' ').trim();
  const dong = [];
  for (const bang of xml.split('<w:tbl>').slice(1)) {
    for (const tr of bang.split('</w:tr>')) {
      if (!tr.includes('<w:tc')) continue;
      dong.push(tr.split('</w:tc>').filter((c) => c.includes('<w:tc')).map(chu));
    }
  }
  const canhBao = [];
  let truong = null; let tuNgay = null; let denNgay = null;
  for (const o of dong.slice(0, 15).flat()) {
    if (!truong && /^truong /.test(chuanChu(o))) truong = o;
    const m = /từ ngày (\d{1,2}\/\d{1,2}\/\d{4}) đến ngày (\d{1,2}\/\d{1,2}\/\d{4})/i.exec(o);
    if (m && !tuNgay) { tuNgay = ngayTuChu(m[1]); denNgay = ngayTuChu(m[2]); }
  }
  const tai = [];
  const thongKe = { boQua: 0, doiChieu: [] };
  const daThay = new Map();
  let nhom = '';
  let tongSo = null;
  dong.forEach((c, i) => {
    const r = i + 1;
    const dau = chuanChu(c[0] || '');
    if (/^loai cong cu dung cu/.test(dau)) { nhom = c[0].replace(/^[^:]*:\s*/, '').trim(); return; }
    if (/^tong cong/.test(dau)) { tongSo = { dong: r, sl: soO(c[1]), tien: soO(c.slice(2).find((x) => soO(x) !== null)) }; return; }
    if (c.length < 15) return;
    const ten = c[3];
    const sl = soO(c[6]);
    if (!ten || sl === null || ['d', 'ten ccdc'].includes(chuanChu(ten))) return;
    const donGia = soO(c[7]) || 0;
    const thanhTien = soO(c[8]) ?? sl * donGia;
    if (Math.abs(sl * donGia - thanhTien) > 1) canhBao.push(`Dòng bảng ${r} ("${ten}"): số lượng × đơn giá (${Math.round(sl * donGia).toLocaleString('vi-VN')}) ≠ thành tiền (${Math.round(thanhTien).toLocaleString('vi-VN')}) — lấy theo thành tiền`);
    const ma = c[4] || null;
    const khoa = ma ? `${ma}|${ten}|${sl}|${donGia}` : null;
    if (khoa && daThay.has(khoa)) { thongKe.boQua++; canhBao.push(`Dòng bảng ${r} ("${ten}", mã ${ma}): trùng hoàn toàn dòng ${daThay.get(khoa)} — bỏ qua`); return; }
    if (khoa) daThay.set(khoa, r);
    const ngayTang = ngayTuChu(c[2]) || ngayTuChu(c[0]);
    const lyDo = c[11]; const ngayGiam = ngayTuChu(c[10]); const slGiam = soO(c[12]);
    const ghi = [`Nạp từ sổ theo dõi CCDC (SKT03)${tuNgay ? ` ${fmtNgay(tuNgay)}–${fmtNgay(denNgay)}` : ''} (dòng bảng ${r})`];
    if (!ngayTang) ghi.push('chưa rõ ngày ghi tăng (số dư tại ngày mở sổ)');
    let tinhTrang = null; let viTri = null;
    const gc = c[14] || '';
    if (gc) {
      if (/^hong|hu hong/.test(chuanChu(gc))) { tinhTrang = 'hong'; ghi.push(`ghi chú: ${gc}`); }
      else if (/giao truong|ban giao|\d{1,2}\/\d{1,2}/.test(chuanChu(gc))) ghi.push(`ghi chú: ${gc}`);
      else viTri = gc;
    }
    let giamKy = false; let soLuong = sl;
    if (lyDo || ngayGiam || slGiam) {
      if (!slGiam || slGiam >= sl) giamKy = true;
      else { soLuong = sl - slGiam; ghi.push(`đã giảm ${slGiam}/${sl} ${c[5] || ''} (${lyDo || 'chưa rõ lý do'})`); }
    }
    tai.push({
      dong: r, ten, nhom, sl: soLuong, donGia: lam2(thanhTien / sl), nguyenGia: lam2((thanhTien / sl) * soLuong), hm: 0, soNam: null,
      ngayTang: ngayTang || tuNgay, ngaySuDung: ngayTang || tuNgay, ma, maTuFile: Boolean(ma), giamKy, ngayGiam, lyDoGiam: lyDo || null,
      tinhTrang, viTri, dvt: c[5] || null, soChungTu: c[1] || null, ghiChu: ghi.join('; ') + '.',
    });
  });
  if (tongSo) {
    thongKe.doiChieu.push({
      ten: `Tổng cộng (số lượng sổ ${tongSo.sl ?? '?'} / cộng lại ${lam2(tai.reduce((s, t) => s + t.sl, 0))})`, dong: tongSo.dong, soTs: tai.length,
      sheetNguyenGia: tongSo.tien, tongNguyenGia: tai.reduce((s, t) => s + (t.giamKy ? 0 : t.nguyenGia), 0), sheetHm: null, tongHm: 0,
    });
  }
  return {
    tai, thongKe, ngayChot: denNgay, truongPhatHien: truong, dongTieuDe: 10, canhBao, tuNgay, denNgay,
    nhan: `sổ theo dõi CCDC (SKT03)${tuNgay ? ` ${fmtNgay(tuNgay)}–${fmtNgay(denNgay)}` : ''}`,
  };
}

module.exports = {
  giaTriO, chuoiO, soO, chuanChu, lam2, tuTyLe, fmtNgay,
  timTieuDeS24H, docS24H, timTieuDeTongHop, docTongHop, docSkt03Docx,
};
