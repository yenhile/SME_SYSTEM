# G2-intake-assignment — Audit nghiệm thu Nhóm 2 + Nhóm 3 (15/11/2026)

Vai trò: reviewer nghiệp vụ + QA, REVIEW ONLY theo `00-baseline.md`. Không sửa source/DB/Master/Bug Log, không gửi POST/PUT/PATCH/DELETE nghiệp vụ. Không dùng trình duyệt: mọi kết luận UI là **đọc code, chưa kiểm UI**.

## 1. Phạm vi và nguồn đối chiếu

- Master: Nhóm 2 (dòng 353–404), Nhóm 3 (406–437), "Danh sách hồ sơ theo bố cục TMS" (780+), C7 + kế hoạch B (1494, 1539–1571), DEC-06/07/08/10/11 (mục 7).
- Backend: `portal/portal.controller.ts`, `portal.service.ts`, `portal.intake-workflow.ts`, `portal.intake-cycle.ts`; `assignments/*` (transferPortal, transferLoan, assignment-change-requests, coordination-scope, officer-workloads); `loan-applications/*` (create tại quầy, listWhere, officer-turn, appraisal-queue); `companies/company-access.ts`, `company-snapshot.ts`; `common/guards/loan-access.guard.ts`; `dashboard/dashboard.service.ts` (CBTD "Cần xử lý ngay").
- Frontend: `portal/IntakeCyclePanel.tsx`, `components/PortalIntakeQueue.tsx`, `IntakeAssignment.tsx`, `PortalIntakeDetails.tsx`, `AssignmentChangeRequestPanel.tsx`, `LoanList.tsx`, `LoanFilters.tsx`, `CreateLoanModal.tsx`, `officerCase.ts`, `roleDashboards.ts`.
- Bug Log: `UT-PT-01`; bảng E2/E5/E6/E18 phiên 2; mục "Chưa test" (E16, trả sửa trước tiếp nhận, đối soát MST); MM-02.

## 2. Kiểm chứng đã thực hiện

| Loại | Lệnh / thao tác | Kết quả |
|---|---|---|
| CodeGraph | `npm run codegraph -- fn-impact transferPortal` | OK (5.742 node). 6 hàm phụ thuộc: `PortalService.assign`, `AssignmentChangeRequestsService.resolve` → controller assign/approve/reject/cancel |
| CodeGraph | `npm run codegraph -- fn-impact assertOfficerMayWriteCompany` | `CompaniesService.upsert`, `LoanApplicationsService.create` (+ script `check-document-codes.cjs`) |
| Unit backend (không DB, chạy trên `dist` build 14/11 trùng giờ source) | `node scripts/run-tests.cjs test/portal-assignment … test/portal.test.cjs` (12 file: portal-assignment, portal-intake-cycle, round3-intake, assignment-coordination-guards, assignment-safety, coordination-scope, companies-access, loan-list-page, maker-checker, portal-accept-prediction, loan-access, portal) | **107/107 pass** |
| Unit frontend | `npm run test:intake` 8/8; `npm run test:portal` 42/42; `npm run test:loan-list` 12/12; `npm run test:officer-case` 16/16; `node --test scripts/check-coordination-ui.mjs` 6/6 | Đều pass |
| SQL SELECT | `portal_requests` theo trạng thái | DRAFT v1: 3, DRAFT v2: 14, SUBMITTED v1: 1 (`DN-5`). **Không có ASSIGNED/RETURNED/ACCEPTED** |
| SQL SELECT | `assignment_change_requests`, `portal_intake_issues`, `portal_assignments`, `application_assignments` | Đều 0 dòng |
| SQL SELECT | `loan_applications` có `company_snapshot IS NULL` | **195/195** |
| API GET (đăng nhập demo; không in mật khẩu/token) | QLCN `nhung.nguyen`, CBTD `nam.hoang`, Admin `khoa.tran`, Thẩm quyền `ha.le` gọi `/portal-intakes`, `/portal-intakes/officers`, `/assignment-change-requests(/capabilities)`, `/assignments/officer-workloads`, `/loan-applications?page&lifecycle` | QLCN/Admin: portal 1 dòng, officers 3, ACR 0, loan 195 (active 10/finished 185). CBTD: portal 0, officers/workloads 403, loan 63 (active 2/finished 61), lọc `officer=mai` bị bỏ qua (vẫn 63). Thẩm quyền: portal/ACR/workloads 403; loan 189 (không thấy Tiếp nhận). CBTD GET đề nghị chưa phân công `DN-5` → 404 |

