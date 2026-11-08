# CHƯƠNG 2. CƠ SỞ LÝ THUYẾT

Chương này trình bày các cơ sở nghiệp vụ, các nghiên cứu liên quan và nền tảng lý thuyết của mô hình dự báo được sử dụng trong đề tài. Các mục trích dẫn nguồn được đánh dấu [cần kiểm tra] để tác giả đối chiếu văn bản gốc trước khi nộp.

## 2.1 Cơ sở nghiệp vụ liên quan

### 2.1.1 Doanh nghiệp nhỏ và vừa

Doanh nghiệp nhỏ và vừa (SME, *Small and Medium Enterprises*) là nhóm doanh nghiệp có quy mô hạn chế về lao động, doanh thu và nguồn vốn. Nhóm này đóng vai trò quan trọng trong nền kinh tế và là đối tượng khách hàng lớn của các ngân hàng thương mại.

Theo Điều 5 Nghị định 80/2021/NĐ-CP, doanh nghiệp nhỏ và vừa gồm ba loại: siêu nhỏ, nhỏ và vừa. Việc phân loại dựa trên lĩnh vực hoạt động (nông, lâm nghiệp, thủy sản, công nghiệp, xây dựng hoặc thương mại, dịch vụ), số lao động tham gia bảo hiểm xã hội bình quân năm, và tổng doanh thu năm hoặc tổng nguồn vốn. [cần kiểm tra các ngưỡng cụ thể với văn bản gốc; có thể đưa Bảng 1.1 đã soạn vào đây]

Trong đề tài, khái niệm SME dùng để xác định đối tượng khách hàng của quy trình xử lý hồ sơ vay. Hệ thống không thực hiện việc phân loại quy mô doanh nghiệp.

### 2.1.2 Quy trình xét duyệt tín dụng

Quy trình xét duyệt tín dụng đối với khách hàng doanh nghiệp tại ngân hàng thương mại thường gồm các bước chính: tiếp nhận hồ sơ, kiểm tra tính đầy đủ và hợp lệ của chứng từ, thẩm định, và phê duyệt hoặc từ chối. Với khoản vay vượt thẩm quyền của đơn vị, hồ sơ được trình lên cấp có thẩm quyền cao hơn. [cần kiểm tra theo Thông tư 39/2016/TT-NHNN về hoạt động cho vay và quy định nội bộ của ngân hàng]

Trong quy trình này, khi hồ sơ thiếu hoặc sai chứng từ, ngân hàng yêu cầu doanh nghiệp bổ sung. Thời gian chờ bổ sung phụ thuộc vào doanh nghiệp và là nguyên nhân phổ biến làm kéo dài thời gian xử lý.

Hệ thống của đề tài mô hình hóa quy trình thành các công đoạn: Tiếp nhận, Thẩm định, Cấp trên và Hoàn tất. Mỗi công đoạn có người phụ trách theo vai trò: cán bộ tín dụng (CBTD), người có thẩm quyền phê duyệt, quản lý và quản trị viên.

### 2.1.3 Thời hạn xử lý (SLA) và kiểm soát duyệt chéo

**Thời hạn xử lý (SLA, *Service Level Agreement*)** là cam kết về thời gian tối đa để hoàn thành một công đoạn của quy trình. Trong đề tài, mỗi công đoạn có một định mức thời gian chuẩn. Hồ sơ vượt định mức được xem là xử lý trễ. SLA giúp ngân hàng đo hiệu suất, phát hiện điểm nghẽn và cam kết thời gian với khách hàng.

Có hai cách tính thời gian:
- Cách truyền thống tính liên tục 24 giờ mỗi ngày.
- Cách tính theo giờ làm việc (phương án PA1) chỉ tính trong giờ hành chính, loại trừ ngày nghỉ, và tạm dừng đồng hồ khi hồ sơ đang chờ doanh nghiệp bổ sung. Cách này phản ánh sát năng lực xử lý thực của ngân hàng vì thời gian chờ doanh nghiệp không thuộc trách nhiệm của cán bộ.

