# BỘ TÀI LIỆU BÀN GIAO DỰ ÁN SME LOAN WORKFLOW (HANDOVER v2.1)
**Vị trí file lưu trữ:** `docs/handover/HANDOVER_v2.1.md`  
**Dự án:** SME Loan Workflow  
**Mục đích:** Chuyển giao toàn diện hệ thống cho thành viên tiếp nhận kiêm nhiệm hai vai trò Product Owner (PO) và Senior Full-stack Developer (có AI hỗ trợ).  
**Phiên bản:** Handover v2.1 (Ngày 23/10/2026)  
**Trạng thái tài liệu:** Tài liệu bàn giao DUY NHẤT & CHÍNH THỨC trong repository (READ-ONLY review)  
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
  - *Ràng buộc kỹ thuật:* **Không được tự triển khai logic đếm ngày** khi quy tắc ngày lịch vs ngày làm việc chưa được PO chốt.

### 4. Các nội dung nghiệp vụ còn PENDING
1. `[PENDING]` **Mở nộp hồ sơ Portal V2:** File `backend/src/modules/portal/portal.readiness.ts:3` đang khóa cứng `canSubmit: false`. Cần PO nghiệm thu chính thức 6 tiêu chí chính sách trong `backend/src/modules/portal/portal.policy.ts` mới được mở cờ cho phép nộp V2.
2. `[PENDING]` **Phương pháp tính thời gian SLA:** Hiện tại tính 24/7 theo giờ thực. Cần PO chốt: Có tính theo giờ làm việc (8h/ngày, trừ Thứ 7, CN, ngày lễ) hay không, và có tạm dừng (pause) đếm giờ SLA trong thời gian hồ sơ chờ doanh nghiệp bổ sung chứng từ hay không.
3. `[PENDING]` **Chi tiết quy tắc đếm ngày quá hạn (DEC-02):** Chưa chốt quy tắc tính 5 ngày nhắc nhở / 10 ngày quá hạn là ngày làm việc hay ngày lịch; chưa chốt cơ chế xử lý trường hợp bổ sung một phần hoặc xin gia hạn nộp hồ sơ.

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
| **TK-05** | Nghiệm thu 6 tiêu chí chính sách để mở nộp Portal V2 | **Chờ PO phê duyệt** (Ưu tiên 2) | PO duyệt Policy | PO rà soát `portal.policy.ts`; Dev chuyển cờ `canSubmit: true` tại `portal.readiness.ts:3` để mở nộp V2. |
| **TK-06** | Xây dựng giao diện theo dõi tiến độ hồ sơ trên Portal DN | **Cần làm rõ AC & UI** (Ưu tiên 2) | PO duyệt thiết kế | Khách hàng SME đăng nhập Portal thấy danh sách hồ sơ đã nộp và trạng thái công đoạn hiện tại (ẩn các ghi chú nội bộ). |
| **TK-07** | Hoàn thiện AC, logic nhắc ngày 5 và đánh dấu quá hạn ngày 10 | **Triển khai kỹ thuật** (Ưu tiên 2) | **DEC-02** (Approved) | Hệ thống tự động gửi thông báo nhắc ở mốc ngày 5; đánh dấu quá hạn ở mốc ngày 10 và chuyển danh sách lên Quản lý chi nhánh. *(Không tự triển khai logic đếm ngày khi quy tắc ngày lịch/ngày làm việc chưa chốt)*. |
| **TK-08** | Triển khai chức năng Quản lý đóng hồ sơ quá hạn thủ công | **Triển khai kỹ thuật** (Ưu tiên 2) | **TK-07** | Quản lý có nút bấm và popup đóng hồ sơ sang `CLOSED_TIMEOUT` trên `LoanDetailModal.tsx`; bắt buộc ghi nhận người đóng, thời gian, lý do và log lịch sử công đoạn. |
| **TK-09** | Cấu hình Mailpit local & SMTP test cho Docker | **Triển khai kỹ thuật** (Ưu tiên 1) | **DEC-03** (Approved) | Tích hợp Mailpit vào `docker-compose.yml` hoặc truyền biến môi trường SMTP để test luồng OTP email thông suốt trên container. |
| **TK-10** | Xây dựng giao diện Đổi mật khẩu cá nhân cho cán bộ | **Triển khai kỹ thuật** (Ưu tiên 1) | Không | Header có mục "Đổi mật khẩu"; form popup kết nối thành công với API `POST /auth/change-password` có sẵn ở backend. |
| **TK-11** | Chốt quy tắc tính toán SLA: Giờ làm việc hay Giờ thực | **Chờ PO phê duyệt** (Ưu tiên 3) | PO duyệt quy chế | Quyết định xem có viết lại thuật toán tính SLA để trừ ngày nghỉ lễ, giờ ngoài hành chính và tạm dừng khi chờ bổ sung không. |
| **TK-12** | Lập Báo cáo đánh giá mô hình ML trên dữ liệu Synthetic | **Triển khai tài liệu** (Ưu tiên 3) | **DEC-04** (Approved) | Lập báo cáo khoa học đánh giá các chỉ số (Accuracy, Precision, Recall, F1) của mô hình ML, phân tích rõ các giới hạn dữ liệu giả lập. |

