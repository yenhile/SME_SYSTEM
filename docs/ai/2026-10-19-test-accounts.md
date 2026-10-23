# Thay bộ tài khoản test local — 19/10/2026

PO yêu cầu: bốn tài khoản test mới dùng mật khẩu 123456; cập nhật README về địa chỉ/tài khoản; xóa bộ tài khoản mẫu cũ. PO đã duyệt chuyển 4 hồ sơ vay và 4 yêu cầu bổ sung từ hai CBTD cũ sang test_cbtd trước khi xóa.

Phạm vi ngang: đăng nhập/role, phân công hồ sơ, yêu cầu bổ sung, seed lúc startup, thông báo tài khoản và script integration. Chiều sâu: users → user_roles/roles; users → loan_applications.assigned_to và supplement_requests.requested_by; kiểm tra thêm histories/documents/assignments, không có tham chiếu tài khoản cũ ở ba nhóm này. Tài khoản cho API integration cần khác người sở hữu hồ sơ được tạo riêng trong lần kiểm tra.

Kế hoạch:

1. Kiểm tra DB local sme_loan, role/tài khoản và khóa ngoại.
2. Trong transaction: bcrypt mật khẩu bốn test account, chuyển đúng 4 liên kết hồ sơ/4 liên kết bổ sung, xóa 5 tài khoản seed cũ. So fingerprint để giữ nguyên dữ liệu khác của các bản ghi, giữ hồ sơ/lịch sử.
3. README giữ các URL chuẩn 5173/3000/3001/8000/5432, bổ sung cách mở Prisma Studio5555 và bảng tài khoản mới.
4. Seed tạo đúng bốn test account; dữ liệu seed tham chiếu test_cbtd. Đồng bộ thông báo start-local và thông tin đăng nhập của check-workflow.
5. Kiểm tra syntax, chạy seed trong mô phỏng không DB để kiểm tra account/role/bcrypt và quan hệ seed; xác minh lại DB chỉ đọc, refresh/check CodeGraph cho script source thay đổi.

Không chạy lại seed trên DB thật hoặc check:workflow vì các lệnh đó ghi thêm dữ liệu ngoài phần thay tài khoản. Không đổi validation tài khoản của sản phẩm, schema, nghiệp vụ SLA hoặc cấu hình IBM Db2.

Trạng thái DB đã kiểm chứng: 4 test account active, role đúng, bcrypt khớp 123456; 0 tài khoản seed cũ trong bộ đích; 4 hồ sơ/4 yêu cầu bổ sung đã chuyển và kiểm tra bảo toàn trong transaction. Phần đọc JSON kết quả giao dịch từng lỗi vì JSON nhiều dòng; không chạy lại giao dịch ghi, đã dùng truy vấn READ ONLY độc lập để xác minh.

Việc đăng nhập qua HTTP/UI chưa được kiểm chứng vì xung đột cổng 3000 với IBM Db2 còn chờ xử lý riêng.

Kết quả cuối:

- Truy vấn độc lập READ ONLY: 4/4 tài khoản mới active, đúng một role, bcrypt khớp 123456; bộ tài khoản cũ đích còn 0; test_cbtd phụ trách 4 hồ sơ và 4 yêu cầu bổ sung.
- Syntax seed.js/check-workflow.cjs và parse PowerShell start-local.ps1: đạt.
- Seed dry-run bằng Prisma giả lập (không DB): 4 tài khoản/role, bcrypt 123456, 4 hồ sơ và người yêu cầu bổ sung đều tham chiếu test_cbtd đúng; đạt.
- Source hoạt động của seed/start-local/check-workflow và README không còn tên/mật khẩu mẫu cũ; script integration giữ tài khoản CBTD đối chứng khác user tạm được tạo trong ca test.
- CodeGraph đã build/check lại: 80 file / 927 node / 1.610 edge, đạt. Không thay đổi code xác thực/validation hay schema.
- Chưa chạy check:workflow hoặc kiểm chứng UI/HTTP; không khẳng định đã khắc phục xung đột cổng 3000.