**Kiểm soát duyệt chéo (maker-checker)** là nguyên tắc người thực hiện một nghiệp vụ không được tự kiểm tra hoặc phê duyệt chính nghiệp vụ đó. Nguyên tắc này giúp phân tách trách nhiệm, giảm sai sót và gian lận. Trong hệ thống, cán bộ đang phụ trách hồ sơ không được tự thẩm định hoặc phê duyệt hồ sơ của mình, và việc đóng hồ sơ quá hạn bổ sung do quản lý thực hiện.

## 2.2 Các hệ thống và nghiên cứu liên quan

### 2.2.1 Hệ thống quản lý khoản vay hiện có

Các ngân hàng thường sử dụng hệ thống khởi tạo và quản lý khoản vay (LOS, *Loan Origination System*) và hệ thống ngân hàng lõi (core banking). Các hệ thống này lưu hồ sơ, theo dõi trạng thái và hỗ trợ các bước phê duyệt theo quy trình. [cần bổ sung ví dụ hệ thống cụ thể có nguồn tham khảo]

Điểm chung là các hệ thống này tập trung vào lưu trữ và luân chuyển hồ sơ. Việc theo dõi thời hạn xử lý chủ yếu mang tính báo cáo sau khi sự việc đã xảy ra. [nhận định cần dẫn chứng hoặc diễn đạt thận trọng hơn]

### 2.2.2 Nghiên cứu dự báo chậm trễ trên quy trình

Hướng nghiên cứu *giám sát quy trình nghiệp vụ có dự báo* (predictive process monitoring) sử dụng nhật ký sự kiện của quy trình để dự báo kết quả hoặc thời gian còn lại của các trường hợp đang chạy. Các nghiên cứu thường dùng các mô hình học máy như rừng ngẫu nhiên, hồi quy hoặc mạng nơ-ron hồi quy (LSTM). [cần kiểm tra và trích dẫn, ví dụ: Tax và cộng sự (2017); Teinemaa và cộng sự (2019)]

Bộ nhật ký sự kiện về đơn xin vay của một tổ chức tài chính được công bố trong cuộc thi BPI Challenge 2017 là dữ liệu thường được dùng trong hướng nghiên cứu này. [cần kiểm tra nguồn trước khi nêu; đề tài chưa sử dụng bộ dữ liệu này]

### 2.2.3 Khoảng trống cần giải quyết

- Các hệ thống hiện có ít hỗ trợ cảnh báo sớm nguy cơ trễ hạn xử lý ở từng hồ sơ đang chạy.
- Các nghiên cứu về dự báo thường dùng dữ liệu công khai, ít gắn với một quy trình cho vay doanh nghiệp nhỏ và vừa có SLA, bổ sung chứng từ và phân quyền theo vai trò.
- Dữ liệu thực tế của ngân hàng mang tính nhạy cảm nên khó tiếp cận để huấn luyện mô hình.

## 2.3 Đề xuất và điểm khác biệt của đề tài

Đề tài xây dựng hệ thống xử lý hồ sơ vay doanh nghiệp nhỏ và vừa của ngân hàng, kèm chức năng cảnh báo sớm nguy cơ trễ SLA. Các điểm khác biệt:
- **Mục tiêu dự báo là nguy cơ trễ SLA, không phải rủi ro tín dụng.** Kết quả dự báo chỉ hỗ trợ quản lý phân bổ và ưu tiên hồ sơ, không tham gia quyết định cho vay.
- **Gắn với quy trình cụ thể:** công đoạn, bổ sung chứng từ, điều chuyển hồ sơ, phân quyền theo vai trò và kiểm soát duyệt chéo.
- **Hai cách tính SLA:** truyền thống và theo giờ làm việc có tạm dừng khi chờ doanh nghiệp.
- **Dữ liệu huấn luyện hiện là dữ liệu mô phỏng** do chưa tiếp cận được dữ liệu thực. Vì vậy kết quả mô hình mang tính minh họa phương pháp, cần huấn luyện lại khi có dữ liệu thật.

