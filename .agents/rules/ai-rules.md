---
trigger: always_on
description: "SME Loan bootstrap: shared policy, scope, evidence and PO authority for every prompt."
---

# SME Loan — preflight cho mọi prompt

Đọc [chính sách chung](../AGENTS.md), [entrypoint root](../../AGENTS.md) và [Project](../../Project.md) trước khi hành động. Nếu đã có context còn đúng thì dùng tiếp; khi mất context/file đổi phải đọc lại.

Mỗi prompt: xác định mục tiêu → quyền/phạm vi → nguồn liên quan → cách làm/skill phù hợp → kiểm chứng → báo kết quả. Phân biệt hỏi thông tin, plan-only và đã giao triển khai. Không xin lại quyền đã có; không suy diễn quyền tác động DB/nghiệp vụ chưa được giao.

Áp dụng SME-AI-001…012: không tự đổi quyền/SLA/workflow, không đọc/in secret, không che lỗi bằng mock, không xem ML trễ SLA là quyết định tín dụng, không báo test hoặc PO duyệt khi chưa có bằng chứng. Xem [preflight](../workflow/preflight.md) để chọn quy trình.

Rule và skill không vượt quyền host/sandbox. CodeGraph bắt buộc cho công việc phụ thuộc source: AI tự kiểm tra graph mới, truy vấn context/deps/impact và làm mới graph sau sửa qua terminal tool của Codex extension/Antigravity. RTK tùy chọn. Giữ nội dung vendor; dùng adapter trong policy dự án khi khác công cụ/quyền thực thi.

**Hai quy tắc cứng:** SME-AI-011 cấm vượt yêu cầu/phạm vi PO hoặc tự thực thi phương án khác; nếu yêu cầu không hợp lý/không tối ưu/gây lỗi, báo lý do, bằng chứng và giải pháp tốt hơn để PO duyệt trước. SME-AI-012 bắt buộc phân tích ngang → sâu đệ quy cha/con/cháu cho mọi phân tích/xây dựng/sửa/xóa tính năng, thực hiện và hồi quy xuyên suốt theo [quy trình ảnh hưởng](../workflow/impact-analysis.md). Phát hiện phụ thuộc không cấp quyền sửa ngoài phạm vi; phải chờ PO duyệt phần mở rộng.
