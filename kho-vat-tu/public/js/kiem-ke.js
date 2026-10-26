// ===== KIỂM KÊ TÀI SẢN =====
// Danh sách đợt -> mở 1 đợt để đánh dấu Có / Không thấy / Hỏng (từng dòng, hàng loạt, hoặc quét mã + Enter)
// -> chốt đợt (tùy chọn cập nhật Hỏng vào danh mục + ghi lịch sử) -> xuất biên bản kiểm kê Excel theo mẫu.

const KK_KQ = [
  ['co', 'Có', 'ui-tone-primary', 'check'],
  ['hong', 'Hỏng', 'ui-tone-warning', 'screwdriver-wrench'],
  ['khong_thay', 'Không thấy', 'ui-tone-danger', 'question'],
];
const KK_LOAI = { TSCD: 'Tài sản cố định', CCDC: 'Công cụ dụng cụ', TAT_CA: 'TSCĐ và CCDC' };
const KK_TRANG = 300;
const kkTT = { dot: null, dong: [], loc: { q: '', bo_phan: '', ket_qua: '' }, chon: new Set(), hien: KK_TRANG };

function kkSec() { return document.getElementById('kiem-ke'); }
function kkPhamVi(k) {
  return [k.truong, k.bo_phan && `Bộ phận: ${k.bo_phan}`, k.nhom && `Nhóm: ${k.nhom}`].filter(Boolean).join(' · ') || 'Toàn bộ';
}
function kkTienDo(k) {
  const pt = k.tong ? Math.round((k.da_kiem / k.tong) * 100) : 0;
  return `<div class="kk-tien-do" title="${k.da_kiem}/${k.tong} đã kiểm"><div style="width:${pt}%"></div></div><span class="kk-pt">${formatSo(k.da_kiem)}/${formatSo(k.tong)} (${pt}%)</span>`;
}
const kkPillTT = (k) => (k.trang_thai === 'da_chot' ? '<span class="ui-pill ui-tone-neutral">Đã chốt</span>' : '<span class="ui-pill ui-tone-primary">Đang kiểm</span>');

// ---------- Danh sách đợt ----------
async function taiKiemKe() {
  kkTT.dot = null;
  const sec = kkSec();
  sec.innerHTML = `
    <div class="ui-head">
      <div><h1>Kiểm kê tài sản</h1><p>Tạo đợt kiểm kê theo phạm vi, đánh dấu Có / Không thấy / Hỏng cho từng tài sản, chốt đợt và xuất biên bản Excel.</p></div>
      <div class="ui-head-actions"><button class="btn btn-primary" type="button" data-kk-tao><i class="fas fa-plus"></i> Tạo đợt kiểm kê</button></div>
    </div>
    <div class="ui-card"><div class="ui-table-scroll"><table class="ui-table kk-ds">
      <thead><tr><th>Đợt kiểm kê</th><th>Ngày</th><th>Tiến độ</th><th class="num">Có</th><th class="num">Hỏng</th><th class="num">Không thấy</th><th>Trạng thái</th><th></th></tr></thead>
      <tbody data-kk-ds>${oTrong(8, 'spinner', 'Đang tải...')}</tbody>
    </table></div></div>`;
  sec.querySelector('[data-kk-tao]').addEventListener('click', kkMoTao);
  let ds;
  try { ds = await goiApi('/api/kiem-ke'); } catch (err) { sec.querySelector('[data-kk-ds]').innerHTML = oTrong(8, 'triangle-exclamation', esc(err.message)); return; }
  const tb = sec.querySelector('[data-kk-ds]');
  if (!ds.length) { tb.innerHTML = oTrong(8, 'clipboard-check', 'Chưa có đợt kiểm kê nào. Bấm &quot;Tạo đợt kiểm kê&quot; để bắt đầu.'); return; }
  tb.innerHTML = ds.map((k) => `
    <tr data-kk-mo="${k.id}" class="kk-dong-dot">
      <td><b>${esc(k.ten)}</b><span class="ds-sub">${esc(KK_LOAI[k.loai] || k.loai)} · ${esc(kkPhamVi(k))}</span></td>
      <td class="th-nowrap">${esc(ngayVN(k.ngay))}</td>
      <td class="kk-o-tien-do">${kkTienDo(k)}</td>
      <td class="num">${formatSo(k.co)}</td><td class="num">${formatSo(k.hong)}</td><td class="num">${formatSo(k.khong_thay)}</td>
      <td>${kkPillTT(k)}</td>
      <td class="ds-nut-cell"><div class="ds-nut">
        <a class="btn btn-sm btn-neutral" href="/api/kiem-ke/${k.id}/bien-ban" title="Xuất biên bản kiểm kê Excel"><i class="fas fa-file-excel"></i> Biên bản</a>
        <button class="btn btn-sm btn-danger" type="button" data-kk-xoa="${k.id}" title="Xóa đợt"><i class="fas fa-trash"></i></button>
      </div></td>
    </tr>`).join('');
  tb.addEventListener('click', async (e) => {
    if (e.target.closest('a')) return;
    const xoa = e.target.closest('[data-kk-xoa]');
    if (xoa) {
      if (!confirm('Xóa đợt kiểm kê này cùng toàn bộ kết quả đã đánh dấu? (Lịch sử đã ghi vào tài sản khi chốt vẫn giữ nguyên.)')) return;
      try { await goiApi('/api/kiem-ke/' + xoa.dataset.kkXoa, { method: 'DELETE' }); hienToast('Đã xóa đợt kiểm kê.'); taiKiemKe(); } catch (err) { hienToast(err.message, true); }
      return;
    }
    const tr = e.target.closest('[data-kk-mo]');
    if (tr) kkMoDot(Number(tr.dataset.kkMo));
  });
}

