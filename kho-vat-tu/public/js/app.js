// ===== Tiện ích chung =====
function formatSo(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return Number(n).toLocaleString('vi-VN');
}
// Chống chèn mã HTML khi đưa dữ liệu vào chuỗi mẫu.
function esc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// 2026-10-15 -> 15/10/2026 (giữ nguyên nếu không đúng dạng).
function ngayVN(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || '');
}
async function goiApi(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || (res.status === 404 ? 'Chức năng này chưa sẵn sàng trên máy chủ (lỗi 404).' : 'Lỗi không xác định');
    throw Object.assign(new Error(msg), { data, status: res.status });
  }
  return data;
}
function hienLoi(el, noiDung) {
  if (!noiDung) {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>${noiDung}</span>`;
}
function oTrong(colspan, bieuTuong, noiDung) {
  return `<tr><td colspan="${colspan}"><div class="ui-empty"><i class="fas fa-${bieuTuong}"></i>${noiDung}</div></td></tr>`;
}
function val(id) {
  return document.getElementById(id).value.trim();
}
function hienToast(noiDung, loi) {
  const goc = document.getElementById('toast-goc');
  const el = document.createElement('div');
  el.className = 'ui-toast' + (loi ? ' loi' : '');
  el.textContent = noiDung;
  goc.appendChild(el);
  setTimeout(() => el.remove(), loi ? 7000 : 3500); // lỗi dài (vd. 409 khi xóa) cần thêm thời gian đọc
}
// Tiền đồng: làm tròn, không hiện số lẻ.
function formatTien(n) {
  return formatSo(Math.round(Number(n)));
}
function pillNguon(nguon) {
  const n = String(nguon || '661.2').replace(/^TK\s*/i, '');
  return `<span class="ui-pill ${n === '337' ? 'ui-tone-warning' : 'ui-tone-primary'}" title="Nguồn kinh phí">TK ${esc(n)}</span>`;
}
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ===== Chuyển tab (menu bên) =====
document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => chuyenTab(btn.dataset.tab));
});
document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => chuyenTab(btn.dataset.goto));
});
// Nhóm "Tạo phiếu": phiếu nhập mới, phiếu xuất mới và cấu hình mẫu phiếu dùng chung 1 mục menu + 1 thanh chuyển.
// Nút "Cấu hình mẫu phiếu" nằm trên thanh của từng loại phiếu và mở đúng mẫu của loại phiếu đó.
const TAB_TAO_PHIEU = ['tao-nhap', 'tao-xuat', 'cau-hinh-nhap', 'cau-hinh-xuat'];
document.querySelectorAll('.tao-phieu-bar').forEach((bar) => {
  const loai = bar.dataset.loai || (bar.closest('.page').id === 'tao-xuat' ? 'xuat' : 'nhap');
  bar.innerHTML = `
    <div class="seg">
      <button type="button" class="seg-item" data-seg="tao-nhap"><i class="fas fa-truck-ramp-box"></i> Phiếu nhập</button>
      <button type="button" class="seg-item" data-seg="tao-xuat"><i class="fas fa-truck-fast"></i> Phiếu xuất</button>
    </div>
    <button type="button" class="btn btn-neutral btn-sm" data-seg-cau-hinh="cau-hinh-${loai}"><i class="fas fa-gear"></i> Cấu hình mẫu phiếu ${loai === 'nhap' ? 'nhập' : 'xuất'}</button>`;
  bar.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => chuyenTab(b.dataset.seg)));
  bar.querySelector('[data-seg-cau-hinh]').addEventListener('click', (e) => chuyenTab(e.currentTarget.dataset.segCauHinh));
});
function chuyenTab(tab) {
  document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach((b) => {
    b.classList.toggle('active', b.dataset.nhom === 'tao-phieu' ? TAB_TAO_PHIEU.includes(tab) : b.dataset.tab === tab);
  });
  const loaiDangMo = tab.endsWith('-xuat') ? 'xuat' : 'nhap';
  document.querySelectorAll('.tao-phieu-bar [data-seg]').forEach((b) => b.classList.toggle('active', b.dataset.seg === `tao-${loaiDangMo}`));
  document.querySelectorAll('.tao-phieu-bar [data-seg-cau-hinh]').forEach((b) => b.classList.toggle('active', b.dataset.segCauHinh === tab));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === tab));
  if (tab === 'ton-kho') taiTonKho();
  if (tab === 'phieu-nhap') taiDanhSachPhieuNhap();
  if (tab === 'phieu-xuat') taiDanhSachPhieuXuat();
  if (tab === 'tao-xuat') {
    taiDanhSachVatTuChoXuat();
    taiDanhSachPhieuNhapChoChon('px-chon-phieu-nhap');
  }
  if (tab === 'tach-xuat') taiDanhSachPhieuNhapChoChon('tx-phieu-nhap');
  if (tab === 'so-tong-hop') khoiTaoSoTongHop();
  if (tab === 'cau-hinh-nhap') taiCauHinh('nhap');
  if (tab === 'cau-hinh-xuat') taiCauHinh('xuat');
}

// ===== Khối "Thông tin bổ sung" (details) =====
// Mở khối => trang có lớp .mo-bo-sung để bảng dòng hàng hiện thêm các cột phụ.
document.querySelectorAll('details.ui-fold').forEach((d) => {
  d.addEventListener('toggle', () => d.closest('.page').classList.toggle('mo-bo-sung', d.open));
});
// Tóm tắt ngắn ngay trên tiêu đề khối để người dùng biết bên trong đã có gì.
function capNhatTomTat(tienTo) {
  const el = document.getElementById(tienTo + '-tom-tat');
  if (!el) return;
  const nguon = document.getElementById(tienTo + '-nguon-kinh-phi').value;
  const tk = val(tienTo + '-tk-doi-ung');
  const tm = val(tienTo + '-tieu-muc');
  const phan = [`Nguồn ${nguon}`];
  if (tk) phan.push(`TK đối ứng ${tk}`);
  if (tm) phan.push(`Tiểu mục ${tm}`);
  el.textContent = '· ' + phan.join(' · ');
}
['pn', 'px', 'tx'].forEach((t) => {
  ['tk-doi-ung', 'tieu-muc', 'nguon-kinh-phi'].forEach((f) => {
    const el = document.getElementById(`${t}-${f}`);
    el.addEventListener('input', () => capNhatTomTat(t));
    el.addEventListener('change', () => capNhatTomTat(t));
  });
  capNhatTomTat(t);
});
function datSoSach(tienTo, nguon) {
  document.getElementById(tienTo + '-tk-doi-ung').value = (nguon && nguon.tk_doi_ung) || '';
  document.getElementById(tienTo + '-tieu-muc').value = (nguon && nguon.tieu_muc) || '';
  document.getElementById(tienTo + '-nguon-kinh-phi').value = (nguon && nguon.nguon_kinh_phi) === '337' ? '337' : '661.2';
  capNhatTomTat(tienTo);
}

// ===== TỒN KHO =====
async function taiTonKho() {
  const tbody = document.getElementById('bang-ton-kho');
  tbody.innerHTML = oTrong(5, 'spinner', 'Đang tải...');
  const rows = await goiApi('/api/vat-tu');
  if (rows.length === 0) {
    tbody.innerHTML = oTrong(5, 'box-open', 'Chưa có vật tư nào. Tạo phiếu nhập đầu tiên để bắt đầu.');
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    let nhan = '<span class="ui-pill ui-tone-primary">Đủ</span>';
    if (r.ton_kho < 0) nhan = '<span class="ui-pill ui-tone-danger">Âm kho!</span>';
    else if (r.ton_kho === 0) nhan = '<span class="ui-pill ui-tone-warning">Hết</span>';
    tr.innerHTML = `
      <td>${esc(r.ten_hang)}</td>
      <td>${esc(r.dvt)}</td>
      <td class="num">${formatSo(r.tong_nhap)}</td>
      <td class="num">${formatSo(r.tong_xuat)}</td>
      <td class="num">${formatSo(r.ton_kho)} ${nhan}</td>`;
    tbody.appendChild(tr);
  });
}

// ===== DANH SÁCH PHIẾU NHẬP / XUẤT =====
function nutHanhDong(loai, r) {
  return `
    <div class="ds-nut">
      <button class="btn btn-sm btn-secondary" data-so-sach="${loai}:${r.id}" type="button" title="Xem và sửa thông tin sổ sách (TK đối ứng, tiểu mục, nguồn kinh phí)"><i class="fas fa-book"></i> Sổ sách</button>
      <a class="btn btn-sm btn-neutral" href="/api/phieu-${loai}/${r.id}/xuat-excel" title="Xuất phiếu ra Excel"><i class="fas fa-file-excel"></i> Excel</a>
      <button class="btn btn-sm btn-danger" data-xoa-${loai}="${r.id}" type="button" title="Xóa phiếu"><i class="fas fa-trash"></i></button>
    </div>`;
}
function ganNutSoSach(tbody) {
  tbody.querySelectorAll('[data-so-sach]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const [loai, id] = btn.dataset.soSach.split(':');
      moSoSach(loai, id);
    })
  );
}

async function taiDanhSachPhieuNhap() {
  const tbody = document.getElementById('bang-phieu-nhap');
  tbody.innerHTML = oTrong(7, 'spinner', 'Đang tải...');
  const rows = await goiApi('/api/phieu-nhap');
  if (rows.length === 0) {
    tbody.innerHTML = oTrong(7, 'inbox', 'Chưa có phiếu nhập nào.');
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ui-strong ds-so">${esc(r.so_phieu)}<span class="ds-sub">${esc(r.so_dong)} dòng</span></td>
      <td>${esc(ngayVN(r.ngay))}</td><td>${esc(r.nha_cung_cap)}</td>
      <td>${esc(r.nguoi_nhap)}</td><td>${pillNguon(r.nguon_kinh_phi)}</td>
      <td class="num ui-strong">${formatTien(r.tong_cong)}</td>
      <td class="ds-nut-cell">${nutHanhDong('nhap', r)}</td>`;
    tbody.appendChild(tr);
  });
  ganNutSoSach(tbody);
  tbody.querySelectorAll('[data-xoa-nhap]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu nhập này? Tồn kho sẽ giảm tương ứng.')) return;
      try {
        await goiApi('/api/phieu-nhap/' + btn.dataset.xoaNhap, { method: 'DELETE' });
        hienToast('Đã xóa phiếu nhập.');
      } catch (err) {
        hienToast(err.message, true);
      }
      taiDanhSachPhieuNhap();
    })
  );
}

