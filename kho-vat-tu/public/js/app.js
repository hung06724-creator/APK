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
// "2026-10-27 08:05:00" -> "27/10/2026 08:05".
function ngayGioVN(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(v || '');
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : (v || '');
}
async function goiApi(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new Error('Không kết nối được máy chủ kho vật tư — kiểm tra máy chủ còn đang chạy rồi thử lại.');
  }
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
// Chuỗi để tìm kiếm: bỏ dấu tiếng Việt, đ -> d, chữ thường ("o cam" tìm được "Ổ cắm").
function chuoiTim(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}
// Ngày hôm nay theo giờ máy (YYYY-MM-DD) — không dùng toISOString vì lệch ngày trước 7h sáng (UTC+7).
function homNayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Ô ngày còn trống thì điền sẵn hôm nay (vẫn sửa được).
function datNgayMacDinh(id) {
  const el = document.getElementById(id);
  if (el && !el.value) el.value = homNayISO();
}
// Chuỗi tham số URL từ các bộ lọc khác rỗng (để link "Xuất Excel" xuất đúng danh sách đang xem).
function chuoiThamSo(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v) p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
}
// Đọc số kiểu Việt Nam: "150.000" = 150000, "1.587.963" = 1587963, "1,5" = 1,5; "0.25" = 0,25 (sau dấu chấm không
// đủ 3 chữ số thì coi là dấu thập phân). Ô trống -> null; không phải số -> NaN.
function docSo(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
// Số hiển thị trong ô nhập (kiểu Việt Nam, giữ tới 6 số lẻ); giá trị không đọc được thì giữ nguyên để người dùng sửa.
function soO(v) {
  const n = docSo(v);
  if (n === null) return '';
  return Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: 6 }) : String(v);
}
// Thành tiền 1 dòng như máy chủ tính khi lưu: làm tròn từng dòng.
const thanhTienDong = (sl, gia) => Math.round((docSo(sl) || 0) * (docSo(gia) || 0));
// Ô số (input[data-so]): rời ô thì định dạng lại cho dễ đọc; gõ sai thì tô đỏ.
document.addEventListener('input', (e) => {
  if (e.target.matches && e.target.matches('input[data-so]')) e.target.classList.toggle('o-loi', Number.isNaN(docSo(e.target.value)));
});
document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (!el.matches || !el.matches('input[data-so]')) return;
  const n = docSo(el.value);
  if (Number.isFinite(n) && el.value !== soO(n)) {
    el.value = soO(n);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
// Tải file từ máy chủ mà không rời trang: lỗi thì báo bằng thông báo nhỏ, không thay cả trang bằng dòng chữ lỗi.
async function taiFile(url, tenMacDinh) {
  let res;
  try { res = await fetch(url); } catch (e) { throw new Error('Không kết nối được máy chủ kho vật tư.'); }
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || 'Lỗi ' + res.status);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) || /filename="?([^";]+)"?/i.exec(cd);
  const ten = m ? decodeURIComponent(m[1]) : (tenMacDinh || 'tai-ve.xlsx');
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = ten;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
  return ten;
}
// Mọi đường dẫn tải file của máy chủ (<a href="/api/...">) đi qua taiFile.
document.addEventListener('click', async (e) => {
  const a = e.target.closest && e.target.closest('a[href^="/api/"]');
  if (!a || a.target === '_blank' || a.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  if (a.classList.contains('dang-tai')) return;
  a.classList.add('dang-tai');
  try {
    hienToast('Đã tải file ' + (await taiFile(a.getAttribute('href'))));
  } catch (err) {
    hienToast('Không tải được file: ' + err.message, true);
  } finally {
    a.classList.remove('dang-tai');
  }
});
// Chạy việc lưu khi nút đang khóa (tránh bấm 2 lần tạo 2 phiếu).
async function khiKhoaNut(nut, viec) {
  if (nut.disabled) return undefined;
  nut.disabled = true;
  try { return await viec(); } finally { nut.disabled = false; }
}
// Khóa so tên vật tư giống máy chủ: không phân biệt hoa / thường, khoảng trắng thừa, Đ / D.
const khoaTen = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
// Tiền đồng: làm tròn, không hiện số lẻ.
function formatTien(n) {
  return formatSo(Math.round(Number(n)));
}
function pillNguon(nguon) {
  const n = String(nguon || '661.2').replace(/^TK\s*/i, '');
  return `<span class="ui-pill ${n === '337' ? 'ui-tone-warning' : 'ui-tone-primary'}" title="Nguồn kinh phí">TK ${esc(n)}</span>`;
}
const JSON_HEADERS = { 'Content-Type': 'application/json' };
// Phiếu đã lưu đang được sửa trên form tạo phiếu: { id, so_phieu, ngay, congLai } (congLai: Map vat_tu_id -> số lượng
// của chính phiếu xuất đó, được cộng lại vào tồn khi kiểm tra). null = form đang tạo phiếu mới.
const dangSua = { nhap: null, xuat: null };
// Các năm đã khóa sổ (tải khi mở trang và sau mỗi lần khóa / mở khóa): nghiệp vụ năm đó chỉ còn xem và xuất báo cáo.
let namKhoa = new Set();
function namBiKhoa(ngay) {
  const m = /^(\d{4})-/.exec(String(ngay || ''));
  return m ? namKhoa.has(Number(m[1])) : false;
}
const namCuaNgay = (ngay) => String(ngay || '').slice(0, 4);
async function taiNamKhoa() {
  try {
    const d = await goiApi('/api/khoa-so');
    namKhoa = new Set(d.nam.filter((x) => x.khoa).map((x) => x.nam));
    return d;
  } catch (e) {
    return null;
  }
}

// ===== Menu thả xuống dùng chung (.ui-menu > [data-menu-mo] + .ui-menu-ds) =====
// Ủy quyền sự kiện ở document nên dùng được cho cả menu dựng động (trang tài sản...).
function dongMoiMenu(ngoaiTru) {
  document.querySelectorAll('.ui-menu-ds:not([hidden])').forEach((ds) => {
    if (ds === ngoaiTru) return;
    ds.hidden = true;
    const nut = ds.parentElement.querySelector('[data-menu-mo]');
    if (nut) nut.setAttribute('aria-expanded', 'false');
  });
}
document.addEventListener('click', (e) => {
  const nut = e.target.closest('[data-menu-mo]');
  if (nut) {
    const ds = nut.parentElement.querySelector('.ui-menu-ds');
    dongMoiMenu(ds);
    ds.hidden = !ds.hidden;
    nut.setAttribute('aria-expanded', String(!ds.hidden));
    return;
  }
  // chọn 1 mục trong menu hoặc bấm ra ngoài -> đóng
  dongMoiMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dongMoiMenu(); });

// ===== Chuyển tab (menu bên) =====
document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => chuyenTab(btn.dataset.tab));
  // Dùng được bằng bàn phím (Tab rồi Enter) + có chú thích khi menu thu gọn chỉ còn biểu tượng.
  btn.setAttribute('role', 'button');
  btn.tabIndex = 0;
  if (!btn.title) btn.title = (btn.querySelector('.label') || btn).textContent.trim();
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chuyenTab(btn.dataset.tab); } });
});
// Dòng bảng bấm được (mở chi tiết / lịch sử): Enter trên dòng đang chọn bằng phím Tab cũng mở như bấm chuột.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('tr.dong-bam')) e.target.click();
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
    const dangMo = b.dataset.nhom === 'tao-phieu' ? TAB_TAO_PHIEU.includes(tab) : b.dataset.tab === tab;
    b.classList.toggle('active', dangMo);
    if (dangMo) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const loaiDangMo = tab.endsWith('-xuat') ? 'xuat' : 'nhap';
  document.querySelectorAll('.tao-phieu-bar [data-seg]').forEach((b) => b.classList.toggle('active', b.dataset.seg === `tao-${loaiDangMo}`));
  document.querySelectorAll('.tao-phieu-bar [data-seg-cau-hinh]').forEach((b) => b.classList.toggle('active', b.dataset.segCauHinh === tab));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === tab));
  dongMoiMenu();
  // Màn hình hẹp: menu là 1 hàng cuộn ngang -> đưa mục đang chọn vào giữa để luôn nhìn thấy.
  const mucDangChon = document.querySelector('.sidebar .nav-item.active');
  if (mucDangChon && window.matchMedia('(max-width: 768px)').matches) mucDangChon.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (tab === 'ton-kho') taiTonKho();
  if (tab === 'phieu-nhap') taiDanhSachPhieuNhap();
  if (tab === 'phieu-xuat') taiDanhSachPhieuXuat();
  if (tab === 'tao-nhap') {
    datNgayMacDinh('pn-ngay');
    taiGoiYPhieuNhap();
  }
  if (tab === 'tao-xuat') {
    datNgayMacDinh('px-ngay');
    taiGoiYPhieuXuat();
    taiDanhSachVatTuChoXuat();
    taiDanhSachPhieuNhapChoChon('px-chon-phieu-nhap');
  }
  if (tab === 'tach-xuat') {
    datNgayMacDinh('tx-ngay');
    taiGoiYPhieuXuat();
    taiDanhSachPhieuNhapChoChon('tx-phieu-nhap');
  }
  if (tab === 'so-tong-hop') khoiTaoSoTongHop();
  if (tab === 'tscd' || tab === 'ccdc') taiTaiSan(tab);
  if (tab === 'kiem-ke') taiKiemKe();
  if (tab === 'khoa-so') taiTrangKhoaSo();
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
// Lọc nhanh theo tình trạng tồn + tìm kiếm (không phân biệt dấu); bấm 1 dòng để xem lịch sử nhập – xuất.
const tkTT = { rows: [], loc: '', q: '' };
const TK_LOC = [['', 'Tất cả'], ['am', 'Âm kho'], ['het', 'Hết hàng'], ['con', 'Còn hàng'], ['dau_ky', 'Có tồn đầu kỳ']];
const tkKhop = (r, loc) => (loc === 'am' ? r.ton_kho < 0 : loc === 'het' ? r.ton_kho === 0 : loc === 'con' ? r.ton_kho > 0 : loc === 'dau_ky' ? r.ton_dau_ky > 0 : true);

