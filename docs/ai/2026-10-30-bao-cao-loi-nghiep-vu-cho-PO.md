# Báo cáo rà soát nghiệp vụ và phân quyền — các điểm cần PO xem

Ngày 30/10/2026. Phạm vi: nhánh `main` (commit `206fa39`) và `HANDOVER_v2.1.md`. Phương pháp: đọc source và đối chiếu handover; **chưa chạy thật trên môi trường** (chỉ xác nhận trực tiếp việc container backend không có biến `JWT_SECRET`). Chưa sửa gì; mọi chỉnh sửa sẽ làm sau và chỉ khi PO duyệt.

> **Cập nhật 31/10/2026 — trạng thái sau khi sửa:**
> - **Đã sửa:** điểm 1 (khóa ký đăng nhập), 2 (nhắc/đóng quá hạn khi doanh nghiệp đã gửi đủ), 4 (menu và trang theo vai trò), 5 (chứng từ đổi sau khi xác nhận), 6 (điều chuyển CBTD trong một giao dịch), 8 (giới hạn đăng nhập 5 lần/15 phút, ngưỡng do bên triển khai chọn). Quản lý không còn quyền xem danh sách người dùng.
> - **Còn chờ PO:** điểm 3 (một người nhiều vai trò tự làm tự duyệt), điểm 7 (khóa tài khoản đang giữ hồ sơ), và ba lựa chọn ở mục 3 (đường tạo hồ sơ trực tiếp, xác nhận chứng từ hai lần, tờ trình thẩm định).
> - **Đã chốt:** CBTD vẫn xem (chỉ xem) hồ sơ của mình sau khi chuyển Thẩm định.
> - Bảng và mô tả bên dưới giữ nguyên bản 30/10 để đối chiếu; xem mục này để biết trạng thái hiện tại.

## 1. Tóm tắt

| # | Điểm | Mức | Vai trò liên quan | Cần PO quyết nghiệp vụ? |
|---|---|---|---|---|
| 1 | Khóa ký đăng nhập đang là giá trị mặc định công khai | Nghiêm trọng | Mọi vai trò | Không (chỉ cần duyệt sửa) |
| 2 | Quản lý có thể đóng hồ sơ quá hạn dù doanh nghiệp đã gửi đủ bổ sung | Nghiêm trọng | Quản lý, Doanh nghiệp | Không (đã thuộc C.9.2) |
| 3 | Một người giữ nhiều vai trò có thể tự làm và tự duyệt cùng một hồ sơ | Nghiêm trọng | CBTD, Thẩm quyền, Quản lý | **Có** |
| 4 | Menu hiện mọi chức năng cho mọi vai trò; mở vào trang bị từ chối | Trung bình | CBTD, Admin, Thẩm quyền | **Có** |
| 5 | Sửa/xóa chứng từ sau khi đã "xác nhận đủ chứng từ" không hủy xác nhận | Trung bình | CBTD | Không |
| 6 | Điều chuyển CBTD thiếu an toàn dữ liệu (lịch sử và người phụ trách có thể lệch) | Trung bình | Quản lý | Không |
| 7 | Admin tự khóa mình hoặc khóa CBTD đang giữ hồ sơ mà không cảnh báo | Trung bình | Admin | Có (cách xử lý hồ sơ mồ côi) |
| 8 | Đăng nhập nội bộ không giới hạn số lần thử | Trung bình | Mọi vai trò nội bộ | Không |

## 2. Chi tiết từng điểm

