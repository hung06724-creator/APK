// ===== Tiện ích chung =====
function formatSo(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return Number(n).toLocaleString('vi-VN');
}
async function goiApi(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Lỗi không xác định'), { data });
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

// ===== Chuyển tab (menu bên) =====
document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach((btn) => {
  btn.addEventListener('click', () => chuyenTab(btn.dataset.tab));
});
document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => chuyenTab(btn.dataset.goto));
});
function chuyenTab(tab) {
  document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === tab));
  if (tab === 'ton-kho') taiTonKho();
  if (tab === 'phieu-nhap') taiDanhSachPhieuNhap();
  if (tab === 'phieu-xuat') taiDanhSachPhieuXuat();
  if (tab === 'tao-xuat') {
    taiDanhSachVatTuChoXuat();
    taiDanhSachPhieuNhapChoChon('px-chon-phieu-nhap');
  }
  if (tab === 'tach-xuat') taiDanhSachPhieuNhapChoChon('tx-phieu-nhap');
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
      <td>${r.ten_hang}</td>
      <td>${r.dvt || ''}</td>
      <td class="num">${formatSo(r.tong_nhap)}</td>
      <td class="num">${formatSo(r.tong_xuat)}</td>
      <td class="num">${formatSo(r.ton_kho)} ${nhan}</td>`;
    tbody.appendChild(tr);
  });
}

// ===== DANH SÁCH PHIẾU NHẬP / XUẤT =====
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
      <td>${r.so_phieu || ''}</td><td>${r.ngay || ''}</td><td>${r.nha_cung_cap || ''}</td>
      <td>${r.nguoi_nhap || ''}</td><td class="num">${r.so_dong}</td><td class="num">${formatSo(r.tong_cong)}</td>
      <td>
        <a class="btn btn-sm btn-neutral" href="/api/phieu-nhap/${r.id}/xuat-excel"><i class="fas fa-file-excel"></i> Xuất Excel</a>
        <button class="btn btn-sm btn-danger" data-xoa-nhap="${r.id}"><i class="fas fa-trash"></i></button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-xoa-nhap]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu nhập này? Tồn kho sẽ giảm tương ứng.')) return;
      await goiApi('/api/phieu-nhap/' + btn.dataset.xoaNhap, { method: 'DELETE' });
      taiDanhSachPhieuNhap();
    })
  );
}

async function taiDanhSachPhieuXuat() {
  const tbody = document.getElementById('bang-phieu-xuat');
  tbody.innerHTML = oTrong(6, 'spinner', 'Đang tải...');
  const rows = await goiApi('/api/phieu-xuat');
  if (rows.length === 0) {
    tbody.innerHTML = oTrong(6, 'inbox', 'Chưa có phiếu xuất nào.');
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.so_phieu || ''}</td><td>${r.ngay || ''}</td><td>${r.nguoi_nhan || ''}</td>
      <td>${r.ly_do_xuat || ''}</td><td class="num">${r.so_dong}</td><td class="num">${formatSo(r.tong_cong)}</td>
      <td>
        <a class="btn btn-sm btn-neutral" href="/api/phieu-xuat/${r.id}/xuat-excel"><i class="fas fa-file-excel"></i> Xuất Excel</a>
        <button class="btn btn-sm btn-danger" data-xoa-xuat="${r.id}"><i class="fas fa-trash"></i></button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-xoa-xuat]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('Xóa phiếu xuất này? Tồn kho sẽ tăng lại tương ứng.')) return;
      await goiApi('/api/phieu-xuat/' + btn.dataset.xoaXuat, { method: 'DELETE' });
      taiDanhSachPhieuXuat();
    })
  );
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
  };
}

function veBangDongNhap() {
  const tbody = document.getElementById('bang-dong-nhap');
  if (dongNhap.length === 0) {
    tbody.innerHTML = oTrong(9, 'list', 'Chưa có dòng hàng hóa nào. Tải hóa đơn PDF hoặc bấm "Thêm dòng".');
    return;
  }
  tbody.innerHTML = '';
  dongNhap.forEach((d, i) => {
    const thanhTien = (Number(d.sl_thuc_nhap) || 0) * (Number(d.don_gia) || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input class="ui-input cell text" data-i="${i}" data-f="ten_hang" value="${d.ten_hang || ''}" /></td>
      <td><input class="ui-input cell ctr" data-i="${i}" data-f="ma_so" value="${d.ma_so || ''}" style="width:64px" /></td>
      <td><input class="ui-input cell ctr" data-i="${i}" data-f="dvt" value="${d.dvt || ''}" style="width:56px" /></td>
      <td><input class="ui-input cell" data-i="${i}" data-f="sl_chung_tu" type="number" value="${d.sl_chung_tu}" style="width:72px" /></td>
      <td><input class="ui-input cell" data-i="${i}" data-f="sl_thuc_nhap" type="number" value="${d.sl_thuc_nhap}" style="width:72px" /></td>
      <td><input class="ui-input cell" data-i="${i}" data-f="don_gia" type="number" value="${d.don_gia}" style="width:96px" /></td>
      <td class="num">${formatSo(thanhTien)}</td>
      <td><button class="btn btn-ghost btn-sm" data-xoa="${i}" type="button"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const i = Number(e.target.dataset.i);
      const f = e.target.dataset.f;
      dongNhap[i][f] = e.target.value;
      capNhatTongNhap();
      if (f === 'sl_thuc_nhap' || f === 'don_gia') veBangDongNhap();
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
  document.getElementById('pn-tong-hang').textContent = formatSo(tongHang);
  document.getElementById('pn-tien-thue').textContent = formatSo(tienThue);
  document.getElementById('pn-tong-cong').textContent = formatSo(tongHang + tienThue);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    alert('Đã lưu phiếu nhập kho.');
    dongNhap = [];
    veBangDongNhap();
    capNhatTongNhap();
    ['pn-so-phieu','pn-ngay','pn-nha-cung-cap','pn-no-tk','pn-co-tk','pn-chung-tu','pn-nguoi-nhap','pn-don-vi','pn-nhap-tai-kho','pn-ly-do','pn-dia-diem']
      .forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('upload-canh-bao').innerHTML = '';
    chuyenTab('phieu-nhap');
  } catch (err) {
    hienLoi(loiEl, err.message);
  }
});

function val(id) {
  return document.getElementById(id).value.trim();
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
});

function dongCanhBao(noiDung, nguy) {
  return `<div class="ui-note${nguy ? ' danger' : ''}"><i class="fas fa-${nguy ? 'circle-exclamation' : 'triangle-exclamation'}"></i><span>${noiDung}</span></div>`;
}

async function xuLyFilePdf(file) {
  const canhBaoEl = document.getElementById('upload-canh-bao');
  canhBaoEl.innerHTML = dongCanhBao('Đang đọc file ' + file.name + '...', false);
  const form = new FormData();
  form.append('file', file);
  try {
    const kq = await goiApi('/api/upload/hoa-don', { method: 'POST', body: form });
    canhBaoEl.innerHTML = '';
    if (kq.truongLaNguoiBan) {
      canhBaoEl.innerHTML += dongCanhBao('Hóa đơn này có vẻ do Trường xuất ra (bán), không phải hóa đơn mua vào. Kiểm tra kỹ trước khi lưu.', true);
    }
    (kq.warnings || []).forEach((w) => { canhBaoEl.innerHTML += dongCanhBao(w, false); });

    document.getElementById('pn-ngay').value = kq.ngay || '';
    document.getElementById('pn-nha-cung-cap').value = kq.tenNguoiBan || '';
    document.getElementById('pn-chung-tu').value = kq.kyHieu && kq.soHoaDon
      ? `01 Hóa đơn GTGT ký hiệu ${kq.kyHieu} số ${kq.soHoaDon}` : '';
    document.getElementById('pn-thue-suat').value = (kq.items[0] && kq.items[0].thue_suat) || 8;

    dongNhap = (kq.items || []).map((it) =>
      dongNhapMoi({
        ten_hang: it.ten_hang, dvt: it.dvt,
        sl_chung_tu: it.sl_chung_tu, sl_thuc_nhap: it.sl_thuc_nhap, don_gia: it.don_gia,
      })
    );
    if (dongNhap.length === 0) dongNhap.push(dongNhapMoi());
    veBangDongNhap();
    capNhatTongNhap();

    if (kq.tongCong) {
      canhBaoEl.innerHTML += dongCanhBao(`Tổng cộng trên hóa đơn gốc: <b>${formatSo(kq.tongCong)}</b> — so sánh với tổng tính được bên dưới để kiểm tra.`, false);
    }
  } catch (err) {
    canhBaoEl.innerHTML = dongCanhBao('Lỗi đọc file: ' + err.message, true);
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
  datalist.innerHTML = dsVatTu.map((v) => `<option value="${v.ten_hang}">`).join('');
}

function dongXuatMoi(du = {}) {
  return {
    vat_tu_id: du.vat_tu_id || null,
    ten_hang: du.ten_hang || '',
    dvt: du.dvt || '',
    sl_yeu_cau: du.sl_yeu_cau ?? '',
    sl_thuc_xuat: du.sl_thuc_xuat ?? '',
    don_gia: du.don_gia ?? '',
  };
}

function veBangDongXuat() {
  const tbody = document.getElementById('bang-dong-xuat');
  if (dongXuat.length === 0) {
    tbody.innerHTML = oTrong(9, 'list', 'Chưa có dòng hàng hóa nào. Bấm "Thêm dòng" và chọn vật tư từ tồn kho.');
    return;
  }
  tbody.innerHTML = '';
  dongXuat.forEach((d, i) => {
    const vatTu = dsVatTu.find((v) => v.ten_hang === d.ten_hang);
    const ton = vatTu ? vatTu.ton_kho : null;
    const thanhTien = (Number(d.sl_thuc_xuat) || 0) * (Number(d.don_gia) || 0);
    const vuotTon = ton !== null && Number(d.sl_thuc_xuat) > ton;
    const tr = document.createElement('tr');
    if (vuotTon) tr.classList.add('is-danger');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input class="ui-input cell text" list="ds-vat-tu" data-i="${i}" data-f="ten_hang" value="${d.ten_hang || ''}" /></td>
      <td><input class="ui-input cell ctr" data-i="${i}" data-f="dvt" value="${d.dvt || ''}" style="width:56px" /></td>
      <td class="num">${ton === null ? '—' : formatSo(ton)}</td>
      <td><input class="ui-input cell" data-i="${i}" data-f="sl_yeu_cau" type="number" value="${d.sl_yeu_cau}" style="width:72px" /></td>
      <td><input class="ui-input cell" data-i="${i}" data-f="sl_thuc_xuat" type="number" value="${d.sl_thuc_xuat}" style="width:72px" /></td>
      <td><input class="ui-input cell" data-i="${i}" data-f="don_gia" type="number" value="${d.don_gia}" style="width:96px" /></td>
      <td class="num">${formatSo(thanhTien)}</td>
      <td><button class="btn btn-ghost btn-sm" data-xoa="${i}" type="button"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
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
        }
      }
      capNhatTongXuat();
      if (f === 'sl_thuc_xuat' || f === 'don_gia' || f === 'ten_hang') veBangDongXuat();
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
  document.getElementById('px-tong-hang').textContent = formatSo(tongHang);
  document.getElementById('px-tien-thue').textContent = formatSo(tienThue);
  document.getElementById('px-tong-cong').textContent = formatSo(tongHang + tienThue);
}

document.getElementById('them-dong-xuat').addEventListener('click', () => {
  dongXuat.push(dongXuatMoi());
  veBangDongXuat();
});
document.getElementById('px-thue-suat').addEventListener('input', capNhatTongXuat);

document.getElementById('luu-phieu-xuat').addEventListener('click', async () => {
  const loiEl = document.getElementById('px-loi');
  hienLoi(loiEl, '');
  const items = dongXuat.filter((d) => d.ten_hang && Number(d.sl_thuc_xuat) > 0);
  if (items.length === 0) {
    hienLoi(loiEl, 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực xuất > 0.');
    return;
  }
  const body = {
    so_phieu: val('px-so-phieu'),
    ngay: val('px-ngay'),
    no_tk: val('px-no-tk'),
    co_tk: val('px-co-tk'),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    alert('Đã lưu phiếu xuất kho.');
    dongXuat = [];
    veBangDongXuat();
    capNhatTongXuat();
    ['px-so-phieu','px-ngay','px-nguoi-nhan','px-no-tk','px-co-tk','px-don-vi','px-ly-do','px-xuat-tai-kho','px-dia-diem','px-chung-tu']
      .forEach((id) => (document.getElementById(id).value = ''));
    chuyenTab('phieu-xuat');
  } catch (err) {
    if (err.data && err.data.chi_tiet) {
      hienLoi(loiEl, 'Không đủ tồn kho:<br>' + err.data.chi_tiet
        .map((c) => `- ${c.ten_hang}: tồn ${formatSo(c.ton_kho)}, cần xuất ${formatSo(c.muon_xuat)}`)
        .join('<br>'));
    } else {
      hienLoi(loiEl, err.message);
    }
  }
});

// ===== Chọn phiếu nhập để tự điền phiếu xuất =====
async function taiDanhSachPhieuNhapChoChon(idSelect) {
  const ds = await goiApi('/api/phieu-nhap');
  const sel = document.getElementById(idSelect);
  const dangChon = sel.value;
  sel.innerHTML = '<option value="">— Chọn phiếu nhập —</option>' +
    ds.map((p) => `<option value="${p.id}">${p.so_phieu || '(không số)'} — ${p.ngay || ''} — ${p.nha_cung_cap || ''} (${p.so_dong} dòng)</option>`).join('');
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
  dongXuat = (phieu.items || []).map((it) =>
    dongXuatMoi({
      vat_tu_id: it.vat_tu_id, ten_hang: it.ten_hang, dvt: it.dvt,
      sl_yeu_cau: it.sl_thuc_nhap, sl_thuc_xuat: it.sl_thuc_nhap, don_gia: it.don_gia,
    })
  );
  if (!dsVatTu.length) await taiDanhSachVatTuChoXuat();
  veBangDongXuat();
  capNhatTongXuat();
});

// ===== TÁCH PHIẾU NHẬP THÀNH NHIỀU PHIẾU XUẤT =====
let txKieu = 'chia-doi';
document.querySelectorAll('#tx-kieu-seg button').forEach((btn) => {
  btn.addEventListener('click', () => {
    txKieu = btn.dataset.kieu;
    document.querySelectorAll('#tx-kieu-seg button').forEach((b) => b.classList.toggle('on', b === btn));
    document.getElementById('tx-vung-chia-doi').style.display = txKieu === 'chia-doi' ? 'grid' : 'none';
    document.getElementById('tx-vung-tung-mat-hang').style.display = txKieu === 'tung-mat-hang' ? 'grid' : 'none';
  });
});

document.getElementById('tx-phieu-nhap').addEventListener('change', async (e) => {
  const id = e.target.value;
  const xemTruoc = document.getElementById('tx-xem-truoc');
  if (!id) { xemTruoc.innerHTML = ''; return; }
  const phieu = await goiApi('/api/phieu-nhap/' + id);
  document.getElementById('tx-ly-do').value = `Xuất theo phiếu nhập ${phieu.so_phieu || '#' + phieu.id}`;
  xemTruoc.innerHTML = `
    <table class="ui-table">
      <thead><tr><th>Tên hàng</th><th>ĐVT</th><th class="num">SL đã nhập</th></tr></thead>
      <tbody>${(phieu.items || []).map((it) => `<tr><td>${it.ten_hang}</td><td>${it.dvt || ''}</td><td class="num">${formatSo(it.sl_thuc_nhap)}</td></tr>`).join('')}</tbody>
    </table>`;
});

document.getElementById('tx-tao-phieu').addEventListener('click', async () => {
  const loiEl = document.getElementById('tx-loi');
  const ketQuaEl = document.getElementById('tx-ket-qua');
  hienLoi(loiEl, '');
  ketQuaEl.style.display = 'none';

  const phieuNhapId = document.getElementById('tx-phieu-nhap').value;
  if (!phieuNhapId) { hienLoi(loiEl, 'Chưa chọn phiếu nhập cần tách.'); return; }

  const chung = {
    phieu_nhap_id: Number(phieuNhapId),
    kieu: txKieu,
    ngay: document.getElementById('tx-ngay').value,
    co_tk: document.getElementById('tx-co-tk').value.trim(),
    thue_suat: Number(document.getElementById('tx-thue-suat').value) || 0,
    ly_do_xuat: document.getElementById('tx-ly-do').value.trim(),
    xuat_tai_kho: document.getElementById('tx-xuat-tai-kho').value.trim(),
    dia_diem: document.getElementById('tx-dia-diem').value.trim(),
  };

  if (txKieu === 'chia-doi') {
    chung.donViA = {
      nguoi_nhan: document.getElementById('tx-a-nguoi-nhan').value.trim(),
      don_vi: document.getElementById('tx-a-don-vi').value.trim(),
      so_phieu: document.getElementById('tx-a-so-phieu').value.trim(),
    };
    chung.donViB = {
      nguoi_nhan: document.getElementById('tx-b-nguoi-nhan').value.trim(),
      don_vi: document.getElementById('tx-b-don-vi').value.trim(),
      so_phieu: document.getElementById('tx-b-so-phieu').value.trim(),
    };
  } else {
    chung.donVi = {
      nguoi_nhan: document.getElementById('tx-m-nguoi-nhan').value.trim(),
      don_vi: document.getElementById('tx-m-don-vi').value.trim(),
      so_phieu_goc: document.getElementById('tx-m-so-phieu-goc').value.trim(),
    };
  }

  try {
    const kq = await goiApi('/api/phieu-xuat/tach-tu-nhap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chung),
    });
    let html = `<i class="fas fa-circle-check"></i><span>Đã tạo ${kq.so_phieu_da_tao} phiếu xuất.</span>`;
    if (kq.canh_bao && kq.canh_bao.length) {
      html += '<br>' + kq.canh_bao.map((w) => `⚠️ ${w}`).join('<br>');
    }
    ketQuaEl.innerHTML = html;
    ketQuaEl.style.display = 'flex';
    document.getElementById('tx-xem-truoc').innerHTML = '';
    document.getElementById('tx-phieu-nhap').value = '';
  } catch (err) {
    if (err.data && err.data.chi_tiet) {
      hienLoi(loiEl, 'Không đủ tồn kho:<br>' + err.data.chi_tiet
        .map((c) => `- ${c.ten_hang}: tồn ${formatSo(c.ton_kho)}, cần xuất ${formatSo(c.muon_xuat)}`)
        .join('<br>'));
    } else {
      hienLoi(loiEl, err.message);
    }
  }
});

// ===== Khởi động =====
veBangDongNhap();
veBangDongXuat();
taiTonKho();