async function kkMoTao() {
  let g1; let g2;
  try { [g1, g2] = await Promise.all([goiApi('/api/tai-san/goi-y?loai=TSCD'), goiApi('/api/tai-san/goi-y?loai=CCDC')]); } catch (err) { hienToast(err.message, true); return; }
  const hop = (k) => [...new Set([...(g1[k] || []), ...(g2[k] || [])])].sort((a, b) => a.localeCompare(b, 'vi'));
  const nam = new Date().getFullYear();
  const goc = moDialog('Tạo đợt kiểm kê', 'Danh sách tài sản và số liệu sổ sách được chụp lại tại ngày kiểm kê.',
    `<div class="ui-form-grid">
       <div class="ui-field span-2">Tên đợt *<input id="kk-ten" class="ui-input" value="Kiểm kê tài sản cố định năm ${nam}" /></div>
       <div class="ui-field">Ngày kiểm kê *<input id="kk-ngay" class="ui-input" type="date" value="${homNayISO()}" /></div>
       <div class="ui-field">Loại tài sản<select id="kk-loai" class="ui-input"><option value="TSCD">Tài sản cố định</option><option value="CCDC">Công cụ dụng cụ</option><option value="TAT_CA">Cả TSCĐ và CCDC</option></select></div>
       <div class="ui-field span-2">Trường<select id="kk-truong" class="ui-input"><option value="">Tất cả các trường</option>${g1.truong.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div>
       <div class="ui-field">Bộ phận (để trống = tất cả)<input id="kk-bo-phan" class="ui-input" list="kk-dl-bp" autocomplete="off" /></div>
       <div class="ui-field span-2">Nhóm tài sản (để trống = tất cả)<input id="kk-nhom" class="ui-input" list="kk-dl-nhom" autocomplete="off" /></div>
       <div class="ui-field span-3">Ban kiểm kê — mỗi người một dòng: Họ tên - Chức vụ - Vai trò (dòng đầu là Trưởng ban)
         <textarea id="kk-ban" class="ui-input" rows="4" placeholder="Nguyễn Văn A - Phó Hiệu trưởng - Trưởng ban&#10;Trần Thị B - Kế toán - Thành viên&#10;Lê Văn C - Phòng QLCSVC - Thành viên"></textarea></div>
       <div class="ui-field span-3">Ghi chú<input id="kk-ghi-chu" class="ui-input" /></div>
     </div>
     ${tsDl('kk-dl-bp', hop('bo_phan'))}${tsDl('kk-dl-nhom', hop('nhom'))}
     <div id="kk-loi" class="ui-note danger" style="display:none"></div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Hủy</button><button class="btn btn-primary" type="button" id="kk-ok"><i class="fas fa-clipboard-check"></i> Tạo đợt</button>`);
  const ten = document.getElementById('kk-ten');
  let tuSua = false;
  ten.addEventListener('input', () => { tuSua = true; });
  document.getElementById('kk-loai').addEventListener('change', (e) => {
    if (!tuSua) ten.value = `Kiểm kê ${{ TSCD: 'tài sản cố định', CCDC: 'công cụ dụng cụ', TAT_CA: 'tài sản' }[e.target.value]} năm ${nam}`;
  });
  document.getElementById('kk-ok').addEventListener('click', async () => {
    const loiEl = document.getElementById('kk-loi');
    hienLoi(loiEl, '');
    const nut = document.getElementById('kk-ok');
    nut.disabled = true;
    try {
      const k = await goiApi('/api/kiem-ke', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({
        ten: val('kk-ten'), ngay: val('kk-ngay'), loai: document.getElementById('kk-loai').value, truong: document.getElementById('kk-truong').value,
        bo_phan: val('kk-bo-phan'), nhom: val('kk-nhom'), ban_kiem_ke: document.getElementById('kk-ban').value, ghi_chu: val('kk-ghi-chu'),
      }) });
      dongDialog();
      hienToast(`Đã tạo đợt kiểm kê với ${formatSo(k.tong)} tài sản.`);
      kkMoDot(k.id);
    } catch (err) { nut.disabled = false; hienLoi(loiEl, esc(err.message)); }
  });
}

