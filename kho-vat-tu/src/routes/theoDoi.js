const express = require('express');
const { db, THEO_DOI_DONG_FIELDS, tinhThanhTienDong } = require('../db');
const { xuatFileTheoDoi } = require('../services/xuatTheoDoiNhapXuat');

const router = express.Router();

function chuanHoaDong(body, sheetId) {
  const dong = { sheet_id: sheetId };
  THEO_DOI_DONG_FIELDS.forEach((k) => {
    const v = body[k];
    if (v === undefined || v === null || v === '') {
      dong[k] = null;
      return;
    }
    if (k.startsWith('sl_') || k.startsWith('don_gia_') || k.startsWith('thanh_tien_')) {
      const n = Number(v);
      dong[k] = Number.isNaN(n) ? null : n;
    } else {
      dong[k] = String(v).trim();
    }
  });
  return tinhThanhTienDong(dong);
}

router.get('/sheet', (req, res) => {
  const rows = db.prepare('SELECT * FROM theo_doi_sheet ORDER BY thu_tu, id').all();
  res.json(rows);
});

router.put('/sheet/:id', (req, res) => {
  const id = Number(req.params.id);
  const sheet = db.prepare('SELECT * FROM theo_doi_sheet WHERE id = ?').get(id);
  if (!sheet) return res.status(404).json({ error: 'Không tìm thấy sheet' });
  const { tieu_de, ten_sheet } = req.body || {};
  db.prepare('UPDATE theo_doi_sheet SET tieu_de = COALESCE(?, tieu_de), ten_sheet = COALESCE(?, ten_sheet) WHERE id = ?').run(
    tieu_de !== undefined ? String(tieu_de) : null,
    ten_sheet !== undefined ? String(ten_sheet).trim() : null,
    id
  );
  res.json(db.prepare('SELECT * FROM theo_doi_sheet WHERE id = ?').get(id));
});

router.get('/dong', (req, res) => {
  const sheetId = req.query.sheet_id ? Number(req.query.sheet_id) : null;
  let sql = `
    SELECT d.*, s.ten_sheet, s.tieu_de
    FROM theo_doi_dong d
    JOIN theo_doi_sheet s ON s.id = d.sheet_id
  `;
  const params = [];
  if (sheetId) {
    sql += ' WHERE d.sheet_id = ?';
    params.push(sheetId);
  }
  sql += ' ORDER BY d.sheet_id, d.thu_tu, d.id';
  res.json(db.prepare(sql).all(...params));
});

router.get('/dong/:id', (req, res) => {
  const row = db
    .prepare(
      `SELECT d.*, s.ten_sheet, s.tieu_de FROM theo_doi_dong d
       JOIN theo_doi_sheet s ON s.id = d.sheet_id WHERE d.id = ?`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Không tìm thấy dòng' });
  res.json(row);
});

router.post('/dong', (req, res) => {
  const sheetId = Number(req.body?.sheet_id);
  if (!sheetId) return res.status(400).json({ error: 'Cần chọn sheet (sheet_id)' });
  const sheet = db.prepare('SELECT id FROM theo_doi_sheet WHERE id = ?').get(sheetId);
  if (!sheet) return res.status(400).json({ error: 'Sheet không hợp lệ' });
  const dong = chuanHoaDong(req.body, sheetId);
  const maxThuTu = db.prepare('SELECT COALESCE(MAX(thu_tu), 0) AS m FROM theo_doi_dong WHERE sheet_id = ?').get(sheetId).m;
  const cols = ['sheet_id', 'thu_tu', ...THEO_DOI_DONG_FIELDS];
  const vals = cols.map((c) => `@${c}`).join(', ');
  const info = db
    .prepare(`INSERT INTO theo_doi_dong (${cols.join(', ')}) VALUES (${vals})`)
    .run({ ...dong, thu_tu: maxThuTu + 1 });
  res.status(201).json(db.prepare('SELECT * FROM theo_doi_dong WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/dong/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM theo_doi_dong WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy dòng' });
  const sheetId = req.body.sheet_id !== undefined ? Number(req.body.sheet_id) : existing.sheet_id;
  const dong = chuanHoaDong({ ...existing, ...req.body }, sheetId);
  const sets = THEO_DOI_DONG_FIELDS.map((k) => `${k} = @${k}`).join(', ');
  db.prepare(
    `UPDATE theo_doi_dong SET sheet_id = @sheet_id, ${sets}, updated_at = datetime('now') WHERE id = @id`
  ).run({ ...dong, id, sheet_id: sheetId });
  res.json(db.prepare('SELECT * FROM theo_doi_dong WHERE id = ?').get(id));
});

router.delete('/dong/:id', (req, res) => {
  const info = db.prepare('DELETE FROM theo_doi_dong WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Không tìm thấy dòng' });
  res.json({ ok: true });
});

router.get('/xuat-excel', (req, res) => {
  try {
    const sheets = db.prepare('SELECT * FROM theo_doi_sheet ORDER BY thu_tu, id').all();
    const payload = {
      sheets: sheets.map((s) => ({
        ten_sheet: s.ten_sheet.trim(),
        tieu_de: s.tieu_de,
        rows: db
          .prepare('SELECT * FROM theo_doi_dong WHERE sheet_id = ? ORDER BY thu_tu, id')
          .all(s.id)
          .map((d) => {
            const row = {};
            THEO_DOI_DONG_FIELDS.forEach((k) => { row[k] = d[k]; });
            return tinhThanhTienDong(row);
          }),
      })),
    };
    const buf = xuatFileTheoDoi(payload);
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', 'attachment; filename="Theo-doi-nhap-xuat.xls"');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
