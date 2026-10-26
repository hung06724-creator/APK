# Quản lý kho vật tư

## Dùng ngay qua link, không cần cài gì

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hung06724-creator/APK)

Bấm nút trên, đăng nhập/tạo tài khoản Render (miễn phí) nếu được hỏi, rồi bấm
**"Apply"**. Sau 2-3 phút, Render cho một link dạng `https://kho-vat-tu-xxxx.onrender.com`
— mở link đó là dùng được, không cần Node.js hay PowerShell.

**Lưu ý về gói miễn phí của Render:**
- Server "ngủ" sau 15 phút không ai truy cập, lần mở lại đầu tiên sẽ chậm khoảng
  30-50 giây để "thức dậy" — bình thường, không phải lỗi.
- Dữ liệu (database) có thể bị xóa mỗi khi triển khai lại bản mới (không phải mỗi lần
  server ngủ/thức). Nếu cần giữ dữ liệu chắc chắn lâu dài, nên chạy trên máy cá nhân
  (xem phần dưới) hoặc nâng cấp gói có ổ đĩa riêng của Render.
- **Ứng dụng chưa có đăng nhập:** ai có link Render đều xem, sửa, xóa được dữ liệu. Chỉ chia sẻ link cho người
  cần dùng, hoặc chạy trên máy cá nhân.

Website chạy trên máy cá nhân (localhost), giúp:
- Upload hóa đơn PDF → tự động trích xuất → tạo **phiếu nhập kho**.
- Tạo **phiếu xuất kho**, tự kiểm tra không cho xuất vượt tồn.
- Tạo phiếu xuất **lấy sẵn toàn bộ dòng hàng từ 1 phiếu nhập có sẵn**.
- **Tách 1 phiếu nhập thành nhiều phiếu xuất** bằng bảng phân bổ linh hoạt: tự thêm
  bao nhiêu nhóm (phiếu xuất) tùy ý — chia đôi, chia ba, chia năm, hoặc gộp nhiều mặt
  hàng vào cùng 1 phiếu — tự gõ số lượng cho từng mặt hàng vào từng nhóm.
- Theo dõi **tồn kho** từng vật tư (tồn = tổng nhập − tổng xuất).
- Nạp dữ liệu lịch sử từ file Excel phiếu nhập/xuất mẫu cũ.
- **Sổ tổng hợp nhập xuất vật tư** (theo quý/năm): tự ghép từng dòng nhập với dòng xuất tương ứng,
  xuất Excel đúng form sổ theo dõi của Phòng KH-TC (cột TK đối ứng, tiểu mục, nhóm TK 661.2 / TK 337,
  Nhập/Xuất/Tồn). Màn hình chỉ hiện các cột chính; các trường phụ (TK đối ứng, tiểu mục, nguồn kinh phí)
  nằm trong khối "Thông tin bổ sung" / nút "Sổ sách" và được lưu để xuất ra Excel.
- **Cấu hình mẫu phiếu Excel**: tự đổi tên đơn vị, bộ phận, danh sách người ký cho
  phiếu nhập/xuất — không cần sửa code.
- **Tài sản cố định, công cụ dụng cụ, kiểm kê, mã QR** (xem các mục bên dưới).

## Cài đặt & chạy

