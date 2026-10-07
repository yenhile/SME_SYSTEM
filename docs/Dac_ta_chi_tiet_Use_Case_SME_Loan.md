# TÀI LIỆU ĐẶC TẢ CHI TIẾT USE CASE
## HỆ THỐNG QUẢN LÝ QUY TRÌNH XÉT DUYỆT HỒ SƠ VAY VỐN CỦA DOANH NGHIỆP NHỎ VÀ VỪA (SME), TÍCH HỢP MÔ HÌNH DỰ BÁO NGUY CƠ CHẬM XỬ LÝ HỒ SƠ

- **Ngành**: Hệ Thống Thông Tin | Khóa luận Tốt nghiệp Năm 2026
- **Sinh viên thực hiện**: Lê Thị Yến Nhi - Voòng Thị Yến Trang
- **Giảng viên hướng dẫn**: TS. Ngô Hữu Dũng

---

## MỤC LỤC DANH MỤC USE CASE (22 USE CASES)
1. **Phân hệ Dùng chung**:
   - `UC01`: Đăng nhập hệ thống
   - `UC02`: Đăng xuất & Đổi mật khẩu
2. **Phân hệ Cán bộ tín dụng (CBTD)**:
   - `UC03`: Tiếp nhận & Khởi tạo hồ sơ vay
   - `UC04`: Tải lên & Quản lý tài liệu scan đính kèm
   - `UC05`: Tra cứu & Quản lý danh sách hồ sơ phụ trách
   - `UC06`: Kiểm duyệt tính đầy đủ của hồ sơ (Checklist)
   - `UC07`: Tạo yêu cầu bổ sung hồ sơ (Pause SLA)
   - `UC08`: Ghi nhận hồ sơ bổ sung từ doanh nghiệp (Resume SLA)
   - `UC09`: Xác định hạn mức khoản vay
   - `UC10`: Chuyển hồ sơ sang thẩm định (Khoản vay $\le$ 10 tỷ)
   - `UC11`: Chuyển hồ sơ lên cấp trên (Khoản vay > 10 tỷ)
   - `UC12`: Cập nhật kết quả xét duyệt từ cấp trên
3. **Phân hệ Cán bộ thẩm quyền (Risk Officer)**:
   - `UC13`: Tra cứu danh sách hồ sơ cần thẩm định
   - `UC14`: Xem chi tiết hồ sơ & Xem bản scan tài liệu
   - `UC15`: Thẩm định hồ sơ & Ghi nhận kết quả (Đạt / Không đạt kèm lý do)
4. **Phân hệ Quản lý chi nhánh (Manager)**:
   - `UC16`: Theo dõi tổng quan tiến độ hồ sơ toàn chi nhánh
   - `UC17`: Xem cảnh báo nguy cơ chậm & Giải thích nguyên nhân từ AI
   - `UC18`: Điều chuyển hồ sơ sang cán bộ khác
   - `UC19`: Xem báo cáo thống kê KPI & Điểm nghẽn công đoạn (Bottlenecks)
5. **Phân hệ Quản trị viên hệ thống (Admin)**:
   - `UC20`: Quản lý tài khoản người dùng
   - `UC21`: Quản lý nhóm quyền & Phân quyền chức năng (RBAC)
   - `UC22`: Quản lý danh mục hệ thống & Cấu hình SLA

---

*(Nội dung chi tiết từng Use Case đã được đóng gói đầy đủ trong file Word .docx)*