Hệ quả: DB `public` hiện **không có dữ liệu** để kiểm chạy thật các nhánh phân công, trả sửa, đối soát, COI, điều chuyển; các nhánh này chỉ được kiểm bằng đọc code + unit test mock. Không chạy được kiểm thử ghi dữ liệu theo baseline.

## 3. Đánh giá theo tính năng (A–G)

Ký hiệu: P = PASS, PA = PARTIAL, F = FAIL, NV = NOT VERIFIED, PP = PENDING POLICY. (code) = đọc code/unit test; (run) = đã chạy API/DB.

| # | Tính năng | A | B | C | D | E | F | G / Kết luận |
|---|---|---|---|---|---|---|---|---|
| 1 | QLCN phân công đề nghị Portal cho CBTD | P | P (code) | P (code) | P (run quyền GET; code ghi) | P (code) | P | **PASS (code+unit)**, chưa chạy E2E trên DB hiện tại |
| 2 | Điều chuyển đề nghị trước tiếp nhận / hồ sơ vay (QLCN trực tiếp) | P | P (code) | P (code) | P | P (code) | PA (SLA handledBy) | **PASS (code)**; lưu ý SLA mục 6 |
| 3 | Đề nghị điều phối (CBTD → QLCN) + DEC-06 | P | P (code) | P (code) | P | P (code) | P | **PASS (code+unit)** |
| 4 | Xung đột lợi ích (COI) | P | P (code) | P (code) | P | PA | PA | **PARTIAL**: hàng việc CBTD ở Tiếp nhận vẫn báo "Kiểm tra chứng từ" khi đang bị chặn (BUG-G2-03) |
| 5 | Quy tắc người lập không tự xử lý (DEC-10, Maker-Checker trong nhóm) | P | — | P (code) | PA | P | — | **PARTIAL**: đủ cho điều phối/COI/đối soát/phân công; vướng mắc nội bộ không chặn (thuộc C7, PP) |
| 6 | Hàng việc/danh sách hồ sơ theo vai trò + bộ lọc (DEC-07/08) | P | P (run) | P (run) | P (run) | P (code) | P | **PASS** |
| 7 | Tạo hồ sơ tại quầy | PA | P (code) | PA | PA | P (code) | **F** (Company) | **PARTIAL**: ghi đè Company dùng chung, đổi thông tin DN của hồ sơ cũ (BUG-G2-02) |
| 8 | CBTD kiểm tra checklist đề nghị Portal | P | P (code) | P (code) | P | P (code) | P | **PASS (code+unit)** |
| 9 | Trả doanh nghiệp chỉnh sửa (`return-correction`) + DN xin sửa | P | P (code) | P (code) | P | PA | P | **PASS (code)**; Master ghi sai trạng thái `RESUBMITTED` (DOC) |
| 10 | Đối soát Company | P | P (code) | P (code) | P | PA (BUG-G2-04) | P | **PASS (code)**, UX nhỏ |
| 11 | Tiếp nhận thành hồ sơ vay | P | P (code) | P (code) | P | P (code) | P (MM-02 đã có) | **PASS (code+unit)** |
| 12 | Khối "Vướng mắc nội bộ" | — | — | — | — | — | — | **PENDING POLICY (C7)**; mô tả vị trí chặn trong kế hoạch B lệch code |
| 13 | Ảnh hưởng tái phân công tới quyền, SLA, thông báo, ML | P | P (code) | P | P | — | PA | **PARTIAL**: trách nhiệm SLA Tiếp nhận ghi cho người đóng công đoạn |
| 14 | Lộ danh tính cán bộ qua API Portal (UT-PT-01) | — | — | — | **F** | — | — | **FAIL — bug cũ còn nguyên** (BUG-G2-01) |

