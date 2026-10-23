# SME Loan — hướng dẫn AI cho toàn repository

Áp dụng cho mọi prompt và mọi thư mục con khi làm việc trong `sme-loan-workflow`.

1. Trước khi làm việc, đọc [chính sách chung](.agents/AGENTS.md) và [ngữ cảnh dự án](Project.md). Mỗi prompt kiểm tra lại mục tiêu, phạm vi, quyền thao tác và bằng chứng; dùng lại context còn đúng, đọc lại khi file thay đổi hoặc mất context.
2. Chỉ giải thích/review/lập kế hoạch thì giữ đúng phạm vi đó. Khi PO đã giao triển khai, hoàn thành phần được giao và đưa kết quả duyệt; không xin lại quyền đã có. Những tác động dữ liệu hoặc quyết định nghiệp vụ chưa được giao cần làm rõ trước.
3. Không tự đổi quy trình vay, quyền vai trò, ngưỡng tiền, SLA hoặc ý nghĩa ML. Dự báo ML ở đây là nguy cơ **trễ SLA**, không phải quyết định tín dụng.
4. Chọn skill theo [preflight](.agents/workflow/preflight.md) và [routing index](.agents/skills.json). Chính sách dự án điều chỉnh việc áp dụng thư viện skill: dùng công cụ tương đương có thật, không tự phát sinh commit/push, cài tool hay duyệt lặp.
5. **CodeGraph bắt buộc khi phân tích cấu trúc, sửa code, debug hoặc review code.** AI tự chạy `npm run graph:check` qua terminal của Codex extension/Antigravity; nếu graph cũ thì `npm run graph:build`, sau đó dùng các subcommand `context`, `deps`, `fn-impact` qua `npm run codegraph --` cho phạm vi liên quan. Làm mới graph sau khi sửa source. Xem [quy trình CodeGraph](docs/ai/2026-10-18-codegraph.md).
6. Chỉ kết luận kiểm chứng đã thực hiện. Build không thay thế kiểm thử hành vi/UI. Không in secret hay che lỗi backend/ML bằng mock.

**Hai quy tắc cứng:** SME-AI-011 yêu cầu đúng phạm vi PO; nếu yêu cầu bất hợp lý/không tối ưu/gây lỗi, báo nguyên nhân, bằng chứng và đề xuất để PO duyệt trước khi thực hiện phương án khác. SME-AI-012 yêu cầu phân tích tính năng theo chiều ngang rồi truy vết chiều sâu đệ quy cha → con → cháu, thực hiện và hồi quy xuyên suốt phần được duyệt; sửa ngoài phạm vi phải chờ PO. Bắt buộc đọc [quy trình ảnh hưởng](.agents/workflow/impact-analysis.md) khi phân tích/xây dựng/sửa/xóa tính năng.

Phân hệ: `backend/` (NestJS, Prisma, PostgreSQL), `frontend/` (React, Vite, TypeScript), `ml-service/` (FastAPI, scikit-learn), `docs/` (nghiệp vụ/tài liệu).

Kiểm tra cấu hình AI: `node scripts/check-ai-rules.mjs` từ root. Hướng dẫn nạp và nghiệm thu: [.agents/AI-SETUP.md](.agents/AI-SETUP.md). PO đã duyệt phương án ngày 18/10/2026 với CodeGraph bắt buộc; phiên bản áp dụng là `sme-loan-ai-v1.2`. Việc nạp rule trong phiên mới của từng host vẫn cần bằng chứng riêng.
