# G4-decision-sla — Audit nghiệm thu Nhóm 6 "Quyết định và kết thúc" + SLA PA1 (15/11/2026)

Chế độ: REVIEW ONLY. Không sửa source/DB/Master/Bug Log, không gọi API ghi. Không dùng trình duyệt → mọi nhận định giao diện là **đọc code, chưa kiểm UI**.

## 1. Phạm vi và nguồn

- Master: Nhóm 6 (dòng 524–550), "Review vai trò Cán bộ Thẩm quyền" (817–), review lãi suất `review-lai-suat-tham-quyen` + DEC-13 (892–1000), "Cấu hình SLA theo ngày làm việc" (1124–1163), C1–C12 (1481–1496), mục 7 (DEC-02, S1–S4, Hạn mức 10 tỷ, D4-04/D5-04, DEC-10, DEC-13).
- Source: `backend/src/modules/workflow/{workflow.service.ts, workflow.controller.ts, loan-policy.ts, dto/*, sla/sla-policy.ts, sla/working-time.ts}`, `backend/src/modules/rate-bands/rate-band.logic.ts`, `backend/src/modules/appraisal/appraisal.logic.ts`, `loan-applications.service.ts` (`makerCheckerRestrictions`, `slaSummary`, `rateDecision`), `portal/portal.tracking.ts`, `supplements/{supplement-deadlines.ts, supplement-reminders.service.ts}`, `dashboard.service.ts`; frontend `AppraisalDecisionPanel.tsx`, `DecisionResult.tsx`, `AppraisalWorkspace.tsx`, `appraisalWorkspace.ts`, `closeOverdue.ts`, `LoanDetailModal.tsx`, `slaDisplay.ts`.
- CodeGraph (OK, 5.742 node): `fn-impact transitionStage` → `WorkflowController.transitionStage`, `AppraisalService.mutate` (save/submit/clarify); `fn-impact workingDurationText` → `slaSummaryText`, `slaDeadlineCell`, `slaLeftText`, `LoanDetailModal`, `AppraisalEvidenceTabs`, `MyWarningsPanel`, Dashboard (`slaCell`, `SlaBottleneckTable`, `ManagerPeriod`), `AdminView.StageFacts`.

## 2. Kiểm chứng đã chạy (đều không ghi DB)

| Lệnh | Kết quả |
|---|---|
| `backend: node scripts/run-tests.cjs` với 11 file `workflow-decision`, `tham-quyen-decision`, `maker-checker`, `close-overdue`, `sla-working-days`, `sla-working-time`, `sla-pa1-display`, `sla-pa1-supplements`, `interest-rate`, `interest-rate-band`, `portal-tracking` (dist cùng ngày 14/11, không có source mới hơn) | 131/131 pass |
| `frontend: npm run test:sla-display / close-overdue / tracking / loan-detail / rate-bands / appraisal` | 12/12, 3/3, 4/4, 17/17, 6/6, 42/42 pass |
| `node --experimental-strip-types` gọi `workingDurationText` thật | 111,97→"13 ngày 8 giờ"; 39,96→"4 ngày 8 giờ"; 15,96→"1 ngày 8 giờ"; 7,96→"8 giờ" (UT-SLA-01 còn) |
| Script tái hiện trong scratchpad, gọi `WorkflowService.transitionStage` (dist) với tx giả lập | Hồ sơ quy trình cũ, Thẩm quyền là `intakeOfficerId` (không phải `assignedTo`): từ chối → OK REJECTED, phê duyệt → OK APPROVED; cùng điều kiện với hồ sơ chính sách → 403 |
| SQL `SELECT` trên `public` | xem mục 4 |
| API GET (đăng nhập `ha.le`, `thanh.ngo`, `nhung.nguyen`, `khoa.tran`) | xem mục 4 |

## 3. Bảng tính năng × tiêu chí A–G

Ký hiệu: P = PASS, Pa = PARTIAL, F = FAIL, NV = NOT VERIFIED, PP = PENDING POLICY. "code" = đọc code/unit test; "live" = có GET/SQL trên hệ thống chạy.

