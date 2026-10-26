const express = require('express');
const { headerTaiFile } = require('../services/tenFile');
const { db, findOrCreateVatTu, tonKhoCuaVatTu, layCauHinh } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');
const {
  ghepXuatVoiNhap,
  chuanHoaNguonKinhPhi,
  laNguonKinhPhiHopLe,
  chuoiHoacNull,
} = require('../services/ghepNhapXuat');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT px.*, (SELECT COUNT(*) FROM phieu_xuat_items WHERE phieu_xuat_id = px.id) AS so_dong
       FROM phieu_xuat px ORDER BY px.ngay DESC, px.id DESC`
    )
    .all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  res.json({ ...phieu, items });
});

router.get('/:id/xuat-excel', async (req, res, next) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  try {
    const wb = taoFilePhieu(phieu, items, 'xuat', layCauHinh());
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', headerTaiFile(`PhieuXuatKho_${phieu.so_phieu || phieu.id}.xlsx`));
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// Kiểm tra đủ tồn kho cho một danh sách { vat_tu_id, sl_thuc_xuat } đã GỘP theo vật tư
// (dùng chung cho lưu 1 phiếu và tách nhiều phiếu cùng lúc, để không bị trừ tồn 2 lần).
function kiemTraTonKho(danhSachCanXuat) {
  const gop = {};
  for (const it of danhSachCanXuat) {
    if (!it.vat_tu_id) continue;
    gop[it.vat_tu_id] = (gop[it.vat_tu_id] || 0) + (Number(it.sl_thuc_xuat) || 0);
  }
  const thieuHut = [];
  for (const [vatTuId, slCan] of Object.entries(gop)) {
    const ton = tonKhoCuaVatTu(Number(vatTuId));
    if (slCan > ton) {
      const vatTu = db.prepare('SELECT ten_hang FROM vat_tu WHERE id = ?').get(vatTuId);
      thieuHut.push({ ten_hang: vatTu ? vatTu.ten_hang : `#${vatTuId}`, ton_kho: ton, muon_xuat: slCan });
    }
  }
  return thieuHut;
}

// Chuẩn hóa 1 dòng hàng hóa (từ body người dùng gửi lên, có thể chưa có vat_tu_id).
function chuanHoaDongHang(it) {
  const slThucXuat = Number(it.sl_thuc_xuat) || 0;
  const donGia = Number(it.don_gia) || 0;
  const vatTu = it.vat_tu_id
    ? db.prepare('SELECT * FROM vat_tu WHERE id = ?').get(it.vat_tu_id)
    : findOrCreateVatTu({ ten_hang: it.ten_hang, dvt: it.dvt });
  return {
    ten_hang: it.ten_hang || (vatTu && vatTu.ten_hang),
    ma_so: it.ma_so || null,
    dvt: it.dvt || (vatTu && vatTu.dvt) || null,
    sl_yeu_cau: Number(it.sl_yeu_cau) || slThucXuat,
    sl_thuc_xuat: slThucXuat,
    don_gia: donGia,
    thanh_tien: Math.round(slThucXuat * donGia),
    ghi_chu: it.ghi_chu || null,
    tieu_muc: chuoiHoacNull(it.tieu_muc),
    phieu_nhap_item_id: it.phieu_nhap_item_id ? Number(it.phieu_nhap_item_id) : null,
    vat_tu_id: vatTu ? vatTu.id : null,
  };
}

// Kiểm tra phieu_nhap_item_id (nếu có) tồn tại và cùng vật tư với dòng xuất. Trả về chuỗi lỗi hoặc null.
function kiemTraLienKetNhap(items) {
  const q = db.prepare('SELECT id, vat_tu_id FROM phieu_nhap_items WHERE id = ?');
  for (const it of items) {
    if (it.phieu_nhap_item_id === null || it.phieu_nhap_item_id === undefined) continue;
    const n = Number.isInteger(it.phieu_nhap_item_id) ? q.get(it.phieu_nhap_item_id) : null;
    if (!n) return `phieu_nhap_item_id=${it.phieu_nhap_item_id} không tồn tại (dòng "${it.ten_hang}")`;
    if (it.vat_tu_id && n.vat_tu_id && it.vat_tu_id !== n.vat_tu_id) {
      return `Dòng xuất "${it.ten_hang}" không cùng vật tư với dòng nhập phieu_nhap_item_id=${n.id}`;
    }
  }
  return null;
}

