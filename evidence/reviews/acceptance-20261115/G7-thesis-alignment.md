# G7-thesis-alignment — Đối chiếu Báo cáo khóa luận ↔ Master ↔ Hệ thống (15/11/2026)

Chế độ: REVIEW ONLY. Không sửa source, DB, Master, Google Doc.

## 0. Nguồn và phạm vi đã đọc

| Nguồn | Cách đọc | Phạm vi đã đọc |
|---|---|---|
| Báo cáo khóa luận (Google Doc `1i1PRxo1cZhtTnRpX1GtCP9zzzvboxTwb`, tiêu đề tệp "BÁO CÁO KHÓA LUẬN TỐT NGHIỆP NHD89 BAN 1.docx") | `read_doc` (thành công), trích văn bản bằng script vào scratchpad | **100% phần văn bản** (1.115 dòng, gồm bảng). Hình ảnh (16 inline + 3 positioned) chỉ xác định được vị trí, không đọc được nội dung hình |
| `docs/SME_MASTER.md` | grep + đọc mục 1, 2, Cấu hình SLA (dòng 1124–1163), Dashboard (1286–1322), mục 5, 6, 7 | Chỉ phần liên quan |
| Hệ thống | đọc code; `SELECT` DB `sme_loan`; `cd backend && npm test` | Xem từng điểm |

Tình trạng hoàn thiện của báo cáo (quan sát trực tiếp): **chỉ có nội dung Chương 1, 2 (trừ 2.4), 3 (trừ hình 3.4–3.6), 5.** Mục 2.4, Chương 4 (4.1–4.3), Chương 6, 7, 8 **chỉ có tiêu đề, không có nội dung**. Mục 3.4 (BPMN), 3.5 (sơ đồ trạng thái), 3.6 (sơ đồ chức năng) **không có hình** (vị trí hình chỉ có ở 3.7 và 9 mục "Phân rã use case", 5.1, 5.2.2, 5.2.3). Có 2 chỗ "[SẼ BỔ SUNG SAU]" (5.2.2, 5.2.3) và NFR "Thời gian phản hồi … không vượt quá … giây" (3.2.2) còn để trống.

## 1. Bảng đối chiếu theo chủ đề

Ký hiệu kết luận: **Khớp** · **BC** = Báo cáo cần cập nhật · **MS** = Master cần cập nhật · **CODE** = Code lệch Master · **PENDING PO**.

