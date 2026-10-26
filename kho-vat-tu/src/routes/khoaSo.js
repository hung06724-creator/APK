// Khóa sổ theo năm (xem services/khoaSo.js): xem tình trạng từng năm, khóa, mở khóa (bắt buộc lý do), nhật ký, Excel.
const express = require('express');
const { db, layCauHinh } = require('../db');
const { headerTaiFile } = require('../services/tenFile');
const { homNayISO } = require('../services/tienIch');
const M = require('../services/mauSo');

const router = express.Router();
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Số nghiệp vụ theo từng năm, để biết khóa năm nào thì những gì bị khóa theo.
// namThem: thêm 1 năm vào bảng (năm người dùng gõ để khóa, chưa có nghiệp vụ nào tự liệt kê).
function thongKeTheoNam(namThem) {
  const dem = (sql) => new Map(db.prepare(sql).all().map((r) => [Number(r.nam), r.so]));
  const pn = dem('SELECT substr(ngay, 1, 4) AS nam, COUNT(*) AS so FROM phieu_nhap WHERE ngay IS NOT NULL GROUP BY 1');
  const px = dem('SELECT substr(ngay, 1, 4) AS nam, COUNT(*) AS so FROM phieu_xuat WHERE ngay IS NOT NULL GROUP BY 1');
  const chuaGhep = dem(`SELECT substr(p.ngay, 1, 4) AS nam, COUNT(*) AS so FROM phieu_xuat_items i
    JOIN phieu_xuat p ON p.id = i.phieu_xuat_id WHERE i.phieu_nhap_item_id IS NULL AND p.ngay IS NOT NULL GROUP BY 1`);
  const tdk = dem('SELECT substr(ngay, 1, 4) AS nam, COUNT(*) AS so FROM ton_dau_ky GROUP BY 1');
  const tsTang = dem('SELECT substr(ngay_ghi_tang, 1, 4) AS nam, COUNT(*) AS so FROM tai_san WHERE ngay_ghi_tang IS NOT NULL GROUP BY 1');
  const tsGiam = dem("SELECT substr(ngay_giam, 1, 4) AS nam, COUNT(*) AS so FROM tai_san WHERE tinh_trang = 'da_giam' AND ngay_giam IS NOT NULL GROUP BY 1");
  const kk = dem('SELECT substr(ngay, 1, 4) AS nam, COUNT(*) AS so FROM kiem_ke GROUP BY 1');
  const khoa = new Map(db.prepare('SELECT * FROM khoa_so').all().map((r) => [r.nam, r]));
  const namNay = Number(homNayISO().slice(0, 4));
  // Năm hiện tại, năm trước và mọi năm đã có phiếu / tồn đầu kỳ / kiểm kê / đã khóa (tài sản có ngày từ rất xa nên không tự liệt kê).
  const cacNam = new Set([namNay, namNay - 1, ...pn.keys(), ...px.keys(), ...tdk.keys(), ...kk.keys(), ...khoa.keys()]);
  if (Number.isInteger(namThem)) cacNam.add(namThem);
  return [...cacNam].filter((n) => n >= 1990 && n <= 2100).sort((a, b) => b - a).map((nam) => ({
    nam,
    phieu_nhap: pn.get(nam) || 0,
    phieu_xuat: px.get(nam) || 0,
    dong_xuat_chua_ghep: chuaGhep.get(nam) || 0,
    ton_dau_ky: tdk.get(nam) || 0,
    ts_ghi_tang: tsTang.get(nam) || 0,
    ts_ghi_giam: tsGiam.get(nam) || 0,
    kiem_ke: kk.get(nam) || 0,
    khoa: khoa.get(nam) || null,
  }));
}
const lichSu = () => db.prepare('SELECT * FROM khoa_so_lich_su ORDER BY id DESC LIMIT 500').all();
const traVe = (res, namThem) => res.json({ nam: thongKeTheoNam(namThem), lich_su: lichSu() });

router.get('/', (req, res) => traVe(res, Number(req.query.them) || null));

// Khóa 1 năm: { nam, ghi_chu? }
router.post('/', (req, res) => {
  const b = req.body || {};
  const nam = Number(b.nam);
  if (!Number.isInteger(nam) || nam < 1990 || nam > 2100) return res.status(400).json({ error: 'Năm không hợp lệ' });
  if (db.prepare('SELECT 1 FROM khoa_so WHERE nam = ?').get(nam)) return res.status(409).json({ error: `Năm ${nam} đã khóa sổ từ trước` });
  const ghiChu = String(b.ghi_chu || '').trim() || null;
  db.transaction(() => {
    db.prepare('INSERT INTO khoa_so (nam, ghi_chu) VALUES (?, ?)').run(nam, ghiChu);
    db.prepare("INSERT INTO khoa_so_lich_su (nam, hanh_dong, noi_dung) VALUES (?, 'khoa', ?)").run(nam, ghiChu);
  })();
  traVe(res);
});

