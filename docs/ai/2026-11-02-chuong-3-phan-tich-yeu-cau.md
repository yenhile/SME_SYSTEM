# CHƯƠNG 3. PHÂN TÍCH YÊU CẦU

Chương này trình bày quá trình thu thập yêu cầu, phân tích yêu cầu (tác nhân, yêu cầu chức năng, yêu cầu phi chức năng) và các quy tắc nghiệp vụ của hệ thống. Các chỗ đánh dấu [bạn điền] là thông tin thực tế mà chỉ tác giả biết; không được để trống hoặc tự bịa khi nộp.

## 3.1 Thu thập yêu cầu

### 3.1.1 Kế hoạch phỏng vấn

**Mục tiêu.** Hiểu quy trình xử lý hồ sơ vay SME tại một chi nhánh ngân hàng, các công đoạn, vai trò, nơi hồ sơ hay bị chậm, và các quy định về thời gian xử lý.

**Đối tượng và hình thức.**

| Đối tượng | Vai trò trong việc cung cấp yêu cầu | Hình thức | Thời gian |
|---|---|---|---|
| Người duyệt nghiệp vụ (PO) | Chốt quy trình vay, phân quyền, ngưỡng tiền, SLA, ý nghĩa của mô hình dự báo | Trao đổi trực tiếp và trao đổi qua văn bản, mỗi quyết định ghi vào tài liệu nghiệp vụ | Xuyên suốt từ tháng 9 đến nay |
| Cán bộ tín dụng / chuyên viên ngân hàng | Quy trình thực tế, chứng từ thường thiếu, lý do hồ sơ trễ | [bạn điền: có phỏng vấn người làm ngân hàng thật không, ai, ngày nào] | [bạn điền] |
| Giảng viên hướng dẫn | Định hướng phạm vi, yêu cầu về dữ liệu cho mô hình | Buổi báo cáo định kỳ hằng tuần | Theo nhật ký làm việc |

**Câu hỏi chính.**
1. Một hồ sơ vay SME đi qua những công đoạn nào, ai làm ở từng công đoạn?
2. Hồ sơ cần những chứng từ nào, thiếu thì xử lý ra sao, doanh nghiệp được chờ bao lâu?
3. Khoản vay nào cần trình cấp cao hơn, ngưỡng là bao nhiêu?
4. Thời gian xử lý mỗi công đoạn được đo thế nào (giờ làm việc hay giờ liên tục)?
5. Ai được xem hồ sơ của ai, ai không được tự duyệt hồ sơ mình phụ trách?
6. Thông tin nào ngân hàng muốn có để cảnh báo sớm hồ sơ có nguy cơ trễ?

### 3.1.2 Tổng hợp kết quả phỏng vấn

Dưới đây là các kết luận đã được PO chốt và ghi lại trong tài liệu dự án (nguồn trong ngoặc).

| # | Nội dung | Kết quả | Nguồn |
|---|---|---|---|
| 1 | Phạm vi | Hệ thống phục vụ **một chi nhánh** ngân hàng; doanh nghiệp là tác nhân ngoài | Ma trận phân quyền |
| 2 | Quy trình | 4 công đoạn đi một chiều: Tiếp nhận, Thẩm định, Cấp trên, Hoàn tất; vòng lặp duy nhất là bổ sung chứng từ ở Tiếp nhận | Phân quyền và luồng nghiệp vụ |
| 3 | Khoản vay | Đến 10 tỷ: Thẩm quyền phê duyệt; vượt 10 tỷ: trình cấp trên. Chi nhánh chỉ cho vay dưới 10 tỷ, khoản lớn hơn liên hệ cơ sở chính (chưa chốt cách xử lý hồ sơ đang ở Cấp trên) | Nhật ký 26/10 |
| 4 | Bổ sung chứng từ | Nhắc doanh nghiệp ngày thứ 5, quá hạn ngày thứ 10 (ngày lịch), Quản lý đóng thủ công, không tự đóng; chưa gia hạn | DEC-02, nhật ký mục 12–13 |
| 5 | Quyền xem | CBTD chỉ xem hồ sơ và doanh nghiệp của mình; Thẩm quyền chỉ xem hồ sơ từ Thẩm định trở đi; Quản lý theo dõi, phân công, không thao tác nghiệp vụ; CBTD vẫn xem (chỉ xem) hồ sơ của mình sau khi chuyển Thẩm định | Quyết định PO 25–30/10 |
| 6 | Dự báo | Dự báo nguy cơ **trễ SLA**, không phải quyết định tín dụng; CBTD chỉ xem kết quả | Quyết định PO 25/10 |
| 7 | SLA | Đề xuất tính theo giờ làm việc (T2–T6, 8:00–12:00 và 13:00–17:00), trừ ngày lễ và thời gian chờ doanh nghiệp; **chưa bật**, chờ lịch lễ thật và mốc bắt đầu | Handover C.9 |
| 8 | Người làm khác người duyệt | CBTD phụ trách không tự thẩm định/duyệt hồ sơ mình; Quản lý không tự giao hồ sơ cho mình | Quyết định PO 31/10 |