async function taiDanhSachPhieuXuat() {
  const tbody = document.getElementById('bang-phieu-xuat');
  tbody.innerHTML = oTrong(7, 'spinner', 'Đang tải...');
  const rows = await goiApi('/api/phieu-xuat');
  if (rows.length === 0) {
    tbody.innerHTML = oTrong(7, 'inbox', 'Chưa có phiếu xuất nào.');
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="ui-strong ds-so">${esc(r.so_phieu)}<span class="ds-sub">${esc(r.so_dong)} dòng</span></td>
      <td>${esc(ngayVN(r.ngay))}</td><td>${esc(r.nguoi_nhan)}</td>
      <td class="ds-cell-cat" title="${esc(r.ly_do_xuat)}">${esc(r.ly_do_xuat)}</td>
      <td>${pillNguon(r.nguon_kinh_phi)}</td>
      <td class="num ui-strong">${formatTien(r.tong_cong)}</td>
      <td class="ds-nut-cell">${nutHanhDong('xuat', r)}</td>`;
    tbody.appendChild(tr);
  });
  ganNutSoSach(tbody);
  tbody.querySelectorAll('[data-xoa-xuat]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu xuất này? Tồn kho sẽ tăng lại tương ứng.')) return;
      try {
        await goiApi('/api/phieu-xuat/' + btn.dataset.xoaXuat, { method: 'DELETE' });
        hienToast('Đã xóa phiếu xuất.');
      } catch (err) {
        hienToast(err.message, true);
      }
      taiDanhSachPhieuXuat();
    })
  );
}

// ===== HỘP THOẠI "SỔ SÁCH" (xem & sửa riêng thông tin sổ sách của phiếu đã lưu) =====
let dongHopThoai = null;
function dongDialog() {
  const goc = document.getElementById('dialog-goc');
  goc.innerHTML = '';
  if (dongHopThoai) { document.removeEventListener('keydown', dongHopThoai); dongHopThoai = null; }
}
function moDialog(tieuDe, phuDe, thanBody, chanBody) {
  dongDialog();
  const goc = document.getElementById('dialog-goc');
  goc.innerHTML = `
    <div class="ui-dialog" data-dong-nen>
      <div class="ui-dialog-box" role="dialog" aria-modal="true" aria-labelledby="dlg-tieu-de">
        <div class="ui-dialog-head">
          <div><h2 id="dlg-tieu-de">${tieuDe}</h2><p>${phuDe}</p></div>
          <button class="btn btn-ghost btn-sm" type="button" data-dong aria-label="Đóng"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="ui-dialog-body">${thanBody}</div>
        <div class="ui-dialog-foot">${chanBody}</div>
      </div>
    </div>`;
  goc.querySelector('[data-dong]').addEventListener('click', dongDialog);
  goc.querySelector('[data-dong-nen]').addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) dongDialog(); });
  dongHopThoai = (e) => { if (e.key === 'Escape') dongDialog(); };
  document.addEventListener('keydown', dongHopThoai);
  return goc;
}

async function moSoSach(loai, id) {
  const laNhap = loai === 'nhap';
  let phieu;
  try {
    phieu = await goiApi(`/api/phieu-${loai}/${id}`);
  } catch (err) {
    hienToast('Không tải được phiếu: ' + err.message, true);
    return;
  }
  const items = phieu.items || [];
  const ten = laNhap ? 'phiếu nhập' : 'phiếu xuất';
  const ai = laNhap ? phieu.nha_cung_cap : phieu.nguoi_nhan;
  const phuDe = [phieu.so_phieu || '(không số)', ngayVN(phieu.ngay), ai].filter(Boolean).map(esc).join(' · ');
  const slKey = laNhap ? 'sl_thuc_nhap' : 'sl_thuc_xuat';
  const dong = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.ten_hang)}${laNhap ? '' : (it.phieu_nhap_item_id
        ? ' <span class="ui-pill ui-tone-primary" title="Đã ghép với dòng nhập">Đã ghép</span>'
        : ' <span class="ui-pill ui-tone-warning" title="Chưa biết dòng nhập tương ứng">Chưa ghép</span>')}</td>
      <td class="num">${formatSo(it[slKey])} ${esc(it.dvt)}</td>
      <td><input class="ui-input cell text w-tm" data-ss-dong="${i}" value="${esc(it.tieu_muc)}" placeholder="theo phiếu" aria-label="Tiểu mục dòng ${i + 1}" /></td>
    </tr>`).join('');
  const goc = moDialog(
    `Sổ sách — ${ten}`, phuDe,
    `<div class="ui-form-grid">
       <div class="ui-field">TK đối ứng<input id="ss-tk-doi-ung" class="ui-input" value="${esc(phieu.tk_doi_ung)}" /></div>
       <div class="ui-field">Tiểu mục (cả phiếu)<input id="ss-tieu-muc" class="ui-input" value="${esc(phieu.tieu_muc)}" /></div>
       <div class="ui-field">Nguồn kinh phí
         <select id="ss-nguon" class="ui-input"><option value="661.2">TK 661.2</option><option value="337">TK 337</option></select>
       </div>
     </div>
     <div>
       <div class="ui-statbar">Tiểu mục từng dòng hàng — để trống nghĩa là theo tiểu mục của cả phiếu.</div>
       <div class="ui-table-scroll"><table class="ui-table ui-table-dong">
         <thead><tr><th>STT</th><th>Tên hàng</th><th class="num">Số lượng</th><th>Tiểu mục</th></tr></thead>
         <tbody>${dong || oTrong(4, 'list', 'Phiếu chưa có dòng hàng.')}</tbody>
       </table></div>
     </div>
     <div id="ss-loi" class="ui-note danger" style="display:none"></div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Hủy</button>
     <button class="btn btn-primary" type="button" id="ss-luu"><i class="fas fa-floppy-disk"></i> Lưu sổ sách</button>`
  );
  goc.querySelector('.ui-dialog-foot [data-dong]').addEventListener('click', dongDialog);
  document.getElementById('ss-nguon').value = phieu.nguon_kinh_phi === '337' ? '337' : '661.2';
  document.getElementById('ss-tk-doi-ung').focus();

  document.getElementById('ss-luu').addEventListener('click', async () => {
    const loiEl = document.getElementById('ss-loi');
    hienLoi(loiEl, '');
    const nutLuu = document.getElementById('ss-luu');
    nutLuu.disabled = true;
    const body = {
      tk_doi_ung: val('ss-tk-doi-ung'),
      tieu_muc: val('ss-tieu-muc'),
      nguon_kinh_phi: document.getElementById('ss-nguon').value,
      items: items.map((it, i) => {
        const o = { id: it.id, tieu_muc: goc.querySelector(`[data-ss-dong="${i}"]`).value.trim() };
        if (!laNhap && it.phieu_nhap_item_id) o.phieu_nhap_item_id = it.phieu_nhap_item_id;
        return o;
      }),
    };
    try {
      await goiApi(`/api/phieu-${loai}/${id}/so-sach`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
      dongDialog();
      hienToast('Đã lưu thông tin sổ sách.');
      if (laNhap) taiDanhSachPhieuNhap(); else taiDanhSachPhieuXuat();
    } catch (err) {
      nutLuu.disabled = false;
      hienLoi(loiEl, esc(err.message));
    }
  });
}

// ===== TẠO PHIẾU NHẬP =====
let dongNhap = [];

function dongNhapMoi(du = {}) {
  return {
    ten_hang: du.ten_hang || '',
    ma_so: du.ma_so || '',
    dvt: du.dvt || '',
    sl_chung_tu: du.sl_chung_tu ?? '',
    sl_thuc_nhap: du.sl_thuc_nhap ?? '',
    don_gia: du.don_gia ?? '',
    tieu_muc: du.tieu_muc || '',
  };
}

function veBangDongNhap() {
  const tbody = document.getElementById('bang-dong-nhap');
  if (dongNhap.length === 0) {
    tbody.innerHTML = oTrong(10, 'list', 'Chưa có dòng hàng hóa nào. Tải hóa đơn PDF hoặc bấm "Thêm dòng".');
    return;
  }
  tbody.innerHTML = '';
  dongNhap.forEach((d, i) => {
    const thanhTien = (Number(d.sl_thuc_nhap) || 0) * (Number(d.don_gia) || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input class="ui-input cell text w-ten" data-i="${i}" data-f="ten_hang" value="${esc(d.ten_hang)}" aria-label="Tên hàng" /></td>
      <td class="col-bs"><input class="ui-input cell text w-56" data-i="${i}" data-f="ma_so" value="${esc(d.ma_so)}" aria-label="Mã số" /></td>
      <td><input class="ui-input cell text w-56" data-i="${i}" data-f="dvt" value="${esc(d.dvt)}" aria-label="Đơn vị tính" /></td>
      <td class="col-bs"><input class="ui-input cell w-72" data-i="${i}" data-f="sl_chung_tu" type="number" value="${esc(d.sl_chung_tu)}" aria-label="SL chứng từ" /></td>
      <td><input class="ui-input cell w-72" data-i="${i}" data-f="sl_thuc_nhap" type="number" value="${esc(d.sl_thuc_nhap)}" aria-label="SL thực nhập" /></td>
      <td><input class="ui-input cell w-96" data-i="${i}" data-f="don_gia" type="number" value="${esc(d.don_gia)}" aria-label="Đơn giá" /></td>
      <td class="num" data-tt>${formatTien(thanhTien)}</td>
      <td class="col-bs"><input class="ui-input cell text w-tm" data-i="${i}" data-f="tieu_muc" value="${esc(d.tieu_muc)}" placeholder="theo phiếu" aria-label="Tiểu mục dòng hàng" /></td>
      <td><button class="btn btn-ghost btn-sm" data-xoa="${i}" type="button" aria-label="Xóa dòng"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;
      dongNhap[i][f] = e.target.value;
      if (f === 'sl_thuc_nhap' || f === 'don_gia') {
        // Chỉ cập nhật ô thành tiền, không vẽ lại cả bảng (tránh mất con trỏ khi đang gõ).
        const tt = (Number(dongNhap[i].sl_thuc_nhap) || 0) * (Number(dongNhap[i].don_gia) || 0);
        tbody.children[i].querySelector('[data-tt]').textContent = formatTien(tt);
        capNhatTongNhap();
      }
    })
  );
  tbody.querySelectorAll('[data-xoa]').forEach((btn) =>
    btn.addEventListener('click', () => {
      dongNhap.splice(Number(btn.dataset.xoa), 1);
      veBangDongNhap();
      capNhatTongNhap();
    })
  );
}

function capNhatTongNhap() {
  const tongHang = dongNhap.reduce((s, d) => s + (Number(d.sl_thuc_nhap) || 0) * (Number(d.don_gia) || 0), 0);
  const thueSuat = Number(document.getElementById('pn-thue-suat').value) || 0;
  const tienThue = Math.round((tongHang * thueSuat) / 100);
  document.getElementById('pn-tong-hang').textContent = formatTien(tongHang);
  document.getElementById('pn-thue-hien').textContent = formatSo(thueSuat) || '0';
  document.getElementById('pn-tien-thue').textContent = formatTien(tienThue);
  document.getElementById('pn-tong-cong').textContent = formatTien(tongHang + tienThue);
}

document.getElementById('them-dong-nhap').addEventListener('click', () => {
  dongNhap.push(dongNhapMoi());
  veBangDongNhap();
});
document.getElementById('pn-thue-suat').addEventListener('input', capNhatTongNhap);

document.getElementById('luu-phieu-nhap').addEventListener('click', async () => {
  const loiEl = document.getElementById('pn-loi');
  hienLoi(loiEl, '');
  const items = dongNhap.filter((d) => d.ten_hang && Number(d.sl_thuc_nhap) > 0);
  if (items.length === 0) {
    hienLoi(loiEl, 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực nhập > 0.');
    return;
  }
  const body = {
    so_phieu: val('pn-so-phieu'),
    ngay: val('pn-ngay'),
    no_tk: val('pn-no-tk'),
    co_tk: val('pn-co-tk'),
    tk_doi_ung: val('pn-tk-doi-ung'),
    tieu_muc: val('pn-tieu-muc'),
    nguon_kinh_phi: document.getElementById('pn-nguon-kinh-phi').value,
    nguoi_nhap: val('pn-nguoi-nhap'),
    don_vi: val('pn-don-vi'),
    ly_do_nhap: val('pn-ly-do'),
    nhap_tai_kho: val('pn-nhap-tai-kho'),
    dia_diem: val('pn-dia-diem'),
    so_chung_tu_goc: val('pn-chung-tu'),
    nha_cung_cap: val('pn-nha-cung-cap'),
    thue_suat: Number(val('pn-thue-suat')) || 0,
    items,
  };
  try {
    await goiApi('/api/phieu-nhap', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    hienToast('Đã lưu phiếu nhập kho.');
    dongNhap = [];
    veBangDongNhap();
    capNhatTongNhap();
    ['pn-so-phieu','pn-ngay','pn-nha-cung-cap','pn-no-tk','pn-co-tk','pn-chung-tu','pn-nguoi-nhap','pn-don-vi','pn-nhap-tai-kho','pn-ly-do','pn-dia-diem']
      .forEach((id) => (document.getElementById(id).value = ''));
    datSoSach('pn', null);
    document.getElementById('upload-canh-bao').innerHTML = '';
    chuyenTab('phieu-nhap');
  } catch (err) {
    hienLoi(loiEl, esc(err.message));
  }
});

// ===== UPLOAD PDF HÓA ĐƠN =====
const uploadVung = document.getElementById('upload-vung');
const inputPdf = document.getElementById('input-pdf');
uploadVung.addEventListener('click', () => inputPdf.click());
uploadVung.addEventListener('dragover', (e) => { e.preventDefault(); uploadVung.classList.add('keo-tha'); });
uploadVung.addEventListener('dragleave', () => uploadVung.classList.remove('keo-tha'));
uploadVung.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadVung.classList.remove('keo-tha');
  if (e.dataTransfer.files[0]) xuLyFilePdf(e.dataTransfer.files[0]);
});
inputPdf.addEventListener('change', () => {
  if (inputPdf.files[0]) xuLyFilePdf(inputPdf.files[0]);
});

function dongCanhBao(noiDung, nguy) {
  return `<div class="ui-note${nguy ? ' danger' : ''}"><i class="fas fa-${nguy ? 'circle-exclamation' : 'triangle-exclamation'}"></i><span>${noiDung}</span></div>`;
}

async function xuLyFilePdf(file) {
  const canhBaoEl = document.getElementById('upload-canh-bao');
  canhBaoEl.innerHTML = dongCanhBao('Đang đọc file ' + esc(file.name) + '...', false);
  const form = new FormData();
  form.append('file', file);
  try {
    const kq = await goiApi('/api/upload/hoa-don', { method: 'POST', body: form });
    canhBaoEl.innerHTML = '';
    if (kq.truongLaNguoiBan) {
      canhBaoEl.innerHTML += dongCanhBao('Hóa đơn này có vẻ do Trường xuất ra (bán), không phải hóa đơn mua vào. Kiểm tra kỹ trước khi lưu.', true);
    }
    (kq.warnings || []).forEach((w) => { canhBaoEl.innerHTML += dongCanhBao(esc(w), false); });

    document.getElementById('pn-ngay').value = kq.ngay || '';
    document.getElementById('pn-nha-cung-cap').value = kq.tenNguoiBan || '';
    document.getElementById('pn-chung-tu').value = kq.kyHieu && kq.soHoaDon
      ? `01 Hóa đơn GTGT ký hiệu ${kq.kyHieu} số ${kq.soHoaDon}` : '';
    // Thuế suất do parser xác định (1 mức; nếu hóa đơn nhiều mức thì là thuế suất bình quân). Hóa đơn
    // không in thuế suất → mặc định 8%.
    document.getElementById('pn-thue-suat').value = kq.thueSuat != null ? kq.thueSuat : 8;

    // don_gia_khop: đơn giá tính lại (thành tiền ÷ số lượng) khi hóa đơn in đơn giá đã làm tròn,
    // để thành tiền trên phiếu = thành tiền trên hóa đơn.
    dongNhap = (kq.items || []).map((it) =>
      dongNhapMoi({
        ten_hang: it.ten_hang, dvt: it.dvt,
        sl_chung_tu: it.sl_chung_tu, sl_thuc_nhap: it.sl_thuc_nhap,
        don_gia: it.don_gia_khop !== undefined ? it.don_gia_khop : it.don_gia,
      })
    );
    if (dongNhap.length === 0) dongNhap.push(dongNhapMoi());
    veBangDongNhap();
    capNhatTongNhap();

    // Đối chiếu tổng cộng của phiếu (tính như khi lưu: làm tròn từng dòng, rồi làm tròn thuế) với hóa đơn gốc.
    if (kq.tongCong) {
      const tongHang = dongNhap.reduce((s, d) => s + Math.round((Number(d.sl_thuc_nhap) || 0) * (Number(d.don_gia) || 0)), 0);
      const tongCongPhieu = tongHang + Math.round((tongHang * (Number(document.getElementById('pn-thue-suat').value) || 0)) / 100);
      const lech = tongCongPhieu - kq.tongCong;
      const dongTong = `Tổng cộng trên hóa đơn gốc: <b>${formatSo(kq.tongCong)}</b>; tổng cộng trên phiếu: <b>${formatSo(tongCongPhieu)}</b>`;
      if (lech === 0) {
        canhBaoEl.innerHTML += dongCanhBao(`${dongTong} — khớp.`, false);
      } else if (Math.abs(lech) <= 5) {
        canhBaoEl.innerHTML += dongCanhBao(`${dongTong} — lệch ${formatSo(lech)} đồng do làm tròn thuế, chấp nhận được.`, false);
      } else {
        canhBaoEl.innerHTML += dongCanhBao(`${dongTong} — LỆCH ${formatSo(lech)} đồng, hãy đối chiếu từng dòng hàng với hóa đơn trước khi lưu.`, true);
      }
    }
  } catch (err) {
    canhBaoEl.innerHTML = dongCanhBao('Lỗi đọc file: ' + esc(err.message), true);
  }
}

// ===== TẠO PHIẾU XUẤT =====
let dongXuat = [];
let dsVatTu = [];

async function taiDanhSachVatTuChoXuat() {
  dsVatTu = await goiApi('/api/vat-tu');
  let datalist = document.getElementById('ds-vat-tu');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'ds-vat-tu';
    document.body.appendChild(datalist);
  }
  datalist.innerHTML = dsVatTu.map((v) => `<option value="${esc(v.ten_hang)}">`).join('');
}

