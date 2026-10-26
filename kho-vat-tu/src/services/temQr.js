// Mã QR cho tài sản. Nội dung QR = mã tài sản (chuỗi thuần) để súng quét / app quét điện thoại đọc ra đúng mã,
// dùng được ngay ở ô "Nhập hoặc quét mã" của trang Kiểm kê.
// - pngQr: ảnh PNG 1 mã; - trangInTem: trang HTML in tem A4; - excelTem: file Excel tem (ảnh QR + chữ).
const QRCode = require('qrcode');
const ExcelJS = require('exceljs');

const noiDungQr = (r) => String(r.ma_tai_san || `TS-${r.id}`);
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const QR_OPT = { errorCorrectionLevel: 'M', margin: 1 };

// Bộ nhớ đệm ảnh QR (mã tài sản ít khi đổi): in tem / mở form lần sau không phải vẽ lại.
const BO_NHO_QR = new Map();
async function pngQr(text, width = 240) {
  const w = Math.max(80, Math.min(1000, Number(width) || 240));
  const khoa = `${w}|${text}`;
  let anh = BO_NHO_QR.get(khoa);
  if (!anh) {
    anh = await QRCode.toBuffer(String(text), { ...QR_OPT, width: w });
    if (BO_NHO_QR.size >= 6000) BO_NHO_QR.delete(BO_NHO_QR.keys().next().value); // giữ tối đa 6.000 ảnh (vài MB)
    BO_NHO_QR.set(khoa, anh);
  }
  return anh;
}

const noiSuDung = (r) => [r.bo_phan, r.vi_tri].filter(Boolean).join(' · ');

