const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { tinhThanhTienDong } = require('../src/db');

test('tinhThanhTienDong nhân SL và đơn giá TK 661', () => {
  const out = tinhThanhTienDong({ sl_nhap_661: 10, don_gia_nhap_661: 2500 });
  assert.strictEqual(out.thanh_tien_nhap_661, 25000);
});

test('tinhThanhTienDong giữ thành tiền đã nhập tay', () => {
  const out = tinhThanhTienDong({ sl_nhap_661: 10, don_gia_nhap_661: 2500, thanh_tien_nhap_661: 999 });
  assert.strictEqual(out.thanh_tien_nhap_661, 999);
});

let proc;
let baseUrl;

before(async () => {
  const dataDir = path.join(__dirname, '..', 'data-test');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'kho-test.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  proc = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '3099', KHO_DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  baseUrl = 'http://127.0.0.1:3099';
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Server timeout')), 15000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes('3099')) {
        clearTimeout(t);
        resolve();
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('error', reject);
  });
  await new Promise((r) => setTimeout(r, 300));
});

after(() => {
  if (proc) proc.kill('SIGTERM');
});

test('API theo dõi: tạo dòng và xuất Excel', async () => {
  const sheets = await fetch(`${baseUrl}/api/theo-doi/sheet`).then((r) => r.json());
  assert.ok(sheets.length >= 1);
  const sheetId = sheets[0].id;
  const created = await fetch(`${baseUrl}/api/theo-doi/dong`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sheet_id: sheetId,
      ngay_nhap: '15/01/2026',
      phieu_nhap: 'PN-TEST',
      trich_yeu: 'Vật tư kiểm thử',
      dvt: 'cái',
      sl_nhap_661: 5,
      don_gia_nhap_661: 10000,
    }),
  }).then((r) => r.json());
  assert.ok(created.id);
  assert.strictEqual(created.thanh_tien_nhap_661, 50000);

  const list = await fetch(`${baseUrl}/api/theo-doi/dong?sheet_id=${sheetId}`).then((r) => r.json());
  assert.ok(list.some((x) => x.id === created.id));

  const xls = await fetch(`${baseUrl}/api/theo-doi/xuat-excel`);
  assert.strictEqual(xls.status, 200);
  const buf = Buffer.from(await xls.arrayBuffer());
  assert.ok(buf.length > 10000);
  const out = path.join(__dirname, '..', 'data-test', 'out-test.xls');
  fs.writeFileSync(out, buf);
});