### 1.1 Mục tiêu và phạm vi đề tài

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| T1 | 1.5.2: hệ thống "không phải cổng thông tin để doanh nghiệp trực tiếp đăng ký"; ngoài phạm vi có "Hệ thống để doanh nghiệp tự đăng ký vay trực tuyến". Mâu thuẫn ngay với 2.3, 3.2.1 (DN đăng ký, lập đề nghị trên cổng) và UC 3.8.1–3.8.5 | Mục 1, bước 1–3, 14: Portal V2 là điểm bắt đầu luồng; Actor 1 = Doanh nghiệp | `backend/src/modules/portal/portal.auth.ts` (đăng ký, OTP), `navigation`/`frontend/src/portal/*` | **BC — Cao** (hội đồng dễ bắt mâu thuẫn nội tại) |
| T2 | Tóm tắt/Abstract: hướng phát triển "áp dụng SLA theo giờ làm việc" | S1–S4 (mục 7): PA1 đã áp dụng; Cấu hình SLA 05/11 | DB `sla_policy_activations`: PA1 kích hoạt 05/11 (lịch v1) và 10/11 (lịch `VN-20260101-20270131-v2`); `prediction.service.ts:44` chỉ dự báo khi PA1 | **BC — Cao** (đã làm lại ghi là chưa làm; mâu thuẫn với 2.1.3, 2.3, 3.3, 5.2) |
| T3 | 1.4: vai trò "danh sách sẽ tiếp tục được điều chỉnh", liệt kê "cấp quản lý hoặc phê duyệt" | Mục 2: đúng 5 actor đã chốt | DB `roles`: QUAN_LY, CBTD, THAM_QUYEN, ADMIN (+ tài khoản Portal) | **BC — Vừa** (văn phong đề cương, chưa chốt) |
| T4 | 2.3: "một chi nhánh và một sản phẩm vay vốn lưu động" | DEC-01 một chi nhánh; DEC-13 khung lãi suất 3 loại vay (VLĐ, Đầu tư TSCĐ, Thấu chi); Portal: sản phẩm VLĐ (sản xuất/thương mại/dịch vụ) | DB: `loan_applications.loan_type` VAY_VON_LUU_DONG 169, VAY_DAU_TU_TSCD 26; `interest_rate_bands` 3 khung | **BC — Vừa** (cần nói rõ: Portal chỉ VLĐ; nội bộ/demo có thêm TSCĐ, khung có Thấu chi) — nếu PO muốn chỉ 1 sản phẩm thì **PENDING PO** |
| T5 | 1.5.2 ngoài phạm vi: giải ngân, thu nợ, CIC, core banking… | Ranh giới: không giải ngân, phê duyệt/từ chối là kết thúc | DB `workflow_stages.stage_name` của HOAN_TAT = **"Hoàn tất & Phê duyệt giải ngân"**; tên này hiện ở lịch sử công đoạn (`LoanDetailModal.tsx:933`, `AppraisalEvidenceTabs.tsx:134`, `DashboardKit.tsx:138`); 184 dòng lịch sử HOAN_TAT | Báo cáo **Khớp** Master; **CODE/dữ liệu lệch** (nhãn "giải ngân" — đọc code, chưa kiểm UI). THAM_DINH tên "Thẩm định hồ sơ & Năng lực rủi ro" cũng khác cách gọi của báo cáo |
| T6 | 2.1.2: "khoản vay vượt thẩm quyền… trình lên cấp cao hơn" (lý thuyết chung); phỏng vấn Q4: >10 tỷ gửi cấp cao hơn | Hạn mức 10 tỷ: hồ sơ mới >10 tỷ bị chặn UI/API, không có Cấp trên | DB: max `proposed_amount`/`official_amount` = 10.000.000.000 | **BC — Thấp/Vừa**: nên thêm 1 câu "trong hệ thống, đề nghị >10 tỷ bị chặn, không có công đoạn Cấp trên" để khớp với phỏng vấn; UC 3.8.8 chỉ nói hạn mức chính thức |
| T7 | Master mục 1 mở đầu: "quy trình thẩm định nội bộ đa tầng" | — | 3 công đoạn | **MS — Rất thấp** (dễ hiểu nhầm có nhiều cấp) |

