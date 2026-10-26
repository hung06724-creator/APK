// ===== TÀI SẢN CỐ ĐỊNH (TSCĐ) & CÔNG CỤ DỤNG CỤ (CCDC) =====
// Trang làm việc: bấm 1 dòng để sửa (kèm hao mòn + lịch sử), tick nhiều dòng để điều chuyển / đổi tình trạng /
// cập nhật / ghi giảm / xóa hàng loạt, sắp xếp theo cột, lọc nhanh, xuất Excel theo mẫu sổ của trường.

const TS_CAU_HINH = {
  tscd: { loai: 'TSCD', tieuDe: 'Tài sản cố định', moTa: 'Bấm vào một dòng để sửa; tick nhiều dòng để điều chuyển, đổi tình trạng, ghi giảm hàng loạt.', nutThem: 'Thêm TSCĐ', ten: 'tài sản' },
  ccdc: { loai: 'CCDC', tieuDe: 'Công cụ dụng cụ', moTa: 'Bấm vào một dòng để sửa; tick nhiều dòng để điều chuyển, đổi tình trạng, ghi giảm hàng loạt.', nutThem: 'Thêm CCDC', ten: 'công cụ dụng cụ' },
};
const TS_TINH_TRANG = [
  ['dang_su_dung', 'Đang sử dụng', 'ui-tone-primary'],
  ['tam_ngung', 'Tạm ngưng', 'ui-tone-neutral'],
  ['hong', 'Hỏng', 'ui-tone-warning'],
  ['da_giam', 'Đã ghi giảm', 'ui-tone-danger'],
];
const TS_NGUONG_TSCD = 10000000; // TSCĐ thường có nguyên giá từ 10 triệu đồng trở lên
const TS_TRANG = 300; // số dòng hiện mỗi lần (danh sách dài vẫn mượt)
const TS_LOC_RONG = { q: '', truong: '', nhom: '', bo_phan: '', tinh_trang: '', gia_tri: '', den: '' };
const tsTT = {
  tscd: { loc: { ...TS_LOC_RONG }, sap_xep: 'ma', chieu: 'tang', items: [], chon: new Set(), hien: TS_TRANG, goiY: null },
  ccdc: { loc: { ...TS_LOC_RONG }, sap_xep: 'ma', chieu: 'tang', items: [], chon: new Set(), hien: TS_TRANG, goiY: null },
};
const tsDaDung = {};

function tsPill(tt) {
  const m = TS_TINH_TRANG.find((x) => x[0] === tt) || [tt, tt, 'ui-tone-neutral'];
  return `<span class="ui-pill ${m[2]}">${esc(m[1])}</span>`;
}

