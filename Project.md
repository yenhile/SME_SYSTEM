# SME Loan Workflow — bản đồ ngữ cảnh dự án

Cập nhật từ khảo sát source ngày 18/10/2026. Đây là mục lục để AI tìm nguồn, không phải biên bản PO đã duyệt toàn bộ nghiệp vụ hoặc bằng chứng ứng dụng đang chạy đúng.

## Mục tiêu và cấu trúc

Ứng dụng quản lý tiếp nhận, thẩm định, phê duyệt/từ chối hồ sơ vay doanh nghiệp nhỏ và vừa; theo dõi SLA và dự báo nguy cơ trễ tiến độ xử lý bằng ML.

| Thư mục | Công nghệ theo source | Nguồn nên đọc khi có nhiệm vụ |
|---|---|---|
| `backend/` | NestJS, TypeScript, Prisma 6.19, PostgreSQL | [package.json](backend/package.json), [schema](backend/prisma/schema.prisma), [modules](backend/src/modules) |
| `frontend/` | React 18, Vite 6, TypeScript | [package.json](frontend/package.json), [API client](frontend/src/api/client.ts), [AuthContext](frontend/src/context/AuthContext.tsx), [components](frontend/src/components) |
| `ml-service/` | FastAPI, pandas, scikit-learn, joblib | [requirements](ml-service/requirements.txt), [API](ml-service/app/main.py), [contract](ml-service/app/schemas.py), [predictor](ml-service/app/predictor.py) |
| `docs/` | Tài liệu nghiệp vụ/thiết kế/báo cáo | Các nguồn bên dưới; phân biệt nội dung đề xuất và hiện trạng |

## Bản đồ nguồn và cách xử lý mâu thuẫn

- [README](README.md): cách chạy, cổng, tài khoản **mẫu** và kiểm thử tích hợp; không chép thông tin đăng nhập vào log/báo cáo.
- [Phân quyền và luồng nghiệp vụ](docs/Phan_quyen_va_luong_nghiep_vu.md): mô tả đang triển khai và danh sách điểm cần họp. Tài liệu tự ghi là bản đề xuất để nhóm chốt.
- [Đặc tả use case](docs/Dac_ta_chi_tiet_Use_Case_SME_Loan.md), [thiết kế DB](docs/Thiet_ke_Co_so_du_lieu_SME_Loan.md): nguồn phân tích yêu cầu; đối chiếu code hiện tại và quyết định PO khi có khác biệt.
- [Báo cáo ML](docs/Bao_cao_Mo_hinh_Machine_Learning.md): phạm vi dữ liệu/mô hình; [model metadata](ml-service/app/model/model_metadata.json) chứa kết quả đã lưu, không phải phép đánh giá vừa chạy.
- [Schema Prisma](backend/prisma/schema.prisma), DTO, guard, service và frontend types: bằng chứng **định nghĩa/logic trong code**. Chưa chứng minh DB đã migrate hoặc API/UI thực thi đúng.
- [Chính sách AI](.agents/AGENTS.md): quy trình làm việc; [bản khảo sát và kế hoạch](docs/ai/2026-10-18-audit-and-plan.md), [hồ sơ PO review](docs/ai/PO-REVIEW.md): bằng chứng đợt setup.

Quyết định PO trong phiên và quyết định đã được ghi nhận xác định yêu cầu; code đang có xác định hiện trạng triển khai. Khi hai nguồn khác nhau, báo mâu thuẫn và hỏi phần quyết định cần thiết; không tự đổi nguồn này để hợp thức hóa nguồn kia. Không tự đặt mức “đã chốt” cho tài liệu thiếu bằng chứng duyệt.

## Domain theo code/tài liệu hiện có

- `RoleCode`: `ADMIN`, `CBTD`, `THAM_QUYEN`, `QUAN_LY`; tài khoản có thể có nhiều vai trò, phiên thao tác có một `activeRole`. [JWT strategy](backend/src/modules/auth/jwt.strategy.ts) xác minh quyền vai trò từ DB; [LoanAccessGuard](backend/src/common/guards/loan-access.guard.ts) kiểm tra phân công với CBTD.
- `StageCode`: `TIEP_NHAN`, `THAM_DINH`, `CAP_TREN`, `HOAN_TAT`. Stage và status là hai khái niệm riêng; dùng đúng enum hiện có trong schema.
- [Workflow service](backend/src/modules/workflow/workflow.service.ts) giữ cùng hồ sơ, kiểm tra cặp stage/status, chứng từ, bổ sung và cập nhật lịch sử trong transaction. Code hiện yêu cầu khoản **vượt** 10 tỷ qua cấp trên trước khi duyệt; không tự đổi ngưỡng hoặc actor.
- [Supplements service](backend/src/modules/supplements/supplements.service.ts) và workflow xử lý chờ bổ sung/tạm dừng SLA. `CLOSED_TIMEOUT` có trong enum không chứng minh đã có tác vụ tự động đóng quá hạn.
- Theo tài liệu phân quyền, dữ liệu hồ sơ lấy từ PostgreSQL; API client báo lỗi kết nối, không tự fallback mock. Có file `frontend/src/mockData.ts` không đồng nghĩa luồng sản phẩm dùng mock.
- [Prediction service](backend/src/modules/prediction/prediction.service.ts) gọi ML và lưu dự báo; lỗi dịch vụ được báo ra, không thay bằng xác suất giả. [Workflow service](backend/src/modules/workflow/workflow.service.ts) bắt lỗi dự báo sau transaction, nên lỗi ML không mặc nhiên rollback bước đã hoàn tất.
- `delay_probability` đo **nguy cơ trễ SLA**, không phải nợ xấu/vỡ nợ hay điều kiện tự duyệt/từ chối vay. Mô hình huấn luyện trên dữ liệu tổng hợp; lý do hiển thị có logic heuristic trong predictor, không mặc nhiên là giải thích nhân quả hoặc SHAP.

