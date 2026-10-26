// Biên bản kiểm kê tài sản (Excel), theo khung mẫu sổ của trường (mauSo.js):
// đầu biên bản -> thời điểm kiểm kê, ban kiểm kê -> bảng "Theo sổ kế toán | Theo kiểm kê | Chênh lệch" (nhóm có cộng)
// -> tổng hợp kết quả, ý kiến giải quyết chênh lệch -> ký: Trưởng ban kiểm kê, Kế toán trưởng, Thủ trưởng đơn vị.
// Mỗi trường 1 sheet (tài sản tiếp nhận từ trường sáp nhập in thêm dòng "Tài sản tiếp nhận từ ...").
const M = require('./mauSo');

const TEN_LOAI = { TSCD: 'TÀI SẢN CỐ ĐỊNH', CCDC: 'CÔNG CỤ, DỤNG CỤ', TAT_CA: 'TÀI SẢN' };

function giaTriKiemKe(d) {
  if (!d.ket_qua) return null;
  const slTT = d.ket_qua === 'khong_thay' ? 0 : (d.so_luong_thuc_te ?? d.so_luong);
  const tyLe = d.so_luong ? slTT / d.so_luong : 0;
  return {
    sl: slTT,
    ng: Math.round((d.nguyen_gia || 0) * tyLe),
    cl: d.gia_tri_con_lai === null || d.gia_tri_con_lai === undefined ? null : Math.round(d.gia_tri_con_lai * tyLe),
  };
}