// Mở khóa 1 năm: { ly_do } (bắt buộc, ghi vào nhật ký).
router.post('/:nam/mo', (req, res) => {
  const nam = Number(req.params.nam);
  const lyDo = String((req.body || {}).ly_do || '').trim();
  if (!db.prepare('SELECT 1 FROM khoa_so WHERE nam = ?').get(nam)) return res.status(404).json({ error: `Năm ${nam} chưa khóa sổ` });
  if (lyDo.length < 5) return res.status(400).json({ error: 'Cần ghi rõ lý do mở khóa (ít nhất 5 ký tự)' });
  db.transaction(() => {
    db.prepare('DELETE FROM khoa_so WHERE nam = ?').run(nam);
    db.prepare("INSERT INTO khoa_so_lich_su (nam, hanh_dong, noi_dung) VALUES (?, 'mo', ?)").run(nam, lyDo);
  })();
  traVe(res);
});

// Excel (khung mẫu sổ của trường): sheet 1 tình trạng khóa sổ từng năm, sheet 2 nhật ký khóa / mở khóa.
const ngayGio = (v) => { const s = String(v || ''); return s.length >= 16 ? `${M.ngayVN(s.slice(0, 10))} ${s.slice(11, 16)}` : s; };
router.get('/xuat-excel', async (req, res, next) => {
  try {
    const cauHinh = layCauHinh();
    const ds = thongKeTheoNam();
    const ls = lichSu();
    const wb = M.taoSo();
    const daDung = new Set();
    const nhom = 'Số nghiệp vụ trong năm';
    const cot1 = [
      { ten: 'Năm', chiSo: 'A', rong: 8, h: 'center' }, { ten: 'Tình trạng', chiSo: 'B', rong: 12, h: 'center' },
      { ten: 'Khóa lúc', chiSo: 'C', rong: 17, h: 'center' }, { ten: 'Ghi chú khi khóa', chiSo: 'D', rong: 28 },
      { ten: 'Phiếu nhập', nhom, chiSo: '1', rong: 9 }, { ten: 'Phiếu xuất', nhom, chiSo: '2', rong: 9 },
      { ten: 'Dòng xuất chưa ghép', nhom, chiSo: '3', rong: 10 }, { ten: 'Tồn đầu kỳ', nhom, chiSo: '4', rong: 9 },
      { ten: 'Tài sản ghi tăng', nhom, chiSo: '5', rong: 10 }, { ten: 'Tài sản ghi giảm', nhom, chiSo: '6', rong: 10 },
      { ten: 'Đợt kiểm kê', nhom, chiSo: '7', rong: 9 },
    ];
    const ws1 = M.themSheet(wb, 'Tình trạng khóa sổ', daDung, cot1.length);
    const dangKhoa = ds.filter((d) => d.khoa).map((d) => d.nam);
    let r = M.dauSo(ws1, {
      cauHinh,
      tieuDe: 'SỔ THEO DÕI KHÓA SỔ KẾ TOÁN',
      phuDe: [dangKhoa.length ? `Các năm đang khóa sổ: ${dangKhoa.join(', ')}` : 'Chưa khóa sổ năm nào', `Ngày lập: ${M.ngayVN(homNayISO())}`],
    });
    r = M.tieuDeBang(ws1, r, cot1);
    ds.forEach((d) => M.dongBang(ws1, r++, cot1, [
      d.nam, d.khoa ? 'Đã khóa' : 'Đang mở', d.khoa ? ngayGio(d.khoa.khoa_luc) : '', d.khoa ? d.khoa.ghi_chu || '' : '',
      d.phieu_nhap, d.phieu_xuat, d.dong_xuat_chua_ghep, d.ton_dau_ky, d.ts_ghi_tang, d.ts_ghi_giam, d.kiem_ke,
    ]));
    M.chanSo(ws1, r, { cauHinh });

    const cot2 = [
      { ten: 'STT', chiSo: 'A', rong: 6, h: 'center' }, { ten: 'Thời gian', chiSo: 'B', rong: 17, h: 'center' },
      { ten: 'Năm', chiSo: 'C', rong: 8, h: 'center' }, { ten: 'Thao tác', chiSo: 'D', rong: 12, h: 'center' },
      { ten: 'Lý do mở khóa / ghi chú khi khóa', chiSo: 'E', rong: 60 },
    ];
    const ws2 = M.themSheet(wb, 'Nhật ký khóa sổ', daDung, cot2.length);
    r = M.dauSo(ws2, { cauHinh, tieuDe: 'NHẬT KÝ KHÓA SỔ / MỞ KHÓA SỔ', phuDe: [`Ngày lập: ${M.ngayVN(homNayISO())}`] });
    r = M.tieuDeBang(ws2, r, cot2);
    if (!ls.length) M.dongBang(ws2, r++, cot2, ['', '', '', '', 'Chưa có lần khóa / mở khóa nào']);
    [...ls].reverse().forEach((x, i) => M.dongBang(ws2, r++, cot2, [
      i + 1, ngayGio(x.luc), x.nam, x.hanh_dong === 'khoa' ? 'Khóa sổ' : 'Mở khóa', x.noi_dung || '',
    ]));
    M.chanSo(ws2, r, { cauHinh });

    const buf = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type', XLSX);
    res.setHeader('Content-Disposition', headerTaiFile(`KhoaSo_${homNayISO()}.xlsx`));
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

module.exports = router;
