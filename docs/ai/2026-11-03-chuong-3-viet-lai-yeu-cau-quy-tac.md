# Chương 3: bản viết lại mục 3.2.1, 3.2.2 và 3.3

Bản nháp lưu tạm, chưa thay vào file chương 3 chính ([2026-11-02-chuong-3-phan-tich-yeu-cau.md](2026-11-02-chuong-3-phan-tich-yeu-cau.md)). Viết cho báo cáo đồ án. Phạm vi: hệ thống nội bộ của ngân hàng, **không có actor Doanh nghiệp**. Danh sách những điểm cần kiểm tra lại nằm ở cuối file.

---

# 3.2.1 Yêu cầu chức năng (Functional Requirement)

Hệ thống phục vụ cán bộ nội bộ của ngân hàng. Doanh nghiệp là bên ngoài hệ thống: hồ sơ do doanh nghiệp nộp được hệ thống tiếp nhận để xử lý.

**Cán bộ tín dụng**
- Đăng nhập, xem danh sách và tra cứu hồ sơ được phân công.
- Kiểm tra từng mục trong danh mục chứng từ của đề nghị vay; trả đề nghị để doanh nghiệp chỉnh sửa khi có mục chưa đạt.
- Đối soát dữ liệu doanh nghiệp đã có trong hệ thống khi mã số thuế đã tồn tại; chỉ xem đầy đủ thông tin doanh nghiệp thuộc hồ sơ của mình.
- Tiếp nhận đề nghị đã được Quản lý phân công, hoặc tạo hồ sơ trực tiếp tại quầy.
- Tải lên, xem và tải xuống chứng từ của hồ sơ được phân công.
- Xác định hạn mức vay chính thức (tối đa 10 tỷ đồng) và xác nhận hồ sơ đã đủ chứng từ.
- Yêu cầu doanh nghiệp bổ sung chứng từ, kiểm tra từng tài liệu bổ sung và hoàn tất yêu cầu bổ sung.
- Lập tờ trình thẩm định, lưu nháp và trình lên Thẩm quyền; khi được yêu cầu làm rõ thì giải trình và trình lại thành bản mới.
- Gửi đề nghị điều phối hồ sơ hoặc báo xung đột lợi ích.
- Xem lịch sử xử lý của hồ sơ mình phụ trách; sau khi hồ sơ rời công đoạn Tiếp nhận thì chỉ xem, không thao tác.
- Xem kết quả dự báo nguy cơ chậm của hồ sơ mình phụ trách, chỉ để nắm hồ sơ nào sắp trễ.
- Nhận thông báo nhắc bổ sung ở mốc ngày 5 và thông báo quá hạn ở mốc ngày 10.

**Cán bộ thẩm quyền**
- Xem các hồ sơ từ công đoạn Thẩm định trở đi và tờ trình bản mới nhất.
- Yêu cầu CBTD làm rõ tờ trình; yêu cầu doanh nghiệp bổ sung chứng từ khi cần.
- Phê duyệt (kèm số tiền và lãi suất) hoặc từ chối hồ sơ; khi từ chối phải chọn lý do theo danh mục và ghi giải trình.
- Không được thẩm định hoặc quyết định hồ sơ mà mình đã phụ trách, đã tiếp nhận hoặc đã lập tờ trình.
- Xem dashboard thời gian xử lý, cảnh báo sớm và dự báo nguy cơ chậm để sắp xếp thứ tự xử lý. Danh sách cảnh báo không gồm hồ sơ đang ở Tiếp nhận.

**Quản lý chi nhánh**
- Xem toàn bộ hồ sơ trong chi nhánh, tiến độ và người phụ trách.
- Xem dashboard thời gian xử lý (SLA), cảnh báo sớm và danh sách hồ sơ quá hạn bổ sung.
- Phân công hồ sơ mới cho CBTD, điều chuyển hồ sơ giữa các cán bộ và xem khối lượng công việc từng cán bộ; không được giao hồ sơ cho chính mình.
- Duyệt hoặc từ chối đề nghị điều phối, báo xung đột lợi ích và đề nghị đối soát dữ liệu doanh nghiệp; không tự duyệt đề nghị do mình lập.
- Đóng hồ sơ quá hạn bổ sung và ghi lý do; không đóng hồ sơ mình phụ trách hoặc đã tiếp nhận.
- Tính lại dự báo nguy cơ chậm của hồ sơ khi cần.

**Quản trị viên**
- Tạo, sửa tài khoản nội bộ và cấp nhiều vai trò cho một tài khoản.
- Khóa hoặc mở khóa tài khoản; không tự khóa mình, không khóa hoặc bỏ vai trò CBTD của người còn hồ sơ chưa hoàn tất.
- Cấu hình thời gian xử lý chuẩn (SLA) cho từng công đoạn.

**Dùng chung:** đăng nhập, xem thông báo nội bộ, chuyển vai trò làm việc (với cán bộ có nhiều vai trò).

---

# 3.2.2 Yêu cầu phi chức năng (Non-Functional Requirement)

