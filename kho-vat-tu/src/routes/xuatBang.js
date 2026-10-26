// Xuất Excel (theo khung mẫu sổ của trường) cho các màn hình danh sách còn lại: tồn kho, danh sách phiếu nhập/xuất.
const express = require('express');
const { db, tonKhoTatCa, layCauHinh } = require('../db');
const { headerTaiFile } = require('../services/tenFile');
const { soSanhSoPhieuGiam } = require('../services/soPhieu');
const M = require('../services/mauSo');
const { chuoiTim, homNayISO, soSanhVi } = require('../services/tienIch');

const router = express.Router();
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const homNay = homNayISO;
const tangDan = (a, b) => -soSanhSoPhieuGiam(a, b);

// Bộ lọc giống trên màn hình, để file Excel đúng như danh sách đang xem.
// Trả về danh sách đã lọc + mô tả bộ lọc (in thêm 1 dòng dưới tiêu đề).
const TK_LOC = {
  am: ['Âm kho', (r) => r.ton_kho < 0],
  het: ['Hết hàng', (r) => r.ton_kho === 0],
  con: ['Còn hàng', (r) => r.ton_kho > 0],
  dau_ky: ['Có tồn đầu kỳ', (r) => r.ton_dau_ky > 0],
};
function locTonKho(rows, q) {
  const loc = TK_LOC[q.loc];
  const tim = chuoiTim(q.q);
  return {
    ds: rows.filter((r) => (!loc || loc[1](r)) && (!tim || chuoiTim(`${r.ten_hang} ${r.ma_so || ''}`).includes(tim))),
    moTa: [loc && `Lọc: ${loc[0]}`, tim && `Tìm: "${String(q.q).trim()}"`].filter(Boolean),
  };
}
function locPhieu(rows, loai, q) {
  const thang = /^\d{4}-\d{2}$/.test(q.thang || '') ? q.thang : '';
  const nguon = ['661.2', '337'].includes(q.nguon) ? q.nguon : '';
  const tim = chuoiTim(q.q);
  const noiDung = (r) => (loai === 'nhap' ? r.nha_cung_cap || r.ly_do_nhap : r.ly_do_xuat);
  const ds = rows.filter((r) => (!thang || String(r.ngay || '').startsWith(thang))
    && (!nguon || (r.nguon_kinh_phi || '661.2') === nguon)
    && (!tim || chuoiTim([r.so_phieu, loai === 'nhap' ? r.nguoi_nhap : r.nguoi_nhan, r.don_vi, noiDung(r)].join(' ')).includes(tim)));
  const moTa = [
    thang && `Tháng ${Number(thang.slice(5))}/${thang.slice(0, 4)}`,
    nguon && `Nguồn kinh phí TK ${nguon}`,
    tim && `Tìm: "${String(q.q).trim()}"`,
  ].filter(Boolean);
  return { ds, moTa, thang };
}

async function gui(res, ten, buf) {
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', headerTaiFile(ten));
  res.send(Buffer.from(buf));
}

router.get('/ton-kho', async (req, res, next) => {
  try {
    const { ds: rows, moTa } = locTonKho(tonKhoTatCa(), req.query);
    const cot = [
      { ten: 'STT', chiSo: 'A', rong: 6, h: 'center' }, { ten: 'Tên vật tư, hàng hóa', chiSo: 'B', rong: 48 },
      { ten: 'Đơn vị tính', chiSo: 'C', rong: 10, h: 'center' }, { ten: 'Tồn đầu kỳ', chiSo: '1', rong: 11 },
      { ten: 'Tổng nhập', chiSo: '2', rong: 12 }, { ten: 'Tổng xuất', chiSo: '3', rong: 12 }, { ten: 'Tồn kho', chiSo: '4=1+2-3', rong: 12 },
    ];
    const buf = await M.xuatBang({
      tenSheet: 'Tồn kho', cot, cauHinh: layCauHinh(),
      tieuDe: 'BẢNG TỔNG HỢP NHẬP - XUẤT - TỒN VẬT TƯ',
      phuDe: [`Tính đến ngày ${M.ngayVN(homNay())}`, ...(moTa.length ? [moTa.join(' · ')] : [])],
      dong: rows.map((r, i) => [i + 1, r.ten_hang, r.dvt || '', r.ton_dau_ky, r.tong_nhap, r.tong_xuat, r.ton_kho]),
      tong: ['', `Cộng (${rows.length} vật tư)`, '', rows.reduce((s, r) => s + r.ton_dau_ky, 0), rows.reduce((s, r) => s + r.tong_nhap, 0), rows.reduce((s, r) => s + r.tong_xuat, 0), rows.reduce((s, r) => s + r.ton_kho, 0)],
    });
    await gui(res, `TonKho_${homNay()}.xlsx`, buf);
  } catch (err) { next(err); }
});

