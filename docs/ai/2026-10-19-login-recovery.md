# Khôi phục đăng nhập local và timeout — 19/10/2026

PO đã duyệt phương án: đổi cổng riêng IBM Db2 sang 3003, dành 3000 cho SME Loan, giữ URL README; bổ sung timeout và kiểm thử đăng nhập. Không sửa tài khoản/DB/schema hoặc cấu hình host toàn cục.

Ngang: extension IBM Db2 ↔ backend3000 ↔ frontend5173; shared API client phục vụ auth, hồ sơ, dashboard, quản trị và tài liệu.
Sâu: LoginPage → AuthContext.login → api.post/request → fetch → AuthController/AuthService → Prisma/bcrypt/JWT. CodeGraph deps/context đã được truy vấn; biên HTTP và extension kiểm tra bằng source/runtime. Request dùng chung cần giữ xử lý401/role/token, JSON, blob và204.

Thiết kế: cấu hình workspace duy nhất db2forzosdeveloperextension.db2sqlservice.port="3003"; timeout15 giây cho mỗi API request, bao gồm đọc response body, báo lỗi rõ để LoginPage thoát busy. Giữ thông báo lỗi mạng/HTTP và xử lý phiên hiện có.

Kế hoạch:
1. Thêm regression test dùng HTTP server local bị treo, body dở dang và các hành vi client liên quan; chạy RED.
2. Sửa client tối thiểu, chạy GREEN và frontend build.
3. Áp dụng cổng IBM Db2 theo workspace, xác minh Java dùng3003, chạy backend3000.
4. Kiểm tra bốn tài khoản qua API, đăng nhập qua browser và trường hợp timeout/sai tên; không seed hoặc ghi dữ liệu nghiệp vụ.
5. Refresh/check graph; lưu bằng chứng và giới hạn thực tế.

Tiêu chí: backend health trả lời tại3000; cả4account login roleđúng; đăngnhậpUI test_cbtd thànhcông; requesttreo thoátbusy sau15s vàhiện lỗi; URLREADME giữnguyên.

## Kết quả đã kiểm chứng

- Tạo cấu hình workspace IBM Db2 cổng3003; PO xác nhận đã Reload Window. Sau reload, Java lắng nghe3003 và backend Node lắng nghe3000; không chỉnh global settings hoặc URL SME Loan.
- RED trước sửa: 2 ca timeout thất bại do request/body chờ vô hạn; 5 ca hành vi hiện có đạt.
- GREEN sau sửa: 7/7 ca `npm --prefix frontend run test:api` đạt. Test dùng HTTP server local thật, TypeScript client thực tế trong VM và rút ngắn clock của deadline; không gọi DB.
- Frontend TypeScript/Vite build đạt. CodeGraph build/check đạt80file /927node /1.610edge.
- API health3000 trả200, trạng thái ok, backend/database/prediction đều ready.
- Bốn account test_admin / test_cbtd / test_tham_quyen / test_quan_ly với mật khẩu test đã thống nhất: login201, profile200, đúng role. Không lưu JWT vào báo cáo.
- Tên sai test-cbtd trả401; tên đúng là test_cbtd.
- Trình duyệt Chrome headless qua CDP: nhập tên sai hiện thông báo, sau đó test_cbtd đăng nhập được và đóng form; DOM sidebar xác nhận đúng tài khoản.
- Giữ có chủ đích duy nhất request login của browser test: sau15.119giây hiện “Máy chủ phản hồi quá lâu…”, nút đăng nhập bật lại. Không dừng backend hoặc ghi dữ liệu khi mô phỏng.
- Đã xem screenshot và DOM desktop1280x900, mobile375x812; không sửa giao diện/CSS.

Ảnh bằng chứng lưu cục bộ trong thư mục graph bị Git ignore:

![Timeout desktop](../../.codegraph/login-timeout-desktop.png)
![Timeout mobile](../../.codegraph/login-timeout-mobile.png)
![Tài khoản đã đăng nhập](../../.codegraph/login-success-account.png)

## Giới hạn và phát hiện ngoài phạm vi

Kiểm chứng tập trung đăng nhập/timeout và hành vi API client; chưa chạy toàn bộ workflow nghiệp vụ hoặc kiểm thử tải. Timeout áp dụng mỗi request15giây; không tự retry các thao tác ghi.

Khi xem screenshot phát hiện tên hiển thị của tài khoản test bị ký tự “?” thay dấu tiếng Việt từ bước tạo tài khoản trước; username, role và đăng nhập đúng. Ghi nhận lỗi dữ liệu hiển thị riêng; không sửa account/DB trong đợt khôi phục đăng nhập này.

Backend được giữ chạy tại3000 để PO test. Chrome/profile phục vụ kiểm thử dùng riêng, không dùng profile cá nhân. Cần mở đúng root workspace để cấu hình cổng extension có hiệu lực.
