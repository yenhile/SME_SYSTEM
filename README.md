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
| Cổng doanh nghiệp (mở ra trang giới thiệu vay vốn, bấm "Đăng ký vay vốn ngay" để vào đăng nhập/đăng ký) | http://localhost:5173/portal |
| Backend health | http://localhost:3000/api/health |
| ML health | http://localhost:8000/health |
| Hộp thư xác minh local | http://localhost:8025/ |

Cán bộ và doanh nghiệp dùng tài khoản riêng. Cán bộ dùng tài khoản được cấp; doanh nghiệp có xác minh email và phục hồi mật khẩu. Hộp thư local không gửi ra internet. Docker API dùng cổng 3001 theo compose, khác bản local 3000.

Portal V2 hiện mở vốn lưu động sản xuất/thương mại/dịch vụ, tối đa 10 tỷ đồng mỗi đề nghị mới theo chính sách chi nhánh. Kết quả phát hành được ghi nhận trên localhost.

<a id="tai-khoan-noi-bo"></a>
## Tài khoản nội bộ đang sử dụng

Chi nhánh nhỏ dùng bộ gọn dưới đây, đăng nhập tại http://localhost:5173/ . Mật khẩu **không ghi trong tài liệu**: lấy từ người quản trị, hoặc từ biến `DEMO_PASSWORD` / dòng in một lần khi chạy `npm run seed:demo`.

| Tên đăng nhập | Họ tên | Vai trò |
|---|---|---|
| khoa.tran | Trần Minh Khoa | Quản trị viên (ADMIN) |
| nhung.nguyen | Nguyễn Thị Hồng Nhung | Quản lý chi nhánh (QUAN_LY) |
| ha.le | Lê Thị Thu Hà | Cán bộ thẩm quyền (THAM_QUYEN) |
| huy.vu | Vũ Quang Huy | Cán bộ thẩm quyền (THAM_QUYEN) |
| nam.hoang | Hoàng Văn Nam | Cán bộ tín dụng (CBTD) |
| mai.bui | Bùi Thị Mai | Cán bộ tín dụng (CBTD) |
| thanh.ngo | Ngô Đức Thành | Cán bộ tín dụng (CBTD) |

- Chi nhánh nhỏ chỉ cần **một** Quản lý; 2 Thẩm quyền khớp số người mà mô hình dự báo đã học.
- Các tài khoản cũ (`test_*`, `duc.pham`, `lan.dang`, `hanh.do`, `bao.phan`, `oanh.trinh`, `dat.nguyen`) đã **khóa**, không xóa để giữ lịch sử hồ sơ. Chạy `npm run accounts:tidy` trong `backend` để xem trước hoặc áp dụng lại; `-- --unlock-test` mở lại `test_*` khi cần chạy kiểm thử tự động (mật khẩu `test_*` chỉ dành cho kiểm thử, không dùng khi vận hành thật).
- Trang giới thiệu vay vốn là lớp đầu của cổng doanh nghiệp (http://localhost:5173/portal); cổng 5173 gốc `/` dành riêng cho cán bộ ngân hàng.
- Doanh nghiệp không dùng các tài khoản này; tự đăng ký tại http://localhost:5173/portal (xác minh email qua hộp thư nội bộ http://localhost:8025/).
- Hồ sơ mẫu đi qua cổng doanh nghiệp đến kết quả (cần backend, ML và hộp thư nội bộ đang chạy, `PORTAL_V2_ROLLOUT_ENABLED=true`, đã áp `backend/prisma/document-codes.sql`): `DEMO_PASSWORD=... npm run seed:portal-flow` trong `backend`.
- Trước mỗi buổi demo chạy `npm run demo:refresh` trong `backend` (dựng lại dữ liệu demo bằng `seed:demo --reset`) để hồ sơ mẫu không bị quá hạn hàng loạt.

Các script `start-local.ps1`/`run-local-dev.ps1` có thể push/seed dữ liệu. Đọc tác động và xác định đúng DB trước khi chạy.

## Làm việc với source

Nguồn ngữ cảnh: [Project](Project.md). AI đọc [AGENTS](AGENTS.md), policy và preflight trước thao tác.

```powershell
node scripts/check-ai-rules.mjs
npm.cmd run graph:check
```

Phạm vi và giới hạn kiểm chứng được ghi tại [mục kiểm chứng kỹ thuật](docs/SME_KY_THUAT.md#kiem-chung-ai).