// Lưu 1 phiếu xuất (đã chuẩn hóa dòng hàng) — PHẢI gọi bên trong 1 db.transaction().
function luuMotPhieuXuat(p) {
  const rows = p.items.map((it, idx) => ({ stt: idx + 1, ...it }));
  const tongTienHang = rows.reduce((s, r) => s + r.thanh_tien, 0);
  const thueSuat = Math.min(100, Math.max(0, Number(p.thue_suat) || 0));
  const tienThue = Math.round((tongTienHang * thueSuat) / 100);
  const tongCong = tongTienHang + tienThue;

  const info = db
    .prepare(
      `INSERT INTO phieu_xuat
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem, so_chung_tu_goc,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu, tk_doi_ung, tieu_muc, nguon_kinh_phi)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi_nhan,@don_vi,@ly_do_xuat,@xuat_tai_kho,@dia_diem,@so_chung_tu_goc,
               @tong_tien_hang,@thue_suat,@tien_thue,@tong_cong,@tong_bang_chu,@tk_doi_ung,@tieu_muc,@nguon_kinh_phi)`
    )
    .run({
      so_phieu: p.so_phieu || null,
      ngay: p.ngay || null,
      no_tk: p.no_tk || null,
      co_tk: p.co_tk || null,
      nguoi_nhan: p.nguoi_nhan || null,
      don_vi: p.don_vi || null,
      ly_do_xuat: p.ly_do_xuat || null,
      xuat_tai_kho: p.xuat_tai_kho || null,
      dia_diem: p.dia_diem || null,
      so_chung_tu_goc: p.so_chung_tu_goc || null,
      tong_tien_hang: tongTienHang,
      thue_suat: thueSuat,
      tien_thue: tienThue,
      tong_cong: tongCong,
      tong_bang_chu: p.tong_bang_chu || soTienBangChu(tongCong),
      tk_doi_ung: chuoiHoacNull(p.tk_doi_ung),
      tieu_muc: chuoiHoacNull(p.tieu_muc),
      nguon_kinh_phi: chuanHoaNguonKinhPhi(p.nguon_kinh_phi),
    });

  const phieuId = info.lastInsertRowid;
  const insertItem = db.prepare(
    `INSERT INTO phieu_xuat_items
     (phieu_xuat_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, thanh_tien, ghi_chu,
      tieu_muc, phieu_nhap_item_id)
     VALUES (@phieu_xuat_id,@vat_tu_id,@stt,@ten_hang,@ma_so,@dvt,@sl_yeu_cau,@sl_thuc_xuat,@don_gia,@thanh_tien,@ghi_chu,
             @tieu_muc,@phieu_nhap_item_id)`
  );
  for (const row of rows) {
    insertItem.run({
      phieu_xuat_id: phieuId,
      ...row,
      tieu_muc: chuoiHoacNull(row.tieu_muc),
      phieu_nhap_item_id: row.phieu_nhap_item_id || null,
    });
  }
  return phieuId;
}

