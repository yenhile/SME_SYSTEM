# Bổ sung CodeGraph bắt buộc theo quyết định PO

Ngày: 18/10/2026. Phiên bản quy tắc áp dụng: `sme-loan-ai-v1.1`. PO đã duyệt phương án setup AI, điều chỉnh rõ: **phải có CodeGraph**.
Quyết định này thay thế phần “CodeGraph tùy chọn” trong bản đề xuất v1; RTK vẫn tùy chọn. Không thay đổi quyết định nghiệp vụ ngân hàng.

## Phương án triển khai

Dùng `@optave/codegraph` của [optave/ops-codegraph-tool](https://github.com/optave/ops-codegraph-tool), đúng họ công cụ được tham chiếu trong bộ rule nhập vào. npm registry xác nhận `3.17.0`, yêu cầu Node `>=22.12.0`; môi trường hiện tại là Node `22.19.0`.

Cài dependency dev tại root, ghim phiên bản và giữ lockfile. Cả Codex và Gemini Antigravity gọi CLI qua npm scripts của repo; không phụ thuộc MCP đã được cài trên máy hay thay global settings. Cơ chế nạp rule của host vẫn phải nghiệm thu riêng.

Graph chỉ phục vụ phân tích cấu trúc source, không thay thế đọc code, test, runtime evidence hoặc quyết định PO. Không tự gọi embedding/LLM, tải model, mở web server/watch nền hay gửi source ra dịch vụ ngoài.

## Phạm vi và kế hoạch

- [x] Tạo package tooling root, config allowlist source và ignore graph/cache trong Git.
- [x] Cài `@optave/codegraph@3.17.0` cục bộ, tạo graph, kiểm tra tool thực sự chạy.
- [x] Xác minh graph có backend TypeScript, frontend TSX và Python ML; thử context/dependency/impact trên symbol có thật.
- [x] Thêm kiểm tra graph/index có cập nhật theo source, hướng dẫn refresh và xử lý tool lỗi.
- [x] Đồng bộ policy, entrypoint, routing, preflight, quick-ref, setup, acceptance và validator: CodeGraph bắt buộc cho công việc phụ thuộc cấu trúc mã nguồn.
- [x] Ghi nhận PO đã duyệt phương án kèm điều chỉnh; kiểm chứng rule, hồi quy validator và hạn chế graph thực tế.

## Nghiệm thu

1. Cài theo package/lockfile đã ghim, không cài global hay thay dependency ứng dụng.
2. Graph build thành công tại `.codegraph/graph.db`; không index `.agents`, `node_modules`, `.env`, `.dump`, `.vault`, upload, CSV/joblib hoặc binary.
3. CLI truy vấn được symbol/dependency trong source thật của dự án; báo rõ giới hạn resolver/khác ngôn ngữ nếu có.
4. AI phải kiểm tra graph mới, xem context/dependency và impact trước thay đổi code liên quan; refresh sau thay đổi source. Tool thiếu/lỗi không được im lặng coi là đã đạt yêu cầu CodeGraph.
5. Câu hỏi không phụ thuộc source như duyệt chính sách/tài liệu thuần không cần build/query vô ích; preflight vẫn xác định và ghi nhận mức áp dụng khi cần.
6. Validator có regression khi ai đó hạ CodeGraph thành tùy chọn. Host auto-load chưa thử thì giữ nguyên trạng thái chưa xác minh.

## Quyền đã có và tác động

PO đã yêu cầu công cụ và cho phép triển khai setup dự án. Phạm vi này bao gồm cài dependency dev, build graph cache cục bộ, kiểm tra cấu trúc mã nguồn và sửa tài liệu/quy tắc liên quan. Không khởi động ứng dụng, thay DB/schema/seed, huấn luyện ML hoặc ghi dữ liệu nghiệp vụ.

Nguồn kỹ thuật: [manifest upstream](https://github.com/optave/ops-codegraph-tool/blob/main/package.json), [cấu hình](https://github.com/optave/ops-codegraph-tool/blob/main/docs/guides/configuration.md), [agent guide](https://github.com/optave/ops-codegraph-tool/blob/main/docs/guides/ai-agent-guide.md). Lệnh và giới hạn bàn giao phải được đối chiếu với phiên bản đã cài, không dựa riêng vào README.

## Cách sử dụng trong Codex extension và Antigravity

PO giao việc trong giao diện chat của IDE như bình thường, ví dụ:

> Phân tích tác động nếu sửa chuyển bước hồ sơ; dùng CodeGraph và source hiện tại, chưa sửa code.

AI tự dùng terminal tool của host, đặt working directory tại root và thực hiện quy trình sau. Không yêu cầu PO chuyển sang chat CLI hoặc tự gõ các lệnh này để AI mới làm việc.

1. Đọc policy/Project và xác định task có phụ thuộc source không. Với task đó, kiểm tra `npm run graph:check`.
2. Graph cũ/thiếu: `npm run graph:build`, sau đó kiểm tra lại. Máy mới thiếu dependency: phục hồi `npm ci` theo lockfile đã được cho phép, không tự chọn bản mới bằng npx.
3. Lấy context, dependency và phạm vi ảnh hưởng phù hợp. Ví dụ các lệnh đã chạy trên dự án:

```powershell
npm run codegraph -- context transitionStage --file backend/src/modules/workflow/workflow.service.ts --no-source --json
npm run codegraph -- deps backend/src/modules/workflow/workflow.service.ts --json
npm run codegraph -- fn-impact predictForApplication --file backend/src/modules/prediction/prediction.service.ts --json
npm run codegraph -- context LoanList --no-source --json
npm run codegraph -- where DelayPredictor --json
```

4. Đọc source tại vị trí trả về, đối chiếu contract/điểm động và sửa trong phạm vi PO giao. Kết quả `--no-source` cho metadata; AI vẫn phải đọc code cần thiết, không suy diễn toàn bộ từ tên symbol.
5. Sau thay đổi source/config/package/lock/ignore: build lại, kiểm tra graph mới, kiểm chứng hành vi cần thiết rồi bàn giao có bằng chứng. Graph là cấu trúc tĩnh, không thay test nghiệp vụ/UI.

Npm script `codegraph` tự chạy freshness check trước khi chuyển đối số sang CLI. Nếu graph cũ, truy vấn dừng; AI phải khôi phục graph trước, không gọi thẳng binary để né kiểm tra. Chỉ đọc tài liệu/duyệt chính sách không phụ thuộc cấu trúc source thì không cần build/query.

## Kiểm tra độ mới và giới hạn bảo mật

[Adapter](../../scripts/check-codegraph.mjs) dùng bản CodeGraph đã ghim và đọc `file_hashes` trong SQLite graph ở chế độ read-only. Nó so sánh tập file và hash hiện tại, phát hiện source đổi/thêm/xóa; dấu build ràng buộc config, package, lockfile và gitignore. SHA-256 native và MD5 của engine JS đều được kiểm tra theo định dạng hash của tool. Hash MD5 ở đây chỉ phục vụ phát hiện thay đổi source, không dùng cho mật khẩu/bảo mật xác thực.

Config chỉ cho phép 6 gốc source: `backend/src`, `frontend/src`, `ml-service/app`, `ml-service/scripts`, `backend/scripts`, `scripts`. Bỏ qua thư viện, thư mục bí mật, dữ liệu/model và build output; root source hoặc file con là symlink cần được review trước. Không đặt API key, credential command hoặc provider bên ngoài trong config này.

Build và query dùng [wrapper chung](../../scripts/run-codegraph.mjs): tắt update-check, bỏ CODEGRAPH_* kế thừa, ghim registry/update-cache vào repo và tắt global config. Npm query chỉ cho các subcommand cấu trúc; không tự mở server hoặc đổi db/config. Nhánh update-check trong terminal tương tác đã được reviewer tái hiện bằng fetch stub, không dùng mạng thật; sau đó được tắt bằng NO_UPDATE_CHECK=1.

Cache `.codegraph/` có thể chứa symbol/AST và thông tin từ source, phải giữ cục bộ; đã thêm vào `.gitignore`. Không commit/chia sẻ cache, index `.env`, dump/vault, dữ liệu chứng từ hoặc tự bật embed/LLM. Không tự khởi động watch/server nền. Đợt này không cài MCP hay đổi cấu hình toàn máy.

Muốn mở rộng source allowlist hoặc nâng phiên bản CodeGraph: review adapter/config/schema và lockfile, chạy lại fixture và build; không chỉ sửa hash/dấu build để có kết quả xanh.

## Bằng chứng trên source SME Loan

Đã cài CodeGraph **3.17.0** cục bộ, build bằng engine native. Lần kiểm tra trước bàn giao tạo **80 file, 923 node, 1.605 edge**: backend 52 file, frontend 17, ML 6, tooling scripts 5. Đây là số liệu cấu trúc tại lần build, sẽ đổi khi source/tooling đổi.

Đã truy vấn thực tế:

- `WorkflowService`: tìm thấy trong backend; dependency gồm PredictionService, DTO chuyển bước và PrismaService; imported-by có controller/module.
- `LoanList`: tìm thấy TSX, có caller `Workspace`, các callee như `KanbanBoard`, `useAuth`.
- `DelayPredictor`: tìm thấy class/method trong Python.
- `PredictionService.predictForApplication`: graph trả 4 caller trực tiếp và 3 caller gián tiếp, gồm workflow, bổ sung, điều chuyển và controller liên quan.

Không coi các quan hệ graph là đầy đủ: NestJS DI/decorator, entrypoint HTTP, lời gọi động và hợp đồng qua REST/khác ngôn ngữ vẫn phải xem source. Tag `dead-unresolved` có thể xuất hiện cả ở method được controller gọi; không kết luận code chết hoặc xóa code chỉ vì tag. Chỉ số caller coverage của tool không phải độ chính xác đã được đo bằng ground truth.

## Kiểm chứng và phạm vi còn mở

- [Kiểm thử graph](../../scripts/check-codegraph.test.mjs): 15/15 ca đạt, dùng CodeGraph thật trên source giả lập trong thư mục tạm. Bao gồm graph thiếu/cũ, source sửa/thêm/xóa, drift config, refresh, file private/vendor/data bị loại khỏi graph, biến môi trường khác hoa/thường trên Windows, chặn server và các dạng đổi DB.
- [Kiểm thử validator rule](../../scripts/check-ai-rules.test.mjs): 9/9 ca đạt, có regression ngăn hạ CodeGraph về tùy chọn.
- [Validator rule](../../scripts/check-ai-rules.mjs) kiểm tra package/lock/config và policy required; kiểm tra này tĩnh, tách khỏi `npm run graph:check` kiểm tra graph thực tế.
- Chưa kiểm chứng host tự nạp rule trong phiên mới của Codex extension/Antigravity; không xem CLI chạy thành công là bằng chứng phần này.
- Không chạy ứng dụng, thay DB/schema/seed hoặc đánh giá lại ML; không sửa source ứng dụng để phục vụ setup công cụ.

Kết quả lệnh cuối được lưu trong [codegraph-verification.json](codegraph-verification.json). Quyết định PO và lịch sử bản v1 ở [PO-REVIEW](PO-REVIEW.md).

Review độc lập đã đóng các phát hiện: fixture thiếu file copy, update-check trong TTY, biến môi trường khác case trên Windows và DB override dạng nối/ghép short option. Reviewer chạy lại 15/15 fixture, graph check/context đạt, không còn blocker trong phạm vi review. Đây không phải kiểm thử host tự nạp rule.
