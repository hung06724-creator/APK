// Ghép dòng XUẤT với dòng NHẬP tương ứng (cột phieu_nhap_item_id của phieu_xuat_items)
// phục vụ "Sổ tổng hợp nhập xuất vật tư", + vài hàm chuẩn hoá dùng chung cho các route.
const { db: dbMacDinh } = require('../db');

const NGUON_KINH_PHI_HOP_LE = ['661.2', '337'];
const NGUON_MAC_DINH = '661.2';

// Chuỗi đã trim, rỗng -> null (không tự bịa giá trị cho các trường sổ sách).
function chuoiHoacNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// Trả '661.2' hoặc '337'; mọi giá trị khác (rỗng, 'abc'...) -> '661.2'.
function chuanHoaNguonKinhPhi(v) {
  const s = chuoiHoacNull(v);
  if (s === null) return NGUON_MAC_DINH;
  return NGUON_KINH_PHI_HOP_LE.includes(s) ? s : NGUON_MAC_DINH;
}

// Giá trị có hợp lệ nguyên văn không (để route PUT báo lỗi thay vì lẳng lặng sửa).
function laNguonKinhPhiHopLe(v) {
  const s = chuoiHoacNull(v);
  return s !== null && NGUON_KINH_PHI_HOP_LE.includes(s);
}

const EPS = 1e-6;