### 3.1 Chi tiết theo tính năng

**(1) Phân công đề nghị Portal** — Requirement Nhóm 2 d.1–d.4.
- Rule → Actual: `POST /portal-intakes/:id/assign` chỉ `@Roles(QUAN_LY)` (`portal.controller.ts:74`); chặn tự giao cho mình (`portal.service.ts:313`, `assignment.transactions.ts:53`); khóa dòng `FOR UPDATE` + `lockOfficer`; kiểm `expectedAssignmentVersion`, `expectedAssignedTo`, `expectedRevision` (V2) → 409 khi màn hình cũ (`assignment.transactions.ts:49–52`); người nhận phải là CBTD active (`:55–56`); idempotency `clientRequestId` + `payloadHash` (`:46–47`); điều chuyển bắt buộc lý do (`:58`); ghi `PortalAssignment`, tăng `assignmentVersion`, thông báo CBTD mới + cũ (`:60–65`); hủy đề nghị điều phối đang chờ (`obsoleteCoordination`).
- UI (đọc code): `IntakeAssignment.tsx` chỉ QLCN thấy form (`:20`), có hộp xác nhận, khóa nút khi 409 và nút "Tải lại phân công" (`:42,50`), danh sách CBTD kèm số tải.
- Evidence: unit `portal-assignment.test.cjs` pass; API GET `/portal-intakes/officers` QLCN 200 (3 CBTD, tải 2/3/5), CBTD 403.
- Ngoại lệ: stale/2 QLCN đồng thời → 409 (code); retry → trả biên nhận `replayed` (code); CBTD bị khóa → không xuất hiện trong danh sách, API 400 (code); đề nghị đã ACCEPTED → 409 "điều chuyển tại hồ sơ vay" (code).
- Result: PASS (code + unit). Chưa chạy luồng ghi trên DB (DB không có đề nghị ASSIGNED).

**(2) Điều chuyển trực tiếp** — Nhóm 2 d.5, TH4.
- `transferLoan` (`assignment.transactions.ts:10–37`): chặn hồ sơ đã kết thúc, kiểm phiên bản, không tự giao, không trùng người cũ, người nhận CBTD active; ghi `ApplicationAssignment`; thông báo người mới (có link) + người cũ (không link); `obsoleteCoordination`; gọi lại dự báo (`assignmentPrediction`, `assignments.service.ts:240–244`).
- Mất quyền ghi của CBTD cũ: `LoanAccessGuard` so `loan.assignedTo` (`loan-access.guard.ts:26–28`) → 403 cho mọi API theo hồ sơ. E16 (điều chuyển khi CBTD đang soạn tờ trình): theo code, lần lưu tiếp theo của CBTD cũ bị 403, nội dung chưa lưu mất — đúng quyền nhưng **chưa kiểm UI** thông báo cho CBTD cũ.
- Result: PASS (code). F: xem mục 6 (SLA).

**(3) Đề nghị điều phối + DEC-06** — `assignment-change-requests.service.ts`.
- Chỉ CBTD đang phụ trách được tạo (`:63,72`), hồ sơ còn mở (`:73`); một đề nghị PENDING mỗi đối tượng (`:79`); DEC-06: hồ sơ vay chờ Thẩm quyền quyết định chỉ cho COI, chặn trong transaction (`:74–77`, `coordination-scope.ts:135–141`); capabilities trả lý do theo hồ sơ (`:20–26`).
- Quyết định: chỉ QLCN (`:92`), không tự xử lý đề nghị của chính mình kể cả đổi vai trò (`:106`), kiểm phiên bản đề nghị + phân công, bối cảnh đổi → OBSOLETE (`:112–116`); từ chối cần xác nhận CBTD còn tiếp tục được (`:121–125`); chấp thuận bàn giao trong cùng transaction (`:127–131`).
- UI: `AssignmentChangeRequestPanel.tsx` lọc lý do theo capabilities, hiển thị restriction, nút theo `canResolve/canCancel` do server trả; Admin chỉ xem.
- Evidence: unit `coordination-scope`, `assignment-coordination-guards`, `assignment-safety` pass; API GET ACR = 0 dòng (không có dữ liệu chạy thật).
- Result: PASS (code + unit).

