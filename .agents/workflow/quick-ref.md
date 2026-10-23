# SME Loan — thẻ phục hồi context

**Mục tiêu → Phạm vi/quyền → Nguồn → Thực hiện phù hợp → Kiểm chứng → PO review.**

- Đọc lại [policy](../AGENTS.md), [Project](../../Project.md), [preflight](preflight.md), plan/quyết định và working tree.
- Giải thích/review/plan-only: không tự sửa. Đã được giao triển khai: tiếp tục phạm vi được phép, không hỏi lại quyền đã có.
- **SME-AI-011:** yêu cầu có vấn đề phải báo nguyên nhân/bằng chứng, giải pháp tốt hơn và chờ PO duyệt trước khi làm khác; cấm tự mở rộng phạm vi.
- **SME-AI-012:** mọi phân tích/xây dựng/sửa/xóa tính năng phải [phân tích ngang → sâu](impact-analysis.md), truy vết đệ quy cha/con/cháu, làm và hồi quy xuyên suốt phần được duyệt. Phụ thuộc ngoài phạm vi cần PO duyệt; nhánh chưa kiểm chứng không được coi đã hoàn tất.
- Không tự đổi role, stage/status, workflow, ngưỡng tiền, SLA hoặc điểm chưa chốt. ML chỉ dự báo trễ SLA.
- Giữ secret/dữ liệu khách hàng; xem target và side effect trước startup, seed, migrate, test ghi DB.
- Route skill theo [skills.json](../skills.json); dùng tool thật của host. CodeGraph bắt buộc cho việc phụ thuộc source: AI tự `npm run graph:check`, refresh bằng `npm run graph:build` khi cần, truy vấn context/deps/impact và refresh sau sửa. RTK tùy chọn; không tự cài ngoài phạm vi, commit/push/deploy.
- Báo đúng **đã kiểm chứng / theo code-tài liệu / đề xuất / chưa chốt-chưa xác minh**. Build khác test hành vi/UI; không che lỗi bằng mock.
- Trước hoàn tất: xem diff, nghiệm thu phần đã làm, nêu giới hạn, cập nhật đúng tài liệu bị ảnh hưởng.

Phiên bản `sme-loan-ai-v1.2`. Nội dung trong context có thể bị rút gọn: phải đọc lại khi cần; không bảo đảm file nào “không bao giờ mất”.