router.get('/phieu-nhap', async (req, res, next) => {
  try {
    const { ds: rows, moTa, thang } = locPhieu(db.prepare('SELECT pn.*, (SELECT COUNT(*) FROM phieu_nhap_items WHERE phieu_nhap_id = pn.id) AS so_dong FROM phieu_nhap pn').all().sort(tangDan), 'nhap', req.query);
    const cot = [
      { ten: 'STT', chiSo: 'A', rong: 5, h: 'center' }, { ten: 'Số phiếu', chiSo: 'B', rong: 10 },
      { ten: 'Ngày', chiSo: 'C', rong: 11, h: 'center' }, { ten: 'Nhà cung cấp', chiSo: 'D', rong: 30 },
      { ten: 'Người nhập', chiSo: 'E', rong: 18 }, { ten: 'Đơn vị', chiSo: 'F', rong: 20 },
      { ten: 'Lý do nhập', chiSo: 'G', rong: 30 }, { ten: 'Số dòng hàng', chiSo: '1', rong: 8 },
      { ten: 'Nguồn KP', chiSo: 'H', rong: 9, h: 'center' }, { ten: 'Tiền hàng', chiSo: '2', rong: 15 },
      { ten: 'Thuế GTGT', chiSo: '3', rong: 13 }, { ten: 'Tổng cộng', chiSo: '4=2+3', rong: 15 },
    ];
    const tong = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const buf = await M.xuatBang({
      tenSheet: 'Phiếu nhập', cot, cauHinh: layCauHinh(),
      tieuDe: 'BẢNG KÊ PHIẾU NHẬP KHO', phuDe: [...(moTa.length ? [moTa.join(' · ')] : []), `Ngày lập: ${M.ngayVN(homNay())}`],
      dong: rows.map((r, i) => [i + 1, r.so_phieu, M.ngayVN(r.ngay), r.nha_cung_cap, r.nguoi_nhap, r.don_vi, r.ly_do_nhap, r.so_dong,
        `TK ${r.nguon_kinh_phi || '661.2'}`, Math.round(r.tong_tien_hang || 0), Math.round(r.tien_thue || 0), Math.round(r.tong_cong || 0)]),
      tong: ['', '', '', `Cộng (${rows.length} phiếu)`, '', '', '', tong('so_dong'), '', Math.round(tong('tong_tien_hang')), Math.round(tong('tien_thue')), Math.round(tong('tong_cong'))],
    });
    await gui(res, `BangKePhieuNhap_${thang || homNay()}.xlsx`, buf);
  } catch (err) { next(err); }
});

