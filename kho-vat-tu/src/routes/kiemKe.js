// Kiểm kê tài sản: đợt kiểm kê (chụp số liệu sổ tại ngày kiểm kê) + kết quả từng dòng + chốt + biên bản Excel.
const express = require('express');
const { db, layCauHinh } = require('../db');
const { headerTaiFile } = require('../services/tenFile');
const { chuoi, ngayHopLe, boSung, ghiLichSu, TRUONG_MAC_DINH } = require('../services/taiSanDungChung');
const { xuatBienBanKiemKe } = require('../services/xuatKiemKe');
const { soSanhVi } = require('../services/tienIch');

const router = express.Router();
const KET_QUA = ['co', 'khong_thay', 'hong'];
const KET_QUA_TEN = { co: 'Có', khong_thay: 'Không thấy', hong: 'Hỏng' };
const loi = (status, message) => Object.assign(new Error(message), { status });

const DEM = `
  (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.kiem_ke_id = k.id) AS tong,
  (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.kiem_ke_id = k.id AND d.ket_qua IS NOT NULL) AS da_kiem,
  (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.kiem_ke_id = k.id AND d.ket_qua = 'co') AS co,
  (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.kiem_ke_id = k.id AND d.ket_qua = 'khong_thay') AS khong_thay,
  (SELECT COUNT(*) FROM kiem_ke_dong d WHERE d.kiem_ke_id = k.id AND d.ket_qua = 'hong') AS hong`;
const layDot = (id) => db.prepare(`SELECT k.*, ${DEM} FROM kiem_ke k WHERE k.id = ?`).get(id);
function canDot(id, choSua) {
  const k = layDot(id);
  if (!k) throw loi(404, 'Không tìm thấy đợt kiểm kê');
  if (choSua && k.trang_thai === 'da_chot') throw loi(400, 'Đợt kiểm kê đã chốt — mở lại đợt nếu cần sửa kết quả');
  return k;
}
const boc = (fn) => (req, res, next) => { try { fn(req, res); } catch (err) { if (err.status) res.status(err.status).json({ error: err.message }); else next(err); } };

router.get('/', boc((req, res) => {
  res.json(db.prepare(`SELECT k.*, ${DEM} FROM kiem_ke k ORDER BY k.ngay DESC, k.id DESC`).all());
}));

// Tạo đợt: chụp lại tài sản trong phạm vi (không gồm tài sản đã ghi giảm trước ngày kiểm kê / ghi tăng sau ngày đó).
router.post('/', boc((req, res) => {
  const b = req.body || {};
  const ten = chuoi(b.ten);
  if (!ten) throw loi(400, 'Cần nhập tên đợt kiểm kê');
  const loai = ['TSCD', 'CCDC', 'TAT_CA'].includes(b.loai) ? b.loai : null;
  if (!loai) throw loi(400, 'Loại tài sản không hợp lệ');
  const ngay = chuoi(b.ngay);
  if (!ngay || !ngayHopLe(ngay)) throw loi(400, 'Ngày kiểm kê không hợp lệ');
  const pham = { truong: chuoi(b.truong), bo_phan: chuoi(b.bo_phan), nhom: chuoi(b.nhom) };
  let rows = db.prepare('SELECT * FROM tai_san').all()
    .filter((r) => loai === 'TAT_CA' || r.loai === loai)
    .filter((r) => !pham.truong || r.truong === pham.truong)
    .filter((r) => !pham.bo_phan || (r.bo_phan || '') === pham.bo_phan)
    .filter((r) => !pham.nhom || (r.nhom || '') === pham.nhom)
    .filter((r) => !(r.ngay_ghi_tang && r.ngay_ghi_tang > ngay))
    .filter((r) => !(r.tinh_trang === 'da_giam' && (!r.ngay_giam || r.ngay_giam <= ngay)));
  if (!rows.length) throw loi(400, 'Không có tài sản nào trong phạm vi đã chọn');
  const so = soSanhVi;
  rows.sort((a, b2) => (a.truong === TRUONG_MAC_DINH ? 0 : 1) - (b2.truong === TRUONG_MAC_DINH ? 0 : 1)
    || so(a.truong, b2.truong) || so(a.loai, b2.loai) || so(a.nhom, b2.nhom) || so(a.ma_tai_san, b2.ma_tai_san));
  const id = db.transaction(() => {
    const info = db.prepare(`INSERT INTO kiem_ke (ten, loai, truong, bo_phan, nhom, ngay, ban_kiem_ke, ghi_chu)
      VALUES (?,?,?,?,?,?,?,?)`).run(ten, loai, pham.truong, pham.bo_phan, pham.nhom, ngay, chuoi(b.ban_kiem_ke), chuoi(b.ghi_chu));
    const them = db.prepare(`INSERT INTO kiem_ke_dong (kiem_ke_id, tai_san_id, loai, truong, ma_tai_san, ten, nhom, dvt, bo_phan,
      nguoi_su_dung, vi_tri, so_luong, nguyen_gia, gia_tri_con_lai) VALUES (@k,@id,@loai,@truong,@ma_tai_san,@ten,@nhom,@dvt,@bo_phan,
      @nguoi_su_dung,@vi_tri,@so_luong,@ng,@cl)`);
    for (const r of rows) {
      const x = boSung(r, ngay);
      them.run({
        k: info.lastInsertRowid, ...r, ng: Math.round(x.thanh_tien),
        cl: r.loai === 'TSCD' ? Math.round(x.gia_tri_con_lai ?? x.thanh_tien) : null,
      });
    }
    return info.lastInsertRowid;
  })();
  res.status(201).json(layDot(id));
}));