1. **Khóa ký đăng nhập.** Mã dùng một chuỗi cố định có sẵn trong repo khi không cấu hình `JWT_SECRET`, và bản chạy Docker hiện không cấu hình biến này. Quản lý xem được mã định danh của Admin (qua danh sách người dùng) nên về lý thuyết có thể tự tạo phiên đăng nhập Admin. *Đề xuất:* bắt buộc cấu hình khóa; thiếu thì hệ thống không khởi động.
2. **Đóng và nhắc quá hạn.** Bộ nhắc 5 ngày và chức năng đóng hồ sơ chỉ xét yêu cầu bổ sung "chưa hoàn tất", không phân biệt doanh nghiệp đã gửi đủ và đang chờ ngân hàng kiểm tra. Hồ sơ như vậy vẫn bị nhắc và vẫn đóng được, trái quy tắc C.9.2 ("không đóng vì ngân hàng chưa kiểm tra phản hồi đã gửi đủ"). *Đề xuất:* xử lý cùng đợt SLA PA1.
3. **Kiêm nhiệm vai trò.** Hệ thống cho một tài khoản có nhiều vai trò và không có kiểm tra "người làm khác người duyệt". Ví dụ người vừa là CBTD vừa là Thẩm quyền có thể tiếp nhận, chuyển thẩm định rồi phê duyệt một mình. Quản lý kiêm CBTD có thể tự giao hồ sơ cho mình. *Cần PO chọn:* (a) cấm tổ hợp vai trò đó, hoặc (b) cấm cùng một người xử lý hai công đoạn của một hồ sơ, hoặc (c) chấp nhận và ghi vào quy chế.
4. **Menu theo vai trò.** Cả 9 mục menu hiện cho mọi vai trò và trang mặc định là Dashboard, nên CBTD và Admin vào là gặp "Quyền truy cập bị từ chối". Bộ kiểm thử hiện tại đang khẳng định "không giới hạn theo vai trò", tức việc này đang là hành vi được mã hóa. Backend vẫn chặn đúng nên không lộ dữ liệu; đây là lỗi trải nghiệm và rối vai trò. *Cần PO xác nhận* được phép ẩn menu theo vai trò và đặt trang mặc định theo vai trò.
5. **Chứng từ.** Sau khi CBTD bấm "xác nhận đủ", việc tải thêm hoặc xóa chứng từ không làm mất xác nhận (chỉ tạo yêu cầu bổ sung mới đặt lại). Hồ sơ vẫn chuyển thẩm định được dù chứng từ đã đổi. *Đề xuất:* mọi thay đổi chứng từ phải hủy xác nhận.
6. **Điều chuyển CBTD.** Thao tác ghi lịch sử rồi mới cập nhật người phụ trách, không đóng gói thành một giao dịch (phần phân công Portal thì có). Lỗi giữa chừng hoặc hai thao tác đồng thời có thể làm lịch sử và người phụ trách khác nhau.
7. **Quản trị tài khoản.** Admin tự bỏ quyền Admin hoặc khóa chính mình được. Khóa hoặc bỏ vai trò một CBTD đang giữ hồ sơ để lại hồ sơ không ai xử lý mà không có cảnh báo.
8. **Đăng nhập.** Không giới hạn số lần thử mật khẩu sai ở phía nhân viên (Portal doanh nghiệp thì có giới hạn). Phiên sống 7 ngày; khóa tài khoản có hiệu lực ngay (điểm tốt).

## 3. Luồng thừa hoặc chồng chéo cần PO cân nhắc

- **Hai đường tạo hồ sơ vay:** CBTD tự tạo (có nút "Tiếp nhận hồ sơ") và Portal rồi tiếp nhận. Đường tự tạo bỏ qua vòng kiểm tra–đối soát Portal V2. Giữ làm ngoại lệ tại quầy hay bỏ?
- **Kiểm tra chứng từ hai lần:** CBTD kiểm từng mục ở Portal, sau tiếp nhận lại bấm "xác nhận đủ chứng từ" (thao tác này chỉ đặt một cờ, không đối chiếu gì). Chứng từ Portal được sao chép sang kho nội bộ khi tiếp nhận nên cùng một tài liệu tồn tại ở hai nơi.
- **Ba đường nộp Portal cùng tồn tại:** V1, V2 thử nghiệm, V2 vòng kiểm tra mới. Nên dọn khi V2 được nghiệm thu.
- **Có trong mô tả nhưng không có trong sản phẩm:** "CBTD lập tờ trình thẩm định". Sau Tiếp nhận CBTD không có thao tác nào; chỉ Thẩm quyền xử lý.
- **Dư nhỏ:** tệp dữ liệu mẫu giao diện không còn dùng; hai API liệt kê cán bộ trùng chức năng; Quản lý có quyền xem danh sách người dùng nhưng giao diện không dùng.

## 4. Đã kiểm tra và đúng thiết kế
CBTD chỉ thấy hồ sơ được giao; Thẩm quyền bị chặn ở công đoạn Tiếp nhận; vai trò được kiểm tra lại từ cơ sở dữ liệu ở mỗi lần gọi; hàng đợi Portal lọc nhất quán theo phân công; chuyển bước có khóa chống thao tác đồng thời.

## 5. Đề xuất thứ tự xử lý
1. Điểm 1 (bảo mật, không cần quyết nghiệp vụ).
2. Điểm 2 làm cùng đợt SLA PA1.
3. Điểm 5 và 6 (sửa nhỏ, rủi ro thấp).
4. Điểm 4, 3, 7 sau khi PO quyết định.

**PO cần trả lời:** (1) điểm 3 chọn phương án nào; (2) điểm 4 có cho ẩn menu theo vai trò không; (3) đường tạo hồ sơ trực tiếp giữ hay bỏ; (4) khi khóa CBTD đang giữ hồ sơ thì xử lý thế nào (chặn khóa, hay buộc điều chuyển trước).
