# Preflight — áp dụng cho mọi prompt SME Loan

Nguồn quyền và quy tắc: [policy](../AGENTS.md). Bảng này là cách chọn công việc; không phân loại chỉ bằng từ khoá. Ví dụ “giải thích cách sửa” là yêu cầu thông tin nếu chưa giao sửa.

## Trước hành động

1. Xác định kết quả người dùng muốn: giải thích, đề xuất, plan-only, thực thi hay kiểm tra.
2. Kiểm tra phạm vi/quyền đã có, môi trường và side effect. Tách việc code cục bộ khỏi thao tác dữ liệu/app/deploy.
   **SME-AI-011:** nếu yêu cầu không hợp lý/không tối ưu/có thể gây lỗi, báo nguyên nhân, bằng chứng, tác động và phương án tốt hơn để PO duyệt trước; không tự thực thi phương án khác hoặc mở rộng phạm vi.
3. Đầu phiên đọc [Project](../../Project.md); đọc nguồn gần nhiệm vụ. Chỉ nạp lại khi thay đổi/mất context, không quét bí mật/dataset hoặc mọi skill.
4. Nếu nhiệm vụ phụ thuộc cấu trúc source: AI tự chạy `npm run graph:check` qua terminal; graph cũ/thiếu thì `npm run graph:build`. Dùng các subcommand `context`, `deps`, `fn-impact` qua `npm run codegraph --` phù hợp để có context và impact trước sửa; cập nhật graph sau thay đổi source/config. Xem [quy trình CodeGraph](../../docs/ai/2026-10-18-codegraph.md). Không yêu cầu PO chuyển sang chat CLI.
   **SME-AI-012:** với phân tích/xây dựng/sửa/xóa tính năng, thực hiện [ngang → sâu](impact-analysis.md): độ phủ tính năng rồi truy vết đệ quy cha/con/cháu, kiểm tra callers/callees và các biên contract. Ghi mức ảnh hưởng, ranh giới có bằng chứng và ma trận sửa/hồi quy; nếu cần mở rộng quyền, trình PO trước khi sửa.
5. Xác định cách nghiệm thu và skill cần dùng theo [index](../skills.json). Đọc skill trước khi áp dụng, theo adapter policy; không bịa tool.
6. Làm phần được phép, kiểm chứng, trình kết quả và giới hạn. Chỉ hỏi phần thiếu có ảnh hưởng quan trọng.

## Bảng chọn quy trình

| Loại việc | Cách làm và skill | Điểm dừng |
|---|---|---|
| Hỏi thông tin/giải thích | Đọc nguồn cần thiết, trả lời có bằng chứng; không bắt skill/plan artifact | Không sửa file/data |
| Tài liệu/rule | Kiểm tra nguồn và mâu thuẫn; planning nếu nhiều bước, writing-skills khi thực sự tạo/sửa skill | Sửa tài liệu trong phạm vi đã giao; không sửa nghiệp vụ ứng dụng |
| Lập kế hoạch/thiết kế | brainstorming khi khám phá lựa chọn; writing-plans cho nhiều bước | Plan-only thì chờ yêu cầu thực thi; đã giao cả thực thi thì tiếp tục |
| Code có thay hành vi/refactor | Scope/plan tương xứng → TDD cho hành vi quan trọng → thực hiện → verification | Hỏi nếu thiếu quyết định hoặc vượt phạm vi |
| Debug/bug | systematic-debugging → bằng chứng nguyên nhân → kiểm tra hồi quy → verification | Không đoán mò hoặc che lỗi bằng mock |
| Review code/diff | code-review khi có mốc so sánh và nguồn yêu cầu; self-review phù hợp cho kiểm tra nhỏ | Mặc định chỉ đọc; không tự setup tracker/publish issue/PR |
| UI | Workflow code phù hợp + browser-testing trước khẳng định hiển thị đúng | Thiếu browser phải ghi chưa xác minh UI |
| Phân tích nghiệp vụ | Đối chiếu use case, phân quyền, schema, code; tách yêu cầu và hiện trạng | Để mở các điểm PO chưa chốt |
| ML | Kiểm tra schema/payload, dữ liệu, model/metadata; verification đúng loại thay đổi | Không suy diễn SLA thành tín dụng hoặc tự train/ghi đè |
| Vận hành/DB/QA tích hợp | Đọc script, xác định target và side effect; cần đúng quyền dữ liệu | Không seed/migrate/reset/ghi DB ngoài phạm vi |

## Tool và skill

Đường dẫn cụ thể nằm trong skills.json. Khi có hai skill cùng mục tiêu, chọn một phù hợp thay vì áp cả hai; không mặc định TDD hai lần hoặc hai quy trình debug. Skill user-invoked chỉ dùng theo yêu cầu. Code review cần issue tracker nhưng repo chưa cấu hình: dùng tài liệu/local diff sẵn có và nêu giới hạn, không tự nối dịch vụ bên ngoài.

Review work-in-progress: xem status, diff staged và unstaged, cùng nội dung file untracked trong phạm vi được giao. Diff giữa các commit trống không có nghĩa working tree không có thay đổi; không bỏ sót file chỉ vì vendor skill chỉ hướng dẫn review commit.

**CodeGraph bắt buộc cho phân tích code/kiến trúc, coding, debug, review, UI/ML khi thay source.** Chỉ đọc tài liệu/duyệt chính sách không phụ thuộc source thì không cần truy vấn graph. Nếu tool lỗi, có thể tiếp tục khảo sát read-only độc lập bằng `rg`, nhưng phải phục hồi CodeGraph trước khi hoàn tất công việc code liên quan; không âm thầm hạ thành tùy chọn. RTK vẫn tùy chọn. Không tải gói qua `npx`; phục hồi công cụ bằng `npm ci` tại root theo lockfile đã được PO cho phép.

## Trước trả kết quả

Đã kiểm chứng các phần bị ảnh hưởng theo phân tích ngang–sâu, hay còn nhánh chưa xác minh/chờ PO? Đúng yêu cầu/quyền? Có bằng chứng mới cho khẳng định? Đã nêu phần chưa kiểm chứng/chưa chốt? Cần cập nhật đúng tài liệu nào? Không bịa PO duyệt, test pass hoặc trạng thái live.

Phục hồi context bằng [quick-ref](quick-ref.md) rồi đọc lại policy/Project/plan đang làm.
