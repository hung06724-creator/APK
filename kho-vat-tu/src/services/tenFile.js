// Tên file tải về: phần chính chỉ giữ ký tự ASCII an toàn (header HTTP không nhận ký tự
// ngoài Latin-1, và dấu " hay xuống dòng sẽ chèn được tham số vào header); bản tiếng Việt
// đầy đủ đi qua filename* (RFC 5987).
function headerTaiFile(tenFile) {
  const goc = String(tenFile).replace(/[\r\n]/g, ' ');
  const an = goc
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9._-]+/g, '_');
  return `attachment; filename="${an}"; filename*=UTF-8''${encodeURIComponent(goc)}`;
}

module.exports = { headerTaiFile };