// Heuristic ghép tự động. Chỉ đụng các dòng xuất có phieu_nhap_item_id IS NULL
// (không bao giờ ghi đè liên kết đã có).
//
// Quy tắc (an toàn, thà để trống còn hơn ghép sai):
//  - cùng vat_tu_id (dòng xuất không có vat_tu_id thì bỏ qua);
//  - dòng nhập còn "sức chứa": sl_thuc_nhap trừ tổng số lượng các dòng xuất đã gắn vào nó
//    phải >= số lượng dòng xuất đang xét (nên 1 dòng nhập vẫn chia được cho nhiều dòng xuất,
//    nhưng không bị "chiếm" quá số lượng nhập);
//  - ngày nhập <= ngày xuất (thiếu ngày ở một bên thì không loại, nhưng xếp ưu tiên thấp nhất);
//  - mặc định đơn giá phải bằng nhau (chỉ cho lệch giá khi truyền choPhepLechDonGia = true);
//  - chạy 2 lượt: lượt 1 ưu tiên cặp "khớp hoàn toàn" (cùng đơn giá, cùng số lượng với dòng nhập
//    còn nguyên chưa ai lấy), lượt 2 ghép phần còn lại theo sức chứa. Trong mỗi lượt xử lý các
//    dòng xuất theo ngày tăng dần, và chọn dòng nhập có ngày gần ngày xuất nhất (<=).
//
// Tham số: { db, choPhepLechDonGia }. Trả về
//   { tong_xem_xet, ghep_duoc, khong_ghep_duoc, ghep: [...], khong_ghep: [...] }
function ghepXuatVoiNhap(opts = {}) {
  const db = opts.db || dbMacDinh;
  const choPhepLechDonGia = !!opts.choPhepLechDonGia;

  const dongXuat = db
    .prepare(
      `SELECT i.id, i.phieu_xuat_id, i.vat_tu_id, i.ten_hang, i.sl_thuc_xuat AS sl, i.don_gia,
              p.ngay, p.so_phieu
       FROM phieu_xuat_items i JOIN phieu_xuat p ON p.id = i.phieu_xuat_id
       WHERE i.phieu_nhap_item_id IS NULL
       ORDER BY (p.ngay IS NULL), p.ngay, i.id`
    )
    .all();

  const dongNhap = db
    .prepare(
      `SELECT i.id, i.phieu_nhap_id, i.vat_tu_id, i.sl_thuc_nhap AS sl, i.don_gia,
              p.ngay, p.so_phieu,
              i.sl_thuc_nhap - COALESCE((
                SELECT SUM(x.sl_thuc_xuat) FROM phieu_xuat_items x WHERE x.phieu_nhap_item_id = i.id
              ), 0) AS con_lai,
              (SELECT COUNT(*) FROM phieu_xuat_items x WHERE x.phieu_nhap_item_id = i.id) AS so_xuat_da_gan
       FROM phieu_nhap_items i JOIN phieu_nhap p ON p.id = i.phieu_nhap_id
       WHERE i.vat_tu_id IS NOT NULL`
    )
    .all();

  const nhapTheoVatTu = new Map();
  for (const n of dongNhap) {
    if (!nhapTheoVatTu.has(n.vat_tu_id)) nhapTheoVatTu.set(n.vat_tu_id, []);
    nhapTheoVatTu.get(n.vat_tu_id).push(n);
  }

  const ngayThanhSo = (s) => {
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  };

  const khoiPhuc = new Map(); // xuat id -> { nhap, muc }

  function chonNhap(x, nghiemNgat) {
    const ds = nhapTheoVatTu.get(x.vat_tu_id) || [];
    const tx = ngayThanhSo(x.ngay);
    let tot = null;
    let diemTot = null;
    for (const n of ds) {
      if (n.con_lai + EPS < x.sl) continue;
      const cungGia = Math.abs((n.don_gia || 0) - (x.don_gia || 0)) < 0.5;
      if (!cungGia && !choPhepLechDonGia) continue;
      if (nghiemNgat) {
        // lượt 1: dòng nhập còn nguyên, trùng đúng số lượng
        if (n.so_xuat_da_gan > 0 || Math.abs(n.sl - x.sl) > EPS) continue;
      }
      const tn = ngayThanhSo(n.ngay);
      let khoangCach;
      if (tx !== null && tn !== null) {
        if (tn > tx) continue; // nhập sau ngày xuất -> không hợp lý
        khoangCach = tx - tn;
      } else {
        khoangCach = Number.MAX_SAFE_INTEGER; // thiếu ngày: chỉ chọn khi không còn lựa chọn nào tốt hơn
      }
      // điểm nhỏ hơn = tốt hơn: [lệch giá, khoảng cách ngày, id]
      const diem = [cungGia ? 0 : 1, khoangCach, n.id];
      if (
        !diemTot ||
        diem[0] < diemTot[0] ||
        (diem[0] === diemTot[0] && (diem[1] < diemTot[1] || (diem[1] === diemTot[1] && diem[2] < diemTot[2])))
      ) {
        tot = n;
        diemTot = diem;
      }
    }
    return tot;
  }

  const upd = db.prepare('UPDATE phieu_xuat_items SET phieu_nhap_item_id = ? WHERE id = ? AND phieu_nhap_item_id IS NULL');

  const tx = db.transaction(() => {
    for (const luot of [true, false]) {
      for (const x of dongXuat) {
        if (khoiPhuc.has(x.id) || !x.vat_tu_id) continue;
        const n = chonNhap(x, luot);
        if (!n) continue;
        upd.run(n.id, x.id);
        n.con_lai -= x.sl;
        n.so_xuat_da_gan += 1;
        khoiPhuc.set(x.id, { nhap: n, muc: luot ? 'khop_hoan_toan' : 'theo_suc_chua' });
      }
    }
  });
  tx();

  const ghep = [];
  const khongGhep = [];
  for (const x of dongXuat) {
    const k = khoiPhuc.get(x.id);
    if (k) {
      ghep.push({
        xuat_item_id: x.id,
        phieu_xuat_id: x.phieu_xuat_id,
        so_phieu_xuat: x.so_phieu,
        ngay_xuat: x.ngay,
        ten_hang: x.ten_hang,
        sl_xuat: x.sl,
        don_gia_xuat: x.don_gia,
        phieu_nhap_item_id: k.nhap.id,
        phieu_nhap_id: k.nhap.phieu_nhap_id,
        so_phieu_nhap: k.nhap.so_phieu,
        ngay_nhap: k.nhap.ngay,
        sl_nhap: k.nhap.sl,
        don_gia_nhap: k.nhap.don_gia,
        muc: k.muc,
      });
    } else {
      khongGhep.push({
        xuat_item_id: x.id,
        phieu_xuat_id: x.phieu_xuat_id,
        so_phieu_xuat: x.so_phieu,
        ngay_xuat: x.ngay,
        ten_hang: x.ten_hang,
        sl_xuat: x.sl,
        don_gia_xuat: x.don_gia,
        ly_do: x.vat_tu_id ? 'không có dòng nhập phù hợp (cùng vật tư, đơn giá, ngày nhập <= ngày xuất, còn đủ số lượng)' : 'dòng xuất không gắn vật tư',
      });
    }
  }

  return {
    tong_xem_xet: dongXuat.length,
    ghep_duoc: ghep.length,
    khong_ghep_duoc: khongGhep.length,
    ghep,
    khong_ghep: khongGhep,
  };
}

module.exports = {
  ghepXuatVoiNhap,
  chuanHoaNguonKinhPhi,
  laNguonKinhPhiHopLe,
  chuoiHoacNull,
  NGUON_KINH_PHI_HOP_LE,
};