Các mục trên là đọc source/tài liệu, chưa kiểm chứng live trong đợt setup AI.

## Những điểm nghiệp vụ chưa chốt

Đọc đầy đủ mục “Cần họp và thống nhất trước khi mở rộng” trong tài liệu phân quyền. Gồm: tách vai trò cấp trên/thẩm quyền theo số tiền; phạm vi chi nhánh của Thẩm quyền/Quản lý; checklist chứng từ và quyền sửa hạn mức; giờ làm việc/ngày nghỉ/thời hạn bổ sung; định dạng mã hồ sơ; xác thực ML cho nghiệp vụ thực tế. AI phải để các mục này ở trạng thái chưa chốt cho tới khi PO quyết định.

## Lệnh kiểm tra có thật và side effect

| Lệnh, từ thư mục gốc | Mục đích | Điều kiện/giới hạn |
|---|---|---|
| `npm run graph:build` | Tạo/làm mới CodeGraph cục bộ theo config allowlist | Chỉ ghi `.codegraph/`, không chạy ứng dụng/DB hoặc gửi source ra ngoài |
| `npm run graph:check` | Kiểm tra source/config/package/lock/ignore khớp graph | Bắt buộc trước dùng graph và trước bàn giao thay đổi code |
| `npm run codegraph -- context transitionStage --no-source` | Ví dụ AI lấy context symbol qua terminal tool | Dùng thêm `deps` và `fn-impact` theo nhiệm vụ; wrapper kiểm tra graph mới trước truy vấn |
| `node scripts/check-ai-rules.mjs` | Kiểm tra tĩnh bộ rule và integrity SKILL.md | Không gọi app/AI/DB; không chứng minh host đã nạp |
| `npm --prefix backend run build` | Build NestJS | Cần dependency đã cài; tạo build output, không phải test nghiệp vụ |
| `npm --prefix frontend run test:api` | Kiểm thử timeout, JSON/blob, lỗi mạng và phiên đăng nhập của API client | HTTP server fixture cục bộ, không chạy ứng dụng thật hoặc ghi DB |
| `npm --prefix frontend run build` | TypeScript + Vite build | Cần dependency đã cài; không kiểm chứng giao diện trình duyệt |
| `npm --prefix backend run check:workflow` | Integration với backend và DB đang chạy | **Có tạo/xóa dữ liệu test**; xác minh `DATABASE_URL` và `TEST_API_URL` cùng môi trường, quyền thực hiện và cleanup trước khi chạy |

Frontend có script `test:api` cho hồi quy API client. Chưa có script tổng quát `test`/`lint` trong hai package; chưa thấy bộ test runner Python trong repo. Không báo `npm test`, `pytest` hay test suite có sẵn đã pass. Với thay đổi hành vi, chọn/thêm kiểm thử có ý nghĩa trong phạm vi nhiệm vụ.

Local API thường là cổng `3000`, Docker API là `3001` theo [Compose](docker-compose.yml) và README. Không nhầm API target với DB target. Hai script [start-local](start-local.ps1) và [run-local-dev](run-local-dev.ps1) có `prisma:push`/`prisma:seed`; đọc side effect và quyền DB trước khi dùng. Cấm suy diễn “chạy local” thành quyền reset/seed hoặc xoá volume.

## Công cụ AI theo quyết định PO

PO làm việc qua Codex extension và Gemini Antigravity. AI dùng terminal tool của host để chạy CodeGraph; không yêu cầu PO làm việc trong chat CLI. `@optave/codegraph@3.17.0` được ghim tại [package root](package.json) và [lockfile](package-lock.json); config [`.codegraphrc.json`](.codegraphrc.json) chỉ index source được cho phép. Cần Node >=22.12.0 và `npm ci` tại root khi phục hồi môi trường. Xem [quy trình/giới hạn CodeGraph](docs/ai/2026-10-18-codegraph.md). CodeGraph bổ sung bằng chứng cấu trúc, không thay thế source/test và không xác minh runtime.

## Quy ước làm việc

Giao tiếp tiếng Việt rõ, gọn; mã/enum giữ đúng source. Source quyết định quy ước từng module. Thay API/enum/payload phải xét cả backend, frontend và ML tương ứng; cập nhật tài liệu bị ảnh hưởng khi cần. Dùng đường dẫn tương đối trong tài liệu repo. Không đọc hàng loạt `.env`, `.dump`, `.vault`, upload, dataset hay tài liệu khách hàng khi nhiệm vụ không yêu cầu.
