# Phân chia vẽ sơ đồ tuần tự (Sequence Diagram) cho 2 người

Mỗi đặc tả trong [2026-11-03-dac-ta-use-case.md](2026-11-03-dac-ta-use-case.md) (mục B, 28 đặc tả) vẽ **1 sơ đồ tuần tự** theo đúng luồng chính của đặc tả. Độ khó: 1 = đơn giản (xem, nhập, lưu), 2 = trung bình, 3 = nhiều đối tượng hoặc nhiều nhánh.

## 1. Cách chia

| | Người A | Người B |
|---|---|---|
| Phạm vi | Đăng nhập, Cán bộ tín dụng, Quản trị viên | Cán bộ thẩm quyền, Quản lý chi nhánh |
| Số sơ đồ | 16 | 12 |
| Tổng độ khó | 28 | 26 |

Người A phụ trách phần đầu quy trình (tiếp nhận đến trình tờ trình) và quản trị. Người B phụ trách phần sau (thẩm định, quyết định) và điều phối, giám sát. Số sơ đồ chênh nhau nhưng khối lượng tương đương vì phần của B có nhiều sơ đồ khó hơn.

## 2. Người A (16 sơ đồ)

| STT | Sơ đồ | Độ khó | Gợi ý đối tượng và API (đối chiếu code trước khi vẽ) |
|---|---|---|---|
| 0 | Đăng nhập | 1 | Màn `LoginPage`; `AuthController` `POST /auth/login`; model người dùng |
| 1.1 | Kiểm tra checklist | 2 | `PortalIntakeDetails`; `portal-intakes` (đánh giá từng mục) |
| 1.2 | Trả sửa đề nghị | 2 | `portal-intakes` `POST :id/return-correction` |
| 1.3 | Đối soát công ty | 3 | `PortalIntakeQueue`; `companies` `GET check/:taxCode`; `portal-intakes` company-reconciliation |
| 1.4 | Tiếp nhận đề nghị | 3 | `portal-intakes` `POST :id/accept`; tạo `LoanApplication` |
| 2.1 | Yêu cầu bổ sung | 2 | `SupplementPanel`; `supplements` `POST :applicationId` |
| 2.2 | Giải quyết bổ sung | 2 | `supplements` `PUT :supplementId/resolve` |
| 2.3 | Xác nhận đủ hồ sơ | 1 | `loan-applications` `PUT :id/check-documents` |
| 3 | Xác định hạn mức | 1 | `loan-applications` `PUT :id/set-amount` |
| 4.1 | Lưu nháp tờ trình | 1 | `AppraisalPanel`; `appraisals` `PUT :applicationId/draft` |
| 4.2 | Trình tờ trình | 3 | `appraisals` `POST :applicationId/submit`; chuyển công đoạn Thẩm định |
| 5 | Tra cứu hồ sơ vay | 1 | `LoanList`; `loan-applications` `GET`, `GET :id` |
| 11.1 | Thêm người dùng | 1 | `AdminView`; `users` `POST` |
| 11.2 | Sửa người dùng | 1 | `users` `PUT :id` |
| 11.3 | Khóa và mở khóa tài khoản | 2 | `users` `PUT :id` (kiểm tra hồ sơ còn mở) |
| 12 | Cấu hình SLA | 1 | `admin` `GET workflow-stages`, `PUT workflow-stages/:code` |

## 3. Người B (12 sơ đồ)

| STT | Sơ đồ | Độ khó | Gợi ý đối tượng và API (đối chiếu code trước khi vẽ) |
|---|---|---|---|
| 6.1 | Xem xét tờ trình | 1 | `LoanDetailModal`, `AppraisalPanel` (chỉ đọc); `appraisals` `GET :applicationId` |
| 6.2 | Yêu cầu làm rõ tờ trình | 2 | `appraisals` `POST :applicationId/clarify` |
| 7.1 | Phê duyệt | 3 | `workflow` `POST :id/transition` (APPROVED) |
| 7.2 | Từ chối | 2 | `workflow` `POST :id/transition` (REJECTED, mã TC01–TC05) |
| 8.1 | Phân công cán bộ tín dụng (lần đầu) | 2 | `IntakeAssignment`; `portal-intakes` `POST :id/assign`; `assignments` `GET officer-workloads` |
| 8.2 | Điều chuyển hồ sơ | 3 | `AssignmentsView`; `assignments` `POST :applicationId/reassign` |
| 8.3 | Duyệt đề nghị điều phối | 2 | `AssignmentChangeRequestsView`; `assignment-change-requests` `POST :id/approve`, `:id/reject` |
| 8.4 | Duyệt báo xung đột lợi ích (COI) | 2 | `assignment-change-requests` (loại COI) |
| 8.5 | Duyệt đối soát công ty | 3 | `portal-intakes` company-reconciliation (duyệt); cập nhật `Company` |
| 9.1 | Xem cảnh báo xử lý chậm | 2 | `DashboardView`; `dashboard` `GET early-warnings`; `prediction` `POST predict/:applicationId` |
| 9.2 | Xem báo cáo thống kê | 2 | `dashboard` `GET overview`, `sla-bottlenecks`, `stage-distribution` |
| 10 | Đóng hồ sơ quá hạn | 2 | `CloseOverdueForm`; `workflow` `POST :id/close-overdue` |