| # | Tính năng | A | B | C | D | E | F | G | Kết luận |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Phê duyệt (số tiền ≤ hạn mức chính thức, > 0) | P | P (code+test) | P | P | NV | P | P | PASS (code/test) |
| F2 | Từ chối (mã TC01–TC05, giải trình) | Pa | P | P (prototype keys, mã lạ) | Pa — Thẩm quyền chọn được TC05; `rejectionNote`/`notes` không giới hạn độ dài ở API | NV | Pa — 10 hồ sơ demo REJECTED/TC05 do Thẩm quyền | P | PARTIAL (B-02, PP-01) |
| F3 | Lãi suất DEC-13: trong khung, bước 0,01, khác đề xuất phải có lý do, chặn khi tờ trình chưa có đề xuất, chưa có khung thì chặn | P | P (live: hồ sơ duyệt `SME-20261021-8001` có `rateDecision` + khung 6,5–10,5) | P (test: ngoài khung, 3 số lẻ, thiếu lý do, chưa có khung, chưa có đề xuất) | P (FE `approvalRateCheck` = BE `assertRateInBand`/`decisionRateReason`) | NV | Pa — hồ sơ quy trình cũ duyệt không lưu khung (`rateDecision` chỉ ghi khi có tờ trình) | P | PASS, trừ nhánh quy trình cũ (B-01) |
| F4 | Maker-Checker 3 tầng theo `user.id` khi quyết định | Pa | P | Pa | **F với hồ sơ quy trình cũ**: BE chỉ chặn `assignedTo`, FE chặn cả `intakeOfficerId` | P (lý do khóa hiện trên form) | — | P (tái hiện bằng script) | PARTIAL (B-01) |
| F5 | Khóa dòng chống quyết định trùng (DEC-10, 2 Thẩm quyền) | P | P | P (FOR UPDATE + kiểm `completedAt`; `AppraisalService.mutate` khóa cùng dòng nên làm rõ/quyết định không đè nhau) | P | Pa — người thua cuộc không thấy thông báo lỗi (B-04) | P | P (DB: 0 hồ sơ có >1 dòng Hoàn tất, 0 công đoạn mở trùng) | PASS nghiệp vụ, UX PARTIAL |
| F6 | Hồ sơ quy trình cũ | Pa | P (code) | Pa | F (B-01) | NV | — | Pa (DB: chỉ còn `SME-1` đã duyệt, không có dòng lịch sử nào; 0 hồ sơ cũ đang mở) | PARTIAL — rủi ro tiềm ẩn |
| F7 | Chặn > 10 tỷ (UI + API, hồ sơ cũ chỉ từ chối) | P | P | P (BE `assertBranchAmount` cho hồ sơ chính sách, `amount > 1e10` cho phê duyệt; FE `canApprove` + ghi chú "chỉ có thể từ chối") | P | NV | P | P (DB: 0 hồ sơ duyệt vượt 10 tỷ/vượt hạn mức chính thức) | PASS |
| F8 | QLCN đóng quá hạn bổ sung (thủ công, D4-04) | P | P (test) | Pa — B-03 | P (BE+FE cùng chặn `assignedTo`/`intakeOfficerId`, live `canCloseOverdue` trả đúng) | Pa (B-03) | Pa — CBTD không được báo khi đóng (C9) | P | PARTIAL |
| F9 | Kết quả hiển thị CBTD / doanh nghiệp | P | P (live: CBTD khác bị 403; `DecisionResult` hiện số tiền, lãi suất, đề xuất, lý do, khung, người quyết định, thời điểm) | P (Portal chỉ hiện nhãn TC, mã lạ → nhãn trung tính) | P | NV | Pa — UT-PT-01 (lộ danh tính cán bộ qua API Portal) thuộc nhóm Portal | P | PASS (phần nhóm 6) |
| F10 | Lịch sử công đoạn | P | P (live: `SME-20261021-8001` 3 dòng, PA1, snapshot 112/40/8 giờ) | Pa — `notes` do client gửi, không giới hạn (B-05) | P | NV | P | P | PASS, có cải tiến |
| F11 | SLA PA1: giờ làm việc, lịch v2 tới 31/01/2027 | P | P (test 22+; live: DB kích hoạt v2 10/11, mọi dòng lịch sử dùng v2) | P (ngoài kỳ lịch → báo lỗi, không quay về 24/7) | P | Pa — UT-SLA-01 | P | P | PASS tính toán; hiển thị PARTIAL |
| F12 | Tạm dừng/chạy lại (chờ DN), làm rõ không dừng | P | P (live: hồ sơ `SME-20261030-8001` `waitingEnterprise=true`, `dueAt=null`, `slaRunning=false`) | P | P | NV | P | P | PASS |
| F13 | Snapshot định mức, Admin sửa không hồi tố | P | P (`slaStandardHours` lấy lúc mở công đoạn; `stageSlaSummary`, `isDelayed` dùng snapshot) | P (HOAN_TAT bị 400 khi sửa) | P | NV | Pa — Dashboard "điểm nghẽn" so trung bình với định mức hiện hành (chỉ là cờ, không phải KPI) | P | PASS |
| F14 | Giải ngân / cấp trên | — | — | — | — | — | — | — | Ngoài phạm vi (DEC-01), không phải bug |