[bạn điền: nếu có phỏng vấn người làm ngân hàng thật, thêm bảng kết quả ở đây: ngày, người được hỏi, nội dung chính. Nếu chưa có, ghi rõ trong luận văn rằng yêu cầu được thu thập từ PO và tài liệu, đây cũng là một hạn chế cần nêu.]

### 3.1.3 Hiện trạng và vấn đề cần giải quyết

**Hiện trạng.** Việc xử lý hồ sơ vay SME thường diễn ra thủ công hoặc rời rạc: hồ sơ giấy hoặc tệp gửi qua email, trạng thái nằm trong trao đổi cá nhân, khó biết hồ sơ đang ở bước nào và ai đang giữ. [bạn điền: đối chiếu với thực tế bạn quan sát được]

**Vấn đề cần giải quyết.**

| # | Vấn đề | Hướng giải quyết của hệ thống |
|---|---|---|
| V1 | Khó theo dõi hồ sơ qua từng công đoạn | Số hóa luồng 4 công đoạn, lưu lịch sử chuyển bước |
| V2 | Chứng từ thiếu, doanh nghiệp bổ sung chậm, không ai nhắc | Yêu cầu bổ sung có hạn, nhắc ngày 5, đánh dấu quá hạn ngày 10 |
| V3 | Không đo được thời gian xử lý từng công đoạn | SLA theo công đoạn, Dashboard điểm nghẽn |
| V4 | Phát hiện hồ sơ trễ khi đã muộn | Mô hình học máy cảnh báo sớm nguy cơ trễ SLA |
| V5 | Hồ sơ bị xem hoặc sửa bởi người không có trách nhiệm; người làm cũng là người duyệt | Phân quyền theo vai trò và theo phân công; nguyên tắc người làm khác người duyệt |
| V6 | Doanh nghiệp không biết hồ sơ đang ở đâu | Cổng Portal có thanh tiến độ và trạng thái công khai |

**Phạm vi không giải quyết.** Hệ thống không chấm điểm tín dụng, không dự báo nợ xấu hay khả năng trả nợ, không giải ngân, không kết nối hệ thống ngân hàng lõi.

## 3.2 Phân tích yêu cầu

### 3.2.1 Các tác nhân

| Tác nhân | Mô tả | Nhiệm vụ chính |
|---|---|---|
| Doanh nghiệp (Portal) | Tác nhân ngoài, khách hàng vay | Đăng ký (xác minh email bằng mã 6 số), nộp hồ sơ vay, theo dõi tiến độ, bổ sung chứng từ |
| Cán bộ tín dụng (CBTD) | Nhân viên ngân hàng | Tiếp nhận hồ sơ được giao, kiểm chứng từ, yêu cầu bổ sung, xác nhận đủ chứng từ, tạo hồ sơ tại quầy |
| Quản lý | Nhân viên ngân hàng | Xem Dashboard, phân công và điều chuyển CBTD, theo dõi hồ sơ, đóng hồ sơ quá hạn bổ sung |
| Thẩm quyền | Người có thẩm quyền xét duyệt | Thẩm định, xem dự báo, phê duyệt, từ chối kèm lý do, trình cấp trên |
| Admin | Quản trị hệ thống | Quản lý tài khoản, cấu hình SLA |
| Hệ thống ML (dịch vụ ngoài) | Dịch vụ dự báo | Nhận 10 đặc trưng của hồ sơ, trả xác suất và mức nguy cơ trễ SLA |
| Bộ nhắc tự động | Tiến trình định kỳ | Mỗi ngày 08:00 quét hồ sơ chờ bổ sung, gửi nhắc, đánh dấu quá hạn |

