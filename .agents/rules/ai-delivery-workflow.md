---
trigger: model_decision
description: "Use for SME Loan implementation, debugging and technical delivery; plan, execute, verify and report within authorized scope."
---

# Quy trình bàn giao kỹ thuật SME Loan

Phạm vi và quyền theo [policy](../AGENTS.md). Chọn lộ trình ở [preflight](../workflow/preflight.md); không ép mọi prompt vào một chuỗi phase.

## 1. Xác định và lập kế hoạch

Đọc Project và nguồn liên quan; công việc code/kiến trúc phải kiểm tra graph mới và lấy context/deps/impact từ CodeGraph trước sửa theo [hướng dẫn](../../docs/ai/2026-10-18-codegraph.md); xác định vấn đề, phần làm/không làm, file/interface bị ảnh hưởng, giả định, tiêu chí nghiệm thu. Công việc nhiều bước ghi plan ở `docs/ai/` hoặc vị trí được task chỉ định.

Dùng brainstorming khi cần khám phá thiết kế, writing-plans khi cần kế hoạch nhiều bước. PO chỉ giao plan thì bàn giao plan; PO đã giao thực thi trong phạm vi rõ thì tiếp tục. Hỏi trước phần phụ thuộc quyết định nghiệp vụ hoặc tác động chưa được phép.

**SME-AI-011:** nếu yêu cầu không hợp lý, không tối ưu hoặc gây lỗi, trình nguyên nhân/bằng chứng/tác động và phương án tốt hơn, chờ PO duyệt trước khi thực thi phương án khác. Không tự mở rộng phạm vi.

**SME-AI-012:** trước sửa phải [phân tích ngang → sâu](../workflow/impact-analysis.md): tính năng liên quan/độ phủ/mức ảnh hưởng, rồi truy vết đệ quy cha → con → cháu, cả nơi gọi và phần phụ thuộc. Lập ma trận sửa/hồi quy/quyền và ghi ranh giới/nhánh chưa xác minh. Cần sửa ngoài phạm vi phải trình PO duyệt trước; plan-only không triển khai.

## 2. Thực hiện thay đổi có kiểm soát

Dùng skill phù hợp trong [routing index](../skills.json). Với hành vi/bug, ưu tiên test/regression chứng minh yêu cầu trước sửa khi khả thi. Thay tài liệu/nhãn/cấu hình ít tác động kiểm tra tương xứng. Không bắt tạo test rỗng hay xoá công việc người dùng để làm lại nghi thức.

Giữ API/DTO/enum/ML contract đồng bộ trong phạm vi bị tác động. Xem phân quyền, trạng thái cuối, SLA, transaction và đồng thời khi thay luồng hồ sơ. Không tự đổi các mục PO chưa chốt.

## 3. Điều tra lỗi — chỉ khi có lỗi

Tái hiện → thu bằng chứng → giả thuyết → phép thử nhỏ → xác nhận nguyên nhân → sửa → kiểm tra hồi quy. Dùng systematic-debugging. Không thử hàng loạt bản sửa khi chưa biết nguyên nhân; không chạy startup/seed/test ghi DB nếu chưa xác định môi trường và quyền.

Nếu không có lỗi, bước này không áp dụng; không tạo giả root cause để đủ phase.

## 4. Kiểm chứng và bàn giao

Dùng verification-before-completion trước khẳng định kết quả. Chọn lệnh có thật từ Project/package scripts; run và đọc kết quả. Không bịa `npm test`/lint khi repo chưa có. UI cần browser evidence để kết luận hiển thị đúng; ML cần phân biệt metadata cũ, synthetic evaluation và validation thực tế.

Review scope, diff, acceptance criteria và bảo mật; đối chiếu ma trận ảnh hưởng, kiểm chứng xuyên suốt và hồi quy tính năng liên quan. Nhánh chặn kết quả chưa giải quyết/chưa được duyệt thì không báo hoàn tất. Review độc lập khi được phép và đáng làm; self-review phải ghi đúng là self-review. Không tự gửi issue/PR hay commit/push/deploy.

Bàn giao: thay đổi gì, vì sao, file chính, lệnh/kết quả kiểm chứng, phần chưa xác minh, rủi ro cụ thể và quyết định còn cần PO. Cập nhật tài liệu trực tiếp bị ảnh hưởng và refresh CodeGraph sau thay đổi source/config; `npm run graph:check` phải đạt trước bàn giao công việc code. Tool thiếu/lỗi là việc cần phục hồi, không được đánh dấu yêu cầu CodeGraph đã đạt bằng rg thay thế.
