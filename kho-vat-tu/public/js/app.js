// ===== Tiện ích chung =====
function formatSo(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return Number(n).toLocaleString('vi-VN');
}
function elGia(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  });
  if (text !== undefined) e.textContent = text;
  return e;
}
async function goiApi(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Lỗi không xác định'), { data });
  return data;
}

// ===== Chuyển tab =====
document.querySelectorAll('nav button').forEach((btn) => {
  btn.addEventListener('click', () => chuyenTab(btn.dataset.tab));
});
function chuyenTab(tab) {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === tab));
  if (tab === 'ton-kho') taiTonKho();
  if (tab === 'phieu-nhap') taiDanhSachPhieuNhap();
  if (tab === 'phieu-xuat') taiDanhSachPhieuXuat();
  if (tab === 'tao-xuat') taiDanhSachVatTuChoXuat();
}

// ===== TỒN KHO =====
async function taiTonKho() {
  const tbody = document.getElementById('bang-ton-kho');
  tbody.innerHTML = '<tr><td colspan="5" class="rong">Đang tải...</td></tr>';
  const rows = await goiApi('/api/vat-tu');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="rong">Chưa có vật tư nào. Tạo phiếu nhập đầu tiên để bắt đầu.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    let badge = '<span class="badge ok">Đủ</span>';
    if (r.ton_kho < 0) badge = '<span class="badge am">Âm kho!</span>';
    else if (r.ton_kho === 0) badge = '<span class="badge thap">Hết</span>';
    tr.innerHTML = `
      <td>${r.ten_hang}</td>
      <td>${r.dvt || ''}</td>
      <td class="so">${formatSo(r.tong_nhap)}</td>
      <td class="so">${formatSo(r.tong_xuat)}</td>
      <td class="so">${formatSo(r.ton_kho)} ${badge}</td>`;
    tbody.appendChild(tr);
  });
}

