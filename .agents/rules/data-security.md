---
trigger: always_on
description: "SME Loan data protection: secrets, RBAC, loan data, database side effects and ML boundaries."
---

# Bảo vệ dữ liệu SME Loan

Áp dụng theo SME-AI-006 của [chính sách chung](../AGENTS.md). Đây là yêu cầu làm việc và phát triển; không phải chứng nhận hệ thống đã tuân thủ pháp luật hay tiêu chuẩn an ninh.

1. Chỉ đọc/xử lý dữ liệu cần cho nhiệm vụ. Không đọc hàng loạt `.env`, `.dump/`, `.vault/`, chứng từ tải lên hoặc dữ liệu khách hàng. Ưu tiên `.env.example` và dữ liệu test được phép. Không in mật khẩu, JWT, khóa, connection string có credential hoặc nội dung chứng từ vào output.
2. Không đưa dữ liệu nhạy cảm vào prompt dịch vụ bên ngoài, issue/PR công khai, dataset huấn luyện hoặc báo cáo nếu chưa có quyền phù hợp. Dùng ví dụ tổng hợp và che thông tin nhận diện.
3. API nghiệp vụ xác minh JWT, tài khoản còn hiệu lực, `activeRole` thuộc quyền đã cấp và quyền trên đối tượng. Không tin role/userId do client gửi. CBTD cần đúng phân công hồ sơ; phạm vi chi nhánh của vai trò khác đọc nguồn/PO, không tự suy diễn mọi query chỉ lọc chủ sở hữu.
4. Không bỏ guard, validation, kiểm tra quyền tải chứng từ hoặc chặn sửa hồ sơ kết thúc để “demo chạy được”. Thay code bảo mật cần kiểm thử cho trường hợp bị từ chối ngoài trường hợp thành công.
5. Trước test tích hợp/script vận hành: nêu API/DB mục tiêu, dữ liệu tạo/sửa/xoá, cleanup và quyền đã được cấp. `check:workflow` là test có ghi DB. Startup có seed/push không được xem là read-only. Không đọc secret chỉ để báo cáo môi trường; kiểm tra cấu hình mà không in giá trị nhạy cảm.
6. Reset/drop/xoá volume/migrate/seed/ghi dữ liệu dùng chung cần quyền rõ cho đúng môi trường; không mặc nhiên được phép vì task là debug/QA. Không đổi execution policy hoặc cấu hình máy toàn cục để chạy được lệnh.
7. Mật khẩu phải được băm an toàn theo cơ chế ứng dụng; không lưu/log plaintext. Khi thay auth, upload, log hay xử lý lỗi, kiểm tra nguy cơ lộ dữ liệu và truy cập chéo hồ sơ. Đánh giá TLS, mã hoá lưu trữ, retention/audit là công việc cần bằng chứng triển khai riêng; không ghi là đã có chỉ vì rule yêu cầu.
8. Dữ liệu tổng hợp/seed/mock khác dữ liệu nghiệp vụ thật. Model cảnh báo trễ SLA không được tự ra quyết định tín dụng. Không tải artifact `.joblib` không tin cậy hoặc tự huấn luyện lại/ghi đè model ngoài phạm vi.