router.get('/:id', boc((req, res) => {
  const k = canDot(req.params.id);
  const dong = db.prepare('SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? ORDER BY id').all(k.id);
  res.json({ ...k, dong });
}));

router.put('/:id', boc((req, res) => {
  const k = canDot(req.params.id);
  const b = req.body || {};
  const ten = b.ten === undefined ? k.ten : chuoi(b.ten);
  if (!ten) throw loi(400, 'Cần nhập tên đợt kiểm kê');
  db.prepare('UPDATE kiem_ke SET ten = ?, ban_kiem_ke = ?, ghi_chu = ? WHERE id = ?')
    .run(ten, b.ban_kiem_ke === undefined ? k.ban_kiem_ke : chuoi(b.ban_kiem_ke), b.ghi_chu === undefined ? k.ghi_chu : chuoi(b.ghi_chu), k.id);
  res.json(layDot(k.id));
}));

// Ghi kết quả cho 1 hoặc nhiều dòng: { ids, ket_qua: 'co'|'khong_thay'|'hong'|null, so_luong_thuc_te?, ghi_chu? }
router.patch('/:id/dong', boc((req, res) => {
  const k = canDot(req.params.id, true);
  const b = req.body || {};
  const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).map(Number).filter((n) => n > 0))];
  if (!ids.length) throw loi(400, 'Chưa chọn dòng nào');
  if (b.ket_qua !== undefined && b.ket_qua !== null && !KET_QUA.includes(b.ket_qua)) throw loi(400, 'Kết quả không hợp lệ');
  let sl;
  if (b.so_luong_thuc_te !== undefined && b.so_luong_thuc_te !== '' && b.so_luong_thuc_te !== null) {
    sl = Number(b.so_luong_thuc_te);
    if (!(sl >= 0)) throw loi(400, 'Số lượng thực tế không hợp lệ');
  }
  const rows = db.prepare(`SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? AND id IN (${ids.map(() => '?').join(',')})`).all(k.id, ...ids);
  const capNhat = db.prepare(`UPDATE kiem_ke_dong SET ket_qua = @ket_qua, so_luong_thuc_te = @sl, ghi_chu = @ghi_chu,
    kiem_luc = CASE WHEN @ket_qua IS NULL THEN NULL ELSE datetime('now') END WHERE id = @id`);
  db.transaction(() => {
    for (const r of rows) {
      let kq = b.ket_qua === undefined ? r.ket_qua : b.ket_qua;
      if (kq === null && sl !== undefined) kq = 'co'; // nhập số lượng thực tế = đã thấy
      let slTT = sl !== undefined ? sl : r.so_luong_thuc_te;
      if (b.ket_qua !== undefined) {
        if (kq === 'khong_thay') slTT = 0;
        else if (kq === null) slTT = null;
        else if (sl === undefined && (r.ket_qua === 'khong_thay' || slTT === null)) slTT = r.so_luong;
      }
      capNhat.run({ id: r.id, ket_qua: kq, sl: slTT, ghi_chu: b.ghi_chu === undefined ? r.ghi_chu : chuoi(b.ghi_chu) });
    }
  })();
  const sau = db.prepare(`SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? AND id IN (${ids.map(() => '?').join(',')})`).all(k.id, ...ids);
  res.json({ dong: sau, dot: layDot(k.id) });
}));

