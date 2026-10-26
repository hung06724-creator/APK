// ===== KHÓA SỔ THEO NĂM =====
// Năm đã khóa: phiếu nhập / xuất, tồn đầu kỳ, ghi tăng / ghi giảm tài sản và kiểm kê có ngày trong năm đó chỉ còn xem
// và xuất báo cáo (máy chủ chặn mọi thay đổi). Mở khóa phải ghi lý do; mọi lần khóa / mở đều có trong nhật ký.
let ksDuLieu = null;

function ksSec() { return document.getElementById('khoa-so'); }

async function taiTrangKhoaSo() {
  const sec = ksSec();
  if (!sec.dataset.dung) {
    sec.dataset.dung = '1';
    sec.innerHTML = `
      <div class="ui-head">
        <div>
          <h1>Khóa sổ theo năm</h1>
          <p>Năm đã khóa: phiếu nhập, phiếu xuất, tồn đầu kỳ, ghi tăng / ghi giảm tài sản và kiểm kê có ngày trong năm đó chỉ còn xem và xuất báo cáo. Mở khóa phải ghi lý do, mọi lần khóa / mở đều được ghi lại.</p>
        </div>
        <div class="ui-head-actions"><a class="btn btn-secondary" href="/api/khoa-so/xuat-excel"><i class="fas fa-file-excel"></i> Xuất Excel</a></div>
      </div>
      <div class="ui-card">
        <div class="ui-table-scroll"><table class="ui-table ks-bang">
          <thead><tr><th>Năm</th><th>Tình trạng</th><th class="num">Phiếu nhập</th><th class="num">Phiếu xuất</th>
            <th class="num" title="Dòng xuất chưa biết lấy từ dòng nhập nào">Dòng xuất chưa ghép</th><th class="num">Tồn đầu kỳ</th>
            <th class="num">Tài sản ghi tăng</th><th class="num">Tài sản ghi giảm</th><th class="num">Đợt kiểm kê</th><th></th></tr></thead>
          <tbody data-ks-bang>${oTrong(10, 'spinner', 'Đang tải...')}</tbody>
        </table></div>
        <div class="ks-khac">
          <span>Khóa một năm khác</span>
          <input class="ui-input" type="number" min="1990" max="2100" data-ks-nam placeholder="vd 2024" aria-label="Năm cần khóa" />
          <button class="btn btn-neutral btn-sm" type="button" data-ks-khoa-khac><i class="fas fa-lock"></i> Khóa sổ</button>
        </div>
      </div>
      <div class="ui-card">
        <div class="ui-card-head"><h2>Nhật ký khóa sổ</h2></div>
        <div class="ui-table-scroll"><table class="ui-table">
          <thead><tr><th>Thời gian</th><th>Năm</th><th>Thao tác</th><th>Lý do mở khóa / ghi chú khi khóa</th></tr></thead>
          <tbody data-ks-ls></tbody>
        </table></div>
      </div>`;
    sec.querySelector('[data-ks-bang]').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ks]');
      if (!b) return;
      if (b.dataset.ks === 'khoa') ksMoKhoa(Number(b.dataset.nam)); else ksMoMoKhoa(Number(b.dataset.nam));
    });
    sec.querySelector('[data-ks-khoa-khac]').addEventListener('click', () => {
      const nam = Number(sec.querySelector('[data-ks-nam]').value);
      if (!(Number.isInteger(nam) && nam >= 1990 && nam <= 2100)) { hienToast('Năm không hợp lệ (1990 – 2100).', true); return; }
      ksMoKhoa(nam);
    });
  }
  const d = await taiNamKhoa();
  if (!d) { sec.querySelector('[data-ks-bang]').innerHTML = oTrong(10, 'triangle-exclamation', 'Không tải được tình trạng khóa sổ.'); return; }
  ksVe(d);
}

