# G1-portal — Audit nghiệm thu Nhóm 1 "Tài khoản và đề nghị Portal" (15/11/2026)

Chế độ: REVIEW ONLY. Không sửa source/DB/Master/Bug Log, không commit. Không dùng trình duyệt nên mọi nhận định UI đều là **đọc code, chưa kiểm UI**.

## 1. Phạm vi và nguồn

- Master: mục 1 (bốn nguyên tắc), mục 2 actor Doanh nghiệp, mục 3 `### Nhóm 1` cùng các mục con (Review UX Portal 05/11, Triển khai gói giao diện 05/11, Mã đề nghị, Chuyển mã cũ), mục 7 (V0-A–V4-A, Hạn mức 10 tỷ, DEC-03, DEC-09, DEC-13 "Portal không hiện lãi suất").
- Source: `backend/src/modules/portal/*` (14 file), `frontend/src/portal/*` (27 file). Sổ lỗi: `docs/BUG_LOG_NGUOI_DUNG.md` UT-DK-01/02, UT-XM-01, UT-B1-01, UT-B5-01/02, UT-PT-01.
- CodeGraph: `npm run codegraph -- fn-impact PortalService.list` (2 hàm phụ thuộc: controller Portal và controller nội bộ) và `fn-impact PortalService.one` (23 hàm phụ thuộc, gồm 12 endpoint Portal/nội bộ). Graph OK, 5.742 node.
- Cấu hình runtime (đọc): `backend/.env` có `PORTAL_V2_ROLLOUT_ENABLED=true`, nên luồng đang chạy là intake cycle + chính sách theo phạm vi (`getPolicyForScope`). Đây là đường kiểm tra quyết định, không phải `portal.readiness.ts` (MVP1).

## 2. Kiểm chứng đã chạy (không ghi dữ liệu)

| Lệnh | Kết quả |
|---|---|
| `cd frontend && npm run test:portal` | 42/42 pass |
| `cd frontend && npm run test:portal-review` | 11/11 pass |
| `cd frontend && npm run test:tracking` | 4/4 pass |
| `cd backend && node scripts/run-tests.cjs test/portal.test.cjs test/portal-account-recovery… portal-approved-policy… portal-foundation*… portal-intake-cycle… portal-policy… portal-readiness… portal-snapshot… portal-tracking…` (dist hiện có, rollout tắt trong runner) | 93/93 pass |
| Đăng nhập Portal bằng tài khoản test `doanhnghiep.test@…` (README test-data) rồi chỉ GET `/api/portal/requests`, `/form-config` qua script tạm trong scratchpad | login 201; 18 đề nghị (17 DRAFT, 1 SUBMITTED). **Khóa top-level của mỗi dòng có `acceptedBy, assignedTo, assignmentVersion, assignedBy, assignedAt, assignedOfficer`**; hiện giá trị null vì tài khoản này không có đề nghị đã phân công. form-config: `intakeCycleEnabled=true, rollout=true, branchLimit=10000000000`, `requiredFields` gồm 22 trường (xem F-02). Không thấy khóa liên quan lãi suất. |
| Lần đăng nhập thử tài khoản QC `qc.dn20261109@…` | 401: tài khoản này không còn trong DB (SELECT `portal_accounts` chỉ còn 2 tài khoản). Ghi nhận để agent E2E không dùng tài khoản này. |
| `SELECT` `portal_requests` | 15/16 bản nháp V2 không có tên DN lẫn MST (DN-1, 2, 7–15, 17, 21, 22), DN-21/22 tạo ngày 11/11; không đề nghị nào > 10 tỷ; `loan_applications` 195 dòng, 0 dòng > 10 tỷ. |

Không chạy POST/PUT/DELETE nghiệp vụ, seed, migrate hay script `check-*`.

## 3. Bảng kết quả theo tính năng (A–G)

Ký hiệu: P = PASS, PA = PARTIAL, F = FAIL, NV = NOT VERIFIED, PP = PENDING POLICY. "code" = đọc code/test; "chạy" = đã chạy.