### 3.2.2 Yêu cầu chức năng

| Mã | Yêu cầu | Tác nhân |
|---|---|---|
| FR-01 | Đăng ký tài khoản doanh nghiệp, xác minh email bằng mã 6 số | Doanh nghiệp |
| FR-02 | Nộp hồ sơ vay trên Portal kèm chứng từ | Doanh nghiệp |
| FR-03 | Xem tiến độ và trạng thái hồ sơ của chính mình, lý do chung nếu bị từ chối | Doanh nghiệp |
| FR-04 | Nộp bổ sung chứng từ khi được yêu cầu | Doanh nghiệp |
| FR-05 | Giao hồ sơ cho CBTD, điều chuyển CBTD | Quản lý |
| FR-06 | Tiếp nhận hồ sơ, kiểm tra chứng từ, xác nhận đủ chứng từ | CBTD |
| FR-07 | Tạo yêu cầu bổ sung (tạm dừng SLA, gửi email cho doanh nghiệp), duyệt chứng từ bổ sung | CBTD |
| FR-08 | Tạo hồ sơ trực tiếp tại quầy, tra mã số thuế doanh nghiệp | CBTD |
| FR-09 | Thẩm định hồ sơ, xem dự báo nguy cơ trễ, từ chối (có lý do) hoặc phê duyệt hoặc trình cấp trên | Thẩm quyền |
| FR-10 | Nhắc bổ sung ngày 5, đánh dấu quá hạn ngày 10, thông báo cho CBTD | Bộ nhắc tự động |
| FR-11 | Đóng hồ sơ quá hạn bổ sung (bắt buộc lý do) | Quản lý |
| FR-12 | Tính SLA từng công đoạn, ghi lịch sử công đoạn | Hệ thống |
| FR-13 | Dự báo nguy cơ trễ SLA khi hồ sơ vào Thẩm định, hiển thị mức Thấp/Trung bình/Cao | Hệ thống, dịch vụ ML |
| FR-14 | Dashboard: tổng quan, điểm nghẽn, danh sách cảnh báo sớm, hồ sơ quá hạn bổ sung | Quản lý, Thẩm quyền |
| FR-15 | Danh sách và chi tiết hồ sơ, tải chứng từ, xem lịch sử, theo quyền từng vai trò | Các vai trò nội bộ |
| FR-16 | Quản lý tài khoản (tạo, khóa, gán vai trò), cấu hình SLA | Admin |
| FR-17 | Đăng nhập nhân viên, đổi mật khẩu, chọn vai trò đang dùng | Nhân viên |
| FR-18 | Thông báo nội bộ (chuông) khi có việc cần xử lý | CBTD, Quản lý |

Chi tiết tiêu chí nghiệm thu của phần phân quyền nằm ở các AC-01 đến AC-22 trong Ma trận AC phân quyền 1 chi nhánh.

### 3.2.3 Yêu cầu phi chức năng

Chỉ ghi những yêu cầu đã được hiện thực và kiểm chứng; chưa có số đo hiệu năng nên không đặt chỉ tiêu định lượng.

| Mã | Nhóm | Yêu cầu | Hiện trạng |
|---|---|---|---|
| NFR-01 | Bảo mật | Xác thực bằng JWT; khóa ký bắt buộc cấu hình, không có giá trị mặc định | Đã làm |
| NFR-02 | Bảo mật | Khóa đăng nhập 15 phút sau 5 lần sai liên tiếp | Đã làm (bộ đếm trong bộ nhớ, mất khi khởi động lại) |
| NFR-03 | Bảo mật | Phân quyền kiểm tra ở backend ở mọi request, vai trò đọc lại từ CSDL | Đã làm |
| NFR-04 | Riêng tư | Doanh nghiệp chỉ thấy đề nghị của mình; không lộ ghi chú nội bộ, tên cán bộ, điểm ML | Đã làm |
| NFR-05 | Toàn vẹn dữ liệu | Điều chuyển hồ sơ trong một giao dịch có khóa; chứng từ đổi thì hủy xác nhận đủ | Đã làm |
| NFR-06 | Truy vết | Ghi lịch sử công đoạn, người thao tác, lý do | Đã làm |
| NFR-07 | Tính đúng thời gian | Mốc thời gian theo giờ Việt Nam; SLA tính theo giờ làm việc | Đã xây, chưa bật |
| NFR-08 | Dễ triển khai | Chạy bằng Docker Compose (backend, web, ML, CSDL, hộp thư thử) | Đã làm |
| NFR-09 | Kiểm thử | Có kiểm thử tự động cho backend và giao diện | 243 test backend, 42 test giao diện đạt (31/10) |
| NFR-10 | Trung thực của dự báo | Không hiển thị số giả khi mô hình không áp dụng được | Đã làm (trạng thái "không áp dụng") |
| NFR-11 | Sao lưu | Sao lưu định kỳ tự động | **Chưa có**, chỉ sao lưu thủ công |
| NFR-12 | Hiệu năng, số người dùng đồng thời | [chưa đo, không đặt chỉ tiêu] | Chưa kiểm chứng |

