// Chuyển số tiền (VNĐ) sang chữ tiếng Việt, kiểu kế toán: "Mười chín triệu hai trăm năm mươi nghìn đồng"
const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function docBaChuSo(so, coHangTram) {
  // so: 0..999
  const tram = Math.floor(so / 100);
  const chuc = Math.floor((so % 100) / 10);
  const donvi = so % 10;
  let out = [];

  if (coHangTram || tram > 0) {
    out.push(CHU_SO[tram], 'trăm');
  }

  if (chuc === 0) {
    if (donvi > 0 && (coHangTram || tram > 0)) out.push('lẻ');
  } else if (chuc === 1) {
    out.push('mười');
  } else {
    out.push(CHU_SO[chuc], 'mươi');
  }

  if (donvi > 0) {
    if (chuc >= 2 && donvi === 1) out.push('mốt');
    else if (chuc >= 1 && donvi === 5) out.push('lăm');
    else out.push(CHU_SO[donvi]);
  }

  return out.join(' ');
}

const DON_VI_NHOM = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function soTienBangChu(soTien) {
  let n = Math.round(Number(soTien) || 0);
  if (n === 0) return 'Không đồng';
  const amDau = n < 0;
  n = Math.abs(n);

  const nhoms = [];
  while (n > 0) {
    nhoms.unshift(n % 1000);
    n = Math.floor(n / 1000);
  }

  const parts = [];
  for (let i = 0; i < nhoms.length; i++) {
    const nhom = nhoms[i];
    if (nhom === 0) continue;
    const laNhomDau = i === 0;
    const chu = docBaChuSo(nhom, !laNhomDau);
    const donVi = DON_VI_NHOM[nhoms.length - 1 - i] || '';
    parts.push(donVi ? `${chu} ${donVi}` : chu);
  }

  let ket = parts.join(' ').replace(/\s+/g, ' ').trim();
  ket = ket.charAt(0).toUpperCase() + ket.slice(1);
  return `${amDau ? 'Âm ' : ''}${ket} đồng`;
}

module.exports = { soTienBangChu };
