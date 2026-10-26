# Mô tả nghiệp vụ các task đã hoàn thành — Nhóm A và Nhóm B

Ngày lập: 26/10/2026. Tài liệu giải thích bằng ngôn ngữ nghiệp vụ những gì hệ thống làm được sau mỗi task, để Product Owner (PO) nắm và duyệt. Không đi vào chi tiết kỹ thuật. Chi tiết kỹ thuật và bảng trạng thái từng task nằm ở [handover](handover/HANDOVER_v2.1.md); nhật ký tiến trình làm việc là tài liệu nội bộ, không nằm trong repository.

## Bốn vai trò dùng chung trong tài liệu

| Vai trò | Làm gì trong quy trình vay |
|---|---|
| **CBTD** (cán bộ tín dụng) | Tiếp nhận và kiểm tra hồ sơ, yêu cầu doanh nghiệp bổ sung chứng từ, chuyển hồ sơ sang thẩm định |
| **Thẩm quyền** | Thẩm định, trình cấp trên, phê duyệt hoặc từ chối hồ sơ |
| **Quản lý chi nhánh** | Phân công và điều chuyển cán bộ, theo dõi toàn chi nhánh, xử lý hồ sơ quá hạn |
| **Admin** | Quản trị tài khoản và cấu hình hệ thống, không làm nghiệp vụ vay |

Hồ sơ đi qua 4 công đoạn theo một chiều: **Tiếp nhận → Thẩm định → Cấp trên (khi vượt hạn mức) → Hoàn tất**.

---

# NHÓM A — Việc nền tảng, độc lập

## TK-01. Cập nhật công cụ phân tích mã nguồn (CodeGraph)

- **Là gì:** công cụ nội bộ giúp người lập trình và trợ lý AI hiểu cấu trúc hệ thống trước khi sửa. **Người dùng nghiệp vụ không thấy gì thay đổi.**
- **Kết quả:** công cụ đã được dựng lại và kiểm tra đạt. Mọi thay đổi sau này đều dựa trên công cụ này để biết một chức năng ảnh hưởng đến chức năng nào.

## TK-02. Mở được màn hình "Cấu hình SLA"

- **Nhu cầu:** SLA là số giờ chuẩn để xử lý hồ sơ ở mỗi công đoạn. Màn hình chỉnh số giờ này đã có nhưng không có đường vào từ menu nên Admin không dùng được.
- **Hệ thống làm gì:** Admin thấy mục **"Cấu hình SLA"** trong menu, mở ra danh sách 4 công đoạn kèm số giờ chuẩn, sửa số giờ và lưu. Số giờ mới được giữ lại sau khi tải lại trang.
- **Ai dùng:** chỉ Admin. Các vai trò khác không được vào.
- **Lưu ý:** menu hiện chưa ẩn các mục không thuộc vai trò của người dùng; nếu vào nhầm, hệ thống từ chối và báo "Quyền truy cập bị từ chối".

## TK-09. Hộp thư thử nghiệm cho email xác minh (Mailpit)

- **Nhu cầu:** doanh nghiệp đăng ký tài khoản trên cổng doanh nghiệp (Portal) phải nhận mã xác minh 6 số qua email. Khi chạy thử, không nên gửi email thật ra ngoài.
- **Hệ thống làm gì:** trong môi trường thử nghiệm, email xác minh được đưa vào một **hộp thư giả lập** (xem tại địa chỉ `localhost:8025`) thay vì gửi ra internet. Người thử nghiệm lấy mã từ đây để hoàn tất đăng ký.
- **Quy tắc:** mã xác minh có hiệu lực 10 phút; muốn gửi lại phải chờ 60 giây.
- **Lưu ý:** khi vận hành thật cần cấu hình máy chủ email thật qua biến môi trường; không đưa thông tin tài khoản email vào mã nguồn.

## TK-10. Cán bộ tự đổi mật khẩu

- **Nhu cầu:** cán bộ nội bộ chưa có cách tự đổi mật khẩu trên giao diện.
- **Hệ thống làm gì:** trong menu tài khoản có mục **"Đổi mật khẩu"**. Cán bộ nhập mật khẩu hiện tại, mật khẩu mới và nhập lại mật khẩu mới.
- **Quy tắc:** mật khẩu mới tối thiểu **8 ký tự** (tài liệu ban đầu ghi 6, nhưng hệ thống đã yêu cầu 8 từ trước nên giữ 8). Sai mật khẩu hiện tại thì báo lỗi. Đổi thành công thì lần đăng nhập sau phải dùng mật khẩu mới.
- **Lưu ý:** tài khoản thử nghiệm dùng mật khẩu 6 ký tự sẽ không đặt lại về giá trị đó qua màn hình này được.