### 1.2 Actor và phân quyền

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| A1 | 3.2.1/3.8.2: 5 actor DN, CBTD, Thẩm quyền, QLCN, Quản trị viên | Mục 2 đúng 5 actor | `navigation.ts` | **Khớp** |
| A2 | 3.8.2 trang đầu: CBTD → "Danh sách hồ sơ"; Admin → "Liên hệ cá nhân"; Thẩm quyền và QLCN → "Dashboard tổng quan" | Dashboard 12/11: CBTD vào thẳng Dashboard (PENDING mục 6 của mục Dashboard) | `frontend/src/navigation.ts` `getDefaultTab`: CBTD → dashboard, THAM_QUYEN → **appraisal** (Thẩm định & phê duyệt), ADMIN/QUAN_LY → dashboard | **BC — Vừa** (3/4 vai trò lệch). Việc CBTD vào Dashboard còn trong danh sách PENDING PO của Master |
| A3 | 3.2.1 Quản trị viên: chỉ tạo/sửa/khóa tài khoản, cấu hình SLA. 3.3: "Quản trị viên không có chức năng nghiệp vụ" | DEC-11 Lịch sử hoạt động; DEC-13 Khung lãi suất; DEC-12 Admin xem mọi màn nghiệp vụ ở chế độ chỉ xem + dashboard 2 tab | Menu ADMIN: Dashboard, Liên hệ cá nhân, Liên hệ doanh nghiệp, Cấu hình SLA, **Khung lãi suất**, Danh sách hồ sơ, Thẩm định & phê duyệt, Điều chuyển & phân công, **Lịch sử hoạt động** (`navigation.ts:25–34`) | **BC — Cao** (thiếu 2 chức năng mới và quyền chỉ xem) |
| A4 | 3.2.1 Thẩm quyền: "Thẩm định hồ sơ và yêu cầu doanh nghiệp bổ sung chứng từ khi cần" | Actor 3 không liệt kê yêu cầu bổ sung; C9: "Thẩm quyền còn yêu cầu bổ sung/xác nhận đủ/chạy lại dự báo ngoài danh sách chức năng" (backlog) | Chưa xác minh code chi tiết | **PENDING PO (C9)** — báo cáo đang mô tả như chức năng chính thức |
| A5 | 2.1.3 maker-checker: người tiếp nhận/đang phụ trách không được thẩm định/phê duyệt; UC 3.8.12.2 thêm "lập tờ trình" | D5-04: 3 tầng (assignedTo, intakeOfficerId, người từng soạn/trình tờ trình) | — | **Khớp** (2.1.3 nên bổ sung tầng thứ 3 cho đủ) |
| A6 | 3.2.1/3.3: QLCN đóng quá hạn, không đóng hồ sơ mình phụ trách/tiếp nhận | D4-04, DEC-02 | — | **Khớp** |
| A7 | 3.2.1 CBTD/Thẩm quyền/QLCN: không nói tới đề nghị điều phối/COI của CBTD; nhưng có UC 3.8.13.4 "Duyệt đề nghị điều phối" | Actor 2: CBTD gửi đề nghị điều phối/COI; DEC-06, DEC-10 | — | **BC — Thấp** (thiếu UC phía CBTD gửi đề nghị điều phối/COI) |
| A8 | 3.2.2: khóa 15 phút sau 5 lần sai; mật khẩu ≥ 8 | — | `auth/login-throttle.ts:16–17` (5 lần/15 phút, cửa sổ trượt "khóa thử", không khóa vĩnh viễn); Portal mật khẩu ≥8 có chữ và số (`portal.auth.ts:14`) | **Khớp** (có thể ghi rõ "tạm chặn đăng nhập" và Portal yêu cầu chữ+số) |
| A9 | 3.3: OTP hiệu lực 10 phút, gửi lại chờ 60 giây | — | `portal.auth.ts:54,56` (600000 ms, 60000 ms) | **Khớp** |

### 1.3 Quy trình

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| P1 | 2.1.2, 3.3: 3 công đoạn Tiếp nhận → Thẩm định → Hoàn tất, một chiều | Mục 1, mục 6 | DB `workflow_stages` 3 dòng; trạng thái hiện có RECEIVED/CHECKED/SUPPLEMENT_REQUIRED/PENDING_APPRAISAL/APPROVED/REJECTED | **Khớp** |
| P2 | Không giải ngân (1.5.2); phê duyệt/từ chối là kết thúc (UC 3.8.12) | Ranh giới | Xem T5 (nhãn DB) | **Khớp** (trừ T5) |
| P3 | Hạn mức 10 tỷ (2.3, UC 3.8.8) | Hạn mức 10 tỷ | DB max = 10 tỷ | **Khớp** |
| P4 | 3.3 bổ sung: ngày 5 nhắc + email DN (Portal), ngày 10 quá hạn, cuối tuần lùi sang thứ Hai, không tự đóng | DEC-02/TK-07/TK-08 | `supplements/supplement-reminders.service.ts:20,133` | **Khớp** (email DN: đọc code chưa kiểm hộp thư) |
| P5 | TC01–TC05 (UC 3.8.12.3) | Nhóm 6 | `portal.tracking.ts:6–14`, `workflow.service.ts:69` | **Khớp** |
| P6 | UC 3.8.4: Portal theo dõi 4 mốc Tiếp nhận, Thẩm định, Phê duyệt, Hoàn tất | Bước 14 | `portal.tracking.ts:21` | **Khớp** |
| P7 | Phỏng vấn Q11 "không đạt thì loại, không cần lưu"; hệ thống lưu lý do từ chối | Nhóm 6 | `loan_applications.rejection_reason_code/note` | **BC — Thấp**: nên giải thích lý do thiết kế khác ý kiến phỏng vấn |