- **Bảo mật và phân quyền:** Mọi chức năng nội bộ yêu cầu đăng nhập; vai trò đang dùng được kiểm tra ở máy chủ, không chỉ ẩn trên giao diện. CBTD chỉ truy cập hồ sơ được phân công. Mật khẩu mới tối thiểu 8 ký tự. Đăng nhập bị khóa tạm thời sau nhiều lần sai liên tiếp trong 15 phút.
- **Toàn vẹn dữ liệu:** Một hồ sơ giữ nguyên mã từ đầu đến cuối. Mỗi lần chuyển bước được ghi cùng lịch sử trong một giao dịch có khóa hồ sơ, nên không bị ghi trùng khi nhiều người thao tác cùng lúc. Tờ trình đã trình là bản không sửa được, và hệ thống đối chiếu căn cứ trước khi quyết định. Hồ sơ đã hoàn tất không cho chỉnh sửa.
- **Khả năng truy vết:** Mỗi công đoạn lưu thời điểm vào và ra, người xử lý, ghi chú và kết quả SLA. Các thao tác điều phối, đối soát và quyết định đều có lịch sử.
- **Quản lý tệp đính kèm:** Mỗi tệp chứng từ tối đa 10 MB; tải xuống phải qua kiểm tra quyền truy cập hồ sơ.
- **Độ tin cậy của dự báo:** Khi dịch vụ dự báo gặp lỗi, hệ thống báo lỗi thật (không tự đưa ra xác suất giả), giữ kết quả dự báo cũ nếu có và không làm hỏng bước chuyển hồ sơ đã hoàn thành.
- **Giao diện người dùng:** Ứng dụng web chạy trên trình duyệt; mỗi vai trò chỉ thấy các mục thuộc quyền của mình.
- **Khả năng mở rộng:** Phần dự báo chạy thành dịch vụ riêng, có thể thay mô hình mà không ảnh hưởng phần quản lý hồ sơ.
- **Thời gian phản hồi:** Thời gian phản hồi mỗi thao tác không vượt quá … giây. `[CẦN BỔ SUNG con số sau khi đo]`
- **Triển khai:** Hệ thống đóng gói để chạy bằng Docker Compose. Hiện mới chạy trên máy cục bộ; việc triển khai lên máy chủ là dự định.

---

# 3.3 Quy tắc nghiệp vụ (Business Rule)

**Quy trình xử lý hồ sơ**
- Hồ sơ đi một chiều qua các công đoạn Tiếp nhận, Thẩm định và Hoàn tất.
- Một hồ sơ giữ nguyên mã hồ sơ từ đầu đến cuối quy trình.
- Hồ sơ chỉ được tiếp nhận khi toàn bộ checklist đạt; tiếp nhận không tự chuyển sang trạng thái đã kiểm tra đủ chứng từ, CBTD phải tự xác nhận.
- Hạn mức vay chính thức tối đa 10 tỷ đồng.
- Hồ sơ chuyển sang Thẩm định khi CBTD trình tờ trình, với điều kiện đã xác nhận đủ chứng từ và không còn yêu cầu bổ sung đang mở.
- Ở công đoạn Thẩm định, Thẩm quyền có thể yêu cầu làm rõ tờ trình; khi đủ căn cứ thì phê duyệt (số tiền không vượt hạn mức, lãi suất từ 0 đến 100%) hoặc từ chối (chọn lý do theo danh mục và ghi giải trình).
- Hồ sơ đã hoàn tất không được sửa chứng từ, chuyển bước hay điều chuyển.

**Bổ sung chứng từ**
- Khi hồ sơ thiếu giấy tờ, CBTD yêu cầu doanh nghiệp bổ sung.
- Mốc thời gian: ngày 0 gửi yêu cầu; ngày 5 nhắc cán bộ phụ trách và gửi email nhắc doanh nghiệp (nếu hồ sơ qua cổng tiếp nhận); ngày 10 đánh dấu quá hạn, báo cho cán bộ phụ trách và hiện trên dashboard của Quản lý. Việc quét nhắc chạy mỗi ngày một lần lúc 08:00 giờ Việt Nam.
- Các mốc tính theo ngày lịch giờ Việt Nam; mốc rơi vào thứ Bảy hoặc Chủ nhật thì lùi sang thứ Hai.
- Hệ thống không tự đóng hồ sơ quá hạn; chỉ Quản lý được đóng thủ công và phải ghi lý do. Không đóng được khi doanh nghiệp đã gửi đủ chứng từ.

**Thời gian xử lý (SLA)**
- Thời gian chờ doanh nghiệp bổ sung không tính vào SLA của ngân hàng: SLA tạm dừng khi gửi yêu cầu bổ sung và tiếp tục khi doanh nghiệp gửi phản hồi. Yêu cầu làm rõ tờ trình nội bộ không làm tạm dừng SLA.
- SLA tính theo giờ làm việc tại Việt Nam, thứ Hai đến thứ Sáu, từ 08:00 đến 12:00 và từ 13:00 đến 17:00.
- Quản trị viên cấu hình thời gian chuẩn cho từng công đoạn; thay đổi chỉ áp dụng cho công đoạn mở mới, không đổi lịch sử cũ.
- Điều chuyển hồ sơ không xóa thời gian đã dùng và không tự tạm dừng SLA.

