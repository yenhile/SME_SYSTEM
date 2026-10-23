# Hồ sơ PO duyệt — bộ quy tắc AI SME Loan

Phiên bản áp dụng: `sme-loan-ai-v1.2`, ngày 18/10/2026.
Trạng thái phương án: **PO ĐÃ DUYỆT — ĐIỀU CHỈNH CODEGRAPH BẮT BUỘC**.
PO xác nhận dùng Codex extension và Gemini qua Antigravity; CLI là công cụ AI tự gọi trong quá trình làm việc.
Trạng thái nghiệm thu host: **CHƯA XÁC MINH phiên mới trên Antigravity/Codex của PO**.

## 1. Kết quả thay đổi

| Phần | Kết quả |
|---|---|
| Khảo sát chuyên sâu | Đọc 8 file điều phối, kiểm kê 56 skill, đối chiếu source/domain và tài liệu host; [20 phát hiện và kế hoạch](2026-10-18-audit-and-plan.md) |
| Nạp Codex | [AGENTS.md root](../../AGENTS.md) yêu cầu đọc core policy và Project |
| Nạp Gemini Antigravity | [GEMINI.md root](../../GEMINI.md) và rule `always_on` hợp lệ; cùng policy với Codex |
| Context SME Loan | [Project.md](../../Project.md) trỏ tới nguồn có thật, lệnh kiểm tra, side effect và điểm nghiệp vụ chưa chốt |
| Policy | [12 nhóm SME-AI-001…012](../../.agents/AGENTS.md): quyền PO, phạm vi, nguồn, domain, dữ liệu, kiểm chứng, tool, Git/agent, bàn giao |
| Workflow | [preflight](../../.agents/workflow/preflight.md), [quick-ref](../../.agents/workflow/quick-ref.md), workflow và guideline điều chỉnh theo loại việc |
| Skill | Nội dung 56 skill giữ nguyên; [routing index](../../.agents/skills.json) chọn theo task, có adapter và giới hạn quyền; [inventory/hash](skills-inventory.json) |
| An toàn dữ liệu | Rule [data-security](../../.agents/rules/data-security.md), target/quyền cho thao tác DB và không tự diễn giải ML thành tín dụng |
| Nghiệm thu | [19 tình huống](acceptance-scenarios.json), [validator read-only](../../scripts/check-ai-rules.mjs), [hướng dẫn hai host](../../.agents/AI-SETUP.md) |
| Đối chiếu/hoàn tác | [Snapshot 8 file điều phối gốc](original-rules.json), chỉ là dữ liệu lịch sử |

Không sửa code ứng dụng, schema, seed, model hoặc dữ liệu nghiệp vụ. Đã cài CodeGraph dev dependency tại root theo yêu cầu PO; không cài global, commit/push/deploy. Thư viện vendor giữ nguyên nội dung; không xóa Git lồng trong thư viện.

## 2. Những thay đổi chính PO cần đánh giá

| Quy tắc | Hành vi mong đợi |
|---|---|
| Mỗi prompt đều kiểm tra context/phạm vi/quyền | Không bắt đọc lại toàn bộ repo hoặc áp 4 phase vào câu hỏi đơn giản |
| Plan-only khác đã giao thực thi | PO nói “chỉ lập kế hoạch” thì dừng; đã giao triển khai thì làm xong trong phạm vi rồi trình duyệt |
| Quy tắc cứng SME-AI-011 | Tuân thủ yêu cầu/phạm vi PO; phát hiện bất hợp lý/không tối ưu/nguy cơ lỗi phải trình lý do, bằng chứng và giải pháp để PO duyệt trước khi làm khác |
| Quy tắc cứng SME-AI-012 | Ngang trước → sâu đệ quy sau, kiểm chứng xuyên suốt/hồi quy; cần sửa ngoài phạm vi phải chờ PO duyệt |
| Việc quan trọng chưa có quyền/thiếu quyết định | Hỏi đúng tác động cụ thể; không tự đổi nghiệp vụ/ghi dữ liệu |
| Kiểm chứng theo loại thay đổi | Thay hành vi ưu tiên test/regression; nhãn/tài liệu/config kiểm tra tương xứng; UI cần browser để kết luận trực quan |
| CodeGraph bắt buộc; RTK tùy chọn | AI tự gọi CLI qua terminal của Codex extension/Antigravity. Graph phải mới; đọc context/deps/impact trước sửa, refresh sau sửa. Thiếu/lỗi phải phục hồi, không thay thế âm thầm |
| Giữ nghiệp vụ và dữ liệu | Không tự đổi role, threshold, SLA; không dùng mock che lỗi; ML chỉ dự báo trễ SLA |
| Skill dưới phạm vi PO và quyền host | Không tự hỏi lại quyền đã có, tạo commit/PR hoặc dùng tool không tồn tại |

