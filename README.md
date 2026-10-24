# SME Loan Workflow

Hệ thống quản lý quy trình tiếp nhận, thẩm định và xét duyệt hồ sơ vay doanh nghiệp nhỏ và vừa. Mô hình ML hỗ trợ cảnh báo nguy cơ trễ SLA, không tự quyết định cấp tín dụng.

## 1. Địa chỉ truy cập

| Phân hệ | Local | Docker Compose |
|---|---|---|
| **Nhân viên nội bộ ngân hàng** | [http://localhost:5173/](http://localhost:5173/) | [http://localhost:5173/](http://localhost:5173/) |
| **Cổng doanh nghiệp** | [http://localhost:5173/portal](http://localhost:5173/portal) | [http://localhost:5173/portal](http://localhost:5173/portal) |
| Backend API | [http://localhost:3000/api](http://localhost:3000/api) | [http://localhost:3001/api](http://localhost:3001/api) |
| ML Service Docs | [http://localhost:8000/docs](http://localhost:8000/docs) | [http://localhost:8000/docs](http://localhost:8000/docs) |
| PostgreSQL | `localhost:5432` | `localhost:5432` |

Hai trang đăng nhập dành riêng cho từng đối tượng, **không có liên kết chuyển cổng trên cả hai trang**. Truy cập trực tiếp đúng URL; tài khoản doanh nghiệp và nhân viên tách biệt. Hai cổng vẫn kết nối cùng backend và database để gửi và tiếp nhận hồ sơ.

Hộp thư kiểm thử local: [http://127.0.0.1:8025](http://127.0.0.1:8025), hoạt động khi chạy `mail:dev` (backend chạy trực tiếp trên máy) hoặc khi chạy Docker Compose, trong đó service `mailpit` nhận email OTP của cổng doanh nghiệp (SMTP 1025, web 8025) và không gửi ra Internet. Không chạy `mail:dev` cùng lúc với Docker vì trùng cổng 1025/8025. Backend trong Docker dùng `DOCKER_SMTP_HOST` (mặc định `mailpit`) thay cho `SMTP_HOST` trong `.env`; để dùng SMTP test cho demo, đặt `DOCKER_SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` qua biến môi trường, không ghi secret vào repo.

## 2. Tài khoản test

### Nhân viên nội bộ

Đăng nhập tại [http://localhost:5173/](http://localhost:5173/).

| Vai trò | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Cán bộ tín dụng | `test_cbtd` | `123456` |
| Cán bộ thẩm quyền | `test_tham_quyen` | `123456` |
| Quản lý chi nhánh | `test_quan_ly` | `123456` |
| Quản trị viên | `test_admin` | `123456` |

### Doanh nghiệp

Đăng nhập tại [http://localhost:5173/portal](http://localhost:5173/portal).

| Email | Mật khẩu | Trạng thái |
|---|---|---|
| `doanhnghiep.test@example.test` | `Test123456` | Đã xác minh email, đăng nhập ngay |

Tài khoản doanh nghiệp test có 3 đề nghị: nháp thiếu thông tin/tài liệu, nháp đủ 6 nhóm và đề nghị đã gửi chờ quản lý phân công. Xem mã đề nghị, thông tin mẫu và 8 tệp PDF/XLSX tại [bộ dữ liệu test](test-data/portal-doanh-nghiep/README.md).

Các tài khoản và đề nghị trên đã được tạo trong database local; không mặc nhiên có trên database khác. Mật khẩu trong database được băm. Không chạy lại seed chỉ để khôi phục tài khoản vì seed còn ghi dữ liệu mẫu nghiệp vụ.

## 3. Chạy local

### Cách chính: chạy một lệnh

Mở PowerShell tại thư mục gốc dự án và chạy:

```powershell
.\start-local.ps1
```

Hoặc nhấp đúp `start-local.bat`. Script kiểm tra Docker/PostgreSQL, đồng bộ Prisma và nạp dữ liệu mẫu, mở Backend/ML/Frontend trong các terminal riêng rồi mở trình duyệt. Dependency và môi trường Node/Python cần được cài sẵn; cấu hình tham khảo tại [.env.example](.env.example).

Script hiện có bước `prisma:push` và `prisma:seed`, tức có ghi schema/dữ liệu mẫu. Hộp thư xác minh email local chưa được khởi động bởi script này; khi cần đăng ký tài khoản doanh nghiệp mới, chạy thêm `npm.cmd --prefix backend run mail:dev`. Tài khoản doanh nghiệp test đã xác minh không cần lấy lại mã để đăng nhập.

Dừng bằng `stop-local.bat` hoặc `.\stop-local.ps1`; script dừng PostgreSQL Docker và các tiến trình nghe trên cổng 3000/5173/8000, không dừng hộp thư local.

### Tùy chọn: chạy riêng từng dịch vụ

Dùng khi cần debug hoặc khởi động mà không chạy lại bước đồng bộ/seed. PostgreSQL phải đang chạy, `backend/.env` trỏ đúng database local. Từ thư mục gốc, mở từng terminal riêng:

**Backend — cổng 3000:**

```powershell
npm.cmd --prefix backend run start:dev
```

**ML — cổng 8000, dùng môi trường Python đã cài requirements:**

```powershell
cd ml-service
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend — cổng 5173:**

```powershell
npm.cmd --prefix frontend run dev
```

**Hộp thư local — SMTP 1025, web 8025:**

```powershell
npm.cmd --prefix backend run mail:dev
```

Giữ các terminal chạy; dùng `Ctrl+C` tại từng terminal để dừng. Không chạy thêm tiến trình nếu cổng tương ứng đang được hệ thống sử dụng.

### Bổ sung schema portal cho database khác

Database local của phiên triển khai đã có schema portal. Chỉ áp dụng khi database đích đã có schema nghiệp vụ nền; kiểm tra đúng `DATABASE_URL`, sao lưu dữ liệu và chạy SQL bổ sung một lần, không reset hoặc seed:

```powershell
cd backend
.\node_modules\.bin\prisma.cmd db execute --file prisma/portal-phase1.sql --schema prisma/schema.prisma
.\node_modules\.bin\prisma.cmd db execute --file prisma/portal-assignment.sql --schema prisma/schema.prisma
npm.cmd run prisma:generate
```

### Email xác minh

Backend development mặc định gửi tới SMTP `127.0.0.1:1025`. Mở hộp thư local để lấy mã; email không gửi ra Gmail/Internet. Hộp thư giữ trong RAM và mất khi dừng tiến trình.

Nếu đổi SMTP, cấu hình các biến `SMTP_*` trong `backend/.env` rồi khởi động lại backend. Môi trường triển khai cần SMTP riêng; không dùng hộp thư local.

## 4. Luồng doanh nghiệp → CBTD

1. Doanh nghiệp mở `/portal`, đăng nhập bằng tài khoản test hoặc tự đăng ký. Với tài khoản mới, lấy mã 6 số từ hộp thư local để xác minh email. Mã có hạn 10 phút; có thể gửi lại sau 60 giây. Mật khẩu đăng ký tối thiểu 8 ký tự, gồm chữ và số.
2. Chọn **Tạo đề nghị vay**, khai thông tin và tải tài liệu. Có thể **Lưu nháp** khi chưa đủ; bản nháp chưa xuất hiện trong hàng chờ của CBTD.
3. Trước khi gửi, hoàn tất các trường bắt buộc và có ít nhất một tệp cho mỗi nhóm A–F, tối đa 10 MB/tệp:

| Nhóm | Nội dung | Định dạng |
|---|---|---|
| A | Pháp lý | PDF |
| B | Tài chính | PDF, XLSX |
| C | Hoạt động sản xuất | PDF |
| D | Phương án vay, kèm thông tin khai trên biểu mẫu | PDF |
| E | Tài sản bảo đảm | PDF, JPG, JPEG, PNG |
| F | Dư nợ hiện tại | PDF, XLSX |

4. Chọn **Gửi đề nghị → Xác nhận gửi**. Đề nghị chuyển **Chờ phân công**, khóa chỉnh sửa. Hệ thống lưu thông báo nội bộ cho các quản lý đang hoạt động. Đủ nhóm tài liệu chưa có nghĩa chứng từ đã hợp lệ hoặc khoản vay đã được duyệt.
5. Quản lý đăng nhập `/` bằng `test_quan_ly` / `123456`, mở thông báo hoặc **Quản lý hồ sơ → Danh sách hồ sơ → Chờ tiếp nhận**. Chọn đề nghị, xem tải công việc và phân công CBTD. Phân công chưa tạo hồ sơ vay và chưa bắt đầu SLA. Chỉ chọn được CBTD đang hoạt động.
6. CBTD được giao nhận thông báo trên biểu tượng chuông, mở đề nghị để kiểm tra tài liệu và **Kiểm tra doanh nghiệp để tiếp nhận**. Nếu trùng MST, xác nhận dùng doanh nghiệp hiện có; thông tin doanh nghiệp cũ được giữ nguyên. CBTD chưa được giao không thể xem/tải/tiếp nhận đề nghị.
7. Chọn **Tiếp nhận thành hồ sơ vay**. Hệ thống tạo hồ sơ ở giai đoạn **Tiếp nhận**, trạng thái `RECEIVED` (**Mới tiếp nhận**), giao cho CBTD đã được phân công và gắn các chứng từ; lúc này bắt đầu SLA như luồng cũ. Trên portal hiển thị **Đã tiếp nhận**.

Trước tiếp nhận, quản lý có thể đổi CBTD trong đề nghị, bắt buộc ghi lý do. Hệ thống lưu lịch sử người giao/người nhận/thời điểm và thông báo cho cán bộ cũ, mới; người cũ mất quyền truy cập. Sau tiếp nhận, dùng chức năng **Điều chuyển & phân công** hồ sơ vay hiện có.

Thông báo là thông báo nội bộ trên web, có trạng thái đọc/chưa đọc và mở đúng đề nghị; tự cập nhật định kỳ hoặc khi quay lại cửa sổ. Đây không phải email gửi ra ngoài. Đề nghị được gửi từ trước khi bổ sung chức năng vẫn nằm ở **Chờ phân công**, không tự phân công hoặc tạo lại thông báo cũ.

Portal hiện theo dõi: **Bản nháp → Chờ phân công → Đã phân công — chờ tiếp nhận → Đã tiếp nhận**. Vòng yêu cầu bổ sung, checklist chi tiết và theo dõi các công đoạn thẩm định/xét duyệt trên portal chưa triển khai. Xem thêm [tài liệu phân quyền và luồng nghiệp vụ](docs/Phan_quyen_va_luong_nghiep_vu.md), gồm các điểm còn cần thống nhất.

## 5. Xem database và xử lý lỗi đăng nhập

### Mở database

Từ thư mục gốc:

```powershell
cd backend
.\node_modules\.bin\prisma.cmd studio --port 5555
```

Mở [http://localhost:5555](http://localhost:5555), chọn `User` để xem nhân viên, `PortalAccount` để xem tài khoản doanh nghiệp hoặc `PortalRequest` để xem đề nghị. Studio kết nối theo `DATABASE_URL` của backend. Trường `passwordHash` không hiển thị mật khẩu gốc.

### Đăng nhập chờ mãi

Kiểm tra [API health local](http://localhost:3000/api/health), backend đúng cổng 3000, rồi tải lại trang bằng `Ctrl+Shift+R`. API client có thời gian chờ tối đa 15 giây, gồm cả đọc phản hồi; khi lỗi sẽ báo và bật lại nút đăng nhập. Dùng đúng tài khoản cho từng cổng, tên nhân viên có dấu gạch dưới như `test_cbtd`.

Nếu dùng **IBM Db2 for z/OS Developer Extension**, kiểm tra cổng riêng trong `.vscode/settings.json` để tránh chiếm cổng 3000:

```json
{
  "db2forzosdeveloperextension.db2sqlservice.port": "3003"
}
```

Sau khi đổi cấu hình extension, chọn **Ctrl+Shift+P → Developer: Reload Window**.

## 6. Docker Compose

Đây là cách chạy bản đóng gói, không chạy đồng thời với local trên cùng các cổng. Database đích cần được chuẩn bị schema và dữ liệu phù hợp; Dockerfile backend hiện không tự migrate hoặc seed.

```powershell
docker compose up --build -d
```

Hoặc dùng `start-production.bat`. API Docker dùng cổng 3001; kiểm tra biến môi trường cho Docker để backend kết nối `db:5432`, ML qua `ml-service:8000` và frontend gọi `http://localhost:3001/api`.

Tắt bằng `docker compose down`. Không thêm `-v` nếu cần giữ dữ liệu. PostgreSQL lưu trong volume `postgres_data`; chứng từ Docker lưu trong `uploaded_documents`, còn chạy local lưu tại `backend/uploads`.

## 7. Kiểm thử dành cho phát triển

Các lệnh kiểm tra không ghi dữ liệu nghiệp vụ:

```powershell
npm.cmd --prefix frontend run test:api
npm.cmd --prefix frontend run test:navigation
npm.cmd --prefix frontend run test:portal
npm.cmd --prefix frontend run test:intake
npm.cmd --prefix backend run test:portal
npm.cmd --prefix backend run test:mail
```

Kiểm thử tích hợp portal cần backend local 3000, PostgreSQL và hộp thư local đang chạy. Script **tạo rồi xóa đúng dữ liệu test do nó tạo**, không dùng trên production hoặc database dùng chung:

```powershell
npm.cmd --prefix backend run check:portal
```

`npm.cmd --prefix backend run check:workflow` cũng ghi/xóa dữ liệu test; chỉ chạy khi đã kiểm tra API và `DATABASE_URL` cùng môi trường được phép kiểm thử.

Cổng doanh nghiệp V2 đã có **giao diện 5 bước**: Thông tin doanh nghiệp → Nhu cầu vay → Phương án vốn → Tài liệu → Rà soát. Mở [cổng doanh nghiệp](http://localhost:5173/portal), đăng nhập rồi chọn **Tạo đề nghị vay**. Hồ sơ mới là V2; hồ sơ V1 vẫn dùng giao diện và luồng cũ, không tự nâng cấp.

Lệnh chạy hằng ngày vẫn là `.\start-local.ps1`. Script bật **lưu nháp V2 trên development** trong tiến trình backend; không bật gửi/tiếp nhận V2. Nếu tự chạy backend riêng, cần `NODE_ENV=development` và `PORTAL_FOUNDATION_PREVIEW=true`; cấu hình mẫu mặc định tắt và production luôn bị chặn. Bước rà soát thông báo rõ chính sách hồ sơ chưa được duyệt.

Chuyển bước sẽ lưu nháp hợp lệ qua API thật. Nội dung chưa lưu có bản khôi phục theo tài khoản trong tab hiện tại, hỗ trợ refresh/đăng nhập lại; không thay thế bản lưu trên server và không đảm bảo khôi phục sau khi đóng tab/xóa dữ liệu trình duyệt. File đang chờ upload cần chọn lại sau refresh. Khi hai phiên cùng sửa, hãy đối chiếu và chọn bản cần giữ; hệ thống không ghi đè âm thầm.

Test browser development dùng Chrome CDP loopback cổng 9333 và backend/Vite local đang chạy; script tạo rồi dọn fixture riêng, không chụp/lưu ảnh giao diện:

```powershell
npm.cmd --prefix frontend run check:portal-v2
```

Chi tiết file, API và kết quả: [Giai đoạn 2 – Portal V2](docs/superpowers/plans/2026-10-22-portal-v2-ui.md). Schema và rollback nền tảng: [Giai đoạn 1](docs/superpowers/plans/2026-10-22-portal-technical-foundation.md).

Giai đoạn 3 đã có tích hợp kỹ thuật snapshot, submit/accept thử nghiệm và hiển thị đầy đủ đề nghị V2 cho quản lý/CBTD, kể cả khi mở hồ sơ vay đã tiếp nhận. **Submit/Accept V2 trên hệ thống chính vẫn khóa**: chưa có policy ngân hàng được PO duyệt. Chỉ đặt `PORTAL_V2_SUBMIT_ENABLED=true` không đủ để mở chức năng. [Báo cáo, chính sách còn chờ và kiểm thử Giai đoạn 3](docs/superpowers/plans/2026-10-22-portal-v2-intake.md).

Kiểm thử V2 toàn trình dành cho Dev/QA: build backend trước, sau đó chạy `npm run check:portal-v2-intake` trong `backend/` (HTTP/DB) hoặc trong `frontend/` (thêm Chrome CDP cổng 9333 và Vite test 5174). PostgreSQL local phải đang chạy; ML local 8000 cần sẵn sàng để kiểm chứng runtime. Runner dùng **schema riêng `portal_v2_it_*` và policy TEST_ONLY**, tự dọn dữ liệu/file test; không chạy seed, không sửa schema `public`, không bật V2 trên backend chính. Cổng test 3002/5174 phải trống. Không chạy các runner này trên production.

MVP đã bổ sung **kiểm tra dữ liệu sẵn sàng**: đủ13 trường, doanh thu năm có kỳ YYYY, chọn tài liệu BCTC nguồn và khai kỳ năm đã hoàn thành. Chưa có dữ liệu năm vẫn lưu nháp, không phải từ chối tín dụng. Khai báo/file upload chưa là xác nhận BCTC hợp lệ. Policy mới vẫn **PENDING**, không mở gửi/tiếp nhận chính thức.

Với hồ sơ **đã tiếp nhận**, CBTD có thể tạo yêu cầu bổ sung theo từng mục trong tab Bổ sung hồ sơ. Doanh nghiệp thấy số yêu cầu trên dashboard, mở đề nghị để tải/gửi tài liệu theo yêu cầu; CBTD kiểm tra từng mục rồi đóng yêu cầu. Thay file giữ phiên bản/lịch sử, không sửa snapshot đề nghị gốc. Luồng cũ vẫn hỗ trợ yêu cầu chưa có danh mục trực tuyến. [Chi tiết chính sách, API, migration và Known Limitations MVP](docs/superpowers/plans/2026-10-23-portal-v2-mvp-readiness-supplements.md).

Development mới cần cột nullable `supplement_requests.portal_supplement`, SQL additive tại `backend/prisma/portal-supplements.sql`; database local trong đợt triển khai đã được cập nhật, không cần reset/seed lại. `npm run check:portal-mvp` trong backend/frontend chạy HTTP hoặc browser cách ly cho readiness và luồng bổ sung; dùng chung cổng test3002/5174 nên chạy tuần tự. Không dùng các lệnh QA/migration trên production. Lệnh chạy hằng ngày vẫn `./start-local.ps1`.
