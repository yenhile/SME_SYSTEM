# SME Loan — hướng dẫn AI cho toàn repository

Áp dụng cho mọi prompt và mọi thư mục con khi làm việc trong `sme-loan-workflow`.

1. Trước khi làm việc, đọc [chính sách chung](.agents/AGENTS.md) và [ngữ cảnh dự án](Project.md). Mỗi prompt kiểm tra lại mục tiêu, phạm vi, quyền thao tác và bằng chứng; dùng lại context còn đúng, đọc lại khi file thay đổi hoặc mất context.
2. Chỉ giải thích/review/lập kế hoạch thì giữ đúng phạm vi đó. Khi PO đã giao triển khai, hoàn thành phần được giao và đưa kết quả duyệt; không xin lại quyền đã có. Những tác động dữ liệu hoặc quyết định nghiệp vụ chưa được giao cần làm rõ trước.
3. Không tự đổi quy trình vay, quyền vai trò, ngưỡng tiền, SLA hoặc ý nghĩa ML. Dự báo ML ở đây là nguy cơ **trễ SLA**, không phải quyết định tín dụng.
4. Chọn skill theo [preflight](.agents/workflow/preflight.md) và [routing index](.agents/skills.json). Chính sách dự án điều chỉnh việc áp dụng thư viện skill: dùng công cụ tương đương có thật, không tự phát sinh commit/push, cài tool hay duyệt lặp.
5. **CodeGraph bắt buộc khi phân tích cấu trúc, sửa code, debug hoặc review code.** AI tự chạy `npm run graph:check` qua terminal của Codex extension/Antigravity; nếu graph cũ thì `npm run graph:build`, sau đó dùng các subcommand `context`, `deps`, `fn-impact` qua `npm run codegraph --` cho phạm vi liên quan. Làm mới graph sau khi sửa source. Xem [quy trình CodeGraph](docs/SME_KY_THUAT.md#quy-trinh-codegraph).
6. Chỉ kết luận kiểm chứng đã thực hiện. Build không thay thế kiểm thử hành vi/UI. Không in secret hay che lỗi backend/ML bằng mock.

**Hai quy tắc cứng:** SME-AI-011 yêu cầu đúng phạm vi PO; nếu yêu cầu bất hợp lý/không tối ưu/gây lỗi, báo nguyên nhân, bằng chứng và đề xuất để PO duyệt trước khi thực hiện phương án khác. SME-AI-012 yêu cầu phân tích tính năng theo chiều ngang rồi truy vết chiều sâu đệ quy cha → con → cháu, thực hiện và hồi quy xuyên suốt phần được duyệt; sửa ngoài phạm vi phải chờ PO. Bắt buộc đọc [quy trình ảnh hưởng](.agents/workflow/impact-analysis.md) khi phân tích/xây dựng/sửa/xóa tính năng.

Phân hệ: `backend/` (NestJS, Prisma, PostgreSQL), `frontend/` (React, Vite, TypeScript), `ml-service/` (FastAPI, scikit-learn), `docs/` (nghiệp vụ/tài liệu).

Kiểm tra cấu hình AI: `node scripts/check-ai-rules.mjs` từ root. Hướng dẫn nạp và nghiệm thu: [.agents/AI-SETUP.md](.agents/AI-SETUP.md). PO đã duyệt phương án ngày 18/10/2026 với CodeGraph bắt buộc; phiên bản áp dụng là `sme-loan-ai-v1.2`. Việc nạp rule trong phiên mới của từng host vẫn cần bằng chứng riêng.

Tài liệu chính: [SME_MASTER](docs/SME_MASTER.md) cho nghiệp vụ và duy nhất một sổ review 7 nhóm; [SME_KY_THUAT](docs/SME_KY_THUAT.md) cho cấu trúc/vận hành. Không tạo Markdown kế hoạch/review/nghiệm thu rời trong `docs`.

## Ba mẫu lệnh review và triển khai nhóm chức năng

PO duyệt bổ sung ngày 02/11/2026. Đây là các mẫu để PO gọi khi cần, không phải yêu cầu tự thực hiện cả ba khi đọc AGENTS.md. Thay nội dung trong dấu ngoặc vuông trước khi dùng; mỗi lần chỉ áp dụng lệnh được PO yêu cầu.

### Lệnh 1 — bắt đầu review một nhóm

**Mục đích:** khảo sát nhóm chức năng và tự đánh giá lần lượt bằng hai vai trò Lead PO, Lead Fullstack để trình phương án cho PO duyệt. Chỉ được cập nhật kết quả vào Master, chưa được sửa code hoặc dữ liệu. Dùng khi bắt đầu một đợt review mới.

```text
Review đợt [N] của hệ thống SME theo phương án tối ưu công việc.

Phạm vi: [tên nhóm chức năng và actor].

Chỉ review và đề xuất, chưa sửa code hoặc dữ liệu.
Được cập nhật kết quả vào đúng mục trong docs/SME_MASTER.md.

1. Đọc hướng dẫn dự án và phần Master liên quan. Tái sử dụng kết quả
đợt 1–2 sau khi kiểm tra tính còn phù hợp; không khảo sát lại toàn repo.
Nếu phạm vi đợt chưa rõ, đề xuất ranh giới để tôi chốt trước khi review sâu.

2. Dùng CodeGraph và truy vết ngang → sâu theo quy định.
Chỉ mở rộng khảo sát khi có phụ thuộc hoặc bằng chứng cần kiểm tra thêm.

3. Khảo sát nguồn một lần, sau đó tự review hai lượt:
- Lead PO: luồng chính/ngoại lệ, actor, gap và giá trị nghiệp vụ.
- Lead Fullstack: xác minh nhận định PO bằng source, ảnh hưởng,
  xung đột, cách sửa và kiểm thử cần thiết.

4. Dùng chung một bảng vấn đề:
Mã | Tình huống | Hiện trạng/mong đợi | Rủi ro | Bằng chứng |
Phương án | Phạm vi ảnh hưởng | Tiêu chí nghiệm thu.

Phân biệt lỗi phải sửa với cải tiến tùy chọn; ghi rõ phần chưa xác minh.
Không tự sinh tính năng, subagent hoặc báo cáo Markdown riêng.
Không chạy kiểm thử có ghi dữ liệu khi chưa có quyền cho môi trường đó.

Trả kết quả ngắn gọn để tôi duyệt, gồm luồng, vấn đề, phương án
và thứ tự xử lý. Không lặp lại nội dung đã ghi đầy đủ trong Master.
```

### Lệnh 2 — triển khai sau khi PO duyệt

**Mục đích:** sửa đúng các mã vấn đề và phương án đã được PO duyệt, kiểm thử và bàn giao gói. Dùng sau bước review/phê duyệt; mẫu lệnh không tự cấp quyền thay đổi nghiệp vụ, dữ liệu hoặc phát hành ngoài phạm vi đã giao.

```text
Tôi duyệt triển khai các vấn đề [mã vấn đề] của đợt [N]
theo phương án và tiêu chí đã ghi trong SME_MASTER.md.

Tiếp tục từ kết quả review, kiểm tra thay đổi kể từ mốc đó;
không review lại toàn bộ dự án.

Sửa lần lượt theo phụ thuộc, kiểm thử phần sửa và hồi quy các luồng
bị ảnh hưởng; hoàn thành kiểm tra bắt buộc trước khi bàn giao.
Khi đạt tiêu chí thì chốt gói. Phát hiện ngoài phạm vi ghi backlog;
nếu cản trở hoàn thành gói, trình rõ tác động và quyết định cần tôi chốt.

Cập nhật tiến độ, bằng chứng và việc còn lại vào đúng mục Master.
Không thay nghiệp vụ ngoài phạm vi, không tự commit/push/phát hành.
```

### Lệnh 3 — tiếp tục khi chuyển phiên

**Mục đích:** khôi phục ngữ cảnh từ điểm bàn giao trong Master và tiếp tục công việc đang dang dở. Dùng khi chuyển phiên hoặc cần phục hồi context; giữ nguyên phạm vi và quyền đã duyệt, kiểm tra tính còn phù hợp của bằng chứng trước khi dùng lại.

```text
Tiếp tục đợt [N] từ điểm bàn giao trong docs/SME_MASTER.md.
Đọc hướng dẫn dự án, kiểm tra trạng thái source và bằng chứng liên quan,
sau đó làm việc tiếp theo còn dang dở trong phạm vi đã duyệt.
Không khảo sát hoặc chạy lại các kiểm tra đã đạt nếu chưa có thay đổi
hay nghi vấn ảnh hưởng đến kết quả.
```