**(4) COI** — Nhóm 2 TH3.
- Ghi: `assertNoCoordinationConflict` chặn người báo COI ở appraisal, supplements, workflow, intake (lock), accept (`portal.service.ts:327`); `decisionBlocked` chặn chốt quyết định (`workflow.service.ts:46`); chặn sửa Company/tạo hồ sơ cùng MST (`assertNoCompanyConflict`); không được rút COI (`:119`, UI `canCancel` loại COI); từ chối COI bắt buộc `NO_CONFLICT_CONFIRMED`.
- Lệch: hàng việc CBTD (`officer-turn.ts:116–117`) ở công đoạn Tiếp nhận không xét COI → hồ sơ có COI chờ vẫn vào "Cần xử lý ngay" với nhãn "Kiểm tra chứng từ tiếp nhận"/"Chuyển sang Thẩm định" trong khi `officerSituation` báo "Đang chờ giải quyết xung đột lợi ích" và mọi ghi bị 403. Ở Thẩm định cùng tình huống lại có nhãn "Theo dõi đề nghị xung đột lợi ích" (`appraisal-queue.ts:195`, `roleDashboards.ts:35`). → BUG-G2-03.
- Result: PARTIAL.

**(5) Người lập không tự xử lý (DEC-10)** — điều phối/COI: P (`:106`, UI `canResolve` loại người gửi); đối soát Company: P (`portal.intake-workflow.ts:208`); phân công: P (không tự giao). Vướng mắc nội bộ (`issue()` `:230–248`): QLCN tạo và QLCN khác hoặc chính người tạo đều "Ghi nhận đã xử lý" được — không thuộc danh sách DEC-10, khối đang C7 → PENDING POLICY.

**(6) Danh sách hồ sơ theo vai trò (DEC-07/08, TMS)** — run.
- CBTD chỉ thấy hồ sơ của mình (`listWhere` `assignedFilter`, API: 63 hồ sơ, 0 dòng của người khác), tab Đang xử lý/Đã kết thúc qua `lifecycle` (2/61), lọc `officer` bị bỏ qua cho CBTD; UI CBTD không có ô Công đoạn, không có ô CBTD (`LoanList.tsx:136`). Thẩm quyền không thấy Tiếp nhận (189 = 195 − 6 hồ sơ Tiếp nhận). QLCN/Admin thấy 195. Portal queue CBTD chỉ đề nghị được giao (`intakeScope`).
- Result: PASS.

**(7) Tạo hồ sơ tại quầy** — `loan-applications.service.ts:82–168`, `CreateLoanModal.tsx`.
- Đúng: chỉ CBTD (`@Roles`), chặn > 10 tỷ (`assertBranchAmount` + UI), không gán cho người khác (`:84`), CBTD active, MST 10/13 số, COI theo MST, "ai làm người nấy" (`assertOfficerMayWriteCompany`), mã `SME-n`, SLA PA1 snapshot, dự báo ngay sau tạo (`controller:23–28`).
- Sai lệch: `company.upsert` **ghi đè** Company dùng chung bằng dữ liệu nhập tay (`:93–104`), **không** gọi `freezeCompanyLoans` như đường đối soát (`portal.intake-workflow.ts:222`). DB: 195/195 hồ sơ có `company_snapshot IS NULL` nên mọi hồ sơ cũ cùng MST (kể cả đã phê duyệt/từ chối) hiển thị thông tin doanh nghiệp mới qua `companyForLoan` (`company-snapshot.ts:21–23`). Cùng hành vi ở `CompaniesService.upsert` (`companies.service.ts:80–93`). Đường Portal bắt buộc đối soát qua QLCN (Nhóm 3 TH2, V0-A–V4-A "không tự ghi đè Company dùng chung") → hai đường vào cho kết quả trái nhau. → BUG-G2-02.
- Result: PARTIAL.

