const express = require('express');
const { db, findOrCreateVatTu, tonKhoCuaVatTu, layCauHinh } = require('../db');
const { soTienBangChu } = require('../services/soTienBangChu');
const { taoFilePhieu } = require('../services/xuatMauPhieu');

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

router.get('/:id/xuat-excel', async (req, res) => {
  const phieu = db.prepare('SELECT * FROM phieu_xuat WHERE id = ?').get(req.params.id);
  if (!phieu) return res.status(404).json({ error: 'Không tìm thấy phiếu xuất' });
  const items = db.prepare('SELECT * FROM phieu_xuat_items WHERE phieu_xuat_id = ? ORDER BY stt').all(req.params.id);
  const wb = taoFilePhieu(phieu, items, 'xuat', layCauHinh());
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PhieuXuatKho_${phieu.so_phieu || phieu.id}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
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
    vat_tu_id: vatTu ? vatTu.id : null,
  };
}

// Lưu 1 phiếu xuất (đã chuẩn hóa dòng hàng) — PHẢI gọi bên trong 1 db.transaction().
function luuMotPhieuXuat(p) {
  const rows = p.items.map((it, idx) => ({ stt: idx + 1, ...it }));
  const tongTienHang = rows.reduce((s, r) => s + r.thanh_tien, 0);
  const thueSuat = Number(p.thue_suat) || 0;
  const tienThue = Math.round((tongTienHang * thueSuat) / 100);
  const tongCong = tongTienHang + tienThue;

  const info = db
    .prepare(
      `INSERT INTO phieu_xuat
       (so_phieu, ngay, no_tk, co_tk, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem, so_chung_tu_goc,
        tong_tien_hang, thue_suat, tien_thue, tong_cong, tong_bang_chu)
       VALUES (@so_phieu,@ngay,@no_tk,@co_tk,@nguoi_nhan,@don_vi,@ly_do_xuat,@xuat_tai_kho,@dia_diem,@so_chung_tu_goc,
               @tong_tien_hang,@thue_suat,@tien_thue,@tong_cong,@tong_bang_chu)`
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
    });

  const phieuId = info.lastInsertRowid;
  const insertItem = db.prepare(
    `INSERT INTO phieu_xuat_items
     (phieu_xuat_id, vat_tu_id, stt, ten_hang, ma_so, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, thanh_tien, ghi_chu)
     VALUES (@phieu_xuat_id,@vat_tu_id,@stt,@ten_hang,@ma_so,@dvt,@sl_yeu_cau,@sl_thuc_xuat,@don_gia,@thanh_tien,@ghi_chu)`
  );
  for (const row of rows) insertItem.run({ phieu_xuat_id: phieuId, ...row });
  return phieuId;
}

// body: { so_phieu, ngay, nguoi_nhan, don_vi, ly_do_xuat, xuat_tai_kho, dia_diem,
//         items: [{ vat_tu_id? , ten_hang, dvt, sl_yeu_cau, sl_thuc_xuat, don_gia, ghi_chu }] }
router.post('/', (req, res) => {
  const b = req.body || {};
  const itemsTho = Array.isArray(b.items) ? b.items : [];
  if (itemsTho.length === 0) return res.status(400).json({ error: 'Phiếu xuất cần ít nhất 1 dòng hàng hóa' });

  // Số lượng âm sẽ làm TĂNG tồn kho thay vì trừ — chặn từ đầu.
  const dongAm = itemsTho.filter((it) => (Number(it.sl_thuc_xuat) || 0) < 0 || (Number(it.don_gia) || 0) < 0);
  if (dongAm.length > 0) return res.status(400).json({ error: 'Số lượng và đơn giá không được âm' });

  const items = itemsTho.map(chuanHoaDongHang);
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
    thue_suat: Number(b.thue_suat) || 0,
  };

  const canhBao = [];
  // Mỗi phần tử: danh sách dòng hàng của 1 phiếu xuất sẽ tạo (theo đúng thứ tự "nhom").
  const dongHangTheoNhom = nhom.map(() => []);

  for (const it of itemsNhap) {
    const soLuongTheoNhom = (phanBo[it.id] || []).map((v) => Number(v) || 0);
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

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM phieu_xuat WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