### 1.4 SLA PA1

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| S1 | 2.1.3: Tiếp nhận 14 ngày (112 giờ), Thẩm định 5 ngày (40 giờ), Hoàn tất không tính; giờ 08–12, 13–17 T2–T6; ví dụ 16/11 08:00 → 04/12 17:00; snapshot | Cấu hình SLA 05/11 | DB `workflow_stages`: 112/40 giờ | **Khớp** |
| S2 | 2.1.3: lịch ngày nghỉ "hiện đến hết 31/12/2026" | C10: lịch v2 tới 31/01/2027; nhưng Master dòng ~1134 (lịch v1 2026), ~1438 mục 5 ("lịch làm việc chỉ tới 31/12/2026"), S1–S4 mục 7 ("lịch 2026") chưa cập nhật | DB: kích hoạt `VN-20260101-20270131-v2` ngày 10/11/2026 | **BC — Vừa** và **MS — Vừa** (Master tự mâu thuẫn) |
| S3 | 2.1.3 tạm dừng: tới lúc ghi nhận đủ (Portal tự ghi; quầy CBTD xác nhận); làm rõ không dừng. 3.3 viết khác: "tiếp tục khi doanh nghiệp gửi phản hồi" | S1–S4 | — | 2.1.3 **Khớp**; 3.3 **BC — Thấp** (ghi lại cho thống nhất) |
| S4 | UC 3.8.17: bước 0,5 ngày (bội số 4 giờ), áp dụng cho công đoạn mở sau | Cấu hình SLA | `admin.controller.ts` (theo Master) | **Khớp** (thiếu ý: mỗi lần sửa SLA ghi nhật ký quản trị, DEC-11) |

### 1.5 Vai trò ML

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| M1 | 1.5.3, 2.3, 3.3, 5.2.1: chỉ dự báo trễ SLA, không quyết định tín dụng; DN không thấy | DEC-04, M3 | Portal tracking không có trường dự báo | **Khớp** |
| M2 | **3.3: "Khi công đoạn tính SLA theo giờ làm việc thì dự báo hiển thị 'không áp dụng' vì mô hình chưa huấn luyện lại"** | Mục 5 v4: chỉ dự báo khi PA1; công đoạn cách cũ trả "chưa có dự báo". Riêng dòng "ML: … hiện 'Chưa có dự báo tương thích PA1'" trong mục Cấu hình SLA 05/11 là ghi chú cũ chưa đánh dấu đã thay thế | `prediction.service.ts:24,44` (`LEGACY_SLA` khi KHÔNG phải PA1); DB `delay_predictions`: 30 dòng `v4.0-TIEP_NHAN`, 41 dòng `v4.0-THAM_DINH` | **BC — Cao** (ngược hoàn toàn với hệ thống và với chính mục 5.2 của báo cáo). **MS — Thấp** (đánh dấu dòng cũ đã thay thế) |
| M3 | 3.3: "tự tính dự báo khi hồ sơ vào Thẩm định" | Thời điểm chấm: tiếp nhận (MM-02), tạo tại quầy, trình tờ trình, làm rõ, hoàn tất bổ sung, điều chuyển, 08:00/13:00, chạy lại | `prediction-scheduler.service.ts:8` [8,13] | **BC — Vừa** (5.2.3 thì đúng; 3.3 sai) |
| M4 | 5.2.2/Bảng 5.3–5.4: log-loss 0,3738/0,3638, 0,4557/0,4585; AUC 0,824/0,797 và 0,720/0,687; Brier 0,0280/0,0353 và 0,1765/0,2048; Khẩn 78,4%/76,3% và 57,7%/86,5%; báo nhầm 0,3% và 13,7%; AUC lúc vào 0,557/0,634; ngưỡng 0,35/0,60; Thẩm định bỏ Chú ý | Mục 5 | `ml-service/app/model/model_metadata.json` (kịch bản C_112_40) — đã đọc, **trùng toàn bộ**; 31/31 kiểm tra chất lượng (`ml-service/README.md:224`); 106.705 dòng có trong `quality_report_v4.json` | **Khớp** |
| M5 | 2.2.2/5.2.1: BPI Challenge 2012 chỉ lấy hình dạng phân phối | Mục 5 | — | **Khớp** |
| M6 | 3.2.1 Thẩm quyền: "Danh sách cảnh báo không gồm hồ sơ đang ở Tiếp nhận" | Không thấy quy tắc này trong Master | Chưa xác minh | **NOT VERIFIED** |