**(8) CBTD kiểm tra checklist** — `review()` (`portal.intake-workflow.ts:111–128`): chỉ CBTD được giao (`lock`), trạng thái ASSIGNED, đúng `submissionId`, mục phải có tài liệu, `NEEDS_CORRECTION` bắt buộc lý do; fingerprint do server tính; idempotency + `expectedRevision`. UI chỉ hiện nút khi CBTD, ASSIGNED, không bị chặn COI (`IntakeCyclePanel.tsx:42`). Kế thừa kết quả đạt khi mục không đổi (`carryReviews`), trừ khi trả sửa dữ liệu (`invalidateReviews`). Result: PASS (code + unit `portal-intake-cycle`, `round3-intake`).

**(9) Trả sửa / DN xin sửa** — `returnForCorrection` (`:129–145`) cần ít nhất một mục sửa, chặn khi có đề nghị xin sửa chờ; DN `requestCorrection` (`:146–159`) chỉ khi SUBMITTED/ASSIGNED, chặn trùng, thông báo CBTD hoặc QLCN; CBTD `decideCorrection` (`:160–177`). Nộp lại (`publish` `:63–92`) đưa đề nghị về **ASSIGNED** (nếu đã giao) hoặc SUBMITTED, tạo `PortalSubmission` sequence+1, báo CBTD. Danh sách cán bộ chỉ trả bản đã gửi khi RETURNED (`internalPublished`). DN thấy việc cần làm ở trang chủ Portal (`portal/home.ts:23`).
- DOC: Master Nhóm 3 d.4 ghi trạng thái `RESUBMITTED` — enum `PortalRequestStatus` không có giá trị này (`schema.prisma:367–373`). Sai lệch tài liệu, không phải lỗi code.
- UX (đọc code): xác nhận trả sửa dùng `window.confirm` (cùng loại UT-B5-02). Result: PASS (code).

**(10) Đối soát Company** — CBTD lập (`:178–197`), QLCN quyết (`:198–229`), không tự xác nhận, phải đúng bản gửi, đủ checklist, không có xin sửa chờ; chấp thuận thì đóng băng snapshot hồ sơ cũ rồi cập nhật Company; đối soát mở chặn tiếp nhận (`assertAccept:257`, `view:102`). UX: nút "Xác nhận đối soát" hiện cho QLCN cả khi đề nghị RETURNED hoặc CBTD chưa kiểm đạt đủ, bấm mới nhận 409 (`IntakeCyclePanel.tsx:73` vs `portal.intake-workflow.ts:210,214`). → BUG-G2-04 (Cải tiến). Result: PASS (code).

**(11) Tiếp nhận** — `accept()` (`portal.service.ts:316–374`): khóa dòng, replay theo người phụ trách hiện tại, chỉ CBTD được giao + ASSIGNED, COI, đúng `expectedRevision/submissionId`, snapshot đủ điều kiện, checklist đạt đủ, không có xin sửa/vướng mắc mở, tệp vật lý khớp hash, ≤ 10 tỷ, xác nhận dùng Company hiện có + đối chiếu tài chính, không ghi đè Company; tạo `LoanApplication` TIEP_NHAN/RECEIVED với `companySnapshot`, `intakeOfficerId`, SLA PA1; hủy điều phối Portal; dự báo ngay (MM-02 đã triển khai, `controller:97–100`). UI: nút bật theo `cycle.canAccept` + không bị chặn COI. Evidence: unit `portal-accept-prediction`, `round3-intake` pass. Result: PASS (code + unit).

**(12) Vướng mắc nội bộ (C7)** — hiện vẫn hoạt động và chặn tiếp nhận. Lệch mô tả kế hoạch B: điều kiện chặn **không** nằm trong `assertReviewsComplete` (`portal.intake-cycle.ts:145–148` chỉ kiểm checklist) mà ở `assertAccept` (`portal.intake-workflow.ts:257`) và `view().canAccept` (`:102`); ngoài ra số dòng UI trong kế hoạch (69–73) đã lệch (hiện `IntakeCyclePanel.tsx:72–75`). Đếm `OPEN` gồm cả loại `COMPANY_RECONCILIATION` — nếu gỡ khối phải giữ chặn cho đối soát. DB: 0 bản ghi `portal_intake_issues`. Result: PENDING POLICY.