| # | Tính năng | A | B | C | D | E | F | G | Kết luận |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Đăng ký + OTP xác minh email | P | P (code+test) | P: OTP 6 số, 10 phút, cooldown 60s, tối đa 5 lần sai, chỉ lưu HMAC, lỗi SMTP → mã lỗi riêng và chuyển màn xác minh | P | PA: UT-DK-01, UT-DK-02, UT-XM-01 còn | – | test 93/93 | **PARTIAL** (chỉ lỗi hiển thị) |
| 2 | Đăng nhập / khóa tạm | P | P | P: 5 lần sai → khóa 15 phút; chưa xác minh bị chặn; throttle IP | P: JWT audience riêng `sme-enterprise-portal`, tách tài khoản cán bộ | P (code) | – | chạy login 201 | **PASS** |
| 3 | Quên/đặt lại mật khẩu | P | P | P: token 32 byte, băm SHA-256, 10 phút, dùng 1 lần, tăng `authVersion` thu hồi phiên cũ; phản hồi chung không lộ email | P | P | – | test recovery pass | **PASS** (chưa kiểm email thật – đúng DEC-03) |
| 4 | Wizard 5 bước + lưu nháp (DEC-09) | PA | P | P: CAS `expectedRevision` → 409 → màn đối chiếu; 2 tab cô lập bằng sessionStorage theo `accountId:draftId`; idempotent `clientRequestId` | PA: điều kiện "có tên hoặc MST" chỉ chặn ở FE (`canCreateDraft`), `PortalService.create` không kiểm | PA: dấu `*` thiếu ở 4 trường máy chủ bắt buộc (F-02) | – | DB 15 nháp rỗng | **PARTIAL** |
| 5 | Tải/thay/xóa tệp | P | P | P: 10 MB, 60 tệp, `clientUploadId` + hash chống ghi trùng, thay thế giữ nhóm, xóa V2 = rút (`withdrawnAt`) | P | NV (UI) | – | test pass | **PASS** (code) |
| 6 | Cam kết và Gửi | P | P | PA: tích cam kết làm `dirty` → khóa nút Gửi tới khi Lưu nháp (UT-B5-01); `window.confirm` (UT-B5-02) | P: server kiểm lại readiness, revision, danh sách tệp, hash tệp vật lý; tạo `PortalSubmission` tuần tự; thông báo QLCN | PA | Nhóm 2 (hàng đợi) nhận đúng `SUBMITTED`/`ASSIGNED` | code | **PARTIAL** |
| 7 | Danh sách + chi tiết + tiến độ | P | P | P: chống phản hồi muộn (`loadSequence/openSequence`), phiên đổi ở tab khác → yêu cầu đăng nhập lại | **F**: API danh sách/chi tiết trả `assignedOfficer{id,fullName,username}`, `assignedTo/By`, `acceptedBy` (UT-PT-01) | P (UI không hiển thị) | Nhóm 2 | chạy GET: khóa có trong phản hồi | **FAIL** (bảo mật dữ liệu) |
| 8 | Trả sửa / xin sửa từ cổng | P | P | P: chỉ SUBMITTED/ASSIGNED được xin sửa; 1 đề nghị chờ một lúc; nộp lại cùng mã; đổi MST bị chặn; review/vướng mắc lọc trường nội bộ (`reviewerId`, `description`, `proposal`) | PA: phản hồi POST `request-correction` (và PUT/upload/submit) trả bản ghi kèm `assignedOfficer` | NV | Nhóm 3 (kiểm tra checklist) | code | **PARTIAL** (cùng gốc UT-PT-01) |
| 9 | Hạn mức 10 tỷ + vốn lưu động | P | P | P: >10 tỷ được lưu nháp, UI cảnh báo + khóa Gửi; API chặn ở submit (`assertBranchAmount`), ở accept và trong assessment (`BRANCH_LIMIT`); đúng 10 tỷ hợp lệ; chỉ `VAY_VON_LUU_DONG` | P (FE/BE/DB nhất quán; DB 0 vi phạm) | P | Nhóm 3 accept chặn lại | chạy SELECT | **PASS** |
| 10 | Readiness FE ↔ BE | PA | – | – | PA: `REQUIRED_FOR_SUBMIT` (14) khớp `portal.readiness.ts` (13 + `revenuePeriod`) nhưng không khớp cổng gửi thật (22 `requiredFields`) | PA | – | chạy form-config | **PARTIAL / PP một phần** |
| 11 | Không lộ thông tin nội bộ | – | – | – | **F** (xem #7); `/status` và `/intake-cycle` sạch | – | – | chạy GET | **FAIL** |
| 12 | Portal không hiện lãi suất (DEC-13) | P | – | – | P: `buildTracking` không đọc số tiền/lãi suất duyệt; list/one không include loan | P | – | chạy GET: không khóa lãi suất | **PASS** |
| 13 | Mã DN-n ngắn | P | P | P (sequence, idempotent) | P | – | – | DB: DN-1…DN-22 | **PASS** |

## 4. Bug ứng viên

### F-01 · API cổng doanh nghiệp trả danh tính và mã người dùng cán bộ (trùng UT-PT-01, vẫn còn)
- Loại · Mức: Lỗi · **Chặn** (lộ dữ liệu nội bộ, vi phạm Master mục 2 "Giới hạn quyền quan trọng").
- Tái hiện: QLCN phân công một đề nghị → DN đăng nhập → `GET /api/portal/requests` hoặc `/api/portal/requests/:id` → xem JSON.
- Mong đợi: không có `assignedOfficer`, `assignedTo`, `assignedBy`, `acceptedBy`, `assignedAt`, `assignmentVersion`.
- Thực tế: `backend/src/modules/portal/portal.service.ts:27-29` (`include` có `assignedOfficer:{select:{id,fullName,username}}`), `:94` (`list` trả nguyên `rows` khi có `accountId`), `:103` (`one` trả nguyên `r`). Ngoài list/one, các phản hồi ghi của Portal cũng dùng cùng `include`: `update` `:159`, `upload` `:195`, `deleteDocument` `:210`, `submit` `:270/280`, `requestCorrection` (`portal.intake-workflow.ts:151,157`). Đã chạy GET 15/11: khóa có mặt trong mọi dòng (giá trị null vì tài khoản test hiện không có đề nghị được phân công). Không test nào khẳng định điều ngược lại; `test/portal-assignment.test.cjs:40` còn khẳng định include này.
- Module: backend portal (service + intake-workflow).
- Hướng xử lý: thêm hàm chiếu công khai cho mọi phản hồi trả về tài khoản doanh nghiệp (whitelist trường), giữ nguyên `include` cho `PortalIntakesController`. CodeGraph: `PortalService.one` có 23 hàm phụ thuộc, cần tách nhánh `accountId` để không ảnh hưởng màn nội bộ. Thêm test hợp đồng phản hồi Portal.

### F-02 · Dấu `*` bắt buộc trên wizard không khớp cổng gửi thật của máy chủ
- Loại · Mức: Cải tiến · Thấp (đọc code, chưa kiểm UI).
- Căn cứ: DEC-09 "danh sách ô bắt buộc phải khớp kiểm tra sẵn sàng của máy chủ". `frontend/src/portal/wizard.ts:26` (14 trường) khớp `portal.readiness.ts:14` (MVP1), nhưng khi rollout bật, gửi bị chặn theo `requiredFields` của `portal.approved-policy.ts:52-54` (22 trường; form-config chạy 15/11 xác nhận). Các ô hiển thị ở bước 1–2 nhưng không có `*`: `businessScope`, `representative.mode`, `hasExistingDebt`, `collateral.mode` (render bằng `<Field>` trực tiếp, `PortalWizard.tsx:199-210`), cùng các ô có điều kiện `serviceProofMode`, `representative.name`, `collateral.description`.
- Tái hiện: tạo đề nghị mới, điền đủ các ô có `*` ở bước 1–2, sang bước 5 → vẫn báo thiếu Phạm vi hoạt động / Tư cách người gửi / Dư nợ / Bảo đảm.
- Hướng xử lý: lấy danh sách bắt buộc từ `config.approvedIntakePolicy.policy.requiredFields` (+ điều kiện) thay cho hằng số; cần PO xác nhận DEC-09 tham chiếu cổng gửi thật hay readiness MVP1 (xem PENDING).

### F-03 · Điều kiện tạo bản nháp (DEC-09) chỉ chặn ở giao diện
- Loại · Mức: Cải tiến · Thấp.
- Căn cứ: `wizard.ts:13` `canCreateDraft` chỉ dùng ở FE; `portal.service.ts:112-143` `create` chấp nhận `data:{}`. DB: 15/16 nháp V2 rỗng tên và MST (DN-21/22 tạo 11/11, trước khi bản FE 13/11 có hiệu lực). Nháp rỗng làm đầy danh sách DN và tiêu thụ số DN-n.
- Hướng xử lý: kiểm cùng điều kiện ở `create` (400 tiếng Việt); không xóa nháp cũ khi chưa có quyết định PO.

## 5. Trạng thái bug cũ

| Mã | Trạng thái 15/11 | Bằng chứng |
|---|---|---|
| UT-DK-01 | **Còn** | `PortalAuth.tsx` ô mật khẩu đăng ký vẫn `minLength={8}`, form không `noValidate` → bong bóng trình duyệt chặn trước thông báo tiếng Việt. |
| UT-DK-02 | **Còn** | `portal.auth.ts:9` thông báo chung không thay đổi; FE không có dòng chỉ dẫn hộp thư local. |
| UT-XM-01 | **Còn** | `portal.mailer.ts:23` tiêu đề/nội dung vẫn tiếng Anh. |
| UT-B1-01 | **Đã sửa phần chính** | Khối "Nguồn doanh thu năm" giờ chỉ hiện ở bước 4 cùng nơi tải tài liệu (`PortalWizard.tsx:221`, `hidden={step!==4}`). Phần "ô xác nhận bị mất khi lưu" vẫn **không xác minh được** (cần thao tác tay; code `assign('annualRevenueBasis',…)` giữ cả hai khóa, chưa thấy lỗi lưu). |
| UT-B5-01 | **Còn** | `intake-cycle.ts` `canSendCycle` yêu cầu `!dirty`; `onDeclaration` gọi `assign` → `dirty=true`; phải Lưu nháp rồi chờ checklist mới. |
| UT-B5-02 | **Còn** | `PortalWizard.tsx:165` vẫn `window.confirm`. |
| UT-PT-01 | **Còn** | Xem F-01 (đã chạy GET xác nhận khóa có trong hợp đồng phản hồi). |

## 6. Tác động liên module

- F-01: sửa phải tách nhánh Portal khỏi `PortalIntakesController` (Nhóm 2 QLCN dùng `assignedOfficer` cho điều phối, Nhóm 3 CBTD dùng chi tiết nội bộ); `frontend/src/portal/model.ts:34` có khai báo kiểu `assignedOfficer` nhưng UI Portal không đọc → bỏ trường không làm hỏng giao diện Portal. Test `portal-assignment.test.cjs:40` cần giữ cho đường nội bộ.
- F-02/F-03: chỉ Nhóm 1; không chạm SLA, ML, Company, snapshot.
- 10 tỷ: chặn lặp lại ở accept (Nhóm 3) và tờ trình/quyết định (Nhóm 5–6, không thuộc nhóm này).
- Tiến độ Portal: 4 bước hiển thị (Tiếp nhận/Thẩm định/Phê duyệt/Hoàn tất) chỉ là nhãn cho DN, không tạo công đoạn Cấp trên; không lộ lãi suất, ML hay cán bộ.

## 7. PENDING PO

1. DEC-09 "kiểm tra sẵn sàng của máy chủ" là `portal.readiness.ts` (MVP1, đang khớp) hay `requiredFields` của chính sách gửi đang bật (đang lệch)? Quyết định này đổi kết luận F-02.
2. Xử lý 15 bản nháp V2 rỗng hiện có (giữ / ẩn / dọn) – thao tác dữ liệu cần PO chốt.
3. Đề xuất "chặn Tiếp tục theo trường bắt buộc từng bước" và "dấu hoàn thiện theo readiness" trong Review UX 05/11 vẫn CHƯA DUYỆT – không tính là lỗi.
4. MM-01 (SMTP thật) ngoài phạm vi local theo DEC-03.

## 8. Chưa xác minh

- Toàn bộ UI (bố cục, thông báo, mobile) – chỉ đọc code.
- Giá trị thật của `assignedOfficer` trên DB hiện tại: tài khoản test không có đề nghị đã phân công; kết luận dựa trên hợp đồng phản hồi + code + tái hiện ở phiên 09/11.
- Gửi thật, nộp lại sau trả sửa, xin sửa và tải tệp thật (cần ghi dữ liệu).
- Email OTP/đặt lại mật khẩu trong hộp thư 8025.
- Tài khoản QC `qc.dn20261109@sme-demo.test` ghi trong `test-data/portal-doanh-nghiep/README.md` không còn trong DB.

## 9. Test case cần kiểm lại (cho agent E2E / sau khi sửa)

1. TC-PT-01: sau phân công, GET list/one/PUT/upload/submit/request-correction từ Portal không chứa `assignedOfficer|assignedTo|assignedBy|acceptedBy|assignedAt|assignmentVersion`; màn QLCN vẫn thấy cán bộ.
2. TC-DK-01: mật khẩu `abc` → thông báo tiếng Việt cùng kiểu form.
3. TC-XM-01: thư OTP tiếng Việt trong hộp thư 8025.
4. TC-B5-01: đủ điều kiện, tích cam kết → nút Gửi bật mà không cần bấm Lưu nháp (hoặc tự lưu).
5. TC-B5-02: hộp xác nhận gửi theo giao diện cổng.
6. TC-B1-01: tích xác nhận năm hoàn thành ở bước 4, chuyển bước, tải lại → vẫn tích.
7. TC-REQ-01: các ô máy chủ bắt buộc đều có `*` (sau khi PO chốt mục 7.1).
8. TC-DRAFT-01: `POST /portal/requests` với `data:{}` bị từ chối (nếu PO duyệt F-03).
9. TC-LIM-01: đúng 10.000.000.000 gửi được; 10.000.000.001 lưu nháp được, không gửi được (UI + API).
10. TC-2TAB-01: hai tab sửa cùng nháp → tab sau nhận 409 và màn đối chiếu, không ghi đè.