async function taiTonKho() {
  const tbody = document.getElementById('bang-ton-kho');
  if (!tkTT.rows.length) tbody.innerHTML = oTrong(6, 'spinner', 'Đang tải...');
  try {
    tkTT.rows = await goiApi('/api/vat-tu');
  } catch (err) {
    tbody.innerHTML = oTrong(6, 'triangle-exclamation', esc(err.message));
    return;
  }
  veTonKho();
}
function veTonKho() {
  const rows = tkTT.rows;
  document.getElementById('tk-chip').innerHTML = TK_LOC.map(([k, nhan]) => {
    const so = rows.filter((r) => tkKhop(r, k)).length;
    if (k && !so && tkTT.loc !== k) return '';
    return `<button type="button" class="ts-chip${tkTT.loc === k ? ' dang' : ''}${k === 'am' ? ' ts-chip-canh-bao' : ''}" data-tk-loc="${k}">${nhan} <b>${formatSo(so)}</b></button>`;
  }).join('');
  const q = chuoiTim(tkTT.q);
  const ds = rows.filter((r) => tkKhop(r, tkTT.loc) && (!q || chuoiTim(`${r.ten_hang} ${r.ma_so || ''}`).includes(q)));
  const tbody = document.getElementById('bang-ton-kho');
  tbody.innerHTML = ds.length
    ? ds.map((r) => {
      const nhan = r.ton_kho < 0 ? '<span class="ui-pill ui-tone-danger">Âm kho</span>'
        : r.ton_kho === 0 ? '<span class="ui-pill ui-tone-warning">Hết</span>' : '';
      return `<tr data-vt="${r.id}" class="dong-bam" tabindex="0">
        <td>${esc(r.ten_hang)}</td><td>${esc(r.dvt)}</td>
        <td class="num"${r.ngay_dau_ky ? ` title="Tồn đầu kỳ ngày ${esc(ngayVN(r.ngay_dau_ky))}"` : ''}>${r.ton_dau_ky ? formatSo(r.ton_dau_ky) : '<span class="ui-muted">—</span>'}</td>
        <td class="num">${formatSo(r.tong_nhap)}</td><td class="num">${formatSo(r.tong_xuat)}</td>
        <td class="num ui-strong th-nowrap">${formatSo(r.ton_kho)} ${nhan}</td></tr>`;
    }).join('')
    : oTrong(6, rows.length ? 'filter' : 'box-open', rows.length ? 'Không có vật tư nào khớp bộ lọc.' : 'Chưa có vật tư nào. Tạo phiếu nhập đầu tiên để bắt đầu.');
  document.getElementById('tk-chan').innerHTML = `<span>${formatSo(ds.length)} / ${formatSo(rows.length)} vật tư</span>`;
  document.getElementById('tk-xuat').href = '/api/xuat/ton-kho' + chuoiThamSo({ loc: tkTT.loc, q: tkTT.q });
}
document.getElementById('tk-chip').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tk-loc]');
  if (!b) return;
  tkTT.loc = tkTT.loc === b.dataset.tkLoc ? '' : b.dataset.tkLoc;
  veTonKho();
});
let tkHen;
document.getElementById('tk-tim').addEventListener('input', (e) => {
  clearTimeout(tkHen);
  tkHen = setTimeout(() => { tkTT.q = e.target.value.trim(); veTonKho(); }, 150);
});
document.getElementById('bang-ton-kho').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-vt]');
  if (tr) moLichSuVatTu(Number(tr.dataset.vt));
});

// Lịch sử 1 vật tư: tồn đầu kỳ + các dòng nhập / xuất theo ngày, tồn chạy sau mỗi phiếu; bấm số phiếu để mở phiếu.
async function moLichSuVatTu(id) {
  let d;
  try { d = await goiApi(`/api/vat-tu/${id}/lich-su`); } catch (err) { hienToast(err.message, true); return; }
  const gd = [
    ...(d.ton_dau_ky ? [{ loai: 'dau_ky', ngay: d.ton_dau_ky.ngay, so_luong: d.ton_dau_ky.so_luong, don_gia: d.ton_dau_ky.don_gia }] : []),
    ...d.nhap.map((x) => ({ ...x, loai: 'nhap' })),
    ...d.xuat.map((x) => ({ ...x, loai: 'xuat' })),
  ].sort((a, b) => String(a.ngay || '').localeCompare(String(b.ngay || '')) || ({ dau_ky: 0, nhap: 1, xuat: 2 }[a.loai] - { dau_ky: 0, nhap: 1, xuat: 2 }[b.loai]));
  let ton = 0;
  const dong = gd.map((g) => {
    ton += g.loai === 'xuat' ? -g.so_luong : g.so_luong;
    const nhan = g.loai === 'dau_ky' ? '<span class="ui-pill ui-tone-neutral">Đầu kỳ</span>'
      : g.loai === 'nhap' ? '<span class="ui-pill ui-tone-primary">Nhập</span>' : '<span class="ui-pill ui-tone-warning">Xuất</span>';
    const soPhieu = g.loai === 'dau_ky' ? '' : `<button type="button" class="nut-lien-ket" data-ct="${g.loai}:${g.id}">${esc(g.so_phieu || '(không số)')}</button>`;
    return `<tr><td class="th-nowrap">${esc(ngayVN(g.ngay))}</td><td>${nhan}</td><td>${soPhieu}</td><td>${esc(g.nguoi || '')}</td>
      <td class="num">${g.loai === 'xuat' ? '−' : '+'}${formatSo(g.so_luong)}</td><td class="num">${g.don_gia ? formatTien(g.don_gia) : ''}</td>
      <td class="num ui-strong${ton < 0 ? ' ui-neg' : ''}">${formatSo(ton)}</td></tr>`;
  }).join('');
  const v = d.vat_tu;
  const tongN = d.nhap.reduce((s, x) => s + x.so_luong, 0);
  const tongX = d.xuat.reduce((s, x) => s + x.so_luong, 0);
  const dk = d.ton_dau_ky ? d.ton_dau_ky.so_luong : 0;
  const goc = moDialog(esc(v.ten_hang), `Đơn vị tính: ${esc(v.dvt || '—')}`,
    `<div class="ui-statbar">Đầu kỳ <b>${formatSo(dk)}</b> · Nhập <b>${formatSo(tongN)}</b> · Xuất <b>${formatSo(tongX)}</b> · Tồn <b class="${dk + tongN - tongX < 0 ? 'ui-neg' : ''}">${formatSo(dk + tongN - tongX)}</b></div>
     <div class="ui-table-scroll ls-bang"><table class="ui-table">
       <thead><tr><th>Ngày</th><th>Loại</th><th>Số phiếu</th><th>Người nhập / nhận</th><th class="num">Số lượng</th><th class="num">Đơn giá</th><th class="num">Tồn sau</th></tr></thead>
       <tbody>${dong || oTrong(7, 'inbox', 'Vật tư này chưa có phát sinh.')}</tbody>
     </table></div>`,
    '<button class="btn btn-neutral" type="button" data-dong>Đóng</button>');
  goc.querySelector('.ls-bang').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ct]');
    if (!b) return;
    const [loai, idPhieu] = b.dataset.ct.split(':');
    moChiTietPhieu(loai, Number(idPhieu), () => moLichSuVatTu(id));
  });
}

