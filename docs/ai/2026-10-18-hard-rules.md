# Hai quy tắc cứng SME Loan — v1.2, 18/10/2026

## Yêu cầu và phạm vi được giao

PO yêu cầu thêm hai quy tắc bắt buộc: đúng yêu cầu/phạm vi, báo vấn đề và xin duyệt trước khi thực hiện giải pháp khác; phân tích ngang rồi sâu đệ quy khi phân tích/xây dựng/chỉnh sửa/xóa tính năng. Áp dụng cùng policy cho Codex extension và Gemini Antigravity; terminal là công cụ AI dùng nội bộ.

## Phân tích ảnh hưởng và kế hoạch triển khai

Chiều ngang: chính sách chung, điểm nạp hai host, preflight/phục hồi context, workflow bàn giao, routing và nghiệm thu đều tiêu thụ quy tắc này. Không thay đổi chức năng ứng dụng.

Chiều sâu: core → AGENTS/GEMINI/always-on bootstrap → preflight/delivery/quick-ref/guideline → quy trình ảnh hưởng; routing → validator → fixture kiểm thử cấu hình; thay validator source → graph hash cũ → build/check lại. Các tài liệu hướng dẫn/PO review/acceptance là consumer của phiên bản và cách kiểm tra. Vendor SKILL.md không cần sửa và giữ nguyên hash. CodeGraph context/impact của validator và context của fixture đã được truy vấn trước sửa; source được đối chiếu trực tiếp để kiểm tra liên kết tài liệu mà graph không bao phủ.

Kế hoạch trong phạm vi PO giao:

1. Thêm SME-AI-011/012 vào [core](../../.agents/AGENTS.md) và [quy trình ngang–sâu](../../.agents/workflow/impact-analysis.md).
2. Đồng bộ entrypoint/rule/workflow/routing và phiên bản hoạt động thành `sme-loan-ai-v1.2`; giữ bằng chứng cũ đúng nhãn lịch sử.
3. Mở rộng validator, kiểm thử các cấu hình làm mất hard rule/gate PO/thứ tự/đệ quy, thêm tình huống nghiệm thu.
4. Kiểm tra link/integrity, fixture, syntax; làm mới/kiểm tra graph và trình kết quả. Không chạy ứng dụng hoặc thao tác DB.

Phạm vi ngoài yêu cầu (app code, DB/schema/model, global settings, vendor) không cần thay đổi. Không có phương án thay thế nghiệp vụ hoặc mở rộng nào cần xin PO trong đợt này.

## Điểm kiểm soát bắt buộc

| Quy tắc | Điều kiện trước hành động | Điều kiện bàn giao |
|---|---|---|
| SME-AI-011 | Đúng yêu cầu/quyền; nếu có vấn đề thì trình bằng chứng, tác động và giải pháp để PO duyệt trước khi làm khác | Không tự mở rộng hoặc coi im lặng là duyệt |
| SME-AI-012 | Xác định độ phủ ngang rồi truy vết sâu cha/con/cháu, cả caller/callee, biên contract và nhánh chưa xác minh | Thực hiện/kiểm chứng xuyên suốt phần cần sửa trong quyền; hồi quy liên quan; phần chặn kết quả chưa giải quyết không được gọi hoàn tất |

Phụ thuộc ngoài phạm vi phải được PO duyệt trước khi sửa, kể cả khi cần để hoàn thiện tính năng. Phân tích không tạo quyền sửa.

## Bằng chứng kiểm tra

Baseline của validator mở rộng trước bổ sung policy: exit 1, `passed=341 failed=18`, phát hiện thiếu workflow, hai hard rule, wiring, manifest contract và acceptance coverage. Đây là RED cấu hình, không phải bằng chứng mô hình vi phạm.

Kết quả đã chạy trên bản v1.2:

| Kiểm tra | Kết quả |
|---|---|
| Syntax hai script validator/fixture | Exit 0 |
| `node scripts/check-ai-rules.mjs` | 393 mục đạt, 0 lỗi, exit 0 |
| `node scripts/check-ai-rules.test.mjs` | 18/18 ca đạt: 16 cấu hình lỗi bị từ chối và 2 cấu hình hợp lệ/phục hồi được chấp nhận |
| `npm run graph:build` rồi `graph:check` | CodeGraph 3.17.0; 80 file / 927 node / 1.610 edge; exit 0 |
| Truy vấn context validator sau refresh | Thành công, exit 0 |
| Integrity vendor | 259/259 file ngoài Git lồng khớp baseline; 56/56 SKILL.md khớp inventory |
| Integrity các file tracked cũ không thuộc vùng bảo vệ | 120 file khớp; `.gitignore` chỉ thêm `.codegraph/` từ giai đoạn v1.1; không có file mất |
| Vùng bảo vệ | Bỏ qua 10 file thuộc dump/vault/env, không đọc lại để kiểm tra hash |
| Ứng dụng/API/DB/UI/ML runtime | Không chạy; không thay đổi code ứng dụng |

393 mục kiểm tra tĩnh và 18 ca fixture kiểm chứng cấu hình/integrity và khả năng validator từ chối cấu hình sai. Chúng không chứng minh host đã tự nạp hoặc mô hình luôn tuân thủ. 15 ca kiểm thử graph ở hồ sơ v1.1 là bằng chứng lịch sử của tooling không đổi; không gọi là kiểm thử được chạy lại trong đợt này.

Review độc lập không phát hiện blocker/điểm cần sửa trong phạm vi bổ sung v1.2; reviewer chạy lại graph check, validator 393/0, fixture 18/18 và syntax hai script đều exit 0. Review chỉ đọc cấu hình/tài liệu và kiểm thử validator, không thử ứng dụng hay mô hình AI trên 19 tình huống.

Các ca mô phỏng trong [acceptance-scenarios](acceptance-scenarios.json) là tiêu chí cho host, chưa được coi là đã thực thi. Chưa có bằng chứng fresh-session auto-load v1.2 trên hai host của PO.
