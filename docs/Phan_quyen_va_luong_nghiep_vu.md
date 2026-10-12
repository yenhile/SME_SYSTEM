# Phân quyền và luồng hồ sơ — bản đề xuất để nhóm chốt nghiệp vụ

## Quyền đang áp dụng

Mọi màn hình nghiệp vụ và API đều yêu cầu JWT hợp lệ. Một tài khoản được cấp nhiều vai trò qua bảng `user_roles`; mỗi phiên thao tác chọn một vai trò. API xác minh vai trò đó từ database, không tin vào select trên giao diện. Chuyển vai trò không đổi tài khoản và không mở rộng quyền ngoài những vai trò được cấp.

| Chức năng | CBTD | Thẩm quyền | Quản lý | Admin |
|---|---|---|---|---|
| Hồ sơ vay, doanh nghiệp | Hồ sơ được phân công | Xem hồ sơ | Xem hồ sơ | Không có menu nghiệp vụ |
| Tạo hồ sơ, kiểm tra chứng từ, định mức ban đầu | Có, ở tiếp nhận | Không | Không | Không |
| Chứng từ, yêu cầu/giải quyết bổ sung | Tiếp nhận, hồ sơ được phân công | Thẩm định/cấp trên | Chỉ xem | Không |
| Chuyển tiếp nhận → thẩm định | Có, hồ sơ được phân công và đủ chứng từ | Không | Không | Không |
| Trình cấp trên, duyệt/từ chối | Không | Có, ở thẩm định/cấp trên | Không | Không |
| Giám sát SLA, dự báo AI | Xem dự báo trong hồ sơ | Có | Có | Không |
| Điều chuyển, xem tải cán bộ | Không | Không | Có | Không |
| Tài khoản, cấp nhiều vai trò, khóa tài khoản | Không | Không | Không | Có |
| Cấu hình SLA | Không | Không | Không | Có |

Chứng từ, bổ sung và lịch sử công đoạn nằm trong chi tiết hồ sơ; không tách thành các menu trống. Admin có khu vực quản trị riêng. Nếu một tài khoản có cả Admin và vai trò tài chính, chọn vai trò tài chính để vào khu vực nghiệp vụ.

## Luồng đang triển khai

Một hồ sơ giữ nguyên `id` và `applicationCode` từ đầu đến cuối; các bước cập nhật cùng một bản ghi và thêm lịch sử công đoạn. Database PostgreSQL là nguồn dữ liệu; frontend không dùng mock hay đăng nhập demo. Dữ liệu ban đầu là dữ liệu mẫu do seed, đã lưu thật trong database.

1. CBTD tạo hồ sơ trống từ thông tin nhập hoặc chủ động tra mã số thuế. Hồ sơ vào `TIEP_NHAN / RECEIVED`, gán cho người tiếp nhận.
2. CBTD xác nhận chứng từ, hồ sơ thành `CHECKED`; có thể xác định hạn mức chính thức trước thẩm định.
3. Chuyển `THAM_DINH / PENDING_APPRAISAL`, đóng lịch sử tiếp nhận và mở lịch sử thẩm định trong cùng transaction.
4. Thẩm quyền duyệt khoản vay trong hạn mức chi nhánh; khoản vay vượt 10 tỷ phải đi qua `CAP_TREN / WAITING_HEAD_OFFICE` trước khi duyệt.
5. Duyệt hoặc từ chối chuyển `HOAN_TAT`, đóng lịch sử và đặt thời điểm hoàn tất. Hồ sơ kết thúc không được chuyển bước, sửa chứng từ hay điều chuyển tiếp.
6. Yêu cầu bổ sung tạm dừng SLA, chặn chuyển bước. Giải quyết yêu cầu tiếp tục SLA tại công đoạn hiện tại. Tại tiếp nhận phải xác nhận chứng từ lại.

Chuyển bước và bổ sung được khóa theo hồ sơ trong transaction để tránh hai thao tác tạo lịch sử trùng. Tệp tải lên (tối đa 10 MB) được lưu trong volume `uploaded_documents`; metadata nằm trong PostgreSQL, tải xuống có JWT và kiểm tra quyền hồ sơ. Metadata của tài liệu seed có thể chưa kèm tệp thực.

SLA mới do Admin cấu hình chỉ áp dụng khi mở công đoạn tiếp theo; không thay đổi định mức đã chụp trong lịch sử cũ.

Khi dịch vụ ML lỗi, thao tác dự báo báo lỗi thật và giữ kết quả cũ nếu có; không sinh xác suất giả để thay thế. Lỗi ML không rollback bước chuyển workflow đã hoàn tất.

## Cần họp và thống nhất trước khi mở rộng

- Vai trò duyệt tại cấp trên có cần tách khỏi `THAM_QUYEN` không; ai được phê duyệt ở từng ngưỡng tiền?
- Thẩm quyền và Quản lý xem theo toàn hệ thống hay chỉ chi nhánh; có phân công riêng cho người thẩm định không?
- Checklist chứng từ bắt buộc theo loại vay, người xác nhận đầy đủ, quy tắc sửa hạn mức và cập nhật thông tin doanh nghiệp.
- SLA tính theo giờ thực hay giờ làm việc, ngày nghỉ, thời hạn bổ sung và người được đóng hồ sơ quá hạn. `CLOSED_TIMEOUT` chưa có thao tác tự động mới trong đợt sửa này.
- Chốt định dạng mã hồ sơ: hiện dùng ngày và hậu tố duy nhất để tránh trùng khi tạo đồng thời, thay vì số thứ tự đếm không an toàn.
- Dự báo dùng mô hình huấn luyện trên dữ liệu tổng hợp; chưa xem là mô hình đã được xác thực cho nghiệp vụ thực tế.

## Gợi ý phân công theo chức năng

| Gói công việc | Phạm vi và tiêu chí bàn giao |
|---|---|
| Xác thực và quản trị | JWT, phiên đăng nhập, tài khoản nhiều vai trò, khóa tài khoản, SLA; kiểm thử 401/403 và vai trò bị thu hồi |
| Tiếp nhận và chứng từ | Tạo/tra doanh nghiệp, checklist, tải/tải xuống tài liệu, bổ sung; kiểm thử tạo rồi tải lại vẫn còn dữ liệu |
| Workflow và thẩm định | Ma trận chuyển trạng thái, hạn mức, duyệt/từ chối, SLA và lịch sử; kiểm thử một ID đi hết quy trình, không nhảy bước |
| Giám sát và điều phối | Dashboard, tìm/lọc, tải cán bộ, điều chuyển, phạm vi chi nhánh; kiểm thử dữ liệu thống nhất với hồ sơ |
| ML và tích hợp | Hợp đồng request/response, dữ liệu huấn luyện, thông báo lỗi dịch vụ, giải thích rủi ro; kiểm thử cùng API hồ sơ |

Nhóm tự gán tên người phụ trách sau khi thống nhất nghiệp vụ. Mỗi chức năng cần thống nhất DTO, enum, API và bộ dữ liệu kiểm thử chung; bàn giao bằng luồng chạy thật qua nhiều vai trò.
