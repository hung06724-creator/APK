const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TEMPLATE = path.join(__dirname, '..', '..', 'templates', 'theo-doi-nhap-xuat-mau.xls');
const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'theo-doi-excel.py');

function xuatFileTheoDoi(payload) {
  if (!fs.existsSync(TEMPLATE)) {
    throw new Error('Không tìm thấy file mẫu theo-doi-nhap-xuat-mau.xls trong thư mục templates');
  }
  const tmpOut = path.join(os.tmpdir(), `theo-doi-${Date.now()}.xls`);
  const json = JSON.stringify(payload);
  const res = spawnSync('python3', [SCRIPT, 'export', '--template', TEMPLATE, '--dest', tmpOut, '--json', '-'], {
    input: json,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || 'Lỗi khi xuất Excel sổ theo dõi');
  }
  const buf = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpOut);
  return buf;
}

module.exports = { xuatFileTheoDoi, TEMPLATE };
