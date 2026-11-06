# SME Loan Workflow — ngữ cảnh dự án

Cập nhật 02/11/2026 khi hợp nhất tài liệu. Đây là bản đồ tìm nguồn; quyết định PO, hiện trạng source và bằng chứng nghiệm thu cần được phân biệt.

## Hai tài liệu chính

- [SME_MASTER](docs/SME_MASTER.md): phạm vi, actor, luồng chính/ngoại lệ, quyết định và **nơi duy nhất cập nhật cả 7 đợt review**, gồm kế hoạch, phê duyệt, sửa, nghiệm thu, backlog.
- [SME_KY_THUAT](docs/SME_KY_THUAT.md): kiến trúc, dữ liệu, vận hành, migration, kiểm thử, ML và hướng dẫn AI/CodeGraph.

Không tạo thêm Markdown kế hoạch/review/acceptance trong `docs`. Bằng chứng log/ảnh/JSON ở `evidence/reviews`; bản gốc trước hợp nhất trong ZIP ở `archive`. Sáu JSON trong `docs` giữ chức năng fixture/snapshot.

## Bản đồ source

| Phần | Công nghệ và nguồn |
|---|---|
| Backend | NestJS/Prisma/PostgreSQL: [package](backend/package.json), [schema](backend/prisma/schema.prisma), [modules](backend/src/modules) |
| Frontend | React/Vite/TypeScript: [package](frontend/package.json), [API client](frontend/src/api/client.ts), [AuthContext](frontend/src/context/AuthContext.tsx), [Portal](frontend/src/portal) |
| ML | FastAPI/scikit-learn: [requirements](ml-service/requirements.txt), [API](ml-service/app/main.py), [contract](ml-service/app/schemas.py), [predictor](ml-service/app/predictor.py) |
| Vận hành | [README](README.md), [start-use](start-use.ps1), [compose](docker-compose.yml) |

## Ranh giới nghiệp vụ và bằng chứng

Một chi nhánh; Portal V2 vốn lưu động sản xuất/thương mại/dịch vụ; đề nghị mới tối đa 10 tỷ. Quy trình có ba công đoạn Tiếp nhận, Thẩm định, Hoàn tất; không có công đoạn Cấp trên, hồ sơ vượt hạn mức không được phê duyệt. Quyền theo vai trò và đối tượng; tài khoản đa vai trò vẫn chịu maker-checker theo actor/lịch sử.

Phân biệt dữ liệu đủ gửi, CBTD kiểm tra đạt để tiếp nhận, và đủ chứng từ để chuyển bước. Giữ snapshot/SLA/ML; không annualize/fake0, không overwrite Company. ML chỉ dự báo nguy cơ trễ SLA, không quyết định tín dụng; dữ liệu huấn luyện tổng hợp không chứng minh hiệu quả ngoài thực tế.

Đợt 1–2 có bằng chứng kỹ thuật/phát hành localhost được dẫn trong Master. PA1 có quyết định và code hỗ trợ; activation/lịch của DB cụ thể cần bằng chứng riêng.

AI đọc [AGENTS root](AGENTS.md), [core policy](.agents/AGENTS.md), [preflight](.agents/workflow/preflight.md), [phân tích ảnh hưởng](.agents/workflow/impact-analysis.md). Khi source và yêu cầu mâu thuẫn, trình bằng chứng và quyết định còn thiếu; không tự sửa nghiệp vụ để hợp thức hóa tài liệu.
