# Các lỗi và hạng mục chưa fix (cập nhật 02/11/2026)

Ghi theo trạng thái đã biết trong phiên làm việc. Mục "Chờ PO" là quyết định nghiệp vụ, chưa được tự ý sửa (SME-AI-011).

## A. Lỗi nghiệp vụ chờ PO quyết định

| # | Vấn đề | Hiện trạng | Cần PO chốt |
|---|---|---|---|
| 1 | Cán bộ cũ sau điều chuyển vẫn tự thẩm định/duyệt được hồ sơ mình từng làm | Code chỉ so với người đang phụ trách (`workflow.service.ts` dòng 29, 88). Dòng 29 và 30 trùng nhau (thừa 1 dòng) | Chặn người từng xử lý ở Tiếp nhận hay ở mọi công đoạn trước; xử lý khi chỉ còn một người có quyền duyệt |
| 2 | Chính sách đầy đủ cho người nhiều vai trò / tự duyệt | Mới có các chặn cơ bản (maker-checker, admin không tự khóa mình) | Quy tắc đầy đủ cho tài khoản nhiều vai trò |
| 3 | Hồ sơ mồ côi (cán bộ phụ trách bị khóa/đổi vai) | Mới chặn khóa/gỡ CBTD khi còn hồ sơ chưa hoàn tất | Chính sách xử lý ngoài việc chặn |
| 4 | Tạo hồ sơ trực tiếp tại quầy so với qua Portal | Giữ nguyên, có nhãn "Tạo tại quầy" | Có giữ kênh tạo trực tiếp không |
| 5 | "Kiểm tra chứng từ hai lần" | Mới ghi tài liệu, chưa chốt ý nghĩa | Ý nghĩa nghiệp vụ |
| 6 | Công đoạn Cấp trên | PO đang cân nhắc bỏ, chưa quyết | Giữ hay bỏ |
| 7 | Tờ trình thẩm định | Chưa làm, cần đổi cơ sở dữ liệu | Duyệt phạm vi và thay đổi DB |
| 8 | Bật SLA PA1 | Đã nâng cấp DB nhưng CHƯA bật | Lịch nghỉ lễ thật và mốc T0 |
| 9 | Ngưỡng cảnh báo ML | Chưa chốt | Ngưỡng cảnh báo |

## B. Mô hình ML

- Dữ liệu huấn luyện vẫn là dữ liệu mô phỏng (3.000 dòng), nhãn do công thức tự định nghĩa. Chỉ số hiện có chỉ chứng minh mô hình học lại được công thức, chưa phản ánh thực tế. `debt_to_equity` là giá trị xấp xỉ.
- Chưa có nguồn dữ liệu thật hoặc có cơ sở. Đang chờ ý kiến người có chuyên môn trong nhóm dữ liệu. Nguồn từng nhắc (BPIC 2017) chưa được kiểm chứng.
- Chưa quyết có thêm nút "Dự báo nguy cơ trễ" chạy theo yêu cầu (thầy đề xuất) hay không.
- Chưa có quy trình xuất dữ liệu thật từ DB để huấn luyện lại.

## C. Kỹ thuật / vận hành

- `JWT_SECRET` trong `.env` mới 28 ký tự, nên dùng chuỗi ngẫu nhiên từ 32 ký tự trở lên.
- Giới hạn đăng nhập sai nằm trong bộ nhớ (5 lần / 15 phút), mất khi khởi động lại backend và không dùng chung giữa nhiều bản chạy.
- Docker frontend (cổng 5173) có thể chưa dựng lại với giao diện mới nhất (nhãn "Tạo tại quầy").
- Commit `581ab76` (quét nhắc bổ sung mỗi ngày 08:00) chưa push.
- Chưa commit: `docs/ai/2026-11-01-tom-tat-du-an-cho-AI.md`, file này, và hai file `tsbuildinfo`. File nhật ký riêng `docs/ai/2026-10-24-tien-trinh-lam-viec.md` không được commit.