PO đã duyệt phương án tại hội thoại ngày 18/10/2026 và yêu cầu có CodeGraph. Điều chỉnh này đã được ghi trong policy/routing/preflight; không suy diễn thành PO đã nghiệm thu host auto-load hoặc đã chốt các nghiệp vụ ngân hàng còn mở.

## 3. Bằng chứng giai đoạn v1 trước bổ sung CodeGraph

| Kiểm tra | Trạng thái/bằng chứng |
|---|---|
| Baseline trước sửa rule | Validator exit 1: `passed=81 failed=38`; phát hiện thiếu entrypoint, tham chiếu cũ, trigger sai/thiếu, routing chưa phù hợp |
| Validator sau triển khai | Đã chạy và pass; số kiểm tra cuối ghi ở mục “Kết quả cuối” bên dưới |
| SHA-256 56 SKILL.md | Đã đối chiếu inventory trước thay đổi, 56/56 khớp |
| Integrity toàn bộ file vendor và tracked product | Đã đối chiếu baseline: 259/259 file vendor và 131/131 file tracked cũ khớp SHA-256; không có file bị đổi/mất |
| Review trước sửa | Agent đọc rule cũ, phân tích 6 tình huống và khoảng trống; **đánh giá tĩnh**, không phải baseline hành vi RED |
| Review sau sửa/tình huống | [8 phản hồi mô phỏng và review độc lập](simulation-review-results.md); 2 điểm P2 và 1 điểm P3 đã được sửa, có hồi quy cho lỗi validator |
| Codex/Antigravity fresh-session auto-load | Chưa chạy trên phiên mới của PO; không xem kết quả validator là chứng minh auto-load |
| Ứng dụng/API/DB/UI/ML | Không chạy trong đợt cấu hình; không có tuyên bố E2E hay chất lượng mô hình |

Kiểm thử validator dùng [8 ca fixture](../../scripts/check-ai-rules.test.mjs), bao gồm tình huống frontmatter sai nhưng body có dòng always_on. [Kết quả fixture đã chạy](validator-fixture-results.json) là bằng chứng kiểm tra tĩnh, không phải kết quả 14 tình huống host đều đã đạt.

### Kết quả cuối

- `node --check scripts/check-ai-rules.mjs` và `node --check scripts/check-ai-rules.test.mjs`: exit 0.
- `node scripts/check-ai-rules.mjs`: 310 mục đạt, 0 lỗi, exit 0. Số mục gồm cả link trong bản khảo sát và hồ sơ bàn giao.
- `node scripts/check-ai-rules.test.mjs`: 8/8 ca đạt, exit 0; 6 cấu hình lỗi bị từ chối đúng, 2 cấu hình hợp lệ/phục hồi được chấp nhận.
- SHA-256: 56/56 SKILL.md, 259/259 file vendor ngoài `.git`, 131/131 file tracked có sẵn khớp baseline; không đổi code/tài liệu nghiệp vụ cũ.
- Review độc lập lại xác nhận 3 phát hiện đã sửa, không có blocker mới. Kết quả validator ở lần review trước cập nhật tài liệu cuối là 306/0; lần cuối của agent chính là 310/0 do thêm link tài liệu.

Phiên kiểm tra ngày 18/10/2026; chưa kiểm chứng fresh-session auto-load tại host của PO. Những con số trên không phải tỷ lệ tuân thủ thực tế của Codex/Gemini.

## 4. Cách PO nghiệm thu

1. Đọc bảng ở mục 2 và [policy chung](../../.agents/AGENTS.md); nhận xét các quy tắc cần siết/nới.
2. Tại root chạy `node scripts/check-ai-rules.mjs`; yêu cầu `failed=0`, exit 0.
3. Mở hội thoại mới ở Codex và Antigravity đúng root; dùng prompt AC-01 trong [AI-SETUP](../../.agents/AI-SETUP.md). Không nhắc tay đường dẫn rule trong lần kiểm tra tự nạp.
4. Thử các tình huống AC-02…19 ở dạng mô phỏng. Không chạy seed/reset/duyệt vay/gửi issue thật chỉ để nghiệm thu.
5. Ghi host/phiên bản/ngày, nguồn thực sự nạp, kết quả và mục còn thiếu. Chỉ sau đó xác nhận phần auto-load/tuân thủ đã được quan sát.

Sau khi nạp đúng đã được nghiệm thu, PO có thể giao việc bình thường mà không dán lại bộ rule vào từng prompt. Khi thay rule/đổi host, mở phiên mới và kiểm tra lại.

## 5. Giới hạn cần hiểu khi duyệt

Markdown đặt yêu cầu bắt buộc trong dự án nhưng không bảo đảm AI không bao giờ vi phạm. Nền tảng phải nạp đúng file; quyền tool/sandbox và review bằng chứng vẫn cần. Nếu PO cần chặn kỹ thuật một số lệnh/thao tác, đó là phạm vi thiết kế permission/hook/CI riêng, chưa cài trong đợt này.