## Việc phát sinh ngoài danh sách

- **Lỗi hai tab tự đăng xuất lẫn nhau:** khi một người mở hai tab trình duyệt, đăng nhập ở tab này làm tab kia tự đăng xuất. Đã sửa: chỉ đăng xuất khi thật sự có người đăng xuất.
- **Dịch vụ dự báo chạy trong Docker hay bị lỗi tải thư viện do mạng chậm:** đã tăng thời gian chờ và số lần thử lại.

---

# NHÓM B — Nghiệp vụ cốt lõi và hồ sơ quá hạn

## TK-03 và TK-04. Ai được xem gì (phân quyền trong một chi nhánh)

- **Nhu cầu:** làm rõ và kiểm chứng việc mỗi vai trò chỉ thấy phần dữ liệu thuộc trách nhiệm của mình.
- **Quy tắc đã chốt với PO:**

| Vai trò | Hồ sơ vay | Doanh nghiệp |
|---|---|---|
| **CBTD** | Chỉ hồ sơ được phân công cho mình; mở hồ sơ của người khác bị từ chối | Chỉ doanh nghiệp có hồ sơ của mình |
| **Thẩm quyền** | Từ công đoạn **Thẩm định trở đi**; **không** thấy hồ sơ còn ở Tiếp nhận | Xem toàn chi nhánh |
| **Quản lý** | Xem tất cả hồ sơ ở mọi công đoạn; phân công, điều chuyển, theo dõi; chỉ xem chứng từ, không thao tác | Xem toàn chi nhánh |
| **Admin** | Không có menu nghiệp vụ | Không |

- **Doanh nghiệp — nguyên tắc "ai làm người nấy":**
  - CBTD không xem được thông tin doanh nghiệp của cán bộ khác.
  - Khi tạo hồ sơ mà tra mã số thuế ra doanh nghiệp của người khác, hệ thống chỉ báo **"đã tồn tại"**, không hiện thông tin, và **không cho tạo hồ sơ** cho doanh nghiệp đó.
  - Hệ quả cần biết: khách đã có hồ sơ ở cán bộ A thì cán bộ B không tự mở hồ sơ mới cho khách đó; phải phối hợp qua Quản lý. Nếu PO muốn cho phép B tạo hồ sơ mới (nhưng không được sửa thông tin doanh nghiệp), cần quyết định lại.
- **Dự báo nguy cơ trễ SLA (AI):** CBTD chỉ **xem kết quả**. Hệ thống tự tính khi hồ sơ vào Thẩm định hoặc Cấp trên. Nút tính lại bằng tay chỉ dành cho Thẩm quyền và Quản lý. Dự báo chỉ để sắp xếp ưu tiên, **không** phải quyết định tín dụng.
- **TK-04:** đã viết bộ kiểm thử tự động để bảo đảm các quy tắc trên không bị phá khi sửa hệ thống sau này (ví dụ CBTD A không mở được hồ sơ của CBTD B dù biết đường dẫn).
- **Tài liệu chi tiết:** [Ma_tran_AC_phan_quyen_1_chi_nhanh.md](Ma_tran_AC_phan_quyen_1_chi_nhanh.md).

## TK-06. Doanh nghiệp theo dõi tiến độ hồ sơ trên Portal

- **Nhu cầu:** sau khi gửi đề nghị vay, doanh nghiệp cần biết hồ sơ đang ở đâu mà không phải gọi hỏi ngân hàng.
- **Hệ thống làm gì:** doanh nghiệp đăng nhập Portal, mở một đề nghị đã gửi và thấy **thanh tiến độ 4 mốc: Tiếp nhận → Thẩm định → Phê duyệt → Hoàn tất**, một trạng thái hiện tại kèm câu giải thích bằng ngôn ngữ dễ hiểu.
- **Các trạng thái doanh nghiệp được thấy:**