function dongXuatMoi(du = {}) {
  return {
    vat_tu_id: du.vat_tu_id || null,
    phieu_nhap_item_id: du.phieu_nhap_item_id || null,
    ten_hang: du.ten_hang || '',
    dvt: du.dvt || '',
    sl_yeu_cau: du.sl_yeu_cau ?? '',
    sl_thuc_xuat: du.sl_thuc_xuat ?? '',
    don_gia: du.don_gia ?? '',
    tieu_muc: du.tieu_muc || '',
  };
}

// Cập nhật tồn kho / thành tiền / cảnh báo vượt tồn của 1 dòng xuất mà không vẽ lại bảng.
function capNhatDongXuatUI(i) {
  const tr = document.getElementById('bang-dong-xuat').children[i];
  if (!tr) return;
  const d = dongXuat[i];
  const vatTu = dsVatTu.find((v) => v.ten_hang === d.ten_hang);
  const ton = vatTu ? vatTu.ton_kho : null;
  const thanhTien = (Number(d.sl_thuc_xuat) || 0) * (Number(d.don_gia) || 0);
  tr.classList.toggle('is-danger', ton !== null && Number(d.sl_thuc_xuat) > ton);
  tr.querySelector('[data-ton]').textContent = ton === null ? '—' : formatSo(ton);
  tr.querySelector('[data-tt]').textContent = formatTien(thanhTien);
}