// ===== TỒN ĐẦU KỲ =====
// Nạp từ file "Danh sách vật tư tồn âm" đã điền cột "Kế toán xác nhận tồn đầu kỳ": xem trước -> ghi vào kho.
document.getElementById('tdk-nap').addEventListener('click', () => {
  const goc = moDialog('Nạp tồn đầu kỳ', 'Chọn file "Danh sách vật tư tồn âm" (VatTuTonAm_....xlsx) đã điền cột "Kế toán xác nhận tồn đầu kỳ".',
    `<div class="ui-form-grid cot-2">
       <div class="ui-field">File Excel (.xlsx)<input id="tdk-file" class="ui-input" type="file" accept=".xlsx" /></div>
       <div class="ui-field">Ngày tồn đầu kỳ<input id="tdk-ngay" class="ui-input" type="date" value="${new Date().getFullYear()}-01-01" /></div>
     </div>
     <div class="ui-statbar">Chỉ các dòng có điền "Số lượng" ở cột xác nhận mới được nạp. Vật tư đã có tồn đầu kỳ sẽ được thay bằng số mới. Database được sao lưu trước khi ghi.</div>
     <div id="tdk-kq"></div>
     <div id="tdk-loi" class="ui-note danger" style="display:none"></div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Đóng</button>
     <button class="btn btn-secondary" type="button" id="tdk-xem"><i class="fas fa-eye"></i> Xem trước</button>
     <button class="btn btn-primary" type="button" id="tdk-ghi" disabled><i class="fas fa-floppy-disk"></i> Ghi vào kho</button>`);
  // Đổi file / ngày sau khi xem trước thì phải xem trước lại mới được ghi (tránh ghi file chưa xem).
  const datLaiXem = () => { document.getElementById('tdk-ghi').disabled = true; document.getElementById('tdk-kq').innerHTML = ''; };
  document.getElementById('tdk-file').addEventListener('change', datLaiXem);
  document.getElementById('tdk-ngay').addEventListener('change', datLaiXem);
  const gui = async (ghi) => {
    const loiEl = document.getElementById('tdk-loi');
    hienLoi(loiEl, '');
    const f = document.getElementById('tdk-file').files[0];
    if (!f) { hienLoi(loiEl, 'Chưa chọn file.'); return null; }
    const fd = new FormData();
    fd.append('file', f);
    fd.append('ngay', val('tdk-ngay'));
    if (ghi) fd.append('ghi', '1');
    try {
      return await goiApi('/api/ton-dau-ky/nap', { method: 'POST', body: fd });
    } catch (err) { hienLoi(loiEl, esc(err.message)); return null; }
  };
  document.getElementById('tdk-xem').addEventListener('click', async () => {
    const kq = await gui(false);
    if (!kq) { datLaiXem(); return; }
    const dong = kq.dong.map((d) => `<tr class="${d.loi ? 'tdk-loi' : ''}">
        <td class="num">${d.dongExcel}</td><td>${esc(d.ten)}${d.nhom ? ` <span class="ui-pill ${d.nhom === 'B' ? 'ui-tone-warning' : 'ui-tone-neutral'}">${esc(d.nhom)}</span>` : ''}</td>
        <td class="num">${d.so_luong === null || Number.isNaN(d.so_luong) ? '' : formatSo(d.so_luong)}</td>
        <td class="num">${d.don_gia === null || Number.isNaN(d.don_gia) ? '' : formatTien(d.don_gia)}</td>
        <td class="num">${d.ton_hien_tai === undefined ? '' : formatSo(d.ton_hien_tai)}</td>
        <td class="num ui-strong">${d.ton_sau === undefined ? '' : formatSo(d.ton_sau)}</td>
        <td>${d.loi ? `<b class="tdk-chu-loi">${esc(d.loi)}</b>` : esc(d.canh_bao.join('; '))}</td></tr>`).join('');
    document.getElementById('tdk-kq').innerHTML = `
      <div class="ui-statbar">Đọc được <b>${kq.tong}</b> dòng có điền số liệu: <b>${kq.hop_le}</b> hợp lệ, <b>${kq.loi}</b> lỗi (không ghi).</div>
      <div class="ui-table-scroll tdk-bang"><table class="ui-table">
        <thead><tr><th class="num">Dòng</th><th>Vật tư</th><th class="num">SL đầu kỳ</th><th class="num">Đơn giá</th><th class="num">Tồn hiện tại</th><th class="num">Tồn sau khi nạp</th><th>Ghi chú</th></tr></thead>
        <tbody>${dong || oTrong(7, 'inbox', 'Chưa có dòng nào được điền ở cột "Kế toán xác nhận tồn đầu kỳ".')}</tbody>
      </table></div>`;
    document.getElementById('tdk-ghi').disabled = !kq.hop_le;
  });
  document.getElementById('tdk-ghi').addEventListener('click', async () => {
    if (!confirm('Ghi tồn đầu kỳ cho các dòng hợp lệ vào kho?')) return;
    const kq = await gui(true);
    if (!kq) return;
    dongDialog();
    hienToast(`Đã ghi tồn đầu kỳ cho ${formatSo(kq.da_ghi)} vật tư${kq.loi ? `, bỏ qua ${kq.loi} dòng lỗi` : ''}.`);
    taiTonKho();
  });
});

document.getElementById('tdk-ds').addEventListener('click', async () => {
  let ds;
  try { ds = await goiApi('/api/ton-dau-ky'); } catch (err) { hienToast(err.message, true); return; }
  const ve = () => (ds.length ? ds.map((t) => `<tr><td>${esc(t.ten_hang)}</td><td>${esc(t.dvt)}</td><td>${esc(ngayVN(t.ngay))}</td>
      <td class="num">${formatSo(t.so_luong)}</td><td class="num">${t.don_gia === null ? '' : formatTien(t.don_gia)}</td>
      <td class="tdk-nguon">${esc(t.nguon || '')}</td>
      <td>${namBiKhoa(t.ngay) ? `<i class="fas fa-lock ui-khoa" title="Năm ${namCuaNgay(t.ngay)} đã khóa sổ"></i>`
        : `<button class="btn btn-sm btn-danger" type="button" data-tdk-xoa="${t.id}" title="Xóa tồn đầu kỳ này"><i class="fas fa-trash"></i></button>`}</td></tr>`).join('')
    : oTrong(7, 'inbox', 'Chưa nạp tồn đầu kỳ nào.'));
  const goc = moDialog('Tồn đầu kỳ đã nạp', `${ds.length} vật tư có tồn đầu kỳ.`,
    `<div class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Vật tư</th><th>ĐVT</th><th>Ngày</th><th class="num">Số lượng</th><th class="num">Đơn giá</th><th>Nguồn</th><th></th></tr></thead>
     <tbody id="tdk-ds-bang">${ve()}</tbody></table></div>`,
    '<button class="btn btn-neutral" type="button" data-dong>Đóng</button>');
  goc.querySelector('#tdk-ds-bang').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-tdk-xoa]');
    if (!b || !confirm('Xóa tồn đầu kỳ của vật tư này?')) return;
    try {
      await goiApi('/api/ton-dau-ky/' + b.dataset.tdkXoa, { method: 'DELETE' });
      ds = ds.filter((t) => String(t.id) !== b.dataset.tdkXoa);
      goc.querySelector('#tdk-ds-bang').innerHTML = ve();
      hienToast('Đã xóa tồn đầu kỳ.');
      taiTonKho();
    } catch (err) { hienToast(err.message, true); }
  });
});

// ===== DANH SÁCH PHIẾU NHẬP / XUẤT =====
function nutHanhDong(loai, r) {
  const khoa = namBiKhoa(r.ngay); // phiếu năm đã khóa sổ: chỉ còn nút Excel
  return `
    <div class="ds-nut">
      ${khoa ? '' : `<button class="btn btn-sm btn-neutral btn-icon" data-sua-phieu type="button" title="Sửa phiếu: dòng hàng, số lượng, đơn giá" aria-label="Sửa phiếu"><i class="fas fa-pen"></i></button>
      <button class="btn btn-sm btn-secondary btn-icon" data-so-sach="${loai}:${r.id}" type="button" title="Sổ sách: TK đối ứng, tiểu mục, nguồn kinh phí" aria-label="Sổ sách"><i class="fas fa-book"></i></button>`}
      <a class="btn btn-sm btn-neutral btn-icon" href="/api/phieu-${loai}/${r.id}/xuat-excel" title="Xuất phiếu ra Excel (mẫu in)" aria-label="Xuất Excel"><i class="fas fa-file-excel"></i></a>
      ${khoa ? '' : `<button class="btn btn-sm btn-danger btn-icon" data-xoa-${loai}="${r.id}" type="button" title="Xóa phiếu" aria-label="Xóa phiếu"><i class="fas fa-trash"></i></button>`}
    </div>`;
}

// Danh sách phiếu nhập / xuất: tìm kiếm (không phân biệt dấu), lọc theo tháng và nguồn kinh phí, dòng tổng;
// bấm 1 phiếu để xem chi tiết các dòng hàng. Dùng chung cho 2 loại phiếu.
const plTT = { nhap: { rows: [], q: '', thang: '', nguon: '' }, xuat: { rows: [], q: '', thang: '', nguon: '' } };
const noiDungPhieu = (loai, r) => (loai === 'nhap' ? r.nha_cung_cap || r.ly_do_nhap : r.ly_do_xuat) || '';

async function taiDanhSachPhieu(loai) {
  const tbody = document.getElementById(`bang-phieu-${loai}`);
  if (!plTT[loai].rows.length) tbody.innerHTML = oTrong(7, 'spinner', 'Đang tải...');
  try {
    plTT[loai].rows = await goiApi(`/api/phieu-${loai}`);
  } catch (err) {
    tbody.innerHTML = oTrong(7, 'triangle-exclamation', esc(err.message));
    return;
  }
  // Tháng có phiếu (mới nhất trước) cho bộ lọc
  const selThang = document.querySelector(`[data-pl-loc="${loai}"] [data-pl="thang"]`);
  const cacThang = [...new Set(plTT[loai].rows.map((r) => String(r.ngay || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  selThang.innerHTML = '<option value="">Mọi tháng</option>' + cacThang.map((t) => `<option value="${t}">Tháng ${Number(t.slice(5))}/${t.slice(0, 4)}</option>`).join('');
  selThang.value = cacThang.includes(plTT[loai].thang) ? plTT[loai].thang : '';
  plTT[loai].thang = selThang.value;
  vePhieu(loai);
}
const taiDanhSachPhieuNhap = () => taiDanhSachPhieu('nhap');
const taiDanhSachPhieuXuat = () => taiDanhSachPhieu('xuat');

function vePhieu(loai) {
  const s = plTT[loai];
  const q = chuoiTim(s.q);
  const ds = s.rows.filter((r) => (!s.thang || String(r.ngay || '').startsWith(s.thang))
    && (!s.nguon || (r.nguon_kinh_phi || '661.2') === s.nguon)
    && (!q || chuoiTim([r.so_phieu, loai === 'nhap' ? r.nguoi_nhap : r.nguoi_nhan, r.don_vi, noiDungPhieu(loai, r)].join(' ')).includes(q)));
  const tbody = document.getElementById(`bang-phieu-${loai}`);
  tbody.innerHTML = ds.length
    ? ds.map((r) => `<tr data-phieu="${r.id}" class="dong-bam" tabindex="0">
        <td class="ui-strong ds-so">${namBiKhoa(r.ngay) ? `<i class="fas fa-lock ui-khoa" title="Năm ${namCuaNgay(r.ngay)} đã khóa sổ"></i> ` : ''}${esc(r.so_phieu || '(không số)')}<span class="ds-sub">${esc(r.so_dong)} dòng</span></td>
        <td class="th-nowrap">${esc(ngayVN(r.ngay))}</td>
        ${loai === 'nhap'
          ? `<td class="ds-cell-cat" title="${esc(noiDungPhieu(loai, r))}">${esc(noiDungPhieu(loai, r))}</td><td>${esc(r.nguoi_nhap)}</td>`
          : `<td>${esc(r.nguoi_nhan)}</td><td class="ds-cell-cat" title="${esc(r.ly_do_xuat)}">${esc(r.ly_do_xuat)}</td>`}
        <td>${pillNguon(r.nguon_kinh_phi)}</td>
        <td class="num ui-strong">${formatTien(r.tong_cong)}</td>
        <td class="ds-nut-cell">${nutHanhDong(loai, r)}</td></tr>`).join('')
    : oTrong(7, s.rows.length ? 'filter' : 'inbox', s.rows.length ? 'Không có phiếu nào khớp bộ lọc.' : `Chưa có phiếu ${loai === 'nhap' ? 'nhập' : 'xuất'} nào.`);
  const tong = ds.reduce((a, r) => a + (Number(r.tong_cong) || 0), 0);
  document.getElementById(`pl-chan-${loai}`).innerHTML = `<span>${formatSo(ds.length)} / ${formatSo(s.rows.length)} phiếu</span><b>Tổng cộng: ${formatTien(tong)} đ</b>`;
  document.getElementById(`pl-xuat-${loai}`).href = `/api/xuat/phieu-${loai}` + chuoiThamSo({ thang: s.thang, nguon: s.nguon, q: s.q });
}

async function xoaPhieu(loai, id) {
  if (!confirm(loai === 'nhap' ? 'Xóa phiếu nhập này? Tồn kho sẽ giảm tương ứng.' : 'Xóa phiếu xuất này? Tồn kho sẽ tăng lại tương ứng.')) return false;
  try {
    await goiApi(`/api/phieu-${loai}/${id}`, { method: 'DELETE' });
    hienToast(loai === 'nhap' ? 'Đã xóa phiếu nhập.' : 'Đã xóa phiếu xuất.');
    if (dangSua[loai] && dangSua[loai].id === id) thoatSua(loai); // phiếu đang mở sửa đã bị xóa
    taiDanhSachPhieu(loai);
    if (document.getElementById('ton-kho').classList.contains('active')) taiTonKho();
    return true;
  } catch (err) {
    hienToast(err.message, true);
    return false;
  }
}

['nhap', 'xuat'].forEach((loai) => {
  const loc = document.querySelector(`[data-pl-loc="${loai}"]`);
  let hen;
  loc.querySelectorAll('[data-pl]').forEach((el) => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
    clearTimeout(hen);
    hen = setTimeout(() => { plTT[loai][el.dataset.pl] = el.value.trim(); vePhieu(loai); }, el.tagName === 'INPUT' ? 150 : 0);
  }));
  document.getElementById(`bang-phieu-${loai}`).addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-phieu]');
    if (!tr || e.target.closest('a')) return; // nút Excel là đường dẫn tải file
    const id = Number(tr.dataset.phieu);
    if (e.target.closest('[data-sua-phieu]')) { suaTuDanhSach(loai, id); return; }
    if (e.target.closest('[data-so-sach]')) { moSoSach(loai, id); return; }
    if (e.target.closest(`[data-xoa-${loai}]`)) { xoaPhieu(loai, id); return; }
    moChiTietPhieu(loai, id);
  });
});

