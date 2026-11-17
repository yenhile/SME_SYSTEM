# SME Loan Workflow

Hệ thống tiếp nhận, thẩm định và quyết định hồ sơ vay SME; theo dõi SLA và cảnh báo nguy cơ trễ xử lý bằng ML. ML không quyết định cấp tín dụng.

## Tài liệu chính

| Tài liệu | Nội dung và nơi cập nhật |
|---|---|
| [SME_MASTER](docs/SME_MASTER.md) | Luồng chính/ngoại lệ, trách nhiệm actor, quyết định PO và toàn bộ 7 đợt review |
| [SME_KY_THUAT](docs/SME_KY_THUAT.md) | Kiến trúc, dữ liệu, vận hành, migration, kiểm thử, ML và CodeGraph |

Trong `docs` chỉ duy trì hai Markdown trên. Kế hoạch, quyết định sửa, nghiệm thu và backlog của 7 đợt review **chỉ cập nhật SME_MASTER**. Bằng chứng tại `evidence/reviews`; bản gốc trước hợp nhất được giữ trong ZIP tại `archive`.

<a id="su-dung-tren-web"></a>
## Sử dụng hệ thống trên web (cloud)

Không cần cài đặt gì, chỉ cần trình duyệt. Bản cloud tự cập nhật mỗi khi merge vào `main`.

| Phân hệ | Địa chỉ |
|---|---|
| Cán bộ ngân hàng | https://sme-frontend-mu.vercel.app/ |
| Cổng doanh nghiệp | https://sme-frontend-mu.vercel.app/portal |
| Kiểm tra backend | https://sme-backend-zx2y.onrender.com/api/health |
| Kiểm tra ML | https://sme-system-69gt.onrender.com/health |

**Các bước truy cập**