## 4. Bằng chứng live (chỉ đọc)

- `loan_applications`: 4 hồ sơ ở Thẩm định (`SME-20261012-8003`, `-15-8001`, `-30-8002` tờ trình SUBMITTED không có lãi suất đề xuất; `SME-20261103-8001` CLARIFICATION_REQUIRED) → đúng C2 (PENDING PO, phê duyệt bị chặn đúng thiết kế). Cả 4 đã quá hạn SLA Thẩm định (`isOverdue=true`, net 45,7–70,5 giờ / 40).
- Duyệt: 138 hồ sơ chính sách + 1 hồ sơ cũ; lãi suất 6,50–11,49 (dữ liệu seed trước LS-2, không áp khung ngược — đúng D5/Q6). Sau 13/11 03:01 chỉ 2 hồ sơ được duyệt, cả 2 có sự kiện `RATE_DECIDED`.
- Từ chối: TC01 14, TC02 9, TC03 7, TC04 6, **TC05 10 (người quyết định đều có vai trò THAM_QUYEN, trạng thái REJECTED)**; 0 hồ sơ `CLOSED_TIMEOUT`.
- Khung: 3 khung (VLĐ 6,5–10,5; TSCĐ 7,5–12; Thấu chi 8–13), hiệu lực 13/11 — khớp DEC-13.
- `workflow_stages`: 112 / 40 / HOAN_TAT 8 (HOAN_TAT không dùng, FE hiện "Không tính SLA").
- `sla_policy_activations`: v1 05/11, v2 `VN-20260101-20270131-v2` 10/11.
- API: Thẩm quyền xem hồ sơ Tiếp nhận → 403; CBTD không phụ trách xem hồ sơ đã quyết định → 403; Thẩm quyền gọi `/admin/interest-rate-bands` → 403; Admin → 200.

## 5. Bug ứng viên

### B-01 · Hồ sơ quy trình cũ: API cho người tiếp nhận ban đầu tự quyết định (lệch Maker-Checker 3 tầng)
- Loại · Mức: Lỗi · Thấp (tiềm ẩn: DB hiện không có hồ sơ cũ đang mở; mọi hồ sơ mới đều gắn `BRANCH_POLICY`).
- Quy tắc: D4-04/D5-04 "kiểm tra độc lập 3 tầng theo `user.id`"; Nhóm 6 tình huống 4.
- Tái hiện: hồ sơ `businessPolicyVersion = null` ở Thẩm định, `assignedTo` = CBTD khác, `intakeOfficerId` = Thẩm quyền X → X gọi `POST /workflow/:id/transition` phê duyệt hoặc từ chối.
- Mong đợi: 403 như hồ sơ chính sách. Thực tế: thành công (script tái hiện: "OK APPROVED", "OK REJECTED"); FE lại khóa nút (`makerCheckerRestrictions` xét `intakeOfficerId`) → FE/BE không nhất quán.
- Bằng chứng: `workflow.service.ts:52` chỉ kiểm `assignedTo`; `assertIndependent` (`appraisal.logic.ts:83`) chỉ gọi trong `assertReportDecision` ở nhánh `if (loan.businessPolicyVersion)` (`workflow.service.ts:55-62`). Kèm theo: phê duyệt hồ sơ cũ không ghi `RATE_DECIDED` nên không lưu khung đã áp dụng (DEC-13 Q4/Q6).
- Hướng xử lý: gọi `assertIndependent` cho mọi hồ sơ ở Thẩm định; cân nhắc ghi khung cho nhánh cũ. Test: thêm ca hồ sơ cũ với `intakeOfficerId` vào `tham-quyen-decision.test.cjs`.