// Chi tiết 1 phiếu: thông tin chung + các dòng hàng + tổng tiền; có nút Excel / Sổ sách / Xóa.
// quayLai (tùy chọn): mở từ lịch sử vật tư thì có nút quay về hộp thoại trước.
async function moChiTietPhieu(loai, id, quayLai) {
  let p;
  try { p = await goiApi(`/api/phieu-${loai}/${id}`); } catch (err) { hienToast('Không tải được phiếu: ' + err.message, true); return; }
  const laNhap = loai === 'nhap';
  const o = (nhan, gt) => (gt ? `<div class="ts-ct-dong"><span>${nhan}</span><b>${esc(gt)}</b></div>` : '');
  const items = p.items || [];
  const dong = items.map((it, i) => `<tr>
      <td class="num">${it.stt || i + 1}</td>
      <td>${esc(it.ten_hang)}${it.ghi_chu ? `<span class="ds-sub">${esc(it.ghi_chu)}</span>` : ''}</td>
      <td>${esc(it.dvt)}</td>
      <td class="num">${formatSo(laNhap ? it.sl_chung_tu : it.sl_yeu_cau)}</td>
      <td class="num ui-strong">${formatSo(laNhap ? it.sl_thuc_nhap : it.sl_thuc_xuat)}</td>
      <td class="num">${formatTien(it.don_gia)}</td>
      <td class="num">${formatTien(it.thanh_tien)}</td></tr>`).join('');
  const khoa = namBiKhoa(p.ngay); // năm đã khóa sổ: chỉ xem và xuất Excel
  const goc = moDialog(`${laNhap ? 'Phiếu nhập kho' : 'Phiếu xuất kho'} ${esc(p.so_phieu || '')}`,
    `Ngày ${esc(ngayVN(p.ngay))} · ${items.length} dòng hàng${p.sua_luc ? ` · sửa lần cuối ${esc(ngayGioVN(p.sua_luc))}` : ''}`,
    `${khoa ? `<div class="ui-note khoa-so"><i class="fas fa-lock"></i><span>Năm ${namCuaNgay(p.ngay)} đã khóa sổ: phiếu chỉ xem và xuất Excel. Cần sửa thì mở khóa năm đó ở mục "Khóa sổ".</span></div>` : ''}
     <div class="ts-ct-luoi">
       ${o(laNhap ? 'Người nhập' : 'Người nhận', laNhap ? p.nguoi_nhap : p.nguoi_nhan)}
       ${o('Đơn vị', p.don_vi)}
       ${laNhap ? o('Nhà cung cấp', p.nha_cung_cap) : ''}
       ${o(laNhap ? 'Nhập tại kho' : 'Xuất tại kho', laNhap ? p.nhap_tai_kho : p.xuat_tai_kho)}
       ${o('Địa điểm', p.dia_diem)}
       ${o('Số chứng từ gốc', p.so_chung_tu_goc)}
       ${o('Nợ / Có', [p.no_tk, p.co_tk].filter(Boolean).join(' / '))}
       ${o('Nguồn kinh phí', `TK ${p.nguon_kinh_phi || '661.2'}`)}
     </div>
     ${(laNhap ? p.ly_do_nhap : p.ly_do_xuat) ? `<div class="ui-statbar">Lý do: <b>${esc(laNhap ? p.ly_do_nhap : p.ly_do_xuat)}</b></div>` : ''}
     <div class="ui-table-scroll ls-bang"><table class="ui-table">
       <thead><tr><th class="num">STT</th><th>Tên hàng</th><th>ĐVT</th><th class="num">${laNhap ? 'SL chứng từ' : 'SL yêu cầu'}</th><th class="num">${laNhap ? 'SL thực nhập' : 'SL thực xuất'}</th><th class="num">Đơn giá</th><th class="num">Thành tiền</th></tr></thead>
       <tbody>${dong || oTrong(7, 'inbox', 'Phiếu chưa có dòng hàng.')}</tbody>
     </table></div>
     <div class="ui-totals">
       <span>Tiền hàng: <b>${formatTien(p.tong_tien_hang)}</b></span>
       <span>Thuế (${formatSo(p.thue_suat || 0)}%): <b>${formatTien(p.tien_thue)}</b></span>
       <span>Tổng cộng: <b>${formatTien(p.tong_cong)} đ</b></span>
     </div>`,
    `<span class="ts-chan-trai">${quayLai ? '<button class="btn btn-neutral" type="button" data-ct-quay-lai><i class="fas fa-arrow-left"></i> Lịch sử vật tư</button>' : ''}${khoa ? '' : '<button class="btn btn-danger" type="button" data-ct-xoa><i class="fas fa-trash"></i> Xóa phiếu</button>'}</span>
     <button class="btn btn-neutral" type="button" data-dong>Đóng</button>
     ${khoa ? '' : `<button class="btn btn-secondary" type="button" data-ct-sua><i class="fas fa-pen"></i> Sửa phiếu</button>
     <button class="btn btn-secondary" type="button" data-ct-so-sach><i class="fas fa-book"></i> Sổ sách</button>`}
     <a class="btn btn-primary" href="/api/phieu-${loai}/${id}/xuat-excel"><i class="fas fa-file-excel"></i> Xuất Excel</a>`);
  if (!khoa) {
    goc.querySelector('[data-ct-sua]').addEventListener('click', () => {
      if (!coTheMoSua(loai, id)) return;
      dongDialog();
      moSuaPhieu(loai, p);
    });
    goc.querySelector('[data-ct-so-sach]').addEventListener('click', () => moSoSach(loai, id, () => moChiTietPhieu(loai, id, quayLai)));
    goc.querySelector('[data-ct-xoa]').addEventListener('click', async () => { if (await xoaPhieu(loai, id)) dongDialog(); });
  }
  if (quayLai) goc.querySelector('[data-ct-quay-lai]').addEventListener('click', quayLai);
}