**Phân quyền và kiểm soát**
- CBTD chỉ xem và xử lý hồ sơ được phân công; sau khi hồ sơ rời Tiếp nhận, CBTD chỉ xem. Thẩm quyền xem từ công đoạn Thẩm định trở đi; Quản lý xem toàn bộ hồ sơ nhưng chỉ theo dõi, phân công và điều phối; Quản trị viên không có chức năng nghiệp vụ.
- Người đã phụ trách, tiếp nhận hoặc lập tờ trình của hồ sơ không được dùng vai trò Thẩm quyền để làm rõ, từ chối hoặc phê duyệt chính hồ sơ đó.
- Chỉ Quản lý được phân công và điều chuyển hồ sơ; Quản lý không được giao hồ sơ cho chính mình, không tự duyệt đề nghị do mình lập và không đóng hồ sơ mình phụ trách hoặc đã tiếp nhận.
- Khi CBTD báo xung đột lợi ích, hồ sơ bị khóa thao tác ghi cho đến khi Quản lý điều chuyển hoặc có kết luận.
- Dữ liệu doanh nghiệp dùng chung chỉ được cập nhật khi Quản lý duyệt đối soát; CBTD không tự ghi đè.
- Không khóa tài khoản hoặc gỡ vai trò CBTD của người còn hồ sơ chưa hoàn tất; phải điều chuyển hồ sơ trước. Quản trị viên không tự khóa chính mình hoặc tự bỏ quyền Quản trị.

**Lưu vết**
- Mỗi công đoạn của hồ sơ lưu thời điểm vào và ra, người xử lý, ghi chú và kết quả SLA; hồ sơ bị từ chối hoặc đóng còn lưu lý do và người thực hiện.

**Dự báo nguy cơ chậm xử lý hồ sơ**
- Dự báo chỉ dùng để sắp xếp thứ tự xử lý theo nguy cơ trễ SLA, không phải quyết định tín dụng.
- Hệ thống tự tính dự báo khi hồ sơ vào Thẩm định; CBTD chỉ xem kết quả, Thẩm quyền và Quản lý được tính lại. Khi công đoạn tính SLA theo giờ làm việc thì dự báo hiển thị "không áp dụng" vì mô hình chưa huấn luyện lại.

---

# Cần kiểm tra lại trước khi dùng chính thức

1. **Mật khẩu tối thiểu 8 ký tự:** code chỉ thấy ràng buộc 8 ký tự ở đổi mật khẩu (`change-password.dto.ts`); màn đăng nhập (`login.dto.ts`) chỉ kiểm tối thiểu 6 ký tự. Bản này viết "mật khẩu mới". Cần xác nhận quy tắc đặt mật khẩu lúc tạo tài khoản.
2. **Khóa đăng nhập:** `login-throttle.ts` có cửa sổ 15 phút nhưng chưa xác nhận số lần sai là 5. Bản này bỏ con số 5. Cần đọc file để điền đúng số lần và thời gian khóa.
3. **Dự báo "không áp dụng" khi SLA theo giờ làm việc:** chưa tìm thấy chỗ hiển thị trong code. Giữ nguyên theo bản cũ, cần xác nhận trong `prediction` và giao diện.
4. **Thời gian phản hồi mỗi thao tác:** chưa có số liệu đo. Cần đo hoặc bỏ dòng này.
5. **"Thẩm quyền yêu cầu doanh nghiệp bổ sung chứng từ":** theo route `supplements` thì Thẩm quyền được phép; cần xác nhận trên giao diện có nút này ở công đoạn Thẩm định.
6. **"Gửi email nhắc doanh nghiệp ở ngày 5 (nếu qua cổng tiếp nhận)":** lấy từ bản cũ, chưa xác nhận trong code. Quét nhắc hằng ngày lúc 08:00 lấy từ commit gần nhất (`feat(supplements)`).
7. **"Không đóng được khi doanh nghiệp đã gửi đủ chứng từ":** lấy từ Master (Nhóm 4, tình huống 4); chưa đối chiếu code.
8. **"Quản lý không tự duyệt đề nghị do mình lập":** lấy từ Master (mục 2, actor QLCN), chưa đối chiếu code.
9. **Tạo hồ sơ trực tiếp tại quầy và tra cứu doanh nghiệp theo mã số thuế:** giữ từ bản cũ; code có route `companies/check/:taxCode` và `loan-applications` POST dành cho CBTD, nhưng chưa xác nhận trên giao diện.
10. **Chuyển vai trò làm việc và thông báo nội bộ** đã được thêm vào mục "Dùng chung" nhưng chưa xác nhận có cần đưa vào báo cáo hay không.
11. **Ranh giới phạm vi:** bản này bỏ actor Doanh nghiệp theo yêu cầu. Cần thống nhất với phần BPMN và use case để cùng cách nhìn.