// ---------- Màn hình 1 đợt ----------
async function kkMoDot(id) {
  let d;
  try { d = await goiApi('/api/kiem-ke/' + id); } catch (err) { hienToast(err.message, true); return; }
  kkTT.dot = d;
  kkTT.dong = d.dong;
  delete kkTT.dot.dong;
  kkTT.chon.clear();
  kkTT.hien = KK_TRANG;
  kkTT.loc = { q: '', bo_phan: '', ket_qua: '' };
  const sec = kkSec();
  const boPhan = [...new Set(kkTT.dong.map((x) => x.bo_phan).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  sec.innerHTML = `
    <div class="ui-head">
      <div>
        <button class="btn btn-ghost btn-sm kk-quay-lai" type="button" data-kk-quay><i class="fas fa-arrow-left"></i> Danh sách đợt</button>
        <h1 data-kk-tieu-de></h1><p data-kk-phu-de></p>
      </div>
      <div class="ui-head-actions" data-kk-nut-dau></div>
    </div>
    <div class="ui-note" data-kk-khoa hidden><i class="fas fa-lock"></i><span>Đợt đã chốt — chỉ xem và xuất biên bản. Tick các dòng "Không thấy" / "Hỏng" để ghi giảm hoặc đổi tình trạng trong danh mục tài sản. Bấm "Mở lại đợt" nếu cần sửa kết quả.</span></div>
    <div class="ui-card kk-tong-quan">
      <div class="kk-thanh" data-kk-thanh></div>
      <div class="kk-quet" data-kk-quet-khung>
        <i class="fas fa-barcode"></i>
        <input class="ui-input" data-kk-quet placeholder="Nhập hoặc quét mã tài sản rồi Enter để đánh dấu Có" autocomplete="off" />
        <span class="kk-quet-kq" data-kk-quet-kq></span>
      </div>
    </div>
    <div class="ui-card">
      <div class="ts-loc">
        <input class="ui-input" data-kk-loc="q" placeholder="Tìm mã, tên, nơi sử dụng, ghi chú..." />
        <select class="ui-input" data-kk-loc="bo_phan"><option value="">Mọi bộ phận</option>${boPhan.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join('')}</select>
        <select class="ui-input" data-kk-loc="ket_qua"><option value="">Mọi kết quả</option><option value="chua">Chưa kiểm</option>${KK_KQ.map((k) => `<option value="${k[0]}">${k[1]}</option>`).join('')}</select>
        <button class="btn btn-secondary btn-sm" type="button" data-kk-co-het><i class="fas fa-check-double"></i> Đánh dấu Có cho mọi dòng chưa kiểm (theo bộ lọc)</button>
      </div>
      <div class="ts-thanh-chon" data-kk-thanh-chon hidden></div>
      <div class="ui-table-scroll"><table class="ui-table kk-bang">
        <thead><tr><th class="ts-o-chon"><input type="checkbox" data-kk-chon-het title="Chọn tất cả dòng đang lọc" /></th><th>Mã</th><th>Tên tài sản</th><th>Nơi sử dụng</th><th class="num">SL sổ</th><th>Kết quả</th><th class="num">SL thực tế</th><th>Ghi chú</th></tr></thead>
        <tbody data-kk-bang></tbody>
      </table></div>
      <div class="ts-chan-bang" data-kk-chan></div>
    </div>`;
  sec.querySelector('[data-kk-quay]').addEventListener('click', taiKiemKe);
  let hen;
  sec.querySelectorAll('[data-kk-loc]').forEach((el) => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
    kkTT.loc[el.dataset.kkLoc] = el.value.trim();
    clearTimeout(hen);
    hen = setTimeout(() => { kkTT.hien = KK_TRANG; kkVeBang(); }, el.tagName === 'INPUT' ? 200 : 0);
  }));
  sec.querySelector('[data-kk-co-het]').addEventListener('click', () => {
    const ids = kkLoc().filter((x) => !x.ket_qua).map((x) => x.id);
    if (!ids.length) { hienToast('Không còn dòng chưa kiểm khớp bộ lọc.'); return; }
    if (!confirm(`Đánh dấu "Có" cho ${formatSo(ids.length)} dòng chưa kiểm khớp bộ lọc (kể cả dòng chưa hiện trên trang)?`)) return;
    kkGhi(ids, { ket_qua: 'co' });
  });
  sec.querySelector('[data-kk-chon-het]').addEventListener('change', (e) => {
    if (e.target.checked) kkLoc().forEach((x) => kkTT.chon.add(x.id)); else kkTT.chon.clear();
    kkVeBang();
  });
  const quet = sec.querySelector('[data-kk-quet]');
  quet.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !quet.value.trim()) return;
    const ma = quet.value.trim();
    quet.value = '';
    await kkQuet(ma);
    quet.focus();
  });
  const tb = sec.querySelector('[data-kk-bang]');
  tb.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    const nutKq = e.target.closest('[data-kq]');
    if (nutKq) {
      // Bấm đúp = 2 lần bấm: lần 2 sẽ bỏ đánh dấu vừa đặt -> bỏ qua; dòng đang lưu cũng bỏ qua.
      if (kkKhoa() || e.detail > 1 || kkDangGhi.has(id)) return;
      const x = kkTT.dong.find((r) => r.id === id);
      kkGhi([id], { ket_qua: x.ket_qua === nutKq.dataset.kq ? null : nutKq.dataset.kq }); // bấm lại = bỏ đánh dấu
      return;
    }
    if (e.target.closest('.ts-o-chon')) {
      const cb = tr.querySelector('.ts-o-chon input');
      if (e.target !== cb) cb.checked = !cb.checked;
      if (cb.checked) kkTT.chon.add(id); else kkTT.chon.delete(id);
      tr.classList.toggle('ts-dang-chon', cb.checked);
      kkVeThanhChon();
    }
  });
  tb.addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr || kkKhoa()) return;
    const id = Number(tr.dataset.id);
    if (e.target.matches('[data-kk-sl]')) {
      const sl = docSo(e.target.value);
      if (Number.isNaN(sl) || sl < 0) { hienToast('Số lượng thực tế không hợp lệ.', true); return; }
      kkGhi([id], { so_luong_thuc_te: sl === null ? '' : sl });
    }
    if (e.target.matches('[data-kk-gc]')) kkGhi([id], { ghi_chu: e.target.value });
  });
  sec.querySelector('[data-kk-chan]').addEventListener('click', (e) => { if (e.target.closest('[data-kk-them]')) { kkTT.hien += KK_TRANG; kkVeBang(); } });
  kkVeDau();
  kkVeBang();
  quet.focus();
}