router.get('/phieu-xuat', async (req, res, next) => {
  try {
    const { ds: rows, moTa, thang } = locPhieu(db.prepare('SELECT px.*, (SELECT COUNT(*) FROM phieu_xuat_items WHERE phieu_xuat_id = px.id) AS so_dong FROM phieu_xuat px').all().sort(tangDan), 'xuat', req.query);
    const cot = [
      { ten: 'STT', chiSo: 'A', rong: 5, h: 'center' }, { ten: 'Số phiếu', chiSo: 'B', rong: 10 },
      { ten: 'Ngày', chiSo: 'C', rong: 11, h: 'center' }, { ten: 'Người nhận', chiSo: 'D', rong: 22 },
      { ten: 'Đơn vị', chiSo: 'E', rong: 24 }, { ten: 'Lý do xuất', chiSo: 'F', rong: 34 },
      { ten: 'Số dòng hàng', chiSo: '1', rong: 8 }, { ten: 'Nguồn KP', chiSo: 'G', rong: 9, h: 'center' },
      { ten: 'Tổng cộng', chiSo: '2', rong: 16 },
    ];
    const buf = await M.xuatBang({
      tenSheet: 'Phiếu xuất', cot, cauHinh: layCauHinh(),
      tieuDe: 'BẢNG KÊ PHIẾU XUẤT KHO', phuDe: [...(moTa.length ? [moTa.join(' · ')] : []), `Ngày lập: ${M.ngayVN(homNay())}`],
      dong: rows.map((r, i) => [i + 1, r.so_phieu, M.ngayVN(r.ngay), r.nguoi_nhan, r.don_vi, r.ly_do_xuat, r.so_dong,
        `TK ${r.nguon_kinh_phi || '661.2'}`, Math.round(r.tong_cong || 0)]),
      tong: ['', '', '', `Cộng (${rows.length} phiếu)`, '', '', rows.reduce((s, r) => s + r.so_dong, 0), '', Math.round(rows.reduce((s, r) => s + (r.tong_cong || 0), 0))],
    });
    await gui(res, `BangKePhieuXuat_${thang || homNay()}.xlsx`, buf);
  } catch (err) { next(err); }
});

