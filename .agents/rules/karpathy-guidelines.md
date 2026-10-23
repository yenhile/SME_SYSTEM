---
trigger: model_decision
description: "Use when changing code or design in SME Loan: assumptions, minimal scope, small changes and proportionate verification."
---

# Nguyên tắc sửa đổi tối thiểu

Áp dụng cùng [chính sách SME Loan](../AGENTS.md); không tự tạo quyền triển khai, commit hoặc xin duyệt lặp.

- Hiểu trước khi sửa: đọc source/call site, nêu giả định quan trọng; hỏi nếu thiếu quyết định làm thay đổi nghiệm thu.
- Phân tích tính năng theo chiều ngang rồi truy vết sâu đệ quy theo SME-AI-012; đọc [quy trình ảnh hưởng](../workflow/impact-analysis.md). Không chỉ sửa file cha; kiểm chứng các phần bị ảnh hưởng.
- Theo SME-AI-011, khi yêu cầu không hợp lý/không tối ưu/gây lỗi, báo nguyên nhân và đề xuất tốt hơn để PO duyệt trước khi thực hiện khác; không tự mở rộng phạm vi.
- Chọn giải pháp đơn giản đáp ứng đúng yêu cầu. Không thêm feature, dependency, abstraction hoặc refactor suy đoán.
- Plan tương xứng: thay đổi nhỏ nêu ngắn; nhiều bước ghi file plan và tiêu chí kiểm chứng. Tôn trọng plan-only và quyền triển khai đã có.
- Chia bước có thể xem xét và hoàn tác; không sửa định dạng hàng loạt hoặc phần người dùng đang làm.
- Kiểm tra hành vi quan trọng, lỗi biên và quyền truy cập. Không tạo test chỉ lặp lại cấu trúc code; không dùng build thay cho bằng chứng UI.
- Khi sai, nêu nguyên nhân và sửa có căn cứ. Không che lỗi integration bằng mock, không báo kiểm tra chưa chạy là pass.
- Kết thúc bằng kết quả và giới hạn có bằng chứng; cập nhật tài liệu bị ảnh hưởng. Không tự commit chỉ vì skill đề nghị.
