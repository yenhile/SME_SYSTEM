# Kế hoạch thực hiện đồ án và nhật ký làm việc (đến 02/11/2026)

File riêng để dán vào Excel, không commit. Nguồn: lịch sử git (ngày commit) và `2026-11-02-tong-hop-rieng.md`.

**Quy ước tuần** (theo sheet Nhật ký, bắt đầu 21/8/2026): Tuần 1 = 21/8–27/8, mỗi tuần 7 ngày. Hôm nay 02/11/2026 nằm ở **tuần 11** (30/10–5/11). Mẫu kế hoạch ghi ngày bắt đầu 20/8, mẫu nhật ký ghi 21/8; nên thống nhất một ngày với thầy.

**Chỗ cần bạn tự điền / xác nhận (tôi không bịa):**
- Tuần 1–3, 5, 6: nội dung do bạn kể lại (không có dấu vết trong repo); chia tuần cụ thể là ước lượng, hãy sửa cho đúng thực tế.
- Cột "Dự kiến" bên dưới tôi **ước theo thực tế đã diễn ra**, vì không có bản kế hoạch gốc. Hãy sửa lại nếu bạn có kế hoạch đã nộp thầy.
- "Ngày báo cáo GVHD" để trống.

---

## Sheet 1. Kế hoạch thực hiện (đơn vị = tuần)

Tên đề tài: Hệ thống quản lý quy trình xét duyệt hồ sơ vay vốn của doanh nghiệp nhỏ và vừa, tích hợp mô hình dự báo nguy cơ chậm xử lý hồ sơ. GVHD: TS. Ngô Hữu Dũng.

| Công việc | Dự kiến tuần bắt đầu | Dự kiến số tuần | Thực tế tuần bắt đầu | Thực tế số tuần | Mức độ hoàn tất |
|---|---|---|---|---|---|
| 01. Tìm hiểu đề tài, khảo sát nghiệp vụ cho vay SME | 1 | 3 | 1 | 3 | [bạn xác nhận] |
| 02. Phân tích nghiệp vụ, phân quyền, luồng 4 công đoạn | 3 | 5 | 4 | 5 | 100% |
| 03. Khởi tạo dự án, thiết kế CSDL, backend/frontend nền | 4 | 4 | 4 | 4 | 100% |
| 04. Phân quyền theo vai trò, luồng nghiệp vụ SME | 7 | 3 | 7 | 3 | 100% |
| 05. Portal doanh nghiệp (đăng ký OTP, nộp hồ sơ, bổ sung chứng từ) | 9 | 2 | 9 | 2 | 100% |
| 06. Tiếp nhận/phân công, thông báo nội bộ, Mailpit, đổi mật khẩu, cấu hình SLA | 10 | 1 | 10 | 1 | 100% |
| 07. Nhắc/đóng quá hạn bổ sung, theo dõi tiến độ Portal, giới hạn xem doanh nghiệp | 10 | 1 | 10 | 1 | 100% |
| 08. Mô hình ML dự báo trễ SLA (dữ liệu mô phỏng, huấn luyện, báo cáo đánh giá) | 9 | 2 | 10 | 1 | 70% (còn thiếu dữ liệu thật) |
| 09. SLA theo giờ làm việc (PA1), tạm dừng chờ bổ sung | 10 | 2 | 10 | 2 | 90% (chưa bật, chờ lịch lễ và T0 từ PO) |
| 10. Bảo mật và chặn quyền (JWT, khóa đăng nhập, người làm khác người duyệt) | 11 | 1 | 11 | 1 | 100% |
| 11. Kiểm thử (243 test backend, 42 test giao diện, kịch bản trên PostgreSQL thật) | 10 | 2 | 10 | 2 | 80% |
| 12. Viết báo cáo: tóm tắt, use case, Chương 2 Cơ sở lý thuyết | 11 | 6 | 11 | 1 | 25% (Chương 2 đã viết, còn [cần kiểm tra] nguồn) |
| 13. Tìm nguồn dữ liệu thật/công khai, huấn luyện lại mô hình | 12 | 3 | – | – | 0% |
| 14. Sửa lỗi tồn đọng (cán bộ cũ sau điều chuyển, tờ trình thẩm định) | 12 | 2 | – | – | 0% (chờ PO) |
| 15. Chạy thử toàn luồng demo, chuẩn bị kịch bản cho thầy | 14 | 2 | – | – | 0% |
| 16. Hoàn thiện báo cáo, slide bảo vệ | 15 | 4 | – | – | 0% |

Thanh tiến độ (■ thực tế đã làm, □ dự kiến chưa làm), tuần 1–16:

| Công việc | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01 | ■ | ■ | ■ | | | | | | | | | | | | | |
| 02 | | | | ■ | ■ | ■ | ■ | ■ | | | | | | | | |
| 03 | | | | ■ | ■ | ■ | ■ | | | | | | | | | |
| 04 | | | | | | | ■ | ■ | ■ | | | | | | | |
| 05 | | | | | | | | | ■ | ■ | | | | | | |
| 06 | | | | | | | | | | ■ | | | | | | |
| 07 | | | | | | | | | | ■ | | | | | | |
| 08 | | | | | | | | | | ■ | | | | | | |
| 09 | | | | | | | | | | ■ | ■ | | | | | |
| 10 | | | | | | | | | | | ■ | | | | | |
| 11 | | | | | | | | | | ■ | ■ | | | | | |
| 12 | | | | | | | | | | | ■ | □ | □ | □ | □ | □ |
| 13 | | | | | | | | | | | | □ | □ | □ | | |
| 14 | | | | | | | | | | | | □ | □ | | | |
| 15 | | | | | | | | | | | | | | □ | □ | |
| 16 | | | | | | | | | | | | | | | □ | □ |