---

### Trạng thái thực hiện (cập nhật 24/10/2026, nhánh `YenTrang`)

| Task | Trạng thái | Commit | Ghi chú / bằng chứng |
| :--- | :---: | :--- | :--- |
| TK-01 | `DONE` | (không có, chỉ cài môi trường) | `npm ci` ở root và `graph:build`, `graph:check` exit 0 (122 file). CodeGraph lỗi với đường dẫn có dấu cách (`T:\SME SYSTEM`); build qua ổ ảo `subst S: "T:\SME SYSTEM"`. Cần Visual Studio Build Tools (C++) để biên dịch `better-sqlite3`. |
| TK-02 | `DONE` | `08631b4` | Cần sửa cả `navigation.ts` và `App.tsx` (thiếu nhánh render `AdminView section="settings"`). Đã xác nhận GET/PUT `/admin/workflow-stages` (200, giữ giá trị sau tải lại, CBTD nhận 403) và hai tiêu chí giao diện. Test navigation đã cập nhật (trước đó khẳng định không có mục SLA). Menu chưa lọc theo vai trò (hành vi sẵn có). |
| TK-03 | `TODO` | | Chờ PO duyệt ma trận AC. |
| TK-04 | `TODO` | | Phụ thuộc TK-03. |
| TK-05 | `TODO` | | Chờ PO nghiệm thu chính sách V2. |
| TK-06 | `TODO` | | Chờ PO duyệt thiết kế. |
| TK-07 | `TODO` | | Chờ PO chốt quy tắc ngày lịch / ngày làm việc. |
| TK-08 | `TODO` | | Phụ thuộc TK-07. |
| TK-09 | `DONE` | `24b4d20` | Service `mailpit` (SMTP 1025, web 8025) trong compose. Backend dùng `DOCKER_SMTP_HOST` (mặc định `mailpit`) vì `SMTP_HOST=127.0.0.1` trong `.env` sẽ ghi đè và không tới được Mailpit trong container. OTP đến Mailpit sau khoảng 0,36 giây, xác minh thành công; PO đã xác nhận trên giao diện. |
| TK-10 | `DONE` | `0e5b749` | Modal đổi mật khẩu trong menu tài khoản. Mật khẩu mới **tối thiểu 8 ký tự** theo `ChangePasswordDto` của backend (handover ghi 6). Đã xác nhận 400 khi sai mật khẩu hiện tại, đổi thành công, đăng nhập lại bằng mật khẩu mới, mật khẩu cũ bị 401; PO xác nhận trên giao diện. |
| TK-11 | `TODO` | | Chờ PO chọn PA1 / PA2. |
| TK-12 | `TODO` | | |
| (ngoài danh sách) | `DONE` | `f642e35` | Sửa lỗi hai tab cùng mở tự đăng xuất lẫn nhau: listener `storage` trong `AuthContext.tsx` nay chỉ đăng xuất khi token bị xóa. |
| (ngoài danh sách) | `DONE` | `bddbd68` | `ml-service/Dockerfile`: tăng timeout và retry cho `pip install`. |

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