### 1.6 Lãi suất (DEC-13)

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| L1 | Không có mục/quy tắc nào về lãi suất đề xuất, khung lãi suất theo loại vay, menu Khung lãi suất | DEC-13 | DB `interest_rate_bands` 3 khung (VLĐ 6,50–10,50; TSCĐ 7,50–12,00; Thấu chi 8,00–13,00); `AppraisalDecisionPanel.tsx:17–27` (`proposedRate`, `band`) | **BC — Cao** |
| L2 | UC 3.8.9 tờ trình "8 ô nội dung"; ngoại lệ chỉ "thiếu phân tích hoặc kết luận" | DEC-13: lãi suất đề xuất bắt buộc trong tờ trình | Như trên | **BC — Cao** |
| L3 | UC 3.8.12.2 Phê duyệt: ngoại lệ "lãi suất ngoài khoảng 0–100%" | DEC-13: chặn cứng ngoài khung sàn–trần; khác đề xuất phải ghi lý do; tờ trình chưa có đề xuất thì không phê duyệt | DB: lãi suất hồ sơ trong khoảng 6,50–11,49 | **BC — Cao**. **MS — Vừa**: sơ đồ mục 1 (nút Q) và bước 14 vẫn ghi "Lãi suất 0-100%" |
| L4 | — | C1 khoản vay ưu tiên (trần 4%) | Hệ thống chưa phân biệt | **PENDING PO (C1)** — nếu chọn B thì báo cáo phải ghi vào phần hạn chế |

### 1.7 Portal V2, Dashboard, Nhật ký quản trị

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| V1 | UC 3.8.3: 5 bước Thông tin DN → Nhu cầu vay → Phương án vốn → Hồ sơ tài liệu → Rà soát; tệp ≤10 MB | Bước 2–3: chọn sản phẩm VLĐ, khai năm tài chính, tài liệu 4 nhóm A–D, cam kết đại diện pháp luật (V0-A–V4-A); DEC-09 bản nháp | Chưa đối chiếu UI từng bước | **BC — Thấp/Vừa**: thiếu chọn sản phẩm, cam kết đại diện, nhóm A–D. Tên bước: **NOT VERIFIED** |
| D1 | UC 3.8.14.2 "Bảng Cảnh báo Sớm AI"; UC 3.8.14.3 KPI "Hồ sơ đang xử lý", "Tỷ lệ đúng hạn SLA", "Cảnh báo Khẩn", "Hồ sơ đã phê duyệt", "Phân tích Điểm nghẽn Quy trình SLA"; chỉ mô tả dashboard của QLCN | DEC-12: dashboard theo 4 vai trò, mỗi vai trò một API; "Sắp hết hạn SLA" ≤ 8 giờ làm việc | `frontend/src/components/dashboard/*`: không còn chuỗi "Cảnh báo Sớm"; tiêu đề hiện hành ví dụ "Dự báo nguy cơ trễ SLA", "ML cảnh báo nguy cơ trễ", "Hồ sơ cần giám sát và điều phối", "Điểm nghẽn SLA theo công đoạn (lũy kế)"; có `OverdueSupplementsPanel` "Hồ sơ quá hạn bổ sung chứng từ" | **BC — Vừa** (nhãn cũ + thiếu dashboard CBTD/Thẩm quyền/Admin). Đọc code, chưa kiểm UI |
| D2 | UC 3.8.14.3 báo cáo theo kỳ: 7 ngày/30 ngày/tháng/quý/năm, tối đa 366 ngày | PeriodReport dùng chung | — | **Khớp** (thông báo lỗi: NOT VERIFIED) |
| N1 | Không có UC/BR nhật ký quản trị | DEC-11: 5 loại thao tác (+ khung lãi suất), chỉ thêm, chỉ Admin xem | DB `admin_audit_logs`: USER_UNLOCKED 1, USER_PROFILE_UPDATED 2, INTEREST_RATE_BAND_CREATED 3, USER_LOCKED 1 | **BC — Cao** |

