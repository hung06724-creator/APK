// Tính hao mòn TSCĐ theo phương pháp đường thẳng, theo tháng.
// Quy ước (kế toán cần rà lại nếu đơn vị áp dụng quy ước khác):
//  - Hao mòn bắt đầu trích từ tháng KẾ TIẾP tháng đưa vào sử dụng.
//  - Tháng của ngày "tính đến" được tính đủ tháng.
//  - Tài sản đã ghi giảm: chỉ tính đến tháng ghi giảm.
//  - Không vượt quá nguyên giá (dừng khi hết thời gian sử dụng).
//
// Hai cách tính:
//  1) Có ngày bắt đầu sử dụng + thời gian sử dụng: tính từ đầu.
//  2) Có "hao mòn lũy kế tại ngày chốt" (hm_luy_ke_ban_dau + ngay_chot_hm): lấy số đó làm gốc rồi cộng
//     tiếp mỗi tháng sau tháng chốt (dùng khi nạp từ sổ cũ không có ngày ghi tăng).

function soThang(ngay) {
  const m = /^(\d{4})-(\d{2})/.exec(ngay || '');
  return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null;
}

const { homNayISO: homNay } = require('./tienIch'); // ngày hôm nay theo giờ máy

const KHONG_CO = {
  hao_mon_thang: null, hao_mon_luy_ke: null, gia_tri_con_lai: null, ty_le_nam: null,
  so_thang_da_trich: null, so_thang_tong: null,
};

// Số liệu sổ gốc (cột so_lieu_goc, JSON — xem db.js). Trả null nếu không có hoặc hỏng.
function docSoLieuGoc(ts) {
  if (!ts || !ts.so_lieu_goc) return null;
  if (typeof ts.so_lieu_goc === 'object') return ts.so_lieu_goc;
  try {
    const o = JSON.parse(ts.so_lieu_goc);
    return o && Number(o.nam) ? o : null;
  } catch (e) {
    return null;
  }
}

// ts: { don_gia, so_luong, ngay_su_dung, ngay_ghi_tang, so_nam_su_dung, ngay_giam, hm_luy_ke_ban_dau, ngay_chot_hm, so_lieu_goc }
// Ngày ghi tăng / sử dụng để trống = chưa rõ (tài sản có từ trước, vd. số dư nạp từ sổ cũ).
function tinhHaoMon(ts, den) {
  const nguyenGia = (Number(ts.don_gia) || 0) * (Number(ts.so_luong) || 0);
  const nam = Number(ts.so_nam_su_dung) || 0;
  let denThang = soThang(den || homNay());
  const giam = soThang(ts.ngay_giam);
  if (giam !== null && giam < denThang) denThang = giam;

  const chot = soThang(ts.ngay_chot_hm);
  const hmDau = ts.hm_luy_ke_ban_dau === null || ts.hm_luy_ke_ban_dau === undefined ? null : Number(ts.hm_luy_ke_ban_dau);
  if (chot !== null && hmDau !== null && Number.isFinite(hmDau)) {
    const moiThang = nam > 0 ? nguyenGia / (nam * 12) : 0;
    let luyKe;
    let uocTinh = false;
    if (denThang >= chot) {
      luyKe = Math.min(nguyenGia, Math.round(hmDau + moiThang * (denThang - chot))); // làm tròn không được vượt nguyên giá
    } else {
      // Có số liệu sổ gốc của năm chốt: LKHM 31/12 năm trước là mốc thứ 2. Trong khoảng 2 mốc chia đều hao mòn
      // của năm theo tháng; trước mốc đó thì ước tính lùi tiếp từ mốc.
      const sg = docSoLieuGoc(ts);
      const coMoc = sg && sg.hmTruoc !== null && sg.hmTruoc !== undefined && Number.isFinite(Number(sg.hmTruoc));
      const moc = coMoc ? soThang(`${Number(sg.nam) - 1}-12-31`) : null;
      let goc = hmDau;
      let thangGoc = chot;
      if (moc !== null && moc < chot) {
        const hmMoc = Number(sg.hmTruoc);
        if (denThang >= moc) luyKe = Math.round(hmMoc + ((hmDau - hmMoc) * (denThang - moc)) / (chot - moc));
        else { goc = hmMoc; thangGoc = moc; }
      }
      if (luyKe === undefined) {
        // Ước tính lùi = số tại mốc - hao mòn các tháng (den, mốc], chỉ tính những tháng tài sản còn trích hao mòn
        // (sau tháng đưa vào sử dụng; nếu đã hết khấu hao tại mốc thì không quá hạn sử dụng).
        const batDauSd = soThang(ts.ngay_su_dung || ts.ngay_ghi_tang);
        let dau = denThang;
        let cuoi = thangGoc;
        if (batDauSd !== null) {
          dau = Math.max(dau, batDauSd);
          if (goc >= nguyenGia - 0.5 && nam > 0) cuoi = Math.min(cuoi, batDauSd + Math.round(nam * 12));
        }
        luyKe = Math.max(0, Math.round(goc - moiThang * Math.max(0, cuoi - dau)));
      }
      uocTinh = true;
    }
    return {
      uoc_tinh_lui: uocTinh,
      nguyen_gia: nguyenGia,
      hao_mon_thang: nam > 0 ? Math.round(moiThang) : null,
      hao_mon_luy_ke: luyKe,
      gia_tri_con_lai: nguyenGia - luyKe,
      ty_le_nam: nam > 0 ? Math.round((100 / nam) * 100) / 100 : null,
      so_thang_da_trich: null, // không biết tổng số tháng đã trích trước ngày chốt
      so_thang_tong: nam > 0 ? Math.round(nam * 12) : null,
    };
  }

  const batDau = soThang(ts.ngay_su_dung || ts.ngay_ghi_tang);
  if (!(nam > 0) || batDau === null) return { nguyen_gia: nguyenGia, ...KHONG_CO };
  const tong = Math.round(nam * 12);
  const daTrich = Math.max(0, Math.min(tong, denThang - batDau));
  const luyKe = Math.min(nguyenGia, Math.round((nguyenGia * daTrich) / tong));
  return {
    nguyen_gia: nguyenGia,
    hao_mon_thang: Math.round(nguyenGia / tong),
    hao_mon_luy_ke: luyKe,
    gia_tri_con_lai: nguyenGia - luyKe,
    ty_le_nam: Math.round((100 / nam) * 100) / 100,
    so_thang_da_trich: daTrich,
    so_thang_tong: tong,
  };
}

module.exports = { tinhHaoMon, homNay, docSoLieuGoc };