| Trạng thái hiển thị | Khi nào |
|---|---|
| Bản nháp | Chưa gửi |
| Đã gửi, chờ phân công | Đã gửi, ngân hàng chưa phân công |
| Chờ ngân hàng tiếp nhận | Đã phân công, chưa tiếp nhận chính thức |
| Đang kiểm tra hồ sơ | Hồ sơ ở công đoạn Tiếp nhận |
| Cần bổ sung chứng từ | Ngân hàng yêu cầu bổ sung; có hướng dẫn mở mục bổ sung |
| Đang thẩm định | Công đoạn Thẩm định |
| Đang chờ cấp có thẩm quyền xét duyệt | Công đoạn Cấp trên |
| Đã được phê duyệt | Phê duyệt |
| Không được chấp thuận | Bị từ chối, kèm **lý do chung** |
| Đã đóng do quá hạn bổ sung | Quản lý đã đóng hồ sơ (xem TK-08) |

- **Quy tắc bảo mật:** doanh nghiệp **chỉ xem đề nghị của chính tài khoản mình**. Hệ thống **không bao giờ** hiện cho doanh nghiệp: ghi chú nội bộ của thẩm định viên, lý do chi tiết Quản lý nhập khi đóng hồ sơ, tên cán bộ phụ trách, điểm hay dự báo AI, số tiền duyệt.
- **Lý do từ chối:** chỉ hiện tên lý do chung theo danh mục có sẵn (hồ sơ pháp lý không hợp lệ; năng lực tài chính không đảm bảo; phương án kinh doanh không khả thi; tài sản bảo đảm không đủ điều kiện; quá hạn thời gian bổ sung chứng từ). Không có lý do chung thì hiện "Hồ sơ không được chấp thuận".
- **Lưu ý:** danh mục trạng thái ở trên do đội phát triển đề xuất và PO chấp nhận tạm thời; có thể đổi tên hoặc gộp mốc nếu PO muốn. Danh sách đề nghị chưa hiện tiến độ trên từng dòng, chỉ xem được khi mở chi tiết.

## TK-07. Nhắc doanh nghiệp bổ sung chứng từ và đánh dấu quá hạn

- **Nhu cầu:** khi ngân hàng yêu cầu bổ sung chứng từ, hồ sơ dừng chờ doanh nghiệp. Cần cơ chế để hồ sơ không bị bỏ quên.
- **Quy tắc nghiệp vụ (theo quyết định DEC-02):**
  - **Ngày 0:** cán bộ gửi yêu cầu bổ sung, hồ sơ chuyển sang "chờ bổ sung" và **đồng hồ SLA tạm dừng**.
  - **Ngày 5:** nếu doanh nghiệp chưa bổ sung, hệ thống **nhắc**: thông báo cho cán bộ phụ trách trong hệ thống, và gửi **email nhắc** cho doanh nghiệp (khi hồ sơ đi qua Portal).
  - **Ngày 10:** hệ thống **đánh dấu quá hạn**: thông báo cán bộ phụ trách, hiện **khối cảnh báo đỏ trên Dashboard của Quản lý**, và gắn cờ vàng/đỏ trong danh sách hồ sơ, bảng Kanban và chi tiết hồ sơ.
  - **Hệ thống tuyệt đối không tự đóng hồ sơ.** Hồ sơ vẫn ở trạng thái chờ bổ sung cho đến khi Quản lý quyết định (xem TK-08).
- **Cách đếm ngày (PO đã chốt):** tính theo **ngày lịch**. Nếu mốc rơi vào **Thứ Bảy hoặc Chủ nhật** thì lùi sang **Thứ Hai**, giữ nguyên giờ trong ngày. Nếu cán bộ có nhập sẵn một hạn bổ sung riêng khi tạo yêu cầu thì hạn đó được dùng làm mốc quá hạn.
- **Gia hạn:** chưa có trong lần này (PO chọn để sau). Hệ thống đã được thiết kế để thêm gia hạn về sau mà không phải làm lại.
- **Cách hoạt động:** hệ thống tự kiểm tra mỗi giờ một lần, nên cờ có thể xuất hiện chậm tối đa khoảng một giờ so với mốc chính xác.
- **Giới hạn cần biết:** chưa tính **ngày lễ** (mốc rơi vào ngày lễ chỉ lùi qua cuối tuần). Hồ sơ cán bộ tạo trực tiếp (không qua Portal) không có email để nhắc doanh nghiệp, cán bộ phải tự liên hệ khách.
- **Điểm còn mở:** nếu cán bộ nhập hạn bổ sung ở quá khứ thì hồ sơ quá hạn ngay. Hệ thống hiện không chặn; PO đã đồng ý để sau và đã ghi lại.