// Quét / gõ mã tài sản -> đánh dấu "Có" (dòng đang Hỏng thì giữ Hỏng).
router.post('/:id/quet', boc((req, res) => {
  const k = canDot(req.params.id, true);
  const ma = String((req.body || {}).ma || '').trim();
  if (!ma) throw loi(400, 'Chưa nhập mã');
  // Khớp đúng mã trước; không thấy thì so không phân biệt hoa / thường bằng JS (LOWER của SQLite chỉ đổi chữ ASCII:
  // "ĐH-01" sẽ không khớp "đh-01").
  const khoaMa = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
  let thay = db.prepare('SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? AND TRIM(ma_tai_san) = ?').all(k.id, ma);
  if (!thay.length) {
    const k2 = khoaMa(ma);
    thay = db.prepare('SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? AND ma_tai_san IS NOT NULL').all(k.id).filter((r) => khoaMa(r.ma_tai_san) === k2);
  }
  if (!thay.length) throw loi(404, `Không có tài sản mã "${req.body.ma}" trong đợt kiểm kê này`);
  if (thay.length > 1 && !req.body.dong_id) {
    return res.status(409).json({ error: 'Mã này có ở nhiều trường — chọn đúng dòng', lua_chon: thay });
  }
  const r = req.body.dong_id ? thay.find((x) => x.id === Number(req.body.dong_id)) : thay[0];
  if (!r) throw loi(404, 'Không tìm thấy dòng');
  const truoc = r.ket_qua;
  if (r.ket_qua !== 'hong' && r.ket_qua !== 'co') {
    db.prepare("UPDATE kiem_ke_dong SET ket_qua = 'co', so_luong_thuc_te = COALESCE(so_luong_thuc_te, so_luong), kiem_luc = datetime('now') WHERE id = ?").run(r.id);
    if (truoc === 'khong_thay') db.prepare('UPDATE kiem_ke_dong SET so_luong_thuc_te = so_luong WHERE id = ?').run(r.id);
  }
  res.json({ dong: db.prepare('SELECT * FROM kiem_ke_dong WHERE id = ?').get(r.id), truoc, dot: layDot(k.id) });
}));

// Chốt đợt: { cap_nhat_hong, ghi_lich_su }
router.post('/:id/chot', boc((req, res) => {
  const k = canDot(req.params.id, true);
  const b = req.body || {};
  const dong = db.prepare('SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? AND ket_qua IS NOT NULL AND tai_san_id IS NOT NULL').all(k.id);
  let doiHong = 0;
  // Chốt lại sau khi "Mở lại đợt": thay dòng lịch sử cũ của chính đợt này (cùng ngày, cùng tên đợt), không ghi trùng.
  const tienTo = `${k.ten}: `;
  const xoaLichSuCu = db.prepare("DELETE FROM tai_san_lich_su WHERE tai_san_id = ? AND su_kien = 'Kiểm kê' AND ngay = ? AND substr(noi_dung, 1, ?) = ?");
  db.transaction(() => {
    for (const d of dong) {
      if (b.ghi_lich_su) {
        xoaLichSuCu.run(d.tai_san_id, k.ngay, tienTo.length, tienTo);
        ghiLichSu(d.tai_san_id, k.ngay, 'Kiểm kê', `${k.ten}: ${KET_QUA_TEN[d.ket_qua]}`
          + (d.so_luong_thuc_te !== null && d.so_luong_thuc_te !== d.so_luong ? ` (thực tế ${d.so_luong_thuc_te}/${d.so_luong})` : '')
          + (d.ghi_chu ? ` — ${d.ghi_chu}` : ''));
      }
      if (b.cap_nhat_hong && d.ket_qua === 'hong') {
        const ts = db.prepare('SELECT tinh_trang FROM tai_san WHERE id = ?').get(d.tai_san_id);
        if (ts && !['hong', 'da_giam'].includes(ts.tinh_trang)) {
          db.prepare("UPDATE tai_san SET tinh_trang = 'hong', updated_at = datetime('now') WHERE id = ?").run(d.tai_san_id);
          ghiLichSu(d.tai_san_id, k.ngay, 'Đổi tình trạng', `→ Hỏng (theo kiểm kê "${k.ten}")`);
          doiHong++;
        }
      }
    }
    db.prepare("UPDATE kiem_ke SET trang_thai = 'da_chot', chot_luc = datetime('now') WHERE id = ?").run(k.id);
  })();
  res.json({ dot: layDot(k.id), doi_hong: doiHong, ghi_lich_su: b.ghi_lich_su ? dong.length : 0 });
}));

router.post('/:id/mo-lai', boc((req, res) => {
  const k = canDot(req.params.id);
  db.prepare("UPDATE kiem_ke SET trang_thai = 'dang_kiem', chot_luc = NULL WHERE id = ?").run(k.id);
  res.json(layDot(k.id));
}));

router.delete('/:id', boc((req, res) => {
  const k = canDot(req.params.id);
  db.prepare('DELETE FROM kiem_ke WHERE id = ?').run(k.id);
  res.json({ ok: true });
}));

router.get('/:id/bien-ban', async (req, res, next) => {
  try {
    const k = layDot(req.params.id);
    if (!k) return res.status(404).json({ error: 'Không tìm thấy đợt kiểm kê' });
    const dong = db.prepare('SELECT * FROM kiem_ke_dong WHERE kiem_ke_id = ? ORDER BY id').all(k.id);
    const buf = await xuatBienBanKiemKe({ dot: k, dong, cauHinh: { ...layCauHinh(), truong_goc: TRUONG_MAC_DINH } });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', headerTaiFile(`BienBanKiemKe_${k.ngay}_${k.ten}.xlsx`));
    res.send(Buffer.from(buf));
  } catch (err) { next(err); }
});

module.exports = router;