1. **Đánh thức máy chủ** (bắt buộc nếu hơn 15 phút không ai dùng): mở lần lượt link *Kiểm tra ML* rồi *Kiểm tra backend*, chờ đến khi trang hiện chữ `"status":"ok"` (lần đầu mất khoảng 30–60 giây). Backend báo `database`, `prediction` đều `ready` là dùng được. Bỏ qua bước này thì lần đăng nhập đầu có thể chậm và dự báo trễ SLA đầu tiên có thể báo chưa sẵn sàng.
2. **Cán bộ ngân hàng:** mở link *Cán bộ ngân hàng*, đăng nhập bằng [tài khoản nội bộ](#tai-khoan-noi-bo) (cùng tên đăng nhập và mật khẩu như bản local, vì CSDL cloud được sao từ máy PO ngày 16/11/2026).
3. **Doanh nghiệp:** mở link *Cổng doanh nghiệp* → bấm "Đăng ký vay vốn ngay" → đăng ký bằng **email thật**. Mã xác minh, email quên mật khẩu, trả sửa/đóng đề nghị và kết quả phê duyệt/từ chối được gửi thật qua Brevo; nếu không thấy thư hãy xem mục **Spam/Quảng cáo**.

**Lưu ý**

- Dữ liệu cloud (Supabase) tách riêng với DB local: tạo/sửa hồ sơ trên web không ảnh hưởng máy cá nhân và ngược lại.
- Sau khi merge vào `main`: frontend (Vercel) cập nhật sau khoảng 1–2 phút, backend (Render) sau khoảng 5–10 phút. Muốn chắc chắn bản mới đã chạy thì xem mục Events của dịch vụ `sme-backend` trên Render.
- Không chạy các script seed, cleanup, `demo:refresh` hay migration nhắm vào CSDL cloud khi chưa sao lưu. Thay đổi cấu trúc CSDL trên cloud chạy bằng tệp SQL bổ sung, như `backend/prisma/portal-intake-close.sql`.
- Bí mật cloud chỉ nằm trong biến môi trường Render/Vercel và `backend/.env.cloud` (không đưa lên git).

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

Chi nhánh nhỏ dùng bộ gọn dưới đây, đăng nhập tại http://localhost:5173/ (local) hoặc https://sme-frontend-mu.vercel.app/ (web).

| Tên đăng nhập | Họ tên | Vai trò |
|---|---|---|
| khoa.tran | Trần Minh Khoa | Quản trị viên (ADMIN) |
| nhung.nguyen | Nguyễn Thị Hồng Nhung | Quản lý chi nhánh (QUAN_LY) |
| ha.le | Lê Thị Thu Hà | Cán bộ thẩm quyền (THAM_QUYEN) |
| huy.vu | Vũ Quang Huy | Cán bộ thẩm quyền (THAM_QUYEN) |
| nam.hoang | Hoàng Văn Nam | Cán bộ tín dụng (CBTD) |
| mai.bui | Bùi Thị Mai | Cán bộ tín dụng (CBTD) |
| thanh.ngo | Ngô Đức Thành | Cán bộ tín dụng (CBTD) |

- Mật khẩu không ghi trong repository; liên hệ PO để được cấp. Không dùng lại mật khẩu này ở nơi khác.
- Tài khoản tạo **trên máy mới** bằng `npm run seed:demo` lấy mật khẩu từ biến `DEMO_PASSWORD`, nếu không đặt thì sinh ngẫu nhiên và chỉ in một lần. Muốn dùng chung mật khẩu với bộ demo hiện có thì chạy `DEMO_PASSWORD=<mật khẩu được cấp> npm run seed:demo`.

- Chi nhánh nhỏ chỉ cần **một** Quản lý; 2 Thẩm quyền khớp số người mà mô hình dự báo đã học.
- Các tài khoản cũ (`test_*`, `duc.pham`, `lan.dang`, `hanh.do`, `bao.phan`, `oanh.trinh`, `dat.nguyen`) không dùng nữa: trên máy người bàn giao đã **xóa khỏi DB ngày 09/11/2026**; trên máy PO đã **khóa ngày 10/11/2026** bằng `npm run accounts:tidy -- --apply` (không đăng nhập được, không được tính khi mô hình đếm Thẩm quyền, giữ lịch sử hồ sơ). Dữ liệu DB không đi theo git, nên máy mới cần chạy lệnh này. Chỉ 7 tài khoản ở bảng trên đang mở. Chạy `npm run prisma:seed` sẽ tạo lại 4 tài khoản `test_*` (mật khẩu ngắn, chỉ cho kiểm thử tự động, không chạy trên production); sau khi chạy kiểm thử xong nên xóa lại. `npm run accounts:tidy` dùng khi cần khóa tài khoản thừa mới phát sinh.
- Trang giới thiệu vay vốn là lớp đầu của cổng doanh nghiệp (http://localhost:5173/portal); cổng 5173 gốc `/` dành riêng cho cán bộ ngân hàng.
- Doanh nghiệp không dùng các tài khoản này; tự đăng ký tại http://localhost:5173/portal (xác minh email qua hộp thư nội bộ http://localhost:8025/).
- Dọn dữ liệu thử sau khi kiểm thử (hồ sơ "[MÔ PHỎNG]", tài khoản cổng `mo.phong.*`): `npm run cleanup:test` trong `backend` (mặc định chỉ xem trước; thêm `-- --apply` để xóa). Không đụng bộ demo, tài khoản cán bộ và các tài khoản cổng khác.
- Hồ sơ mẫu đi qua cổng doanh nghiệp đến kết quả (cần backend, ML và hộp thư nội bộ đang chạy, `PORTAL_V2_ROLLOUT_ENABLED=true`, đã áp `backend/prisma/document-codes.sql`): `DEMO_PASSWORD=... npm run seed:portal-flow` trong `backend`.
- Trước mỗi buổi demo chạy `npm run demo:status` trong `backend` (chỉ đọc) để xem hồ sơ demo còn dùng được không; nếu báo cũ thì chạy `npm run demo:refresh` (dựng lại dữ liệu demo bằng `seed:demo --reset`).

Các script `start-local.ps1`/`run-local-dev.ps1` có thể push/seed dữ liệu. Đọc tác động và xác định đúng DB trước khi chạy.

## Làm việc với source

Giải thích mô hình dự báo trễ SLA và dữ liệu huấn luyện từ A đến Z: [ml-service/README.md](ml-service/README.md).

Nguồn ngữ cảnh: [Project](Project.md). AI đọc [AGENTS](AGENTS.md), policy và preflight trước thao tác.

```powershell
node scripts/check-ai-rules.mjs
npm.cmd run graph:check
```

Phạm vi và giới hạn kiểm chứng được ghi tại [mục kiểm chứng kỹ thuật](docs/SME_KY_THUAT.md#kiem-chung-ai).