const kkKhoa = () => kkTT.dot && kkTT.dot.trang_thai === 'da_chot';

function kkVeDau() {
  const k = kkTT.dot;
  const sec = kkSec();
  sec.querySelector('[data-kk-tieu-de]').textContent = k.ten;
  sec.querySelector('[data-kk-phu-de]').innerHTML = `${esc(KK_LOAI[k.loai])} · ${esc(kkPhamVi(k))} · Ngày kiểm kê ${esc(ngayVN(k.ngay))} · ${kkPillTT(k)}`;
  const khoa = kkKhoa();
  sec.querySelector('[data-kk-khoa]').hidden = !khoa;
  sec.querySelector('[data-kk-quet-khung]').style.display = khoa ? 'none' : '';
  sec.querySelector('[data-kk-co-het]').style.display = khoa ? 'none' : '';
  sec.querySelector('[data-kk-nut-dau]').innerHTML = `
    <button class="btn btn-neutral" type="button" data-kk-sua><i class="fas fa-pen"></i> Thông tin đợt</button>
    <a class="btn btn-secondary" href="/api/kiem-ke/${k.id}/bien-ban"><i class="fas fa-file-excel"></i> Xuất biên bản</a>
    ${khoa ? '<button class="btn btn-neutral" type="button" data-kk-mo-lai><i class="fas fa-lock-open"></i> Mở lại đợt</button>'
      : '<button class="btn btn-primary" type="button" data-kk-chot><i class="fas fa-lock"></i> Chốt đợt</button>'}`;
  sec.querySelector('[data-kk-sua]').addEventListener('click', kkSuaDot);
  const chot = sec.querySelector('[data-kk-chot]');
  if (chot) chot.addEventListener('click', kkChot);
  const moLai = sec.querySelector('[data-kk-mo-lai]');
  if (moLai) moLai.addEventListener('click', async () => {
    if (!confirm('Mở lại đợt kiểm kê để sửa kết quả? Khi chốt lại, lịch sử kiểm kê của đợt này trong từng tài sản được ghi đè (không ghi trùng).')) return;
    try { kkTT.dot = await goiApi(`/api/kiem-ke/${k.id}/mo-lai`, { method: 'POST' }); hienToast('Đã mở lại đợt kiểm kê.'); kkVeDau(); kkVeBang(); } catch (err) { hienToast(err.message, true); }
  });
  const chua = k.tong - k.da_kiem;
  const chip = (nhan, so, gt, lop) => `<button type="button" class="ts-chip ${lop || ''}${kkTT.loc.ket_qua === gt ? ' dang' : ''}" data-kk-chip="${gt}">${nhan} <b>${formatSo(so)}</b></button>`;
  sec.querySelector('[data-kk-thanh]').innerHTML = `
    <div class="kk-tien-do-lon">${kkTienDo(k)}</div>
    <div class="ts-chip-hang">${chip('Chưa kiểm', chua, 'chua')}${chip('Có', k.co, 'co')}${chip('Hỏng', k.hong, 'hong')}${chip('Không thấy', k.khong_thay, 'khong_thay')}</div>`;
  sec.querySelectorAll('[data-kk-chip]').forEach((b) => b.addEventListener('click', () => {
    kkTT.loc.ket_qua = kkTT.loc.ket_qua === b.dataset.kkChip ? '' : b.dataset.kkChip;
    sec.querySelector('[data-kk-loc="ket_qua"]').value = kkTT.loc.ket_qua;
    kkTT.hien = KK_TRANG;
    kkVeDau();
    kkVeBang();
  }));
}