// Danh sách vật tư tồn âm (xuất nhiều hơn nhập) để đối chiếu và bổ sung tồn đầu kỳ.
// Sheet 1 "Tổng hợp": mỗi vật tư 1 dòng + cột trống cho kế toán điền tồn đầu kỳ xác nhận.
// Sheet 2 "Chi tiết phiếu": các phiếu nhập/xuất của từng vật tư theo ngày, kèm tồn chạy sau mỗi phiếu.
router.get('/ton-am', async (req, res, next) => {
  try {
    const ds = tonKhoTatCa().filter((r) => r.ton_kho < 0).sort((a, b) => soSanhVi(a.ten_hang, b.ten_hang));
    const layNhap = db.prepare(`SELECT 'Nhập' AS loai, pn.so_phieu, pn.ngay, i.sl_thuc_nhap AS sl, i.don_gia, i.thanh_tien,
      pn.nha_cung_cap AS doi_tac, pn.nguoi_nhap AS nguoi, pn.ly_do_nhap AS ly_do, pn.id AS pid
      FROM phieu_nhap_items i JOIN phieu_nhap pn ON pn.id = i.phieu_nhap_id WHERE i.vat_tu_id = ?`);
    const layXuat = db.prepare(`SELECT 'Xuất' AS loai, px.so_phieu, px.ngay, i.sl_thuc_xuat AS sl, i.don_gia, i.thanh_tien,
      px.don_vi AS doi_tac, px.nguoi_nhan AS nguoi, px.ly_do_xuat AS ly_do, px.id AS pid, i.phieu_nhap_item_id AS ghep
      FROM phieu_xuat_items i JOIN phieu_xuat px ON px.id = i.phieu_xuat_id WHERE i.vat_tu_id = ?`);
    const soTrung = new Set(db.prepare('SELECT so_phieu FROM phieu_xuat GROUP BY so_phieu HAVING COUNT(*) > 1').all().map((x) => x.so_phieu));
    const tenPhieu = (g) => `${g.so_phieu} ngày ${M.ngayVN(g.ngay)}${g.nguoi ? ` (${g.nguoi})` : ''}`;

    const vatTu = ds.map((v) => {
      const gd = [...layNhap.all(v.id), ...layXuat.all(v.id)]
        .sort((a, b) => String(a.ngay || '').localeCompare(String(b.ngay || '')) || (a.loai === 'Nhập' ? -1 : 1) || a.pid - b.pid);
      if (v.ton_dau_ky) gd.unshift({ loai: 'Đầu kỳ', so_phieu: '', ngay: v.ngay_dau_ky, sl: v.ton_dau_ky, don_gia: v.don_gia_dau_ky, thanh_tien: (v.don_gia_dau_ky || 0) * v.ton_dau_ky, nguoi: '', doi_tac: '', ly_do: 'Tồn đầu kỳ đã nạp' });
      let ton = 0;
      let amTu = null;
      gd.forEach((g) => { ton += g.loai === 'Xuất' ? -g.sl : g.sl; g.ton = ton; if (ton < 0 && !amTu) amTu = g; });
      const xuat = gd.filter((g) => g.loai === 'Xuất');
      const nhap = gd.filter((g) => g.loai === 'Nhập');
      const donGia = xuat.length ? xuat[0].don_gia : (nhap[0] ? nhap[0].don_gia : 0);
      // Nhóm A: chưa có phiếu nhập nào -> thiếu tồn đầu kỳ.
      // Nhóm B: đã có nhập nhưng vẫn âm -> tìm dòng xuất CHƯA GHÉP được với phiếu nhập có cùng số lượng với một dòng
      //         xuất khác đã ghép: nghi cùng một lượng hàng bị ghi ở 2 phiếu xuất (không nên bù tồn đầu kỳ).
      let nhomLoai;
      let nguyenNhan;
      xuat.forEach((g) => { g.nghiTrung = false; });
      if (!nhap.length) {
        nhomLoai = 'A';
        nguyenNhan = v.ton_dau_ky
          ? `Chưa có phiếu nhập; tồn đầu kỳ đã nạp ${v.ton_dau_ky} chưa đủ — thiếu thêm ${-v.ton_kho}`
          : 'Chưa có phiếu nhập nào — thiếu tồn đầu kỳ (hàng nhập trước kỳ dữ liệu)';
      } else {
        nhomLoai = 'B';
        // Chỉ "nghi ghi trùng" khi có 1 dòng xuất khác ĐÃ ghép cùng số lượng; còn lại chỉ là chưa ghép được.
        const nghi = [];
        const chuaGhep = [];
        xuat.filter((g) => !g.ghep).forEach((g) => {
          const ban = xuat.find((k) => k !== g && k.ghep && k.sl === g.sl);
          g.nghiTrung = Boolean(ban);
          if (ban) nghi.push(`${tenPhieu(g)} x${g.sl} trùng số lượng với ${tenPhieu(ban)}`);
          else chuaGhep.push(`${tenPhieu(g)} x${g.sl}`);
        });
        const coSoTrung = [...new Set(xuat.filter((g) => soTrung.has(g.so_phieu)).map((g) => g.so_phieu))];
        nguyenNhan = ([
          nghi.length ? `Nghi ghi trùng phiếu xuất: ${nghi.join('; ')}` : '',
          chuaGhep.length ? `Xuất chưa ghép được với phiếu nhập nào: ${chuaGhep.join('; ')}` : '',
        ].filter(Boolean).join('. ') || 'Xuất vượt số đã nhập')
          + (coSoTrung.length ? `. Số phiếu bị dùng cho 2 phiếu khác nhau: ${coSoTrung.join(', ')}` : '')
          + (nghi.length ? ' — kiểm tra chứng từ, KHÔNG bù tồn đầu kỳ nếu đúng là ghi trùng' : ' — kiểm tra chứng từ trước khi bù tồn đầu kỳ');
      }
      return { ...v, gd, xuat, donGia, canBu: -v.ton_kho, nguyenNhan, nhomLoai };
    }).sort((a, b) => a.nhomLoai.localeCompare(b.nhomLoai) || soSanhVi(a.ten_hang, b.ten_hang));

    const cauHinh = layCauHinh();
    const wb = M.taoSo();
    const daDung = new Set();

    // ---- Sheet 1: Tổng hợp ----
    const cot1 = [
      { ten: 'STT', chiSo: 'A', rong: 5, h: 'center' },
      { ten: 'Nhóm', chiSo: '', rong: 6, h: 'center' },
      { ten: 'Tên vật tư, hàng hóa', chiSo: 'B', rong: 36 },
      { ten: 'ĐVT', chiSo: 'C', rong: 7, h: 'center' },
      { ten: 'Đầu kỳ đã nạp', chiSo: '0', rong: 8 },
      { ten: 'Tổng nhập', chiSo: '1', rong: 9 },
      { ten: 'Tổng xuất', chiSo: '2', rong: 9 },
      { ten: 'Tồn hiện tại', chiSo: '3=0+1-2', rong: 9 },
      { ten: 'Số lượng', nhom: 'Đề xuất bổ sung tồn đầu kỳ', chiSo: '4=-3', rong: 9 },
      { ten: 'Đơn giá (theo phiếu xuất)', nhom: 'Đề xuất bổ sung tồn đầu kỳ', chiSo: '5', rong: 13 },
      { ten: 'Thành tiền', nhom: 'Đề xuất bổ sung tồn đầu kỳ', chiSo: '6=4x5', rong: 14 },
      { ten: 'Các phiếu xuất', chiSo: 'D', rong: 22 },
      { ten: 'Nguyên nhân dự đoán', chiSo: 'E', rong: 50 },
      { ten: 'Số lượng', nhom: 'Kế toán xác nhận tồn đầu kỳ', chiSo: '7', rong: 9 },
      { ten: 'Đơn giá', nhom: 'Kế toán xác nhận tồn đầu kỳ', chiSo: '8', rong: 12 },
      { ten: 'Ghi chú', chiSo: 'G', rong: 18 },
    ];
    const ws1 = M.themSheet(wb, 'Tổng hợp', daDung, cot1.length);
    const soA = vatTu.filter((v) => v.nhomLoai === 'A').length;
    let r = M.dauSo(ws1, {
      cauHinh,
      tieuDe: 'DANH SÁCH VẬT TƯ TỒN ÂM — ĐỐI CHIẾU TỒN ĐẦU KỲ',
      phuDe: [`Số liệu đến ngày ${M.ngayVN(homNay())} · ${vatTu.length} vật tư có số xuất lớn hơn số nhập: nhóm A ${soA} (thiếu tồn đầu kỳ), nhóm B ${vatTu.length - soA} (nghi ghi trùng phiếu xuất)`],
    });
    r = M.tieuDeBang(ws1, r, cot1);
    let tongTien = 0;
    let stt = 0;
    for (const nhomLoai of ['A', 'B']) {
      const ds2 = vatTu.filter((v) => v.nhomLoai === nhomLoai);
      if (!ds2.length) continue;
      M.dongTieuDeNhom(ws1, r++, nhomLoai === 'A'
        ? `NHÓM A — CHƯA CÓ PHIẾU NHẬP: đề xuất bổ sung tồn đầu kỳ (${ds2.length} vật tư)`
        : `NHÓM B — ĐÃ CÓ PHIẾU NHẬP NHƯNG VẪN ÂM: kiểm tra chứng từ trước (có thể ghi trùng phiếu xuất), chưa đề xuất bù tồn (${ds2.length} vật tư)`);
      for (const v of ds2) {
        const deXuat = nhomLoai === 'A';
        const tt = deXuat ? Math.round(v.canBu * (v.donGia || 0)) : null;
        if (deXuat) tongTien += tt;
        M.dongBang(ws1, r++, cot1, [
          ++stt, nhomLoai, v.ten_hang, v.dvt || '', v.ton_dau_ky || null, v.tong_nhap, v.tong_xuat, v.ton_kho,
          deXuat ? v.canBu : null, deXuat ? v.donGia || null : null, tt,
          [...new Set(v.xuat.map((x) => x.so_phieu))].join(', '), v.nguyenNhan, null, null, '',
        ]);
        ws1.getRow(r - 1).height = Math.max(18, Math.ceil(v.nguyenNhan.length / 48) * 13 + 4, Math.ceil(v.ten_hang.length / 34) * 13 + 4);
      }
    }
    M.dongBang(ws1, r++, cot1, ['', '', `Cộng đề xuất bổ sung (nhóm A, ${soA} vật tư)`, '', null, null, null, null, null, null, tongTien, '', '', null, null, ''], 'tong');
    M.chanSo(ws1, r, {
      cauHinh,
      ghiChu: [
        '- Nhóm A: cột 4–6 là số đề xuất bổ sung tồn đầu kỳ để tồn về 0; đơn giá lấy theo phiếu xuất đầu tiên của vật tư.',
        '- Nhóm B: mỗi vật tư có 1 dòng xuất chưa ghép được với phiếu nhập và trùng số lượng với 1 dòng xuất khác — nhiều khả năng cùng một lượng hàng bị ghi ở 2 phiếu xuất. Kiểm tra chứng từ gốc; nếu ghi trùng thì sửa/xóa dòng xuất đó thay vì bù tồn.',
        '- Kế toán đối chiếu sổ kho / thẻ kho rồi điền số tồn đầu kỳ xác nhận vào cột 7–8.',
        '- Sheet "Chi tiết phiếu": các phiếu nhập/xuất theo ngày, tồn chạy sau mỗi phiếu; dòng "nghi trùng" được đánh dấu.',
      ],
    });

    // ---- Sheet 2: Chi tiết phiếu ----
    const cot2 = [
      { ten: 'Loại', chiSo: 'A', rong: 7, h: 'center' },
      { ten: 'Số phiếu', chiSo: 'B', rong: 10 },
      { ten: 'Ngày', chiSo: 'C', rong: 11, h: 'center' },
      { ten: 'Số lượng', chiSo: '1', rong: 9 },
      { ten: 'Đơn giá', chiSo: '2', rong: 13 },
      { ten: 'Thành tiền', chiSo: '3', rong: 14 },
      { ten: 'Tồn sau phiếu', chiSo: '4', rong: 10 },
      { ten: 'Người nhận / người nhập', chiSo: 'D', rong: 20 },
      { ten: 'Đơn vị / nhà cung cấp', chiSo: 'E', rong: 24 },
      { ten: 'Lý do', chiSo: 'F', rong: 40 },
      { ten: 'Ghép với phiếu nhập', chiSo: 'G', rong: 22 },
    ];
    const ws2 = M.themSheet(wb, 'Chi tiết phiếu', daDung, cot2.length);
    r = M.dauSo(ws2, { cauHinh, tieuDe: 'CHI TIẾT PHIẾU NHẬP - XUẤT CỦA VẬT TƯ TỒN ÂM', phuDe: ['Sắp theo ngày; "Tồn sau phiếu" âm cho thấy phiếu làm tồn bắt đầu âm'] });
    r = M.tieuDeBang(ws2, r, cot2);
    vatTu.forEach((v, i) => {
      M.dongTieuDeNhom(ws2, r++, `${i + 1}. [Nhóm ${v.nhomLoai}] ${v.ten_hang} (${v.dvt || ''}) — ${v.ton_dau_ky ? `đầu kỳ ${v.ton_dau_ky}, ` : ''}nhập ${v.tong_nhap}, xuất ${v.tong_xuat}, tồn ${v.ton_kho}`);
      v.gd.forEach((g) => {
        const ghep = g.loai !== 'Xuất' ? '' : g.nghiTrung ? 'CHƯA GHÉP — nghi ghi trùng' : g.ghep ? 'Đã ghép' : 'Chưa ghép';
        M.dongBang(ws2, r++, cot2, [g.loai, g.so_phieu, M.ngayVN(g.ngay), g.sl, g.don_gia, Math.round(g.thanh_tien || 0), g.ton, g.nguoi || '', g.doi_tac || '', g.ly_do || '', ghep]);
        if (g.ton < 0) ws2.getCell(r - 1, 8).font = { name: M.FONT, size: 9, bold: true, color: { argb: 'FFB00020' } };
        if (g.nghiTrung) {
          for (let c = 2; c <= cot2.length + 1; c++) ws2.getCell(r - 1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDECEC' } };
          ws2.getCell(r - 1, cot2.length + 1).font = { name: M.FONT, size: 9, bold: true, color: { argb: 'FFB00020' } };
        }
      });
    });
    M.chanSo(ws2, r, { cauHinh });

    await gui(res, `VatTuTonAm_${homNay()}.xlsx`, await wb.xlsx.writeBuffer());
  } catch (err) { next(err); }
});

module.exports = router;