// body: { so_phieu, ngay, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem,
//         tk_doi_ung, tieu_muc, nguon_kinh_phi ('661.2' | '337', mặc định '661.2'),   // trường cho Sổ tổng hợp
//         items: [{ vat_tu_id? , ten_hang, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, ghi_chu,
//                   tieu_muc?, phieu_nhap_item_id? (dòng nhập mà dòng xuất này lấy từ) }] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const itemsTho = Array.isArray(b.items) ? b.items : [];
  if (itemsTho.length === 0) return res.status(400).json({ error: 'Phiếu xuất cần ít nhất 1 dòng hàng hóa' });

  if (itemsTho.some((it) => !it || typeof it !== 'object')) return res.status(400).json({ error: 'Dòng hàng hóa không hợp lệ' });
  // Số lượng âm sẽ làm TĂNG tồn kho thay vì trừ — chặn từ đầu.
  const dongAm = itemsTho.filter((it) => (Number(it.sl_thuc_xuat) || 0) < 0 || (Number(it.don_gia) || 0) < 0);
  if (dongAm.length > 0) return res.status(400).json({ error: 'Số lượng và đơn giá không được âm' });

  const items = itemsTho.map(chuanHoaDongHang);
  const loiLienKet = kiemTraLienKetNhap(items);
  if (loiLienKet) return res.status(400).json({ error: loiLienKet });
  const thieuHut = kiemTraTonKho(items);
  if (thieuHut.length > 0) {
    return res.status(400).json({ error: 'Không đủ tồn kho cho một số vật tư', chi_tiet: thieuHut });
  }

  const tx = db.transaction(() => luuMotPhieuXuat({ ...b, items }));
  try {
    const id = tx();
    res.status(201).json(db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: 'Lưu phiếu xuất thất bại: ' + err.message });
  }
});