function kkLoc() {
  const { q, bo_phan: bp, ket_qua: kq } = kkTT.loc;
  const tu = chuoiTim(q); // không phân biệt dấu: "may tinh" tìm được "Máy tính"
  return kkTT.dong.filter((x) => (!bp || x.bo_phan === bp)
    && (!kq || (kq === 'chua' ? !x.ket_qua : x.ket_qua === kq))
    && (!tu || chuoiTim([x.ma_tai_san, x.ten, x.bo_phan, x.vi_tri, x.nguoi_su_dung, x.ghi_chu, x.nhom].join(' ')).includes(tu)));
}

function kkHtmlDong(x) {
  const khoa = kkKhoa();
  const noi = [x.bo_phan, x.nguoi_su_dung, x.vi_tri].filter(Boolean).map(esc).join(' · ') || '<span class="ui-muted">—</span>';
  const phu = [x.nhom, kkTT.dot.truong ? '' : x.truong].filter(Boolean).map(esc).join(' · ');
  const nut = KK_KQ.map(([gt, nhan, , icon]) => `<button type="button" class="kk-nut-kq kk-${gt}${x.ket_qua === gt ? ' dang' : ''}" data-kq="${gt}"${khoa ? ' disabled' : ''} title="${nhan}"><i class="fas fa-${icon}"></i> ${nhan}</button>`).join('');
  const chon = kkTT.chon.has(x.id);
  const lechSl = x.ket_qua && x.so_luong_thuc_te !== null && x.so_luong_thuc_te !== x.so_luong;
  return `<tr data-id="${x.id}" class="${x.ket_qua ? 'kk-da-kiem kk-r-' + x.ket_qua : ''}${chon ? ' ts-dang-chon' : ''}">
    <td class="ts-o-chon"><input type="checkbox"${chon ? ' checked' : ''} aria-label="Chọn" /></td>
    <td class="ui-strong ts-ma" title="${esc(x.ma_tai_san)}">${esc(x.ma_tai_san)}</td>
    <td class="ts-ten">${esc(x.ten)}${phu ? `<span class="ds-sub">${phu}</span>` : ''}</td>
    <td>${noi}</td>
    <td class="num">${formatSo(x.so_luong)}${x.dvt ? ' ' + esc(x.dvt) : ''}</td>
    <td class="kk-o-kq"><div class="kk-nhom-nut">${nut}</div></td>
    <td class="num"><input class="ui-input cell kk-sl${lechSl ? ' kk-lech' : ''}" data-kk-sl inputmode="decimal" data-so value="${esc(soO(x.so_luong_thuc_te))}" placeholder="${formatSo(x.so_luong)}"${khoa ? ' disabled' : ''} /></td>
    <td><input class="ui-input cell text kk-gc" data-kk-gc value="${esc(x.ghi_chu)}" placeholder="Ghi chú"${khoa ? ' disabled' : ''} /></td>
  </tr>`;
}