// ===== HỘP THOẠI "SỔ SÁCH" (xem & sửa riêng thông tin sổ sách của phiếu đã lưu) =====
let dongHopThoai = null;
let oTruocHopThoai = null; // phần tử đang được chọn trước khi mở hộp thoại -> đóng thì trả con trỏ về đó
function dongDialog() {
  const goc = document.getElementById('dialog-goc');
  const coHopThoai = Boolean(goc.firstElementChild);
  goc.innerHTML = '';
  if (dongHopThoai) { document.removeEventListener('keydown', dongHopThoai); dongHopThoai = null; }
  if (coHopThoai && oTruocHopThoai && document.contains(oTruocHopThoai)) oTruocHopThoai.focus();
  oTruocHopThoai = null;
}
function moDialog(tieuDe, phuDe, thanBody, chanBody) {
  const truoc = oTruocHopThoai || document.activeElement; // mở nối tiếp nhiều hộp thoại: vẫn nhớ chỗ ban đầu
  oTruocHopThoai = null;
  dongDialog();
  oTruocHopThoai = truoc;
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
  goc.querySelectorAll('[data-dong]').forEach((b) => b.addEventListener('click', dongDialog)); // nút X + mọi nút "Đóng / Hủy"
  // Bấm ra ngoài / Esc khi đã gõ dở trong hộp thoại thì hỏi lại, tránh mất dữ liệu đang nhập.
  let daSua = false;
  goc.querySelector('.ui-dialog-body').addEventListener('input', () => { daSua = true; });
  const dongNeuDongY = () => { if (!daSua || confirm('Đóng hộp thoại và bỏ các thay đổi chưa lưu?')) dongDialog(); };
  goc.querySelector('[data-dong-nen]').addEventListener('mousedown', (e) => { if (e.target === e.currentTarget) dongNeuDongY(); });
  // Esc để đóng; Tab / Shift+Tab chỉ đi vòng trong hộp thoại.
  dongHopThoai = (e) => {
    if (e.key === 'Escape') { dongNeuDongY(); return; }
    if (e.key !== 'Tab') return;
    const ds = [...goc.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary')]
      .filter((el) => el.offsetParent !== null);
    if (!ds.length) return;
    if (e.shiftKey && (document.activeElement === ds[0] || !goc.contains(document.activeElement))) { e.preventDefault(); ds[ds.length - 1].focus(); }
    else if (!e.shiftKey && (document.activeElement === ds[ds.length - 1] || !goc.contains(document.activeElement))) { e.preventDefault(); ds[0].focus(); }
  };
  document.addEventListener('keydown', dongHopThoai);
  // Đưa con trỏ vào hộp thoại (nơi gọi có thể tự chọn ô cụ thể ngay sau đó).
  const hop = goc.querySelector('.ui-dialog-box');
  hop.tabIndex = -1;
  setTimeout(() => {
    if (goc.contains(document.activeElement)) return;
    const dau = goc.querySelector('.ui-dialog-body input:not([disabled]):not([type="hidden"]):not([type="checkbox"]), .ui-dialog-body select, .ui-dialog-body textarea, .ui-dialog-foot .btn-primary');
    (dau || hop).focus();
  }, 0);
  return goc;
}

// quayLai (tùy chọn): mở từ hộp thoại chi tiết phiếu thì có nút quay lại, lưu xong cũng quay lại đó.
async function moSoSach(loai, id, quayLai) {
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
  const ai = laNhap ? phieu.nha_cung_cap || phieu.nguoi_nhap : phieu.nguoi_nhan;
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
    `${quayLai ? '<button class="btn btn-neutral" type="button" data-ss-quay-lai><i class="fas fa-arrow-left"></i> Quay lại phiếu</button>' : '<button class="btn btn-neutral" type="button" data-dong>Hủy</button>'}
     <button class="btn btn-primary" type="button" id="ss-luu"><i class="fas fa-floppy-disk"></i> Lưu sổ sách</button>`
  );
  if (quayLai) goc.querySelector('[data-ss-quay-lai]').addEventListener('click', quayLai);
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
      if (quayLai) quayLai(); else dongDialog();
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
    id: du.id || null, // dòng của phiếu đã lưu (khi sửa) — giữ id để dòng xuất đã ghép theo không mất liên kết
    ghi_chu: du.ghi_chu || '',
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
    const thanhTien = thanhTienDong(d.sl_thuc_nhap, d.don_gia);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input class="ui-input cell text w-ten" data-i="${i}" data-f="ten_hang" value="${esc(d.ten_hang)}" aria-label="Tên hàng" /></td>
      <td class="col-bs"><input class="ui-input cell text w-56" data-i="${i}" data-f="ma_so" value="${esc(d.ma_so)}" aria-label="Mã số" /></td>
      <td><input class="ui-input cell text w-56" data-i="${i}" data-f="dvt" value="${esc(d.dvt)}" aria-label="Đơn vị tính" /></td>
      <td class="col-bs"><input class="ui-input cell w-72" data-i="${i}" data-f="sl_chung_tu" inputmode="decimal" data-so value="${esc(soO(d.sl_chung_tu))}" aria-label="SL chứng từ" /></td>
      <td><input class="ui-input cell w-72" data-i="${i}" data-f="sl_thuc_nhap" inputmode="decimal" data-so value="${esc(soO(d.sl_thuc_nhap))}" aria-label="SL thực nhập" /></td>
      <td><input class="ui-input cell w-96" data-i="${i}" data-f="don_gia" inputmode="decimal" data-so value="${esc(soO(d.don_gia))}" aria-label="Đơn giá" /></td>
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
        tbody.children[i].querySelector('[data-tt]').textContent = formatTien(thanhTienDong(dongNhap[i].sl_thuc_nhap, dongNhap[i].don_gia));
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

// Ô tổng của form phiếu (pn / px): cộng thành tiền đã làm tròn từng dòng + thuế — đúng như số máy chủ lưu.
function capNhatTong(tienTo, dsDong, khoaSl) {
  const tongHang = dsDong.reduce((s, d) => s + thanhTienDong(d[khoaSl], d.don_gia), 0);
  const thueSuat = docSo(document.getElementById(`${tienTo}-thue-suat`).value) || 0;
  const tienThue = Math.round((tongHang * thueSuat) / 100);
  document.getElementById(`${tienTo}-tong-hang`).textContent = formatTien(tongHang);
  document.getElementById(`${tienTo}-thue-hien`).textContent = formatSo(thueSuat) || '0';
  document.getElementById(`${tienTo}-tien-thue`).textContent = formatTien(tienThue);
  document.getElementById(`${tienTo}-tong-cong`).textContent = formatTien(tongHang + tienThue);
  return tongHang + tienThue;
}
function capNhatTongNhap() { return capNhatTong('pn', dongNhap, 'sl_thuc_nhap'); }

// Kiểm tra các dòng hàng trước khi lưu. Dòng trống hẳn thì bỏ qua; dòng nhập dở (thiếu tên, số lượng / đơn giá sai...)
// thì tô đỏ và trả lỗi để người dùng sửa — không lặng lẽ bỏ dòng. kiemThem(d) trả lỗi riêng của từng loại phiếu.
function kiemTraDongHang(dsDong, khoaSl, idBang, kiemThem) {
  const tbody = document.getElementById(idBang);
  const loi = [];
  const hopLe = [];
  dsDong.forEach((d, i) => {
    const sl = docSo(d[khoaSl]);
    const gia = docSo(d.don_gia);
    const ten = String(d.ten_hang || '').trim();
    let l = null;
    if (!ten && sl === null && !gia) return;
    if (!ten) l = 'chưa có tên hàng';
    else if (!(sl > 0)) l = 'số lượng phải là số lớn hơn 0';
    else if (Number.isNaN(gia) || gia < 0) l = 'đơn giá không hợp lệ';
    else if (kiemThem) l = kiemThem(d, sl);
    if (tbody.children[i]) tbody.children[i].classList.toggle('dong-loi', Boolean(l));
    if (l) loi.push(`Dòng ${i + 1} (${esc(ten || 'chưa có tên')}): ${esc(l)}`);
    else hopLe.push(d);
  });
  return { hopLe, loi };
}
// Lỗi "không đủ tồn kho" từ máy chủ -> danh sách dễ đọc.
function chuoiThieuTon(err) {
  return err.data && err.data.chi_tiet
    ? 'Không đủ tồn kho:<br>' + err.data.chi_tiet.map((c) => `- ${esc(c.ten_hang)}: tồn ${formatSo(c.ton_kho)}, cần xuất ${formatSo(c.muon_xuat)}`).join('<br>')
    : esc(err.message);
}

document.getElementById('them-dong-nhap').addEventListener('click', () => {
  dongNhap.push(dongNhapMoi());
  veBangDongNhap();
});
document.getElementById('pn-thue-suat').addEventListener('input', capNhatTongNhap);

// Dropdown gợi ý cho Số phiếu / Người nhập / Đơn vị của form phiếu nhập (lấy từ các phiếu nhập đã lưu).
function datDanhSachGoiY(idInput, idList, giaTri) {
  let dl = document.getElementById(idList);
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = idList;
    document.body.appendChild(dl);
  }
  dl.innerHTML = giaTri.map((v) => `<option value="${esc(v)}">`).join('');
  document.getElementById(idInput).setAttribute('list', idList);
}
async function taiGoiYPhieuNhap() {
  try {
    const g = await goiApi('/api/phieu-nhap/goi-y');
    datDanhSachGoiY('pn-so-phieu', 'ds-goi-y-pn-so', g.so_phieu);
    datDanhSachGoiY('pn-nguoi-nhap', 'ds-goi-y-pn-nguoi', g.nguoi_nhap);
    datDanhSachGoiY('pn-don-vi', 'ds-goi-y-pn-don-vi', g.don_vi);
    const o = document.getElementById('pn-so-phieu');
    if (!o.value && g.so_phieu.length) o.value = g.so_phieu[0];
  } catch (e) { /* gợi ý chỉ là tiện ích, lỗi thì bỏ qua */ }
}
// Gợi ý cho form phiếu xuất và form tách phiếu: số phiếu kế tiếp, người nhận, đơn vị đã dùng.
let goiYPX = { so_phieu: [], nguoi_nhan: [], don_vi: [] };
async function taiGoiYPhieuXuat() {
  try {
    goiYPX = await goiApi('/api/phieu-xuat/goi-y');
    datDanhSachGoiY('px-so-phieu', 'ds-goi-y-px-so', goiYPX.so_phieu);
    datDanhSachGoiY('px-nguoi-nhan', 'ds-goi-y-px-nguoi', goiYPX.nguoi_nhan);
    datDanhSachGoiY('px-don-vi', 'ds-goi-y-px-don-vi', goiYPX.don_vi);
    const o = document.getElementById('px-so-phieu');
    if (!o.value && goiYPX.so_phieu.length) o.value = goiYPX.so_phieu[0];
  } catch (e) { /* gợi ý chỉ là tiện ích, lỗi thì bỏ qua */ }
}