Dòng 01 và 02 (tuần 1–8): chỉ là chỗ giữ cho giai đoạn không có bằng chứng trong repo; sửa theo thực tế của bạn.

---

## Sheet 2. Nhật ký làm việc

| Tuần | Từ ngày | Đến ngày | Ngày báo cáo GVHD | Tóm tắt công việc đã thực hiện |
|---|---|---|---|---|
| 1 | 21/8/2026 | 27/8/2026 | | Tìm hiểu nghiệp vụ cho vay doanh nghiệp nhỏ và vừa (SME): các bước tiếp nhận, thẩm định, phê duyệt hồ sơ vay và vai trò của từng bên. |
| 2 | 28/8/2026 | 3/9/2026 | | Tiếp tục tìm hiểu nghiệp vụ cho vay SME: chứng từ cần có, quy trình bổ sung hồ sơ, các điểm dễ chậm trong xử lý hồ sơ. |
| 3 | 4/9/2026 | 10/9/2026 | | Đọc tài liệu về SLA (thời gian cam kết xử lý từng công đoạn) và về học máy, hướng áp dụng dự báo nguy cơ trễ SLA. |
| 4 | 11/9/2026 | 17/9/2026 | | Khởi tạo dự án trên GitHub (13/9), xác nhận thành viên tham gia, tạo nhánh làm việc, nối nhánh đầu tiên vào repo chung. |
| 5 | 18/9/2026 | 24/9/2026 | | Học công nghệ sẽ dùng cho hệ thống: NestJS cho backend, Prisma với PostgreSQL. |
| 6 | 25/9/2026 | 1/10/2026 | | Học React cho giao diện; vẽ use case các tác nhân (doanh nghiệp, CBTD, Quản lý, Thẩm quyền, Admin) để chuẩn bị xây dựng hệ thống. |
| 7 | 2/10/2026 | 8/10/2026 | | Đưa mã nguồn nền đầu tiên lên repo (7/10): backend NestJS, Prisma/PostgreSQL, frontend React. |
| 8 | 9/10/2026 | 15/10/2026 | | Cập nhật phân quyền và luồng nghiệp vụ SME (12/10): vai trò Admin, CBTD, Quản lý, Thẩm quyền và các công đoạn xử lý hồ sơ. |
| 9 | 16/10/2026 | 22/10/2026 | | Gộp phần phân quyền vào nhánh chính (18/10). Thiết lập quy tắc làm việc với AI và CodeGraph. |
| 10 | 23/10/2026 | 29/10/2026 | | Portal doanh nghiệp: đăng ký xác minh OTP, nộp hồ sơ, bổ sung chứng từ. Tiếp nhận và phân công hồ sơ, thông báo nội bộ. Huấn luyện mô hình ML dự báo trễ SLA (23/10) bằng dữ liệu mô phỏng 3.000 hồ sơ. Thêm Mailpit, đổi mật khẩu, menu Cấu hình SLA, sửa lỗi hai tab tự đăng xuất (24/10). Viết kiểm thử phân quyền, báo cáo đánh giá mô hình ML, ma trận phân quyền (25–26/10). Làm nhắc ngày 5 và quá hạn ngày 10 khi chờ bổ sung, Quản lý đóng hồ sơ quá hạn, theo dõi tiến độ cho doanh nghiệp, giới hạn CBTD chỉ xem doanh nghiệp của mình (26/10). Thiết kế SLA theo giờ làm việc (28/10). |
| 11 | 30/10/2026 | 5/11/2026 | | Xây SLA theo giờ làm việc PA1 (lịch ngày lễ, tạm dừng khi chờ doanh nghiệp, Dashboard tách cách cũ/PA1), đã nâng cấp hệ thống nhưng chưa bật. Sửa lỗi bảo mật (khóa ký đăng nhập, giới hạn đăng nhập sai), chặn menu theo vai trò, người làm khác người duyệt (31/10). Nhắc bổ sung mỗi ngày một lần lúc 08:00 (31/10). Rà soát nghiệp vụ gửi PO. Viết tóm tắt đề tài tiếng Việt/Anh, chốt phạm vi use case, viết Chương 2 Cơ sở lý thuyết, ghi các lỗi chưa sửa (1–2/11). **Kế hoạch tiếp:** tìm nguồn dữ liệu cho mô hình theo yêu cầu của thầy, chờ PO chốt lịch lễ/T0, chạy thử demo. |

**Vấn đề thầy đang chờ (nên nói khi báo cáo):** mô hình hiện học từ dữ liệu tự sinh, chỉ số cao (ROC-AUC 0,99) chưa chứng minh dự báo đúng hồ sơ thật; đang tìm nguồn dữ liệu (ví dụ BPI Challenge 2017, cần xác nhận phù hợp).