function veBangDongXuat() {
  const tbody = document.getElementById('bang-dong-xuat');
  if (dongXuat.length === 0) {
    tbody.innerHTML = oTrong(10, 'list', 'Chưa có dòng hàng hóa nào. Bấm "Thêm dòng" và chọn vật tư từ tồn kho.');
    return;
  }
  tbody.innerHTML = '';
  dongXuat.forEach((d, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input class="ui-input cell text w-ten" list="ds-vat-tu" data-i="${i}" data-f="ten_hang" value="${esc(d.ten_hang)}" aria-label="Vật tư" /></td>
      <td><input class="ui-input cell text w-56" data-i="${i}" data-f="dvt" value="${esc(d.dvt)}" aria-label="Đơn vị tính" /></td>
      <td class="num" data-ton>—</td>
      <td class="col-bs"><input class="ui-input cell w-72" data-i="${i}" data-f="sl_yeu_cau" type="number" value="${esc(d.sl_yeu_cau)}" aria-label="SL yêu cầu" /></td>
      <td><input class="ui-input cell w-72" data-i="${i}" data-f="sl_thuc_xuat" type="number" value="${esc(d.sl_thuc_xuat)}" aria-label="SL thực xuất" /></td>
      <td><input class="ui-input cell w-96" data-i="${i}" data-f="don_gia" type="number" value="${esc(d.don_gia)}" aria-label="Đơn giá" /></td>
      <td class="num" data-tt>0</td>
      <td class="col-bs"><input class="ui-input cell text w-tm" data-i="${i}" data-f="tieu_muc" value="${esc(d.tieu_muc)}" placeholder="theo phiếu" aria-label="Tiểu mục dòng hàng" /></td>
      <td><button class="btn btn-ghost btn-sm" data-xoa="${i}" type="button" aria-label="Xóa dòng"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
    capNhatDongXuatUI(i);
  });
  tbody.querySelectorAll('input').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;
      dongXuat[i][f] = e.target.value;
      if (f === 'ten_hang') {
        const vatTu = dsVatTu.find((v) => v.ten_hang === e.target.value);
        if (vatTu) {
          dongXuat[i].vat_tu_id = vatTu.id;
          dongXuat[i].dvt = vatTu.dvt || '';
          tbody.children[i].querySelector('[data-f="dvt"]').value = dongXuat[i].dvt;
        }
      }
      if (f === 'ten_hang' || f === 'sl_thuc_xuat' || f === 'don_gia') {
        capNhatDongXuatUI(i);
        capNhatTongXuat();
      }
    })
  );
  tbody.querySelectorAll('[data-xoa]').forEach((btn) =>
    btn.addEventListener('click', () => {
      dongXuat.splice(Number(btn.dataset.xoa), 1);
      veBangDongXuat();
      capNhatTongXuat();
    })
  );
}

function capNhatTongXuat() {
  const tongHang = dongXuat.reduce((s, d) => s + (Number(d.sl_thuc_xuat) || 0) * (Number(d.don_gia) || 0), 0);
  const thueSuat = Number(document.getElementById('px-thue-suat').value) || 0;
  const tienThue = Math.round((tongHang * thueSuat) / 100);
  document.getElementById('px-tong-hang').textContent = formatTien(tongHang);
  document.getElementById('px-thue-hien').textContent = formatSo(thueSuat) || '0';
  document.getElementById('px-tien-thue').textContent = formatTien(tienThue);
  document.getElementById('px-tong-cong').textContent = formatTien(tongHang + tienThue);
}

document.getElementById('them-dong-xuat').addEventListener('click', () => {
  dongXuat.push(dongXuatMoi());
  veBangDongXuat();
});
document.getElementById('px-thue-suat').addEventListener('input', capNhatTongXuat);