async function xuatBienBanKiemKe({ dot, dong, cauHinh }) {
  const wb = M.taoSo();
  const daDung = new Set();
  const cot = [
    { ten: 'STT', chiSo: 'A', rong: 5, h: 'center' },
    { ten: 'Tên tài sản', chiSo: 'B', rong: 34 },
    { ten: 'Mã tài sản', chiSo: 'C', rong: 15 },
    { ten: 'Nơi sử dụng', chiSo: 'D', rong: 18 },
    { ten: 'Số lượng', nhom: 'Theo sổ kế toán', chiSo: '1', rong: 7 },
    { ten: 'Nguyên giá', nhom: 'Theo sổ kế toán', chiSo: '2', rong: 14 },
    { ten: 'Giá trị còn lại', nhom: 'Theo sổ kế toán', chiSo: '3', rong: 14 },
    { ten: 'Số lượng', nhom: 'Theo kiểm kê', chiSo: '4', rong: 7 },
    { ten: 'Nguyên giá', nhom: 'Theo kiểm kê', chiSo: '5', rong: 14 },
    { ten: 'Giá trị còn lại', nhom: 'Theo kiểm kê', chiSo: '6', rong: 14 },
    { ten: 'Số lượng', nhom: 'Chênh lệch', chiSo: '7=4-1', rong: 7 },
    { ten: 'Nguyên giá', nhom: 'Chênh lệch', chiSo: '8=5-2', rong: 14 },
    { ten: 'Giá trị còn lại', nhom: 'Chênh lệch', chiSo: '9=6-3', rong: 14 },
    { ten: 'Ghi chú', chiSo: 'E', rong: 20 },
  ];
  const ban = String(dot.ban_kiem_ke || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const truongBan = ban.length ? ban[0].split(/\s+-\s+/)[0] : '';
  const [y, m, d] = String(dot.ngay).split('-');
  const phamVi = [dot.truong && `trường ${dot.truong}`, dot.bo_phan && `bộ phận ${dot.bo_phan}`, dot.nhom && `nhóm ${dot.nhom}`].filter(Boolean).join(', ');

  const theoTruong = new Map();
  dong.forEach((x) => { if (!theoTruong.has(x.truong)) theoTruong.set(x.truong, []); theoTruong.get(x.truong).push(x); });

  for (const [truong, ds] of theoTruong) {
    const ws = M.themSheet(wb, truong || 'Tài sản', daDung, cot.length);
    let r = M.dauSo(ws, {
      cauHinh,
      truongGoc: truong && truong !== cauHinh.truong_goc ? truong : null,
      tieuDe: `BIÊN BẢN KIỂM KÊ ${TEN_LOAI[dot.loai] || 'TÀI SẢN'}`,
      phuDe: [`Thời điểm kiểm kê: ngày ${d} tháng ${m} năm ${y}`, `${dot.ten}${phamVi ? ` (phạm vi: ${phamVi})` : ''}`],
    });
    const dongChu = (chu, kieu = {}) => { M.o(ws, r, 2, chu, { size: 10, ...kieu }); M.gop(ws, r, 2, r, cot.length + 1); r++; };
    dongChu('Ban kiểm kê gồm:', { bold: true });
    if (ban.length) ban.forEach((b, i) => dongChu(`${i + 1}. ${b.split(/\s+-\s+/).join(' — ')}${i === 0 && !/trưởng ban/i.test(b) ? ' — Trưởng ban' : ''}`));
    else dongChu('....................................................................................................');
    dongChu('Đã kiểm kê tài sản, kết quả như sau:', { bold: true });
    r++;
    r = M.tieuDeBang(ws, r, cot);

    // Nhóm theo loại + nhóm tài sản, có dòng cộng nhóm; dòng tổng ở trên cùng (như sổ mẫu).
    const nhomMap = new Map();
    ds.forEach((x) => {
      const k = (dot.loai === 'TAT_CA' ? (x.loai === 'TSCD' ? 'TSCĐ — ' : 'CCDC — ') : '') + (x.nhom || '(Chưa phân nhóm)');
      if (!nhomMap.has(k)) nhomMap.set(k, []);
      nhomMap.get(k).push(x);
    });
    const cong = () => ({ sl: 0, ng: 0, cl: 0, sl2: 0, ng2: 0, cl2: 0 });
    const tongAll = cong();
    const dongTong = r++;
    let stt = 0;
    const dem = { co: 0, hong: 0, khong_thay: 0, chua: 0 };
    const lech = (a, b) => (a === null || a === undefined ? null : a - b);
    for (const [tenNhom, dsNhom] of nhomMap) {
      const dongNhom = r++;
      const t = cong();
      for (const x of dsNhom) {
        const kk = giaTriKiemKe(x);
        dem[x.ket_qua || 'chua']++;
        const cl = x.gia_tri_con_lai;
        const ghi = [x.ket_qua === 'hong' ? 'Hỏng' : x.ket_qua === 'khong_thay' ? 'Không thấy' : x.ket_qua ? '' : 'Chưa kiểm', x.ghi_chu].filter(Boolean).join('; ');
        M.dongBang(ws, r++, cot, [
          ++stt, x.ten, x.ma_tai_san, [x.bo_phan, x.vi_tri].filter(Boolean).join(' · '),
          x.so_luong, x.nguyen_gia, cl,
          kk ? kk.sl : null, kk ? kk.ng : null, kk ? kk.cl : null,
          kk ? lech(kk.sl, x.so_luong) : null, kk ? lech(kk.ng, x.nguyen_gia) : null, kk && cl !== null ? lech(kk.cl, cl) : null,
          ghi,
        ]);
        t.sl += x.so_luong || 0; t.ng += x.nguyen_gia || 0; t.cl += cl || 0;
        if (kk) { t.sl2 += kk.sl; t.ng2 += kk.ng; t.cl2 += kk.cl || 0; } else { t.sl2 += x.so_luong || 0; t.ng2 += x.nguyen_gia || 0; t.cl2 += cl || 0; }
      }
      M.dongBang(ws, dongNhom, cot, ['', `${tenNhom} (${dsNhom.length})`, '', '', t.sl, t.ng, t.cl, t.sl2, t.ng2, t.cl2, t.sl2 - t.sl, t.ng2 - t.ng, t.cl2 - t.cl, ''], 'nhom');
      Object.keys(t).forEach((k2) => { tongAll[k2] += t[k2]; });
    }
    M.dongBang(ws, dongTong, cot, ['', 'TỔNG CỘNG', '', '', tongAll.sl, tongAll.ng, tongAll.cl, tongAll.sl2, tongAll.ng2, tongAll.cl2,
      tongAll.sl2 - tongAll.sl, tongAll.ng2 - tongAll.ng, tongAll.cl2 - tongAll.cl, ''], 'tong');

    M.chanSo(ws, r, {
      cauHinh,
      nhan: ['Trưởng ban kiểm kê', 'Kế toán trưởng', 'Thủ trưởng đơn vị'],
      tenKy: [truongBan, cauHinh.so_ke_toan_truong, cauHinh.so_hieu_truong],
      ngayKy: `Ngày ${d} tháng ${m} năm ${y}`,
      ghiChu: [
        `- Kết quả: ${ds.length} tài sản theo sổ; có ${dem.co}, hỏng ${dem.hong}, không thấy ${dem.khong_thay}${dem.chua ? `, chưa kiểm ${dem.chua} (cột kiểm kê để trống, cộng nhóm tạm tính bằng số sổ sách)` : ''}.`,
        '- Ý kiến giải quyết số chênh lệch: ...........................................................................................................................',
        '  ....................................................................................................................................................................',
      ],
    });
  }
  if (!theoTruong.size) M.themSheet(wb, 'Trống', daDung, 1).getCell(1, 2).value = 'Đợt kiểm kê không có tài sản.';
  return wb.xlsx.writeBuffer();
}

module.exports = { xuatBienBanKiemKe };
