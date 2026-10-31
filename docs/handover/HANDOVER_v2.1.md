# BỘ TÀI LIỆU BÀN GIAO DỰ ÁN SME LOAN WORKFLOW (HANDOVER v2.1)
**Vị trí file lưu trữ:** `docs/handover/HANDOVER_v2.1.md`  
**Dự án:** SME Loan Workflow  
**Mục đích:** Chuyển giao toàn diện hệ thống cho thành viên tiếp nhận kiêm nhiệm hai vai trò Product Owner (PO) và Senior Full-stack Developer (có AI hỗ trợ).  
**Phiên bản:** Handover v2.1 (Ngày 23/10/2026)  
**Cập nhật 28/10/2026 — Nhóm C:** Đã trình bày lại [tình hình triển khai theo nghiệp vụ BA](#task-8-nhom-c): Portal V2 đã có vòng gửi–kiểm tra–trả sửa–gửi lại–tiếp nhận, đã kiểm chứng ngày 27/10 trên môi trường thử riêng; chưa có ghi nhận nghiệm thu/phát hành dùng chung. SLA PA1 chưa triển khai. Phiên xem thử cũ đã quá thời hạn. Bằng chứng kỹ thuật giữ tại [C.8](#portal-intake-cycle-result).

**Bàn giao công việc tiếp theo:** [C.9 — Triển khai SLA PA1 cho PO kiêm Dev](#sla-pa1-next-handover) ghi phạm vi, thứ tự làm, điều kiện nghiệm thu, cấu hình thử đề xuất và mẫu lời giao việc. Đây là kế hoạch tiếp tục, chưa phải kết quả đã triển khai PA1.

**Trạng thái tài liệu:** Đầu mối cập nhật bàn giao theo chỉ định PO. Sau lượt dọn tài liệu, PO đã giao triển khai sáu bước Portal V2; kết quả ghi tại C.8. Không tạo thêm tài liệu bàn giao/test BA riêng.
**Quy ước nhãn trạng thái:**  
- `[VERIFIED]`: Đã xác minh qua source code, cấu hình hoặc test file tự động thực tế.  
- `[APPROVED]`: Quyết định nghiệp vụ chính thức từ PO (chưa đồng nghĩa với đã hoàn thành triển khai kỹ thuật).  
- `[PENDING]`: Đang chờ quyết định nghiệp vụ hoặc chính sách từ PO.  
- `[NEED CONFIRMATION]`: Chưa có automated test hoặc cần xác nhận thêm với người bàn giao / PO.

---

## PHẦN 1. PROJECT OVERVIEW (TỔNG QUAN DỰ ÁN)

### 1. Mục tiêu và phạm vi triển khai (DEC-01)
- **Mục tiêu:** Xây dựng hệ thống quản lý và số hóa toàn diện quy trình tiếp nhận, thẩm định và phê duyệt hồ sơ cấp tín dụng cho khách hàng doanh nghiệp vừa và nhỏ (SME), kết hợp công nghệ Machine Learning để **cảnh báo sớm nguy cơ trễ hạn SLA (Service Level Agreement)** tại từng công đoạn.
- **Phạm vi triển khai (`[APPROVED]` DEC-01):**
  - Hệ thống được giới hạn triển khai cho **DUY NHẤT 01 CHI NHÁNH NGÂN HÀNG** (mặc định trong schema: "Chi nhánh TP.HCM").
  - **Không** phát triển hệ thống quản trị mạng lưới đa chi nhánh, không mở rộng điều phối hay chia sẻ dữ liệu liên chi nhánh.
  - **Bảo toàn nguyên vẹn cơ chế kiểm soát truy cập:** Phân quyền theo vai trò người dùng (Role-based Access Control - RBAC) và phân quyền theo hồ sơ được phân công phụ trách (Assignment-based Access Control).

### 2. Đối tượng sử dụng và các vai trò
Hệ thống phân tách thành 2 nhóm người dùng:
1. **Khách hàng Doanh nghiệp (SME Customer):** Sử dụng Cổng Doanh nghiệp (`/portal/*`) để đăng ký tài khoản, xác thực OTP qua email, nộp hồ sơ vay (V1/V2), tải lên chứng từ và phản hồi bổ sung tài liệu khi ngân hàng yêu cầu.
2. **Người dùng Nội bộ Ngân hàng (`RoleCode` trong `backend/prisma/schema.prisma`):**
   - **CBTD (Cán bộ Tín dụng):** Tiếp nhận hồ sơ được phân công (`assignedTo == user.id`), kiểm tra tính đầy đủ hồ sơ (`CHECKED`), lập tờ trình thẩm định, tạo yêu cầu bổ sung chứng từ, chuyển hồ sơ từ Tiếp nhận sang Thẩm định.
   - **THAM_QUYEN (Người Thẩm quyền / Ban Giám đốc Chi nhánh):** Xem xét tờ trình thẩm định, thực hiện Phê duyệt (`APPROVED`), Từ chối (`REJECTED`) hoặc Trình cấp trên (`CAP_TREN`) khi khoản vay vượt hạn mức chi nhánh (> 10 tỷ VNĐ).
   - **QUAN_LY (Trưởng phòng Tín dụng / Quản lý Chi nhánh):** Theo dõi hàng đợi tiếp nhận (`Intake`), phân công hồ sơ cho CBTD, tái phân công (`reassign`), giám sát Dashboard SLA & cảnh báo trễ hạn, xem xét và quyết định đóng hồ sơ quá hạn.
   - **ADMIN (Quản trị viên Hệ thống):** Quản lý tài khoản nội bộ, kích hoạt/vô hiệu hóa user, gán vai trò và cấu hình định mức thời gian SLA của từng công đoạn.

### 3. Kiến trúc hệ thống
Hệ thống gồm 3 phân hệ liên kết qua mạng nội bộ:
- **Backend API (`backend/`):** NestJS, PostgreSQL, Prisma ORM. Cung cấp API xác thực đa vai trò (JWT + Header `X-Active-Role`), quản lý máy trạng thái quy trình (Workflow State Machine), kiểm soát transaction và khóa dòng bi quan (`SELECT FOR UPDATE`), lưu vết lịch sử công đoạn (`ApplicationStageHistory`).
- **Frontend App (`frontend/`):** React 18, Vite, TypeScript, TailwindCSS. Gồm 2 giao diện: Cổng Doanh nghiệp (`/portal/*`) và Cổng Nghiệp vụ Nội bộ (`/`).
- **ML Service (`ml-service/`):** Python FastAPI, Scikit-learn (Random Forest). Microservice dự báo nguy cơ trễ hạn SLA của hồ sơ dựa trên: số lượng chứng từ, hạn mức vay, mục đích vay và khối lượng công việc hiện tại.
- **Email Service (`[APPROVED]` DEC-03):** Gửi mã OTP xác thực phục vụ đăng ký/đăng nhập Cổng Doanh nghiệp (Mailpit cho local, SMTP test cho demo).

### 4. Luồng nghiệp vụ tổng thể (End-to-End)
```
[Doanh nghiệp SME] (Nộp hồ sơ trên Portal)
         │
         ▼
[Hàng đợi Tiếp nhận (Intake Queue)] ◄─── (Quản lý phân công cho CBTD trong chi nhánh)
         │
         ▼
[Công đoạn 1: TIẾP NHẬN (TIEP_NHAN)]
         │   ├── (Hồ sơ thiếu chứng từ) ──> Yêu cầu bổ sung ──> [Portal Doanh nghiệp nộp]
         │   │                                                         │
         │   └── (Hồ sơ đủ chứng từ) <─── CBTD rà soát duyệt bổ sung ──┘
         │          │ (Xác định hạn mức & kiểm tra checklist hoàn tất)
         ▼          ▼
[Công đoạn 2: THẨM ĐỊNH (THAM_DINH)] ◄─── (Tự động gọi ML Service dự báo trễ SLA)
         │   (CBTD lập tờ trình thẩm định, đánh giá rủi ro)
         │
         ├─── (Khoản vay > 10 tỷ VNĐ) ──> [Công đoạn 3: CẤP TRÊN (CAP_TREN)]
         │                                            │ (Cấp trên cho ý kiến)
         ▼                                            ▼
[Công đoạn 4: HOÀN TẤT (HOAN_TAT)]
         ├── Phê duyệt cấp tín dụng (APPROVED) ──> Kết thúc quy trình cấp tín dụng
         ├── Từ chối cấp tín dụng (REJECTED) ──> Đóng hồ sơ, lưu lý do từ chối
         └── Đóng quá hạn (CLOSED_TIMEOUT) ──> Quản lý đóng thủ công sau 10 ngày
```

---

## PHẦN 2. BUSINESS REQUIREMENTS (NGHIỆP VỤ & PHÂN QUYỀN)

### 1. Phân biệt các lớp Trạng thái trong hệ thống
Hệ thống phân tách rạch ròi giữa 3 hệ thống danh mục enum (`backend/prisma/schema.prisma`):

| Khái niệm | Enum trong Code | Giá trị cụ thể | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **Trạng thái Cổng Doanh nghiệp** | `PortalRequestStatus` | `DRAFT`, `SUBMITTED`, `ASSIGNED`, `ACCEPTED` | Theo dõi vòng đời yêu cầu từ khi SME soạn thảo, nộp vào hệ thống, Quản lý phân công cho CBTD và CBTD tiếp nhận chính thức thành hồ sơ nội bộ (`LoanApplication`). |
| **Công đoạn Quy trình Nội bộ** | `StageCode` | `TIEP_NHAN`, `THAM_DINH`, `CAP_TREN`, `HOAN_TAT` | 4 công đoạn chính thức để tính định mức thời gian SLA tương ứng. |
| **Trạng thái Hồ sơ Nội bộ** | `LoanStatus` | `RECEIVED`, `CHECKED`, `SUPPLEMENT_REQUIRED`, `PENDING_APPRAISAL`, `WAITING_HEAD_OFFICE`, `APPROVED`, `REJECTED`, `CLOSED_TIMEOUT` | Trạng thái chi tiết của hồ sơ tại từng công đoạn, ràng buộc các điều kiện chuyển bước. |

### 2. Xác minh Chức năng Giải ngân
- `[VERIFIED]`: Đối chiếu trực tiếp `backend/prisma/schema.prisma` và `backend/src/modules/workflow/workflow.service.ts`:
  - Trong database và mã nguồn **KHÔNG CÓ** công đoạn giải ngân hay trạng thái `GIAI_NGAN` / `DISBURSED`.
  - Công đoạn cuối cùng là `HOAN_TAT` với hai kết quả phê chuẩn: `APPROVED` (nhập số tiền duyệt và lãi suất) hoặc `REJECTED` (nhập mã và lý do từ chối).
  - **Kết luận:** Chức năng "Giải ngân" chỉ là mô tả bên ngoài đời thực, **nằm ngoài phạm vi triển khai** của đồ án này. Hệ thống dừng lại ở bước Phê duyệt cấp tín dụng.

### 3. Các Business Rule cốt lõi đã chốt
- **Khóa chuyển bước khi thiếu chứng từ (`[VERIFIED]`):** Hồ sơ có trạng thái `SUPPLEMENT_REQUIRED` bị chặn hoàn toàn, không thể chuyển sang công đoạn tiếp theo (`backend/src/modules/workflow/workflow.service.ts:21`).
- **Ngưỡng phê duyệt 10 tỷ VNĐ (`[VERIFIED]`):** Khoản vay có hạn mức > 10 tỷ VNĐ (`10_000_000_000`) bắt buộc phải chuyển sang công đoạn `CAP_TREN` trước khi có thể phê duyệt `APPROVED` (`backend/src/modules/workflow/workflow.service.ts:34-37`).
- **An toàn giao dịch đồng thời (`[VERIFIED]`):** Áp dụng khóa bi quan `SELECT ... FOR UPDATE` trong transaction để chống xung đột khi hai người dùng cùng thao tác trên một hồ sơ (`backend/src/modules/workflow/workflow.service.ts:17`).
- **ML Failure Tolerance (`[VERIFIED]`):** Nếu dịch vụ ML gặp sự cố hoặc timeout, hệ thống ghi log cảnh báo nhưng **không rollback** giao dịch chuyển bước nghiệp vụ (`backend/src/modules/workflow/workflow.service.ts:62-63`).
- **Quy trình Quá hạn bổ sung chứng từ (`[APPROVED]` DEC-02):**
  - **Ngày 0:** CBTD gửi yêu cầu bổ sung chứng từ -> Hồ sơ chuyển sang `SUPPLEMENT_REQUIRED`.
  - **Ngày 5:** Hệ thống gửi thông báo nhắc nhở nếu doanh nghiệp chưa hoàn tất bổ sung.
  - **Ngày 10:** Hệ thống đánh dấu quá hạn và chuyển danh sách lên Quản lý chi nhánh xem xét.
  - **Quyền hạn đóng:** Chỉ **Quản lý (QUAN_LY)** mới có quyền đóng hồ sơ thủ công sang trạng thái `CLOSED_TIMEOUT`. **Tuyệt đối không tự động đóng hồ sơ bằng cron job**.
  - **Yêu cầu bắt buộc:** Ghi nhận đầy đủ định danh người đóng, thời điểm đóng, lý do đóng và ghi log vào lịch sử công đoạn (`ApplicationStageHistory`).
  - *Cập nhật quyết định:* TK-07 đã chốt ngày lịch theo giờ Việt Nam; mốc rơi vào Thứ Bảy/Chủ nhật chuyển sang Thứ Hai. Giữ `deadlineAt`, chưa thêm gia hạn. Đây là thời hạn phản hồi, khác với đồng hồ SLA giờ làm việc. Khi tích hợp pha chờ doanh nghiệp/ngân hàng phải tránh nhắc hoặc đóng hồ sơ chỉ vì ngân hàng chưa kiểm tra phản hồi đã gửi đủ.

### 4. Quyết định đã duyệt và phần còn triển khai
1. `[IMPLEMENTED / ISOLATED VERIFIED / PO ACCEPTANCE PENDING]` **Portal V2:** Đã có vòng kiểm tra–trả sửa–gửi lại–tiếp nhận, kiểm chứng Chrome/API/PostgreSQL trong schema Docker riêng. Chưa áp SQL vào public hoặc phát hành dùng chung; PO nghiệm thu theo luồng tại Nhóm C; C.8 lưu bằng chứng đã kiểm chứng.
2. `[APPROVED / NOT IMPLEMENTED]` **SLA PA1:** Thứ Hai–thứ Sáu, 08:00–12:00 và 13:00–17:00 giờ Việt Nam, loại ngày nghỉ theo lịch có phiên bản được xác nhận. Chưa có lịch ngày nghỉ cụ thể được nghiệm thu và chưa tích hợp thuật toán mới.
3. `[APPROVED]` **Thời hạn bổ sung:** Giữ quy tắc TK-07 về ngày lịch và cuối tuần; không tự thêm gia hạn. Pha chờ doanh nghiệp/ngân hàng theo phương án mới chưa triển khai. Chi tiết và điểm cần PO quyết định tiếp nằm tại Task 8 — Nhóm C.

---

## PHẦN 3. TECHNICAL SETUP (KIỂM TRA BÀN GIAO KỸ THUẬT & KHỞI CHẠY)

### 1. Thông tin Bàn giao Kỹ thuật & Hiện trạng Repository
- **Repository URL (`[VERIFIED]`):** `https://github.com/yenhile/SME_SYSTEM.git` (Remote: `origin`).
- **Nhánh bàn giao (`[VERIFIED]`):** `LeThiYenNhi`.
- **Commit mới nhất (`[VERIFIED]`):** `695d006 Merge pull request #4 from yenhile/YenTrang` (Hiện tại local branch đang `ahead of origin/LeThiYenNhi by 3 commits`).
- **Trạng thái Working Tree (`[VERIFIED]`):** **NOT CLEAN (Chưa sạch)**.
  - Tồn tại nhiều file đang được chỉnh sửa dở dang (`modified: backend/prisma/schema.prisma`, `backend/src/modules/workflow/...`, `frontend/src/App.tsx`, `frontend/src/components/...`).
  - Tồn tại nhiều file và thư mục untracked chưa commit (`.agents/`, `.codegraphrc.json`, `AGENTS.md`, `Project.md`, `backend/src/modules/portal/`, `frontend/src/portal/`, `backend/test/`, `docs/ai/`, `docs/superpowers/`).
  - **Chỉ dẫn cho người tiếp nhận:** Tuyệt đối không chạy `git reset --hard` hoặc `git clean -fd` làm mất các module và tài liệu untracked trên. Hãy tạo branch mới để bảo toàn hiện trạng: `git checkout -b feature/handover-work`.

> **Cập nhật 24/10/2026:** nhánh làm việc hiện là `YenTrang` (đồng bộ `origin/YenTrang`). Các file từng untracked đã nằm trong commit `36ce540` và đã vào `main` (PR #5). Working tree chỉ còn `frontend/tsconfig.app.tsbuildinfo` (file build, không commit). Chi tiết ở bảng "Trạng thái thực hiện" cuối Phần 5.

### 2. Cấu trúc Source Code
```
sme-loan-workflow/
├── backend/                  # NestJS API (Port 3000)
│   ├── prisma/               # schema.prisma (14 models), seeds, migrations
│   ├── src/modules/          # 12 modules: auth, users, companies, loan-applications,
│   │                         # workflow, documents, supplements, assignments,
│   │                         # prediction, notifications, dashboard, portal
│   └── test/                 # 12 file test tự động cho portal, policy, supplements
├── frontend/                 # React 18 + Vite + TypeScript (Port 5173)
│   └── src/
│       ├── api/              # API Client wrapper, gắn JWT & Header X-Active-Role
│       ├── components/       # LoanDetailModal, DashboardView, AdminView, IntakeView...
│       └── portal/           # PortalApp, PortalWizard (V1/V2), supplements + tests
├── ml-service/               # Python FastAPI + Scikit-learn (Port 8000)
│   └── app/                  # main.py, schemas.py, predictor.py, model/ (.joblib)
├── docs/                     # Tài liệu phân quyền, kiến trúc, kế hoạch
│   └── handover/             # Bộ tài liệu bàn giao dự án
├── .agents/                  # AI Rules, workflows, CodeGraph config
├── docker-compose.yml        # Docker compose chạy PostgreSQL (và hệ thống)
└── package.json              # Root package quản lý scripts toàn repo
```

### 3. Danh sách Biến Môi trường cần Cấu hình
*(Tuân thủ nguyên tắc bảo mật: Chỉ liệt kê tên biến, không hiển thị giá trị secret/credential)*

| Phân hệ / Mục đích | Danh sách Tên biến Môi trường | Ghi chú cấu hình |
| :--- | :--- | :--- |
| **Cơ sở dữ liệu (PostgreSQL)** | `DATABASE_URL`<br>`POSTGRES_DB`<br>`POSTGRES_USER`<br>`POSTGRES_PASSWORD` | Chuỗi kết nối và thông số DB local hoặc container. |
| **Backend & Bảo mật** | `PORT`<br>`JWT_SECRET`<br>`ML_SERVICE_URL` | Port backend (mặc định 3000), secret ký JWT và URL gọi sang ML Service (port 8000). |
| **Frontend** | `VITE_API_URL` | Base URL gọi API backend (mặc định: `http://localhost:3000/api`). |
| **Email Service (DEC-03)** | `SMTP_HOST`<br>`SMTP_PORT`<br>`SMTP_SECURE`<br>`SMTP_FROM`<br>`SMTP_USER`<br>`SMTP_PASS` | Cấu hình Mailpit local (`127.0.0.1:1025`) hoặc thông số SMTP server dùng cho demo. |
| **Feature Flags (Portal)** | `PORTAL_FOUNDATION_PREVIEW`<br>`PORTAL_V2_SUBMIT_ENABLED` | Cờ điều khiển giao diện nháp V2 và khóa nộp V2 (mặc định giữ `false`). |

### 4. Danh sách Script có nguy cơ Ghi / Xóa Database
`[VERIFIED]` Tuyệt đối **không chạy** các script sau trên môi trường có dữ liệu thực tế vì các script này chứa lệnh seed, sửa đổi hoặc xóa dữ liệu:
- `backend/scripts/check-workflow.cjs` (Tạo hồ sơ test, chuyển bước và xóa dữ liệu).
- `backend/scripts/check-portal-phase1.cjs` (Tạo và xóa tài khoản, request portal test).
- `backend/scripts/check-portal-foundation.cjs` (Tác động dữ liệu portal foundation).
- `backend/scripts/check-portal-v2-intake.cjs` (Tạo dữ liệu intake test).
- `backend/scripts/check-portal-mvp-supplements.cjs` (Tạo dữ liệu test nộp chứng từ bổ sung).
- `backend/prisma/seed.js` (Seed lại dữ liệu mẫu cho database).
- `start-local.ps1` (Script startup Windows tự động chạy seed/push DB).

### 5. Hướng dẫn Khởi chạy Hệ thống trên Máy Người tiếp nhận
1. **Khởi chạy Database & Mailpit qua Docker:**
   ```bash
   docker run --name sme-postgres -e POSTGRES_DB=sme_loan -e POSTGRES_USER=sme_user -e POSTGRES_PASSWORD=sme_password -p 5432:5432 -d postgres:15-alpine
   docker run --name sme-mailpit -p 1025:1025 -p 8025:8025 -d axllent/mailpit
   ```
2. **Khởi chạy Backend (Port 3000):**
   ```bash
   cd backend
   npm install
   npx prisma generate
   npm run start:dev
   ```
3. **Khởi chạy ML Service (Port 8000):**
   ```bash
   cd ml-service
   python -m venv venv
   # Kích hoạt venv (Windows: venv\Scripts\activate, Linux/macOS: source venv/bin/activate)
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
4. **Khởi chạy Frontend (Port 5173):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
5. **Cập nhật công cụ hỗ trợ AI (CodeGraph):**
   ```bash
   # Chạy từ root repository:
   npm run graph:build
   npm run graph:check
   ```

---

## PHẦN 4. PROJECT STATUS (HIỆN TRẠNG TÍNH NĂNG & BẰNG CHỨNG KIỂM THỬ)

> **Phân loại trạng thái:**
> - `[VERIFIED-TEST]`: Đã có test tự động và có file test cụ thể trong source code.
> - `[CODE-ONLY]`: Đã có code trong source nhưng chưa có automated test; cần kiểm tra runtime.
> - `[PENDING-POLICY]`: Đã có code hoàn chỉnh nhưng bị khóa do chờ PO duyệt chính sách.
> - `[NOT-IMPLEMENTED]`: Chưa triển khai code hoặc giao diện.

| Phân hệ | Tính năng cụ thể | Trạng thái kỹ thuật | Bằng chứng kiểm thử / Vị trí Source Code |
| :--- | :--- | :---: | :--- |
| **Auth** | Đăng nhập JWT & Switch Role | `[VERIFIED-TEST]` | `backend/src/modules/auth/`, Header `X-Active-Role` xử lý tại `RolesGuard`. Test pass tích hợp qua `test/portal.test.cjs`. |
| | Đổi mật khẩu cán bộ nội bộ | `[VERIFIED-TEST]` | Đã có API `POST /auth/change-password` (`backend/src/modules/auth/auth.controller.ts:40`). UI đã có từ TK-10 (`0e5b749`, `ChangePasswordModal.tsx`); test `frontend/scripts/check-change-password.mjs`. |
| **Admin** | Quản lý người dùng nội bộ | `[NEED CONFIRMATION]` | `frontend/src/components/AdminView.tsx` (tạo user, gán role). Đã test manual khi dev; chưa có automated E2E test. |
| | Cấu hình định mức SLA | `[VERIFIED-TEST]` | API `GET/PUT /admin/workflow-stages` và Form có trong `AdminView.tsx`. Menu "Cấu hình SLA" đã có từ TK-02 (`08631b4`); test `frontend/scripts/check-navigation.mjs`. |
| **Portal DN**| Đăng ký & Xác thực OTP Email | `[VERIFIED-TEST]` | `backend/test/portal.test.cjs`, `backend/test/portal-foundation.test.cjs`. Kiểm tra mailbox test bằng `scripts/check-dev-mailbox.cjs`. |
| | Nộp hồ sơ V1 (3 bước cơ bản) | `[VERIFIED-TEST]` | `frontend/src/portal/wizard.test.mjs`, `frontend/src/portal/model.test.mjs`, `backend/test/portal-snapshot.test.cjs`. |
| | Nộp hồ sơ V2 (Chi tiết tài chính)| `[PENDING-POLICY]`| `backend/test/portal-policy.test.cjs`, `backend/test/portal-readiness.test.cjs`. Code xong nhưng bị khóa tại `portal.readiness.ts:3` (`canSubmit: false`). |
| | Nộp chứng từ bổ sung | `[VERIFIED-TEST]` | `backend/test/portal-supplements.test.cjs`, `portal-supplements-service.test.cjs`, `frontend/src/portal/supplements.test.mjs`. |
| | Theo dõi tiến độ hồ sơ sau nộp | `[NOT-IMPLEMENTED]` | README (dòng 132) xác nhận rõ: **Chưa có màn hình** cho doanh nghiệp theo dõi công đoạn sau khi hồ sơ được tiếp nhận. |
| **Nội bộ** | Tiếp nhận & Phân công (Intake) | `[VERIFIED-TEST]` | `backend/test/portal-assignment.test.cjs`, `backend/test/notifications.test.cjs`. UI: `frontend/src/components/IntakeView.tsx`. |
| | Thẩm định & Chuyển bước | `[CODE-ONLY]` | `backend/src/modules/workflow/workflow.service.ts` (khóa dòng, chặn >10 tỷ, chặn thiếu chứng từ). Đã test qua `check-workflow.cjs`. |
| | Rà soát chứng từ bổ sung | `[VERIFIED-TEST]` | `backend/test/portal-supplements-operations.test.cjs`. CBTD rà soát duyệt/từ chối từng tài liệu bổ sung. |
| | Đóng hồ sơ quá hạn | `[NOT-IMPLEMENTED]` | Đã có enum `CLOSED_TIMEOUT` trong DB và đếm trên Dashboard; **chưa có code logic Quản lý đóng thủ công** theo DEC-02. |
| | Giải ngân khoản vay | `[NOT-IMPLEMENTED]` | **Nằm ngoài phạm vi đồ án**. Hệ thống dừng ở bước Phê duyệt cấp tín dụng (`APPROVED`). |
| **Dashboard**| Thống kê SLA & Điểm nghẽn | `[NEED CONFIRMATION]` | `frontend/src/components/DashboardView.tsx`, `backend/src/modules/dashboard/`. Đã test manual khi dev; chưa có automated test. |
| **ML** | Dự báo nguy cơ trễ hạn SLA | `[VERIFIED-TEST]` | `ml-service/app/main.py`, `predictor.py`. Test qua `backend/src/modules/prediction/`. Huấn luyện trên **dữ liệu synthetic** (DEC-04). |
| **Tooling** | CodeGraph phục vụ AI hỗ trợ | `[NEED CONFIRMATION]` | Cần chạy `npm run graph:build` để cập nhật do working tree có file test mới chưa được index. |

---

## PHẦN 5. TASK BACKLOG (DANH MỤC CÔNG VIỆC THEO 12 TASK BASELINE)

Bảng phân loại dựa trên 12 Task baseline, giữ nguyên mã Task ID, làm rõ sự phân định giữa `TK-07` và `TK-08`:

| Task ID | Nội dung công việc cụ thể | Phân loại & Mức độ Ưu tiên | Phụ thuộc | Kết quả mong đợi (Acceptance Criteria) |
| :--- | :--- | :---: | :--- | :--- |
| **TK-01** | Chạy `npm run graph:build` để làm mới CodeGraph | **Kỹ thuật khẩn cấp** (Ưu tiên 1) | Không | Lệnh `npm run graph:check` trả về exit 0, graph index đầy đủ các file mới, phục vụ AI hỗ trợ chính xác. |
| **TK-02** | Khai báo route cấu hình SLA trong `navigation.ts` | **Kỹ thuật khẩn cấp** (Ưu tiên 1) | Không | Thêm mục "Cấu hình SLA" vào menu Admin; click mở được form cài đặt SLA trong `AdminView.tsx` và lưu thành công qua API. |
| **TK-03** | Rà soát và hoàn thiện AC phân quyền trong phạm vi 1 chi nhánh | **Làm rõ AC nghiệp vụ** (Ưu tiên 1) | **DEC-01** (Approved) | Văn bản chốt: Giữ nguyên phân quyền theo vai trò (RBAC); CBTD chỉ xem hồ sơ mình được phân công; Quản lý/Thẩm quyền xem hồ sơ toàn chi nhánh. |
| **TK-04** | Củng cố filter truy vấn theo phân công hồ sơ tại Backend | **Triển khai kỹ thuật** (Ưu tiên 2) | **TK-03** | Backend siết chặt điều kiện `where: { assignedTo: user.id }` đối với CBTD trong `loan-applications.service.ts`. |
| **TK-05** | Hoàn thiện vòng gửi–kiểm tra–trả sửa–gửi lại–tiếp nhận Portal V2 | **Đã duyệt nghiệp vụ / Đang triển khai** (Ưu tiên 2) | Quy tắc đã có; cần phiên bản hồ sơ, kiểm tra CBTD và UI | Nghiệm thu xuyên suốt, bảo toàn bản đã gửi, không tạo Loan trùng; chưa mở nộp chỉ bằng đổi cờ. |
| **TK-06** | Xây dựng giao diện theo dõi tiến độ hồ sơ trên Portal DN | **Cần làm rõ AC & UI** (Ưu tiên 2) | PO duyệt thiết kế | Khách hàng SME đăng nhập Portal thấy danh sách hồ sơ đã nộp và trạng thái công đoạn hiện tại (ẩn các ghi chú nội bộ). |
| **TK-07** | Hoàn thiện AC, logic nhắc ngày 5 và đánh dấu quá hạn ngày 10 | **Triển khai kỹ thuật** (Ưu tiên 2) | **DEC-02** (Approved) | Hệ thống tự động gửi thông báo nhắc ở mốc ngày 5; đánh dấu quá hạn ở mốc ngày 10 và chuyển danh sách lên Quản lý chi nhánh. *(Không tự triển khai logic đếm ngày khi quy tắc ngày lịch/ngày làm việc chưa chốt)*. |
| **TK-08** | Triển khai chức năng Quản lý đóng hồ sơ quá hạn thủ công | **Triển khai kỹ thuật** (Ưu tiên 2) | **TK-07** | Quản lý có nút bấm và popup đóng hồ sơ sang `CLOSED_TIMEOUT` trên `LoanDetailModal.tsx`; bắt buộc ghi nhận người đóng, thời gian, lý do và log lịch sử công đoạn. |
| **TK-09** | Cấu hình Mailpit local & SMTP test cho Docker | **Triển khai kỹ thuật** (Ưu tiên 1) | **DEC-03** (Approved) | Tích hợp Mailpit vào `docker-compose.yml` hoặc truyền biến môi trường SMTP để test luồng OTP email thông suốt trên container. |
| **TK-10** | Xây dựng giao diện Đổi mật khẩu cá nhân cho cán bộ | **Triển khai kỹ thuật** (Ưu tiên 1) | Không | Header có mục "Đổi mật khẩu"; form popup kết nối thành công với API `POST /auth/change-password` có sẵn ở backend. |
| **TK-11** | Triển khai SLA PA1 theo giờ làm việc | **Đã duyệt nghiệp vụ / Chưa triển khai** (Ưu tiên 3) | Lịch có phiên bản, khoảng pause và tích hợp các điểm dùng SLA | Dùng chung phép tính; không tính lại lịch sử cũ; phân biệt chờ doanh nghiệp và chờ ngân hàng. |
| **TK-12** | Lập Báo cáo đánh giá mô hình ML trên dữ liệu Synthetic | **Triển khai tài liệu** (Ưu tiên 3) | **DEC-04** (Approved) | Lập báo cáo khoa học đánh giá các chỉ số (Accuracy, Precision, Recall, F1) của mô hình ML, phân tích rõ các giới hạn dữ liệu giả lập. |

---

### Trạng thái thực hiện (cập nhật 24/10/2026, nhánh `YenTrang`)

| Task | Trạng thái | Commit | Ghi chú / bằng chứng |
| :--- | :---: | :--- | :--- |
| TK-01 | `DONE` | (không có, chỉ cài môi trường) | `npm ci` ở root và `graph:build`, `graph:check` exit 0 (122 file). CodeGraph lỗi với đường dẫn có dấu cách (`T:\SME SYSTEM`); build qua ổ ảo `subst S: "T:\SME SYSTEM"`. Cần Visual Studio Build Tools (C++) để biên dịch `better-sqlite3`. |
| TK-02 | `DONE` | `08631b4` | Cần sửa cả `navigation.ts` và `App.tsx` (thiếu nhánh render `AdminView section="settings"`). Đã xác nhận GET/PUT `/admin/workflow-stages` (200, giữ giá trị sau tải lại, CBTD nhận 403) và hai tiêu chí giao diện. Test navigation đã cập nhật (trước đó khẳng định không có mục SLA). Menu chưa lọc theo vai trò (hành vi sẵn có). |
| TK-03 | `DONE` (chưa commit) | | PO quyết ngày 25/10/2026: Thẩm quyền chỉ xem hồ sơ từ Thẩm định trở đi (phương án B). Ma trận: `docs/Ma_tran_AC_phan_quyen_1_chi_nhanh.md`. Còn chờ PO xác nhận `/companies`. |
| TK-04 | `DONE` (chưa commit) | | Đổi phạm vi: chặn truy cập chéo đã có sẵn, chỉ viết `backend/test/loan-access.test.cjs` (13 test pass) + triển khai phương án B; kiểm chứng đọc trên Docker. Chưa kiểm thử giao diện trên trình duyệt. |
| TK-05 | `IMPLEMENTED / PO ACCEPTANCE PENDING` | | Ngày 27/10 đã có vòng Portal đầy đủ, lưu nhiều lần gửi, kiểm tra, trả sửa, gửi lại, tiếp nhận và UI. 118 backend, 42 frontend tests đạt trong phạm vi ghi ở C.8; 90 điểm kiểm tra API/DB và 11 điểm kiểm tra Chrome đạt. Chưa migrate public/phát hành; chờ PO nghiệm thu. |
| TK-06 | `DONE` (chưa commit) | | PO giao tự chọn danh mục trạng thái (26/10/2026); danh mục và quy tắc ẩn thông tin nằm ở `docs/ai/2026-10-24-tien-trinh-lam-viec.md` mục 14. `GET /portal/requests/:id/status` + `PortalApplicationTracking.tsx`. Chỉ xem được đề nghị của chính tài khoản; không lộ ghi chú nội bộ/ML/cán bộ; lý do từ chối theo danh mục TC01–TC05. Test: `test:tracking` (7 backend + 4 frontend). |
| TK-07 | `DONE` (chưa commit; chờ PO xem giao diện) | | PO chốt 26/10/2026: ngày lịch giờ Việt Nam, mốc rơi Thứ Bảy/Chủ nhật lùi sang Thứ Hai, không gia hạn trong TK-07 (hạn lưu ở `deadlineAt` nên thêm gia hạn sau chỉ cần đổi cột này). Bộ quét mỗi giờ (`SupplementRemindersService`), 3 cột mới trên `SupplementRequest` (`reminderSentAt`, `reminderEmailSentAt`, `overdueAt`), `InternalNotification.requestId` tuỳ chọn + `applicationId`. Nhắc ngày 5: thông báo CBTD + email doanh nghiệp (hồ sơ qua Portal); quá hạn: thông báo CBTD, cảnh báo đỏ Dashboard Quản lý (`GET /dashboard/overdue-supplements`), cờ vàng/đỏ trong danh sách hồ sơ. Không đổi trạng thái, không đóng hồ sơ. Chưa có lịch ngày lễ. Test: `test:reminders` (19 test), `test:deadlines`. |
| TK-08 | `DONE` (chưa commit) | | Endpoint `POST /workflow/:id/close-overdue` chỉ `QUAN_LY`; bắt buộc lý do; chỉ đóng hồ sơ `SUPPLEMENT_REQUIRED` có yêu cầu bổ sung đã đến hạn (tính lại ở backend, không phụ thuộc cờ của bộ quét). Hồ sơ sang `HOAN_TAT` + `CLOSED_TIMEOUT`, `completedAt`, `rejectionReasonCode=TC05` (đã có trong danh mục từ chối), `rejectionNote`=lý do; yêu cầu bổ sung chờ chuyển `EXPIRED`; đồng hồ SLA đang tạm dừng được tính nốt trước khi đóng công đoạn; ghi `ApplicationStageHistory` (người đóng, thời điểm, lý do). Không đổi `transitionStage`, không đổi schema. Giao diện: nút + form trong `LoanDetailModal`, nhãn "Đã đóng (quá hạn bổ sung)" ở danh sách/Kanban/chi tiết, bộ lọc trạng thái. Test: `test:close-overdue` (10 backend + 3 frontend). |
| TK-09 | `DONE` | `24b4d20` | Service `mailpit` (SMTP 1025, web 8025) trong compose. Backend dùng `DOCKER_SMTP_HOST` (mặc định `mailpit`) vì `SMTP_HOST=127.0.0.1` trong `.env` sẽ ghi đè và không tới được Mailpit trong container. OTP đến Mailpit sau khoảng 0,36 giây, xác minh thành công; PO đã xác nhận trên giao diện. |
| TK-10 | `DONE` | `0e5b749` | Modal đổi mật khẩu trong menu tài khoản. Mật khẩu mới **tối thiểu 8 ký tự** theo `ChangePasswordDto` của backend (handover ghi 6). Đã xác nhận 400 khi sai mật khẩu hiện tại, đổi thành công, đăng nhập lại bằng mật khẩu mới, mật khẩu cũ bị 401; PO xác nhận trên giao diện. |
| TK-11 | `APPROVED / NOT IMPLEMENTED` | | PO chọn PA1 giờ làm việc, cơ chế phiên bản và pause/resume theo bên chờ. Khung tuần đã chốt; danh sách ngày nghỉ cụ thể chưa nghiệm thu. Chưa triển khai source PA1. |
| TK-12 | `DONE` (chưa commit; chờ PO đọc) | | Báo cáo `docs/Bao_cao_Mo_hinh_Machine_Learning.md` và script `ml-service/scripts/evaluate_model.py`; nêu rõ giới hạn dữ liệu tổng hợp. |
| (ngoài danh sách) | `DONE` | `f642e35` | Sửa lỗi hai tab cùng mở tự đăng xuất lẫn nhau: listener `storage` trong `AuthContext.tsx` nay chỉ đăng xuất khi token bị xóa. |
| (ngoài danh sách) | `DONE` | `bddbd68` | `ml-service/Dockerfile`: tăng timeout và retry cho `pip install`. |
| (ngoài danh sách) | `DONE` (chưa commit) | | Chặn quyền theo vai trò ở cả giao diện và backend theo yêu cầu PO (30/10/2026): menu và trang chỉ hiển thị và mở được đúng với vai trò (CBTD không vào Dashboard, Thẩm định & phê duyệt, Điều chuyển, Liên hệ cá nhân, Cấu hình SLA; Admin chỉ có Liên hệ cá nhân và Cấu hình SLA); mỗi vai trò vào trang đầu của mình (không còn trang "Quyền truy cập bị từ chối"); Quản lý bị gỡ quyền `GET /users` (giao diện không dùng). Khóa bằng `frontend/scripts/check-navigation.mjs` (9 test) và `backend/test/role-routes.test.cjs` (4 test, kiểm ma trận quyền mọi route và tự báo khi thêm route chưa có quyết định). Đã dựng lại hệ thống ở cổng 5173 và kiểm tra bằng Chrome thật 4 vai trò. PO chốt 30/10/2026: CBTD vẫn xem (chỉ xem) hồ sơ của mình sau khi chuyển Thẩm định, khóa bằng test (AC-19, AC-20). Chưa xử lý: kiêm nhiệm nhiều vai trò, khóa ký đăng nhập mặc định, giới hạn số lần đăng nhập (xem báo cáo rà soát). |
| (ngoài danh sách) | `DONE` (chưa commit) | | Sửa 4 lỗi không cần PO quyết (31/10/2026): (1) **khóa ký đăng nhập**: bỏ chuỗi mặc định công khai ở 3 chỗ; `JWT_SECRET` bắt buộc ở production, Docker truyền từ `.env` (trước đây container không nhận nên chạy bằng khóa công khai), thiếu ở môi trường khác thì dùng khóa ngẫu nhiên của tiến trình; token ký bằng khóa cũ không còn hiệu lực nên mọi người phải đăng nhập lại; `JWT_SECRET` hiện chỉ 28 ký tự, nên đổi sang chuỗi ngẫu nhiên từ 32 ký tự; (2) **giới hạn đăng nhập nhân viên**: sai 5 lần trong 15 phút theo tên đăng nhập thì khóa thử 15 phút (ngưỡng do bên triển khai chọn, chưa PO duyệt; bộ đếm trong bộ nhớ nên mất khi khởi động lại); (3) **chứng từ**: tải thêm hoặc xóa chứng từ ở công đoạn Tiếp nhận sau khi đã xác nhận đủ thì tự hủy xác nhận (hồ sơ về RECEIVED); (4) **điều chuyển CBTD**: kiểm tra, lịch sử và đổi người phụ trách chạy trong một giao dịch có khóa hồ sơ. Khóa bằng `backend/test/security-fixes.test.cjs` (18 test) và kiểm chứng trên PostgreSQL thật (`check-sla-pa1.cjs`, 119 điểm). Backend 231/231. Đã dựng lại backend ở cổng 3001 và kiểm tra thật: token giả ký bằng khóa cũ bị 401, khóa đăng nhập hoạt động, Portal vẫn đăng nhập được. |

**Điểm lệch phát hiện khi tiếp nhận (Discrepancy Log):**
- Handover ghi nhánh `LeThiYenNhi`, commit `695d006` và working tree chưa sạch. Thực tế nhánh làm việc là `YenTrang`; các thư mục "untracked" đã được commit trong `36ce540` và đã vào `main` qua PR #5.
- Công đoạn `HOAN_TAT` trong DB đang tên "Hoàn tất & Phê duyệt giải ngân", trong khi hệ thống không có chức năng giải ngân (dữ liệu seed, chưa đổi).
- Mật khẩu mới tối thiểu 8 ký tự (backend), không phải 6 như TK-10 ghi.
- Tài khoản test `123456` không thể đặt lại qua giao diện đổi mật khẩu (dưới 8 ký tự).
- Cổng đang mở khi chạy Docker: 5173 (web), 3001 (API), 8000 (ML), 5432 (DB), 1025 và 8025 (Mailpit). Không chạy `npm run mail:dev` cùng lúc với Docker (trùng cổng 1025/8025).
- `frontend/tsconfig.app.tsbuildinfo` là file build đang bị git theo dõi và đổi sau mỗi lần build; không commit.

---

## PHẦN 6. BUSINESS DECISION LOG (NHẬT KÝ QUYẾT ĐỊNH NGHIỆP VỤ)

### 1. Các quyết định đã được PO phê duyệt chính thức
- **`[APPROVED]` DEC-01 (Phạm vi 1 Chi nhánh):**
  - Hệ thống phục vụ duy nhất 01 chi nhánh ngân hàng.
  - Hủy bỏ hoàn toàn yêu cầu phát triển module quản lý đa chi nhánh hay liên chi nhánh.
  - Bảo toàn và rà soát lại việc phân quyền theo vai trò (RBAC) và phân quyền theo hồ sơ được phân công phụ trách.
- **`[APPROVED]` DEC-02 (Quy trình Quá hạn bổ sung chứng từ):**
  - Mốc ngày 0 (gửi yêu cầu), ngày 5 (nhắc nhở), ngày 10 (đánh dấu quá hạn chuyển Quản lý xem xét).
  - Không tự động đóng hồ sơ sau 10 ngày. Quản lý là người duy nhất có quyền quyết định đóng hồ sơ thủ công sang `CLOSED_TIMEOUT`.
  - Phải ghi nhận đầy đủ người đóng, thời điểm đóng, lý do và log lịch sử công đoạn.
- **`[APPROVED]` DEC-03 (Giải pháp Email OTP):**
  - Môi trường Local: Dùng Mailpit (không gửi email ra ngoài internet).
  - Môi trường Demo: Dùng SMTP test qua biến môi trường.
  - Nghiêm cấm đưa secret/credentials vào repository.
- **`[APPROVED]` DEC-04 (Định vị Machine Learning):**
  - Tiếp tục sử dụng dữ liệu synthetic cho đồ án để bảo vệ bí mật dữ liệu ngân hàng.
  - ML chỉ đóng vai trò cảnh báo sớm nguy cơ trễ SLA, tuyệt đối không ra quyết định cấp tín dụng.
  - Yêu cầu bổ sung báo cáo đánh giá mô hình và nêu rõ giới hạn.

### 2. Các điểm quyết định tiếp theo của PO
1. **Không xin duyệt lại:** Chính sách TK-05, lựa chọn PA1 của TK-11, thời hạn TK-07 và danh mục theo dõi TK-06 đã có quyết định. Cần mở rộng hiển thị trạng thái trả sửa theo vòng mới, không coi danh mục cũ là chưa được duyệt.
2. **Trước thao tác dữ liệu:** Trình môi trường API/DB đích, SQL bổ sung, dữ liệu thử, ảnh hưởng dữ liệu cũ và cách dọn đúng dữ liệu thử. Chỉ xin quyền nếu chưa có quyền bao phủ đúng tác động.
3. **Trước kích hoạt PA1:** Trình lịch ngày nghỉ cụ thể, phiên bản, thời điểm hiệu lực và ví dụ tính hạn. Không mặc định lịch ngày nghỉ chính thức hoặc chỉ bật PA1 từ khung tuần.
4. **Trước mở sử dụng:** Lead BA kết luận đạt/chưa đạt theo nghiệp vụ đã duyệt; Lead FullStack cung cấp bằng chứng kỹ thuật; PO nghiệm thu phạm vi và môi trường mở. Mở rộng nghiệp vụ hoặc train/ghi đè model phải trình riêng nếu phát sinh.

---

## PHẦN 7. HANDOVER & NEXT STEPS (HƯỚNG DẪN DÀNH CHO THÀNH VIÊN TIẾP NHẬN)

### 1. Danh sách tài liệu bắt buộc phải đọc trước khi can thiệp code
1. `Project.md` và `.agents/AGENTS.md`: Nắm bắt toàn bộ quy tắc ứng xử của dự án, đặc biệt là quy tắc **SME-AI-011** (không tự ý đổi nghiệp vụ) và **SME-AI-012** (phân tích ảnh hưởng ngang -> sâu).
2. `docs/Phan_quyen_va_luong_nghiep_vu.md`: Hiểu chi tiết ma trận phân quyền giữa CBTD, Quản lý, Thẩm quyền.
3. `backend/prisma/schema.prisma`: Đọc kỹ 14 models, đặc biệt là các enum `StageCode`, `LoanStatus`, `PortalRequestStatus`.
4. `backend/src/modules/workflow/workflow.service.ts`: Nắm vững toàn bộ logic chuyển công đoạn và các chốt chặn nghiệp vụ.

### 2. Thứ tự Ưu tiên Đề xuất Triển khai Backlog
*(Đề xuất theo tính độc lập kỹ thuật và mức độ cấp bách nghiệp vụ; không tự cam kết thời gian hoặc effort)*

- **Nhóm Ưu tiên 1 — Khắc phục kỹ thuật độc lập & Môi trường:**
  1. `TK-01`: Rebuild CodeGraph (`npm run graph:build`).
  2. `TK-02`: Bổ sung route Cấu hình SLA trong `frontend/src/navigation.ts`.
  3. `TK-10`: Xây dựng UI Đổi mật khẩu cá nhân cho cán bộ nội bộ.
  4. `TK-09`: Cấu hình Mailpit test cho môi trường local & Docker.
- **Nhóm Ưu tiên 2 — Nghiệp vụ Cốt lõi & Xử lý Quá hạn:**
  5. `TK-03` & `TK-04`: Rà soát và củng cố kiểm tra phân công hồ sơ (`assignedTo`) cho CBTD trong phạm vi 1 chi nhánh.
  6. `TK-07` & `TK-08`: Hoàn thiện AC mốc ngày 5/ngày 10 và lập trình chức năng Quản lý đóng hồ sơ quá hạn thủ công.
  7. `TK-05`: Hoàn thiện và nghiệm thu trọn vòng Portal V2 theo Task 8 — Nhóm C; chưa mở bằng đổi cờ đơn lẻ.
  8. `TK-06`: Xây dựng giao diện theo dõi tiến độ hồ sơ cho doanh nghiệp trên Portal.
- **Nhóm Ưu tiên 3 — Hoàn thiện Báo cáo & Tối ưu hóa:**
  9. `TK-12`: Viết Báo cáo đánh giá mô hình ML trên dữ liệu synthetic.
  10. `TK-11`: Triển khai PA1 đã duyệt; xác nhận lịch ngày nghỉ cụ thể và kiểm chứng tích hợp trước kích hoạt.

### 3. Cảnh báo rủi ro & Các module "nhạy cảm"
- **Không tự ý sửa đổi `workflow.service.ts`:** Nơi chứa transaction quản lý trạng thái, khóa bi quan `SELECT FOR UPDATE` và chặn duyệt > 10 tỷ.
- **Không chạy các script ghi/xóa DB trên môi trường có dữ liệu thật:** Đọc kỹ danh sách script tại Phần 3 trước khi chạy bất kỳ file nào có tiền tố `check-*`.
- **Tuyệt đối không biến ML thành công cụ tự động duyệt khoản vay:** Luôn tuân thủ định vị ML chỉ cảnh báo trễ hạn SLA.

---

## PHẦN 8. IMPLEMENTATION ROADMAP & WORKING INSTRUCTIONS (LỘ TRÌNH TRIỂN KHAI & NGUYÊN TẮC LÀM VIỆC)

Tài liệu này được thiết kế để thành viên tiếp nhận (kiêm nhiệm Product Owner và Senior Full-stack Developer) có thể vận hành và tiếp tục phát triển dự án độc lập với sự hỗ trợ của AI. Dưới đây là các hướng dẫn và quy tắc bắt buộc:

---

### 1. FIRST ACTIONS — VIỆC CẦN LÀM NGAY SAU KHI NHẬN MÃ NGUỒN

Ngay sau khi tiếp nhận dự án, thành viên mới phải thực hiện tuần tự 5 bước xác minh sau trước khi can thiệp vào bất kỳ dòng mã nào:

1. **Kiểm tra Repository, Quyền truy cập & Commit bàn giao:**
   - Kiểm tra remote: `git remote -v` (Đảm bảo trỏ về `https://github.com/yenhile/SME_SYSTEM.git`).
   - Kiểm tra branch: Đang ở branch `LeThiYenNhi`.
   - Kiểm tra commit mới nhất: `git log -1 --oneline` (Phải thấy commit `695d006 Merge pull request #4 from yenhile/YenTrang`).
   - Kiểm tra working tree: `git status`. Lưu ý rằng working tree hiện tại **chưa sạch (NOT CLEAN)** do có các file chỉnh sửa dở dang và file untracked quan trọng (`.agents/`, `backend/src/modules/portal/`, `frontend/src/portal/`...). **Tuyệt đối không chạy `git reset --hard` hay `git clean -fd`**.
   - Tạo ngay branch làm việc riêng:
     ```bash
     git checkout -b feature/handover-work
     ```

2. **Khởi chạy Hệ thống Local hoàn chỉnh:**
   - Chạy container PostgreSQL và Mailpit qua Docker (xem chi tiết lệnh tại Phần 3).
   - Chạy `npm install` và `npx prisma generate` trong `backend/`; khởi chạy `npm run start:dev` (Port 3000).
   - Thiết lập venv Python và khởi chạy `ml-service/` qua `uvicorn` (Port 8000).
   - Chạy `npm install` và khởi chạy `frontend/` qua `npm run dev` (Port 5173).
   - Chạy `npm run graph:build` tại root để đưa CodeGraph về trạng thái exit code 0 (`npm run graph:check`).

3. **Kiểm tra các Chức năng Cốt lõi (Smoke Test):**
   - Đăng nhập thử bằng các tài khoản nội bộ seed sẵn (CBTD, Quản lý, Thẩm quyền, Admin).
   - Thử nghiệm tính năng chuyển vai trò (Switch Role) trên Header xem `X-Active-Role` có hoạt động không.
   - Mở Cổng Doanh nghiệp (`/portal`), đăng ký một tài khoản test, mở Web UI Mailpit (`http://localhost:8025`) để kiểm tra email OTP.
   - Thử nộp một hồ sơ vay V1 cơ bản và tải lên chứng từ mẫu.
   - Đăng nhập tài khoản Quản lý, kiểm tra hồ sơ vừa nộp trong hàng đợi tiếp nhận (`Intake`) và phân công cho CBTD.
   - Đăng nhập tài khoản CBTD, kiểm tra hồ sơ được phân công, thử nghiệm tính năng rà soát chứng từ và tạo yêu cầu bổ sung chứng từ.
   - Kiểm tra Dashboard SLA và các cảnh báo nguy cơ trễ hạn.

4. **Đối chiếu Tình trạng Thực tế với Bảng Project Status (Phần 4):**
   - Xác nhận các tính năng được ghi chú `[VERIFIED-TEST]` có file test tự động tương ứng.
   - Xác nhận cờ khóa nộp hồ sơ Portal V2 tại `backend/src/modules/portal/portal.readiness.ts:3` đang ở trạng thái `canSubmit: false`.
   - Xác nhận menu "Cấu hình SLA" của Admin đang bị thiếu route điều hướng trên UI (`navigation.ts`).

5. **Ghi lại các Điểm chưa khớp (Discrepancy Log):**
   - Nếu phát hiện bất kỳ sự khác biệt nào giữa mã nguồn thực tế và tài liệu này, lập tức ghi chép lại để trao đổi với người bàn giao hoặc tự cập nhật tài liệu trước khi bắt đầu Sprint mới.

---

### 2. EXECUTION ROADMAP — LỘ TRÌNH THỰC HIỆN CHI TIẾT 12 TASK

12 task công việc được phân chia theo 3 nhóm dựa trên tính độc lập và điều kiện kích hoạt:

```
[Nhóm A: Triển khai ngay độc lập] ──> [Nhóm B: Nghiệp vụ cốt lõi & Quá hạn] ──> [Nhóm C: Portal V2 đã kiểm chứng thử; SLA PA1 chưa triển khai]
    (TK-01, TK-02, TK-09, TK-10)          (TK-03, TK-04, TK-06, TK-07, TK-08, TK-12)       (TK-05, TK-11)
```

#### NHÓM A. CÓ THỂ TRIỂN KHAI NGAY SAU KHI XÁC MINH (ĐỘC LẬP KỸ THUẬT)

##### Task TK-01: Rebuild CodeGraph để khôi phục công cụ phân tích AI
- **Mục tiêu:** Cập nhật lại chỉ mục cấu trúc mã nguồn CodeGraph để phục vụ AI hỗ trợ phân tích code chính xác, tuân thủ quy định bắt buộc SME-AI-008.
- **Trạng thái hiện tại:** `[NEED CONFIRMATION]` (Stale do có thêm script kiểm thử mới).
- **Mức ưu tiên:** **P0 (Khẩn cấp)**.
- **Điều kiện được bắt đầu:** Đã clone repo, cài đặt xong `npm` dependencies ở root.
- **Các bước thực hiện chính:**
  1. Mở terminal tại thư mục gốc repository.
  2. Thực hiện lệnh: `npm run graph:build`.
  3. Kiểm tra lại bằng lệnh: `npm run graph:check`.
- **Kết quả đầu ra mong đợi:** Bộ cache index CodeGraph được cập nhật toàn bộ các file mới.
- **Acceptance Criteria:** Lệnh `npm run graph:check` trả về exit code 0, không còn cảnh báo lệch file.
- **Phụ thuộc:** Không phụ thuộc task khác.
- **Bằng chứng cần cung cấp:** Terminal output ghi nhận `graph:check passed`.

##### Task TK-02: Sửa điều hướng mở màn hình Cấu hình SLA (`navigation.ts`)
- **Mục tiêu:** Giúp Quản trị viên (ADMIN) có thể click menu để mở form cài đặt định mức SLA công đoạn trên web.
- **Trạng thái hiện tại:** `[CODE-ONLY]` (API BE `GET/PUT /admin/workflow-stages` và Form FE `AdminView.tsx` đã xong, chỉ thiếu route link).
- **Mức ưu tiên:** **P0 (Khẩn cấp)**.
- **Điều kiện được bắt đầu:** Hoàn thành TK-01.
- **Các bước thực hiện chính:**
  1. Mở file `frontend/src/navigation.ts`.
  2. Bổ sung mục điều hướng `settings` (Cấu hình SLA) vào danh sách menu cho vai trò `ADMIN`.
  3. Kiểm tra hiển thị Navbar khi đăng nhập tài khoản Admin.
  4. Kiểm tra việc gọi API lưu dữ liệu cấu hình thời gian SLA khi submit form.
- **Kết quả đầu ra mong đợi:** Admin truy cập được form cấu hình SLA, chỉnh sửa giờ và lưu vào DB thành công.
- **Acceptance Criteria:**
  - Click menu mở đúng form cấu hình SLA của 4 công đoạn (`TIEP_NHAN`, `THAM_DINH`, `CAP_TREN`, `HOAN_TAT`).
  - Sửa giờ và bấm Lưu -> API `PUT /admin/workflow-stages` trả về HTTP 200 OK.
  - Tải lại trang (F5), số giờ mới vẫn được giữ nguyên.
- **Phụ thuộc:** Không phụ thuộc nghiệp vụ mới.
- **Bằng chứng cần cung cấp:** Ảnh chụp màn hình form Cấu hình SLA và log Network 200 OK của API.

##### Task TK-09: Cấu hình Mailpit local & SMTP test cho Docker Compose
- **Mục tiêu:** Đảm bảo luồng gửi email OTP hoạt động ổn định trên cả môi trường local và môi trường container Docker theo `DEC-03`.
- **Trạng thái hiện tại:** `[APPROVED DEC-03]` (Backend đã có code gửi mail nodemailer; Docker compose thiếu cấu hình SMTP/Mailpit).
- **Mức ưu tiên:** **P1**.
- **Điều kiện được bắt đầu:** Hoàn thành TK-01.
- **Các bước thực hiện chính:**
  1. Khai báo service `mailpit` trong file `docker-compose.yml` (Port 1025 cho SMTP, 8025 cho Web UI).
  2. Truyền các biến môi trường `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `SMTP_SECURE=false` vào service backend trong compose.
  3. Khởi động Docker compose và test luồng đăng ký tài khoản từ Portal.
- **Kết quả đầu ra mong đợi:** Toàn bộ hệ thống chạy trên Docker gửi nhận email OTP thông suốt mà không cần kết nối internet ra ngoài.
- **Acceptance Criteria:**
  - `docker compose up` khởi động đầy đủ các container không lỗi.
  - Nhập email đăng ký trên Portal -> Mailpit nhận được email chứa OTP 6 chữ số trong vòng 3 giây.
  - Nhập OTP trên Portal xác thực thành công.
- **Phụ thuộc:** Quyết định `DEC-03`.
- **Bằng chứng cần cung cấp:** Ảnh chụp Web UI Mailpit tại `localhost:8025` nhận được email OTP test.

##### Task TK-10: Xây dựng giao diện Đổi mật khẩu cá nhân cho cán bộ
- **Mục tiêu:** Cung cấp giao diện trực quan cho người dùng nội bộ tự đổi mật khẩu tài khoản.
- **Trạng thái hiện tại:** `[CODE-ONLY]` (API `POST /auth/change-password` đã có sẵn tại `backend/src/modules/auth/auth.controller.ts:40`, FE chưa có form).
- **Mức ưu tiên:** **P1**.
- **Điều kiện được bắt đầu:** Hoàn thành TK-01.
- **Các bước thực hiện chính:**
  1. Tạo component Modal `ChangePasswordModal.tsx` trong `frontend/src/components/`.
  2. Gắn nút "Đổi mật khẩu" tại menu tài khoản cá nhân ở Header/Navbar.
  3. Validate form (mật khẩu cũ bắt buộc, mật khẩu mới tối thiểu 6 ký tự, xác nhận mật khẩu mới trùng khớp).
  4. Gửi request tới API `POST /auth/change-password` kèm JWT token.
- **Kết quả đầu ra mong đợi:** Cán bộ nội bộ tự đổi mật khẩu thành công và đăng nhập được bằng mật khẩu mới.
- **Acceptance Criteria:**
  - Nhập sai mật khẩu hiện tại: Hiển thị thông báo lỗi từ backend (HTTP 400).
  - Nhập đúng: Hiển thị thông báo "Đổi mật khẩu thành công".
  - Đăng xuất và đăng nhập lại bằng mật khẩu mới thành công; mật khẩu cũ không còn đăng nhập được.
- **Phụ thuộc:** Không phụ thuộc task khác.
- **Bằng chứng cần cung cấp:** Ảnh chụp giao diện Modal đổi mật khẩu và video test đăng nhập lại bằng mật khẩu mới.

---

#### NHÓM B. CẦN LÀM RÕ NGHIỆP VỤ HOẶC ACCEPTANCE CRITERIA TRƯỚC KHI TRIỂN KHAI

##### Task TK-03: Rà soát và hoàn thiện AC phân quyền trong phạm vi 1 chi nhánh
- **Mục tiêu:** Thiết lập ma trận Acceptance Criteria chi tiết về quyền truy cập dữ liệu giữa CBTD, Quản lý và Thẩm quyền trong phạm vi duy nhất 01 chi nhánh ngân hàng theo `DEC-01`.
- **Trạng thái hiện tại:** `[APPROVED DEC-01]` (Đã chốt phạm vi 1 chi nhánh, chưa có văn bản AC chi tiết từng màn hình).
- **Mức ưu tiên:** **P0 (Nghiệp vụ)**.
- **Điều kiện được bắt đầu:** Đã nghiên cứu kỹ `docs/Phan_quyen_va_luong_nghiep_vu.md`.
- **Các bước thực hiện chính:**
  1. Rà soát từng màn hình nghiệp vụ (`IntakeView`, `LoanList`, `LoanDetailModal`, `AssignmentsView`, `DashboardView`).
  2. Xác định rõ ràng: CBTD chỉ truy cập hồ sơ mình phụ trách (`assignedTo == user.id`); Quản lý và Thẩm quyền xem được toàn bộ hồ sơ trong chi nhánh.
  3. Ban hành tài liệu ma trận AC phân quyền 1 chi nhánh.
- **Kết quả đầu ra mong đợi:** Bảng ma trận Acceptance Criteria phân quyền chi tiết cho từng vai trò trong 1 chi nhánh.
- **Acceptance Criteria:**
  - Xác định rõ danh sách các API cần siết chặt điều kiện `assignedTo`.
  - Được PO (người tiếp nhận kiêm nhiệm) phê duyệt và lưu vào thư mục `docs/`.
- **Phụ thuộc:** Quyết định `DEC-01`.
- **Bằng chứng cần cung cấp:** File tài liệu ma trận AC phân quyền được lưu trong `docs/`.

##### Task TK-04: Củng cố filter truy vấn theo phân công hồ sơ tại Backend
- **Mục tiêu:** Ngăn chặn triệt để nguy cơ CBTD xem hoặc can thiệp chéo vào hồ sơ của đồng nghiệp khác trong chi nhánh.
- **Trạng thái hiện tại:** `[NEED CONFIRMATION]` (Cần kiểm tra lại các query trong `loan-applications.service.ts`).
- **Mức ưu tiên:** **P0 (Kỹ thuật)**.
- **Điều kiện được bắt đầu:** Hoàn thành TK-03 (đã có AC chốt).
- **Các bước thực hiện chính:**
  1. Mở `backend/src/modules/loan-applications/loan-applications.service.ts`.
  2. Bổ sung điều kiện lọc Prisma: Nếu `user.activeRole === 'CBTD'` thì ép buộc thêm clause `where: { assignedTo: user.id }` ở các hàm danh sách và chi tiết.
  3. Rà soát tương tự cho module tài liệu (`documents.service.ts`) và bổ sung (`supplements.service.ts`).
  4. Viết unit test tự động kiểm tra trường hợp truy cập chéo.
- **Kết quả đầu ra mong đợi:** Backend từ chối mọi yêu cầu truy cập hồ sơ của CBTD nếu hồ sơ đó không được phân công cho CBTD đó.
- **Acceptance Criteria:**
  - CBTD A gửi request `GET /loan-applications/{id_cua_CBTD_B}` -> Nhận lỗi HTTP 403 Forbidden.
  - Quản lý hoặc Thẩm quyền gửi request trên -> Nhận dữ liệu bình thường (HTTP 200 OK).
  - Toàn bộ unit test liên quan pass 100%.
- **Phụ thuộc:** `TK-03`, `DEC-01`.
- **Bằng chứng cần cung cấp:** Test output của unit test kiểm tra mã lỗi 403 khi truy cập chéo hồ sơ.

##### Task TK-06: Xây dựng giao diện theo dõi tiến độ hồ sơ cho Doanh nghiệp trên Portal
- **Mục tiêu:** Cho phép khách hàng SME tra cứu trạng thái và tiến độ xử lý hồ sơ vay sau khi đã nộp thành công qua Portal.
- **Trạng thái hiện tại:** `[NOT-IMPLEMENTED]` (README xác nhận chưa triển khai).
- **Mức ưu tiên:** **P1**.
- **Điều kiện được bắt đầu:** PO duyệt bản thiết kế mockup và danh mục trạng thái hiển thị công khai.
- **Các bước thực hiện chính:**
  1. Thống nhất các mốc hiển thị: Tiếp nhận -> Thẩm định -> Phê duyệt -> Hoàn tất (Ẩn toàn bộ ghi chú nội bộ và điểm ML).
  2. Xây dựng API `GET /portal/requests/{id}/status` trả về thông tin trạng thái công khai.
  3. Xây dựng component `PortalApplicationTracking.tsx` trong `frontend/src/portal/`.
  4. Tích hợp màn hình tra cứu vào Portal Dashboard của khách hàng.
- **Kết quả đầu ra mong đợi:** Doanh nghiệp đăng nhập Portal thấy danh sách hồ sơ đã nộp và xem được tiến độ xử lý từng bước.
- **Acceptance Criteria:**
  - Khách hàng SME chỉ xem được hồ sơ thuộc tài khoản của mình (`accountId`).
  - Hiển thị đúng tiến độ thực tế nhưng không để lộ thông tin nội bộ của thẩm định viên.
  - Khi hồ sơ bị từ chối (`REJECTED`), hiển thị lý do từ chối chung đã được cấp có thẩm quyền duyệt.
- **Phụ thuộc:** PO duyệt thiết kế UI và danh mục trạng thái hiển thị.
- **Bằng chứng cần cung cấp:** Ảnh chụp màn hình giao diện tra cứu tiến độ trên Portal và test contract API.

##### Task TK-07: Hoàn thiện AC, logic nhắc ngày 5 và đánh dấu quá hạn ngày 10
- **Mục tiêu:** Thiết lập cơ chế cảnh báo tự động khi doanh nghiệp chậm trễ bổ sung chứng từ theo quy định tại `DEC-02`.
- **Trạng thái hiện tại:** `[APPROVED DEC-02]` (Chưa code; quy tắc ngày lịch vs ngày làm việc đang PENDING).
- **Mức ưu tiên:** **P1**.
- **Điều kiện được bắt đầu:** PO chốt quy tắc tính ngày (ngày lịch hay ngày làm việc).
- **Các bước thực hiện chính:**
  1. Xây dựng logic tính toán thời gian từ lúc tạo yêu cầu bổ sung (`SupplementRequest.createdAt`) đến hiện tại.
  2. Tạo logic gửi thông báo nhắc nhở ở mốc ngày 5 nếu hồ sơ vẫn chưa hoàn tất bổ sung.
  3. Tạo logic đánh dấu quá hạn ở mốc ngày 10 và chuyển hồ sơ vào hàng đợi xem xét của Quản lý chi nhánh.
  4. RÀNG BUỘC CỨNG: **Tuyệt đối không tự động đóng hồ sơ** sau 10 ngày.
- **Kết quả đầu ra mong đợi:** Hệ thống tự động nhận diện hồ sơ chậm bổ sung và hiển thị cảnh báo cho Quản lý khi chạm mốc 10 ngày.
- **Acceptance Criteria:**
  - Đến mốc 5 ngày: Tự động tạo bản ghi thông báo nhắc nhở cho doanh nghiệp và CBTD phụ trách.
  - Đến mốc 10 ngày: Đánh dấu hồ sơ là quá hạn bổ sung, hiển thị cảnh báo đỏ trên Dashboard của Quản lý.
  - Hồ sơ vẫn ở trạng thái `SUPPLEMENT_REQUIRED`, không bị tự động hủy hay chuyển trạng thái.
- **Phụ thuộc:** Quyết định `DEC-02`, PO chốt quy tắc ngày lịch vs ngày làm việc.
- **Bằng chứng cần cung cấp:** Unit test kiểm thử logic tính mốc 5 ngày và 10 ngày; log sinh thông báo nhắc nhở.

##### Task TK-08: Triển khai chức năng Quản lý đóng hồ sơ quá hạn thủ công
- **Mục tiêu:** Cung cấp công cụ cho Quản lý chi nhánh chủ động đóng hồ sơ sang trạng thái `CLOSED_TIMEOUT` khi quá hạn bổ sung theo `DEC-02`.
- **Trạng thái hiện tại:** `[NOT-IMPLEMENTED]` (Enum `CLOSED_TIMEOUT` đã có trong DB, nhưng BE chưa cho phép chuyển bước này và FE chưa có nút).
- **Mức ưu tiên:** **P1**.
- **Điều kiện được bắt đầu:** Hoàn thành TK-07.
- **Các bước thực hiện chính:**
  1. Cập nhật `workflow.service.ts`: Cho phép Quản lý (`activeRole === 'QUAN_LY'`) thực hiện chuyển trạng thái sang `CLOSED_TIMEOUT` thuộc công đoạn `HOAN_TAT`.
  2. Bắt buộc nhập lý do đóng hồ sơ (`rejectionReasonCode` / `rejectionNote`).
  3. Ghi nhận chính xác `handledBy: user.id`, `completedAt: now` và tạo bản ghi kết thúc trong `ApplicationStageHistory`.
  4. Thêm nút bấm và Modal "Đóng hồ sơ do quá hạn" trên `LoanDetailModal.tsx` (chỉ hiển thị cho Quản lý khi hồ sơ đã quá hạn 10 ngày).
- **Kết quả đầu ra mong đợi:** Quản lý xem xét và đóng hồ sơ quá hạn thủ công thành công kèm lưu vết kiểm toán đầy đủ.
- **Acceptance Criteria:**
  - Chỉ duy nhất role `QUAN_LY` mới có quyền thực hiện (CBTD hoặc Thẩm quyền thao tác sẽ nhận lỗi HTTP 403 Forbidden).
  - Bắt buộc nhập lý do đóng hồ sơ, không cho phép để trống.
  - Hồ sơ sau khi đóng chuyển sang `CLOSED_TIMEOUT`, khóa toàn bộ thao tác chuyển bước tiếp theo.
  - Lịch sử công đoạn ghi nhận đầy đủ người đóng và thời điểm đóng.
- **Phụ thuộc:** `TK-07`, `DEC-02`.
- **Bằng chứng cần cung cấp:** Unit test chuyển trạng thái sang `CLOSED_TIMEOUT` thành công và ảnh chụp màn hình Modal thao tác của Quản lý.

##### Task TK-12: Lập Báo cáo đánh giá mô hình ML trên dữ liệu Synthetic
- **Mục tiêu:** Hoàn thiện báo cáo khoa học đánh giá độ chính xác cảnh báo trễ hạn SLA của mô hình Random Forest theo yêu cầu `DEC-04`.
- **Trạng thái hiện tại:** `[APPROVED DEC-04]` (Code ML đã có, thiếu file báo cáo đánh giá metric).
- **Mức ưu tiên:** **P2**.
- **Điều kiện được bắt đầu:** Chạy script đánh giá mô hình trong thư mục `ml-service/`.
- **Các bước thực hiện chính:**
  1. Chạy đánh giá mô hình trên tập kiểm thử synthetic (tính Accuracy, Precision, Recall, F1-score, ROC-AUC).
  2. Xuất biểu đồ Confusion Matrix và Feature Importance.
  3. Lập file tài liệu `docs/Bao_cao_Mo_hinh_Machine_Learning.md`.
  4. Nêu rõ giới hạn: Dữ liệu huấn luyện là dữ liệu tổng hợp (synthetic), mô hình chỉ dự báo trễ hạn SLA, tuyệt đối không ra quyết định cấp tín dụng.
- **Kết quả đầu ra mong đợi:** File báo cáo hoàn chỉnh phục vụ thuyết minh đồ án tốt nghiệp.
- **Acceptance Criteria:**
  - Báo cáo thể hiện đầy đủ các chỉ số đo lường khoa học của mô hình.
  - Tuyên bố rõ ràng về phạm vi đạo đức AI và giới hạn của dữ liệu synthetic theo đúng quy định `DEC-04`.
- **Phụ thuộc:** Quyết định `DEC-04`.
- **Bằng chứng cần cung cấp:** File báo cáo `docs/Bao_cao_Mo_hinh_Machine_Learning.md` trong repository.

---

<a id="task-8-nhom-c"></a>
#### NHÓM C. TÌNH HÌNH TRIỂN KHAI PORTAL V2 VÀ SLA — GÓC NHÌN NGHIỆP VỤ BA

**Ngày cập nhật cách trình bày: 28/10/2026.** Nội dung tổng hợp kết quả triển khai và kiểm chứng đã ghi nhận ngày 27/10. Lượt cập nhật này chỉ chỉnh tài liệu, không sửa chức năng, chạy lại kiểm thử, truy cập DB hoặc mở lại môi trường thử.

##### C.1. Người đọc cần nắm ngay điều gì?

**Portal V2 đã có vòng xử lý từ doanh nghiệp gửi đề nghị đến CBTD tiếp nhận thành hồ sơ vay, bao gồm trả sửa và gửi lại. Chức năng đã được kiểm chứng trên môi trường thử riêng; chưa có ghi nhận PO nghiệm thu cuối hoặc phát hành dùng chung trong phạm vi cập nhật này. SLA theo giờ làm việc đã được duyệt về nghiệp vụ nhưng chưa triển khai.**

| Hạng mục | Tình hình đã ghi nhận | Ý nghĩa đối với người sử dụng |
| :--- | :--- | :--- |
| TK-05 — Tiếp nhận hồ sơ Portal V2 | Đã triển khai vòng gửi–phân công–kiểm tra–trả sửa–gửi lại–tiếp nhận; đã chạy kiểm chứng bằng trình duyệt và cơ sở dữ liệu trên môi trường thử riêng | Có chức năng để nghiệm thu nghiệp vụ; không còn dừng ở bộ quy tắc hoặc bản thiết kế. Chưa đồng nghĩa người dùng trên môi trường chung đã sử dụng được. |
| Mở sử dụng trên môi trường chung | Chưa có ghi nhận hoàn tất nâng cấp DB và mở sử dụng tại checkpoint 27/10; lượt này chưa xác minh lại môi trường | Cần hoàn tất việc đưa phiên bản mới lên đúng môi trường và có kết quả PO nghiệm thu trước khi công bố sử dụng. |
| TK-11 — SLA theo giờ làm việc (PA1) | PO đã chọn phương án, chưa triển khai phép tính và các xử lý liên quan | Hoàn thành Portal không có nghĩa SLA giờ làm việc đã có hiệu lực. |
| Phiên PO xem thử ngày 27/10 | Đã quá thời hạn 23:18 ngày 27/10 | Không coi phiên đó vẫn đang mở. Cần chuẩn bị lại môi trường thử nếu PO muốn thao tác trực tiếp. |

**Ba mức kết quả cần phân biệt:** doanh nghiệp khai đủ để gửi → CBTD kiểm tra đạt để tiếp nhận → hồ sơ vay được kiểm tra/thẩm định/phê duyệt theo quy trình nội bộ. Mức trước không tự thay thế mức sau.

##### C.2. Phạm vi nghiệp vụ đã đưa vào chức năng

Phạm vi hiện tại là kịch bản mô phỏng doanh nghiệp sản xuất đề nghị vay vốn lưu động trong đồ án, không phải tuyên bố áp dụng đầy đủ cho mọi sản phẩm/ngân hàng thực tế.

| Nhóm hồ sơ | Điều kiện trước khi gửi | Phần được yêu cầu làm rõ sau tiếp nhận |
| :--- | :--- | :--- |
| A — Pháp lý và đại diện | Đăng ký doanh nghiệp, điều lệ, định danh và căn cứ đại diện; có văn bản ủy quyền nếu người gửi là người được ủy quyền | Tài liệu làm rõ theo kết quả kiểm tra. |
| B — Tài chính | Bộ báo cáo năm lịch hoàn thành gần nhất gồm bảng cân đối, kết quả kinh doanh, lưu chuyển tiền tệ, thuyết minh; có thể một hoặc nhiều tệp. Khai đúng kỳ và tài liệu nguồn doanh thu | Chi tiết công nợ, tồn kho, báo cáo kỳ gần nhất. |
| C — Hoạt động sản xuất | Kế hoạch sản xuất kinh doanh và ít nhất một bằng chứng đầu ra phù hợp: hợp đồng, hóa đơn hoặc đơn đặt hàng | Báo giá, hợp đồng nguyên vật liệu và nội dung làm rõ phương án. |
| D — Đề nghị và phương án vốn | Đề nghị vay và phương án sử dụng vốn | Chi tiết dòng tiền trả nợ phục vụ thẩm định. |
| E — Bảo đảm | Khai rõ có/không đề xuất tài sản bảo đảm; nếu có thì mô tả. Chưa xác định thì tiếp tục lưu nháp | Hồ sơ quyền tài sản, thông tin định giá theo yêu cầu. |
| F — Dư nợ | Khai rõ có/không dư nợ; có dư nợ thì cung cấp thông tin dư nợ | Lịch trả nợ, sao kê chi tiết theo yêu cầu. |

- Người gửi xác nhận tư cách đại diện và cam kết khi gửi; chưa tích hợp ký số.
- Ví dụ: gửi trong năm 2026 thì kỳ năm hoàn thành gần nhất là 2025. Không quy đổi số liệu tháng/quý thành năm; không tự điền doanh thu 0 khi chưa khai. Giá trị 0 thực vẫn được ghi nhận.
- Hệ thống xác định đủ theo dữ liệu và danh mục do doanh nghiệp khai; CBTD phải đọc/đối chiếu nội dung. Tải tệp thành công chưa phải chứng từ hợp lệ.
- Các mục được yêu cầu sau tiếp nhận là phạm vi hoãn đã duyệt, không phải quyền cho cán bộ tự miễn hoặc bỏ qua tài liệu.

##### C.3. Luồng chính đã triển khai — hồ sơ đi như thế nào?

**Chuẩn bị → Gửi đề nghị → Quản lý phân công → CBTD kiểm tra → Trả sửa nếu cần → Doanh nghiệp sửa và gửi lại → CBTD kiểm tra lại → Tiếp nhận thành hồ sơ vay.**

| Bước | Người thực hiện và thao tác | Kết quả hệ thống ghi nhận | Người dùng cần hiểu |
| :--- | :--- | :--- | :--- |
| 1. Chuẩn bị | Doanh nghiệp khai thông tin, chọn kỳ, cung cấp tài liệu và nguồn doanh thu | Bản nháp; checklist chỉ rõ mục thiếu, mục đã cung cấp/chờ kiểm tra, mục không áp dụng hoặc cung cấp sau | Chưa gửi đến ngân hàng; chưa tạo hồ sơ vay hoặc bắt đầu SLA của hồ sơ vay. |
| 2. Gửi | Doanh nghiệp rà soát, xác nhận cam kết và bấm gửi | Lưu riêng dữ liệu/tài liệu của lần gửi; khóa chỉnh sửa bản đã gửi; đưa vào hàng chờ phân công | Mới là đề nghị gửi đến ngân hàng, chưa phải được ngân hàng tiếp nhận hoặc duyệt vay. |
| 3. Phân công | Quản lý chọn CBTD phụ trách | Ghi nhận người được giao và lịch sử phân công | CBTD đúng phân công mới kiểm tra, trả sửa hoặc tiếp nhận. |
| 4. Kiểm tra | CBTD mở tài liệu và đối chiếu từng mục: chủ thể, đại diện, kỳ, thành phần, nội dung đọc được và thông tin trọng yếu | Mỗi mục có kết luận đạt/cần sửa, người kiểm tra, thời điểm và lý do tương ứng với đúng lần gửi/tài liệu | Đây là kiểm tra điều kiện tiếp nhận, chưa phải kết luận thẩm định tín dụng. |
| 5. Trả sửa | CBTD ghi rõ mục sai và yêu cầu sửa, sau đó gửi danh sách tổng hợp | Đề nghị chuyển sang cần chỉnh sửa; bản đã gửi và kết quả kiểm tra được giữ lại; mở bản làm việc cho doanh nghiệp | Doanh nghiệp biết cụ thể sửa gì, vì sao và không phải tạo lại đề nghị. |
| 6. Sửa và gửi lại | Doanh nghiệp sửa thông tin/tài liệu cần thiết rồi gửi lại | Giữ nguyên mã đề nghị, thêm lần gửi mới và hiển thị nội dung thay đổi; không yêu cầu tải lại tệp không đổi | Mục bị thay đổi hoặc chịu ảnh hưởng phải kiểm tra lại. Chỉ giữ kết quả đạt của mục có nội dung/căn cứ không đổi. |
| 7. Tiếp nhận | CBTD kiểm tra đủ các mục bắt buộc, đối chiếu doanh nghiệp hiện có và xác nhận tiếp nhận | Chỉ tạo một hồ sơ vay ở công đoạn Tiếp nhận, trạng thái Đã tiếp nhận; giữ liên kết với các lần gửi trước | Hồ sơ bắt đầu đi vào quy trình vay nội bộ. Chưa tự hoàn tất kiểm tra chứng từ, chuyển thẩm định hoặc phê duyệt khoản vay. |

Nếu lần đầu CBTD kiểm tra đã đạt thì đi thẳng từ bước 4 sang bước 7, không cần trả sửa. Nếu sau gửi lại vẫn chưa đạt thì tiếp tục vòng kiểm tra–trả sửa trên cùng mã đề nghị.

**Ví dụ nghiệp vụ:** doanh nghiệp gửi đủ danh mục nhưng nội dung báo cáo kết quả kinh doanh sai → CBTD ghi lý do và trả sửa → doanh nghiệp thay tài liệu, chọn lại nguồn doanh thu nếu cần, giữ các giấy tờ pháp lý không đổi và gửi lại → ngân hàng kiểm tra lại các mục tài chính liên quan → tiếp nhận khi các điều kiện còn lại đã đạt. Báo cáo cũ vẫn nằm trong lịch sử; tài liệu mới không tự mang kết luận đạt của tài liệu cũ.

##### C.4. Mỗi vai trò hiện đã có những chức năng gì?

| Vai trò | Chức năng đã có trong vòng Portal V2 | Giới hạn trách nhiệm |
| :--- | :--- | :--- |
| Doanh nghiệp | Khai và lưu nháp; xem checklist; gửi; xem lý do cần sửa; chỉnh sửa khi được trả; gửi lại; xem các lần gửi/tài liệu cũ; đề nghị ngân hàng cho sửa khi tự phát hiện sai | Chỉ thao tác đề nghị của mình; không tự mở khóa bản đã gửi, tự xác nhận tài liệu hợp lệ hoặc sửa trực tiếp bản gốc sau tiếp nhận. |
| CBTD được giao | Xem thông tin/tài liệu; kiểm tra từng mục; ghi kết luận/lý do; trả một danh sách sửa tổng hợp; kiểm tra lại thay đổi; đối chiếu doanh nghiệp và tiếp nhận | Không kiểm tra/tiếp nhận ngoài phân công; không bỏ qua mục bắt buộc, vướng mắc đang mở hoặc khác biệt thông tin doanh nghiệp. |
| Quản lý | Phân công/điều chuyển; theo dõi đề nghị đang chờ xử lý; ghi nhận vướng mắc, phương án và đầu mối; ghi kết quả xử lý; tách thông báo cho doanh nghiệp khỏi ghi chú nội bộ | Không kiểm tra thay CBTD hoặc dùng vai trò quản lý để tiếp nhận, bỏ checklist hay ghi đè dữ liệu doanh nghiệp để vượt chặn. |

Lead BA chịu trách nhiệm đối chiếu yêu cầu và kết luận đạt/chưa đạt nghiệp vụ. Lead Tech/FullStack chịu trách nhiệm triển khai và bằng chứng kỹ thuật. PO quyết định thay đổi nghiệp vụ/phạm vi và nghiệm thu cuối. Đây là trách nhiệm làm việc của nhóm phát triển, không phải bổ sung vai trò người dùng trong ứng dụng; không tổ chức Lead Tester riêng.

##### C.5. Các nhánh ngoại lệ đã được xử lý

| Tình huống | Hệ thống xử lý | Kết quả/bảo đảm nghiệp vụ |
| :--- | :--- | :--- |
| Doanh nghiệp tự phát hiện sai sau gửi | Gửi đề nghị chỉnh sửa cho ngân hàng, chưa tự mở khóa. Nếu chưa phân công, quản lý cần giao CBTD xử lý | Có người chịu trách nhiệm xem xét việc trả sửa; giữ được bản đã gửi. |
| Thay tài liệu hoặc thông tin trọng yếu | Lưu bản mới, xác định mục thay đổi/phụ thuộc và yêu cầu kiểm tra lại | Không sử dụng kết luận của tài liệu cũ để xác nhận tài liệu mới. |
| Thông tin khác dữ liệu doanh nghiệp ngân hàng đang có | Chặn tiếp nhận; đưa vào đối soát, quản lý ghi vướng mắc và phương án/đầu mối xử lý | Không tự ghi đè doanh nghiệp. Ghi đã xử lý vướng mắc không tự bỏ điều kiện đối soát khi tiếp nhận. |
| Muốn đổi MST sang một doanh nghiệp khác | Chặn sửa chủ thể trên đề nghị đã gửi và hướng dẫn lập đề nghị mới | Không trộn lịch sử, tài liệu và kết quả kiểm tra của hai doanh nghiệp. |
| Điều chuyển CBTD khi đang chờ doanh nghiệp sửa | Giữ tình trạng chờ sửa và lịch sử, chuyển trách nhiệm cho CBTD mới; người cũ không tiếp tục thao tác | Không làm mất vòng sửa hoặc biến hồ sơ đang thiếu thành đủ điều kiện. |
| Bấm gửi/tiếp nhận lặp hoặc mất phản hồi sau khi hệ thống đã lưu | Thử lại không tạo thêm lần gửi, thao tác kiểm tra hoặc hồ sơ vay tương ứng | Tránh hồ sơ trùng và giảm việc người dùng phải tự xác định lần trước đã lưu hay chưa. |
| Hai người thao tác hoặc dùng màn hình đã cũ | Kiểm tra lại người phụ trách và phiên bản; từ chối thao tác không còn phù hợp, yêu cầu tải lại | Tránh kết quả cũ ghi đè kết quả mới hoặc người đã bị điều chuyển vẫn xử lý được. |
| Hồ sơ đã được tiếp nhận thành hồ sơ vay | Giữ nguyên bản gửi gốc; yêu cầu bổ sung tiếp theo dùng chức năng bổ sung của hồ sơ vay | Tách rõ chỉnh sửa trước tiếp nhận và bổ sung sau tiếp nhận. |

##### C.6. Phần đã làm tác động thế nào đến luồng vay chính?

| Điểm trong luồng | Tác động của phần Portal V2 đã làm |
| :--- | :--- |
| Trước khi tiếp nhận | Bổ sung vòng chuẩn bị, kiểm tra và chỉnh sửa có lịch sử. Chưa tạo hồ sơ vay và chưa bắt đầu SLA của hồ sơ vay. |
| Khi CBTD tiếp nhận | Tạo một hồ sơ vay từ đúng bản đã kiểm tra đạt; bắt đầu công đoạn Tiếp nhận theo cơ chế SLA đang có. Không mặc nhiên áp SLA PA1. |
| Kiểm tra chứng từ/chuyển thẩm định | Tiếp tục các điều kiện của quy trình nội bộ hiện có. Đủ để tiếp nhận không tự tương đương đủ để chuyển thẩm định. |
| Chờ bổ sung sau tiếp nhận | Tiếp tục đi qua hồ sơ vay; không quay lại sửa bản đề nghị gốc. Cơ chế chạy lại SLA theo bên đang chờ của PA1 chưa được triển khai trong đợt này. |
| Phê duyệt/cấp trên | Không thay quyền tín dụng, ngưỡng vượt 10 tỷ phải qua cấp trên hoặc điều kiện phê duyệt. |
| Dữ liệu doanh nghiệp | Không tự ghi đè thông tin doanh nghiệp đã có. |
| ML | Không đổi ý nghĩa dự báo trễ SLA thành đánh giá khả năng trả nợ hoặc tự duyệt/từ chối khoản vay. Không phát sinh xác suất giả. |

**Lợi ích đã hình thành:** doanh nghiệp biết mục cần sửa; CBTD kiểm tra theo một danh mục chung; quản lý nắm trách nhiệm xử lý; ngân hàng có lịch sử để đối chiếu từng lần gửi. Phạm vi đã hoàn thành là vòng tiếp nhận Portal V2, không phải toàn bộ chương trình nâng cấp SLA/ML.

##### C.7. Những việc còn lại và điểm PO cần quyết định

Người nhận tiếp tục triển khai theo [nội dung bàn giao C.9](#sla-pa1-next-handover); bảng dưới đây là tổng quan các phần còn lại.

| Việc còn lại | Phần triển khai phải chuẩn bị | PO cần quyết định/nghiệm thu |
| :--- | :--- | :--- |
| Nghiệm thu vòng Portal V2 | Chuẩn bị lại phiên thử, một hồ sơ mẫu và trình trực tiếp cả đường nhận ngay lẫn đường trả sửa–gửi lại; báo lỗi/giới hạn còn lại | Xác nhận trải nghiệm và kết quả nghiệp vụ đã đáp ứng yêu cầu hay cần chỉnh điểm cụ thể. Không yêu cầu chọn lại checklist/quyền đã duyệt. |
| Đưa phiên bản lên môi trường dùng chung | Xác minh DB đích, cấu trúc hiện có, kế hoạch nâng cấp tương thích dữ liệu cũ, khôi phục và kiểm tra sau cập nhật | Quyết định đúng môi trường, phạm vi người sử dụng và tác động dữ liệu chưa được cấp quyền. Không chỉ bật nút gửi để thay bước nâng cấp/nghiệm thu. |
| TK-11 — Tính SLA theo giờ làm việc | Xây dựng bộ tính và lịch có phiên bản; tích hợp chuyển công đoạn, bổ sung, đóng quá hạn, báo cáo | Phương án PA1 đã duyệt; chỉ còn chốt lịch ngày nghỉ cụ thể/thời điểm hiệu lực và nghiệm thu kết quả, không chọn lại PA1 hay 24/7. |
| Phân biệt chờ doanh nghiệp/chờ ngân hàng khi tính SLA | Pause khi chờ doanh nghiệp; chính thức gửi đủ phản hồi thì chạy SLA trong lúc ngân hàng kiểm tra; trả sửa tổng hợp thì pause mới. Đồng bộ nhắc/đóng theo bên đang chờ | Nghiệm thu theo quy tắc đã duyệt; không tự đổi thời hạn phản hồi hoặc cho chuyển bước khi chứng từ chưa kiểm tra đạt. |
| Báo cáo và dự báo sau thay đổi SLA | Báo cáo phân biệt cách tính cũ/mới và thời gian chờ từng bên; đánh giá dự báo ML có phù hợp thước đo mới | Chỉ duyệt thêm nếu phát sinh thay đổi phạm vi hoặc cần huấn luyện/ghi đè model; không mặc định kết quả ML cũ đã phù hợp PA1. |

**Quy tắc SLA đã duyệt, đang chờ hiện thực:** thứ Hai–thứ Sáu, 08:00–12:00 và 13:00–17:00 giờ Việt Nam, loại ngày nghỉ theo lịch được xác nhận; giữ định mức giờ hiện có. Công đoạn cũ giữ cách tính cũ, công đoạn mới áp dụng chính sách/lịch có hiệu lực. Giữ mốc nhắc 5 ngày/quá hạn 10 ngày và quy tắc ngày lịch của TK-07; không lẫn thời hạn doanh nghiệp phản hồi với đồng hồ SLA giờ làm việc, không tự gia hạn khi gửi lại.

Bộ kiểm tra hồ sơ đã có cung cấp căn cứ cho CBTD; lịch sử gửi–trả sửa cung cấp dấu vết trách nhiệm xử lý. Phần SLA tiếp sau dùng các mốc nghiệp vụ liên quan khi được tích hợp, không được coi vòng Portal hiện tại đã tự thay phép tính SLA.

<a id="portal-intake-cycle-result"></a>
##### C.8. Bằng chứng kiểm chứng và thông tin kỹ thuật

<details>
<summary>Xem chi tiết đợt kiểm chứng ngày 27/10/2026</summary>

**Kết luận:** đã triển khai và kiểm chứng luồng trong môi trường cách ly. Lead BA đã đối chiếu luồng nghiệp vụ được duyệt trong các tình huống đã chạy ngày 27/10; PO giữ quyền nghiệm thu cuối. Chưa phát hành lên schema public, chưa triển khai SLA PA1. Review đợt này là tự rà soát source/diff và kiểm thử, không tuyên bố có reviewer độc lập.

###### Hành vi nghiệp vụ đã có

| Bước PO giao | Kết quả đã triển khai |
| :--- | :--- |
| 1. Lưu lần gửi/bản đang sửa | Thêm PortalSubmission với số lần gửi và revision nguồn duy nhất theo đề nghị; lưu snapshot dữ liệu/policy/kỳ/tệp/hash. Giữ nguyên snapshot trước; bản làm việc chỉ sửa khi DRAFT hoặc RETURNED. Tệp thay thế có bytes riêng; tệp cũ còn tải được. Gửi lặp cùng revision/manifest không sinh lần gửi trùng. |
| 2. Kiểm tra/trả sửa | CBTD đúng phân công kiểm tra từng mục bắt buộc đến hạn; ghi kết luận, lý do, người và thời điểm. Trả một danh sách sửa tổng hợp, giữ nguyên bản đã gửi, mở RETURNED. Quản lý không có quyền kiểm tra thay CBTD. |
| 3. Gửi lại | Cùng mã đề nghị, lần gửi mới; kiểm tra lại policy và tệp thực. So sánh trường/tài liệu thay đổi; chỉ giữ kết luận đạt khi dấu vết nội dung và các dữ liệu phụ thuộc không đổi. Đổi nguồn/tệp tài chính buộc kiểm tra lại các mục tài chính liên quan; mục pháp lý không đổi giữ được kết quả cũ. |
| 4. Tiếp nhận | Bắt buộc đúng phiên bản/lần gửi, mọi mục cần kiểm tra đạt và không còn vướng mắc mở. Đối soát Company cả nhận diện và dữ liệu tài chính; xác nhận không vượt được chặn khác biệt. Tạo đúng một Loan TIEP_NHAN/RECEIVED trong transaction, chưa CHECKED hoặc chuyển thẩm định. |
| 5. Giao diện | Portal có khai phạm vi/đại diện/cam kết, thành phần BCTC, checklist, danh sách sửa, gửi lại, lịch sử/tải bản cũ và đề nghị tự xin sửa. CBTD có kiểm tra từng mục, mở tài liệu, trả sửa; quản lý có phân công/điều chuyển và vướng mắc với phương án/đầu mối. Phản hồi công khai tách ghi chú nội bộ. |
| 6. Kiểm chứng | Đã chạy API/PostgreSQL thật, SQL nâng cấp, Chrome desktop 1365px và Portal mobile 375px. Đã thử gửi/nhận lặp, sai quyền, revision cũ, tranh chấp kiểm tra–điều chuyển và mất phản hồi sau khi máy chủ đã lưu. |

Điều chuyển giữ RETURNED, tăng revision và chặn người cũ; số đề nghị chờ tính cả RETURNED. Thay MST sau gửi bị chặn để lập đề nghị mới. Sau tiếp nhận, bổ sung tiếp tục đi theo Loan; bản gửi gốc không mở sửa. Chưa đổi ngưỡng 10 tỷ, quyền tín dụng, thuật toán SLA hay ý nghĩa ML.

###### Phạm vi source và dữ liệu

- Backend: `portal.intake-cycle.ts` xác định checklist/dấu vết thay đổi; `portal.intake-workflow.ts` xử lý công bố lần gửi, review, trả sửa, yêu cầu tự xin sửa và vướng mắc. `portal.service.ts`/controller nối vào gửi, tải tài liệu, phân công, đối soát Company, accept và tracking.
- Schema: thêm trạng thái RETURNED, `correction_request`, các bảng `portal_submissions`, `portal_intake_operations`, `portal_intake_issues`; unique/FK bảo vệ liên kết và chống trùng. Kết quả review/return được lưu riêng với snapshot đã gửi. SQL bổ sung tại `backend/prisma/portal-intake-cycle.sql`, không xóa dữ liệu cũ.
- Frontend: `IntakeCyclePanel.tsx`, điều kiện sửa/gửi trong `intake-cycle.ts`, Wizard, quản lý tài liệu, hàng đợi tiếp nhận, phân công và hiển thị trạng thái. Phản hồi bất đồng bộ kiểm tra đúng request/revision/role và tình trạng mount trước cập nhật UI.
- Mở chính sách mô phỏng bằng `PORTAL_V2_INTAKE_ENABLED=true`, `PORTAL_FOUNDATION_PREVIEW=true`, NODE_ENV development/test. Mặc định chưa mở; TEST_ONLY cũ vẫn tách biệt. Các cờ không thay cho việc áp SQL đúng DB trước khi chạy backend mới.
- Đã sinh lại Prisma Client 6.19 từ schema mới; build backend/frontend chuẩn đã đạt. Không sửa quyền máy, dùng client giả hoặc dist cũ để chứng minh luồng cuối.

###### Bằng chứng đã ghi nhận ngày 27/10/2026

| Kiểm chứng | Kết quả | Giới hạn |
| :--- | :--- | :--- |
| Backend hồi quy Portal/phân công/snapshot/policy/bổ sung/tracking và cycle | 118/118 đạt | Unit/contract/service fixture, gồm 11 ca cycle mới; không cộng lại với các tập con. |
| Frontend Portal/client/wizard/cycle/Intake/tracking/bổ sung | 42/42 đạt khi chạy `--test-concurrency=1` | Có một lần client fixture thất bại khi chạy song song; chạy riêng client 6/6 và toàn bộ tuần tự 42/42 đạt. Fixture timeout 100ms chưa thay đổi; không gọi đó là lỗi sản phẩm đã sửa. |
| API/PostgreSQL thật | 90 điểm kiểm tra đạt | Trong schema Docker riêng; gồm tranh chấp review–điều chuyển, gửi/nhận lặp, trả sửa, giữ tệp/snapshot, không lộ nội bộ, chặn Company không phù hợp. |
| SQL nâng cấp | Áp hai lần trên schema cũ giả lập có bản ghi trước nâng cấp; dữ liệu bản ghi đối chiếu giữ nguyên | Chưa áp hoặc kiểm chứng migration trên dữ liệu public thực tế; không suy rộng thành đã kiểm tra mọi dữ liệu cũ. |
| Chrome thực | 11 điểm kiểm tra đạt, không Runtime exception | Gửi, quản lý phân công, CBTD trả sửa, thay PDF trên UI, chọn lại nguồn, gửi lại, kiểm tra và tiếp nhận. Chặn phản hồi review sau khi server commit rồi thử lại: chỉ một thao tác được lưu. |
| Desktop/mobile | Đã quan sát ảnh 1365x1000 và 375x900, Portal mobile không tràn ngang | Không thay thế kiểm thử mọi thiết bị/trình duyệt. |
| Build chuẩn | Backend Nest và frontend TypeScript/Vite đạt; 1627 modules | Không phải bằng chứng đã phát hành. |
| CodeGraph | Build/check đạt, 142 files, 2648 nodes, 5139 edges | Một số lời gọi qua `cycle()` không được graph nối caller; đã đọc call site/controller thủ công, không kết luận code chết. |

Bộ chạy: `backend/scripts/check-portal-intake-cycle.cjs`, `frontend/scripts/check-portal-intake-cycle-browser.mjs`; tận dụng harness chỉ tạo schema `portal_v2_it_*` mới trong PostgreSQL Docker localhost/sme_loan. Các lượt tự động đã dọn schema/tệp sở hữu và giữ 21 tệp upload có sẵn. Một lần bộ giả lập mất phản hồi bị lỗi đã dọn thủ công đúng schema/tệp xác nhận thuộc lượt đó; không để lại dữ liệu thử của lượt lỗi.

Ảnh đợt kiểm chứng cuối: [CBTD trả sửa](../../.codex_tmp/portal-intake-cycle/1793116102957/02-officer-returned.png), [doanh nghiệp nhận yêu cầu sửa](../../.codex_tmp/portal-intake-cycle/1793116102957/03-portal-correction.png), [Portal mobile sau tiếp nhận](../../.codex_tmp/portal-intake-cycle/1793116102957/05-mobile-accepted.png). Đây là artifact cục bộ, không phải tài liệu bàn giao mới.

###### Phiên xem thử cũ và điều kiện phát hành

- Phiên xem thử ngày 27/10/2026 có thời hạn đến 23:18 giờ Việt Nam cùng ngày. Đến ngày cập nhật tài liệu 28/10, phiên đã quá thời hạn; không dùng lại đường dẫn, tài khoản hay mã hồ sơ cũ như một môi trường đang hoạt động. Lượt biên tập này không mở lại phiên hoặc xác minh việc dọn dữ liệu sau khi phiên kết thúc.
- Checkpoint kỹ thuật ngày 27/10 ghi nhận DB dùng chung `sme_loan/public` chưa có `correction_request`; chưa áp SQL mới vào public. Không dùng kết quả kiểm tra ngày 27/10 để khẳng định trạng thái DB hiện tại nếu chưa xác minh lại.
- Trước khi chạy backend mới trên DB dùng chung cần xác minh cấu trúc DB và áp `backend/prisma/portal-intake-cycle.sql` nếu chưa áp, kể cả khi cờ mở Portal còn tắt. Không dùng seed/reset/schema push thay cho kế hoạch nâng cấp đã được kiểm tra.
- Có thể tạo lại phiên bằng build backend rồi chạy `node frontend/scripts/check-portal-intake-cycle-browser.mjs --review` từ root khi Docker PostgreSQL sẵn sàng và quyền tạo/dọn schema thử còn hiệu lực. Không chạy đồng thời hai bộ thử trên cổng 3002/5174. Đây là hướng dẫn cho người triển khai, không yêu cầu PO tự vận hành.
- Không tạo lại các file bàn giao/test BA đã được PO yêu cầu xóa; chỉ cập nhật bàn giao tại HANDOVER_v2.1.md.

</details>

<a id="sla-pa1-next-handover"></a>
##### C.9. Công việc tiếp theo — bàn giao triển khai SLA PA1 cho PO kiêm Dev

**Ngày ghi nhận: 28/10/2026. Trạng thái: đã xác định nội dung cần làm; chưa triển khai PA1.** Lượt này chỉ cập nhật bàn giao. Người nhận dùng các quy tắc đã được PO duyệt dưới đây làm căn cứ thực hiện, không yêu cầu chọn lại PA1 hay tự thêm nghiệp vụ.

###### C.9.1. Mục tiêu và điểm bắt đầu

Hoàn thiện cách đo thời gian xử lý hồ sơ vay theo giờ làm việc, phân biệt đúng lúc chờ doanh nghiệp với lúc ngân hàng kiểm tra. Sau đó đồng bộ kết quả trên các công đoạn, nhắc hạn, đóng quá hạn, chi tiết hồ sơ và Dashboard.

- Điểm bắt đầu là **bộ tính thời gian dùng chung và cách lưu lịch/khoảng tạm dừng**, rồi nối vào các thao tác hiện có. Chưa cần xây một phân hệ quản lý lịch hoặc luồng phê duyệt mới.
- Portal V2 đã có vòng gửi–kiểm tra–trả sửa–gửi lại–tiếp nhận và bằng chứng thử ngày 27/10 tại C.8. Người nhận giữ phần này, kiểm tra hồi quy điểm nối tiếp nhận và chuẩn bị lại phiên cho PO nghiệm thu; không coi phiên thử cũ vẫn hoạt động.
- Tài liệu, kết quả thực hiện, lỗi còn lại và trạng thái nghiệm thu chỉ cập nhật vào HANDOVER_v2.1.md. Không tạo thêm file bàn giao hoặc bộ test BA riêng; test tự động phục vụ việc triển khai vẫn nằm cùng source theo quy ước dự án.

###### C.9.2. Quy tắc nghiệp vụ đã được duyệt — phải giữ nguyên

| Luồng | Quy tắc thực hiện |
| :--- | :--- |
| Giờ làm việc | Thứ Hai–thứ Sáu, 08:00–12:00 và 13:00–17:00 giờ Việt Nam; loại ngày nghỉ theo lịch được xác nhận. Giữ định mức giờ hiện có của từng công đoạn. |
| Bắt đầu/kết thúc công đoạn | SLA hồ sơ vay bắt đầu khi tiếp nhận thành hồ sơ vay. Chuyển bước phải chốt đúng thời gian công đoạn trước. Thời gian doanh nghiệp chờ từ lúc gửi Portal theo dõi riêng, chưa áp thêm định mức mới. |
| Bảo toàn lịch sử | Công đoạn mở trước thời điểm PA1 có hiệu lực giữ cách tính cũ, kể cả có bổ sung đang mở. Công đoạn mở mới sau hiệu lực dùng PA1 và lưu phiên bản lịch/chính sách áp dụng. Không tính lại lịch sử hoặc dựng khoảng dừng từ tổng giờ cũ. |
| Chờ doanh nghiệp | CBTD gửi yêu cầu bổ sung thì dừng SLA. Upload một phần chưa làm chạy lại SLA. Doanh nghiệp chính thức gửi đủ các mục đang được yêu cầu thì SLA chạy trong lúc ngân hàng kiểm tra. |
| Ngân hàng kiểm tra | Đánh dấu từng mục khi còn đang kiểm tra không tự dừng SLA. CBTD hoàn tất lượt kiểm tra và gửi danh sách sửa tổng hợp thì dừng lại để chờ doanh nghiệp. Hoàn tất bổ sung không tính thời gian dừng lần hai. |
| Điều kiện chuyển bước | Hồ sơ đang yêu cầu bổ sung vẫn bị chặn chuyển bước đến khi kiểm tra hoàn tất. Chạy lại SLA không đồng nghĩa hồ sơ đã đủ điều kiện chuyển công đoạn. |
| Nhắc/đóng quá hạn | Giữ mốc nhắc 5 ngày, quá hạn 10 ngày và cách đếm ngày lịch/quy tắc cuối tuần của TK-07. Không reset hạn, tự gia hạn hoặc đóng vì ngân hàng chưa kiểm tra phản hồi đã gửi đủ. Quản lý tiếp tục quyết định đóng thủ công, có lý do và lịch sử. |
| Điều chuyển/thử lại | Điều chuyển CBTD không xóa thời gian đã dùng hoặc tự dừng SLA. Thao tác lặp/mất phản hồi không tạo khoảng dừng trùng. Số lượt bổ sung tăng theo lượt yêu cầu, không theo số tệp, phản hồi hay lượt trả sửa. |
| Dữ liệu, quyền và ML | Giữ vòng vay, quyền vai trò, ngưỡng phê duyệt, dữ liệu doanh nghiệp và lịch sử hiện có. ML chỉ cảnh báo trễ SLA; chưa có dự báo tương thích PA1 thì hiển thị rõ chưa có, không tạo xác suất giả hoặc tự huấn luyện/ghi đè model. Không tự thêm lần gọi ML chỉ vì doanh nghiệp phản hồi. |

###### C.9.3. Cấu hình đợt nghiệm thu đề xuất — cần PO xác nhận trước khi kích hoạt

**PA1 và các quy tắc C.9.2 đã có phê duyệt. Lịch mô phỏng cụ thể dưới đây mới là đề xuất; việc ghi vào bàn giao không tự biến thành cấu hình đã được PO duyệt hoặc đã có hiệu lực.** Có thể xây dựng bộ tính và kiểm thử logic theo quy tắc đã duyệt trong khi chờ chốt cấu hình kích hoạt.

| Nội dung | Đề xuất cho đợt nghiệm thu |
| :--- | :--- |
| Môi trường | Docker PostgreSQL trên máy phát triển, database `sme_loan`, schema thử mới theo cơ chế `portal_v2_it_*` đã có. Chỉ tạo/dọn dữ liệu mô phỏng và tệp thuộc lượt thử; xác minh lại đúng đích trước thao tác. |
| Lịch thử | Lịch mô phỏng phiên bản 1, bao phủ 26/10–08/11/2026, dùng khung giờ C.9.2; ngoài cuối tuần, đặt **30/10/2026 là ngày nghỉ giả lập** để kiểm tra ngày nghỉ nối cuối tuần. Không gọi đây là lịch nghỉ chính thức của ngân hàng. |
| Hiệu lực | Ghi nhận mốc **T0 khi kích hoạt PA1 trên phiên thử**, không hồi tố. Công đoạn mở trước T0 giữ cách tính cũ; công đoạn mở từ T0 dùng PA1, bao gồm công đoạn mới trên hồ sơ cũ. |
| Ngoài kỳ lịch | Khoảng ngày trên là dữ liệu nghiệm thu cố định. Nếu phiên thao tác thực tế nằm ngoài kỳ bao phủ, trình phiên bản lịch thử kế tiếp trước khi kích hoạt; không tự thay lịch đã áp dụng hoặc quay về tính 24/7. |
| Môi trường chung | Chưa tự áp SQL vào schema `public` hoặc mở dùng chung. Sau kiểm chứng phải trình đích DB, thay đổi dữ liệu, cách khôi phục, phạm vi người dùng và thời điểm mở để quyết định bước phát hành. |

###### C.9.4. Thứ tự triển khai và đầu ra từng mốc

| Mốc | Nội dung cần hoàn thành | Đầu ra để kiểm tra/nghiệm thu |
| :--- | :--- | :--- |
| **1 — Tính đúng thời gian** | Dùng một bộ tính cho giờ làm việc và các khoảng dừng; lưu phiên bản lịch/chính sách của công đoạn; nối vào tiếp nhận, chuyển bước và kết thúc công đoạn. Chỉ loại phần thời gian dừng giao với giờ làm việc, tránh trừ giờ nghỉ hai lần. | Tính đúng nghỉ trưa, cuối tuần, ngày nghỉ, khoảng dừng đang mở/đã kết thúc và giá trị 0 giờ thực. Công đoạn cũ giữ kết quả cũ; điều chuyển không đặt lại đồng hồ. |
| **2 — Đúng trách nhiệm chờ** | Nối bộ tính vào yêu cầu bổ sung, phản hồi đủ, kiểm tra, trả sửa tổng hợp và hoàn tất; đồng bộ nhắc hạn/đánh dấu quá hạn/đóng quá hạn. | Cùng hồ sơ đi được trọn vòng chờ doanh nghiệp → ngân hàng kiểm tra → trả sửa hoặc hoàn tất. Không dừng/chạy trùng khi thao tác lặp, không chuyển bước sớm hoặc đóng do ngân hàng chậm xem phản hồi. |
| **3 — Hiển thị và nghiệm thu toàn luồng** | Đồng bộ chi tiết hồ sơ và Dashboard; phân biệt cách tính cũ/PA1, thời gian xử lý với thời gian chờ; kiểm tra khả năng sử dụng dự báo ML. Chạy hồi quy Portal và quy trình vay trên API/DB/trình duyệt. | Người dùng thấy đúng thời gian/định mức, đang chờ ai và tình trạng dự báo. Có hồ sơ mẫu để PO trực tiếp đánh giá, kết quả kiểm tra và giới hạn còn lại; chưa gọi là đã phát hành khi mới đạt trên schema thử. |

Mỗi mốc phải có kiểm tra hành vi và hồi quy liên quan; không chỉ hoàn thiện màn hình hoặc đổi nhãn SLA. Dùng lại bộ chạy môi trường thử hiện có nếu phù hợp, không viết lại phần Portal đã đạt chỉ để triển khai PA1.

###### C.9.5. Những tình huống bắt buộc phải chứng minh

1. **Nghỉ trưa:** cùng một ngày làm việc không nghỉ, từ 11:00 đến 14:00, không có khoảng dừng khác, tính **2 giờ**.
2. **Ngày nghỉ nối cuối tuần:** theo lịch mô phỏng đề xuất, từ 16:00 ngày 29/10 đến 09:00 ngày 02/11/2026, không có khoảng dừng khác, tính **2 giờ**. Đây là tình huống kiểm thử cố định, không thay đồng hồ hệ thống để giả vận hành.
3. **Bổ sung:** tạo yêu cầu thì dừng; tải một tệp vẫn dừng; gửi chính thức đủ thì chạy; ngân hàng kiểm tra vẫn tính giờ; gửi danh sách sửa tổng hợp thì dừng mới; hoàn tất không trừ thời gian lần hai.
4. **Chặn đúng nghiệp vụ:** đang yêu cầu bổ sung vẫn không chuyển bước; phản hồi đủ chờ ngân hàng kiểm tra không bị nhắc thiếu/đóng chỉ vì cán bộ chưa kiểm tra. Giữ đúng dấu vết nộp muộn và hạn 5/10 ngày.
5. **Lịch sử/đồng thời:** công đoạn cũ trước T0 giữ cách tính cũ; công đoạn mới sau T0 dùng PA1. Gửi lặp, mất phản hồi, điều chuyển hoặc thao tác đồng thời không làm mất thời gian hoặc tạo hai khoảng dừng đang mở.
6. **Thông tin người dùng:** chi tiết và Dashboard khớp nhau; phân biệt thời gian chờ với thời gian xử lý, cách tính cũ với PA1; dự báo chưa tương thích được thể hiện rõ. Vòng Portal và dữ liệu doanh nghiệp cũ không bị ảnh hưởng ngoài phạm vi được duyệt.

###### C.9.6. Cách người nhận tiếp tục công việc và trình kết quả

- Đọc hướng dẫn dự án `.agents/AGENTS.md`, `Project.md` và phần C trước khi sửa. Kiểm tra lại source/môi trường thực tế; dùng CodeGraph theo quy định khi phân tích/sửa code. C.8 là bằng chứng đợt trước, không thay kết quả kiểm chứng mới.
- Truy vết các điểm dùng SLA trong luồng vay, bổ sung, nhắc hạn, đóng quá hạn, Dashboard và dự báo trước khi đổi; thực hiện xuyên suốt phần được giao. Chưa tự đặt thêm hạn kiểm tra nội bộ, quyền gia hạn, luồng phê duyệt hoặc mô hình dự báo mới.
- Kiểm thử có ghi dữ liệu dùng đúng schema Docker riêng đã được cho phép; xác minh quyền sở hữu trước dọn. Trước chạy API phải bảo đảm cấu trúc DB, Prisma Client và bản build khớp mã nguồn mới. Không dùng dữ liệu/bản chạy cũ để kết luận bản mới đã đạt.
- Nếu phát hiện xung đột nghiệp vụ hoặc cần vượt phạm vi, báo ngay: tình huống, ảnh hưởng, bằng chứng và phương án đề xuất. Dừng phần phụ thuộc quyết định đó, tiếp tục phần độc lập đã được giao; không xin duyệt lặp quy tắc đã có.
- Bàn giao bằng hồ sơ thao tác được: Portal → tiếp nhận → bổ sung/trả sửa → chuyển bước → hoàn tất hoặc quản lý đóng quá hạn. Ghi tại file này: mốc nào đã làm, môi trường, kết quả thật, lỗi/giới hạn, lịch và T0 thực tế, cách mở phiên PO xem thử và việc dọn dữ liệu. PO giữ quyền nghiệm thu cuối.

###### C.9.7. Mẫu lời giao việc để PO gửi khi tiếp tục triển khai

Nội dung dưới đây là **mẫu để PO xem và gửi**, chưa được coi là lệnh đã thực thi trong lượt cập nhật tài liệu này. Câu xác nhận lịch mô phỏng chỉ có hiệu lực khi PO thực sự gửi/chấp thuận.

> Bạn tiếp nhận vai trò PO kiêm Dev cho SME Loan Workflow. Đọc HANDOVER_v2.1.md, mục C.9 và hướng dẫn dự án, rồi triển khai SLA PA1 theo ba mốc: tính đúng thời gian → đúng trách nhiệm chờ bổ sung → đồng bộ hiển thị và nghiệm thu toàn luồng.
>
> Tôi đồng ý dùng lịch mô phỏng 26/10–08/11/2026, thứ Hai–thứ Sáu 08:00–12:00 và 13:00–17:00 giờ Việt Nam; ngày 30/10 là ngày nghỉ giả lập chỉ để nghiệm thu. Ghi T0 lúc kích hoạt trên phiên thử; công đoạn cũ giữ cách tính cũ, công đoạn mới từ T0 dùng PA1. Nếu lịch không còn bao phủ thời gian thao tác thực tế, trình lịch thử kế tiếp trước khi bật.
>
> Kiểm thử trên Docker PostgreSQL `sme_loan`, schema thử riêng `portal_v2_it_*`, chỉ tạo/dọn dữ liệu mô phỏng và tệp thuộc lượt thử. Giữ nguyên vòng Portal đã có, quyền xử lý, ngưỡng phê duyệt, định mức SLA và hạn bổ sung 5/10 ngày; không tự thêm nghiệp vụ hoặc thay đổi model ML.
>
> Hoàn thành kiểm tra các tình huống tại C.9.5, chuẩn bị hồ sơ để tôi thao tác nghiệm thu và cập nhật kết quả đúng vào HANDOVER_v2.1.md. Chưa tự áp thay đổi vào dữ liệu dùng chung/phát hành. Nếu có lỗi logic hoặc cần vượt phạm vi, báo ngay kèm ảnh hưởng và phương án. Tôi giữ quyền nghiệm thu cuối.

###### C.9.8. Tiến độ triển khai (cập nhật 30/10/2026)

**Trạng thái: cả ba mốc đã làm và đã kiểm chứng trên schema thử; PO báo đã thao tác phiên nghiệm thu ngày 30/10/2026 và các bước kiểm tra đạt; ngày 30/10/2026 đã nâng cấp hệ thống dùng chung (DB và bản build) theo hướng A: **PA1 chưa được bật** (mốc T0 chưa ghi), mọi công đoạn vẫn tính theo cách cũ. Nghiệm thu chính thức và quyết định bật PA1 do PO.**

| Hạng mục mốc 1 | Kết quả | Bằng chứng |
| :--- | :--- | :--- |
| Bộ tính giờ làm việc dùng chung | Có. T2–T6, 08–12 và 13–17 giờ VN, ngày nghỉ theo lịch có phiên bản; chỉ loại phần dừng giao với giờ làm việc, gộp các khoảng dừng chồng nhau; khoảng ngoài kỳ lịch bị từ chối, không tính 24/7. File `backend/src/modules/workflow/sla/working-time.ts` | `backend/test/sla-working-time.test.cjs`: 11/11 (gồm nghỉ trưa 11:00→14:00 = 2 giờ; 16:00 29/10 → 09:00 02/11 = 2 giờ) |
| Lịch mô phỏng v1 | 26/10–08/11/2026, 30/10 nghỉ giả lập, được cài trong code với tên phiên bản; không phải lịch chính thức | Cùng bộ test trên |
| Lưu cách tính và phiên bản lịch trên công đoạn | Có: cột `sla_policy`, `sla_calendar_version` trên `application_stage_history` (null = cách tính cũ) | Kiểm chứng DB bên dưới |
| Mốc T0 | Có bảng `sla_policy_activations`: công đoạn mở từ T0 dùng PA1, công đoạn mở trước giữ cách cũ, kể cả công đoạn mới của hồ sơ cũ. **Chưa có API hay giao diện ghi T0**; hiện chỉ ghi được trực tiếp vào DB | Kiểm chứng DB bên dưới |
| Bảng khoảng tạm dừng | Có bảng `application_stage_pauses` và chỉ mục chặn hai khoảng dừng cùng mở trên một công đoạn. **Chưa có thao tác nào ghi vào bảng này** (thuộc mốc 2) | Kiểm chứng DB bên dưới |
| Nối vào luồng | Chốt cách tính khi mở công đoạn ở: tạo hồ sơ trực tiếp, tiếp nhận từ Portal, chuyển bước. Đóng công đoạn (chuyển bước, đóng quá hạn) dùng bộ tính chung; nhánh cách cũ giữ nguyên công thức. Điều chuyển CBTD không đụng đồng hồ. Thêm tham số đồng hồ tùy chọn cho `transitionStage`, `create`, `accept` để kiểm thử dùng thời điểm cố định | Kiểm chứng DB bên dưới |
| Tệp SQL nâng cấp | `backend/prisma/sla-pa1.sql`, cộng thêm, chạy lặp được. **Chưa áp vào schema `public`.** | Kiểm chứng DB bên dưới |

**Mốc 2 — vòng bổ sung (30/10/2026):**

| Quy tắc C.9.2 / C.9.5 | Cách triển khai |
| :--- | :--- |
| Gửi yêu cầu bổ sung thì dừng | Tạo yêu cầu mở một khoảng dừng PA1 (`application_stage_pauses`); gọi lặp không tạo khoảng thứ hai. Công đoạn cách cũ giữ `pausedAt` như trước, không có dòng khoảng dừng |
| Tải một phần chưa chạy lại SLA | Không đổi gì khi tải tệp |
| Doanh nghiệp chính thức gửi đủ thì chạy | Khi `respond` thành công, khoảng dừng được đóng; gửi lặp cùng mã thao tác không đổi gì |
| Ngân hàng kiểm tra vẫn tính giờ | Đánh dấu từng mục không dừng SLA |
| Gửi danh sách sửa tổng hợp thì dừng mới | Thao tác mới `POST /supplements/:id/return` của CBTD (Thẩm quyền ở công đoạn sau): chỉ cho phép khi không còn mục chờ kiểm tra và có mục cần sửa; mở khoảng dừng mới, ghi sự kiện `RETURNED`; không đổi quy tắc tải lại tệp của Portal. Nút "Gửi danh sách sửa cho doanh nghiệp" trong `SupplementPanel` |
| Hoàn tất bổ sung không tính dừng lần hai | Công đoạn PA1: hoàn tất chỉ đóng khoảng dừng nếu còn mở, không cộng giờ dừng cũ |
| Không nhắc/đóng chỉ vì ngân hàng chưa kiểm tra | `waitingOn()` phân biệt chờ doanh nghiệp / chờ ngân hàng. Bộ nhắc 5/10 ngày bỏ qua yêu cầu doanh nghiệp đã gửi đủ; `closeOverdueSupplement` từ chối khi không còn yêu cầu quá hạn thuộc phần doanh nghiệp. Dấu vết quá hạn đã ghi được giữ, hạn gốc không bị reset. API danh sách quá hạn của Dashboard trả thêm `waitingOn` |
| Điều chuyển, thao tác lặp, đồng thời | Điều chuyển không đụng đồng hồ. Mã thao tác chống gửi lặp; hai lần "gửi danh sách sửa" đồng thời chỉ một lần thành công |

Sửa lỗi liên quan ghi ở báo cáo rà soát: nhắc và đóng quá hạn trước đây không phân biệt doanh nghiệp đã gửi đủ. Hai test cũ được cập nhật theo thay đổi: `close-overdue.test.cjs` (mock giao dịch bổ sung hai bảng mới, giữ nguyên mọi khẳng định) và `overdue-supplements.test.cjs` (kỳ vọng có thêm trường `waitingOn`).

**Mốc 3 — hiển thị, Dashboard, dự báo, phiên nghiệm thu (30/10/2026):**

| Nội dung | Cách triển khai |
| :--- | :--- |
| Dự báo ML cho công đoạn PA1 | `PredictionService` không gọi ML và không lưu gì khi công đoạn Tiếp nhận của hồ sơ tính theo PA1 (đặc trưng thời gian tiếp nhận khác nghĩa với dữ liệu huấn luyện); trả `{unavailable, reason: PA1_INCOMPATIBLE}`. Hồ sơ có công đoạn Tiếp nhận tính cách cũ vẫn được dự báo như trước, kể cả khi các công đoạn sau tính PA1. Không đổi model |
| Tình trạng dự báo | Danh sách và chi tiết hồ sơ trả `predictionStatus` (`AVAILABLE`, `INCOMPATIBLE_PA1`, `NONE`); giao diện hiển thị "Chưa có dự báo tương thích PA1" hoặc "Chưa dự báo". **Thay đổi hành vi nhỏ:** Dashboard "cảnh báo sớm" trước đây tự điền mức THẤP 5% cho hồ sơ chưa có dự báo; nay để trống và nêu tình trạng (trái yêu cầu không tạo xác suất giả) |
| Chi tiết hồ sơ | `slaState` (cách tính của công đoạn đang mở, chờ ai, đồng hồ chạy hay dừng) và `liveSla` (số giờ làm việc tính tại thời điểm xem cho công đoạn PA1 đang mở; ngoài kỳ lịch trả thông báo lỗi thay vì số). Bảng công đoạn có cột "Cách tính" và ghi chú nghĩa các cột theo từng cách tính; nhãn trạng thái nêu "đang chờ doanh nghiệp, SLA tạm dừng" hoặc "ngân hàng đang kiểm tra, SLA đang chạy" |
| Dashboard | Số liệu cách cũ (giờ thực) và PA1 (giờ làm việc) tách riêng, không cộng chung: tỷ lệ đúng hạn, điểm nghẽn theo công đoạn. Các trường cũ nay chỉ gồm công đoạn cách cũ (trùng giá trị trước đây khi chưa có công đoạn PA1). Danh sách quá hạn có cột "Bên đang chờ" |
| Phiên nghiệm thu | `backend/scripts/sla-pa1-session.cjs` (`npm --prefix backend run session:sla-pa1`): dựng schema thử riêng, ghi T0 = 08:00 ngày 26/10/2026, tạo 8 hồ sơ mẫu ở các trạng thái khác nhau, mở API cổng 3002 (cổng nền) và giao diện trên **cổng 5173 như hệ thống** (đổi bằng `--web-port=N`), in tài khoản mô phỏng và hướng dẫn thử cho từng hồ sơ, có hạn dùng (mặc định 60 phút, đổi bằng `--minutes=N`), tự xóa schema và tệp tải lên khi hết hạn hoặc nhấn Ctrl+C |

**Cách mở phiên nghiệm thu:** đặt `DATABASE_URL` trỏ `localhost` (cùng cơ sở dữ liệu Docker `sme_loan`; thay tên dịch vụ `db` bằng `localhost`), chạy `npm --prefix backend run build` rồi `npm --prefix backend run session:sla-pa1`, đợi dòng `sessionReady`, mở http://localhost:5173 (nhân viên) và http://localhost:5173/portal (doanh nghiệp, tài khoản `dn.sla@example.test`). Mật khẩu mô phỏng được in trong kết quả của lệnh. Cổng 5173 đang do container giao diện Docker giữ (bản cũ, chưa có PA1): chạy `docker compose stop frontend` trước khi mở phiên (bộ chạy từ chối và không tạo gì nếu cổng còn bận), và **bật lại sau phiên bằng `docker compose start frontend`**. Không chạy cùng lúc với bộ kiểm chứng khác dùng cổng 3002/5174. Thao tác trong phiên dùng giờ thật; hồ sơ mẫu có mốc thời gian cố định trong kỳ lịch. Hồ sơ mẫu S8 chỉ quá hạn từ 10:00 ngày 05/11/2026. Từ ngày 09/11/2026 lịch mô phỏng hết hiệu lực nên cần trình lịch kế tiếp trước khi nghiệm thu thêm.

**Kiểm chứng DB (PostgreSQL Docker, schema thử `portal_v2_it_*`, đã tự xóa sau khi chạy):** `backend/scripts/check-sla-pa1.cjs`, 109 điểm kiểm tra đạt (mốc 1, 2 và 3), gồm vòng bổ sung đầy đủ (dừng, tải một phần, gửi đủ, kiểm tra, trả sửa, gửi lại, hoàn tất: giờ thực 11, dừng 5, ròng 6), gửi lặp, hai lần trả sửa đồng thời, bổ sung nhập tay trên công đoạn PA1, công đoạn cũ có bổ sung sau T0 giữ đúng giờ thực, nhắc ngày 5 và quá hạn ngày 10 chỉ áp cho bên doanh nghiệp, đóng quá hạn (58 giờ làm việc, ròng 1), chi tiết hồ sơ (chờ ai, số giờ đang chạy), quy tắc ML trên dịch vụ thật (bỏ qua với PA1, vẫn gọi với hồ sơ cách cũ), Dashboard tách số liệu, danh sách quá hạn có bên đang chờ, và các mục mốc 1: công đoạn mở trước T0 giữ kết quả cũ (193 giờ thực); công đoạn mới sau T0 dùng PA1; hai tình huống C.9.5(1) và C.9.5(2) tính đúng 2 giờ; giá trị 0 giờ thực; điều chuyển giữ nguyên thời gian đã dùng; thao tác ngoài kỳ lịch bị từ chối và dữ liệu không đổi; SQL nâng cấp áp hai lần giữ nguyên dữ liệu cũ và chặn hai khoảng dừng cùng mở. Hồi quy: backend 206/206 (`node --test backend/test/*.test.cjs`; lệnh `test:portal` chỉ chạy một tập con nên không đại diện), frontend 12 bộ test liên quan đạt, vòng Portal V2 90/90 qua API/DB và 11 điểm trên Chrome thật (`check-portal-intake-cycle-browser.mjs`, không có lỗi runtime), build backend và frontend sạch, CodeGraph đạt. Phiên nghiệm thu đã chạy thử 2 phút: đăng nhập 4 vai trò và Portal, trạng thái từng hồ sơ mẫu, gửi danh sách sửa, đóng hồ sơ quá hạn (S5 thành công; S6 do doanh nghiệp đã gửi đủ và S8 chưa tới hạn bị từ chối), rồi tự dọn sạch (0 schema sót, không còn tiến trình nghe). Số 79/79 ghi trước đó chỉ là tập con của `test:portal`. Ghi chú chạy: máy này không có `backend/.env`; bộ thử nhận `DATABASE_URL` từ biến môi trường và vẫn chỉ chạy với `localhost`/`sme_loan` (dùng `localhost` thay cho tên dịch vụ `db`).

**Chưa làm và giới hạn:**
- **Nghiệm thu:** PO báo kết quả thao tác trên phiên nghiệm thu là đạt (30/10/2026), chưa nêu chi tiết từng tình huống. Các màn PA1 do tôi (bên triển khai) chỉ kiểm chứng qua API và test giao diện; Chrome thật mới chạy hồi quy vòng Portal. Nghiệm thu chính thức theo C.9.5 và quyết định phát hành vẫn thuộc PO.
- **Chưa kích hoạt T0 (chưa bật PA1) ở môi trường dùng chung.** Hệ thống dùng chung đã được nâng cấp cấu trúc DB và bản build ngày 30/10/2026 (xem C.9.9); để bật PA1 cần: chốt lịch (chính thức hoặc chấp nhận lịch mô phỏng), quyết định thời điểm T0, và ghi một dòng vào `sla_policy_activations` (chưa có API hay giao diện, theo phạm vi C.9.3).
- Lịch mô phỏng chỉ phủ 26/10–08/11/2026 và là dữ liệu cài trong code (`SIMULATED_CALENDAR_V1`), không phải lịch nghỉ chính thức. Không có phân hệ quản lý lịch (đúng C.9.1).
- Với công đoạn PA1, các cột `actualDurationHours`, `pausedDurationHours`, `netWorkDurationHours` mang nghĩa giờ làm việc; `pausedDurationHours` của công đoạn PA1 là phần thời gian chờ doanh nghiệp nằm trong giờ làm việc.
- Hồ sơ có công đoạn Tiếp nhận tính PA1 sẽ không có dự báo ML cho đến khi có mô hình tương thích; đây là lựa chọn theo C.9.2, không phải lỗi.
- Khi PA1 đang hiệu lực mà thời điểm thao tác nằm ngoài kỳ bao phủ của lịch, tạo hồ sơ và chuyển bước bị từ chối (đúng yêu cầu không quay về 24/7); cần trình lịch kế tiếp.

###### C.9.9. Phát hành lên môi trường dùng chung: hướng A đã thực hiện ngày 30/10/2026; bật PA1 chờ PO

**Hiện trạng đọc ngày 30/10/2026 (chỉ đọc, không ghi):** DB `sme_loan`, schema `public` trong container `smesystem-db-1` có 4 hồ sơ vay (Cấp trên chờ duyệt 1, Hoàn tất đã duyệt 1, Thẩm định 1, Tiếp nhận đang chờ bổ sung 1), **0 dòng** lịch sử công đoạn, 1 yêu cầu bổ sung đang chờ, 2 đề nghị Portal ở trạng thái nháp, 4 người dùng. Chưa có các bảng `application_stage_pauses`, `sla_policy_activations`, `portal_submissions`, `portal_intake_operations`, `portal_intake_issues` và các cột `application_stage_history.sla_policy`, `sla_calendar_version`, `portal_requests.correction_request`; giá trị `RETURNED` của enum `PortalRequestStatus` đã có sẵn (SQL dùng `IF NOT EXISTS` nên chạy được). Image backend tạo ngày 26/10 và image frontend tạo 4 ngày trước, nên chưa có mã nguồn của PR #6, #7 và PA1.

| Mục | Đề xuất cho PO quyết |
| :--- | :--- |
| Đích DB | Docker PostgreSQL `sme_loan`, schema `public`. Xác minh lại đúng đích (`select current_database()`, tên container, `schema=public`) ngay trước thao tác |
| Thay đổi dữ liệu | Áp theo thứ tự hai tệp SQL **chỉ cộng thêm**: `backend/prisma/portal-intake-cycle.sql` rồi `backend/prisma/sla-pa1.sql` (thêm bảng/cột mới, không xóa hay sửa dữ liệu cũ, chạy lặp được; đã kiểm chứng trên schema thử). Sinh lại Prisma Client, build lại image backend và frontend. **Không** seed, **không** `prisma db push`. Chưa ghi T0 ở bước này |
| Sao lưu và khôi phục | Trước khi áp: `pg_dump -Fc` toàn bộ `sme_loan` ra tệp có ngày giờ. Khôi phục: dừng backend, đưa lại image cũ (code cũ vẫn chạy với DB đã nâng cấp vì SQL chỉ cộng thêm); muốn gỡ hẳn thì xóa các bảng/cột PA1 (và bảng Portal V2 nếu chưa phát sinh dữ liệu) hoặc `pg_restore` từ bản sao lưu. **Chưa thử khôi phục trên dữ liệu thật** |
| Phạm vi người dùng | Cả bốn vai trò nội bộ và Portal dùng chung một bản. Khi chưa ghi T0, mọi công đoạn vẫn tính theo cách cũ, nên việc áp bản mới chưa đổi cách tính của ai |
| Thời điểm | PO quyết. Đề xuất ngoài giờ làm việc và tách hai bước: (1) nâng cấp DB và build, rồi kiểm tra; (2) ghi T0 sau khi kiểm tra đạt |
| Kích hoạt PA1 (T0) | Cần lịch chính thức, hoặc PO chấp nhận dùng lịch mô phỏng cho đồ án. Lịch mô phỏng chỉ phủ đến 08/11/2026; quá kỳ này tạo hồ sơ và chuyển bước của công đoạn PA1 bị từ chối. Ghi T0 bằng một dòng vào `sla_policy_activations`; chưa có API hay giao diện (theo phạm vi C.9.3) |
| Kiểm tra sau khi áp | Kiểm tra sức khỏe backend; đăng nhập 4 vai trò và Portal; Dashboard mở được; một hồ sơ thử đi qua tiếp nhận và chuyển bước theo cách cũ. Sau khi ghi T0: hồ sơ mới mở công đoạn PA1 và hiển thị đúng |
| Ảnh hưởng đã biết | (1) Bản build mới mang theo các thay đổi của PR #6/#7 (phân quyền Thẩm quyền, đóng quá hạn, theo dõi Portal, vòng Portal V2 dưới cờ tính năng mặc định tắt). (2) Dashboard "cảnh báo sớm" không còn điền mức THẤP 5% cho hồ sơ chưa có dự báo. (3) Giao diện Docker cũ không có PA1 cho tới khi build lại. (4) Hồ sơ hiện có chưa có lịch sử công đoạn nên không có số giờ để chuyển đổi hay tính lại |

**PO cần quyết:** (a) đồng ý phát hành hay giữ ở schema thử; (b) thời điểm áp nâng cấp DB; (c) dùng lịch mô phỏng hay cung cấp lịch chính thức, và thời điểm ghi T0. Việc ghi lịch sử vẫn theo nguyên tắc: không thay đổi dữ liệu dùng chung khi PO chưa duyệt.

**Kết quả thực hiện hướng A (nâng cấp, chưa bật PA1) — 30/10/2026:**

| Bước | Kết quả |
| :--- | :--- |
| Dọn phiên nghiệm thu | Dừng phiên, xóa schema thử và tệp tải lên do phiên tạo (0 schema sót) |
| Xác minh đích | `sme_loan`, schema `public`, container `smesystem-db-1`, PostgreSQL 16.14 |
| Sao lưu | `C:\Users\Yen Trang\sme_backups\sme_loan-truoc-PA1-20261030-214256.dump` (50.775 byte, SHA-256 `69caaa7685d3b23e128af1cfca38d9387dfb8515006cb6ac2ff7aa0fbb475794`, khớp giữa container và máy; đọc được 104 mục, 16 bảng dữ liệu). **Chưa thử khôi phục trên dữ liệu thật** |
| Nâng cấp DB | `portal-intake-cycle.sql` rồi `sla-pa1.sql` qua `psql` với dừng khi có lỗi; cả hai thành công. Thêm 5 bảng (`portal_submissions`, `portal_intake_operations`, `portal_intake_issues`, `application_stage_pauses`, `sla_policy_activations`), cột `sla_policy`, `sla_calendar_version`, `correction_request` và chỉ mục chặn hai khoảng dừng cùng mở. So số dòng 16 bảng cũ trước và sau: **không bảng nào đổi** |
| Dựng lại ứng dụng | Build lại image backend và frontend (`docker compose up -d --build --no-deps backend frontend`); không động tới db, ml-service, mailpit. Không seed, không `prisma db push` |
| PA1 | `sla_policy_activations` có 0 dòng nên **chưa có T0**: mọi công đoạn vẫn tính theo cách cũ |
| Kiểm tra sau nâng cấp (chỉ đọc) | Sức khỏe backend; đăng nhập 4 vai trò nhân viên và Portal; danh sách và chi tiết 4 hồ sơ (cách tính cũ, trạng thái dự báo đúng); Thẩm quyền chỉ thấy 3 hồ sơ từ Thẩm định trở đi; 4 API Dashboard; Admin gọi API hồ sơ bị chặn 403; Chrome thật đăng nhập 3 vai trò, không lỗi runtime; số dòng các bảng không đổi sau kiểm tra. **Không tạo hồ sơ thử trên dữ liệu dùng chung** nên chưa kiểm chứng đường tạo hồ sơ và chuyển bước trên dữ liệu thật sau nâng cấp (đã kiểm chứng trên schema thử) |

**Khôi phục nếu cần:** dừng backend; chép tệp sao lưu vào container; `pg_restore -U sme_user -d sme_loan --clean --if-exists <tệp>`; dựng lại backend và frontend từ commit trước khi nâng cấp. Vì hai tệp SQL chỉ cộng thêm nên bản code cũ vẫn chạy được trên DB đã nâng cấp nếu chỉ cần quay lại bản build.

**Còn chờ PO:** có bật PA1 không; lịch dùng (mô phỏng hoặc chính thức); thời điểm T0. Lưu ý lịch mô phỏng hết hiệu lực sau 08/11/2026: nếu bật PA1 bằng lịch này, từ 09/11 tạo hồ sơ và chuyển bước của công đoạn PA1 bị từ chối.

---

### 3. AI WORKING RULES (NGUYÊN TẮC LÀM VIỆC VỚI AI HỖ TRỢ)

Thành viên tiếp nhận khi sử dụng AI trợ lý (Antigravity / Codex) để lập trình bắt buộc phải tuân thủ nghiêm ngặt 7 nguyên tắc sau:

1. **Đọc tài liệu và Source code trước khi sửa:** AI phải đọc kỹ các file liên quan và kiểm tra CodeGraph (`npm run graph:check`) trước khi đề xuất bất kỳ dòng code nào. Không được sửa code dựa trên suy đoán.
2. **Không tự phát minh Business Rule:** Tuyệt đối không để AI tự đặt ra các quy định nghiệp vụ mới ngoài phạm vi tài liệu hoặc các quyết định đã được PO phê duyệt.
3. **Không tự thay nghiệp vụ hoặc mở tính năng chưa nghiệm thu:** TK-05/TK-11 đã có quyết định, còn triển khai và kiểm chứng; không xin chọn lại hoặc bật cờ thay cho hoàn thiện chức năng.
4. **Một task tại một thời điểm:** Không yêu cầu AI triển khai nhiều task cùng lúc. Thực hiện dứt điểm từng task theo đúng thứ tự ưu tiên.
5. **Phân tích ảnh hưởng toàn diện (SME-AI-012):** Trước khi sửa bất kỳ module nào, AI phải phân tích ảnh hưởng theo chiều ngang (các tính năng liên quan) và chiều sâu đệ quy (Frontend <-> Backend API <-> Prisma Schema/Database).
6. **Không sửa module ngoài phạm vi:** Tuyệt đối không chạm vào các module nhạy cảm như `workflow.service.ts` hay `schema.prisma` nếu task đang làm không yêu cầu trực tiếp.
7. **Bảo vệ an toàn dữ liệu:** Nghiêm cấm AI chạy các script có nguy cơ ghi/xóa database (`check-*`, `seed.js`) trên môi trường có dữ liệu thực tế.

---

### 4. GIT COLLABORATION (QUY TRÌNH PHỐI HỢP MÃ NGUỒN GIT)

Nhằm bảo vệ mã nguồn và tránh xung đột code, quy trình Git được chuẩn hóa như sau:

1. **Quy tắc tạo Branch:**
   - Luôn kiểm tra working tree trước khi bắt đầu: `git status`.
   - Tạo nhánh mới từ commit bàn giao được thống nhất (`695d006`):
     ```bash
     git checkout -b feature/<task-id>-<short-description>
     # Ví dụ: git checkout -b feature/TK-02-fix-sla-navigation
     ```
2. **Không commit trực tiếp lên nhánh chung:** Tuyệt đối không commit hoặc push thẳng lên nhánh `LeThiYenNhi` hoặc nhánh `main` khi chưa hoàn thành kiểm thử.
3. **Chuẩn hóa Commit Message:** Mỗi task nên có các commit rõ ràng, mang tính nguyên tử (atomic commit):
   ```
   feat(admin): add navigation route for sla configuration (TK-02)
   fix(auth): add change password modal on navbar (TK-10)
   ```
4. **Quy trình Merge / Pull Request:**
   - Chỉ merge vào nhánh chính khi task đã đạt đầy đủ tiêu chuẩn hoàn thành (Definition of Done).
   - Tuyệt đối không dùng `git push --force` hoặc tự ý ghi đè code của thành viên khác.
5. **Kiểm tra trạng thái Working Tree trước khi bàn giao:** Luôn đảm bảo working tree sạch sẽ (`git status` báo clean) trước khi chuyển giao phiên làm việc.

---

### 5. DEFINITION OF DONE (TIÊU CHUẨN HOÀN THÀNH CÔNG VIỆC)

Một task công việc chỉ được coi là hoàn thành (`DONE`) khi và chỉ khi thỏa mãn đầy đủ 6 tiêu chuẩn sau:

1. **Đạt chuẩn Nghiệp vụ & AC:** Đáp ứng 100% các tiêu chí Acceptance Criteria đã được định nghĩa trong task.
2. **Chất lượng Mã nguồn:** Code viết rõ ràng, không có lỗi linter, không có lỗi TypeCheck TypeScript (`npm run build` pass).
3. **Kiểm thử tự động:** Các unit test hoặc integration test liên quan trực tiếp đến task đã chạy và pass.
4. **Không gây Regression:** Kiểm thử lại các luồng nghiệp vụ liền kề, đảm bảo không làm gãy các chức năng sẵn có (ví dụ: sửa auth không làm hỏng đăng nhập).
5. **Bằng chứng kiểm thử cụ thể:** Cung cấp đầy đủ bằng chứng kiểm thử (Terminal test output pass, Network log HTTP 200, hoặc ảnh chụp màn hình UI hoạt động).
6. **Xác nhận Nghiệm thu:** Được người phụ trách (PO kiêm nhiệm) rà soát và xác nhận đạt yêu cầu trước khi chuyển trạng thái sang `DONE`.

---

### 6. HANDOVER CONTINUITY (DUY TRÌ VÀ BÀN GIAO TIẾP DIỄN)

Để đảm bảo dự án luôn duy trì được tính liên tục khi có sự thay đổi nhân sự sau này:

1. **Cập nhật Trạng thái Backlog:** Ngay sau khi một task hoàn thành, cập nhật trạng thái trong bảng Task Backlog tại Phần 5 của file này từ `TODO` -> `IN_PROGRESS` -> `DONE` kèm mã commit tương ứng.
2. **Quy trình Báo cáo Vấn đề phát sinh (SME-AI-011):** Nếu phát hiện yêu cầu nghiệp vụ bất hợp lý hoặc có nguy cơ gây lỗi hệ thống, ghi chép rõ: (1) Mô tả vấn đề, (2) Nguyên nhân kỹ thuật, (3) Bằng chứng từ code, (4) Đề xuất giải pháp và xin ý kiến phê duyệt trước khi triển khai.
3. **Ghi nhận Quyết định Nghiệp vụ mới:** Mọi quyết định mới phải được ghi vào Phần 6 (Business Decision Log) với mã định danh tăng dần (`DEC-05`, `DEC-06`...), ghi rõ ngày phê duyệt và tác động kỹ thuật.
4. **Hồ sơ Bàn giao lại:** Khi chuyển giao tiếp cho người khác, cần cung cấp: Tên branch làm việc mới nhất, commit hash HEAD, danh sách các task đã hoàn thành và danh sách các task đang làm dở dang.

---

### 7. ACCEPTANCE CHECKLIST — CHECKLIST XÁC NHẬN TIẾP NHẬN DỰ ÁN

Thành viên mới tiếp nhận dự án cần tích chọn xác nhận từng mục dưới đây sau khi thực hiện kiểm tra thực tế:

#### A. Kiểm tra Truy cập & Môi trường Kỹ thuật
- [ ] Đã truy cập được repository Git tại `https://github.com/yenhile/SME_SYSTEM.git`.
- [ ] Đã kiểm tra đúng branch bàn giao `LeThiYenNhi` và commit mới nhất `695d006`.
- [ ] Đã nắm rõ trạng thái working tree hiện tại (NOT CLEAN) và tạo nhánh làm việc riêng (`git checkout -b feature/...`) để không làm mất các file dở dang / untracked.
- [ ] Đã cài đặt thành công Node.js v18+, Python 3.10+ và chạy được container PostgreSQL + Mailpit.
- [ ] Đã chạy thành công `npm run graph:build` tại root và lệnh `npm run graph:check` trả về exit code 0.
- [ ] Đã khởi chạy đồng thời thành công Backend (3000), Frontend (5173), ML Service (8000).

#### B. Hiểu rõ Nghiệp vụ & Phạm vi
- [ ] Xác nhận hệ thống chỉ triển khai cho **DUY NHẤT 01 CHI NHÁNH NGÂN HÀNG** (`DEC-01`), không mở rộng đa chi nhánh; bảo toàn phân quyền theo vai trò (RBAC) và theo hồ sơ được phân công (`assignedTo`).
- [ ] Xác nhận quy trình quá hạn bổ sung chứng từ: **Quản lý đóng thủ công**, tuyệt đối không tự động đóng bằng cron (`DEC-02`).
- [ ] Phân định rõ phạm vi công việc:
  - `TK-07`: Hoàn thiện AC, logic nhắc ngày 5 và đánh dấu quá hạn ngày 10 (chưa tự code đếm ngày khi chưa chốt quy tắc ngày làm việc vs ngày lịch).
  - `TK-08`: Triển khai nút bấm và modal Quản lý đóng hồ sơ thủ công sang `CLOSED_TIMEOUT`, lưu vết đầy đủ.
- [ ] Xác nhận mô hình ML tiếp tục dùng **dữ liệu synthetic** và **chỉ dự báo trễ hạn SLA**, tuyệt đối không ra quyết định cấp tín dụng (`DEC-04`).
- [ ] Xác nhận tính năng "Giải ngân" không có code và nằm ngoài phạm vi cốt lõi của đồ án.

#### C. Nắm bắt các Hạng mục PENDING & An toàn Dữ liệu
- [ ] Nắm rõ TK-05 đã triển khai trọn vòng Portal và kiểm chứng thử; còn PO nghiệm thu/đưa lên môi trường chung. Phân biệt với TK-11 chưa triển khai theo Nhóm C.
- [ ] Nắm rõ TK-11 đã chọn PA1, chưa triển khai; cần lịch ngày nghỉ có phiên bản và kiểm chứng tích hợp trước hiệu lực.
- [ ] Nắm rõ TK-07 đã chọn ngày lịch/quy tắc cuối tuần; không tự gia hạn hoặc lẫn hạn phản hồi với SLA giờ làm việc.
- [ ] Nắm rõ danh sách các script có nguy cơ ghi/xóa database trong thư mục `backend/scripts/` và cam kết không chạy tùy tiện trên DB có dữ liệu thật.

---
*Ngày xác nhận tiếp nhận: ____ / ____ / 2026*  
*Chữ ký / Xác nhận thành viên tiếp nhận:* ______________________