function kkVeBang() {
  const sec = kkSec();
  const ds = kkLoc();
  const tb = sec.querySelector('[data-kk-bang]');
  tb.innerHTML = ds.length ? ds.slice(0, kkTT.hien).map(kkHtmlDong).join('') : oTrong(8, 'inbox', 'Không có dòng nào khớp bộ lọc.');
  const con = ds.length - Math.min(kkTT.hien, ds.length);
  sec.querySelector('[data-kk-chan]').innerHTML = `<span>Hiện ${formatSo(Math.min(kkTT.hien, ds.length))}/${formatSo(ds.length)} dòng</span>`
    + (con > 0 ? `<button class="btn btn-neutral btn-sm" type="button" data-kk-them>Hiện thêm ${formatSo(Math.min(KK_TRANG, con))} dòng</button>` : '');
  kkVeThanhChon();
}

function kkVeThanhChon() {
  const sec = kkSec();
  const thanh = sec.querySelector('[data-kk-thanh-chon]');
  const ds = kkLoc();
  const cb = sec.querySelector('[data-kk-chon-het]');
  cb.checked = ds.length > 0 && ds.every((x) => kkTT.chon.has(x.id));
  cb.indeterminate = kkTT.chon.size > 0 && !cb.checked;
  if (!kkTT.chon.size) { thanh.hidden = true; thanh.innerHTML = ''; return; }
  thanh.hidden = false;
  if (kkKhoa()) {
    // Đợt đã chốt: xử lý tài sản Không thấy / Hỏng ngay trong danh mục (ghi giảm, đổi tình trạng — có ghi lịch sử).
    const idTs = [...new Set(kkTT.dong.filter((x) => kkTT.chon.has(x.id) && x.tai_san_id).map((x) => x.tai_san_id))];
    const tab = kkTT.dot.loai === 'CCDC' ? 'ccdc' : 'tscd';
    thanh.innerHTML = `<span class="ts-dem-chon">Đã chọn <b>${formatSo(kkTT.chon.size)}</b> dòng</span>
      <span class="ts-thanh-nut">
        <button class="btn btn-secondary btn-sm" type="button" data-kk-ts="tinh_trang"><i class="fas fa-rotate"></i> Đổi tình trạng trong danh mục</button>
        <button class="btn btn-danger btn-sm" type="button" data-kk-ts="ghi_giam"><i class="fas fa-circle-minus"></i> Ghi giảm trong danh mục</button>
        <button class="btn btn-ghost btn-sm" type="button" data-kk-hl="huy"><i class="fas fa-xmark"></i> Bỏ chọn</button>
      </span>`;
    thanh.querySelectorAll('[data-kk-ts]').forEach((b) => b.addEventListener('click', () => {
      if (!idTs.length) { hienToast('Các dòng đã chọn không còn tài sản tương ứng trong danh mục.', true); return; }
      tsHangLoat(tab, b.dataset.kkTs, idTs);
    }));
    thanh.querySelector('[data-kk-hl="huy"]').addEventListener('click', () => { kkTT.chon.clear(); kkVeBang(); });
    return;
  }
  thanh.innerHTML = `<span class="ts-dem-chon">Đã chọn <b>${formatSo(kkTT.chon.size)}</b> dòng</span>
    <span class="ts-thanh-nut">
      ${KK_KQ.map(([gt, nhan, , icon]) => `<button class="btn btn-secondary btn-sm" type="button" data-kk-hl="${gt}"><i class="fas fa-${icon}"></i> Đánh dấu ${nhan}</button>`).join('')}
      <button class="btn btn-neutral btn-sm" type="button" data-kk-hl="bo"><i class="fas fa-eraser"></i> Bỏ đánh dấu</button>
      <button class="btn btn-ghost btn-sm" type="button" data-kk-hl="huy"><i class="fas fa-xmark"></i> Bỏ chọn</button>
    </span>`;
  thanh.querySelectorAll('[data-kk-hl]').forEach((b) => b.addEventListener('click', async () => {
    const hd = b.dataset.kkHl;
    if (hd === 'huy') { kkTT.chon.clear(); kkVeBang(); return; }
    await kkGhi([...kkTT.chon], { ket_qua: hd === 'bo' ? null : hd });
    kkTT.chon.clear();
    kkVeBang();
  }));
}