document.getElementById('luu-phieu-nhap').addEventListener('click', (e) => khiKhoaNut(e.currentTarget, async () => {
  const loiEl = document.getElementById('pn-loi');
  hienLoi(loiEl, '');
  const { hopLe, loi } = kiemTraDongHang(dongNhap, 'sl_thuc_nhap', 'bang-dong-nhap');
  if (loi.length) { hienLoi(loiEl, 'Sửa các dòng tô đỏ trước khi lưu:<br>' + loi.join('<br>')); return; }
  if (!hopLe.length) { hienLoi(loiEl, 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực nhập > 0.'); return; }
  const items = hopLe.map((d) => ({ ...d, sl_chung_tu: docSo(d.sl_chung_tu), sl_thuc_nhap: docSo(d.sl_thuc_nhap), don_gia: docSo(d.don_gia) || 0 }));
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
    thue_suat: docSo(val('pn-thue-suat')) || 0,
    items,
  };
  const sua = dangSua.nhap;
  try {
    await goiApi(sua ? `/api/phieu-nhap/${sua.id}` : '/api/phieu-nhap', {
      method: sua ? 'PUT' : 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    hienToast(sua ? `Đã lưu thay đổi phiếu nhập ${sua.so_phieu}.` : 'Đã lưu phiếu nhập kho.');
    if (sua) thoatSua('nhap'); else datLaiFormNhap();
    chuyenTab('phieu-nhap');
    if (sua) moChiTietPhieu('nhap', sua.id); // xem ngay phiếu sau khi sửa
  } catch (err) {
    hienLoi(loiEl, esc(err.message));
  }
}));
// Xóa trắng form phiếu nhập (sau khi lưu / hủy sửa).
function datLaiFormNhap() {
  dongNhap = [];
  veBangDongNhap();
  ['pn-so-phieu','pn-ngay','pn-nha-cung-cap','pn-no-tk','pn-co-tk','pn-chung-tu','pn-nguoi-nhap','pn-don-vi','pn-nhap-tai-kho','pn-ly-do','pn-dia-diem']
    .forEach((id) => (document.getElementById(id).value = ''));
  const ts = document.getElementById('pn-thue-suat');
  ts.value = ts.defaultValue;
  capNhatTongNhap();
  datSoSach('pn', null);
  document.getElementById('upload-canh-bao').innerHTML = '';
  hienLoi(document.getElementById('pn-loi'), '');
}

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
  inputPdf.value = ''; // chọn lại đúng file đó lần nữa vẫn đọc được
});

function dongCanhBao(noiDung, nguy) {
  return `<div class="ui-note${nguy ? ' danger' : ''}"><i class="fas fa-${nguy ? 'circle-exclamation' : 'triangle-exclamation'}"></i><span>${noiDung}</span></div>`;
}

async function xuLyFilePdf(file) {
  if (dongNhap.some((d) => String(d.ten_hang || '').trim()) && !confirm('Thay các dòng hàng đang nhập bằng dữ liệu đọc từ hóa đơn này?')) return;
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

    if (kq.ngay) document.getElementById('pn-ngay').value = kq.ngay; // hóa đơn không đọc được ngày thì giữ ngày đang có
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
    // Đối chiếu tổng cộng của phiếu (tính như khi lưu: làm tròn từng dòng, rồi làm tròn thuế) với hóa đơn gốc.
    const tongCongPhieu = capNhatTongNhap();
    if (kq.tongCong) {
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
let vatTuTheoKhoa = new Map();
const vatTuTheoTen = (ten) => vatTuTheoKhoa.get(khoaTen(ten)) || null;
const vatTuCuaDong = (d) => (d.vat_tu_id && dsVatTu.find((v) => v.id === d.vat_tu_id)) || vatTuTheoTen(d.ten_hang);
// Tồn có thể xuất: đang sửa phiếu xuất thì cộng lại số cũ của chính phiếu đó (sửa 10 thành 12 chỉ cần còn thêm 2).
const tonCoTheXuat = (vt) => vt.ton_kho + ((dangSua.xuat && dangSua.xuat.congLai.get(vt.id)) || 0);

async function taiDanhSachVatTuChoXuat() {
  try {
    dsVatTu = await goiApi('/api/vat-tu');
  } catch (err) {
    hienToast('Không tải được danh sách vật tư: ' + err.message, true);
    return;
  }
  vatTuTheoKhoa = new Map(dsVatTu.map((v) => [khoaTen(v.ten_hang), v]));
  let datalist = document.getElementById('ds-vat-tu');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'ds-vat-tu';
    document.body.appendChild(datalist);
  }
  // Gợi ý chỉ các vật tư còn tồn, kèm số tồn + đơn vị tính.
  datalist.innerHTML = dsVatTu.filter((v) => tonCoTheXuat(v) > 0)
    .map((v) => `<option value="${esc(v.ten_hang)}" label="Tồn ${formatSo(tonCoTheXuat(v))}${v.dvt ? ' ' + esc(v.dvt) : ''}">`).join('');
  dongXuat.forEach((_, i) => capNhatDongXuatUI(i));
}

function dongXuatMoi(du = {}) {
  return {
    ma_so: du.ma_so || '',
    ghi_chu: du.ghi_chu || '',
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
  const vatTu = vatTuCuaDong(d);
  const ton = vatTu ? tonCoTheXuat(vatTu) : null;
  const thanhTien = thanhTienDong(d.sl_thuc_xuat, d.don_gia);
  tr.classList.toggle('is-danger', ton !== null && docSo(d.sl_thuc_xuat) - ton > 1e-6);
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
      <td class="col-bs"><input class="ui-input cell w-72" data-i="${i}" data-f="sl_yeu_cau" inputmode="decimal" data-so value="${esc(soO(d.sl_yeu_cau))}" aria-label="SL yêu cầu" /></td>
      <td><input class="ui-input cell w-72" data-i="${i}" data-f="sl_thuc_xuat" inputmode="decimal" data-so value="${esc(soO(d.sl_thuc_xuat))}" aria-label="SL thực xuất" /></td>
      <td><input class="ui-input cell w-96" data-i="${i}" data-f="don_gia" inputmode="decimal" data-so value="${esc(soO(d.don_gia))}" aria-label="Đơn giá" /></td>
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
        const vatTu = vatTuTheoTen(e.target.value);
        if (vatTu) {
          if (dongXuat[i].vat_tu_id !== vatTu.id) dongXuat[i].phieu_nhap_item_id = null; // đổi vật tư: bỏ liên kết dòng nhập cũ
          dongXuat[i].vat_tu_id = vatTu.id;
          dongXuat[i].dvt = vatTu.dvt || '';
          tbody.children[i].querySelector('[data-f="dvt"]').value = dongXuat[i].dvt;
        } else {
          // Tên không khớp vật tư nào: bỏ id cũ, tránh trừ nhầm kho của vật tư đã chọn trước đó.
          dongXuat[i].vat_tu_id = null;
          dongXuat[i].phieu_nhap_item_id = null;
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

function capNhatTongXuat() { return capNhatTong('px', dongXuat, 'sl_thuc_xuat'); }

document.getElementById('them-dong-xuat').addEventListener('click', () => {
  dongXuat.push(dongXuatMoi());
  veBangDongXuat();
});
document.getElementById('px-thue-suat').addEventListener('input', capNhatTongXuat);

document.getElementById('luu-phieu-xuat').addEventListener('click', (e) => khiKhoaNut(e.currentTarget, async () => {
  const loiEl = document.getElementById('px-loi');
  hienLoi(loiEl, '');
  const { hopLe, loi } = kiemTraDongHang(dongXuat, 'sl_thuc_xuat', 'bang-dong-xuat', (d, sl) => {
    if (!dsVatTu.length) return null; // chưa tải được danh sách vật tư: để máy chủ kiểm tra
    const vt = vatTuCuaDong(d);
    if (!vt) return 'vật tư chưa có trong kho — chọn đúng tên trong danh sách gợi ý';
    if (sl - tonCoTheXuat(vt) > 1e-6) return `vượt tồn kho (chỉ còn ${formatSo(tonCoTheXuat(vt))})`;
    return null;
  });
  if (loi.length) { hienLoi(loiEl, 'Sửa các dòng tô đỏ trước khi lưu:<br>' + loi.join('<br>')); return; }
  if (!hopLe.length) { hienLoi(loiEl, 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực xuất > 0.'); return; }
  const items = hopLe.map((d) => {
    const o = { ...d, sl_yeu_cau: docSo(d.sl_yeu_cau), sl_thuc_xuat: docSo(d.sl_thuc_xuat), don_gia: docSo(d.don_gia) || 0 };
    if (!o.phieu_nhap_item_id) delete o.phieu_nhap_item_id;
    return o;
  });
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
    thue_suat: docSo(val('px-thue-suat')) || 0,
    items,
  };
  const sua = dangSua.xuat;
  try {
    await goiApi(sua ? `/api/phieu-xuat/${sua.id}` : '/api/phieu-xuat', {
      method: sua ? 'PUT' : 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    });
    hienToast(sua ? `Đã lưu thay đổi phiếu xuất ${sua.so_phieu}.` : 'Đã lưu phiếu xuất kho.');
    if (sua) thoatSua('xuat'); else datLaiFormXuat();
    chuyenTab('phieu-xuat');
    if (sua) moChiTietPhieu('xuat', sua.id); // xem ngay phiếu sau khi sửa
  } catch (err) {
    hienLoi(loiEl, chuoiThieuTon(err));
  }
}));
// Xóa trắng form phiếu xuất (sau khi lưu / hủy sửa).
function datLaiFormXuat() {
  dongXuat = [];
  veBangDongXuat();
  ['px-so-phieu','px-ngay','px-nguoi-nhan','px-no-tk','px-co-tk','px-don-vi','px-ly-do','px-xuat-tai-kho','px-dia-diem','px-chung-tu']
    .forEach((id) => (document.getElementById(id).value = ''));
  const ts = document.getElementById('px-thue-suat');
  ts.value = ts.defaultValue;
  capNhatTongXuat();
  datSoSach('px', null);
  document.getElementById('px-chon-phieu-nhap').value = '';
  hienLoi(document.getElementById('px-loi'), '');
}

// ===== SỬA PHIẾU ĐÃ LƯU =====
// Dùng lại form tạo phiếu: điền sẵn thông tin + dòng hàng, nút Lưu gửi PUT. Máy chủ kiểm tra lại tồn kho và liên kết.
// Hỏi trước khi bỏ dữ liệu đang có trên form (phiếu mới gõ dở, hoặc đang sửa dở phiếu khác).
function coTheMoSua(loai, id) {
  const s = dangSua[loai];
  if (s && s.id === id) return true;
  if (s) return confirm(`Đang sửa dở phiếu ${s.so_phieu}. Bỏ các thay đổi đó để sửa phiếu này?`);
  const dong = loai === 'nhap' ? dongNhap : dongXuat;
  return !dong.some((d) => String(d.ten_hang || '').trim()) || confirm('Form tạo phiếu đang có dữ liệu chưa lưu. Bỏ dữ liệu đó để sửa phiếu này?');
}
// Mở form ở chế độ sửa phiếu p (đã tải kèm items).
function moSuaPhieu(loai, p) {
  if (namBiKhoa(p.ngay)) { hienToast(`Năm ${namCuaNgay(p.ngay)} đã khóa sổ: phiếu chỉ xem và xuất Excel.`, true); return; }
  const t = loai === 'nhap' ? 'pn' : 'px';
  dangSua[loai] = { id: p.id, so_phieu: p.so_phieu || '(không số)', ngay: p.ngay, congLai: new Map() };
  const dat = (id, v) => { document.getElementById(id).value = v === null || v === undefined ? '' : v; };
  dat(`${t}-so-phieu`, p.so_phieu);
  dat(`${t}-ngay`, p.ngay);
  dat(`${t}-no-tk`, p.no_tk);
  dat(`${t}-co-tk`, p.co_tk);
  dat(`${t}-don-vi`, p.don_vi);
  dat(`${t}-dia-diem`, p.dia_diem);
  dat(`${t}-chung-tu`, p.so_chung_tu_goc);
  dat(`${t}-thue-suat`, Number(p.thue_suat) || 0);
  datSoSach(t, p);
  if (loai === 'nhap') {
    dat('pn-nha-cung-cap', p.nha_cung_cap);
    dat('pn-nguoi-nhap', p.nguoi_nhap);
    dat('pn-nhap-tai-kho', p.nhap_tai_kho);
    dat('pn-ly-do', p.ly_do_nhap);
    dongNhap = (p.items || []).map((it) => dongNhapMoi(it));
    document.getElementById('upload-canh-bao').innerHTML = '';
    veBangDongNhap();
    capNhatTongNhap();
  } else {
    dat('px-nguoi-nhan', p.nguoi_nhan);
    dat('px-xuat-tai-kho', p.xuat_tai_kho);
    dat('px-ly-do', p.ly_do_xuat);
    (p.items || []).forEach((it) => {
      if (it.vat_tu_id) dangSua.xuat.congLai.set(it.vat_tu_id, (dangSua.xuat.congLai.get(it.vat_tu_id) || 0) + (Number(it.sl_thuc_xuat) || 0));
    });
    dongXuat = (p.items || []).map((it) => dongXuatMoi(it));
    document.getElementById('px-chon-phieu-nhap').value = '';
    veBangDongXuat();
    capNhatTongXuat();
  }
  hienLoi(document.getElementById(`${t}-loi`), '');
  hienCheDoSua(loai);
  chuyenTab(`tao-${loai}`);
  window.scrollTo(0, 0);
}
// Dải báo "Đang sửa phiếu ...", tiêu đề, nút Lưu; ẩn phần chỉ dùng khi tạo mới (tải hóa đơn PDF / lấy từ phiếu nhập).
function hienCheDoSua(loai) {
  const t = loai === 'nhap' ? 'pn' : 'px';
  const ten = loai === 'nhap' ? 'phiếu nhập' : 'phiếu xuất';
  const s = dangSua[loai];
  const dai = document.getElementById(`${t}-dang-sua`);
  dai.hidden = !s;
  dai.innerHTML = s
    ? `<i class="fas fa-pen"></i><span>Đang sửa ${ten} <b>${esc(s.so_phieu)}</b> ngày ${esc(ngayVN(s.ngay))}. Lưu xong, tồn kho tự tính lại theo số mới.</span>
       <button type="button" class="btn btn-neutral btn-sm" data-huy-sua>Hủy sửa</button>`
    : '';
  document.getElementById(`${t}-tieu-de`).textContent = s ? `Sửa ${ten} kho ${s.so_phieu}` : `Tạo ${ten} kho`;
  const moTa = document.getElementById(`${t}-tieu-de`).nextElementSibling;
  if (!moTa.dataset.goc) moTa.dataset.goc = moTa.textContent;
  moTa.textContent = !s ? moTa.dataset.goc : 'Sửa thông tin, dòng hàng, số lượng, đơn giá rồi bấm "Lưu thay đổi". '
    + (loai === 'nhap' ? 'Dòng đã có phiếu xuất lấy theo không giảm được dưới số đã xuất.' : 'Cột "Tồn" đã cộng lại số của chính phiếu này.');
  document.getElementById(`luu-phieu-${loai}`).innerHTML = `<i class="fas fa-floppy-disk"></i> ${s ? `Lưu thay đổi ${esc(s.so_phieu)}` : `Lưu ${ten} kho`}`;
  const anKhiSua = loai === 'nhap' ? document.getElementById('upload-vung').closest('.ui-card') : document.getElementById('px-chon-phieu-nhap').closest('.ui-field');
  anKhiSua.style.display = s ? 'none' : '';
}
function thoatSua(loai) {
  dangSua[loai] = null;
  if (loai === 'nhap') datLaiFormNhap(); else datLaiFormXuat();
  hienCheDoSua(loai);
}
['nhap', 'xuat'].forEach((loai) => {
  document.getElementById(`${loai === 'nhap' ? 'pn' : 'px'}-dang-sua`).addEventListener('click', (e) => {
    if (!e.target.closest('[data-huy-sua]') || !confirm('Hủy sửa phiếu? Các thay đổi chưa lưu sẽ bị bỏ.')) return;
    thoatSua(loai);
    chuyenTab(`phieu-${loai}`);
  });
});
// Bấm biểu tượng bút ở danh sách phiếu: tải phiếu rồi mở form sửa.
async function suaTuDanhSach(loai, id) {
  if (!coTheMoSua(loai, id)) return;
  let p;
  try { p = await goiApi(`/api/phieu-${loai}/${id}`); } catch (err) { hienToast('Không tải được phiếu: ' + err.message, true); return; }
  moSuaPhieu(loai, p);
}

// ===== Chọn phiếu nhập để tự điền phiếu xuất =====
async function taiDanhSachPhieuNhapChoChon(idSelect) {
  let ds;
  try {
    ds = await goiApi('/api/phieu-nhap');
  } catch (err) {
    hienToast('Không tải được danh sách phiếu nhập: ' + err.message, true);
    return;
  }
  const sel = document.getElementById(idSelect);
  const dangChon = sel.value;
  sel.innerHTML = `<option value="">${idSelect === 'px-chon-phieu-nhap' ? '— Không, tự nhập tay —' : '— Chọn phiếu nhập —'}</option>` +
    ds.map((p) => `<option value="${p.id}">${esc(p.so_phieu || '(không số)')} — ${esc(ngayVN(p.ngay))} — ${esc(String(p.nha_cung_cap || p.ly_do_nhap || p.nguoi_nhap || '').slice(0, 60))} (${p.so_dong} dòng)</option>`).join('');
  sel.value = dangChon;
}

document.getElementById('px-chon-phieu-nhap').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) return;
  let phieu;
  try { phieu = await goiApi('/api/phieu-nhap/' + id); } catch (err) { hienToast('Không tải được phiếu nhập: ' + err.message, true); return; }
  if (!val('px-so-phieu') && goiYPX.so_phieu.length) document.getElementById('px-so-phieu').value = goiYPX.so_phieu[0];
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

// Nhóm mới: điền sẵn số phiếu xuất kế tiếp chưa dùng ở nhóm khác (vẫn sửa được).
function txNhomMoi() {
  const daDung = new Set(txNhom.map((n) => n.so_phieu));
  return { nguoi_nhan: '', don_vi: '', so_phieu: (goiYPX.so_phieu || []).find((so) => !daDung.has(so)) || '' };
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
      <div class="ui-field">Nhóm ${i + 1} — Người nhận<input class="ui-input" data-nhom="${i}" data-f="nguoi_nhan" value="${esc(n.nguoi_nhan)}" list="ds-goi-y-px-nguoi" autocomplete="off" /></div>
      <div class="ui-field">Đơn vị<input class="ui-input" data-nhom="${i}" data-f="don_vi" value="${esc(n.don_vi)}" list="ds-goi-y-px-don-vi" autocomplete="off" /></div>
      <div class="ui-field">Số phiếu<input class="ui-input" data-nhom="${i}" data-f="so_phieu" value="${esc(n.so_phieu)}" list="ds-goi-y-px-so" placeholder="Số phiếu xuất" autocomplete="off" /></div>
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
    const oNhom = txNhom.map((_, i) => `<td><input class="ui-input cell w-72" inputmode="decimal" data-so data-item="${it.id}" data-nhom-idx="${i}" value="${esc(soO(phanBo[i] || 0))}" aria-label="Số lượng nhóm ${i + 1}" /></td>`).join('');
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
      txPhanBo[itemId][idx] = docSo(e.target.value) || 0;
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
  if (txNhom.length === 0) { txNhom.push(txNhomMoi()); txNhom.push(txNhomMoi()); veNhomList(); }
  txDongBoDoDaiPhanBo();
  // Chia đều: số nguyên thì dồn phần dư cho các nhóm đầu; số lẻ (kg, m...) chia 3 chữ số thập phân.
  // Nhóm cuối luôn nhận đúng phần còn lại nên tổng không bao giờ vượt số đã nhập.
  const n = txNhom.length;
  const lam3 = (x) => Math.round(x * 1000) / 1000;
  txItems.forEach((it) => {
    const tong = Number(it.sl_thuc_nhap) || 0;
    let daChia = 0;
    txPhanBo[it.id] = txNhom.map((_, k) => {
      if (k === n - 1) return lam3(tong - daChia);
      const sl = Number.isInteger(tong) ? Math.floor(tong / n) + (k < tong % n ? 1 : 0) : Math.floor((tong / n) * 1000) / 1000;
      daChia += sl;
      return sl;
    });
  });
  veBangPhanBo();
});

document.getElementById('tx-phieu-nhap').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) { txItems = []; veBangPhanBo(); return; }
  let phieu;
  try { phieu = await goiApi('/api/phieu-nhap/' + id); } catch (err) { hienToast('Không tải được phiếu nhập: ' + err.message, true); return; }
  document.getElementById('tx-ly-do').value = `Xuất theo phiếu nhập ${phieu.so_phieu || '#' + phieu.id}`;
  datSoSach('tx', phieu); // mặc định thừa hưởng thông tin sổ sách của phiếu nhập, vẫn sửa được
  txItems = (phieu.items || []).map((it) => ({ id: it.id, ten_hang: it.ten_hang, dvt: it.dvt, sl_thuc_nhap: it.sl_thuc_nhap }));
  txPhanBo = {};
  txDongBoDoDaiPhanBo();
  veBangPhanBo();
});

document.getElementById('tx-tao-phieu').addEventListener('click', (e) => khiKhoaNut(e.currentTarget, async () => {
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
    // Các nhóm có hàng (đúng thứ tự máy chủ tạo phiếu) -> đường dẫn mở ngay từng phiếu vừa tạo.
    const nhomCoHang = txNhom.filter((_, i) => txItems.some((it) => ((txPhanBo[it.id] || [])[i] || 0) > 0));
    const lienKet = (kq.ids || []).map((idPx, k) => `<button type="button" class="nut-lien-ket" data-ct="xuat:${idPx}">${esc((nhomCoHang[k] && nhomCoHang[k].so_phieu) || 'Phiếu ' + (k + 1))}</button>`).join(', ');
    let html = `<i class="fas fa-circle-check"></i><span>Đã tạo ${kq.so_phieu_da_tao} phiếu xuất${lienKet ? `: ${lienKet}` : ''}.</span>`;
    if (kq.canh_bao && kq.canh_bao.length) {
      html += '<br>' + kq.canh_bao.map((w) => `<i class="fas fa-triangle-exclamation"></i> ${esc(w)}`).join('<br>');
    }
    ketQuaEl.innerHTML = html;
    ketQuaEl.style.display = 'flex';
    document.getElementById('tx-phieu-nhap').value = '';
    datSoSach('tx', null);
    txItems = []; txNhom = []; txPhanBo = {};
    veNhomList(); veBangPhanBo();
    taiGoiYPhieuXuat(); // số phiếu vừa dùng -> gợi ý số kế tiếp mới
  } catch (err) {
    hienLoi(loiEl, chuoiThieuTon(err));
  }
}));
document.getElementById('tx-ket-qua').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ct]');
  if (b) moChiTietPhieu('xuat', Number(b.dataset.ct.split(':')[1]));
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
// Mở lần đầu: chọn sẵn quý có phiếu gần nhất (chưa có phiếu thì quý hiện tại) và xem ngay.
// Đổi quý hoặc năm thì xem lại luôn, không cần bấm nút.
async function khoiTaoSoTongHop() {
  if (thDaKhoiTao) return;
  thDaKhoiTao = true;
  let ngay = homNayISO();
  try {
    const [n, x] = await Promise.all([goiApi('/api/phieu-nhap'), goiApi('/api/phieu-xuat')]);
    const ganNhat = [...n, ...x].map((p) => String(p.ngay || '').slice(0, 10)).filter((d) => d.length === 10 && d <= ngay).sort().pop();
    if (ganNhat) ngay = ganNhat;
  } catch (e) { /* lỗi thì dùng ngày hôm nay */ }
  document.getElementById('th-nam').value = Number(ngay.slice(0, 4));
  datQuy(Math.floor((Number(ngay.slice(5, 7)) - 1) / 3) + 1);
  document.getElementById('th-xem').click();
}
document.querySelectorAll('#th-quy button').forEach((b) =>
  b.addEventListener('click', () => { datQuy(Number(b.dataset.quy)); document.getElementById('th-xem').click(); })
);
document.getElementById('th-nam').addEventListener('change', () => document.getElementById('th-xem').click());

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
  // Máy chủ trả {dong, tong: {'661.2': {...}, '337': {...}}, canh_bao}.
  const rows = (kq && kq.dong) || [];
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
  const tongCong = (khoa) => Object.values(tong).reduce((s, v) => s + (Number(v && v[khoa]) || 0), 0);
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
    const ten = await taiFile('/api/tong-hop/xuat-excel?' + tham.qs, `SoTongHop_${tham.cacQuy ? '4quy' : (thQuy ? 'Q' + thQuy : 'canam')}_${tham.nam}.xlsx`);
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
// Độ rộng cột nền giống file Excel xuất ra (xuatMauPhieu.js); file thật còn tự nới cột số theo số dài nhất.
const DO_RONG_MAU = {
  nhap: [5, 30, 8, 6.5, 8, 8, 11, 13, 10],
  xuat: [5, 30, 8, 6.5, 8, 8, 11, 13, 10],
};
// Chia cột cho người ký theo độ rộng thật — cùng thuật toán với file Excel: cụm hẹp nhất rộng nhất có thể.
function chiaCumKy(doRong, n) {
  const m = doRong.length;
  n = Math.max(1, Math.min(n, m));
  const tien = [0];
  doRong.forEach((w) => tien.push(tien[tien.length - 1] + w));
  const nho = new Map();
  const tot = (i, k) => {
    const khoa = `${i}|${k}`;
    if (nho.has(khoa)) return nho.get(khoa);
    let kq;
    if (k === 1) kq = { min: tien[m] - tien[i], max: tien[m] - tien[i], cat: [] };
    else {
      for (let j = i + 1; j <= m - (k - 1); j++) {
        const sau = tot(j, k - 1);
        const w = tien[j] - tien[i];
        const ung = { min: Math.min(w, sau.min), max: Math.max(w, sau.max), cat: [j, ...sau.cat] };
        if (!kq || ung.min > kq.min + 1e-9 || (Math.abs(ung.min - kq.min) < 1e-9 && ung.max < kq.max)) kq = ung;
      }
    }
    nho.set(khoa, kq);
    return kq;
  };
  const diem = [0, ...tot(0, n).cat, m];
  return diem.slice(0, -1).map((a, i) => diem[i + 1] - a); // số cột (colspan) của từng người
}
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