// Tách 1 phiếu nhập kho thành NHIỀU phiếu xuất tùy ý — bảng phân bổ linh hoạt: bao
// nhiêu nhóm (phiếu xuất) cũng được, mỗi dòng hàng tự gõ số lượng chia cho từng nhóm
// (gộp nhiều mặt hàng vào 1 phiếu, chia đều 2/3/4/5 nhóm, hay bất kỳ cách chia nào).
// body: {
//   phieu_nhap_id,
//   nhom: [ { nguoi_nhan, don_vi, so_phieu }, ... ],   // mỗi phần tử = 1 phiếu xuất sẽ tạo
//   phan_bo: { [phieu_nhap_item_id]: [slNhom0, slNhom1, ...] },  // số lượng chia cho từng nhóm, theo đúng thứ tự "nhom" ở trên
//   ngay, no_tk, co_tk, ly_do_xuat, xuat_tai_kho, dia_diem, thue_suat   // áp dụng chung cho mọi phiếu tạo ra
// }
router.post('/phan-bo', (req, res) => {
  const b = req.body || {};
  const phieuNhap = db.prepare('SELECT * FROM phieu_nhap WHERE id = ?').get(b.phieu_nhap_id);
  if (!phieuNhap) return res.status(404).json({ error: 'Không tìm thấy phiếu nhập' });
  const itemsNhap = db.prepare('SELECT * FROM phieu_nhap_items WHERE phieu_nhap_id = ? ORDER BY stt').all(phieuNhap.id);
  if (itemsNhap.length === 0) return res.status(400).json({ error: 'Phiếu nhập này không có dòng hàng hóa nào' });

  const nhom = Array.isArray(b.nhom) ? b.nhom : [];
  if (nhom.length === 0) return res.status(400).json({ error: 'Cần ít nhất 1 nhóm (phiếu xuất) để phân bổ' });
  const phanBo = b.phan_bo || {};

  const chung = {
    ngay: b.ngay || null,
    no_tk: b.no_tk || null,
    co_tk: b.co_tk || null,
    ly_do_xuat: b.ly_do_xuat || null,
    xuat_tai_kho: b.xuat_tai_kho || null,
    dia_diem: b.dia_diem || null,
    thue_suat: Math.min(100, Math.max(0, Number(b.thue_suat) || 0)),
    // Thừa hưởng trường sổ sách từ phiếu nhập gốc, trừ khi body ghi đè.
    tk_doi_ung: chuoiHoacNull(b.tk_doi_ung) || phieuNhap.tk_doi_ung || null,
    tieu_muc: chuoiHoacNull(b.tieu_muc) || phieuNhap.tieu_muc || null,
    nguon_kinh_phi: chuanHoaNguonKinhPhi(chuoiHoacNull(b.nguon_kinh_phi) || phieuNhap.nguon_kinh_phi),
  };

  const canhBao = [];
  // Mỗi phần tử: danh sách dòng hàng của 1 phiếu xuất sẽ tạo (theo đúng thứ tự "nhom").
  const dongHangTheoNhom = nhom.map(() => []);

  for (const it of itemsNhap) {
    const phanBoDong = phanBo[it.id];
    if (phanBoDong !== undefined && !Array.isArray(phanBoDong)) {
      return res.status(400).json({ error: 'phan_bo phải là mảng số lượng theo từng nhóm' });
    }
    const soLuongTheoNhom = (phanBoDong || []).map((v) => Number(v) || 0);
    if (soLuongTheoNhom.some((v) => v < 0)) return res.status(400).json({ error: 'Số lượng và đơn giá không được âm' });
    const tongDaChia = soLuongTheoNhom.reduce((s, v) => s + v, 0);
    if (tongDaChia > it.sl_thuc_nhap) {
      canhBao.push(`"${it.ten_hang}": đã phân bổ ${tongDaChia} nhưng phiếu nhập chỉ có ${it.sl_thuc_nhap} — kiểm tra lại.`);
    } else if (tongDaChia < it.sl_thuc_nhap && tongDaChia > 0) {
      canhBao.push(`"${it.ten_hang}": chỉ phân bổ ${tongDaChia}/${it.sl_thuc_nhap}, còn dư ${it.sl_thuc_nhap - tongDaChia} chưa đưa vào phiếu xuất nào.`);
    }
    nhom.forEach((_, i) => {
      const sl = soLuongTheoNhom[i] || 0;
      if (sl > 0) {
        dongHangTheoNhom[i].push({
          vat_tu_id: it.vat_tu_id,
          ten_hang: it.ten_hang,
          ma_so: it.ma_so,
          dvt: it.dvt,
          sl_yeu_cau: sl,
          sl_thuc_xuat: sl,
          don_gia: it.don_gia,
          thanh_tien: Math.round(sl * it.don_gia),
          ghi_chu: it.ghi_chu,
          tieu_muc: it.tieu_muc || null,
          phieu_nhap_item_id: it.id,
        });
      }
    });
  }

  const danhSachPhieu = nhom
    .map((n, i) => ({ ...chung, ...n, items: dongHangTheoNhom[i] }))
    .filter((p) => p.items.length > 0);

  if (danhSachPhieu.length === 0) {
    return res.status(400).json({ error: 'Chưa phân bổ số lượng nào cho nhóm nào cả — hãy nhập số lượng vào bảng phân bổ.' });
  }

  const tatCaDongHang = danhSachPhieu.flatMap((p) => p.items);
  const thieuHut = kiemTraTonKho(tatCaDongHang);
  if (thieuHut.length > 0) {
    return res.status(400).json({ error: 'Không đủ tồn kho cho một số vật tư', chi_tiet: thieuHut });
  }

  const tx = db.transaction(() => danhSachPhieu.map((p) => luuMotPhieuXuat(p)));
  try {
    const ids = tx();
    res.status(201).json({ so_phieu_da_tao: ids.length, ids, canh_bao: canhBao });
  } catch (err) {
    res.status(500).json({ error: 'Tách phiếu thất bại: ' + err.message });
  }
});

// Ghép tự động các dòng xuất CHƯA có phieu_nhap_item_id với dòng nhập tương ứng trên toàn DB
// (heuristic ở src/services/ghepNhapXuat.js). Không đụng các dòng đã có liên kết.
// body (tuỳ chọn): { cho_phep_lech_don_gia: true }  — mặc định đơn giá phải bằng nhau.
router.post('/ghep-tu-dong', (req, res) => {
  const b = req.body || {};
  try {
    const kq = ghepXuatVoiNhap({ db, choPhepLechDonGia: b.cho_phep_lech_don_gia === true });
    res.json(kq);
  } catch (err) {
    res.status(500).json({ error: 'Ghép tự động thất bại: ' + err.message });
  }
});