document.getElementById('luu-phieu-xuat').addEventListener('click', async () => {
  const loiEl = document.getElementById('px-loi');
  hienLoi(loiEl, '');
  const items = dongXuat
    .filter((d) => d.ten_hang && Number(d.sl_thuc_xuat) > 0)
    .map((d) => {
      const o = { ...d };
      if (!o.phieu_nhap_item_id) delete o.phieu_nhap_item_id;
      return o;
    });
  if (items.length === 0) {
    hienLoi(loiEl, 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực xuất > 0.');
    return;
  }
  const body = {
    so_phieu: val('px-so-phieu'),
    ngay: val('px-ngay'),
    no_tk: val('px-no-tk'),
    co_tk: val('px-co-tk'),
    tk_doi_ung: val('px-tk-doi-ung'),
    tieu_muc: val('px-tieu-muc'),
    nguon_kinh_phi: document.getElementById('px-nguon-kinh-phi').value,
    nguoi_nhan: val('px-nguoi-nhan'),
    don_vi: val('px-don-vi'),
    ly_do_xuat: val('px-ly-do'),
    xuat_tai_kho: val('px-xuat-tai-kho'),
    dia_diem: val('px-dia-diem'),
    so_chung_tu_goc: val('px-chung-tu'),
    thue_suat: Number(val('px-thue-suat')) || 0,
    items,
  };
  try {
    await goiApi('/api/phieu-xuat', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    hienToast('Đã lưu phiếu xuất kho.');
    dongXuat = [];
    veBangDongXuat();
    capNhatTongXuat();
    ['px-so-phieu','px-ngay','px-nguoi-nhan','px-no-tk','px-co-tk','px-don-vi','px-ly-do','px-xuat-tai-kho','px-dia-diem','px-chung-tu']
      .forEach((id) => (document.getElementById(id).value = ''));
    datSoSach('px', null);
    document.getElementById('px-chon-phieu-nhap').value = '';
    chuyenTab('phieu-xuat');
  } catch (err) {
    if (err.data && err.data.chi_tiet) {
      hienLoi(loiEl, 'Không đủ tồn kho:<br>' + err.data.chi_tiet
        .map((c) => `- ${esc(c.ten_hang)}: tồn ${formatSo(c.ton_kho)}, cần xuất ${formatSo(c.muon_xuat)}`)
        .join('<br>'));
    } else {
      hienLoi(loiEl, esc(err.message));
    }
  }
});

// ===== Chọn phiếu nhập để tự điền phiếu xuất =====
async function taiDanhSachPhieuNhapChoChon(idSelect) {
  const ds = await goiApi('/api/phieu-nhap');
  const sel = document.getElementById(idSelect);
  const dangChon = sel.value;
  sel.innerHTML = '<option value="">— Chọn phiếu nhập —</option>' +
    ds.map((p) => `<option value="${p.id}">${esc(p.so_phieu || '(không số)')} — ${esc(ngayVN(p.ngay))} — ${esc(p.nha_cung_cap)} (${p.so_dong} dòng)</option>`).join('');
  sel.value = dangChon;
}

document.getElementById('px-chon-phieu-nhap').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;
  const phieu = await goiApi('/api/phieu-nhap/' + id);
  document.getElementById('px-so-phieu').value = '';
  document.getElementById('px-nguoi-nhan').value = '';
  document.getElementById('px-don-vi').value = phieu.don_vi || '';
  document.getElementById('px-ly-do').value = `Xuất theo phiếu nhập ${phieu.so_phieu || '#' + phieu.id}`;
  document.getElementById('px-co-tk').value = phieu.no_tk || '';
  document.getElementById('px-chung-tu').value = phieu.so_phieu ? `Theo phiếu nhập ${phieu.so_phieu}` : '';
  datSoSach('px', phieu); // thừa hưởng TK đối ứng, tiểu mục, nguồn kinh phí từ phiếu nhập — vẫn sửa được
  dongXuat = (phieu.items || []).map((it) =>
    dongXuatMoi({
      vat_tu_id: it.vat_tu_id, phieu_nhap_item_id: it.id, ten_hang: it.ten_hang, dvt: it.dvt,
      sl_yeu_cau: it.sl_thuc_nhap, sl_thuc_xuat: it.sl_thuc_nhap, don_gia: it.don_gia, tieu_muc: it.tieu_muc,
    })
  );
  if (!dsVatTu.length) await taiDanhSachVatTuChoXuat();
  veBangDongXuat();
  capNhatTongXuat();
});

// ===== TÁCH PHIẾU NHẬP THÀNH NHIỀU PHIẾU XUẤT (bảng phân bổ linh hoạt) =====
let txItems = []; // dòng hàng của phiếu nhập đang chọn: {id, ten_hang, dvt, sl_thuc_nhap}
let txNhom = []; // mỗi phần tử = 1 phiếu xuất sẽ tạo: {nguoi_nhan, don_vi, so_phieu}
let txPhanBo = {}; // { [itemId]: [slNhom0, slNhom1, ...] } — luôn đồng bộ độ dài với txNhom

function txNhomMoi() {
  return { nguoi_nhan: '', don_vi: '', so_phieu: '' };
}

function txDongBoDoDaiPhanBo() {
  txItems.forEach((it) => {
    const mang = txPhanBo[it.id] || [];
    while (mang.length < txNhom.length) mang.push(0);
    mang.length = txNhom.length;
    txPhanBo[it.id] = mang;
  });
}

function veNhomList() {
  const el = document.getElementById('tx-nhom-list');
  if (txNhom.length === 0) {
    el.innerHTML = '<div class="ui-empty"><i class="fas fa-users"></i>Chưa có nhóm nào. Bấm "Thêm nhóm" để bắt đầu.</div>';
    return;
  }
  el.innerHTML = txNhom.map((n, i) => `
    <div class="ui-form-grid cot-2 tx-nhom">
      <div class="ui-field">Nhóm ${i + 1} — Người nhận<input class="ui-input" data-nhom="${i}" data-f="nguoi_nhan" value="${esc(n.nguoi_nhan)}" /></div>
      <div class="ui-field">Đơn vị<input class="ui-input" data-nhom="${i}" data-f="don_vi" value="${esc(n.don_vi)}" /></div>
      <div class="ui-field">Số phiếu<input class="ui-input" data-nhom="${i}" data-f="so_phieu" value="${esc(n.so_phieu)}" placeholder="PX 0${i + 1}" /></div>
      <div><button class="btn btn-ghost btn-sm" type="button" data-xoa-nhom="${i}"><i class="fas fa-trash"></i> Xóa nhóm</button></div>
    </div>`).join('');
  el.querySelectorAll('input').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      txNhom[Number(e.target.dataset.nhom)][e.target.dataset.f] = e.target.value;
    })
  );
  el.querySelectorAll('[data-xoa-nhom]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.xoaNhom);
      txNhom.splice(i, 1);
      txItems.forEach((it) => { if (txPhanBo[it.id]) txPhanBo[it.id].splice(i, 1); });
      veNhomList();
      veBangPhanBo();
    })
  );
}

function veBangPhanBo() {
  const bang = document.getElementById('tx-bang-phan-bo');
  if (txItems.length === 0) {
    bang.innerHTML = '<tr><td><div class="ui-empty"><i class="fas fa-inbox"></i>Chọn phiếu nhập ở trên để hiện danh sách hàng hóa.</div></td></tr>';
    return;
  }
  const dauNhom = txNhom.map((n, i) => `<th class="num">${esc(n.so_phieu || 'Nhóm ' + (i + 1))}</th>`).join('');
  const dong = txItems.map((it) => {
    const phanBo = txPhanBo[it.id] || [];
    const daChia = phanBo.reduce((s, v) => s + (Number(v) || 0), 0);
    const con = it.sl_thuc_nhap - daChia;
    const oNhom = txNhom.map((_, i) => `<td><input class="ui-input cell" type="number" min="0" data-item="${it.id}" data-nhom-idx="${i}" value="${phanBo[i] || 0}" aria-label="Số lượng nhóm ${i + 1}" /></td>`).join('');
    return `<tr data-row-item="${it.id}">
      <td>${esc(it.ten_hang)}</td><td>${esc(it.dvt)}</td><td class="num">${formatSo(it.sl_thuc_nhap)}</td>
      ${oNhom}
      <td class="num" data-o-da-chia>${chuoiDaChia(daChia, con)}</td>
    </tr>`;
  }).join('');
  bang.innerHTML = `
    <thead><tr><th>Tên hàng</th><th>ĐVT</th><th class="num">SL đã nhập</th>${dauNhom}<th class="num">Đã phân bổ</th></tr></thead>
    <tbody>${dong}</tbody>`;
  bang.querySelectorAll('input').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const itemId = e.target.dataset.item;
      const idx = Number(e.target.dataset.nhomIdx);
      if (!txPhanBo[itemId]) txPhanBo[itemId] = txNhom.map(() => 0);
      txPhanBo[itemId][idx] = Number(e.target.value) || 0;
      // Chỉ cập nhật ô "Đã phân bổ" của đúng dòng đó, không vẽ lại cả bảng — tránh mất focus khi đang gõ.
      const it = txItems.find((x) => String(x.id) === String(itemId));
      const daChia = (txPhanBo[itemId] || []).reduce((s, v) => s + (Number(v) || 0), 0);
      const tr = bang.querySelector(`tr[data-row-item="${itemId}"]`);
      if (tr && it) tr.querySelector('[data-o-da-chia]').innerHTML = chuoiDaChia(daChia, it.sl_thuc_nhap - daChia);
    })
  );
}

function chuoiDaChia(daChia, con) {
  return `${formatSo(daChia)}` + (con !== 0 ? ` <span class="tx-con">(còn ${formatSo(con)})</span>` : '');
}

document.getElementById('tx-them-nhom').addEventListener('click', () => {
  txNhom.push(txNhomMoi());
  txDongBoDoDaiPhanBo();
  veNhomList();
  veBangPhanBo();
});

document.getElementById('tx-chia-deu').addEventListener('click', () => {
  if (txNhom.length === 0) { txNhom.push(txNhomMoi(), txNhomMoi()); veNhomList(); }
  txDongBoDoDaiPhanBo();
  const n = txNhom.length;
  txItems.forEach((it) => {
    const phan = Math.floor(it.sl_thuc_nhap / n);
    let du = it.sl_thuc_nhap - phan * n;
    txPhanBo[it.id] = txNhom.map(() => {
      let sl = phan;
      if (du > 0) { sl += 1; du -= 1; }
      return sl;
    });
  });
  veBangPhanBo();
});

document.getElementById('tx-phieu-nhap').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) { txItems = []; veBangPhanBo(); return; }
  const phieu = await goiApi('/api/phieu-nhap/' + id);
  document.getElementById('tx-ly-do').value = `Xuất theo phiếu nhập ${phieu.so_phieu || '#' + phieu.id}`;
  datSoSach('tx', phieu); // mặc định thừa hưởng thông tin sổ sách của phiếu nhập, vẫn sửa được
  txItems = (phieu.items || []).map((it) => ({ id: it.id, ten_hang: it.ten_hang, dvt: it.dvt, sl_thuc_nhap: it.sl_thuc_nhap }));
  txPhanBo = {};
  txDongBoDoDaiPhanBo();
  veBangPhanBo();
});