### 1.8 Sơ đồ nghiệp vụ và trạng thái hồ sơ

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| G1 | 3.4.1, 3.4.2 BPMN, 3.5 sơ đồ trạng thái, 3.6 sơ đồ chức năng: **không có hình** | Mục 1 (flowchart 14 bước), mục 4 (trạng thái) | Trạng thái DB: xem P1 | **BC — Cao** (thiếu nội dung cốt lõi) |
| G2 | 3.7 và 9 hình phân rã use case | — | — | **NOT VERIFIED** (không đọc được nội dung hình) |
| G3 | Chương 4 (sơ đồ lớp, CSDL, kiến trúc) trống | SME_KY_THUAT | — | **BC — Cao** |

### 1.9 Số liệu kiểm thử/đánh giá trích trong báo cáo

| # | Báo cáo | Master | Hệ thống | Kết luận |
|---|---|---|---|---|
| K1 | 5.2.3: "toàn bộ 427 kiểm thử của máy chủ đạt ở lần chạy cuối" | Mục 6: 498/498 (13/11), dòng C3: 502/502 (15/11) | **Chạy 15/11/2026: `cd backend && npm test` → 502 pass / 0 fail** | **BC — Vừa** |
| K2 | 5.2.3 "[SẼ BỔ SUNG SAU] bảng kịch bản kiểm thử tích hợp"; 6.3 Kiểm thử trống | C11: E2E 38/38 lần cuối 10/11, chưa chạy lại; C3: `check-portal-v2-intake` 105/105, `check-sme-rollout` 136/136, `check-pa1-evidence` 122/122 (schema tạm) | — | **BC — Cao** + **PENDING PO (C11)**: số liệu E2E cuối cùng phụ thuộc lần chạy sau `demo:refresh` |
| K3 | 5.1: React 18, PostgreSQL 16, NestJS, FastAPI, scikit-learn ghim phiên bản | — | `frontend/package.json` react ^18.3.1; `docker-compose` postgres:16-alpine | **Khớp** |

### 1.10 Lỗi trình bày trong báo cáo (không ảnh hưởng nghiệp vụ)

- Đánh số bảng: "Bảng 3.:" (2 chỗ, mục 3.1.2, 3.1.3); Bảng 3.24 nhảy sang 3.26; "Bảng 3.27" và "Bảng 3.28" mỗi số dùng 2 lần (3.8.14.2/3.8.16.4; 3.8.14.3/3.8.17); "Bảng 1.1" nằm trong Chương 2.
- Danh mục viết tắt chứa PHP, MVC (không dùng) nhưng thiếu SLA, CBTD, DN/DNNVV, ML, BPMN, PA1, OTP, COI, LOS.
- 3.2.2 NFR thời gian phản hồi để trống "…".
- Lời cảm ơn/nhận xét: không đối chiếu.

## 2. Phát hiện ngoài báo cáo (Master/Code)