## TK-08. Quản lý đóng hồ sơ quá hạn bổ sung

- **Nhu cầu:** hồ sơ quá hạn bổ sung cần một người có thẩm quyền quyết định đóng, không để tự động.
- **Hệ thống làm gì:** Quản lý mở hồ sơ đã quá hạn, thấy nút **"Đóng hồ sơ do quá hạn"**, nhập **lý do (bắt buộc)** và xác nhận.
- **Quy tắc:**
  - **Chỉ Quản lý** làm được. CBTD và Thẩm quyền thao tác sẽ bị từ chối.
  - Chỉ đóng được hồ sơ đang chờ bổ sung và **đã đến hạn**.
  - Không nhập lý do thì không đóng được.
  - Sau khi đóng, hồ sơ có trạng thái **"Đã đóng (quá hạn bổ sung)"**, kết thúc quy trình và **bị khóa mọi thao tác tiếp theo**. Việc này **không thể hoàn tác**.
  - Hệ thống ghi lại **ai đóng, lúc nào, vì lý do gì** vào lịch sử công đoạn của hồ sơ.
  - Thời gian hồ sơ chờ doanh nghiệp **không bị tính là trễ SLA** của ngân hàng.
  - Doanh nghiệp thấy thông báo chung "Hồ sơ đã được đóng do quá hạn bổ sung chứng từ, vui lòng liên hệ ngân hàng", **không thấy lý do Quản lý nhập**.
- **Lưu ý:** hồ sơ đã đóng ở giao diện nhân viên vẫn hiện thanh tiến trình tích xanh đủ 4 bước (cách hiển thị có sẵn từ trước, chưa chỉnh).

## TK-12. Báo cáo đánh giá mô hình dự báo (Machine Learning)

- **Nhu cầu:** có một báo cáo nói rõ mô hình dự báo nguy cơ **trễ SLA** hoạt động ra sao, phục vụ thuyết minh đồ án và hội đồng. **Báo cáo không nằm trong quy trình xử lý hồ sơ.**
- **Nội dung:** [Bao_cao_Mo_hinh_Machine_Learning.md](Bao_cao_Mo_hinh_Machine_Learning.md): dữ liệu dùng, các mô hình so sánh, chỉ số đánh giá, yếu tố ảnh hưởng nhiều nhất, và giới hạn.
- **Điều PO cần nắm trước khi trình bày:**
  - Dữ liệu dùng để huấn luyện là **dữ liệu giả lập**, không phải hồ sơ thật.
  - Các chỉ số rất cao (độ chính xác gần 99%) **không** chứng minh mô hình dự báo đúng trên hồ sơ thật, vì nhãn "trễ" được sinh ra từ chính công thức của dữ liệu.
  - Mô hình Random Forest **không vượt trội** hơn mô hình đơn giản hơn (Logistic Regression) trên dữ liệu này.
  - Mô hình gần như chỉ dựa vào **số lần bổ sung chứng từ**; nếu bỏ yếu tố này thì chất lượng giảm mạnh.
  - Dự báo này là nguy cơ **trễ SLA**, không phải khả năng trả nợ hay quyết định cấp tín dụng.
- **Tình trạng:** đã viết xong, PO sẽ đọc sau.

---

## Việc chờ PO quyết định

| Việc | Ghi chú |
|---|---|
| Danh mục trạng thái hiển thị cho doanh nghiệp (TK-06) | Đang dùng tạm |
| Cho phép CBTD tạo hồ sơ mới cho doanh nghiệp của cán bộ khác? (TK-03) | Hiện chặn hẳn theo nguyên tắc "ai làm người nấy" |
| Chặn hạn bổ sung ở quá khứ (TK-07) | PO để sau |
| Gia hạn thời gian bổ sung chứng từ | PO để sau |
| Lịch ngày lễ cho mốc ngày 5 và 10 | Chưa có |
| Đọc báo cáo ML (TK-12) | PO đọc sau |

Nhóm C (TK-05 nghiệm thu chính sách mở nộp Portal V2, TK-11 SLA tính giờ làm việc hay 24/7) đang chờ PO quyết định nghiệp vụ và chưa được mô tả ở đây.