document.getElementById('tx-tao-phieu').addEventListener('click', async () => {
  const loiEl = document.getElementById('tx-loi');
  const ketQuaEl = document.getElementById('tx-ket-qua');
  hienLoi(loiEl, '');
  ketQuaEl.style.display = 'none';

  const phieuNhapId = document.getElementById('tx-phieu-nhap').value;
  if (!phieuNhapId) { hienLoi(loiEl, 'Chưa chọn phiếu nhập cần tách.'); return; }
  if (txNhom.length === 0) { hienLoi(loiEl, 'Chưa có nhóm (phiếu xuất) nào — bấm "Thêm nhóm".'); return; }

  const body = {
    phieu_nhap_id: Number(phieuNhapId),
    nhom: txNhom,
    phan_bo: txPhanBo,
    ngay: document.getElementById('tx-ngay').value,
    co_tk: document.getElementById('tx-co-tk').value.trim(),
    tk_doi_ung: val('tx-tk-doi-ung'),
    tieu_muc: val('tx-tieu-muc'),
    nguon_kinh_phi: document.getElementById('tx-nguon-kinh-phi').value,
    thue_suat: Number(document.getElementById('tx-thue-suat').value) || 0,
    ly_do_xuat: document.getElementById('tx-ly-do').value.trim(),
    xuat_tai_kho: document.getElementById('tx-xuat-tai-kho').value.trim(),
    dia_diem: document.getElementById('tx-dia-diem').value.trim(),
  };

  try {
    const kq = await goiApi('/api/phieu-xuat/phan-bo', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    let html = `<i class="fas fa-circle-check"></i><span>Đã tạo ${kq.so_phieu_da_tao} phiếu xuất.</span>`;
    if (kq.canh_bao && kq.canh_bao.length) {
      html += '<br>' + kq.canh_bao.map((w) => `<i class="fas fa-triangle-exclamation"></i> ${esc(w)}`).join('<br>');
    }
    ketQuaEl.innerHTML = html;
    ketQuaEl.style.display = 'flex';
    document.getElementById('tx-phieu-nhap').value = '';
    datSoSach('tx', null);
    txItems = []; txNhom = []; txPhanBo = {};
    veNhomList(); veBangPhanBo();
  } catch (err) {
    if (err.data && err.data.chi_tiet) {
      hienLoi(loiEl, 'Không đủ tồn kho:<br>' + err.data.chi_tiet
        .map((c) => `- ${esc(c.ten_hang)}: tồn ${formatSo(c.ton_kho)}, cần xuất ${formatSo(c.muon_xuat)}`)
        .join('<br>'));
    } else {
      hienLoi(loiEl, esc(err.message));
    }
  }
});

veNhomList();
veBangPhanBo();

// ===== SỔ TỔNG HỢP NHẬP XUẤT =====
let thDaKhoiTao = false;
let thQuy = 1; // 1..4 hoặc 0 = cả năm

function datQuy(q) {
  thQuy = q;
  document.querySelectorAll('#th-quy button').forEach((b) => {
    const on = Number(b.dataset.quy) === q;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function khoiTaoSoTongHop() {
  if (thDaKhoiTao) return;
  thDaKhoiTao = true;
  const hom = new Date();
  document.getElementById('th-nam').value = hom.getFullYear();
  datQuy(Math.floor(hom.getMonth() / 3) + 1);
}
document.querySelectorAll('#th-quy button').forEach((b) =>
  b.addEventListener('click', () => datQuy(Number(b.dataset.quy)))
);

function thThamSo(choXuatExcel) {
  const nam = Number(document.getElementById('th-nam').value);
  if (!nam || nam < 2000 || nam > 2100) throw new Error('Năm không hợp lệ.');
  const p = new URLSearchParams();
  p.set('nam', nam);
  const cacQuy = choXuatExcel && document.getElementById('th-cac-quy').checked;
  if (cacQuy) p.set('cac_quy', '1');
  else if (thQuy) p.set('quy', thQuy);
  return { nam, qs: p.toString(), cacQuy };
}
function tenKy(nam) {
  return thQuy ? `Quý ${['I', 'II', 'III', 'IV'][thQuy - 1]} năm ${nam}` : `Cả năm ${nam}`;
}
// Số rỗng hoặc 0 thì để trống cho bảng gọn mắt.
function soTienHoacTrong(v) {
  return Number(v) ? formatTien(v) : '';
}
function soHoacTrong(v) {
  return Number(v) ? formatSo(v) : '';
}

document.getElementById('th-xem').addEventListener('click', async () => {
  const loiEl = document.getElementById('th-loi');
  const the = document.getElementById('th-the-ket-qua');
  hienLoi(loiEl, '');
  let tham;
  try { tham = thThamSo(false); } catch (err) { hienLoi(loiEl, esc(err.message)); return; }
  const nut = document.getElementById('th-xem');
  nut.disabled = true;
  try {
    const kq = await goiApi('/api/tong-hop/xem?' + tham.qs);
    veSoTongHop(kq, tham.nam);
  } catch (err) {
    the.style.display = 'none';
    hienLoi(loiEl, 'Không xem trước được: ' + esc(err.message));
  } finally {
    nut.disabled = false;
  }
});

function veSoTongHop(kq, nam) {
  // Chấp nhận cả dạng {rows, tong:{...}} lẫn dạng {dong, tong:{'661.2':{...}, '337':{...}}}.
  const rows = (kq && (kq.rows || kq.dong)) || [];
  const tong = (kq && kq.tong) || {};
  const canhBao = (kq && kq.canh_bao) || [];
  const tbody = document.getElementById('th-tbody');
  const tfoot = document.getElementById('th-tfoot');
  document.getElementById('th-the-ket-qua').style.display = '';
  document.getElementById('th-tieu-de').textContent = 'Sổ tổng hợp — ' + tenKy(nam);
  const cbEl = document.getElementById('th-canh-bao');
  if (canhBao.length) {
    cbEl.style.display = '';
    cbEl.innerHTML = `<summary><i class="fas fa-triangle-exclamation"></i> ${formatSo(canhBao.length)} lưu ý về dữ liệu (bấm để xem)</summary>
      <ul>${canhBao.slice(0, 50).map((c) => `<li>${c.dong ? 'Dòng ' + esc(c.dong) + ': ' : ''}${c.ten_hang ? '<b>' + esc(String(c.ten_hang).slice(0, 60)) + '</b> — ' : ''}${esc(c.noi_dung || c)}</li>`).join('')}</ul>`;
  } else {
    cbEl.style.display = 'none';
    cbEl.innerHTML = '';
  }
  if (rows.length === 0) {
    tbody.innerHTML = oTrong(14, 'book-open', 'Không có dòng nhập/xuất nào trong kỳ này.');
    tfoot.innerHTML = '';
    document.getElementById('th-thong-ke').textContent = '';
    return;
  }
  const tongCong = (khoa) => {
    if (tong[khoa] !== undefined && tong[khoa] !== null && typeof tong[khoa] !== 'object') return Number(tong[khoa]) || 0;
    const nhom = Object.values(tong).filter((v) => v && typeof v === 'object' && khoa in v);
    if (nhom.length) return nhom.reduce((s, v) => s + (Number(v[khoa]) || 0), 0);
    return rows.reduce((s, r) => s + (Number(r[khoa]) || 0), 0);
  };
  const ttNhap = tongCong('tt_nhap');
  const ttXuat = tongCong('tt_xuat');
  tbody.innerHTML = rows.map((r) => {
    const cb = Array.isArray(r.canh_bao) && r.canh_bao.length
      ? `<i class="fas fa-triangle-exclamation th-cb" title="${esc(r.canh_bao.join(' '))}"></i> ` : '';
    return `
    <tr>
      <td class="th-nowrap">${esc(ngayVN(r.ngay_nhap))}</td>
      <td class="th-nowrap">${esc(r.so_phieu_nhap)}</td>
      <td class="th-ty th-ng" title="${esc(r.nguoi_nhap)}">${esc(r.nguoi_nhap)}</td>
      <td class="th-nowrap">${esc(ngayVN(r.ngay_xuat))}</td>
      <td class="th-nowrap">${esc(r.so_phieu_xuat)}</td>
      <td class="th-ty th-ng" title="${esc(r.nguoi_linh)}">${esc(r.nguoi_linh)}</td>
      <td class="th-ty" title="${esc(r.ten_hang)}">${cb}${esc(r.ten_hang)}</td>
      <td>${esc(r.dvt)}</td>
      <td>${r.nhom ? pillNguon(r.nhom) : ''}</td>
      <td class="num">${soHoacTrong(r.sl_nhap)}</td>
      <td class="num">${soHoacTrong(r.dg_nhap)}</td>
      <td class="num">${soTienHoacTrong(r.tt_nhap)}</td>
      <td class="num">${soHoacTrong(r.sl_xuat)}</td>
      <td class="num">${soTienHoacTrong(r.tt_xuat)}</td>
    </tr>`;
  }).join('');
  tfoot.innerHTML = `<tr><td colspan="11">Cộng (${formatSo(rows.length)} dòng)</td><td class="num">${formatTien(ttNhap)}</td><td></td><td class="num">${formatTien(ttXuat)}</td></tr>`;
  document.getElementById('th-thong-ke').innerHTML =
    `<span class="ui-statbar"><span>Tổng nhập: <b>${formatTien(ttNhap)}</b></span><span>Tổng xuất: <b>${formatTien(ttXuat)}</b></span><span>Chênh lệch (còn lại): <b>${formatTien(ttNhap - ttXuat)}</b></span></span>`;
}

document.getElementById('th-xuat').addEventListener('click', async () => {
  const loiEl = document.getElementById('th-loi');
  hienLoi(loiEl, '');
  let tham;
  try { tham = thThamSo(true); } catch (err) { hienLoi(loiEl, esc(err.message)); return; }
  const nut = document.getElementById('th-xuat');
  nut.disabled = true;
  try {
    const res = await fetch('/api/tong-hop/xuat-excel?' + tham.qs);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || (res.status === 404 ? 'Chức năng xuất Excel chưa sẵn sàng trên máy chủ (lỗi 404).' : 'Lỗi ' + res.status));
    }
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const ten = m ? decodeURIComponent(m[1]) : `SoTongHop_${tham.cacQuy ? '4quy' : (thQuy ? 'Q' + thQuy : 'canam')}_${tham.nam}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = ten;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    hienToast('Đã tải file ' + ten);
  } catch (err) {
    hienLoi(loiEl, 'Không xuất được Excel: ' + esc(err.message));
  } finally {
    nut.disabled = false;
  }
});

document.getElementById('th-ghep').addEventListener('click', async () => {
  if (!confirm('Tự động ghép các dòng xuất cũ với dòng nhập tương ứng? Thao tác chỉ bổ sung liên kết, không đổi số lượng hay tồn kho.')) return;
  const kqEl = document.getElementById('th-ghep-kq');
  const nut = document.getElementById('th-ghep');
  nut.disabled = true;
  kqEl.className = 'ui-note ok';
  try {
    const kq = await goiApi('/api/phieu-xuat/ghep-tu-dong', { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    const dem = (x) => (Array.isArray(x) ? x.length : Number(x) || 0);
    const ghep = dem(kq.ghep_duoc);
    const khong = dem(kq.khong_ghep_duoc);
    let html;
    if (!ghep && !khong) {
      html = '<i class="fas fa-circle-check"></i><span>Không có dòng xuất nào cần ghép thêm — dữ liệu đã đầy đủ liên kết.</span>';
    } else {
      html = `<i class="fas fa-circle-check"></i><span>Đã ghép được <b>${formatSo(ghep)}</b> dòng xuất với dòng nhập.`;
      html += khong ? ` Còn <b>${formatSo(khong)}</b> dòng chưa ghép được (nên mở "Sổ sách" của phiếu xuất để kiểm tra).</span>` : ' Không còn dòng nào chưa ghép.</span>';
    }
    kqEl.innerHTML = html;
    kqEl.style.display = 'flex';
    if (document.getElementById('th-the-ket-qua').style.display !== 'none') document.getElementById('th-xem').click();
  } catch (err) {
    kqEl.className = 'ui-note danger';
    kqEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>Không ghép được: ${esc(err.message)}</span>`;
    kqEl.style.display = 'flex';
  } finally {
    nut.disabled = false;
  }
});

// ===== CẤU HÌNH MẪU PHIẾU =====
// Mỗi loại phiếu có 1 màn riêng, vẽ lại mẫu Excel (Mẫu số 01-VT / 02-VT) để người dùng thấy
// ô nào sẽ in ở đâu: ô vàng = điền cấu hình ngay tại chỗ, chữ xám = tự điền khi tạo phiếu.
const DO_RONG_MAU = {
  nhap: [3.33, 27.66, 5.11, 4.55, 5.66, 4.89, 9.11, 9.55, 8.22],
  xuat: [4, 25.66, 5.11, 6.33, 6.78, 6.55, 7.66, 9.33, 10.78],
};
const CH_SO_NGUOI_KY_TOI_DA = 9; // mẫu có 9 cột A..I, mỗi người ký chiếm ít nhất 1 cột
const chNguoiKy = { nhap: [], xuat: [] }; // [{ chucDanh, ten }]

function tachDanhSachCsv(csv) {
  return String(csv || '').split(',').map((s) => s.trim());
}

function veMauPhieu(loai) {
  const laNhap = loai === 'nhap';
  const doRong = DO_RONG_MAU[loai];
  const tongRong = doRong.reduce((a, b) => a + b, 0);
  const phanTram = (w) => ((w / tongRong) * 100).toFixed(2);
  let soDong = 0;
  // cells: [{ span, html, cls }]; ô thiếu = để trống cho đủ 9 cột
  const dong = (cells, cao) => {
    soDong++;
    let dem = 0;
    const html = cells.map((c) => {
      const span = c.span || 1;
      dem += span;
      return `<td colspan="${span}"${c.rowspan ? ` rowspan="${c.rowspan}"` : ''} class="${c.cls || ''}">${c.html ?? ''}</td>`;
    }).join('');
    const bu = dem < 9 ? `<td colspan="${9 - dem}"></td>` : '';
    return `<tr${cao ? ` style="height:${cao}px"` : ''}><th class="xl-so-dong">${soDong}</th>${html}${bu}</tr>`;
  };
  const xam = (text) => `<span class="xl-xam">${text}</span>`;
  const nhap = (khoa, placeholder, extra = '') => `<input class="xl-nhap ${extra}" data-ch="${khoa}" placeholder="${placeholder}" />`;

  const dongHang = (stt) => dong([
    { html: xam(stt), cls: 'xl-giua xl-vien' },
    { html: xam('Tên vật tư, hàng hóa'), cls: 'xl-vien' },
    { html: xam(''), cls: 'xl-vien' }, { html: xam('ĐVT'), cls: 'xl-giua xl-vien' },
    { html: xam('0'), cls: 'xl-giua xl-vien' }, { html: xam('0'), cls: 'xl-giua xl-vien' },
    { html: xam('0,00'), cls: 'xl-phai xl-vien' }, { html: xam('0'), cls: 'xl-phai xl-vien' }, { html: '', cls: 'xl-vien' },
  ]);

  const phan1 = [
    dong([
      { span: 4, html: `<div class="xl-nhan-nhap"><span>Đơn vị:</span>${nhap('ten_don_vi', 'Tên đơn vị')}</div>`, cls: 'xl-dam xl-cau-hinh' },
      { span: 5, html: `Mẫu số ${laNhap ? '01' : '02'}-VT`, cls: 'xl-giua xl-dam xl-co-12' },
    ]),
    dong([
      { span: 4, html: `<div class="xl-nhan-nhap"><span>Bộ phận:</span>${nhap('bo_phan', 'Bộ phận')}</div>`, cls: 'xl-dam xl-cau-hinh' },
      { span: 5, html: nhap('ghi_chu_thong_tu', '( Kèm theo Thông tư ...', 'xl-giua xl-in-nghieng'), cls: 'xl-cau-hinh' },
    ]),
    dong([
      { span: 4, html: '' },
      { span: 5, html: nhap('ghi_chu_thong_tu_2', 'ngày ... của Bộ trưởng Bộ Tài chính', 'xl-giua xl-in-nghieng'), cls: 'xl-cau-hinh' },
    ]),
    dong([{ span: 9, html: laNhap ? 'PHIẾU NHẬP KHO' : 'PHIẾU XUẤT KHO', cls: 'xl-giua xl-dam xl-tieu-de' }], 34),
    dong([{ span: 9, html: xam('Ngày ….. tháng ….. năm ……..'), cls: 'xl-giua xl-in-nghieng' }]),
    dong([{ span: 6, html: '' }, { span: 3, html: xam(`Số: ${laNhap ? 'PN' : 'PX'} 01`), cls: 'xl-dam' }]),
    dong([{ span: 6, html: '' }, { span: 3, html: xam('Nợ : ………'), cls: 'xl-dam' }]),
    dong([{ span: 6, html: '' }, { span: 3, html: xam('Có : ………'), cls: 'xl-dam' }]),
    dong([{ span: 9, html: xam(`Họ và tên ${laNhap ? 'người nhập' : 'người nhận'}: ………………………   Đơn vị : ………………………`) }]),
    dong([{ span: 9, html: xam(laNhap ? 'Theo ……… số ……… ngày ……… của ………' : 'Lý do xuất kho : ………………………'), cls: laNhap ? 'xl-giua' : '' }]),
    dong([
      { span: 6, html: xam(`${laNhap ? 'Nhập' : 'Xuất'} tại kho: ………………………`) },
      { span: 2, html: xam('Địa điểm ……'), cls: 'xl-giua xl-gach-chan' },
      { span: 1, html: '' },
    ]),
  ];

  const tieuDeBang = `
    <tr style="height:20px"><th class="xl-so-dong">${++soDong}</th>
      <td rowspan="2" class="xl-th">STT</td><td rowspan="2" class="xl-th">Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá</td>
      <td rowspan="2" class="xl-th">Mã số</td><td rowspan="2" class="xl-th">ĐVT</td>
      <td colspan="2" class="xl-th">Số lượng</td>
      <td rowspan="2" class="xl-th">Đơn giá</td><td rowspan="2" class="xl-th">Thành tiền</td><td rowspan="2" class="xl-th">Ghi chú</td></tr>
    <tr style="height:34px"><th class="xl-so-dong">${++soDong}</th>
      <td class="xl-th">${laNhap ? 'Theo chứng từ' : 'Yêu cầu'}</td><td class="xl-th">${laNhap ? 'Thực nhập' : 'Thực xuất'}</td></tr>
    <tr><th class="xl-so-dong">${++soDong}</th>${['A', 'B', 'C', 'D', 1, 2, 3, 4, 5].map((t) => `<td class="xl-th xl-chi-so">${t}</td>`).join('')}</tr>`;

  const phan2 = [
    dongHang(1),
    dongHang(2),
    dong([{ html: '', cls: 'xl-vien' }, { html: 'Tổng', cls: 'xl-dam xl-vien' }, { span: 5, html: '', cls: 'xl-vien' }, { html: xam('0'), cls: 'xl-giua xl-dam xl-vien' }, { html: '', cls: 'xl-vien' }]),
    dong([{ html: '', cls: 'xl-vien' }, { html: xam('Thuế … %'), cls: 'xl-dam xl-vien' }, { span: 5, html: '', cls: 'xl-vien' }, { html: xam('0'), cls: 'xl-giua xl-dam xl-vien' }, { html: '', cls: 'xl-vien' }]),
    dong([{ html: '', cls: 'xl-vien' }, { html: 'Tổng cộng', cls: 'xl-dam xl-vien' }, { span: 5, html: '', cls: 'xl-vien' }, { html: xam('0'), cls: 'xl-giua xl-dam xl-vien' }, { html: '', cls: 'xl-vien' }]),
    dong([{ span: 9, html: xam('Tổng số tiền (viết bằng chữ) : ……………………………………………………………………./.'), cls: 'xl-dam xl-in-nghieng' }]),
    dong([{ span: 9, html: xam('Số chứng từ gốc kèm theo : ……………………………………'), cls: 'xl-dam' }]),
  ];
  const dongBatDauChuKy = soDong + 1;

  const cot = `<col style="width:34px">${doRong.map((w) => `<col style="width:${phanTram(w)}%">`).join('')}`;
  const chuCai = `<tr><th class="xl-goc"></th>${'ABCDEFGHI'.split('').map((c) => `<th class="xl-cot">${c}</th>`).join('')}</tr>`;
  const ghiChu = `<div class="xl-chu-giai"><span><i class="xl-o-mau vang"></i> Ô điền cấu hình (lưu cho mọi phiếu ${laNhap ? 'nhập' : 'xuất'} sau này)</span><span><i class="xl-o-mau xam"></i> Tự điền khi tạo phiếu</span><span class="xl-luu-y">Tên đơn vị, Bộ phận và dòng "Kèm theo Thông tư" dùng chung cho cả phiếu nhập và phiếu xuất.</span></div>`;

  document.getElementById(`xl-${loai}`).innerHTML = `${ghiChu}
    <table class="xl"><colgroup>${cot}</colgroup><thead>${chuCai}</thead>
      <tbody>${phan1.join('')}${tieuDeBang}${phan2.join('')}</tbody>
      <tbody id="xl-ky-${loai}" data-dong-bat-dau="${dongBatDauChuKy}"></tbody>
    </table>`;
  veChuKy(loai);
}

// Mỗi người ký chiếm 1 cụm cột riêng, chia đều 9 cột A..I — đúng cách xuất Excel đang chia.
function veChuKy(loai) {
  const tbody = document.getElementById(`xl-ky-${loai}`);
  const ds = chNguoiKy[loai];
  const batDau = Number(tbody.dataset.dongBatDau);
  const cacCot = ds.map((_, i) => {
    const start = Math.floor((i * 9) / ds.length) + 1;
    const end = Math.max(start, Math.floor(((i + 1) * 9) / ds.length));
    return end - start + 1;
  });
  const hang = (n, noiDung, cao) => `<tr${cao ? ` style="height:${cao}px"` : ''}><th class="xl-so-dong">${n}</th>${noiDung}</tr>`;
  const khung = (render) => ds.map((nk, i) => `<td colspan="${cacCot[i]}" class="xl-giua xl-cau-hinh">${render(nk, i)}</td>`).join('');

  tbody.innerHTML =
    hang(batDau, khung((nk, i) => `<div class="xl-ky-o"><textarea rows="2" class="xl-nhap xl-giua xl-dam" data-ky="chucDanh" data-i="${i}" placeholder="Chức danh"></textarea><button type="button" class="xl-xoa" data-xoa="${i}" title="Bỏ người ký này"><i class="fas fa-xmark"></i></button></div>`), 44) +
    hang(batDau + 1, khung(() => '<span class="xl-xam xl-in-nghieng">( Ký , họ tên)</span>'), 40) +
    hang(batDau + 2, khung((nk, i) => `<textarea rows="2" class="xl-nhap xl-giua xl-dam" data-ky="ten" data-i="${i}" placeholder="Họ tên (có thể để trống)"></textarea>`), 44) +
    hang(batDau + 3, `<td colspan="9" class="xl-them-ky"><button type="button" class="btn btn-neutral btn-sm" data-them-ky ${ds.length >= CH_SO_NGUOI_KY_TOI_DA ? 'disabled' : ''}><i class="fas fa-plus"></i> Thêm người ký</button></td>`);

  tbody.querySelectorAll('[data-ky]').forEach((inp) => {
    const nk = ds[Number(inp.dataset.i)];
    inp.value = nk[inp.dataset.ky];
    inp.addEventListener('input', () => { nk[inp.dataset.ky] = inp.value; });
  });
  tbody.querySelectorAll('[data-xoa]').forEach((b) => b.addEventListener('click', () => {
    ds.splice(Number(b.dataset.xoa), 1);
    veChuKy(loai);
  }));
  tbody.querySelector('[data-them-ky]').addEventListener('click', () => {
    ds.push({ chucDanh: '', ten: '' });
    veChuKy(loai);
    tbody.querySelector(`[data-ky="chucDanh"][data-i="${ds.length - 1}"]`).focus();
  });
}

async function taiCauHinh(loai) {
  let ch;
  try {
    ch = await goiApi('/api/cau-hinh');
  } catch (err) {
    hienToast('Không tải được cấu hình: ' + err.message, true);
    return;
  }
  const goc = document.getElementById(`xl-${loai}`);
  const chucDanh = tachDanhSachCsv(ch[`nguoi_ky_${loai}`]);
  const ten = tachDanhSachCsv(ch[`ten_nguoi_ky_${loai}`]);
  chNguoiKy[loai] = chucDanh.map((cd, i) => ({ chucDanh: cd, ten: ten[i] || '' })).filter((nk) => nk.chucDanh);
  veMauPhieu(loai);
  const mau = document.getElementById(`xl-${loai}`);
  mau.querySelectorAll('[data-ch]').forEach((inp) => { inp.value = ch[inp.dataset.ch] || ''; });
  const ketQuaEl = goc.closest('.page').querySelector('.ch-ket-qua');
  ketQuaEl.style.display = 'none';
}

document.querySelectorAll('.ch-luu').forEach((nut) => nut.addEventListener('click', async () => {
  const loai = nut.dataset.loai;
  const mau = document.getElementById(`xl-${loai}`);
  const ketQuaEl = mau.closest('.page').querySelector('.ch-ket-qua');
  const nguoiKy = chNguoiKy[loai].filter((nk) => nk.chucDanh.trim());
  const sach = (s) => s.replace(/,/g, ' ').trim(); // dấu phẩy là ký tự phân tách khi lưu
  const body = {
    [`nguoi_ky_${loai}`]: nguoiKy.map((nk) => sach(nk.chucDanh)).join(', '),
    [`ten_nguoi_ky_${loai}`]: nguoiKy.some((nk) => nk.ten.trim()) ? nguoiKy.map((nk) => sach(nk.ten)).join(', ') : '',
  };
  mau.querySelectorAll('[data-ch]').forEach((inp) => { body[inp.dataset.ch] = inp.value.trim(); });
  try {
    await goiApi('/api/cau-hinh', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) });
    ketQuaEl.className = 'ui-note ok ch-ket-qua';
    ketQuaEl.innerHTML = `<i class="fas fa-circle-check"></i><span>Đã lưu cấu hình. Các phiếu ${loai === 'nhap' ? 'nhập' : 'xuất'} xuất Excel tiếp theo sẽ dùng thông tin này.</span>`;
  } catch (err) {
    ketQuaEl.className = 'ui-note danger ch-ket-qua';
    ketQuaEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i><span>${esc(err.message)}</span>`;
  }
  ketQuaEl.style.display = 'flex';
}));

// ===== Khởi động =====
veBangDongNhap();
veBangDongXuat();
taiTonKho();