**(13) Ảnh hưởng tái phân công** — quyền: chuyển ngay (guard theo `assignedTo`); thông báo: đủ 2 phía, người cũ không có link (đúng); ML: chấm lại sau điều chuyển hồ sơ vay, không chấm cho điều chuyển đề nghị Portal (chưa có hồ sơ — hợp lý); SLA: không đổi đồng hồ (đúng), nhưng `handledBy` của công đoạn được ghi bằng người đóng công đoạn (`workflow.service.ts:96,155`) và báo cáo theo cán bộ dùng `handledBy` (`dashboard-report.ts:77–81`) → toàn bộ thời gian/trễ SLA Tiếp nhận tính cho CBTD mới, kể cả phần trước điều chuyển. Master không quy định → PENDING POLICY.

**(14) UT-PT-01** — xem BUG-G2-01.

## 4. Bug ứng viên

### BUG-G2-01 · (UT-PT-01 còn nguyên) API cổng doanh nghiệp trả danh tính cán bộ
- Loại/Mức: Lỗi · **Chặn** (lộ dữ liệu nội bộ) — giữ mức của Bug Log.
- Tái hiện: QLCN phân công một đề nghị → DN đăng nhập Portal → `GET /api/portal/requests` hoặc `/:id`.
- Mong đợi: không có `assignedOfficer`, `assignedTo`, `assignedBy`, `acceptedBy`, `assignmentVersion`.
- Thực tế (code): `include` chứa `assignedOfficer:{id,fullName,username}` (`portal.service.ts:29`); `list(accountId)` trả nguyên `rows` (`:94`), `one(id,accountId)` trả nguyên bản ghi (`:103`); các phản hồi `update/upload/deleteDocument/submit/request-correction` cũng dùng `include` này (`:159,195,210`, `portal.intake-workflow.ts:157`). Unit test hiện còn khẳng định include có `assignedOfficer` (`test/portal-assignment.test.cjs:40`). Không chạy được trên DB vì không có đề nghị đã phân công.
- Module: backend `portal`. Hướng xử lý: hàm chiếu trường công khai cho tài khoản DN ở mọi endpoint `portal/requests/*`; test khẳng định phản hồi DN không có các trường điều phối.

### BUG-G2-02 · Tạo hồ sơ tại quầy ghi đè Company dùng chung, làm đổi thông tin doanh nghiệp của hồ sơ cũ
- Loại/Mức: Lỗi · **Vừa** (sai dữ liệu lịch sử trên luồng phụ; cần PO xác nhận quy tắc — xem PENDING P3).
- Tái hiện: CBTD A có ít nhất 1 hồ sơ của MST X → Tạo hồ sơ tại quầy, nhập MST X, "Kiểm tra" (điền sẵn) rồi sửa doanh thu/người đại diện → Tạo → mở hồ sơ cũ của MST X (kể cả đã phê duyệt).
- Mong đợi: thông tin doanh nghiệp của hồ sơ cũ giữ nguyên như lúc lập/quyết định; thay đổi Company dùng chung phải qua đối soát hoặc ít nhất đóng băng snapshot hồ sơ cũ (như `resolveCompanyReconciliation`).
- Thực tế (code + DB): `loan-applications.service.ts:93–104` upsert ghi đè; không gọi `freezeCompanyLoans`; 195/195 hồ sơ có `company_snapshot` NULL nên hiển thị theo Company mới (`company-snapshot.ts:21–23`). Cùng lỗi ở `POST /companies` (`companies.service.ts:80–93`).
- Module: backend `loan-applications`, `companies`; frontend `CreateLoanModal.tsx`. Hướng xử lý (trình PO): (a) tối thiểu gọi `freezeCompanyLoans` trước khi cập nhật; hoặc (b) MST đã có thì khóa trường Company ở form tại quầy, khác biệt đi qua đối soát như Portal.