### B-02 · Thẩm quyền từ chối được bằng TC05 "Quá hạn thời gian bổ sung chứng từ"
- Loại · Mức: Lỗi · Thấp (đã được Master ghi "Chi tiết nhỏ chưa sửa: Thẩm quyền chọn được TC05" — xác nhận vẫn còn).
- Quy tắc: Nhóm 6 tình huống 5 / DEC-02 — TC05 là luồng riêng QLCN (`CLOSED_TIMEOUT`), "tách biệt hoàn toàn với thẩm quyền".
- Thực tế: `isPublicRejectionReasonCode` nhận TC05 cho Thẩm quyền (`workflow.service.ts:69`), form hiện TC05 (`appraisalWorkspace.ts:130-136`, `AppraisalDecisionPanel.tsx:81`), test `workflow-decision.test.cjs:233` còn khẳng định hành vi này. DB có 10 hồ sơ REJECTED/TC05 do Thẩm quyền (dữ liệu demo) → báo cáo "đóng do quá hạn" (0) và "từ chối" lẫn nghĩa.
- Hướng xử lý: chờ PO chốt (PP-01); nếu chặn thì lọc TC05 ở form và API cho `REJECTED`, sửa test và dữ liệu demo khi `demo:refresh`.

### B-03 · Popup QLCN vẫn hiện nút "Đóng hồ sơ do quá hạn" khi doanh nghiệp đã gửi đủ sau hạn; API trả "Hồ sơ chưa quá hạn bổ sung."
- Loại · Mức: Cải tiến · Thấp (đọc code, chưa kiểm UI).
- Tái hiện: yêu cầu bổ sung bị bộ quét đánh dấu `overdueAt`; sau đó DN gửi đủ (`waitingOn = BANK`); QLCN độc lập mở popup hồ sơ.
- Mong đợi: nút khóa kèm lý do "Doanh nghiệp đã gửi đủ; chờ ngân hàng kiểm tra" (như bảng Dashboard `OverdueSupplementsPanel.tsx:22`). Thực tế: `closeOverdue.ts canCloseOverdue` chỉ xét `status === 'PENDING' && overdueAt` nên nút hiện; BE (`workflow.service.ts:142`) chặn với thông báo sai nghĩa "chưa quá hạn". Trái tinh thần D5-04 "không để người dùng nhận lỗi bất ngờ".
- Hướng xử lý: API chi tiết trả `waitingOn` cho từng yêu cầu bổ sung, FE xét thêm; đổi thông báo BE thành "Doanh nghiệp đã gửi bổ sung, ngân hàng cần kiểm tra trước".

### B-04 · Thẩm quyền thao tác sau (thua khóa dòng) không thấy thông báo lỗi
- Loại · Mức: Cải tiến · Thấp (đọc code).
- Tái hiện: 2 Thẩm quyền cùng mở trang `/tham-dinh/<mã>`; A phê duyệt trước; B bấm xác nhận.
- Thực tế: BE trả 400 "Hồ sơ đã kết thúc…"; `AppraisalWorkspace.submitDecision` đặt `actionError` rồi `load()`; hồ sơ đã kết thúc nên trang hiện `DecisionResult` thay cho `AppraisalDecisionPanel` — `actionError` chỉ truyền vào panel (`AppraisalWorkspace.tsx:228`) nên bị mất. B thấy kết quả của A mà không biết thao tác của mình không được ghi. Dữ liệu vẫn đúng.
- Hướng xử lý: hiện `actionError` ở mức trang (hoặc thông báo "Hồ sơ đã được người khác quyết định").

### B-05 · Ghi chú lịch sử công đoạn do client tự soạn, API không giới hạn độ dài
- Loại · Mức: Cải tiến · Thấp.
- Thực tế: `TransitionStageDto.notes` và `rejectionNote` không có `MaxLength` (`dto/transition-stage.dto.ts`); `notes` (vd "Phê duyệt cấp tín dụng: … Lãi suất …") do FE ghép và được lưu nguyên vào `application_stage_history.notes` → gọi thẳng API có thể ghi nội dung không khớp số liệu quyết định thật. FE giới hạn 2000 ký tự cho giải trình.
- Hướng xử lý: server tự sinh ghi chú quyết định từ số liệu đã kiểm; thêm `MaxLength` cho `rejectionNote`.

## 6. Bug cũ trong Bug Log