### 2. Các quyết định còn PENDING cần PO chốt trước khi làm
1. **Nghiệm thu chính sách mở nộp Portal V2 (`TK-05`):** PO cần rà soát lại 6 điều kiện trong `backend/src/modules/portal/portal.policy.ts` và ký duyệt để Dev mở cờ nộp hồ sơ.
2. **Quy tắc đếm ngày quá hạn (DEC-02 / `TK-07`):** Mốc 5 ngày nhắc nhở và 10 ngày quá hạn tính theo ngày lịch thông thường hay ngày làm việc của ngân hàng? Có cơ chế cho phép Quản lý gia hạn thêm thời gian nộp chứng từ không?
3. **Thiết kế màn hình theo dõi Portal (`TK-06`):** PO cần phê duyệt danh sách các trạng thái hiển thị cho khách hàng SME (đảm bảo không làm lộ thông tin/ghi chú thẩm định nội bộ).
4. **Quy tắc đếm giờ SLA (`TK-11`):** Giữ cách tính liên tục 24/7 như hiện tại hay chuyển sang tính theo giờ làm việc (working hours) và có cơ chế tạm dừng (pause) khi chờ bổ sung hồ sơ không?

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
  7. `TK-05`: Họp nghiệm thu chính sách nộp V2 với PO để kích hoạt `canSubmit: true`.
  8. `TK-06`: Xây dựng giao diện theo dõi tiến độ hồ sơ cho doanh nghiệp trên Portal.
- **Nhóm Ưu tiên 3 — Hoàn thiện Báo cáo & Tối ưu hóa:**
  9. `TK-12`: Viết Báo cáo đánh giá mô hình ML trên dữ liệu synthetic.
  10. `TK-11`: Làm việc với PO chốt quy tắc tính giờ SLA (working hours vs continuous hours).

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
[Nhóm A: Triển khai ngay độc lập] ──> [Nhóm B: Nghiệp vụ cốt lõi & Quá hạn] ──> [Nhóm C: Chờ quyết định PO]
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

#### NHÓM C. ĐANG BỊ CHẶN BỞI QUYẾT ĐỊNH PO (BLOCKED BY PO DECISIONS)

##### Task TK-05: Nghiệm thu 6 tiêu chí chính sách để mở nộp Portal V2
- **Mục tiêu:** Mở khóa tính năng nộp hồ sơ vay chi tiết V2 cho khách hàng SME sau khi chính sách được phê duyệt chính thức.
- **Trạng thái hiện tại:** `[PENDING]` (Code FE/BE Wizard V2 đã xong nhưng bị khóa cứng tại `backend/src/modules/portal/portal.readiness.ts:3` với `canSubmit: false`).
- **Mức ưu tiên:** **P0 (Bị chặn bởi PO)**.
- **Điều kiện được bắt đầu:** PO rà soát và ký duyệt văn bản nghiệm thu 6 tiêu chí trong `portal.policy.ts`.
- **Các bước thực hiện chính:**
  1. PO rà soát 6 tiêu chí: Báo cáo tài chính, checklist chứng từ, định dạng số liệu, ràng buộc người đại diện, điều kiện khoản vay và chính sách bổ sung.
  2. Khi PO duyệt: Đổi cờ `mvpPolicy.status = 'APPROVED'` và `canSubmit = true` trong `portal.readiness.ts`.
  3. Bật cờ `PORTAL_V2_SUBMIT_ENABLED=true` trên môi trường kiểm thử.
  4. Kiểm thử luồng nộp hồ sơ V2 end-to-end từ Portal vào hàng đợi Intake.
- **Kết quả đầu ra mong đợi:** Doanh nghiệp nộp được hồ sơ vay V2 chi tiết và ngân hàng tiếp nhận thành công.
- **Acceptance Criteria:**
  - Khách hàng SME hoàn thành Wizard V2 và bấm "Nộp hồ sơ" thành công.
  - Backend tạo bản ghi `PortalRequest` ở trạng thái `SUBMITTED`, lưu snapshot dữ liệu tài chính.
  - Quản lý nhìn thấy hồ sơ V2 trong `IntakeView` và phân công được cho CBTD.