Cần có [Node.js](https://nodejs.org) (bản 18 trở lên) trên máy.

```bash
cd kho-vat-tu
npm install
npm start
```

Mở trình duyệt vào **http://localhost:3000**.

Mặc định chỉ chính máy này mở được website (ứng dụng chưa có đăng nhập). Muốn cho máy khác trong mạng nội bộ
cùng dùng, chạy với biến môi trường `HOST=0.0.0.0` (PowerShell: `$env:HOST="0.0.0.0"; npm start`) rồi mở
`http://<địa chỉ IP máy này>:3000`. Trên Render website tự mở cho mọi địa chỉ.

Dữ liệu được lưu trong file `data/kho.db` (SQLite), nằm ngay trong thư mục này —
không cần cài đặt cơ sở dữ liệu riêng. File này không được đưa lên Git.

## Nạp dữ liệu lịch sử từ Excel

```bash
node scripts/import-excel.js "duong/dan/file-nhap-xuat-mau.xlsx"
```

File Excel cần có các sheet mà tên chứa chữ "Nhập" hoặc "Xuất", theo đúng mẫu
01-VT / 02-VT (Thông tư 99/2025/TT-BTC) mà Phòng Kế hoạch — Tài chính đang dùng:
mỗi phiếu là một khối bắt đầu bằng dòng "PHIẾU NHẬP KHO" / "PHIẾU XUẤT KHO".

**Lưu ý:** đây là nạp "cố gắng tốt nhất". Với file mẫu thực tế (24 phiếu/tháng),
script nhận đúng toàn bộ các khối chuẩn. Một vài dòng hàng hóa có tên bị ngắt dòng
bất thường trong Excel gốc (merge ô thủ công) có thể bị đọc lẫn lộn — sau khi nạp,
vào mục **Tồn kho** rà soát nhanh, nếu thấy tên hàng nào trông bất thường (có lẫn số
liệu vào giữa tên) thì sửa trực tiếp trong database hoặc báo lại để chỉnh script.

## Tạo phiếu nhập từ hóa đơn PDF

Vào tab **"+ Phiếu nhập mới"**, kéo thả file PDF hóa đơn GTGT vào ô upload.

Hệ thống nhận diện tốt với hóa đơn xuất từ **Bkav eHoadon** và **MISA meInvoice**
(hai nhà cung cấp hóa đơn điện tử phổ biến nhất) — trích đúng toàn bộ bảng hàng hóa,
số lượng, đơn giá, thành tiền. Với hóa đơn từ nhà cung cấp khác, hoặc nếu hóa đơn có
bố cục đặc biệt, bảng hàng hóa có thể không trích được tự động — hệ thống sẽ báo rõ
bằng cảnh báo màu vàng, khi đó tự thêm từng dòng bằng tay.

**Luôn kiểm tra lại toàn bộ thông tin trước khi bấm "Lưu phiếu nhập kho"** — đây là
công cụ hỗ trợ nhập liệu nhanh, không phải tự động hoàn toàn chính xác 100%. Hệ thống
cũng tự cảnh báo nếu hóa đơn đó là do Trường **xuất ra** (bán) thay vì mua vào, để
tránh tạo nhầm phiếu nhập kho.

## Dữ liệu cho Sổ tổng hợp nhập xuất vật tư (API)

Mỗi phiếu nhập/xuất lưu thêm `tk_doi_ung`, `tieu_muc`, `nguon_kinh_phi` (`661.2` hoặc `337`,
mặc định `661.2`); mỗi dòng hàng có `tieu_muc` riêng, dòng xuất có `phieu_nhap_item_id`
(lấy từ dòng nhập nào). Sửa riêng các trường này cho phiếu đã lưu bằng
`PUT /api/phieu-nhap/:id/so-sach` và `PUT /api/phieu-xuat/:id/so-sach`. Gắn tự động các dòng
xuất cũ chưa có liên kết bằng `POST /api/phieu-xuat/ghep-tu-dong` (`scripts/import-excel.js`
cũng tự gọi sau khi nạp); dòng không ghép được để trống để gắn tay.

## Cấu trúc thư mục

```
server.js                      Điểm khởi động Express (chặn trang web lạ gọi vào, 404 dạng JSON)
src/db.js                      Schema SQLite, tồn kho, sao lưu database (saoLuuDb)
src/routes/                    API: vat-tu, phieu-nhap, phieu-xuat, upload, cau-hinh, tong-hop,
                               tai-san, kiem-ke, ton-dau-ky, khoa-so, xuat (bảng kê / tồn kho / tồn âm)
src/services/tienIch.js        Dùng chung: tìm không dấu, ngày hôm nay, kiểm tra ngày, sắp xếp tiếng Việt
src/services/soPhieu.js        Chuẩn hóa / sắp xếp / gợi ý số phiếu, kiểm tra trùng số trong năm
src/services/khoaSo.js         Khóa sổ theo năm: kiểm tra ngày có thuộc năm đã khóa (lỗi 423)
src/services/haoMon.js         Hao mòn TSCĐ (đường thẳng theo tháng, số chốt, ước tính lùi)
src/services/mauSo.js          Khung Excel theo mẫu sổ của trường; xuat*.js: các bản xuất
src/services/pdfParser.js      Trích xuất dữ liệu từ hóa đơn PDF
public/                        Giao diện (HTML/CSS/JS thuần, không cần build)
scripts/import-excel.js        Nạp phiếu nhập / xuất lịch sử từ Excel (tự sao lưu trước khi ghi)
scripts/import-tai-san.js      Nạp sổ TSCĐ / CCDC (npm run import-tai-san -- "file.xlsx" --dry-run)
```

## Giới hạn hiện tại (biết trước để không bất ngờ)

- Chưa có đăng nhập / phân quyền: mặc định chỉ máy chạy website mở được (xem "Cài đặt & chạy").
- Trích xuất PDF là "cố gắng tốt nhất", luôn cần xem lại trước khi lưu.
- Xuất phiếu ra Excel đúng mẫu 01-VT/02-VT để in ký tay (nút Excel ở danh sách phiếu hoặc trong chi tiết phiếu).

- Tồn kho khi lưu phiếu xuất được kiểm tra theo số tồn hiện tại, chưa theo ngày ghi trên phiếu
  (phiếu xuất lùi ngày vẫn lưu được nếu hiện còn đủ tồn).

## Danh sách phiếu, tồn kho và cách nhập số

- **Tồn kho**: tìm không dấu ("o cam" ra "Ổ cắm"), lọc nhanh Âm kho / Hết hàng / Còn hàng / Có tồn đầu kỳ.
  Bấm một vật tư để xem **lịch sử nhập – xuất** theo ngày kèm tồn sau từng phiếu; bấm số phiếu để mở phiếu.
- **Phiếu nhập / Phiếu xuất**: tìm theo số phiếu, người, đơn vị, nội dung; lọc theo tháng và nguồn kinh phí;
  dòng cuối cộng số phiếu và tổng tiền. Bấm một phiếu để xem **chi tiết các dòng hàng**, có nút Sổ sách, Xuất Excel, Xóa.
- **Xuất Excel theo đúng danh sách đang lọc** (Tồn kho, Bảng kê phiếu nhập / xuất).
- **Sửa phiếu đã lưu**: biểu tượng bút ở dòng phiếu, hoặc nút "Sửa phiếu" trong chi tiết phiếu, mở lại form có sẵn
  thông tin và dòng hàng (sửa được ngày, số phiếu, người, dòng hàng, số lượng, đơn giá, thuế). Bấm "Lưu thay đổi"
  thì tồn kho tự tính lại. Máy chủ chặn khi:
  - sửa phiếu nhập làm vật tư nào đó bị âm kho (hàng đã xuất đi);
  - giảm dòng nhập đã có phiếu xuất lấy theo xuống dưới số đã xuất, hoặc đổi dòng đó sang vật tư khác;
  - sửa phiếu xuất vượt tồn (tồn được cộng lại số cũ của chính phiếu đó) hoặc vượt phần còn lại của dòng nhập đã ghép.
  Chi tiết phiếu ghi "sửa lần cuối" kèm ngày giờ. API: `PUT /api/phieu-nhap/:id`, `PUT /api/phieu-xuat/:id`
  (body như khi tạo; dòng phiếu nhập gửi kèm `id` để giữ liên kết với dòng xuất đã ghép).
- **Số phiếu** tự gợi ý số kế tiếp (PN / PX) và đánh lại từ đầu mỗi năm; lưu phiếu trùng số trong cùng năm bị chặn.
  Ngày phiếu tự điền hôm nay.
- **Phiếu xuất** chỉ gợi ý vật tư còn tồn (kèm số tồn); dòng không khớp vật tư trong kho hoặc vượt tồn được tô đỏ,
  không lưu. Dòng nhập dở (có tên nhưng thiếu số lượng...) cũng tô đỏ thay vì bị bỏ qua.
- **Tách phiếu**: chỉ chia được phần chưa xuất của từng dòng nhập (tách lại lần 2 không bị xuất trùng);
  số lẻ (kg, m) chia đến 3 chữ số thập phân; xong có đường dẫn mở ngay từng phiếu vừa tạo.
- **Nhập số kiểu Việt Nam** trong mọi ô số lượng / đơn giá: `150.000` = một trăm năm mươi nghìn, `1,5` = một phẩy năm.
  Rời ô thì số tự định dạng lại; ô gõ sai tô đỏ.

## Tài sản cố định & công cụ dụng cụ

Hai mục menu riêng — **Tài sản cố định** và **Công cụ dụng cụ** — dùng chung một bảng dữ liệu
(`tai_san`, phân biệt bằng cột `loai` = `TSCD` / `CCDC`) và API `/api/tai-san`.

- **TSCĐ:** nguyên giá, thời gian sử dụng (năm), hao mòn lũy kế và giá trị còn lại (đường thẳng, theo tháng,
  trích từ tháng kế tiếp tháng đưa vào sử dụng; chọn ngày "Hao mòn tính đến" để xem tại thời điểm bất kỳ).
- **CCDC:** số lượng, đơn giá, thành tiền, theo dõi theo bộ phận / người sử dụng / vị trí (không trích hao mòn).
- Cả hai: thêm mới, sửa, xem chi tiết kèm **lịch sử theo dõi** (ghi tăng, điều chuyển, đổi tình trạng, ghi giảm),
  **ghi giảm** (giữ lại hồ sơ, không xóa), lọc theo tình trạng / bộ phận, tìm kiếm.
- Form có gợi ý (dropdown) từ giá trị đã nhập trước đó, tự đánh mã `TSCD-001` / `CCDC-001`.

### Nạp sổ chi tiết TSCĐ từ Excel

```bash
node scripts/import-tai-san.js "duong/dan/so-tscd.xlsx" --dry-run   # xem trước, không ghi
node scripts/import-tai-san.js "duong/dan/so-tscd.xlsx"             # nạp thật (tự sao lưu data/kho.db.bak-...)
```

Dành cho file "Sổ chi tiết TSCĐ" bản in sổ năm (nhiều sheet: máy móc, ô tô, nhà cửa, vô hình). Script tự nhận cột theo
tiêu đề, chỉ nạp khối của năm mới nhất (hoặc `--nam=2025`), đối chiếu tổng từng nhóm với sổ và chạy lại không bị trùng.
Sổ không có ngày ghi tăng nên hao mòn lũy kế cuối năm được lưu làm **số dư tại ngày chốt (31/12)**, các tháng sau tính
tiếp theo tỷ lệ hao mòn. Tài sản là số dư đầu kỳ mà sổ không ghi ngày thì **để trống ngày ghi tăng** (= có từ trước năm sổ),
không đặt ngày tạm nữa. Script lưu kèm **số liệu sổ gốc của năm đó** (cột `so_lieu_goc`) nên sổ chi tiết năm đó xuất ra
khớp đúng sổ gốc; LKHM năm trước trong sổ gốc còn là mốc để ước tính hao mòn các ngày trong năm.
Nguồn kinh phí nạp mặc định TK 661.2 vì sổ không chia nguồn theo từng tài sản.

### Nhiều trường (sáp nhập)

Mỗi tài sản có trường **"Trường / đơn vị gốc"**. Dữ liệu cũ mặc định thuộc "Trường cao đẳng nghề công nghiệp Hà Nội".
Mã tài sản chỉ cần duy nhất **trong từng trường** (các sổ khác nhau có thể trùng mã). Trang TSCĐ / CCDC có bộ lọc theo
trường (hiện khi đã có từ 2 trường), form thêm/sửa có ô chọn trường (dropdown gợi ý các trường đã có).

`scripts/import-tai-san.js` tự nhận diện 3 định dạng file (theo từng sheet):

| Định dạng | Nhận biết | Ghi chú |
|---|---|---|
| Sổ chi tiết TSCĐ bản in sổ theo năm | cột "Tên TSCĐ", "Số cuối kỳ" | trường mặc định, hoặc `--truong="..."` |
| Sổ TSCĐ mẫu S24-H (QLTS.VN) | "Tháng, năm đưa vào sử dụng", "Loại tài sản: ..." | tên trường lấy từ dòng "Đơn vị:"; lũy kế hao mòn hiểu là số đến hết tháng in sổ (in 20/09/2026 -> đến hết 30/09/2026) |
| Bảng tổng hợp danh mục tài sản | "Năm đưa vào sử dụng", "Thời gian dự kiến sử dụng" | tên trường lấy từ dòng đầu; **bắt buộc** `--ngay-chot=YYYY-MM-DD` (file không ghi giá trị còn lại tính đến ngày nào) |

Tùy chọn chung: `--dry-run`, `--truong="Tên trường"`, `--ngay-chot=YYYY-MM-DD`, `--nam=2025`, `--sheet=...`, `--chi-tiet`.
Các dòng trùng hoàn toàn trong sổ (cùng mã, tên, nguyên giá, hao mòn) được bỏ qua và cảnh báo.

### Làm việc với tài sản (TSCĐ / CCDC)

- **Bấm vào một dòng** để sửa; form sửa có luôn hao mòn, lịch sử theo dõi, nút Ghi giảm / Xóa.
- **Tick nhiều dòng** (hoặc "Chọn cả N kết quả lọc") để: Điều chuyển (bộ phận / người / vị trí, kèm số quyết định),
  Đổi tình trạng, Cập nhật thông tin (nhóm, nguồn KP, ĐVT, thời gian sử dụng, trường), Ghi giảm, Xóa, Xuất các dòng chọn.
  Mọi thay đổi ghi vào lịch sử từng tài sản (`POST /api/tai-san/hang-loat`).
- Lọc theo trường, nhóm, bộ phận, tình trạng, giá trị (còn giá trị / hết khấu hao / chưa có thời gian sử dụng),
  nút lọc nhanh; bấm tiêu đề cột để sắp xếp. Tìm kiếm không phân biệt dấu ("may tinh" ra "Máy tính").
- **"Hao mòn tính đến" một ngày đã qua**: danh sách và các ô tổng chỉ gồm tài sản đã ghi tăng đến ngày đó; tài sản
  ghi giảm sau ngày đó vẫn tính là đang quản lý (có ghi chú "ghi giảm dd/mm/yyyy").
- Từ form sửa, nút Ghi giảm / Xóa mở hộp thoại có nút **Quay lại** về form.

### Xuất Excel theo mẫu sổ của trường

Mọi bản xuất dùng chung khung mẫu sổ của Trường Cao đẳng nghề Công nghiệp Hà Nội (`src/services/mauSo.js`): góc trái
"Đơn vị cấp trên / Tên đơn vị", tiêu đề sổ, tiêu đề cột + dòng chỉ số, số 0 để trống, A4 ngang, khối ký
"Người lập biểu — Kế toán trưởng — Hiệu trưởng". Tên đơn vị và người ký sửa ở nút **Thông tin in trên sổ** (biểu tượng
chữ ký, trang TSCĐ/CCDC).
Tài sản của trường sáp nhập in thêm dòng "(Tài sản tiếp nhận từ ...)".

| Màn hình | Bản xuất |
|---|---|
| Tài sản cố định | Sổ chi tiết TSCĐ năm N (đúng cột sổ mẫu: nguyên giá đầu kỳ/tăng/giảm/cuối kỳ, LKHM năm trước, HM trong năm, HMTS giảm, LKHM cuối kỳ, giá trị còn lại, tỷ lệ HM); Danh sách TSCĐ đang lọc / dòng chọn |
| Công cụ dụng cụ | Sổ theo dõi CCDC tại nơi sử dụng — mẫu SKT03 (theo kỳ, theo bộ phận) |
| Tồn kho | Bảng tổng hợp nhập - xuất - tồn (`/api/xuat/ton-kho`) |
| Phiếu nhập / Phiếu xuất | Bảng kê phiếu (`/api/xuat/phieu-nhap`, `/api/xuat/phieu-xuat`); từng phiếu vẫn xuất theo mẫu 01-VT / 02-VT |
| Sổ tổng hợp | như trước |

`scripts/import-tai-san.js` nhận thêm file **Word** sổ theo dõi CCDC (SKT03) → nạp vào mục Công cụ dụng cụ, đối chiếu dòng "Tổng cộng".

### Kiểm kê tài sản (menu "Kiểm kê")

1. **Tạo đợt**: tên, ngày kiểm kê, loại (TSCĐ / CCDC / cả hai), phạm vi (trường, bộ phận, nhóm), ban kiểm kê
   (mỗi dòng "Họ tên - Chức vụ - Vai trò", dòng đầu là Trưởng ban). Danh sách tài sản + số liệu sổ sách
   (số lượng, nguyên giá, giá trị còn lại) được chụp lại tại ngày kiểm kê.
2. **Đánh dấu**: mỗi dòng bấm Có / Hỏng / Không thấy (bấm lại để bỏ), sửa số lượng thực tế, ghi chú;
   ô "Nhập hoặc quét mã" + Enter đánh dấu Có (dùng được máy quét mã vạch; không phân biệt hoa / thường, kể cả chữ Đ);
   tick nhiều dòng để đánh dấu hàng loạt; nút "Đánh dấu Có cho mọi dòng chưa kiểm (theo bộ lọc)". Tìm không dấu.
3. **Chốt đợt**: tùy chọn cập nhật tình trạng Hỏng vào danh mục và ghi kết quả vào lịch sử từng tài sản.
   Đợt đã chốt chỉ xem/xuất; "Mở lại đợt" nếu cần sửa (chốt lại thì lịch sử của đợt được ghi đè, không trùng).
   Tài sản "Không thấy" không tự ghi giảm: sau khi chốt, tick các dòng cần xử lý rồi bấm **Ghi giảm trong danh mục**
   hoặc **Đổi tình trạng trong danh mục**.
4. **Biên bản kiểm kê Excel** (khung mẫu sổ của trường, mỗi trường 1 sheet): thời điểm, ban kiểm kê, bảng
   Theo sổ kế toán | Theo kiểm kê | Chênh lệch (số lượng, nguyên giá, giá trị còn lại) theo nhóm, tổng hợp kết quả,
   ý kiến giải quyết chênh lệch, ký Trưởng ban kiểm kê — Kế toán trưởng — Thủ trưởng đơn vị.

### Mã QR tài sản

- Nội dung QR = **mã tài sản** (chuỗi thuần) → súng quét mã vạch hoặc app quét trên điện thoại đọc ra đúng mã;
  dùng thẳng ở ô "Nhập hoặc quét mã" của trang **Kiểm kê** (mã trùng giữa các trường sẽ hỏi chọn đúng tài sản).
- Form sửa tài sản: xem QR, **Tải ảnh QR** (PNG), **In tem** cho riêng tài sản đó.
- Nút **Tem QR** (trang TSCĐ/CCDC) hoặc **In tem QR** trên thanh chọn nhiều: in tem theo bộ lọc hoặc theo dòng tick,
  2–5 tem mỗi hàng khổ A4 (trang in trực tiếp) hoặc **Excel tem** (ảnh QR + chữ, viền nét đứt để cắt).
  Mỗi tem: tên đơn vị, mã, tên tài sản, nơi sử dụng, "Tiếp nhận từ ..." với tài sản của trường sáp nhập.
- API: `GET /api/tai-san/:id/qr.png?size=300`, `GET /api/tai-san/tem-qr?loai=TSCD&kieu=html|xlsx&cot=3&...(bộ lọc | ids)`.
- Thư viện: `qrcode` (npm).

**Số dư hao mòn tại ngày chốt.** Tài sản nạp từ sổ lưu "hao mòn lũy kế tại ngày chốt": Trường CĐN Công nghiệp HN chốt
31/12/2025; Trường TC Kinh tế - Kỹ thuật và Công nghệ HN và Trường TC Kỹ thuật Tin học HN (ESTIH) chốt 30/09/2026.
Sau ngày chốt cộng tiếp theo tỷ lệ hao mòn từng tháng; trước ngày chốt (vd số đầu năm 2026 trên sổ chi tiết năm 2026
của 2 trường chốt 30/09/2026) là số **ước tính lùi** từ số chốt (tài sản đã hết khấu hao thì chỉ lùi trong khoảng còn
thời gian sử dụng). Riêng Trường CĐN: sổ chi tiết năm 2025 in đúng số liệu sổ gốc 2025, và LKHM cuối 2025 khớp
LKHM đầu năm trên sổ 2026.

### Tồn đầu kỳ (trang Tồn kho)

Tồn kho = **tồn đầu kỳ** + tổng nhập − tổng xuất (bảng `ton_dau_ky`, mỗi vật tư 1 dòng). Áp dụng cho bảng tồn kho,
kiểm tra tồn khi tạo phiếu xuất / xóa phiếu nhập, file Excel tồn kho và báo cáo vật tư tồn âm.

1. **DS vật tư tồn âm** → file Excel: nhóm A (chưa có phiếu nhập — đề xuất bù tồn đầu kỳ), nhóm B (đã có nhập nhưng vẫn âm
   — kiểm tra chứng từ trước; dòng xuất chỉ bị đánh dấu "nghi ghi trùng" khi có một dòng xuất khác đã ghép cùng số lượng).
   Kế toán điền cột **"Kế toán xác nhận tồn đầu kỳ"** (Số lượng, Đơn giá).
2. **Nạp tồn đầu kỳ** → chọn file đã điền + ngày tồn đầu kỳ → **Xem trước** (khớp vật tư theo tên, báo lỗi/cảnh báo,
   tồn sau khi nạp) → **Ghi vào kho** (tự sao lưu database). Chỉ dòng có điền Số lượng mới được nạp; nạp lại thì thay số cũ.
   Đơn giá để trống → lấy đơn giá đề xuất.
3. **Tồn đầu kỳ đã nạp** → xem / xóa từng dòng.
API: `GET /api/ton-dau-ky`, `POST /api/ton-dau-ky/nap` (multipart: file, ngay, ghi=1), `DELETE /api/ton-dau-ky/:id`.

## Khóa sổ theo năm (menu "Khóa sổ")

Quyết toán xong một năm thì khóa năm đó để số liệu không bị sửa nhầm. Năm đã khóa: mọi nghiệp vụ **có ngày trong năm đó**
chỉ còn xem và xuất báo cáo; máy chủ từ chối mọi thao tác ghi (lỗi 423, kèm hướng dẫn mở khóa).

| Nghiệp vụ | Bị chặn khi năm đã khóa |
|---|---|
| Phiếu nhập / xuất | Thêm, sửa (ngày cũ hoặc ngày mới thuộc năm khóa), sửa sổ sách, xóa, phân bổ xuất; xóa / bỏ dòng nhập mà phiếu xuất năm khóa đã lấy theo |
| Ghép nhập – xuất tự động | Bỏ qua dòng xuất của năm khóa |
| Tồn đầu kỳ | Nạp (cả xem trước) với ngày năm khóa, thay số tồn đầu kỳ cũ có ngày năm khóa, xóa |
| Tài sản TSCĐ / CCDC | Ghi tăng ngày năm khóa; sửa nguyên giá, số lượng, ngày, thời gian sử dụng, hao mòn, trường của tài sản ghi tăng năm khóa; ghi giảm / đổi tình trạng / điều chuyển có ngày năm khóa; khôi phục tài sản ghi giảm năm khóa; xóa tài sản có ghi tăng hoặc ghi giảm năm khóa |
| Kiểm kê | Tạo, sửa, đánh dấu, chốt, mở lại, xóa đợt có ngày kiểm kê năm khóa |
| Nạp Excel (scripts) | Phiếu / tài sản có ngày năm khóa bị bỏ qua và báo lại |

Thông tin mô tả tài sản (tên, nhóm, nhà cung cấp, ghi chú...) vẫn sửa được; tài sản ghi tăng năm khóa vẫn ghi giảm được
với ngày thuộc năm đang mở.

- Trang **Khóa sổ**: bảng từng năm (phiếu nhập / xuất, dòng xuất chưa ghép, tồn đầu kỳ, tài sản ghi tăng / ghi giảm, đợt
  kiểm kê), nút **Khóa sổ** / **Mở khóa**, ô khóa một năm khác, **Nhật ký khóa sổ**, **Xuất Excel** (khung mẫu sổ của
  trường: sheet "Tình trạng khóa sổ" và "Nhật ký khóa sổ").
- Hộp thoại khóa cho biết số nghiệp vụ sẽ bị khóa, nhắc vào **Sổ tổng hợp** bấm "Ghép tự động" nếu còn dòng xuất chưa
  ghép, cảnh báo khi khóa năm hiện tại. Ghi chú khi khóa là tùy chọn.
- **Mở khóa bắt buộc ghi lý do** (ít nhất 5 ký tự). Mọi lần khóa / mở đều vào nhật ký (thời gian, năm, ghi chú / lý do).
- Trên giao diện, năm đã khóa: danh sách phiếu có biểu tượng ổ khóa trước số phiếu và chỉ còn nút Excel; chi tiết phiếu
  chỉ còn Đóng / Xuất Excel; form tài sản ghi tăng năm khóa khóa các ô tài chính và ẩn nút Xóa; đợt kiểm kê năm khóa
  chỉ xem và xuất biên bản.

API: `GET /api/khoa-so` (`?them=2024` để xem thêm một năm), `POST /api/khoa-so` `{ nam, ghi_chu }`,
`POST /api/khoa-so/:nam/mo` `{ ly_do }`, `GET /api/khoa-so/xuat-excel`. Bảng `khoa_so`, `khoa_so_lich_su`;
kiểm tra năm khóa dùng chung ở `src/services/khoaSo.js`.