function ksVe(d) {
  ksDuLieu = d;
  namKhoa = new Set(d.nam.filter((x) => x.khoa).map((x) => x.nam));
  const sec = ksSec();
  if (!sec.dataset.dung) return;
  const so = (v) => formatSo(v) || '0';
  sec.querySelector('[data-ks-bang]').innerHTML = d.nam.map((x) => `<tr class="${x.khoa ? 'ks-da-khoa' : ''}">
      <td class="ui-strong">${x.nam}</td>
      <td>${x.khoa
        ? `<span class="ui-pill ui-tone-danger"><i class="fas fa-lock"></i>&nbsp;Đã khóa</span><span class="ds-sub"><span class="ks-luc">${esc(ngayGioVN(x.khoa.khoa_luc))}</span>${x.khoa.ghi_chu ? ' · ' + esc(x.khoa.ghi_chu) : ''}</span>`
        : '<span class="ui-pill ui-tone-primary">Đang mở</span>'}</td>
      <td class="num">${so(x.phieu_nhap)}</td><td class="num">${so(x.phieu_xuat)}</td>
      <td class="num">${x.dong_xuat_chua_ghep ? `<b class="ks-canh-bao" title="Nên ghép trước khi khóa">${so(x.dong_xuat_chua_ghep)}</b>` : '0'}</td>
      <td class="num">${so(x.ton_dau_ky)}</td><td class="num">${so(x.ts_ghi_tang)}</td><td class="num">${so(x.ts_ghi_giam)}</td><td class="num">${so(x.kiem_ke)}</td>
      <td class="ds-nut-cell">${x.khoa
        ? `<button class="btn btn-sm btn-neutral" type="button" data-ks="mo" data-nam="${x.nam}"><i class="fas fa-lock-open"></i> Mở khóa</button>`
        : `<button class="btn btn-sm btn-primary" type="button" data-ks="khoa" data-nam="${x.nam}"><i class="fas fa-lock"></i> Khóa sổ</button>`}</td>
    </tr>`).join('');
  sec.querySelector('[data-ks-ls]').innerHTML = d.lich_su.length
    ? d.lich_su.map((x) => `<tr><td class="th-nowrap">${esc(ngayGioVN(x.luc))}</td><td class="ui-strong">${x.nam}</td>
        <td>${x.hanh_dong === 'khoa' ? '<span class="ui-pill ui-tone-danger">Khóa sổ</span>' : '<span class="ui-pill ui-tone-warning">Mở khóa</span>'}</td>
        <td>${esc(x.noi_dung || '')}</td></tr>`).join('')
    : oTrong(4, 'clock-rotate-left', 'Chưa có lần khóa / mở khóa nào.');
}

// Sau khi khóa / mở: vẽ lại danh sách phiếu đã tải để cập nhật dấu khóa và các nút.
function ksVeLaiCacMan() {
  if (plTT.nhap.rows.length) vePhieu('nhap');
  if (plTT.xuat.rows.length) vePhieu('xuat');
}