function tsQs(tab, them) {
  const s = tsTT[tab];
  const qs = new URLSearchParams({ loai: TS_CAU_HINH[tab].loai, sap_xep: s.sap_xep, chieu: s.chieu });
  Object.entries(s.loc).forEach(([k, v]) => { if (v) qs.set(k, v); });
  Object.entries(them || {}).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, v); });
  return qs;
}
async function tsTaiFile(url) {
  try {
    hienToast('Đang tạo file...');
    hienToast('Đã tải file ' + (await taiFile(url)));
  } catch (err) {
    hienToast('Không tải được file: ' + err.message, true);
  }
}
const tsDl = (idDl, ds) => `<datalist id="${idDl}">${(ds || []).map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
const tsOpt = (ds, chon, rong) => (rong ? `<option value="">${rong}</option>` : '') + ds.map((x) => `<option value="${esc(x)}"${x === chon ? ' selected' : ''}>${esc(x)}</option>`).join('');

// ---------- Khung trang ----------
function tsDungKhung(tab) {
  const ch = TS_CAU_HINH[tab];
  const sec = document.getElementById(tab);
  const laTscd = tab === 'tscd';
  const cotSx = (khoa, ten, lop) => `<th class="ts-sx ${lop || ''}" data-sx="${khoa}">${ten}<i class="fas fa-sort"></i></th>`;
  const tieuCot = laTscd
    ? cotSx('ma', 'Mã') + cotSx('ten', 'Tên tài sản') + cotSx('so_luong', 'SL', 'num') + cotSx('nguyen_gia', 'Nguyên giá', 'num')
      + cotSx('hao_mon', 'Hao mòn lũy kế', 'num') + cotSx('con_lai', 'Giá trị còn lại', 'num') + cotSx('noi', 'Nơi sử dụng') + cotSx('tinh_trang', 'Tình trạng')
    : cotSx('ma', 'Mã') + cotSx('ten', 'Tên công cụ dụng cụ') + cotSx('so_luong', 'SL', 'num') + '<th class="num">Đơn giá</th>'
      + cotSx('nguyen_gia', 'Thành tiền', 'num') + cotSx('noi', 'Nơi sử dụng') + cotSx('tinh_trang', 'Tình trạng');
  sec.innerHTML = `
    <div class="ui-head">
      <div><h1>${esc(ch.tieuDe)}</h1><p>${esc(ch.moTa)}</p></div>
      <div class="ui-head-actions">
        <button class="btn btn-neutral btn-icon" type="button" data-ts-ky title="Thông tin in trên sổ: đơn vị, người lập biểu, kế toán trưởng, hiệu trưởng" aria-label="Thông tin in trên sổ"><i class="fas fa-signature"></i></button>
        <div class="ui-menu">
          <button class="btn btn-secondary" type="button" data-menu-mo aria-haspopup="true" aria-expanded="false"><i class="fas fa-file-export"></i> Xuất / In <i class="fas fa-chevron-down ui-menu-mui"></i></button>
          <div class="ui-menu-ds" hidden>
            ${laTscd
              ? `<button type="button" data-ts-xuat="so"><i class="fas fa-book"></i> Sổ chi tiết TSCĐ theo năm</button>
                 <button type="button" data-ts-xuat="ds"><i class="fas fa-file-excel"></i> Danh sách đang lọc</button>`
              : '<button type="button" data-ts-xuat="ccdc"><i class="fas fa-book"></i> Sổ theo dõi CCDC (SKT03)</button>'}
            <button type="button" data-ts-qr><i class="fas fa-qrcode"></i> In tem mã QR</button>
          </div>
        </div>
        <button class="btn btn-primary" type="button" data-ts-them><i class="fas fa-plus"></i> ${esc(ch.nutThem)}</button>
      </div>
    </div>
    <div class="ts-kpi-luoi" data-ts-kpi></div>
    <div class="ts-chip-hang" data-ts-chip></div>
    <div class="ui-card">
      <div class="ts-loc">
        <input class="ui-input" data-ts-loc="q" placeholder="Tìm mã, tên, nhóm, bộ phận, người dùng, vị trí, ghi chú..." />
        <select class="ui-input" data-ts-loc="truong"></select>
        <select class="ui-input" data-ts-loc="nhom"></select>
        <select class="ui-input" data-ts-loc="bo_phan"></select>
        <select class="ui-input" data-ts-loc="tinh_trang">
          <option value="">Mọi tình trạng</option>${TS_TINH_TRANG.map((t) => `<option value="${t[0]}">${t[1]}</option>`).join('')}
        </select>
        ${laTscd ? `<select class="ui-input" data-ts-loc="gia_tri"><option value="">Mọi giá trị</option><option value="con">Còn giá trị</option><option value="het">Đã hết khấu hao</option><option value="chua">Chưa có thời gian sử dụng</option></select>
          <label class="ts-loc-den">Hao mòn tính đến<input class="ui-input" type="date" data-ts-loc="den" /></label>` : ''}
        <button class="btn btn-ghost btn-sm" type="button" data-ts-xoa-loc><i class="fas fa-filter-circle-xmark"></i> Xóa lọc</button>
      </div>
      <div class="ts-thanh-chon" data-ts-thanh-chon hidden></div>
      <div class="ui-table-scroll">
        <table class="ui-table ts-bang">
          <thead><tr><th class="ts-o-chon"><input type="checkbox" data-ts-chon-het title="Chọn tất cả kết quả lọc" /></th>${tieuCot}</tr></thead>
          <tbody data-ts-bang></tbody>
        </table>
      </div>
      <div class="ts-chan-bang" data-ts-chan></div>
    </div>
    ${laTscd ? '<div class="ui-statbar ts-chu-thich">Hao mòn tính theo phương pháp đường thẳng, theo tháng. Tài sản nạp từ sổ cũ lấy hao mòn lũy kế tại ngày chốt của sổ làm gốc rồi cộng tiếp.</div>' : ''}`;

  sec.querySelector('[data-ts-them]').addEventListener('click', () => tsMoForm(tab));
  sec.querySelector('[data-ts-ky]').addEventListener('click', tsMoThongTinKy);
  sec.querySelector('[data-ts-qr]').addEventListener('click', () => tsTemQr(tab));
  sec.querySelectorAll('[data-ts-xuat]').forEach((b) => b.addEventListener('click', () => tsXuat(tab, b.dataset.tsXuat)));
  let hen;
  sec.querySelectorAll('[data-ts-loc]').forEach((el) => {
    const khoa = el.dataset.tsLoc;
    el.addEventListener(khoa === 'q' ? 'input' : 'change', () => {
      tsTT[tab].loc[khoa] = el.value.trim();
      clearTimeout(hen);
      hen = setTimeout(() => taiTaiSan(tab), khoa === 'q' ? 250 : 0);
    });
  });
  sec.querySelector('[data-ts-xoa-loc]').addEventListener('click', () => { tsTT[tab].loc = { ...TS_LOC_RONG }; taiTaiSan(tab); });
  sec.querySelectorAll('[data-sx]').forEach((th) => th.addEventListener('click', () => {
    const s = tsTT[tab];
    if (s.sap_xep === th.dataset.sx) s.chieu = s.chieu === 'tang' ? 'giam' : 'tang';
    else { s.sap_xep = th.dataset.sx; s.chieu = ['nguyen_gia', 'hao_mon', 'con_lai', 'so_luong'].includes(th.dataset.sx) ? 'giam' : 'tang'; }
    taiTaiSan(tab);
  }));
  sec.querySelector('[data-ts-chon-het]').addEventListener('change', (e) => {
    const s = tsTT[tab];
    if (e.target.checked) s.items.forEach((r) => s.chon.add(r.id)); else s.chon.clear();
    tsVeBang(tab);
  });
  // Bấm dòng = mở form sửa; bấm ô tick = chọn (dùng ủy quyền sự kiện cho danh sách dài).
  const tbody = sec.querySelector('[data-ts-bang]');
  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const id = Number(tr.dataset.id);
    if (e.target.closest('.ts-o-chon')) {
      const s = tsTT[tab];
      if (e.target.tagName !== 'INPUT') { const cb = tr.querySelector('input'); cb.checked = !cb.checked; }
      if (tr.querySelector('input').checked) s.chon.add(id); else s.chon.delete(id);
      tr.classList.toggle('ts-dang-chon', s.chon.has(id));
      tsVeThanhChon(tab);
      return;
    }
    tsMoForm(tab, id);
  });
  sec.querySelector('[data-ts-chan]').addEventListener('click', (e) => {
    if (e.target.closest('[data-ts-them-dong]')) { tsTT[tab].hien += TS_TRANG; tsVeBang(tab); }
  });
  tsDaDung[tab] = true;
}

// ---------- Tải + vẽ ----------
async function taiTaiSan(tab) {
  if (!tsDaDung[tab]) tsDungKhung(tab);
  const ch = TS_CAU_HINH[tab];
  const s = tsTT[tab];
  const sec = document.getElementById(tab);
  const laTscd = tab === 'tscd';
  let kq;
  try {
    [kq, s.goiY] = await Promise.all([goiApi('/api/tai-san?' + tsQs(tab)), goiApi('/api/tai-san/goi-y?loai=' + ch.loai)]);
  } catch (err) {
    sec.querySelector('[data-ts-bang]').innerHTML = oTrong(10, 'triangle-exclamation', esc(err.message));
    return;
  }
  s.items = kq.items;
  s.den = kq.den;
  s.hien = TS_TRANG;
  const conTon = new Set(kq.items.map((r) => r.id));
  [...s.chon].forEach((id) => { if (!conTon.has(id)) s.chon.delete(id); }); // bỏ chọn dòng không còn trong kết quả lọc

  // Bộ lọc (giữ lựa chọn hiện tại)
  const g = s.goiY;
  const datSel = (khoa, ds, rong) => { const el = sec.querySelector(`[data-ts-loc="${khoa}"]`); el.innerHTML = tsOpt(ds, s.loc[khoa], rong); el.value = s.loc[khoa]; };
  datSel('truong', g.truong, 'Mọi trường');
  sec.querySelector('[data-ts-loc="truong"]').style.display = g.truong.length > 1 ? '' : 'none';
  datSel('nhom', g.nhom, 'Mọi nhóm');
  datSel('bo_phan', g.bo_phan, 'Mọi bộ phận');
  for (const k of ['q', 'tinh_trang', 'gia_tri', 'den']) { const el = sec.querySelector(`[data-ts-loc="${k}"]`); if (el) el.value = s.loc[k]; }
  sec.querySelectorAll('[data-sx]').forEach((th) => {
    const dang = th.dataset.sx === s.sap_xep;
    th.classList.toggle('ts-sx-dang', dang);
    th.querySelector('i').className = `fas ${dang ? (s.chieu === 'tang' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`;
  });

  // Ô tổng hợp + nút lọc nhanh
  const t = kq.tong;
  const kpi = (nhan, giaTri, phu) => `<div class="ts-kpi"><span class="ts-kpi-nhan">${esc(nhan)}</span><b class="ts-kpi-so">${giaTri}</b>${phu ? `<span class="ts-kpi-phu">${phu}</span>` : ''}</div>`;
  sec.querySelector('[data-ts-kpi]').innerHTML = laTscd
    ? kpi('Số tài sản', formatSo(t.so_ban_ghi), Object.values(s.loc).some(Boolean) ? 'theo bộ lọc' : 'toàn bộ')
      + kpi('Tổng nguyên giá', formatTien(t.tong_nguyen_gia) + ' đ', 'không tính tài sản đã ghi giảm')
      + kpi('Hao mòn lũy kế', formatTien(t.tong_hao_mon_luy_ke) + ' đ', `đến ${esc(ngayVN(kq.den))}`)
      + kpi('Giá trị còn lại', formatTien(t.tong_gia_tri_con_lai) + ' đ', '')
    : kpi('Số bản ghi', formatSo(t.so_ban_ghi), Object.values(s.loc).some(Boolean) ? 'theo bộ lọc' : 'toàn bộ')
      + kpi('Tổng số lượng', formatSo(t.tong_so_luong), 'đang quản lý')
      + kpi('Tổng giá trị', formatTien(t.tong_nguyen_gia) + ' đ', 'không tính đã ghi giảm')
      + kpi('Đang sử dụng / Hỏng', `${formatSo(t.dang_su_dung)} / ${formatSo(t.hong)}`, '');
  const chip = (nhan, so, loc, giaTri) => (so ? `<button type="button" class="ts-chip${s.loc[loc] === giaTri ? ' dang' : ''}" data-chip-loc="${loc}" data-chip-gt="${giaTri}">${nhan} <b>${formatSo(so)}</b></button>` : '');
  sec.querySelector('[data-ts-chip]').innerHTML = [
    laTscd ? chip('Hết khấu hao', t.het_khau_hao, 'gia_tri', 'het') : '',
    laTscd ? chip('Chưa có thời gian sử dụng', t.chua_co_thoi_gian_su_dung, 'gia_tri', 'chua') : '',
    chip('Hỏng', t.hong, 'tinh_trang', 'hong'),
    chip('Đã ghi giảm', t.da_giam, 'tinh_trang', 'da_giam'),
  ].join('');
  sec.querySelectorAll('[data-chip-loc]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.chipLoc;
    s.loc[k] = s.loc[k] === b.dataset.chipGt ? '' : b.dataset.chipGt;
    taiTaiSan(tab);
  }));
  tsVeBang(tab);
}

function tsVeBang(tab) {
  const ch = TS_CAU_HINH[tab];
  const s = tsTT[tab];
  const sec = document.getElementById(tab);
  const tbody = sec.querySelector('[data-ts-bang]');
  const laTscd = tab === 'tscd';
  const nhieuTruong = s.goiY && s.goiY.truong.length > 1;
  if (!s.items.length) {
    tbody.innerHTML = oTrong(10, 'inbox', Object.values(s.loc).some(Boolean) ? 'Không có tài sản nào khớp bộ lọc.' : `Chưa có ${ch.ten} nào. Bấm &quot;${esc(ch.nutThem)}&quot; để thêm.`);
    sec.querySelector('[data-ts-chan]').innerHTML = '';
    tsVeThanhChon(tab);
    return;
  }
  const muted = '<span class="ui-muted">—</span>';
  tbody.innerHTML = s.items.slice(0, s.hien).map((r) => {
    const noi = [r.bo_phan, r.nguoi_su_dung, r.vi_tri].filter(Boolean).map(esc).join(' · ') || muted;
    const phuDe = [r.nhom, nhieuTruong ? r.truong : ''].filter(Boolean).map(esc).join(' · ');
    const ten = `${esc(r.ten)}${phuDe ? `<span class="ds-sub">${phuDe}</span>` : ''}`;
    const sl = `${formatSo(r.so_luong)}${r.dvt ? ' ' + esc(r.dvt) : ''}`;
    const chon = s.chon.has(r.id);
    // Xem "tính đến" ngày đã qua: tài sản ghi giảm sau ngày đó vẫn đang quản lý tại ngày xem.
    const trangThai = tsPill(r.tinh_trang) + (r.giam_sau_ngay_xem ? `<span class="ds-sub">ghi giảm ${esc(ngayVN(r.giam_sau_ngay_xem))}</span>` : '');
    const lop = [r.tinh_trang === 'da_giam' ? 'ts-da-giam' : '', chon ? 'ts-dang-chon' : ''].join(' ');
    const dau = `<tr data-id="${r.id}" class="${lop}"><td class="ts-o-chon"><input type="checkbox"${chon ? ' checked' : ''} aria-label="Chọn" /></td>
      <td class="ui-strong ts-ma" title="${esc(r.ma_tai_san)}">${esc(r.ma_tai_san)}</td><td class="ts-ten">${ten}</td><td class="num th-nowrap">${sl}</td>`;
    return laTscd
      ? `${dau}<td class="num">${formatTien(r.thanh_tien)}</td>
         <td class="num">${r.hao_mon_luy_ke === null ? `<span class="ui-muted" title="Chưa có thời gian sử dụng">—</span>` : formatTien(r.hao_mon_luy_ke)}</td>
         <td class="num ui-strong">${r.gia_tri_con_lai === null ? muted : formatTien(r.gia_tri_con_lai)}</td>
         <td>${noi}</td><td>${trangThai}</td></tr>`
      : `${dau}<td class="num">${formatTien(r.don_gia)}</td><td class="num ui-strong">${formatTien(r.thanh_tien)}</td>
         <td>${noi}</td><td>${trangThai}</td></tr>`;
  }).join('');
  const conLai = s.items.length - Math.min(s.hien, s.items.length);
  sec.querySelector('[data-ts-chan]').innerHTML = `<span>Hiện ${formatSo(Math.min(s.hien, s.items.length))}/${formatSo(s.items.length)} dòng</span>`
    + (conLai > 0 ? `<button class="btn btn-neutral btn-sm" type="button" data-ts-them-dong>Hiện thêm ${formatSo(Math.min(TS_TRANG, conLai))} dòng</button>` : '');
  tsVeThanhChon(tab);
}

// ---------- Thanh thao tác khi đã chọn ----------
function tsVeThanhChon(tab) {
  const s = tsTT[tab];
  const sec = document.getElementById(tab);
  const thanh = sec.querySelector('[data-ts-thanh-chon]');
  const cbHet = sec.querySelector('[data-ts-chon-het]');
  cbHet.checked = s.items.length > 0 && s.chon.size === s.items.length;
  cbHet.indeterminate = s.chon.size > 0 && s.chon.size < s.items.length;
  if (!s.chon.size) { thanh.hidden = true; thanh.innerHTML = ''; return; }
  const dsChon = s.items.filter((r) => s.chon.has(r.id));
  const tongNg = dsChon.reduce((a, r) => a + r.thanh_tien, 0);
  thanh.hidden = false;
  thanh.innerHTML = `
    <span class="ts-dem-chon">Đã chọn <b>${formatSo(s.chon.size)}</b> · nguyên giá <b>${formatTien(tongNg)} đ</b></span>
    ${s.chon.size < s.items.length ? `<button class="btn btn-ghost btn-sm" type="button" data-hl="chon-het">Chọn cả ${formatSo(s.items.length)} kết quả lọc</button>` : ''}
    <span class="ts-thanh-nut">
      <button class="btn btn-secondary btn-sm" type="button" data-hl="dieu_chuyen"><i class="fas fa-right-left"></i> Điều chuyển</button>
      <button class="btn btn-secondary btn-sm" type="button" data-hl="tinh_trang"><i class="fas fa-heart-pulse"></i> Đổi tình trạng</button>
      <button class="btn btn-secondary btn-sm" type="button" data-hl="cap_nhat"><i class="fas fa-pen-to-square"></i> Cập nhật thông tin</button>
      <button class="btn btn-secondary btn-sm" type="button" data-hl="xuat"><i class="fas fa-file-excel"></i> Xuất các dòng chọn</button>
      <button class="btn btn-secondary btn-sm" type="button" data-hl="qr"><i class="fas fa-qrcode"></i> In tem QR</button>
      <button class="btn btn-neutral btn-sm" type="button" data-hl="ghi_giam"><i class="fas fa-circle-minus"></i> Ghi giảm</button>
      <button class="btn btn-danger btn-sm" type="button" data-hl="xoa"><i class="fas fa-trash"></i> Xóa</button>
      <button class="btn btn-ghost btn-sm" type="button" data-hl="bo-chon"><i class="fas fa-xmark"></i> Bỏ chọn</button>
    </span>`;
  thanh.querySelectorAll('[data-hl]').forEach((b) => b.addEventListener('click', () => {
    const hd = b.dataset.hl;
    if (hd === 'bo-chon') { s.chon.clear(); tsVeBang(tab); return; }
    if (hd === 'chon-het') { s.items.forEach((r) => s.chon.add(r.id)); tsVeBang(tab); return; }
    if (hd === 'xuat') { tsXuat(tab, tab === 'tscd' ? 'ds' : 'ccdc', [...s.chon]); return; }
    if (hd === 'qr') { tsTemQr(tab, [...s.chon]); return; }
    tsHangLoat(tab, hd, [...s.chon]);
  }));
}

// Hộp thoại thao tác hàng loạt (cũng dùng cho 1 tài sản từ form sửa).
// quayLai (tùy chọn): mở từ form sửa 1 tài sản thì nút "Quay lại" mở lại form đó thay vì đóng hẳn.
function tsHangLoat(tab, hanhDong, ids, quayLai) {
  const s = tsTT[tab];
  const g = s.goiY || { bo_phan: [], nguoi_su_dung: [], vi_tri: [], nhom: [], truong: [], dvt: [] };
  const laTscd = tab === 'tscd';
  const soTs = `${formatSo(ids.length)} ${TS_CAU_HINH[tab].ten}`;
  const ngay = (nhan) => `<div class="ui-field">${nhan}<input id="hl-ngay" class="ui-input" type="date" value="${homNayISO()}" /></div>`;
  const ghiChu = '<div class="ui-field span-2">Ghi chú / số quyết định (ghi vào lịch sử)<input id="hl-ghi-chu" class="ui-input" placeholder="vd QĐ số 12/QĐ-CĐNCN" /></div>';
  const cauHinh = {
    dieu_chuyen: {
      tieuDe: 'Điều chuyển / đổi nơi sử dụng', nut: 'Điều chuyển',
      than: `<div class="ui-form-grid">
          <div class="ui-field">Bộ phận sử dụng mới<input id="hl-bo-phan" class="ui-input" list="hl-dl-bp" autocomplete="off" /></div>
          <div class="ui-field">Người sử dụng / quản lý mới<input id="hl-nguoi" class="ui-input" list="hl-dl-ng" autocomplete="off" /></div>
          <div class="ui-field">Vị trí đặt mới<input id="hl-vi-tri" class="ui-input" list="hl-dl-vt" autocomplete="off" /></div>
          ${ngay('Ngày điều chuyển')}${ghiChu}
        </div>${tsDl('hl-dl-bp', g.bo_phan)}${tsDl('hl-dl-ng', g.nguoi_su_dung)}${tsDl('hl-dl-vt', g.vi_tri)}
        <div class="ui-statbar">Ô để trống sẽ giữ nguyên thông tin cũ của từng tài sản.</div>`,
      du: () => ({ bo_phan: val('hl-bo-phan'), nguoi_su_dung: val('hl-nguoi'), vi_tri: val('hl-vi-tri'), ngay: val('hl-ngay'), ghi_chu: val('hl-ghi-chu') }),
    },
    tinh_trang: {
      tieuDe: 'Đổi tình trạng', nut: 'Đổi tình trạng',
      than: `<div class="ui-form-grid"><div class="ui-field">Tình trạng mới<select id="hl-tt" class="ui-input">
          ${TS_TINH_TRANG.filter((t) => t[0] !== 'da_giam').map((t) => `<option value="${t[0]}">${t[1]}</option>`).join('')}</select></div>
          ${ngay('Ngày ghi nhận')}${ghiChu}</div>
        <div class="ui-statbar">Chọn "Đang sử dụng" cho tài sản đã ghi giảm sẽ khôi phục tài sản đó.</div>`,
      du: () => ({ tinh_trang: document.getElementById('hl-tt').value, ngay: val('hl-ngay'), ghi_chu: val('hl-ghi-chu') }),
    },
    cap_nhat: {
      tieuDe: 'Cập nhật thông tin', nut: 'Cập nhật',
      than: `<div class="ui-form-grid">
          <div class="ui-field">Nhóm / loại<input id="hl-nhom" class="ui-input" list="hl-dl-nhom" autocomplete="off" /></div>
          <div class="ui-field">Nguồn kinh phí<select id="hl-nguon" class="ui-input"><option value="">— giữ nguyên —</option><option value="661.2">TK 661.2</option><option value="337">TK 337</option></select></div>
          <div class="ui-field">Đơn vị tính<input id="hl-dvt" class="ui-input" list="hl-dl-dvt" autocomplete="off" /></div>
          ${laTscd ? '<div class="ui-field">Thời gian sử dụng (năm)<input id="hl-so-nam" class="ui-input" inputmode="decimal" data-so /></div>' : ''}
          <div class="ui-field span-2">Trường / đơn vị gốc<input id="hl-truong" class="ui-input" list="hl-dl-tr" autocomplete="off" /></div>
        </div>${tsDl('hl-dl-nhom', g.nhom)}${tsDl('hl-dl-dvt', g.dvt)}${tsDl('hl-dl-tr', g.truong)}
        <div class="ui-statbar">Ô để trống sẽ giữ nguyên. Mọi thay đổi được ghi vào lịch sử từng tài sản.</div>`,
      du: () => ({ nhom: val('hl-nhom'), nguon_kinh_phi: document.getElementById('hl-nguon').value, dvt: val('hl-dvt'), truong: val('hl-truong'), so_nam_su_dung: laTscd && val('hl-so-nam') ? docSo(val('hl-so-nam')) : '' }),
    },
    ghi_giam: {
      tieuDe: 'Ghi giảm', nut: 'Ghi giảm', nguyHiem: true,
      than: `<div class="ui-form-grid">${ngay('Ngày ghi giảm')}
          <div class="ui-field span-2">Lý do *<input id="hl-ly-do" class="ui-input" list="hl-dl-ld" placeholder="vd Thanh lý, Mất, Điều chuyển đơn vị khác" autocomplete="off" /></div>
          ${ghiChu}</div>
        <datalist id="hl-dl-ld"><option value="Thanh lý"><option value="Nhượng bán"><option value="Hỏng, không sửa chữa được"><option value="Mất"><option value="Điều chuyển đơn vị khác"><option value="Tiêu hủy"></datalist>
        <div class="ui-statbar">Tài sản vẫn giữ trong danh sách với tình trạng "Đã ghi giảm" để tra cứu và lên sổ.</div>`,
      du: () => ({ ngay: val('hl-ngay'), ly_do: val('hl-ly-do'), ghi_chu: val('hl-ghi-chu') }),
    },
    xoa: {
      tieuDe: 'Xóa hẳn', nut: 'Xóa hẳn', nguyHiem: true,
      than: '<div class="ui-note danger"><i class="fas fa-triangle-exclamation"></i><span>Xóa hẳn tài sản và toàn bộ lịch sử theo dõi, không khôi phục được. Nếu tài sản chỉ thanh lý / không còn dùng thì nên dùng "Ghi giảm" để giữ lại hồ sơ.</span></div>',
      du: () => ({}),
    },
  }[hanhDong];
  const goc = moDialog(`${cauHinh.tieuDe} — ${soTs}`, 'Áp dụng cho các tài sản đã chọn.',
    `${cauHinh.than}<div id="hl-loi" class="ui-note danger" style="display:none"></div>`,
    `${quayLai ? '<button class="btn btn-neutral" type="button" data-hl-quay-lai><i class="fas fa-arrow-left"></i> Quay lại</button>' : '<button class="btn btn-neutral" type="button" data-dong>Hủy</button>'}
     <button class="btn ${cauHinh.nguyHiem ? 'btn-danger' : 'btn-primary'}" type="button" id="hl-ok">${cauHinh.nut}</button>`);
  if (quayLai) goc.querySelector('[data-hl-quay-lai]').addEventListener('click', quayLai);
  const dauTien = goc.querySelector('.ui-dialog-body input, .ui-dialog-body select');
  if (dauTien) dauTien.focus();
  document.getElementById('hl-ok').addEventListener('click', async () => {
    const loiEl = document.getElementById('hl-loi');
    hienLoi(loiEl, '');
    const nut = document.getElementById('hl-ok');
    nut.disabled = true;
    try {
      const kq = await goiApi('/api/tai-san/hang-loat', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ids, hanh_dong: hanhDong, du_lieu: cauHinh.du() }) });
      dongDialog();
      hienToast(`${cauHinh.tieuDe}: đã cập nhật ${formatSo(kq.cap_nhat)}${kq.bo_qua ? `, bỏ qua ${formatSo(kq.bo_qua)} (${kq.chi_tiet_bo_qua.slice(0, 2).join('; ')}${kq.bo_qua > 2 ? '…' : ''})` : ''}.`, kq.bo_qua > 0 && !kq.cap_nhat);
      if (hanhDong === 'xoa') ids.forEach((id) => s.chon.delete(id));
      taiTaiSan(tab);
    } catch (err) {
      nut.disabled = false;
      hienLoi(loiEl, esc(err.message));
    }
  });
}

// ---------- Xuất Excel ----------
function tsXuat(tab, kieu, ids) {
  const s = tsTT[tab];
  // Chỉ gửi danh sách dòng tick khi chọn một phần (chọn hết = đúng bằng bộ lọc hiện tại).
  const them = ids && ids.length < s.items.length ? { ids: ids.join(',') } : {};
  if (them.ids && ids.length > 1500) { hienToast('Chọn quá nhiều dòng lẻ để xuất — hãy dùng bộ lọc rồi xuất toàn bộ kết quả lọc.', true); return; }
  if (kieu === 'ds') {
    tsTaiFile('/api/tai-san/xuat-excel?' + tsQs(tab, them));
    return;
  }
  const nam = new Date().getFullYear();
  const laSo = kieu === 'so';
  const pham = [s.loc.truong && `trường "${s.loc.truong}"`, s.loc.nhom && `nhóm "${s.loc.nhom}"`, s.loc.bo_phan && `bộ phận "${s.loc.bo_phan}"`, s.loc.tinh_trang && 'tình trạng đang lọc', s.loc.q && `từ khóa "${s.loc.q}"`].filter(Boolean);
  const goc = moDialog(laSo ? 'Sổ chi tiết tài sản cố định' : 'Sổ theo dõi CCDC tại nơi sử dụng (SKT03)',
    'Xuất Excel theo mẫu sổ của Trường Cao đẳng nghề Công nghiệp Hà Nội (mỗi trường một sheet).',
    `<div class="ui-form-grid">
       ${laSo
         ? `<div class="ui-field">Năm<input id="xs-nam" class="ui-input" type="number" min="2000" max="2100" value="${nam}" /></div>`
         : `<div class="ui-field">Từ ngày<input id="xs-tu" class="ui-input" type="date" value="${nam}-01-01" /></div>
            <div class="ui-field">Đến ngày<input id="xs-den" class="ui-input" type="date" value="${homNayISO()}" /></div>`}
     </div>
     <div class="ui-statbar">Phạm vi: ${them.ids ? `${formatSo(ids.length)} dòng đang chọn` : pham.length ? 'theo bộ lọc đang chọn — ' + esc(pham.join(', ')) : 'toàn bộ'}${laSo ? '' : '. Dòng "Tên đơn vị; Phòng, Ban" lấy theo bộ lọc bộ phận.'}</div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Hủy</button>
     <button class="btn btn-primary" type="button" id="xs-ok"><i class="fas fa-file-excel"></i> Tải file Excel</button>`);
  document.getElementById('xs-ok').addEventListener('click', () => {
    if (laSo) {
      const n = Number(val('xs-nam'));
      if (!(n >= 2000 && n <= 2100)) { hienToast('Năm không hợp lệ', true); return; }
      tsTaiFile('/api/tai-san/so-chi-tiet?' + tsQs(tab, { nam: n, ...them }));
    } else {
      const tu = val('xs-tu'); const den = val('xs-den');
      if (!tu || !den || tu > den) { hienToast('Khoảng ngày không hợp lệ', true); return; }
      tsTaiFile('/api/tai-san/xuat-excel?' + tsQs(tab, { tu, den_ngay: den, ...them }));
    }
    dongDialog();
  });
}

// ---------- Tem mã QR ----------
// Nội dung QR = mã tài sản -> quét bằng súng quét / điện thoại ra đúng mã (dùng ở ô quét mã của trang Kiểm kê).
function tsTemQr(tab, ids) {
  const s = tsTT[tab];
  const them = ids && ids.length < s.items.length ? { ids: ids.join(',') } : {};
  if (them.ids && ids.length > 1500) { hienToast('Chọn quá nhiều dòng lẻ — hãy dùng bộ lọc rồi in toàn bộ kết quả lọc.', true); return; }
  const soTem = them.ids ? ids.length : s.items.filter((r) => r.tinh_trang !== 'da_giam').length;
  const goc = moDialog('In tem mã QR', 'Mỗi tem gồm mã QR, tên đơn vị, mã, tên tài sản và nơi sử dụng. QR chứa đúng mã tài sản.',
    `<div class="ui-form-grid cot-2">
       <div class="ui-field">Số tem mỗi hàng (khổ A4)<select id="qr-cot" class="ui-input">
         <option value="2">2 tem — lớn</option><option value="3" selected>3 tem — vừa</option><option value="4">4 tem — nhỏ</option><option value="5">5 tem — rất nhỏ (chỉ trang in)</option></select></div>
       <div class="ui-field">Cách xuất<select id="qr-kieu" class="ui-input"><option value="html">Mở trang in tem (in trực tiếp)</option><option value="xlsx">Tải file Excel tem</option></select></div>
     </div>
     <label class="kk-tuy-chon"><input type="checkbox" id="qr-giam" /> In cả tài sản đã ghi giảm</label>
     <div class="ui-statbar">Phạm vi: ${them.ids ? `${formatSo(ids.length)} dòng đang chọn` : `${formatSo(soTem)} tài sản theo bộ lọc hiện tại`}.</div>`,
    '<button class="btn btn-neutral" type="button" data-dong>Hủy</button><button class="btn btn-primary" type="button" id="qr-ok"><i class="fas fa-qrcode"></i> Tạo tem</button>');
  document.getElementById('qr-ok').addEventListener('click', () => {
    const kieu = document.getElementById('qr-kieu').value;
    let cot = document.getElementById('qr-cot').value;
    if (kieu === 'xlsx' && cot === '5') cot = '4';
    const url = '/api/tai-san/tem-qr?' + tsQs(tab, { ...them, kieu, cot, ca_da_giam: document.getElementById('qr-giam').checked ? '1' : '' });
    if (kieu === 'xlsx') tsTaiFile(url); else window.open(url, '_blank');
    dongDialog();
  });
}

async function tsMoThongTinKy() {
  let ch;
  try { ch = await goiApi('/api/cau-hinh'); } catch (err) { hienToast(err.message, true); return; }
  const tr = (nhan, khoa) => `<div class="ui-field">${nhan}<input class="ui-input" data-ky="${khoa}" value="${esc(ch[khoa])}" /></div>`;
  const goc = moDialog('Thông tin in trên sổ', 'Dùng cho mọi bản xuất Excel: sổ TSCĐ, sổ CCDC, tồn kho, danh sách phiếu.',
    `<div class="ui-form-grid cot-2">
       ${tr('Đơn vị cấp trên', 'don_vi_cap_tren')}${tr('Tên đơn vị (in trên sổ)', 'ten_don_vi_so')}
       ${tr('Người lập biểu', 'so_nguoi_lap_bieu')}${tr('Kế toán trưởng', 'so_ke_toan_truong')}${tr('Hiệu trưởng', 'so_hieu_truong')}
     </div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Hủy</button><button class="btn btn-primary" type="button" id="ky-luu">Lưu</button>`);
  document.getElementById('ky-luu').addEventListener('click', async () => {
    const body = {};
    goc.querySelectorAll('[data-ky]').forEach((i) => { body[i.dataset.ky] = i.value.trim(); });
    try { await goiApi('/api/cau-hinh', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(body) }); dongDialog(); hienToast('Đã lưu thông tin in trên sổ.'); } catch (err) { hienToast(err.message, true); }
  });
}

// ---------- Form thêm / sửa (kèm hao mòn + lịch sử khi sửa) ----------
function tsTruong(nhan, id, giaTri, thuocTinh, lop) {
  return `<div class="ui-field ${lop || ''}">${nhan}<input id="tsf-${id}" class="ui-input" value="${esc(giaTri)}" ${thuocTinh || ''} /></div>`;
}

async function tsMoForm(tab, id) {
  const ch = TS_CAU_HINH[tab];
  const laTscd = tab === 'tscd';
  const sua = Boolean(id);
  let cu = null;
  let goiY;
  try {
    [goiY, cu] = await Promise.all([
      goiApi('/api/tai-san/goi-y?loai=' + ch.loai),
      sua ? goiApi('/api/tai-san/' + id) : Promise.resolve(null),
    ]);
  } catch (err) {
    hienToast('Không tải được dữ liệu: ' + err.message, true);
    return;
  }
  const v = cu || { ma_tai_san: goiY.ma_tai_san, so_luong: 1, don_gia: '', ngay_ghi_tang: homNayISO(), nguon_kinh_phi: '661.2', tinh_trang: 'dang_su_dung' };
  const optTinhTrang = TS_TINH_TRANG.filter((t) => t[0] !== 'da_giam' || v.tinh_trang === 'da_giam')
    .map((t) => `<option value="${t[0]}">${t[1]}</option>`).join('');
  const nhomMau = laTscd ? ['Nhà cửa, vật kiến trúc', 'Máy móc, thiết bị', 'Phương tiện vận tải', 'Thiết bị quản lý', 'Tài sản cố định khác'] : [];
  const nhomGoiY = [...new Set([...goiY.nhom, ...nhomMau])];

  // Phần chỉ có khi sửa: tình trạng hiện tại, hao mòn, lịch sử.
  let phanThem = '';
  if (sua) {
    const o = (nhan, gt) => `<div class="ts-ct-dong"><span>${nhan}</span><b>${gt || '<span class="ui-muted">—</span>'}</b></div>`;
    const hm = laTscd ? (cu.hao_mon_luy_ke === null
      ? '<div class="ui-note">Chưa có thời gian sử dụng nên chưa tính được hao mòn — nhập "Thời gian sử dụng (năm)" ở trên.</div>'
      : `<div class="ts-ct-luoi">
           ${o('Hao mòn lũy kế đến nay', formatTien(cu.hao_mon_luy_ke) + ' đ')}${o('Giá trị còn lại', formatTien(cu.gia_tri_con_lai) + ' đ')}
           ${o('Tỷ lệ / mỗi tháng', cu.ty_le_nam === null ? '' : `${String(cu.ty_le_nam).replace('.', ',')}%/năm · ${formatTien(cu.hao_mon_thang)} đ/tháng`)}
           ${cu.so_thang_da_trich === null ? o('Số dư tại ngày chốt', `${formatTien(cu.hm_luy_ke_ban_dau)} đ (${esc(ngayVN(cu.ngay_chot_hm))})`) : o('Đã trích', `${cu.so_thang_da_trich}/${cu.so_thang_tong} tháng`)}
         </div>`) : '';
    const lichSu = (cu.lich_su || []).map((l) => `<tr><td class="th-nowrap">${esc(ngayVN(l.ngay))}</td><td class="ui-strong">${esc(l.su_kien)}</td><td>${esc(l.noi_dung)}</td></tr>`).join('');
    const qrUrl = `/api/tai-san/${id}/qr.png`;
    phanThem = `
      <div class="ts-qr-khoi">
        <img src="${qrUrl}?size=200" alt="Mã QR ${esc(cu.ma_tai_san)}" width="96" height="96" />
        <div>
          <div class="ts-form-tom">${tsPill(cu.tinh_trang)}${cu.tinh_trang === 'da_giam' ? ` <span class="ui-statbar">Ghi giảm ${esc(ngayVN(cu.ngay_giam))}: ${esc(cu.ly_do_giam)}</span>` : ''}</div>
          <div class="ui-statbar">Mã QR chứa: <b>${esc(cu.ma_tai_san)}</b></div>
          <div class="ts-qr-nut">
            <a class="btn btn-neutral btn-sm" href="${qrUrl}?size=600&tai=1"><i class="fas fa-download"></i> Tải ảnh QR</a>
            <a class="btn btn-neutral btn-sm" href="/api/tai-san/tem-qr?${new URLSearchParams({ loai: ch.loai, ids: id, cot: 3, ca_da_giam: 1 })}" target="_blank"><i class="fas fa-print"></i> In tem</a>
          </div>
        </div>
      </div>
      ${hm}
      <details class="ts-lich-su"><summary>Lịch sử theo dõi (${(cu.lich_su || []).length})</summary>
        <div class="ui-table-scroll"><table class="ui-table"><thead><tr><th>Ngày</th><th>Sự kiện</th><th>Nội dung</th></tr></thead>
        <tbody>${lichSu || oTrong(3, 'clock-rotate-left', 'Chưa có lịch sử.')}</tbody></table></div>
      </details>`;
  }

  const goc = moDialog(
    sua ? esc(v.ten) : esc(ch.nutThem),
    sua ? esc(`${v.ma_tai_san} · ${v.truong || ''}`) : 'Điền thông tin tài sản mới. Mã để trống sẽ tự đánh số.',
    `${phanThem}
     <div class="ui-form-grid">
       ${tsTruong('Trường / đơn vị gốc', 'truong', v.truong || goiY.truong_mac_dinh, 'list="tsf-dl-truong" autocomplete="off"', 'span-3')}
       ${tsTruong('Mã tài sản', 'ma', v.ma_tai_san, 'placeholder="Tự đánh số"')}
       ${tsTruong('Tên tài sản *', 'ten', v.ten, '', 'span-2')}
       ${tsTruong('Nhóm / loại', 'nhom', v.nhom, 'list="tsf-dl-nhom" autocomplete="off"')}
       ${tsTruong('Đơn vị tính', 'dvt', v.dvt, 'list="tsf-dl-dvt" autocomplete="off"')}
       ${tsTruong('Số lượng', 'so-luong', soO(v.so_luong), 'inputmode="decimal" data-so')}
       ${tsTruong(laTscd ? 'Nguyên giá / đơn vị (đ)' : 'Đơn giá (đ)', 'don-gia', soO(v.don_gia), 'inputmode="decimal" data-so placeholder="vd 15.000.000"')}
       ${tsTruong(`<span>Ngày ghi tăng${sua && !v.ngay_ghi_tang ? ' <span class="ui-muted" title="Tài sản có từ trước, nạp từ sổ cũ không ghi ngày — để trống là đúng">(chưa rõ)</span>' : ''}</span>`, 'ngay-ghi-tang', v.ngay_ghi_tang, 'type="date"')}
       ${laTscd ? tsTruong('Ngày bắt đầu sử dụng', 'ngay-su-dung', v.ngay_su_dung || v.ngay_ghi_tang, 'type="date"') : ''}
       ${laTscd ? tsTruong('Thời gian sử dụng (năm)', 'so-nam', soO(v.so_nam_su_dung), 'inputmode="decimal" data-so placeholder="vd 5"') : ''}
       ${laTscd ? tsTruong('Hao mòn lũy kế đã có (đ)', 'hm-dau', soO(v.hm_luy_ke_ban_dau), 'inputmode="decimal" data-so placeholder="để trống nếu tính từ đầu"') : ''}
       ${laTscd ? tsTruong('…tính tại ngày chốt', 'ngay-chot', v.ngay_chot_hm, 'type="date"') : ''}
       <div class="ui-field">Nguồn kinh phí
         <select id="tsf-nguon" class="ui-input"><option value="661.2">TK 661.2</option><option value="337">TK 337</option></select>
       </div>
       ${tsTruong('Nhà cung cấp', 'ncc', v.nha_cung_cap, 'list="tsf-dl-ncc" autocomplete="off"')}
       ${tsTruong('Số chứng từ', 'chung-tu', v.so_chung_tu)}
       ${tsTruong('Bộ phận sử dụng', 'bo-phan', v.bo_phan, 'list="tsf-dl-bp" autocomplete="off"')}
       ${tsTruong('Người sử dụng / quản lý', 'nguoi', v.nguoi_su_dung, 'list="tsf-dl-nguoi" autocomplete="off"')}
       ${tsTruong('Vị trí đặt', 'vi-tri', v.vi_tri, 'list="tsf-dl-vt" autocomplete="off"')}
       ${sua ? `<div class="ui-field">Tình trạng<select id="tsf-tinh-trang" class="ui-input">${optTinhTrang}</select></div>` : ''}
       <div class="ui-field span-3">Ghi chú<textarea id="tsf-ghi-chu" class="ui-input" rows="2">${esc(v.ghi_chu)}</textarea></div>
     </div>
     ${tsDl('tsf-dl-nhom', nhomGoiY)}${tsDl('tsf-dl-dvt', goiY.dvt)}${tsDl('tsf-dl-ncc', goiY.nha_cung_cap)}
     ${tsDl('tsf-dl-truong', goiY.truong)}${tsDl('tsf-dl-bp', goiY.bo_phan)}${tsDl('tsf-dl-nguoi', goiY.nguoi_su_dung)}${tsDl('tsf-dl-vt', goiY.vi_tri)}
     <div id="tsf-goi-y" class="ui-statbar"></div>
     <div id="tsf-loi" class="ui-note danger" style="display:none"></div>`,
    `${sua ? `<span class="ts-chan-trai">
        ${v.tinh_trang === 'da_giam' ? '' : '<button class="btn btn-neutral" type="button" id="tsf-giam"><i class="fas fa-circle-minus"></i> Ghi giảm</button>'}
        <button class="btn btn-danger" type="button" id="tsf-xoa"><i class="fas fa-trash"></i> Xóa</button>
      </span>` : ''}
     <button class="btn btn-neutral" type="button" data-dong>Đóng</button>
     <button class="btn btn-primary" type="button" id="tsf-luu"><i class="fas fa-floppy-disk"></i> Lưu</button>`
  );
  document.getElementById('tsf-nguon').value = v.nguon_kinh_phi === '337' ? '337' : '661.2';
  if (sua) {
    document.getElementById('tsf-tinh-trang').value = v.tinh_trang;
    const nutGiam = document.getElementById('tsf-giam');
    if (nutGiam) nutGiam.addEventListener('click', () => tsHangLoat(tab, 'ghi_giam', [id], () => tsMoForm(tab, id)));
    document.getElementById('tsf-xoa').addEventListener('click', () => tsHangLoat(tab, 'xoa', [id], () => tsMoForm(tab, id)));
  }

  // Gợi ý trực tiếp: hao mòn dự kiến (TSCĐ) + cảnh báo phân loại theo giá trị.
  const capNhatGoiY = () => {
    const sl = docSo(val('tsf-so-luong')) || 0;
    const gia = docSo(val('tsf-don-gia')) || 0;
    const tong = sl * gia;
    const dong = [`Thành tiền: <b>${formatTien(tong)} đ</b>`];
    if (laTscd) {
      const nam = docSo(val('tsf-so-nam')) || 0;
      if (nam > 0) dong.push(`Hao mòn khoảng <b>${formatTien(tong / (nam * 12))} đ/tháng</b> · tỷ lệ <b>${(Math.round((100 / nam) * 100) / 100).toLocaleString('vi-VN')}%/năm</b>`);
      else dong.push('Chưa nhập thời gian sử dụng — chưa tính được hao mòn.');
      if (tong > 0 && gia < TS_NGUONG_TSCD) dong.push('<span class="ts-canh-bao">Nguyên giá dưới 10 triệu đ/đơn vị — tài sản loại này thường theo dõi là công cụ dụng cụ.</span>');
    } else if (gia >= TS_NGUONG_TSCD) {
      dong.push('<span class="ts-canh-bao">Đơn giá từ 10 triệu đ trở lên — tài sản loại này thường là tài sản cố định.</span>');
    }
    document.getElementById('tsf-goi-y').innerHTML = dong.join(' &nbsp;|&nbsp; ');
  };
  ['so-luong', 'don-gia', 'so-nam'].forEach((k) => { const el = document.getElementById('tsf-' + k); if (el) el.addEventListener('input', capNhatGoiY); });
  capNhatGoiY();
  if (!sua) document.getElementById('tsf-ten').focus();

  document.getElementById('tsf-luu').addEventListener('click', async () => {
    const loiEl = document.getElementById('tsf-loi');
    hienLoi(loiEl, '');
    const oSai = [...goc.querySelectorAll('input[data-so]')].find((i) => Number.isNaN(docSo(i.value)));
    if (oSai) { hienLoi(loiEl, 'Có ô số chưa đúng (tô đỏ) — chỉ nhập chữ số, dấu chấm phân cách nghìn, dấu phẩy thập phân.'); oSai.focus(); return; }
    const soGui = (idO) => (val(idO) === '' ? '' : docSo(val(idO))); // ô trống gửi '' để máy chủ dùng giá trị mặc định
    const nut = document.getElementById('tsf-luu');
    nut.disabled = true;
    const body = {
      loai: ch.loai,
      truong: val('tsf-truong'),
      ma_tai_san: val('tsf-ma'),
      ten: val('tsf-ten'),
      nhom: val('tsf-nhom'),
      dvt: val('tsf-dvt'),
      so_luong: soGui('tsf-so-luong'),
      don_gia: soGui('tsf-don-gia'),
      ngay_ghi_tang: val('tsf-ngay-ghi-tang'),
      nguon_kinh_phi: document.getElementById('tsf-nguon').value,
      nha_cung_cap: val('tsf-ncc'),
      so_chung_tu: val('tsf-chung-tu'),
      bo_phan: val('tsf-bo-phan'),
      nguoi_su_dung: val('tsf-nguoi'),
      vi_tri: val('tsf-vi-tri'),
      ghi_chu: val('tsf-ghi-chu'),
    };
    if (laTscd) {
      body.ngay_su_dung = val('tsf-ngay-su-dung');
      body.so_nam_su_dung = soGui('tsf-so-nam');
      body.hm_luy_ke_ban_dau = soGui('tsf-hm-dau');
      body.ngay_chot_hm = val('tsf-ngay-chot');
    }
    if (sua) body.tinh_trang = document.getElementById('tsf-tinh-trang').value;
    try {
      await goiApi(sua ? '/api/tai-san/' + id : '/api/tai-san', {
        method: sua ? 'PUT' : 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      dongDialog();
      hienToast(sua ? 'Đã lưu thay đổi.' : 'Đã thêm tài sản.');
      taiTaiSan(tab);
    } catch (err) {
      nut.disabled = false;
      hienLoi(loiEl, esc(err.message));
    }
  });
}