## 4. Quy ước chung để hai người vẽ giống nhau

1. **Mẫu sơ đồ:** theo bài mẫu nhà hàng, gồm Actor, lớp giao diện (Boundary), lớp điều khiển (Controller) và lớp dữ liệu (Model). Ví dụ: `Actor → Admin.index → UserController → UserModel`.
2. **Đặt tên:** Boundary lấy theo tên màn hình trong `frontend/src/components/`; Controller và Model lấy theo `backend/src/modules/`. Dùng cùng một tên cho cùng một đối tượng ở mọi sơ đồ (ví dụ luôn là `LoanController`, không đổi tên giữa các sơ đồ).
3. **Nội dung:** vẽ **theo đúng các bước trong đặc tả** (luồng chính), mỗi bước của cột Actor là một thông điệp đi vào, mỗi bước của cột System là phản hồi tương ứng. Ngoại lệ hoặc luồng thay thế chỉ vẽ khi đặc tả có.
4. **Đánh số thông điệp** theo mẫu: 1, 1.1, 1.1.1... như bài mẫu, tên thông điệp ghi API khi gọi máy chủ (ví dụ `PUT /loan-applications/:id/set-amount`).
5. **Tên hình và bảng:** đánh số liên tục theo chương, ví dụ "Hình 3.x: Sơ đồ tuần tự chức năng Tiếp nhận đề nghị".
6. **Không vẽ** cơ chế bên trong (khóa giao dịch, mã băm, phiên bản). Chỉ vẽ các lời gọi chính giữa các lớp.

## 5. Chỗ hai người phải thống nhất với nhau
- **Đối soát công ty (1.3, người A) và Duyệt đối soát công ty (8.5, người B):** cùng một luồng đề nghị và phê duyệt. Hai người dùng chung tên đối tượng, thông điệp gửi đề nghị và nhận kết quả phải khớp.
- **Báo xung đột lợi ích và đề nghị điều phối:** CBTD gửi (không có đặc tả riêng của CBTD) và Quản lý duyệt (8.3, 8.4 của người B). Người B cần mô tả phần gửi đề nghị ở đầu sơ đồ nếu cần, hoặc ghi chú đối tượng đã tồn tại.
- **Trình tờ trình (4.2, người A) và Xem xét tờ trình (6.1, người B):** người A kết thúc ở chỗ hồ sơ chuyển sang Thẩm định, người B bắt đầu từ lúc Thẩm quyền mở hồ sơ. Hai sơ đồ nối tiếp nhau, cần cùng tên công đoạn và trạng thái.
- **Đăng nhập (người A):** các sơ đồ khác không vẽ lại bước đăng nhập, chỉ ghi "đã đăng nhập".

## 6. Lưu ý
- Danh sách API ở cột gợi ý lấy từ controller trong nhánh `main` và Master. Những dòng liên quan `portal-intakes` (1.1, 1.2, 1.3, 1.4, 8.1, 8.5) tôi chưa liệt kê đủ route từ code, người vẽ cần mở `backend/src/modules/portal/portal.controller.ts` để lấy đúng.
- Tên nút và trạng thái trong sơ đồ phải khớp đặc tả; nếu đặc tả còn ghi `[CẦN XÁC NHẬN]` thì xác nhận trước rồi mới vẽ.
- **22 đặc tả chưa viết:** hai người chỉ nên vẽ phần có đặc tả. Phần chưa có đặc tả thì chờ AI viết xong rồi mới vẽ (xem trạng thái mục B của file đặc tả).
