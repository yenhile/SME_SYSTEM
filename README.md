# SME Loan Workflow

Hệ thống quản lý quy trình xét duyệt hồ sơ vay Doanh nghiệp nhỏ và vừa (SME) tích hợp mô hình Học máy (Machine Learning) cảnh báo nguy cơ trễ hạn SLA.

---

## 1. Khởi chạy tại Local (Khuyên dùng khi Đang Xây dựng & Phát triển)

Hỗ trợ Hot-Reload (sửa code cập nhật ngay), xem log chi tiết và debug trực tiếp.

### Cách 1: Chạy tự động bằng 1-Click (Nhanh nhất)
- **Cách nhấp chuột**: Nhấp đúp chuột vào file **`start-local.bat`** tại thư mục gốc.
- **Cách dùng lệnh**: Chạy trong PowerShell:
  ```powershell
  .\start-local.ps1
  ```
*Script sẽ tự động: Kiểm tra Docker Desktop, khởi động Database PostgreSQL, đồng bộ Prisma & Seed dữ liệu tài khoản, mở 3 cửa sổ Terminal riêng cho Backend/ML/Frontend và tự động mở trình duyệt `http://localhost:5173`.*

### Cách 2: Tắt hệ thống Local an toàn
- Nhấp đúp vào **`stop-local.bat`** (hoặc chạy `.\stop-local.ps1` trong PowerShell).

---

## 2. Khởi chạy toàn bộ bằng Docker Compose (Chế độ Production / Đóng gói)

Dùng khi bạn muốn kiểm thử hệ thống đóng gói hoàn chỉnh giống trên Server triển khai:

- **Cách nhấp chuột**: Nhấp đúp vào file **`start-production.bat`**
- **Cách dùng lệnh**:
  ```powershell
  docker compose up --build -d
  ```

Tắt hệ thống Docker:
```powershell
docker compose down
```
*(Không dùng `docker compose down -v` nếu muốn giữ dữ liệu PostgreSQL)*.

---

## 3. Các địa chỉ kiểm tra hệ thống

| Phân hệ | Cổng Local Development | Cổng Docker Production |
|---|---|---|
| **Frontend Web** | [http://localhost:5173](http://localhost:5173) | [http://localhost:5173](http://localhost:5173) |
| **Backend API** | [http://localhost:3000/api](http://localhost:3000/api) | [http://localhost:3001/api](http://localhost:3001/api) |
| **ML Service Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | [http://localhost:8000/docs](http://localhost:8000/docs) |
| **PostgreSQL** | `localhost:5432` | `localhost:5432` |

---

## 4. Tài khoản đăng nhập thử nghiệm (4 Actor)

| Vai trò | Tên đăng nhập | Mật khẩu | Chức năng kiểm thử |
|---|---|---|---|
| **Cán bộ tín dụng (CBTD)** | `cbtd_nam` | `Cbtd@123` | Lập hồ sơ, kiểm tra tài liệu, gửi yêu cầu bổ sung |
| **Cán bộ thẩm quyền (Risk)** | `risk_quang` | `Risk@123` | Thẩm định năng lực, xem dự báo AI, ra quyết định |
| **Quản lý chi nhánh** | `manager_dung` | `Manager@123` | Dashboard SLA chi nhánh, giám sát rủi ro AI, điều phối hồ sơ |
| **Quản trị viên (Admin)** | `admin` | `Admin@123` | Cấu hình người dùng, phân quyền, thiết lập định mức SLA |