// Mỗi người ký chiếm 1 cụm cột riêng, chia theo độ rộng thật của cột — đúng cách file Excel xuất ra.
function veChuKy(loai) {
  const tbody = document.getElementById(`xl-ky-${loai}`);
  const ds = chNguoiKy[loai];
  const batDau = Number(tbody.dataset.dongBatDau);
  const cacCot = ds.length ? chiaCumKy(DO_RONG_MAU[loai], ds.length) : [];
  const hang = (n, noiDung, cao) => `<tr${cao ? ` style="height:${cao}px"` : ''}><th class="xl-so-dong">${n}</th>${noiDung}</tr>`;
  const khung = (render) => ds.map((nk, i) => `<td colspan="${cacCot[i]}" class="xl-giua xl-cau-hinh">${render(nk, i)}</td>`).join('');

  tbody.innerHTML =
    hang(batDau, khung((nk, i) => `<div class="xl-ky-o"><textarea rows="2" class="xl-nhap xl-giua xl-dam" data-ky="chucDanh" data-i="${i}" placeholder="Chức danh"></textarea><button type="button" class="xl-xoa" data-xoa="${i}" title="Bỏ người ký này"><i class="fas fa-xmark"></i></button></div>`), 44) +
    hang(batDau + 1, khung(() => '<span class="xl-xam xl-in-nghieng">(Ký, họ tên)</span>'), 60) +
    hang(batDau + 2, khung((nk, i) => `<textarea rows="2" class="xl-nhap xl-giua xl-dam" data-ky="ten" data-i="${i}" placeholder="${/người\s+(giao|nhận)\s+hàng/i.test(nk.chucDanh) ? 'Để trống = lấy theo người ghi trên từng phiếu' : 'Họ tên (có thể để trống)'}"></textarea>`), 44) +
    hang(batDau + 3, `<td colspan="9" class="xl-them-ky"><button type="button" class="btn btn-neutral btn-sm" data-them-ky ${ds.length >= CH_SO_NGUOI_KY_TOI_DA ? 'disabled' : ''}><i class="fas fa-plus"></i> Thêm người ký</button></td>`);

  tbody.querySelectorAll('[data-ky]').forEach((inp) => {
    const nk = ds[Number(inp.dataset.i)];
    inp.value = nk[inp.dataset.ky];
    inp.addEventListener('input', () => { nk[inp.dataset.ky] = inp.value; });
  });
  tbody.querySelectorAll('[data-xoa]').forEach((b) => b.addEventListener('click', () => {
    ds.splice(Number(b.dataset.xoa), 1);
    chDaSua[loai] = true;
    veChuKy(loai);
  }));
  tbody.querySelector('[data-them-ky]').addEventListener('click', () => {
    ds.push({ chucDanh: '', ten: '' });
    chDaSua[loai] = true;
    veChuKy(loai);
    tbody.querySelector(`[data-ky="chucDanh"][data-i="${ds.length - 1}"]`).focus();
  });
}

// Mẫu phiếu đang sửa dở (chưa lưu) thì quay lại màn này không tải đè từ máy chủ.
const chDaSua = { nhap: false, xuat: false };
['nhap', 'xuat'].forEach((loai) => document.getElementById(`cau-hinh-${loai}`).addEventListener('input', () => { chDaSua[loai] = true; }));
async function taiCauHinh(loai) {
  if (chDaSua[loai]) return;
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
    chDaSua[loai] = false;
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
// Năm đã khóa sổ: tải nền; danh sách phiếu nào đã hiện thì vẽ lại để có dấu khóa.
taiNamKhoa().then(() => { if (plTT.nhap.rows.length) vePhieu('nhap'); if (plTT.xuat.rows.length) vePhieu('xuat'); });
