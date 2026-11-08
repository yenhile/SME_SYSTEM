# Soạn sẵn: trả lời thầy về nguồn dữ liệu

**Câu hỏi:** Dữ liệu huấn luyện lấy từ đâu?

**Trả lời (có thể đọc/gửi nguyên văn):**

Thưa thầy, dữ liệu hồ sơ vay SME theo đúng quy trình của hệ thống (Tiếp nhận, Thẩm định, thời gian từng công đoạn) là dữ liệu nội bộ ngân hàng, không có bản công khai. Em đã tìm nguồn mở và xử lý như sau:

1. **Nguồn mở dùng để hiệu chỉnh:** BPI Challenge 2012 (van Dongen, 4TU.ResearchData, DOI 10.4121/uuid:3926db30-f712-4394-aebc-75976070e91f), nhật ký xử lý hồ sơ vay thật của một tổ chức tài chính Hà Lan, khoảng 13.000 hồ sơ. Em không dùng để huấn luyện trực tiếp vì khác quy trình, mà trích các tham số hình dạng, tính theo giờ làm việc: thời gian chờ trong hàng đợi (trung vị, độ lệch), tác động của hàng đợi lên thời gian chờ, tỷ lệ hồ sơ phải theo dõi bổ sung (22,4%), và việc hồ sơ phải bổ sung tốn thêm khoảng 1,3 lần thời gian.
2. **Bộ dữ liệu giả lập:** em mô phỏng quy trình của hệ thống (giờ làm việc T2 đến T6, 8 đến 12 giờ và 13 đến 17 giờ) cho 20.000 hồ sơ, hai công đoạn, có các trường doanh nghiệp thực sự nộp, số vòng bổ sung, tải cán bộ, hàng chờ thẩm định; tham số lấy từ BPIC, phần BPIC không có thì là giả định ghi rõ trong tài liệu để khảo sát cán bộ tín dụng thay thế sau. Có 13 phép kiểm tra chất lượng, chạy lại cho kết quả giống hệt.
3. **Chia dữ liệu theo hồ sơ** (train/valid/test = 70/15/15) để tránh rò rỉ; so sánh Logistic Regression, Random Forest, Gradient Boosting với đường cơ sở không dùng mô hình. Mô hình đạt ROC-AUC khoảng 0,73 đến 0,78 trên tập test; sau khi có diễn biến (bổ sung, làm rõ) khoảng 0,9.
4. **Hạn chế, em xin nêu rõ:** kết quả đo trên dữ liệu giả lập nên chỉ chứng minh quy trình xây dựng và cách mô hình hoạt động, chưa phải độ chính xác thực tế. Hướng tiếp theo là khảo sát vài cán bộ tín dụng để thay các tham số giả định và, nếu được, dùng dữ liệu thật đã ẩn danh.

**Nguồn mở đã xem xét, không chọn:** các bộ dữ liệu vay trên Kaggle (Lending Club, German Credit...) là dữ liệu quyết định tín dụng/rủi ro vỡ nợ, không có thời gian xử lý từng công đoạn, nên không phù hợp bài toán trễ SLA.

**Nếu thầy hỏi thêm:** "Vì sao chọn BPIC 2012?" Vì đây là nhật ký quy trình hồ sơ vay có dấu thời gian từng bước, phù hợp bài toán dự báo thời gian xử lý; "Rule base?" Đã bỏ, chỉ giữ mô hình, theo quyết định của em.