`.agents` ban đầu chưa tracked và có Git repository lồng trong thư viện. Trước mang sang máy khác cần đóng gói/version hoá đúng; không giả định một `git add .agents` sẽ mang đầy đủ vendor. Chưa thực hiện thao tác Git ghi nào.

Phần nghiệp vụ ngân hàng còn mở trong tài liệu phân quyền vẫn mở. Duyệt rule AI không đồng nghĩa duyệt thẩm quyền chi nhánh, threshold mới, SLA theo ngày nghỉ hoặc chất lượng ML cho thực tế.

## 6. Ghi nhận quyết định PO

- [x] PO duyệt phương án nền `sme-loan-ai-v1` với điều chỉnh bắt buộc bổ sung CodeGraph; áp dụng thành `sme-loan-ai-v1.1`.
- [x] Đã ghi nhận yêu cầu CodeGraph bắt buộc và host sử dụng thực tế: Codex extension/Gemini Antigravity.
- [x] PO trực tiếp yêu cầu hai quy tắc cứng về phạm vi/phương án thay thế và phân tích ngang–sâu; đã đưa vào v1.2. Đây là yêu cầu triển khai, không phải nghiệm thu kết quả v1.2.
- [ ] Đã nghiệm thu auto-load Codex phiên mới, có lưu bằng chứng.
- [ ] Đã nghiệm thu auto-load Antigravity phiên mới, có lưu bằng chứng.

Chỉ các mục quyết định/yêu cầu đã có lời PO được đánh dấu; các ô nghiệm thu host vẫn để trống cho tới khi có bằng chứng thật.

## 7. Bổ sung CodeGraph theo duyệt PO

Xem [kế hoạch, cách dùng và nghiệm thu CodeGraph](2026-10-18-codegraph.md). Bản v1.1 có package/lockfile ghim CodeGraph 3.17.0, config giới hạn source và script kiểm tra freshness theo hash; graph/cache được bỏ qua trong Git.

AI tự dùng terminal tool của Codex extension/Antigravity; PO giao việc trong IDE. Kiểm tra cấu hình và fixture ở mục 3 là bằng chứng **giai đoạn cũ**, không phải kết quả cuối của phần CodeGraph. Kết quả cuối và các giới hạn parser được ghi tại tài liệu CodeGraph, cùng bằng chứng lệnh thực tế.

Đã nghiệm thu công cụ cục bộ: CodeGraph 3.17.0, graph 80 file / 923 node / 1.605 edge; 15/15 kiểm thử graph và 9/9 kiểm thử validator đạt. Reviewer đã xác nhận không còn blocker. Bằng chứng mới: [codegraph-verification.json](codegraph-verification.json). Các ô host auto-load vẫn để trống vì chưa kiểm tra tại phiên mới của PO.

## 8. Bổ sung hai quy tắc cứng theo yêu cầu PO — v1.2

- **SME-AI-011:** cấm tự vượt phạm vi/thay yêu cầu; vấn đề phải được giải thích bằng chứng/nguyên nhân/tác động, trình giải pháp tốt hơn và chờ PO duyệt trước khi thực hiện khác.
- **SME-AI-012:** mọi phân tích/xây dựng/sửa/xóa tính năng phải đi ngang để biết độ phủ rồi sâu đệ quy cha → con → cháu, kiểm tra các tầng liên quan và hồi quy xuyên suốt phần được phép.
- [Quy trình chi tiết](../../.agents/workflow/impact-analysis.md) có ma trận ảnh hưởng, kiểm tra callers/callees, vòng lặp, giới hạn kết quả graph và biên HTTP/DI/dữ liệu. Phát hiện cần sửa ngoài phạm vi phải trình PO trước; nếu đang chặn kết quả thì chưa được báo hoàn tất.
- Đồng bộ entrypoint Codex/Gemini, always-on bootstrap, preflight, quick-ref, delivery, guideline và routing. Thêm AC-15…19 để nghiệm thu mô phỏng; không coi đó là 5 tình huống đã chạy trên host.
- Kế hoạch và bằng chứng đợt này: [hard-rules](2026-10-18-hard-rules.md). Số liệu v1/v1.1 ở trên giữ nguyên dưới nhãn lịch sử; xem bản v1.2 để biết kiểm tra hiện tại.

Kiểm chứng v1.2: validator **393 mục đạt, 0 lỗi**, fixture **18/18**, graph **80 file / 927 node / 1.610 edge**. Review độc lập không phát hiện blocker trong phần bổ sung; các kết quả này là kiểm tra tài liệu/cấu hình và tooling, không phải bằng chứng host tự nạp hoặc mô hình tuân thủ thực tế.