// Trang in: lưới tem trên khổ A4, mỗi tem có QR + tên đơn vị + mã + tên tài sản + nơi sử dụng (+ trường gốc nếu khác).
async function trangInTem({ items, cot, cauHinh, truongGoc, tieuDe }) {
  const soCot = [2, 3, 4, 5].includes(Number(cot)) ? Number(cot) : 3;
  const tem = await Promise.all(items.map(async (r) => {
    const svg = await QRCode.toString(noiDungQr(r), { ...QR_OPT, type: 'svg' });
    return `<div class="tem">
      <div class="qr">${svg}</div>
      <div class="chu">
        <div class="dv">${esc(cauHinh.ten_don_vi_so || cauHinh.ten_don_vi)}</div>
        <div class="ma">${esc(noiDungQr(r))}</div>
        <div class="ten">${esc(r.ten)}</div>
        ${noiSuDung(r) ? `<div class="noi">${esc(noiSuDung(r))}</div>` : ''}
        ${r.truong && r.truong !== truongGoc ? `<div class="noi nguon">Tiếp nhận từ: ${esc(String(r.truong).replace(/^Trường\s+/i, ''))}</div>` : ''}
      </div>
    </div>`;
  }));
  const rongMm = (190 / soCot).toFixed(1);
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(tieuDe)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Times New Roman", serif; color: #000; background: #fff; }
  .thanh { position: sticky; top: 0; display: flex; gap: 12px; align-items: center; padding: 10px 16px; background: #f2f5f4; border-bottom: 1px solid #ccc; font: 14px Arial, sans-serif; }
  .thanh button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 1px solid #2f6b5f; background: #2f6b5f; color: #fff; cursor: pointer; }
  .luoi { display: grid; grid-template-columns: repeat(${soCot}, ${rongMm}mm); gap: 0; padding: 10mm; justify-content: center; }
  .tem { display: flex; gap: 2mm; align-items: center; padding: 2.5mm; border: 0.3mm dashed #888; break-inside: avoid; page-break-inside: avoid; min-height: ${soCot >= 5 ? 24 : soCot === 4 ? 28 : 33}mm; }
  .qr { flex: 0 0 auto; width: ${soCot >= 5 ? 17 : soCot === 4 ? 21 : 26}mm; }
  .qr svg { display: block; width: 100%; height: auto; }
  .chu { min-width: 0; line-height: 1.2; }
  .dv { font-size: ${soCot >= 5 ? 6 : 7}pt; text-transform: uppercase; color: #333; }
  .ma { font-size: ${soCot >= 5 ? 9 : 11}pt; font-weight: bold; margin: 0.6mm 0; word-break: break-all; }
  .ten { font-size: ${soCot >= 5 ? 7 : 8}pt; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .noi { font-size: ${soCot >= 5 ? 6 : 7}pt; color: #333; margin-top: 0.5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .noi.nguon { white-space: normal; font-style: italic; }
  @media print { .thanh { display: none; } .luoi { padding: 0; } }
</style></head><body>
<div class="thanh"><b>${esc(tieuDe)}</b><span>${items.length} tem · ${soCot} tem/hàng · khổ A4</span><button onclick="window.print()">In tem</button></div>
<div class="luoi">${tem.join('')}</div>
</body></html>`;
}

// Excel tem: mỗi tem chiếm 1 ô ảnh QR + 1 ô chữ; soCot tem mỗi hàng; viền nét đứt để cắt.
async function excelTem({ items, cot, cauHinh, truongGoc, tieuDe }) {
  const soCot = [2, 3, 4].includes(Number(cot)) ? Number(cot) : 3;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tem QR', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
  });
  const rongQr = 13;
  const rongChu = soCot === 4 ? 14 : soCot === 2 ? 30 : 20;
  for (let i = 0; i < soCot; i++) { ws.getColumn(i * 2 + 1).width = rongQr; ws.getColumn(i * 2 + 2).width = rongChu; }
  ws.mergeCells(1, 1, 1, soCot * 2);
  const t = ws.getCell(1, 1);
  t.value = `${tieuDe} — ${cauHinh.ten_don_vi_so || cauHinh.ten_don_vi}`;
  t.font = { name: 'Times New Roman', bold: true, size: 12 };
  t.alignment = { horizontal: 'center' };
  const net = { style: 'dashed', color: { argb: 'FF888888' } };
  // Vẽ QR từng đợt 50 tem rồi nhường lượt cho yêu cầu khác (in ~2.400 tem không làm treo máy chủ).
  // 140 px cho ô hiển thị 92 px: in vẫn nét, nhanh gấp đôi so với 200 px.
  const anh = [];
  for (let i = 0; i < items.length; i += 50) {
    anh.push(...(await Promise.all(items.slice(i, i + 50).map((r) => pngQr(noiDungQr(r), 140)))));
    await new Promise((xong) => setImmediate(xong));
  }
  items.forEach((r, i) => {
    const hang = 3 + Math.floor(i / soCot);
    const c = (i % soCot) * 2 + 1;
    ws.getRow(hang).height = 78;
    const id = wb.addImage({ buffer: anh[i], extension: 'png' });
    ws.addImage(id, { tl: { col: c - 1 + 0.08, row: hang - 1 + 0.06 }, ext: { width: 92, height: 92 }, editAs: 'oneCell' });
    const oQr = ws.getCell(hang, c);
    const oChu = ws.getCell(hang, c + 1);
    oQr.border = { top: net, left: net, bottom: net };
    oChu.border = { top: net, right: net, bottom: net };
    oChu.value = {
      richText: [
        { text: `${(cauHinh.ten_don_vi_so || cauHinh.ten_don_vi || '').toUpperCase()}\n`, font: { name: 'Times New Roman', size: 6 } },
        { text: `${noiDungQr(r)}\n`, font: { name: 'Times New Roman', size: 10, bold: true } },
        { text: `${r.ten}`, font: { name: 'Times New Roman', size: 8 } },
        ...(noiSuDung(r) ? [{ text: `\n${noiSuDung(r)}`, font: { name: 'Times New Roman', size: 7, italic: true } }] : []),
        ...(r.truong && r.truong !== truongGoc ? [{ text: `\nTiếp nhận từ: ${r.truong}`, font: { name: 'Times New Roman', size: 6, italic: true } }] : []),
      ],
    };
    oChu.alignment = { vertical: 'middle', wrapText: true };
  });
  return wb.xlsx.writeBuffer();
}

module.exports = { pngQr, trangInTem, excelTem, noiDungQr };