// Gửi kết quả lên máy chủ rồi cập nhật đúng các dòng đã đổi (không vẽ lại cả bảng).
const kkDangGhi = new Set(); // dòng đang chờ máy chủ lưu (chặn bấm liên tiếp)
async function kkGhi(ids, duLieu) {
  const k = kkTT.dot;
  ids.forEach((i) => kkDangGhi.add(i));
  try {
    const kq = await goiApi(`/api/kiem-ke/${k.id}/dong`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ ids, ...duLieu }) });
    kkCapNhatDong(kq.dong, kq.dot);
  } catch (err) { hienToast(err.message, true); } finally { ids.forEach((i) => kkDangGhi.delete(i)); }
}
function kkCapNhatDong(dongMoi, dot) {
  const map = new Map(dongMoi.map((x) => [x.id, x]));
  kkTT.dong = kkTT.dong.map((x) => map.get(x.id) || x);
  if (dot) kkTT.dot = dot;
  const tb = kkSec().querySelector('[data-kk-bang]');
  // Đang gõ trong 1 ô của dòng sắp vẽ lại (vd. Tab từ "SL thực tế" sang "Ghi chú"): giữ chữ đang gõ + con trỏ.
  const o = document.activeElement;
  const trO = o && o.matches && o.matches('input[data-kk-sl], input[data-kk-gc]') ? o.closest('tr[data-id]') : null;
  const giu = trO ? { id: trO.dataset.id, chon: o.matches('[data-kk-sl]') ? '[data-kk-sl]' : '[data-kk-gc]', gt: o.value, dau: o.selectionStart, cuoi: o.selectionEnd } : null;
  for (const x of dongMoi) {
    const tr = tb.querySelector(`tr[data-id="${x.id}"]`);
    if (tr) tr.outerHTML = kkHtmlDong(x);
  }
  if (giu) {
    const inp = tb.querySelector(`tr[data-id="${giu.id}"] ${giu.chon}`);
    if (inp && inp !== o) {
      inp.value = giu.gt;
      inp.focus();
      try { inp.setSelectionRange(giu.dau, giu.cuoi); } catch (e) { /* ô không hỗ trợ chọn chữ */ }
    }
  }
  kkVeDau();
}

