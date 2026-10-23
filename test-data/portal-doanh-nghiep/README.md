# Dữ liệu test cổng doanh nghiệp

Tạo ngày 21/10/2026 cho PostgreSQL local `localhost:5432/sme_loan`. Dữ liệu này đã được lưu qua API thật và được giữ lại để PO test. Không chạy seed hoặc reset database.

## Đăng nhập

- Địa chỉ: http://localhost:5173/portal
- Email: `doanhnghiep.test@example.test`
- Mật khẩu test: `Test123456`
- Email đã xác minh qua hộp thư local; có thể đăng nhập ngay. Mật khẩu cổng cần ít nhất 8 ký tự, gồm chữ và số.
- Doanh nghiệp: `CONG TY TNHH SAN XUAT DEMO SME (DU LIEU TEST)`.
- MST giả lập: `9990000001`. Thông tin vay đầy đủ tại `thong-tin-doanh-nghiep.json`: vốn lưu động 8 tỷ, thời hạn 12 tháng.

## Ba tình huống đã tạo

| Mã đề nghị | Trạng thái ban đầu | Cách test |
|---|---|---|
| `DN-20261021-FC6769D5-6F8` | Bản nháp; đã có A/B/C, thiếu D/E/F và một số trường | Điền tiếp thông tin, tải nhóm còn thiếu; kiểm tra không gửi được khi chưa đủ |
| `DN-20261021-B5D0BBC2-BE3` | Bản nháp; đủ thông tin và 6 nhóm, 8 tệp | Chọn Gửi đề nghị → Xác nhận gửi; kiểm tra trạng thái Chờ phân công và khóa chỉnh sửa |
| `DN-20261021-A3E441DB-173` | Chờ phân công; đủ thông tin và 6 nhóm, 8 tệp | Quản lý phân công rồi CBTD tiếp nhận thành hồ sơ vay |

Trong danh sách đề nghị, mở từng mã để xem mục đích vay có tiền tố `TEST 01`, `TEST 02`, `TEST 03`. Cả ba cùng một doanh nghiệp để có thể test nhận diện theo MST: lần đầu CBTD tiếp nhận sẽ tạo doanh nghiệp, những lần sau phải xác nhận liên kết doanh nghiệp hiện có. Chưa có đề nghị nào được tự động tiếp nhận hoặc phê duyệt.

Các mã và trạng thái trên ghi nhận lúc tạo. Trạng thái sẽ thay đổi theo thao tác test của PO.

## Bộ tệp để tự upload

| Nhóm | Tệp mẫu |
|---|---|
| A. Pháp lý | `A_Phap_ly_TEST.pdf` |
| B. Tài chính | `B_Bao_cao_tai_chinh_TEST.pdf`, `B_Tai_chinh_TEST.xlsx` |
| C. Hoạt động sản xuất | `C_Hoat_dong_san_xuat_TEST.pdf` |
| D. Phương án vay | `D_Phuong_an_vay_TEST.pdf` |
| E. Tài sản bảo đảm | `E_Tai_san_bao_dam_TEST.pdf` |
| F. Dư nợ hiện tại | `F_Du_no_hien_tai_TEST.pdf`, `F_Du_no_TEST.xlsx` |

Các tệp PDF/XLSX có nội dung tổng hợp giả lập, dùng để test upload, tải/xem và phân loại; không phải giấy tờ thật hoặc bộ chứng từ đủ điều kiện tín dụng. PDF dùng nội dung tiếng Việt không dấu. Không có CCCD, số tài khoản ngân hàng hay dữ liệu doanh nghiệp thật.

## Test phía CBTD

Mở http://localhost:5173 → đăng nhập quản lý `test_quan_ly` / `123456` → Quản lý hồ sơ → Danh sách hồ sơ → Chờ tiếp nhận. Mở mã `DN-20261021-A3E441DB-173` và phân công cho `test_cbtd`. Sau đó đăng xuất quản lý, đăng nhập `test_cbtd` / `123456`, mở thông báo hoặc đề nghị được giao, kiểm tra tài liệu/MST rồi tiếp nhận. Chỉ thao tác tiếp nhận mới tạo doanh nghiệp/hồ sơ vay test và bắt đầu công đoạn Tiếp nhận. Đề nghị mẫu được giữ nguyên để PO tự phân công; không tự tạo lại thông báo cho đề nghị đã gửi từ trước.

`danh-sach-de-nghi.json` lưu ID/mã của đúng bộ dữ liệu này để tra cứu hoặc dọn sau khi PO yêu cầu. Chưa tạo lệnh tự xóa dữ liệu để tránh xóa hồ sơ PO đang test.