### BUG-G2-03 · Hàng việc CBTD báo "Kiểm tra chứng từ tiếp nhận" cho hồ sơ Tiếp nhận đang chờ giải quyết xung đột lợi ích
- Loại/Mức: Lỗi · **Thấp** (sai nhãn/hàng việc, không sai dữ liệu).
- Tái hiện: CBTD báo COI trên hồ sơ vay đang Tiếp nhận (RECEIVED/CHECKED) → mở Dashboard CBTD / khối "Cần xử lý ngay".
- Mong đợi (DEC-07: chỉ hồ sơ đang chờ chính CBTD; nhất quán với Thẩm định): không coi là việc của CBTD, hoặc nhãn "Theo dõi đề nghị xung đột lợi ích" như ở Thẩm định.
- Thực tế (code): `isOfficerTurn` nhánh Tiếp nhận chỉ xét trạng thái (`officer-turn.ts:117`), `officerTask` trả `INTAKE_CHECK/INTAKE_FORWARD` (`:127`); khi mở hồ sơ, `officerSituation` báo đang bị chặn (`officerCase.ts:54`), mọi ghi 403.
- Module: backend `loan-applications/officer-turn.ts`, `dashboard`. Hướng xử lý: xét `coordinationRequests.length` trước nhánh Tiếp nhận, trả `CONFLICT`; thêm test.

### BUG-G2-04 · Nút "Xác nhận đối soát" hiện cho QLCN khi chưa đủ điều kiện, bấm mới báo 409
- Loại/Mức: Cải tiến · **Thấp**.
- Tái hiện (đọc code): đối soát đang mở, đề nghị đã RETURNED hoặc CBTD chưa kiểm đạt đủ mục → QLCN mở đề nghị → nút xác nhận vẫn bật.
- Mong đợi: khóa nút và nêu lý do (chờ bản gửi mới / chờ CBTD kiểm tra đủ), như tinh thần D5-04 "không để người dùng nhận lỗi bất ngờ".
- Thực tế: `IntakeCyclePanel.tsx:73` chỉ xét vai trò + trạng thái đối soát; backend chặn tại `portal.intake-workflow.ts:210,211,214`.
- Module: frontend `portal/IntakeCyclePanel.tsx`. Hướng xử lý: server trả cờ `canApproveReconciliation` + lý do trong `view()`.

### Sai lệch tài liệu (không phải bug code)
- DOC-G2-01: Master Nhóm 3 d.4 ghi `RESUBMITTED`; code đưa về `ASSIGNED` với `PortalSubmission.sequence` tăng.
- DOC-G2-02: Kế hoạch B ghi điều kiện chặn trong `assertReviewsComplete` và dòng UI 69–73; thực tế ở `assertAccept`/`view().canAccept`, UI dòng 72–75.
- DOC-G2-03: Master Nhóm 2 g / Nhóm 3 g ghi "đã kiểm chứng toàn diện, 100% pass" — bằng chứng là đợt 10/11; C11 cho biết `round2-coordination-checks`, `round3-intake-checks` chưa chạy lại; DB hiện không còn dữ liệu cho các luồng này.

## 5. Bug cũ trong Bug Log thuộc nhóm

| Mã | Nội dung | Trạng thái xác minh 15/11 |
|---|---|---|
| UT-PT-01 | API Portal lộ danh tính cán bộ | **Còn** (code `portal.service.ts:29,94,103`; test còn khẳng định include) |
| E2/E5/E6/E18 (phiên 2, "Đạt") | CBTD khác 403; tiếp nhận 2 lần 1 hồ sơ; DN không sửa đề nghị đã tiếp nhận; QLCN không tự giao | Code vẫn giữ đúng (guard `assignedTo`; replay `accept`; `draft()`/`publish` chặn ACCEPTED; `officerId===managerId`). Chưa chạy lại trên DB |
| MM-02 (mong muốn) | Chấm dự báo ngay khi tiếp nhận/tạo tại quầy | **Đã triển khai** (`portal.controller.ts:97–100`, `loan-applications.controller.ts:23–28`; unit `portal-accept-prediction` pass) |
| E16, trả sửa trước tiếp nhận, đối soát MST ("Chưa test") | — | Vẫn **chưa kiểm chạy thật** (không có dữ liệu, không được ghi) |