async function kkQuet(ma, dongId) {
  const kqEl = kkSec().querySelector('[data-kk-quet-kq]');
  try {
    const kq = await goiApi(`/api/kiem-ke/${kkTT.dot.id}/quet`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ma, dong_id: dongId }) });
    kkCapNhatDong([kq.dong], kq.dot);
    const d = kq.dong;
    kqEl.className = 'kk-quet-kq ok';
    kqEl.innerHTML = `<i class="fas fa-circle-check"></i> ${esc(d.ma_tai_san)} — ${esc(d.ten)}: ${d.ket_qua === 'hong' ? 'đang ghi Hỏng (giữ nguyên)' : kq.truoc === 'co' ? 'đã có từ trước' : 'đã đánh dấu Có'}`;
  } catch (err) {
    if (err.status === 409 && err.data && err.data.lua_chon) {
      const goc = moDialog('Mã có ở nhiều trường', `Chọn đúng tài sản mã "${esc(ma)}"`,
        err.data.lua_chon.map((x) => `<button class="btn btn-neutral kk-lua-chon" type="button" data-lc="${x.id}">${esc(x.ten)} — ${esc(x.truong)}</button>`).join(''),
        '<button class="btn btn-neutral" type="button" data-dong>Hủy</button>');
      const oQuet = kkSec().querySelector('[data-kk-quet]');
      goc.querySelectorAll('[data-lc]').forEach((b) => b.addEventListener('click', async () => { dongDialog(); await kkQuet(ma, Number(b.dataset.lc)); oQuet.focus(); }));
      goc.querySelectorAll('[data-dong]').forEach((b) => b.addEventListener('click', () => oQuet.focus())); // hủy: quay lại ô quét ngay
      return;
    }
    kqEl.className = 'kk-quet-kq loi';
    kqEl.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${esc(err.message)}`;
  }
}

function kkSuaDot() {
  const k = kkTT.dot;
  const goc = moDialog('Thông tin đợt kiểm kê', 'Phạm vi và ngày kiểm kê không đổi được (số liệu sổ sách đã chụp theo ngày đó).',
    `<div class="ui-form-grid cot-2">
       <div class="ui-field span-2">Tên đợt<input id="kks-ten" class="ui-input" value="${esc(k.ten)}" /></div>
       <div class="ui-field span-2">Ban kiểm kê — mỗi người một dòng: Họ tên - Chức vụ - Vai trò (dòng đầu là Trưởng ban)<textarea id="kks-ban" class="ui-input" rows="4">${esc(k.ban_kiem_ke)}</textarea></div>
       <div class="ui-field span-2">Ghi chú<input id="kks-gc" class="ui-input" value="${esc(k.ghi_chu)}" /></div>
     </div>`,
    '<button class="btn btn-neutral" type="button" data-dong>Hủy</button><button class="btn btn-primary" type="button" id="kks-ok">Lưu</button>');
  document.getElementById('kks-ok').addEventListener('click', async () => {
    try {
      kkTT.dot = await goiApi('/api/kiem-ke/' + k.id, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ ten: val('kks-ten'), ban_kiem_ke: document.getElementById('kks-ban').value, ghi_chu: val('kks-gc') }) });
      dongDialog(); hienToast('Đã lưu thông tin đợt.'); kkVeDau();
    } catch (err) { hienToast(err.message, true); }
  });
}

function kkChot() {
  const k = kkTT.dot;
  const chua = k.tong - k.da_kiem;
  const goc = moDialog('Chốt đợt kiểm kê', esc(k.ten),
    `<div class="ts-ct-luoi">
       <div class="ts-ct-dong"><span>Tổng tài sản</span><b>${formatSo(k.tong)}</b></div>
       <div class="ts-ct-dong"><span>Có</span><b>${formatSo(k.co)}</b></div>
       <div class="ts-ct-dong"><span>Hỏng</span><b>${formatSo(k.hong)}</b></div>
       <div class="ts-ct-dong"><span>Không thấy</span><b>${formatSo(k.khong_thay)}</b></div>
     </div>
     ${chua ? `<div class="ui-note"><i class="fas fa-triangle-exclamation"></i><span>Còn <b>${formatSo(chua)}</b> tài sản chưa kiểm. Trên biên bản các dòng này để trống cột "Theo kiểm kê" và ghi "Chưa kiểm".</span></div>` : ''}
     <label class="kk-tuy-chon"><input type="checkbox" id="kkc-hong" checked /> Cập nhật tình trạng <b>Hỏng</b> vào danh mục tài sản cho ${formatSo(k.hong)} tài sản hỏng</label>
     <label class="kk-tuy-chon"><input type="checkbox" id="kkc-ls" checked /> Ghi kết quả kiểm kê vào <b>lịch sử</b> từng tài sản đã kiểm</label>
     <div class="ui-statbar">Tài sản "Không thấy" không tự ghi giảm — xử lý sau khi có quyết định (chọn trong danh mục rồi "Ghi giảm").</div>`,
    '<button class="btn btn-neutral" type="button" data-dong>Hủy</button><button class="btn btn-primary" type="button" id="kkc-ok"><i class="fas fa-lock"></i> Chốt đợt</button>');
  document.getElementById('kkc-ok').addEventListener('click', async () => {
    try {
      const kq = await goiApi(`/api/kiem-ke/${k.id}/chot`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({
        cap_nhat_hong: document.getElementById('kkc-hong').checked, ghi_lich_su: document.getElementById('kkc-ls').checked,
      }) });
      kkTT.dot = kq.dot;
      dongDialog();
      hienToast(`Đã chốt đợt kiểm kê${kq.doi_hong ? `, cập nhật ${kq.doi_hong} tài sản sang Hỏng` : ''}${kq.ghi_lich_su ? `, ghi lịch sử ${kq.ghi_lich_su} tài sản` : ''}.`);
      kkVeDau();
      kkVeBang();
    } catch (err) { hienToast(err.message, true); }
  });
}