async function ksMoKhoa(nam) {
  let x = ksDuLieu && ksDuLieu.nam.find((y) => y.nam === nam);
  if (!x) { // năm nhập tay chưa có trong bảng: lấy số liệu của năm đó
    try { x = (await goiApi(`/api/khoa-so?them=${nam}`)).nam.find((y) => y.nam === nam); } catch (err) { hienToast(err.message, true); return; }
  }
  if (x && x.khoa) { hienToast(`Năm ${nam} đã khóa sổ từ trước.`, true); return; }
  const o = (nhan, gt) => `<div class="ts-ct-dong"><span>${nhan}</span><b>${formatSo(gt) || '0'}</b></div>`;
  const namNay = new Date().getFullYear();
  moDialog(`Khóa sổ năm ${nam}`, 'Sau khi khóa, mọi nghiệp vụ có ngày trong năm này chỉ còn xem và xuất báo cáo.',
    `<div class="ts-ct-luoi">${o('Phiếu nhập', x.phieu_nhap)}${o('Phiếu xuất', x.phieu_xuat)}${o('Tồn đầu kỳ', x.ton_dau_ky)}
       ${o('Tài sản ghi tăng', x.ts_ghi_tang)}${o('Tài sản ghi giảm', x.ts_ghi_giam)}${o('Đợt kiểm kê', x.kiem_ke)}</div>
     ${nam >= namNay ? `<div class="ui-note danger"><i class="fas fa-circle-exclamation"></i><span>Năm ${nam} ${nam === namNay ? 'là năm hiện tại, chưa kết thúc' : 'chưa đến'}: sau khi khóa sẽ không lập được phiếu, ghi tăng / ghi giảm tài sản hay đợt kiểm kê nào có ngày trong năm này nữa.</span></div>` : ''}
     ${x.dong_xuat_chua_ghep ? `<div class="ui-note"><i class="fas fa-triangle-exclamation"></i><span>Còn <b>${formatSo(x.dong_xuat_chua_ghep)}</b> dòng xuất trong năm chưa ghép với dòng nhập. Sau khi khóa, "Ghép tự động" sẽ bỏ qua năm này, nên vào <b>Sổ tổng hợp</b> bấm "Ghép tự động" trước.</span></div>` : ''}
     <div class="ui-field">Ghi chú (tùy chọn)<input id="ks-ghi-chu" class="ui-input" placeholder="vd Đã nộp báo cáo quyết toán năm ${nam}" maxlength="300" /></div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Hủy</button>
     <button class="btn btn-primary" type="button" id="ks-ok"><i class="fas fa-lock"></i> Khóa sổ năm ${nam}</button>`);
  document.getElementById('ks-ghi-chu').focus();
  document.getElementById('ks-ok').addEventListener('click', (e) => khiKhoaNut(e.currentTarget, async () => {
    try {
      const d = await goiApi('/api/khoa-so', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ nam, ghi_chu: val('ks-ghi-chu') }) });
      dongDialog();
      ksVe(d);
      ksVeLaiCacMan();
      const o = ksSec().querySelector('[data-ks-nam]');
      if (o) o.value = '';
      hienToast(`Đã khóa sổ năm ${nam}.`);
    } catch (err) { hienToast(err.message, true); }
  }));
}

function ksMoMoKhoa(nam) {
  moDialog(`Mở khóa sổ năm ${nam}`, 'Sau khi mở, các nghiệp vụ trong năm này sửa được như bình thường. Lý do được ghi vào nhật ký khóa sổ.',
    `<div class="ui-note danger"><i class="fas fa-triangle-exclamation"></i><span>Chỉ mở khóa khi cần điều chỉnh số liệu năm ${nam} đã chốt, ví dụ sửa sai chứng từ theo yêu cầu. Sửa xong nên khóa lại.</span></div>
     <div class="ui-field">Lý do mở khóa *<textarea id="ks-ly-do" class="ui-input" rows="3" maxlength="500" placeholder="vd Điều chỉnh đơn giá phiếu xuất PX 12 theo hóa đơn thay thế"></textarea></div>
     <div id="ks-loi" class="ui-note danger" style="display:none"></div>`,
    `<button class="btn btn-neutral" type="button" data-dong>Hủy</button>
     <button class="btn btn-danger" type="button" id="ks-mo-ok"><i class="fas fa-lock-open"></i> Mở khóa năm ${nam}</button>`);
  document.getElementById('ks-ly-do').focus();
  document.getElementById('ks-mo-ok').addEventListener('click', (e) => khiKhoaNut(e.currentTarget, async () => {
    const loiEl = document.getElementById('ks-loi');
    const lyDo = val('ks-ly-do');
    if (lyDo.length < 5) { hienLoi(loiEl, 'Cần ghi rõ lý do mở khóa (ít nhất 5 ký tự).'); return; }
    try {
      const d = await goiApi(`/api/khoa-so/${nam}/mo`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ly_do: lyDo }) });
      dongDialog();
      ksVe(d);
      ksVeLaiCacMan();
      hienToast(`Đã mở khóa sổ năm ${nam}.`);
    } catch (err) { hienLoi(loiEl, esc(err.message)); }
  }));
}