// Sửa riêng các trường sổ sách của phiếu xuất đã lưu (không đụng số liệu hàng hóa/tiền/tồn kho).
// body: { tk_doi_ung?, tieu_muc?, nguon_kinh_phi?, items?: [{ id, tieu_muc?, phieu_nhap_item_id? }] }
// Trường nào không gửi thì giữ nguyên; null/"" với tk_doi_ung/tieu_muc/phieu_nhap_item_id = xoá về null.
router.put('/:id/so-sach', (req, res) => {
  const b = req.body || {};
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });

  if (b.nguon_kinh_phi !== undefined && b.nguon_kinh_phi !== null && String(b.nguon_kinh_phi).trim() !== '' && !laNguonKinhPhiHopLe(b.nguon_kinh_phi)) {
    return res.status(400).json({ error: "nguon_kinh_phi chỉ nhận '661.2' hoặc '337'" });
  }
  const itemsGui = b.items === undefined ? [] : b.items;
  if (!Array.isArray(itemsGui)) return res.status(400).json({ error: 'items phải là mảng' });
  const dongHienCo = new Map(
    db.prepare('SELECT id, vat_tu_id, ten_hang FROM phieu_xuat_items WHERE phieu_xuat_id = ?').all(phieu.id).map((r) => [r.id, r])
  );
  const layNhap = db.prepare('SELECT id, vat_tu_id FROM phieu_nhap_items WHERE id = ?');
  for (const it of itemsGui) {
    const dong = it && dongHienCo.get(Number(it.id));
    if (!dong) return res.status(400).json({ error: `Dòng hàng id=${it && it.id} không thuộc phiếu xuất ${phieu.id}` });
    if ('phieu_nhap_item_id' in it && it.phieu_nhap_item_id !== null && it.phieu_nhap_item_id !== '') {
      const idNhap = Number(it.phieu_nhap_item_id);
      const n = Number.isInteger(idNhap) ? layNhap.get(idNhap) : null;
      if (!n) return res.status(400).json({ error: `phieu_nhap_item_id=${it.phieu_nhap_item_id} không tồn tại` });
      if (dong.vat_tu_id && n.vat_tu_id && dong.vat_tu_id !== n.vat_tu_id) {
        return res.status(400).json({ error: `Dòng xuất "${dong.ten_hang}" không cùng vật tư với dòng nhập ${n.id}` });
      }
    }
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE phieu_xuat SET tk_doi_ung = ?, tieu_muc = ?, nguon_kinh_phi = ? WHERE id = ?').run(
      b.tk_doi_ung !== undefined ? chuoiHoacNull(b.tk_doi_ung) : phieu.tk_doi_ung,
      b.tieu_muc !== undefined ? chuoiHoacNull(b.tieu_muc) : phieu.tieu_muc,
      b.nguon_kinh_phi !== undefined ? chuanHoaNguonKinhPhi(b.nguon_kinh_phi) : phieu.nguon_kinh_phi,
      phieu.id
    );
    const updTieuMuc = db.prepare('UPDATE phieu_xuat_items SET tieu_muc = ? WHERE id = ? AND phieu_xuat_id = ?');
    const updNhap = db.prepare('UPDATE phieu_xuat_items SET phieu_nhap_item_id = ? WHERE id = ? AND phieu_xuat_id = ?');
    for (const it of itemsGui) {
      if ('tieu_muc' in it) updTieuMuc.run(chuoiHoacNull(it.tieu_muc), Number(it.id), phieu.id);
      if ('phieu_nhap_item_id' in it) {
        const v = it.phieu_nhap_item_id === null || it.phieu_nhap_item_id === '' ? null : Number(it.phieu_nhap_item_id);
        updNhap.run(v, Number(it.id), phieu.id);
      }
    }
  });
  try {
    tx();
  } catch (err) {
    return res.status(500).json({ error: 'Cập nhật sổ sách thất bại: ' + err.message });
  }
  const moi = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(phieu.id);
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(phieu.id);
  res.json({ ...moi, items });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM phieu_xuat WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