| Mã | Trạng thái xác minh | Bằng chứng |
|---|---|---|
| UT-SLA-01 (Lỗi hiển thị · Thấp) | **Còn** | `frontend/src/slaDisplay.ts:38-45` không đổi logic (lấy phần nguyên ngày trước rồi làm tròn giờ); chạy thật hàm: 111,97→"13 ngày 8 giờ", 39,96→"4 ngày 8 giờ". `check-sla-display.mjs` chỉ kiểm 112/37,5/3 nên không bắt lỗi. Ảnh hưởng (CodeGraph): chi tiết hồ sơ, hàng việc Thẩm định, Dashboard, cảnh báo của tôi, Admin. |
| UT-BS-01 (nhóm Bổ sung, tham khảo vì liên quan hiển thị tạm dừng) | Đã sửa một phần (đọc code) | `slaStateLabel` có nhánh `BANK` "Ngân hàng đang kiểm tra phản hồi · SLA đang chạy"; nút `SupplementPanel.tsx:42` vẫn ghi "Hoàn tất yêu cầu & Chạy lại SLA". Thuộc nhóm Chứng từ, để nhóm đó kết luận. |
| Phiên 2 E1/E8/E9/E17/E19 (quyết định) | Vẫn đúng theo test | Test tương ứng trong `workflow-decision`, `maker-checker`, `tham-quyen-decision` pass. |

## 7. Tác động liên module

- Báo cáo/Dashboard: TC05 do Thẩm quyền (B-02) làm lệch thống kê "đóng do quá hạn" vs "từ chối"; UT-SLA-01 ảnh hưởng mọi nơi hiển thị thời lượng SLA.
- ML: không đụng (lãi suất, quyết định không là đặc trưng ML; `transitionStage` không chấm dự báo khi Hoàn tất).
- Portal: kết quả chỉ nhãn TC; UT-PT-01 (lộ danh tính cán bộ qua API Portal) thuộc nhóm Portal, chưa sửa trong lần này.
- Lịch SLA: sau 31/01/2027 mọi chuyển công đoạn PA1 bị 400 vì lịch không bao phủ (`computeStageClosing` ném lỗi) — đã chấp nhận ở C10.

## 8. PENDING PO

- PP-01: Thẩm quyền có được dùng TC05 không (B-02); nếu không, có dọn 10 hồ sơ demo khi `demo:refresh`.
- C1 khoản vay ưu tiên; C2 bốn hồ sơ kẹt chưa có lãi suất đề xuất (đã quá hạn SLA Thẩm định); C9 thông báo CBTD khi QLCN đóng quá hạn, form phê duyệt chưa có ô điều kiện; C10 lịch sau 31/01/2027.
- Master Nhóm 6 mục e tình huống 2 vẫn mô tả "0–100%" và "Vấn đề mở" dù DEC-13/LS-2 đã thay — chênh tài liệu, đề nghị PO cho cập nhật lời văn.

## 9. Chưa xác minh

- Toàn bộ giao diện (form phê duyệt/từ chối, khối kết quả, popup đóng quá hạn, nhãn SLA): chỉ đọc code.
- Hai Thẩm quyền đồng thời trên hệ thống chạy thật (không được ghi); dựa vào unit test + code khóa dòng + DB không có bản ghi trùng.
- Luồng đóng quá hạn trên `public`: hiện 0 yêu cầu quá hạn.
- Nhãn "Quá hạn" màu đỏ trên giao diện với 4 hồ sơ quá hạn Thẩm định.

## 10. Test case cần kiểm lại

1. Hồ sơ cũ: Thẩm quyền là người tiếp nhận ban đầu gọi API phê duyệt/từ chối → mong đợi 403 (B-01).
2. Thẩm quyền chọn TC05 trên form và qua API (B-02, sau khi PO chốt).
3. QLCN mở popup hồ sơ đã quá hạn nhưng DN đã gửi đủ → nút khóa có lý do (B-03).
4. Hai Thẩm quyền bấm phê duyệt gần đồng thời → người sau thấy thông báo rõ (B-04).
5. Hiển thị SLA còn 111,97 / 39,96 / 7,96 giờ → "14 ngày"/"5 ngày"/"1 ngày" hoặc "13 ngày 7,9 giờ"… (UT-SLA-01).
6. Sau `demo:refresh` (C2/C11): luồng CBTD trình có lãi suất → làm rõ → trình lại → phê duyệt trong khung, có lý do khác đề xuất; kiểm `DecisionResult` khổ 375/768/1280.
7. Admin đổi định mức Thẩm định khi có hồ sơ đang mở → hồ sơ đang mở giữ 40 giờ, hồ sơ vào sau dùng định mức mới (chỉ trên schema tạm).