- **Phụ thuộc:** Quyết định phê duyệt chính sách từ PO.
- **Bằng chứng cần cung cấp:** Biên bản duyệt chính sách của PO và kết quả chạy test script nộp V2 thành công.

##### Task TK-11: Chốt quy tắc tính toán SLA: Giờ làm việc hay Giờ thực
- **Mục tiêu:** Xác định phương pháp đo lường thời gian xử lý hồ sơ công đoạn để cảnh báo trễ hạn đúng thực tế ngân hàng.
- **Trạng thái hiện tại:** `[PENDING]` (Hệ thống đang tính 24/7 theo giờ thực liên tục).
- **Mức ưu tiên:** **P2 (Bị chặn bởi PO)**.
- **Điều kiện được bắt đầu:** PO ban hành quy chế tính thời gian SLA chi nhánh.
- **Các bước thực hiện chính:**
  1. PO lựa chọn: (PA1) Tính giờ làm việc hành chính (8h/ngày, trừ Thứ 7, CN, ngày lễ) và tạm dừng đếm khi chờ chứng từ; hoặc (PA2) Giữ nguyên giờ thực 24/7.
  2. Nếu chọn PA1: Thiết kế lại thuật toán tính net SLA trong `workflow.service.ts` để trừ ngày nghỉ và cộng dồn `pausedDurationHours`.
  3. Cập nhật Dashboard hiển thị thời gian net SLA.
- **Kết quả đầu ra mong đợi:** Thời gian SLA đo lường phản ánh đúng thời gian làm việc thực tế của cán bộ ngân hàng.
- **Acceptance Criteria:**
  - Nếu chọn PA1: Hồ sơ nộp lúc 17h thứ 6 và xử lý lúc 9h thứ 2 tuần sau chỉ tính 1 giờ làm việc.
  - Khi hồ sơ ở trạng thái `SUPPLEMENT_REQUIRED`: Đồng hồ SLA tạm dừng đếm.
- **Phụ thuộc:** Quyết định chính sách đo lường SLA từ PO.
- **Bằng chứng cần cung cấp:** Quyết định bằng văn bản của PO và unit test thuật toán tính giờ làm việc.

---

### 3. AI WORKING RULES (NGUYÊN TẮC LÀM VIỆC VỚI AI HỖ TRỢ)

Thành viên tiếp nhận khi sử dụng AI trợ lý (Antigravity / Codex) để lập trình bắt buộc phải tuân thủ nghiêm ngặt 7 nguyên tắc sau:

1. **Đọc tài liệu và Source code trước khi sửa:** AI phải đọc kỹ các file liên quan và kiểm tra CodeGraph (`npm run graph:check`) trước khi đề xuất bất kỳ dòng code nào. Không được sửa code dựa trên suy đoán.
2. **Không tự phát minh Business Rule:** Tuyệt đối không để AI tự đặt ra các quy định nghiệp vụ mới ngoài phạm vi tài liệu hoặc các quyết định đã được PO phê duyệt.
3. **Không tự ý thay đổi các nghiệp vụ PENDING:** Khi một tính năng đang ở trạng thái `[PENDING]` (như nộp Portal V2 hay quy tắc đếm ngày SLA), AI không được tự ý đổi cờ hoặc viết code mặc định phương án thay thế.
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
- [ ] Nắm rõ tính năng Portal V2 nộp hồ sơ đang bị khóa cứng tại `portal.readiness.ts:3` do chờ PO nghiệm thu chính sách (`TK-05`).
- [ ] Nắm rõ quy tắc tính giờ SLA (giờ làm việc hành chính hay 24/7 continuous hours) đang chờ PO quyết định (`TK-11`).
- [ ] Nắm rõ quy tắc đếm ngày quá hạn (ngày làm việc vs ngày lịch) đang chờ PO quyết định (`DEC-02` / `TK-07`).
- [ ] Nắm rõ danh sách các script có nguy cơ ghi/xóa database trong thư mục `backend/scripts/` và cam kết không chạy tùy tiện trên DB có dữ liệu thật.

---
*Ngày xác nhận tiếp nhận: ____ / ____ / 2026*  
*Chữ ký / Xác nhận thành viên tiếp nhận:* ______________________