## 2.4 Cơ sở lý thuyết mô hình dự báo (*)

### 2.4.1 Bài toán phân loại nhị phân và các mô hình sử dụng

Bài toán dự báo trễ SLA được đặt dưới dạng phân loại nhị phân: với mỗi hồ sơ, mô hình ước lượng xác suất hồ sơ bị trễ (nhãn 1) hay không trễ (nhãn 0) dựa trên các đặc trưng như giá trị khoản vay, số lần bổ sung, công đoạn hiện tại và thời gian đã xử lý. Từ xác suất, hệ thống gán mức nguy cơ (thấp, trung bình, cao).

Hai mô hình được so sánh:
- **Hồi quy logistic (Logistic Regression):** mô hình tuyến tính ước lượng xác suất bằng hàm sigmoid, dễ diễn giải, thường dùng làm mô hình cơ sở.
- **Rừng ngẫu nhiên (Random Forest):** tập hợp nhiều cây quyết định huấn luyện trên các mẫu con của dữ liệu và đặc trưng, kết quả lấy theo biểu quyết. Mô hình xử lý tốt quan hệ phi tuyến và cho biết mức độ quan trọng của từng đặc trưng.

### 2.4.2 Dữ liệu mất cân bằng

Hồ sơ trễ thường ít hơn nhiều so với hồ sơ đúng hạn, nên dữ liệu bị mất cân bằng giữa hai lớp. Khi đó mô hình dễ thiên về lớp đa số, đạt độ chính xác tổng thể cao nhưng bỏ sót hồ sơ trễ. Các cách xử lý thường dùng gồm đặt trọng số lớp (class weight), lấy mẫu lại (tăng mẫu lớp thiểu số hoặc giảm mẫu lớp đa số) và chọn chỉ số đánh giá phù hợp thay vì chỉ dùng độ chính xác.

### 2.4.3 Các chỉ số đánh giá mô hình

- **Precision (độ chính xác dương):** trong số hồ sơ được cảnh báo trễ, tỷ lệ thật sự trễ.
- **Recall (độ phủ):** trong số hồ sơ thật sự trễ, tỷ lệ được phát hiện.
- **F1-score:** trung bình điều hòa của precision và recall.
- **ROC-AUC:** khả năng phân biệt giữa hai lớp trên mọi ngưỡng phân loại.
- **PR-AUC:** diện tích dưới đường precision-recall, phù hợp khi dữ liệu mất cân bằng.

Với bài toán cảnh báo sớm, recall của lớp trễ thường được ưu tiên để hạn chế bỏ sót, nhưng cần cân nhắc với precision để tránh cảnh báo nhầm quá nhiều.

### 2.4.4 Nhật ký sự kiện (event log)

Nhật ký sự kiện là bản ghi các hoạt động xảy ra trong quy trình, mỗi dòng thường gồm mã trường hợp (hồ sơ), tên hoạt động (công đoạn) và mốc thời gian. Từ nhật ký này có thể suy ra thời gian xử lý từng công đoạn, số lần quay lại và các khoảng chờ. Trong hệ thống, lịch sử chuyển công đoạn của từng hồ sơ đóng vai trò nhật ký sự kiện và là nguồn để tạo đặc trưng cho mô hình.

## 2.5 Công nghệ sử dụng

- **Backend:** NestJS (khung ứng dụng Node.js bằng TypeScript), Prisma (ORM), cơ sở dữ liệu PostgreSQL.
- **Frontend:** React, Vite và TypeScript.
- **Dịch vụ học máy:** FastAPI (Python) và scikit-learn để huấn luyện và cung cấp dự báo.
- **Triển khai và thử nghiệm:** Docker Compose; Mailpit để kiểm tra email gửi ra trong môi trường thử.
- **Bảo mật:** xác thực bằng JWT, phân quyền theo vai trò, giới hạn đăng nhập sai.