## 6. Tác động liên module
- Portal ↔ Company: BUG-G2-02 làm đường tại quầy phá nguyên tắc đối soát của Portal; ảnh hưởng hiển thị hồ sơ đã quyết định, báo cáo theo doanh nghiệp.
- Điều chuyển ↔ SLA/báo cáo: `handledBy` = người đóng công đoạn → báo cáo theo cán bộ dồn trễ SLA cho người nhận bàn giao.
- COI ↔ Dashboard CBTD: BUG-G2-03.
- ML: điều chuyển hồ sơ vay chấm lại dự báo; đặc trưng tải CBTD không đổi.
- C7 ↔ đối soát Company: gỡ khối vướng mắc phải giữ điều kiện chặn đối với `COMPANY_RECONCILIATION` đang mở.

## 7. PENDING PO
- P1 (C7): gỡ hay giữ khối "Vướng mắc nội bộ"; nếu giữ, có áp quy tắc người lập không tự đóng vướng mắc không.
- P2: trách nhiệm SLA Tiếp nhận/Thẩm định sau điều chuyển tính cho ai (người đóng công đoạn hay chia theo thời gian phụ trách).
- P3: quy tắc cập nhật Company tại quầy (cho CBTD sửa trực tiếp với snapshot, hay bắt buộc đối soát như Portal) — quyết định để xử lý BUG-G2-02.
- P4: DN có cần thông báo ngoài Portal (email) khi bị trả sửa/từ chối xin sửa không (hiện chỉ thấy khi đăng nhập).

## 8. Chưa xác minh được
- Toàn bộ luồng ghi (phân công, điều chuyển, trả sửa, nộp lại, đối soát, COI, tiếp nhận) trên hệ thống chạy thật: DB không có dữ liệu phù hợp và baseline cấm ghi.
- UI các màn (IntakeCyclePanel, Điều chuyển & phân công, danh sách hồ sơ, CreateLoanModal): chỉ đọc code.
- Thông báo UI cho CBTD cũ khi bị điều chuyển lúc đang soạn tờ trình (E16).
- Đề nghị V1 `DN-5` (SUBMITTED, formVersion 1): chưa kiểm phân công/tiếp nhận theo luồng cũ.

## 9. Test case cần kiểm lại (agent E2E / phiên có quyền ghi, schema tạm)
1. QLCN phân công DN mới → CBTD nhận thông báo; 2 QLCN phân công đồng thời → 1 thành công, 1 nhận 409.
2. DN `GET /portal/requests(/:id)` sau phân công không có trường cán bộ (BUG-G2-01).
3. CBTD đánh dấu cần sửa → trả sửa → DN sửa, nộp lại → về ASSIGNED, mục không đổi giữ "đạt".
4. DN xin sửa khi ASSIGNED → nút Tiếp nhận khóa; CBTD từ chối/đồng ý.
5. Đối soát Company: CBTD lập, QLCN khác duyệt; QLCN duyệt khi RETURNED → mong đợi nút khóa (BUG-G2-04).
6. CBTD báo COI ở Tiếp nhận → mọi ghi 403, dashboard không xếp "Kiểm tra chứng từ" (BUG-G2-03); QLCN điều chuyển → COI APPROVED, CBTD cũ mất quyền.
7. DEC-06: hồ sơ chờ Thẩm quyền quyết định → chỉ chọn được COI; gọi API lý do khác → 409.
8. QLCN điều chuyển khi CBTD đang soạn tờ trình (E16) → CBTD cũ nhận thông báo, lưu bị 403 có thông báo rõ.
9. Tạo tại quầy với MST đã có, đổi doanh thu → hồ sơ cũ cùng MST giữ thông tin cũ (BUG-G2-02).
10. Tiếp nhận bấm 2 lần → 1 hồ sơ, 1 dự báo `TIEP_NHAN`.