// ===== DANH SÁCH PHIẾU NHẬP / XUẤT =====
async function taiDanhSachPhieuNhap() {
  const tbody = document.getElementById('bang-phieu-nhap');
  tbody.innerHTML = '<tr><td colspan="7" class="rong">Đang tải...</td></tr>';
  const rows = await goiApi('/api/phieu-nhap');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="rong">Chưa có phiếu nhập nào.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.so_phieu || ''}</td><td>${r.ngay || ''}</td><td>${r.nha_cung_cap || ''}</td>
      <td>${r.nguoi_nhap || ''}</td><td>${r.so_dong}</td><td class="so">${formatSo(r.tong_cong)}</td>
      <td>
        <a class="nut phu" href="/api/phieu-nhap/${r.id}/xuat-excel">Xuất Excel</a>
        <button class="nut nguy" data-xoa-nhap="${r.id}">Xóa</button>
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
  tbody.innerHTML = '<tr><td colspan="6" class="rong">Đang tải...</td></tr>';
  const rows = await goiApi('/api/phieu-xuat');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="rong">Chưa có phiếu xuất nào.</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.so_phieu || ''}</td><td>${r.ngay || ''}</td><td>${r.nguoi_nhan || ''}</td>
      <td>${r.ly_do_xuat || ''}</td><td>${r.so_dong}</td><td class="so">${formatSo(r.tong_cong)}</td>
      <td>
        <a class="nut phu" href="/api/phieu-xuat/${r.id}/xuat-excel">Xuất Excel</a>
        <button class="nut nguy" data-xoa-xuat="${r.id}">Xóa</button>
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
  tbody.innerHTML = '';
  dongNhap.forEach((d, i) => {
    const thanhTien = (Number(d.sl_thuc_nhap) || 0) * (Number(d.don_gia) || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input data-i="${i}" data-f="ten_hang" value="${d.ten_hang || ''}" /></td>
      <td><input data-i="${i}" data-f="ma_so" value="${d.ma_so || ''}" style="width:70px" /></td>
      <td><input data-i="${i}" data-f="dvt" value="${d.dvt || ''}" style="width:60px" /></td>
      <td><input data-i="${i}" data-f="sl_chung_tu" type="number" value="${d.sl_chung_tu}" style="width:70px" /></td>
      <td><input data-i="${i}" data-f="sl_thuc_nhap" type="number" value="${d.sl_thuc_nhap}" style="width:70px" /></td>
      <td><input data-i="${i}" data-f="don_gia" type="number" value="${d.don_gia}" style="width:90px" /></td>
      <td class="so">${formatSo(thanhTien)}</td>
      <td class="hang-xoa" data-xoa="${i}">✕</td>`;
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
  tbody.querySelectorAll('[data-xoa]').forEach((td) =>
    td.addEventListener('click', () => {
      dongNhap.splice(Number(td.dataset.xoa), 1);
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
  loiEl.textContent = '';
  const items = dongNhap.filter((d) => d.ten_hang && Number(d.sl_thuc_nhap) > 0);
  if (items.length === 0) {
    loiEl.textContent = 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực nhập > 0.';
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
    chuyenTab('phieu-nhap');
  } catch (err) {
    loiEl.textContent = err.message;
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

async function xuLyFilePdf(file) {
  const canhBaoEl = document.getElementById('upload-canh-bao');
  canhBaoEl.innerHTML = '<div class="canh-bao">Đang đọc file ' + file.name + '...</div>';
  const form = new FormData();
  form.append('file', file);
  try {
    const kq = await goiApi('/api/upload/hoa-don', { method: 'POST', body: form });
    canhBaoEl.innerHTML = '';
    if (kq.truongLaNguoiBan) {
      canhBaoEl.innerHTML += '<div class="canh-bao nguy">⚠️ Hóa đơn này có vẻ do Trường xuất ra (bán), không phải hóa đơn mua vào. Kiểm tra kỹ trước khi lưu.</div>';
    }
    (kq.warnings || []).forEach((w) => {
      canhBaoEl.innerHTML += `<div class="canh-bao">⚠️ ${w}</div>`;
    });

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
      canhBaoEl.innerHTML += `<div class="canh-bao">Tổng cộng trên hóa đơn gốc: <b>${formatSo(kq.tongCong)}</b> — so sánh với tổng tính được bên dưới để kiểm tra.</div>`;
    }
  } catch (err) {
    canhBaoEl.innerHTML = `<div class="canh-bao nguy">Lỗi đọc file: ${err.message}</div>`;
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
  tbody.innerHTML = '';
  dongXuat.forEach((d, i) => {
    const vatTu = dsVatTu.find((v) => v.ten_hang === d.ten_hang);
    const ton = vatTu ? vatTu.ton_kho : null;
    const thanhTien = (Number(d.sl_thuc_xuat) || 0) * (Number(d.don_gia) || 0);
    const vuotTon = ton !== null && Number(d.sl_thuc_xuat) > ton;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input list="ds-vat-tu" data-i="${i}" data-f="ten_hang" value="${d.ten_hang || ''}" /></td>
      <td><input data-i="${i}" data-f="dvt" value="${d.dvt || ''}" style="width:60px" /></td>
      <td class="so">${ton === null ? '—' : formatSo(ton)}</td>
      <td><input data-i="${i}" data-f="sl_yeu_cau" type="number" value="${d.sl_yeu_cau}" style="width:70px" /></td>
      <td><input data-i="${i}" data-f="sl_thuc_xuat" type="number" value="${d.sl_thuc_xuat}" style="width:70px; ${vuotTon ? 'border-color:#dc2626;color:#dc2626' : ''}" /></td>
      <td><input data-i="${i}" data-f="don_gia" type="number" value="${d.don_gia}" style="width:90px" /></td>
      <td class="so">${formatSo(thanhTien)}</td>
      <td class="hang-xoa" data-xoa="${i}">✕</td>`;
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
  tbody.querySelectorAll('[data-xoa]').forEach((td) =>
    td.addEventListener('click', () => {
      dongXuat.splice(Number(td.dataset.xoa), 1);
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
  loiEl.textContent = '';
  const items = dongXuat.filter((d) => d.ten_hang && Number(d.sl_thuc_xuat) > 0);
  if (items.length === 0) {
    loiEl.textContent = 'Cần ít nhất 1 dòng hàng hóa có tên và số lượng thực xuất > 0.';
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
      loiEl.innerHTML = 'Không đủ tồn kho:<br>' + err.data.chi_tiet
        .map((c) => `- ${c.ten_hang}: tồn ${formatSo(c.ton_kho)}, cần xuất ${formatSo(c.muon_xuat)}`)
        .join('<br>');
    } else {
      loiEl.textContent = err.message;
    }
  }
});

// ===== Khởi động =====
veBangDongNhap();
veBangDongXuat();
taiTonKho();
