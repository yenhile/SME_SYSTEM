# SME Loan Workflow

Hệ thống tiếp nhận, thẩm định và quyết định hồ sơ vay SME; theo dõi SLA và cảnh báo nguy cơ trễ xử lý bằng ML. ML không quyết định cấp tín dụng.

## Tài liệu chính

| Tài liệu | Nội dung và nơi cập nhật |
|---|---|
| [SME_MASTER](docs/SME_MASTER.md) | Luồng chính/ngoại lệ, trách nhiệm actor, quyết định PO và toàn bộ 7 đợt review |
| [SME_KY_THUAT](docs/SME_KY_THUAT.md) | Kiến trúc, dữ liệu, vận hành, migration, kiểm thử, ML và CodeGraph |

Trong `docs` chỉ duy trì hai Markdown trên. Kế hoạch, quyết định sửa, nghiệm thu và backlog của 7 đợt review **chỉ cập nhật SME_MASTER**. Bằng chứng tại `evidence/reviews`; bản gốc trước hợp nhất được giữ trong ZIP tại `archive`.

## Sử dụng bản local đã được chuẩn bị

Nhấp đúp [start-use.bat](start-use.bat), hoặc chạy tại thư mục gốc:

```powershell
.\start-use.ps1
```

Script khởi động dịch vụ còn thiếu bằng cấu hình/build hiện có; không tự migration, `db push` hay seed. Máy mới cần chuẩn bị DB, dependency và build trước; xem [hướng dẫn kỹ thuật](docs/SME_KY_THUAT.md).

| Phân hệ | Địa chỉ local |
|---|---|
| Cán bộ ngân hàng | http://localhost:5173/ |
| Cổng doanh nghiệp | http://localhost:5173/portal |
| Backend health | http://localhost:3000/api/health |
| ML health | http://localhost:8000/health |
| Hộp thư xác minh local | http://localhost:8025/ |

Cán bộ và doanh nghiệp dùng tài khoản riêng. Cán bộ dùng tài khoản được cấp; doanh nghiệp có xác minh email và phục hồi mật khẩu. Hộp thư local không gửi ra internet. Docker API dùng cổng 3001 theo compose, khác bản local 3000.

Portal V2 hiện mở vốn lưu động sản xuất/thương mại/dịch vụ, tối đa 10 tỷ đồng mỗi đề nghị mới theo chính sách chi nhánh. Kết quả phát hành được ghi nhận trên localhost.

Các script `start-local.ps1`/`run-local-dev.ps1` có thể push/seed dữ liệu. Đọc tác động và xác định đúng DB trước khi chạy.

## Làm việc với source

Nguồn ngữ cảnh: [Project](Project.md). AI đọc [AGENTS](AGENTS.md), policy và preflight trước thao tác.

```powershell
node scripts/check-ai-rules.mjs
npm.cmd run graph:check
```

Phạm vi và giới hạn kiểm chứng được ghi tại [mục kiểm chứng kỹ thuật](docs/SME_KY_THUAT.md#kiem-chung-ai).