| Mã | Nội dung | Bằng chứng | Loại/Mức (đề xuất) |
|---|---|---|---|
| G7-C1 | Tên công đoạn HOAN_TAT trong DB "Hoàn tất & Phê duyệt giải ngân" mâu thuẫn ranh giới "không giải ngân"; tên được render ở lịch sử công đoạn | `SELECT stage_name FROM workflow_stages`; `LoanDetailModal.tsx:933`, `AppraisalEvidenceTabs.tsx:134`, `DashboardKit.tsx:138`; 184 dòng `application_stage_history` HOAN_TAT | Lỗi hiển thị / Vừa (ảnh hưởng demo nếu hội đồng mở lịch sử công đoạn). Hướng: đổi tên hiển thị (dữ liệu hoặc map nhãn ở frontend) — cần PO duyệt vì chạm DB. Chưa kiểm UI |
| G7-M1 | Master mâu thuẫn về lịch SLA: C10 (v2 tới 31/01/2027) vs dòng ~1134, ~1438, S1–S4 ("2026", "31/12/2026") | grep Master | Master cần cập nhật / Thấp |
| G7-M2 | Master sơ đồ mục 1 + bước 14 ghi "Lãi suất 0-100%" sau DEC-13 | Master dòng 68 | Master cần cập nhật / Thấp |
| G7-M3 | Master mục Cấu hình SLA: "ML: … 'Chưa có dự báo tương thích PA1'" chưa đánh dấu đã bị v4 thay thế (nguồn có thể đã khiến báo cáo ghi sai M2) | Master dòng ~1146 | Master cần cập nhật / Thấp |
| G7-M4 | Master mục 1 "thẩm định nội bộ đa tầng" | Master dòng 36 | Rất thấp |

## 3. Tài liệu cần cập nhật

1. **Báo cáo khóa luận** (ưu tiên): Tóm tắt/Abstract (T2); 1.4 (T3); 1.5.2 (T1); 2.1.3 (S2, A5); 2.3 (T4); 2.4; 3.2.1 (A3, A4, A7, L1); 3.2.2 (NFR trống); 3.3 (M2, M3, S3, L1, N1); 3.4–3.6 hình; 3.8.2 (A2); 3.8.9 (L2); 3.8.12.2 (L3); 3.8.14 (D1); thêm UC Khung lãi suất, Nhật ký quản trị, Dashboard theo vai trò, Gửi đề nghị điều phối/COI; Chương 4, 6, 7, 8; 5.2.3 (K1, K2); đánh số bảng, danh mục viết tắt.
2. **docs/SME_MASTER.md**: G7-M1..M4.
3. **Dữ liệu/code** (cần PO duyệt): G7-C1.

## 4. PENDING PO liên quan báo cáo

- C1 khoản vay ưu tiên: quyết định A/B quyết định nội dung phần hạn chế/lãi suất trong báo cáo.
- C9: Thẩm quyền yêu cầu bổ sung có phải chức năng chính thức không (báo cáo đang ghi là có).
- C11/C2: số liệu E2E cuối cùng để đưa vào 6.3/7.1 (chạy sau `demo:refresh`).
- Mục Dashboard PENDING (6): CBTD vào thẳng Dashboard — báo cáo phải theo quyết định cuối.
- T4: phạm vi sản phẩm (chỉ VLĐ hay 3 loại vay).

## 5. Chưa xác minh

- Nội dung toàn bộ hình trong báo cáo (use case, phân rã, kiến trúc, luồng dự báo).
- Tên các bước wizard Portal, thông báo lỗi UI trích trong UC (chỉ đọc code mẫu, không kiểm UI).
- M6 (cảnh báo của Thẩm quyền loại hồ sơ Tiếp nhận); email nhắc DN ngày 5 thực gửi.
- Hiển thị thực tế nhãn "giải ngân" trên UI (G7-C1).

## 6. Lệnh đã chạy (chỉ đọc)

- `read_doc` Google Doc (thành công; JSON 1,74 triệu ký tự → trích văn bản trong scratchpad).
- `docker exec sme-loan-workflow-db-1 psql … -c "SELECT …"` trên `workflow_stages`, `sla_policy_activations`, `interest_rate_bands`, `delay_predictions`, `admin_audit_logs`, `loan_applications`, `application_stage_history`, `roles/user_roles`.
- `cd backend && npm test` → 502/502 pass.
- Đọc `ml-service/app/model/model_metadata.json` (kịch bản C_112_40).
