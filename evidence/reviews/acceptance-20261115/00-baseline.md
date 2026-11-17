# Baseline chung — Audit nghiệm thu nghiệp vụ SME (15/11/2026)

Repo: `T:\KhoaLuanTotNghiep\sme-loan-workflow`, nhánh `main`, commit `2919694` + thay đổi chưa commit chỉ ở `backend/scripts`, `frontend/scripts` (gói C3 khung lãi suất cho script) và `docs/SME_MASTER.md`. Source `backend/src`, `frontend/src`, `ml-service` không đổi so với commit.
Hệ thống local đang chạy: backend http://localhost:3000/api (bản build ngày 13/11), frontend http://localhost:5173, ML http://localhost:8000, DB Postgres container `sme-loan-workflow-db-1` (user `sme_user`, db `sme_loan`, schema `public`). CodeGraph OK (5.742 node): dùng `npm run codegraph -- context|deps|fn-impact <...>` từ root, KHÔNG chạy `graph:build`.

## Nguồn đối chiếu (thứ tự ưu tiên)
1. `docs/SME_MASTER.md` = baseline nghiệp vụ: mục 1 (luồng 14 bước), 2 (5 actor), 3 (7 nhóm chức năng + các mục review con), 4 (trạng thái, lịch sử đợt, E2E), 5 (ML), 6 (bàn giao, bảng C1–C12 việc chờ chốt), 7 (DEC-01..DEC-13 và ranh giới bất biến). Chỉ đọc phần liên quan nhóm của bạn (dùng grep tìm tiêu đề), không đọc cả file 1.600 dòng.
2. Quyết định PO = mục 7 + các bảng "PO duyệt" trong từng mục.
3. Source/DB/hệ thống = bằng chứng triển khai, không tự là chuẩn.
4. `docs/SME_KY_THUAT.md` cho kiến trúc/vận hành khi cần.
Sai lệch: code ≠ Master đã duyệt → sai lệch triển khai (có thể là bug). Master thiếu/chưa rõ hoặc mục còn PENDING (bảng C1–C12) → PENDING POLICY, KHÔNG phải bug.

## Sự thật phạm vi đã chốt (đừng báo là thiếu)
- Một chi nhánh; 3 công đoạn Tiếp nhận → Thẩm định → Hoàn tất; KHÔNG có công đoạn Cấp trên, không phân cấp thẩm quyền theo số tiền; hồ sơ mới > 10 tỷ bị chặn ở UI và API (DEC-01, Hạn mức 10 tỷ).
- KHÔNG có giải ngân trong phạm vi; phê duyệt/từ chối là kết thúc.
- ML chỉ dự báo nguy cơ trễ SLA, không quyết định tín dụng (DEC-04).
- SLA PA1 theo giờ làm việc; tạm dừng khi chờ DN bổ sung; làm rõ nội bộ không tạm dừng.
- Lãi suất DEC-13: đề xuất bắt buộc trong tờ trình, quyết trong khung theo loại vay; khoản vay ưu tiên (C1) đang PENDING.

## Quy tắc thao tác (REVIEW ONLY)
- KHÔNG sửa source, DB, schema, cấu hình, Master, Bug Log. Không commit.
- KHÔNG chạy: seed, migrate, `db push`, reset, `demo:refresh`, `check:workflow`, `verify-local-running-system.cjs`, `seed-portal-flow.cjs`, script `check-*.cjs`/`*-browser.mjs` dùng schema tạm, `start-use.ps1`, hay bất kỳ POST/PUT/PATCH/DELETE nghiệp vụ nào lên API.
- ĐƯỢC: đọc file; CodeGraph query; unit test không chạm DB (`cd backend && npm test`, `cd frontend && npm run test:<gói>`) — chỉ chạy gói liên quan; SQL chỉ `SELECT` qua `docker exec sme-loan-workflow-db-1 psql -U sme_user -d sme_loan -c "..."`; gọi API GET sau khi đăng nhập bằng tài khoản demo (mật khẩu ở `README.md` mục tài khoản nội bộ; đăng nhập là thao tác được phép). Không in mật khẩu, token, dữ liệu nhạy cảm vào báo cáo.
- Không dùng trình duyệt (chỉ agent E2E được dùng). Vì vậy UI chỉ đánh giá qua đọc code → ghi rõ "đọc code, chưa kiểm UI".
- Đọc `docs/BUG_LOG_NGUOI_DUNG.md` phần thuộc nhóm bạn: với từng lỗi cũ (mã `UT-…`, trạng thái phần lớn "Mới" từ 09/11), xác minh hiện còn hay đã được sửa (có bằng chứng code/test). Không sửa file.

## 7 tiêu chí cho từng tính năng
A Requirement coverage · B Happy path · C Exception flow (mỗi ngoại lệ: Trigger → Hiện tại → Mong đợi → Thông báo UI → Hành động tiếp → Trạng thái dữ liệu → Kết luận; kiểm: thiếu/sai dữ liệu, sai thứ tự, thiếu quyền, đổi trạng thái khi đang thao tác, 2 người đồng thời, thao tác lặp/idempotency, API lỗi/hết phiên, quá hạn, bổ sung, không thể tiếp tục) · D Business rules & permission (FE/BE/DB nhất quán, quyền trên đối tượng) · E UI/UX · F Cross-feature impact (quyền, trạng thái, SLA, ML, dashboard, báo cáo) · G Evidence: Requirement → Rule → Expected → Actual → Evidence → Result.
Kết quả: PASS (có bằng chứng đủ) · PARTIAL · FAIL · NOT VERIFIED · PENDING POLICY. Phân biệt "đọc code" với "đã chạy/kiểm".

## Đầu ra
1. Báo cáo chi tiết: ghi vào `evidence/reviews/acceptance-20261115/<mã-nhóm>.md` (thư mục ngoài `docs`, được phép tạo; chỉ file của nhóm bạn).
2. Trả về phiên chính bản tóm tắt ≤ 600 từ, gồm: (1) phạm vi; (2) bảng tính năng → kết quả A–G gọn (1 dòng/tính năng); (3) BUG ỨNG VIÊN: mỗi bug có tiêu đề, loại/mức theo quy ước Bug Log (Lỗi/Lỗi hiển thị/Cải tiến; Chặn/Cao/Vừa/Thấp/Rất thấp), bước tái hiện, mong đợi/thực tế, bằng chứng (file:dòng, lệnh+kết quả), module, hướng xử lý; chỉ bug có căn cứ; (4) trạng thái các bug cũ `UT-…` của nhóm (còn/đã sửa/không xác minh được); (5) tác động liên module; (6) PENDING PO; (7) chưa xác minh được; (8) test case cần kiểm lại.