## 3.3 Quy tắc nghiệp vụ (Business Rule)

| Mã | Quy tắc |
|---|---|
| BR-01 | Hồ sơ đi một chiều qua các công đoạn Tiếp nhận, Thẩm định, Cấp trên, Hoàn tất; không quay lại, ngoại lệ duy nhất là vòng bổ sung chứng từ ở Tiếp nhận. |
| BR-02 | Khoản vay đến 10 tỷ do Thẩm quyền phê duyệt; khoản vượt 10 tỷ bắt buộc trình cấp trên trước khi phê duyệt (Thẩm quyền cũng có thể trình cấp trên với khoản nhỏ hơn). |
| BR-03 | Chỉ CBTD được giao mới xử lý hồ sơ ở Tiếp nhận; chỉ Thẩm quyền xử lý hồ sơ ở Thẩm định. |
| BR-04 | Hồ sơ đã Hoàn tất bị khóa mọi thao tác. |
| BR-05 | Từ chối hồ sơ bắt buộc có lý do theo danh mục. |
| BR-06 | Khi có yêu cầu bổ sung, đồng hồ SLA tạm dừng cho đến khi doanh nghiệp bổ sung xong. |
| BR-07 | Ngày thứ 5 kể từ lúc yêu cầu bổ sung: nhắc; ngày thứ 10: quá hạn. Tính ngày lịch giờ Việt Nam, mốc rơi cuối tuần lùi sang thứ Hai. Hệ thống chỉ nhắc và đánh dấu, không tự đóng. |
| BR-08 | Chỉ Quản lý đóng hồ sơ quá hạn bổ sung, bắt buộc lý do, kết quả là Hoàn tất kèm mã lý do TC05. |
| BR-09 | Người làm khác người duyệt: CBTD phụ trách không tự thẩm định hay phê duyệt hồ sơ mình; Quản lý không tự giao hồ sơ cho mình và không đóng hồ sơ mình phụ trách. |
| BR-10 | CBTD chỉ xem hồ sơ và doanh nghiệp gán cho mình; không ghi đè thông tin doanh nghiệp của cán bộ khác. |
| BR-11 | Thẩm quyền chỉ xem hồ sơ từ công đoạn Thẩm định trở đi. |
| BR-12 | Admin không tự khóa mình hoặc tự bỏ quyền Admin; không khóa hay bỏ vai trò CBTD của người còn hồ sơ chưa hoàn tất. |
| BR-13 | Sau khi xác nhận đủ chứng từ, nếu chứng từ thay đổi thì xác nhận bị hủy. |
| BR-14 | SLA theo giờ làm việc (T2–T6, 8:00–12:00 và 13:00–17:00), trừ ngày lễ; mỗi công đoạn chốt cách tính lúc được mở. Quy tắc này đã xây nhưng chưa bật. |
| BR-15 | Mô hình dự báo chỉ cảnh báo nguy cơ trễ SLA, không dùng để quyết định tín dụng. Mức nguy cơ: Thấp dưới 40%, Trung bình 40–70%, Cao từ 70% (ngưỡng chưa được PO chốt). |
| BR-16 | Doanh nghiệp chỉ thấy trạng thái công khai và lý do từ chối chung; không thấy ghi chú nội bộ, tên cán bộ, điểm ML. |

**Các điểm còn chờ PO** (nên nêu ở phần hạn chế): tờ trình thẩm định của CBTD chưa có trong sản phẩm; cách xử lý người phụ trách cũ sau điều chuyển; có giữ công đoạn Cấp trên hay không; lịch ngày lễ thật và mốc bật SLA theo giờ làm việc; ngưỡng cảnh báo của mô hình.
