# Nhật ký quy trình xây dựng mô hình dự báo nguy cơ trễ SLA

Tài liệu sống: ghi lại từ tìm nguồn dữ liệu, xây dựng bộ dữ liệu giả lập, huấn luyện, đến cơ chế mô hình. Mỗi mục có trạng thái **Đã có** (đã làm và có bằng chứng), **Kế hoạch** (đã chốt hướng, chưa làm), hoặc **Mở** (cần quyết định). Chỉ ghi kết quả đã kiểm chứng; chưa chạy thì ghi "chưa thực hiện".

Cập nhật lần cuối: 06/11/2026 (thêm mục 15 xây dựng bộ dữ liệu huấn luyện v3; trước đó mục 12 điểm mạnh, mục 13 đề xuất v3, mục 14 nhật ký trao đổi). Rule base đã bỏ theo quyết định ngày 06/11.

**Lưu ý đọc:** mục 5 đến 7 là kế hoạch ban đầu; ở những điểm mâu thuẫn (phạm vi công đoạn, nhãn theo SLA chưa chốt, rule base tạm gác) thì **mục 13 và 14 là bản mới nhất**.

---

## 0. Mục tiêu và ranh giới

- **Bài toán:** dự báo hồ sơ vay có nguy cơ **trễ SLA** ở công đoạn xử lý, để cán bộ và quản lý ưu tiên theo dõi.
- **Không phải:** chấm điểm tín dụng, dự báo khả năng trả nợ, hay thay quyết định phê duyệt. Mô hình luôn chỉ cảnh báo.
- **Phạm vi nghiệp vụ hiện hành:** hạn mức chính thức tối đa **10 tỷ đồng**, **không còn cấp trên**; quy trình Tiếp nhận, Thẩm định, Hoàn tất. SLA theo giờ làm việc PA1 (thứ Hai đến thứ Sáu, 08:00–12:00 và 13:00–17:00 giờ Việt Nam); thời gian chờ doanh nghiệp bổ sung làm SLA tạm dừng.
- **Ràng buộc từ Master (mục 6A):** giữ hợp đồng tích hợp `POST /predict`, giữ chính sách SLA, không đổi chức năng nghiệp vụ, tách bạch dữ liệu giả lập với dữ liệu thật, lỗi ML không được làm hỏng giao dịch nghiệp vụ.

## 1. Yêu cầu của thầy (ghi lại từ buổi hướng dẫn)

- Mô hình dự báo không quá lớn, thể hiện rõ quy trình.
- Mô hình hóa quy trình dựa trên khảo sát và thực tiễn.
- Dashboard quản lý: tổng số, danh sách, trích lọc, tình trạng, thời gian lưu; xử lý theo công đoạn chậm, lọc theo nhân viên và trạng thái.
- Xây dựng hồ sơ giả lập, tạo nhiều dữ liệu rồi huấn luyện; có thể dùng AI sinh dữ liệu (khoảng 10 hồ sơ trễ, 90 đúng hạn) hoặc tìm nguồn dữ liệu mở. Dữ liệu phải đủ lớn.
- Có mô hình, có dữ liệu, có quy trình, có định lượng.
- Dán nhãn hồ sơ rồi mới dự báo.
- So sánh hai mô hình (một mô hình làm trước, thêm mô hình khác để so sánh), nêu lý do chọn.
- Mô hình giải thích được nguyên nhân hồ sơ trễ.
- Thầy chấp nhận dữ liệu giả lập vì dữ liệu ngân hàng thường không có, nhưng yêu cầu **nêu nguồn** và đi tìm nguồn dữ liệu trên các diễn đàn. Cách hiểu: dữ liệu giả lập phải dựa trên căn cứ có thể chỉ ra. `[MỞ: cần xác nhận lại với thầy]`
- "Rule base trước rồi đến mô hình": hiểu là bộ quy tắc "nếu... thì..." dùng sinh/gán nhãn dữ liệu và làm mô hình cơ sở để so sánh. `[MỞ: cần xác nhận lại với thầy]`

## 2. Hiện trạng mô hình v1.0 (Đã có)

### 2.1. Thành phần
| Thành phần | Vị trí |
|---|---|
| Bộ dữ liệu huấn luyện | `ml-service/data/synthetic_loan_delay_dataset.csv` |
| Script sinh dữ liệu | `ml-service/scripts/generate_synthetic_data.py` |
| Script huấn luyện và so sánh | `ml-service/scripts/train_and_compare.py` |
| Script đánh giá | `ml-service/scripts/evaluate_model.py` |
| Mô hình đã huấn luyện | `ml-service/app/model/delay_model.joblib` (Random Forest) |
| Kết quả so sánh, đặc trưng quan trọng | `ml-service/app/model/model_metadata.json` |
| Dịch vụ dự báo | `ml-service/app/predictor.py`, `main.py` (FastAPI, cổng 8000, `POST /predict`) |
| Gọi từ backend | `backend/src/modules/prediction/prediction.service.ts`, lưu vào bảng `DelayPrediction` |
| Kích hoạt | Sau mỗi lần chuyển bước chưa tới Hoàn tất (`workflow.service.ts`) |

### 2.2. Bộ dữ liệu hiện tại (đã đếm trực tiếp trên file)
- 3.000 hồ sơ, 13 cột. Hồ sơ trễ: 333 (11,1%); đúng hạn: 2.667.
- **Số tiền vay từ 0,5 đến 24,96 tỷ; 670 hồ sơ (22,3%) trên 10 tỷ.** Trái với phạm vi mới (tối đa 10 tỷ).
- 10 đặc trưng đầu vào: `loan_amount`, `loan_term_months`, `loan_type`, `industry`, `established_years`, `annual_revenue`, `debt_to_equity`, `supplement_count`, `officer_workload`, `previous_stage_duration_hours`.
- Cột `delay_probability_true` (xác suất sinh từ công thức) và `application_id` không dùng làm đặc trưng; `is_delayed` là nhãn.

### 2.3. Cách tạo nhãn hiện tại
Script tính logit từ chính các đặc trưng cộng nhiễu chuẩn (độ lệch 0,35), đổi sang xác suất, gán nhãn trễ khi xác suất từ 0,5:

`logit = -3,4 + 1,35·supplement_count + 0,16·(officer_workload − 6) + 0,45·[ngành Xây dựng] + 0,35·[vay đầu tư TSCĐ] + 0,06·(số tiền/1 tỷ) + 0,12·(giờ tiếp nhận − 4) − 0,04·số năm hoạt động + nhiễu`

### 2.4. Hai mô hình đã so sánh (tập kiểm thử 600 hồ sơ, 67 hồ sơ trễ)
| Mô hình | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|
| Logistic Regression (cơ sở) | 0,770 | 1,000 | 0,870 | 0,998 |
| Random Forest (đang dùng) | 0,827 | 0,925 | 0,873 | 0,993 |

### 2.5. Các vấn đề đã xác định ở v1.0
1. Nhãn sinh từ công thức tự đặt, nên điểm số cao chỉ chứng minh mô hình học lại công thức, không chứng minh khả năng dự báo thực tế.
2. Chọn Random Forest chưa có cơ sở vững: Logistic Regression có recall và AUC cao hơn, F1 gần bằng nhau; vì nhãn sinh từ logit nên Logistic Regression vốn phù hợp hơn.
3. Phần giải thích nguyên nhân là quy tắc viết sẵn trong `predictor.py` (kèm phần trăm cố định), không tính từ mô hình.
4. "Trễ" chưa gắn với SLA thật (số giờ làm việc so với định mức công đoạn).
5. Số tiền vượt phạm vi 10 tỷ.
6. `debt_to_equity` không có nguồn thật: doanh nghiệp không khai nợ và vốn chủ; backend đang tính "số tiền đề nghị chia vốn điều lệ".
7. Giờ ở công đoạn Tiếp nhận: dữ liệu huấn luyện (1–12 giờ) khác nghĩa với giờ làm việc PA1, nên backend hiện bỏ qua dự báo và hiển thị "Chưa có dự báo tương thích PA1".
8. Nhóm ngành (5 nhóm) khó khớp với `industry` dạng văn bản tự do và `businessScope` (Sản xuất, Thương mại, Dịch vụ, Khác) của form doanh nghiệp.

## 3. Đối chiếu đặc trưng với thông tin thực tế (Đã có)

Thông tin doanh nghiệp nộp (từ `portal.foundation.ts`, `portal.validation.ts`, schema): `taxCode`, `companyName`, `industry`, `establishedYear`, `annualRevenue`, `charterCapital`, `representativeName`, `phone`, `address`, `loanPurpose`, `loanType`, `proposedAmount` (tối thiểu 10 triệu), `loanTermMonths` (1–120); form V2 thêm `businessScope`, `hasExistingDebt`, `collateral.mode`, `capitalPlan`, danh mục chứng từ nhóm A–F.

Thông tin hệ thống có trong quá trình xử lý: `supplementCount`, lịch sử công đoạn (giờ vào, ra, giờ làm việc thực, tạm dừng), người phụ trách và tải công việc, số lần trả sửa, điều chuyển, điều phối, đối soát công ty.

| Đặc trưng v1.0 | Có nguồn thật? | Hướng xử lý (Kế hoạch) |
|---|---|---|
| `loan_amount` | Có | Giới hạn 0,01 đến 10 tỷ |
| `loan_term_months` | Có | Theo sản phẩm vốn lưu động |
| `loan_type` | Có, nhưng V2 chỉ vốn lưu động | Cân nhắc bỏ hoặc cố định |
| `industry` | Có, dạng văn bản tự do | Chuyển sang `businessScope` hoặc nhóm ngành rõ nghĩa |
| `established_years` | Có | Giữ |
| `annual_revenue` | Có | Giữ, sinh độc lập với số tiền vay |
| `debt_to_equity` | **Không** | Bỏ hoặc thay bằng `hasExistingDebt` và tỷ lệ số tiền vay trên vốn điều lệ (đặt tên đúng) |
| `supplement_count` | Có | Giữ |
| `officer_workload` | Có | Giữ |
| `previous_stage_duration_hours` | Có, nhưng khác nghĩa với PA1 | Tính lại theo giờ làm việc PA1 |
| (mới) số lần trả sửa, có tài sản bảo đảm, có dư nợ hiện có, số tài liệu nộp, số lần điều chuyển | Có trong hệ thống | Đề xuất bổ sung `[MỞ: cần PO duyệt vì đổi đầu vào của /predict]` |

## 4. Tìm nguồn dữ liệu mở (Đã tìm; BPIC 2012 đã tải và phân tích)

Kết luận: **không tìm được bộ dữ liệu mở nào có thời gian xử lý hồ sơ vay SME theo công đoạn.** Bộ gần nhất là nhật ký quy trình vay của tổ chức tài chính.

| Nguồn | Nội dung | Dùng cho | Giới hạn | Trạng thái |
|---|---|---|---|---|
| [BPI Challenge 2012](https://data.4tu.nl/articles/_/12689204/1) | Quy trình xin vay cá nhân hoặc thấu chi, 13.087 hồ sơ, 262.200 sự kiện, 36 hoạt động, 10/2011 đến 3/2012, có `AMOUNT_REQ` và kết quả duyệt, từ chối, hủy | Phân phối thời gian từng bước và cả hồ sơ, tỷ lệ phát sinh bước chờ bổ sung, tỷ lệ kết thúc | Vay cá nhân, Hà Lan, không có thuộc tính doanh nghiệp; giấy phép "4TU General Terms of Use" (chưa đọc điều khoản) | **Đã tải và phân tích (mục 11.1)** |
| [BPI Challenge 2017](https://data.4tu.nl/articles/BPI_Challenge_2017/12696884) | Hồ sơ vay nộp năm 2016, kèm bản offer log | Như trên | Chưa kiểm tra cấu trúc | Chưa tải |
| Kaggle (tìm thử) | Có bộ "Loan approval" 50.000 hồ sơ nhưng không thấy trường thời gian | Chỉ tham khảo phân phối thuộc tính | Không dùng được cho bài toán trễ SLA | Đã loại |
| Cam kết thời gian của ngân hàng trong nước: [VIB](https://baophapluat.vn/cap-tin-dung-von-luu-dong-cho-doanh-nghiep-trong-vong-48-gio-tai-vib-post221950.html) (48 giờ), [MSB](https://vnba.org.vn/vi/msb-tang-toc-phe-duyet-von-cho-doanh-nghiep-21083.htm?print=print) (8 giờ làm việc; 3–5 ngày thông thường), [MB/MiBrand](https://vietnamfinance.vn/mb-toc-do-cho-vay-doanh-nghiep-nho-nhanh-nhat-thi-truong-d142014.html) (1–3 ngày) | Con số công bố | Đối chiếu mức hợp lý của thời gian xử lý | Do ngân hàng hoặc khảo sát quảng bá công bố, không phải dữ liệu đo | Tham chiếu |
| [State Bank of Pakistan](https://www.sbp.org.pk/circulars/ih-smefd-circular-no-14-of-2020) | Quy định 15 ngày làm việc (nhỏ), 25 ngày (vừa) | Tham chiếu quy định | Quy định, không phải dữ liệu đo, khác quốc gia | Tham chiếu |
| Khảo sát cán bộ tín dụng | Thời gian từng công đoạn, tỷ lệ bổ sung, trả sửa, nguyên nhân trễ | Tham số riêng cho bài toán SME | Chưa thực hiện | **Mở** |

Việc cần làm: tải BPI Challenge 2012 (XES), đọc điều khoản và cách trích dẫn (DOI `10.4121/uuid:3926db30-f712-4394-aebc-75976070e91f`), trích phân phối thời gian. Bổ sung bảng nguồn "đã xem nhưng không dùng được" để nộp thầy.

## 5. Xây dựng bộ dữ liệu giả lập (Kế hoạch)

### 5.1. Nguyên tắc
- Hồ sơ giả lập đi qua quy trình như hệ thống thật: nộp, kiểm tra, có thể trả sửa, có thể phải bổ sung (SLA tạm dừng), thẩm định, quyết định.
- **Thời gian xử lý lấy từ mô phỏng** theo giờ làm việc PA1, tham số hiệu chỉnh từ nguồn mở và khảo sát.
- **Nhãn "trễ" là kết quả mô phỏng so với định mức SLA** của công đoạn (hiện cấu hình mặc định: Tiếp nhận 4 giờ, Thẩm định 24 giờ), không sinh từ công thức logit đặt sẵn.
- Số tiền vay 0,01 đến 10 tỷ; bỏ công đoạn cấp trên.
- Quy mô từ 10.000 hồ sơ trở lên, tỷ lệ trễ khoảng 10–15% (tương đương yêu cầu 10 trễ, 90 đúng hạn).
- Cố định hạt giống để tái lập; lưu cấu hình sinh dữ liệu cùng phiên bản.
- Ghi rõ trong báo cáo đây là dữ liệu giả lập được hiệu chỉnh từ nguồn mở và khảo sát, không phải dữ liệu thật.

### 5.2. Các bước
1. Trích từ BPIC 2012 và khảo sát: phân phối thời gian từng bước, tỷ lệ cần bổ sung, tỷ lệ trả sửa, tỷ lệ kết thúc. *(chưa thực hiện)*
2. Lập bảng tham số (phân phối, giá trị, nguồn của từng tham số). *(chưa thực hiện)*
3. Viết bộ mô phỏng sinh hồ sơ và lịch sử công đoạn. *(chưa thực hiện)*
4. Viết rule base (mục 6.1) và dùng để mô tả cơ chế gây trễ trong mô phỏng. *(chưa thực hiện)*
5. Kiểm tra dữ liệu: phạm vi giá trị (số tiền ≤ 10 tỷ), tỷ lệ nhãn, phân phối từng trường, không rò rỉ nhãn. *(chưa thực hiện)*
6. Lưu bộ dữ liệu mới cùng mô tả trường (data dictionary), không ghi đè bộ cũ. *(chưa thực hiện)*

## 6. Mô hình và cơ chế hoạt động

### 6.1. Rule base (Kế hoạch)
Bộ quy tắc "nếu... thì..." dựa trên khảo sát và nguồn mở, cho điểm nguy cơ trễ. Ví dụ quy tắc (chưa phải kết quả khảo sát, chỉ minh họa cách viết):
- Số lần bổ sung từ 2 trở lên: nguy cơ cao.
- Cán bộ đang xử lý nhiều hồ sơ hơn ngưỡng: tăng nguy cơ.
- Thời gian ở Tiếp nhận vượt định mức: tăng nguy cơ.
Vai trò: (a) mô hình cơ sở để so sánh; (b) có lý do giải thích rõ ràng. Hiện `predictor.py` đã có các quy tắc giải thích nhưng chưa được đánh giá như một bộ phân loại.

### 6.2. Hai mô hình học máy (Kế hoạch so sánh lại trên dữ liệu mới)
**Logistic Regression** (mô hình cơ sở, giải thích được)
- Cơ chế: tổ hợp tuyến tính các đặc trưng (đã chuẩn hóa, biến phân loại mã one-hot), qua hàm sigmoid ra xác suất trễ. Mỗi hệ số cho biết đặc trưng tăng hay giảm nguy cơ.
- Ưu: nhỏ, nhanh, giải thích trực tiếp bằng hệ số.

**Random Forest** (mô hình cây, hiện đang dùng)
- Cơ chế: nhiều cây quyết định (v1.0: 150 cây, độ sâu tối đa 8) huấn luyện trên các mẫu con; xác suất trễ là trung bình kết quả các cây. Bắt được quan hệ phi tuyến và tương tác giữa đặc trưng.
- Ưu: thường chính xác hơn khi quan hệ phức tạp. Nhược: khó giải thích hơn, cần công cụ như SHAP.

Có thể thêm Gradient Boosting nếu cần so sánh thứ ba. `[MỞ]`

### 6.3. Cách huấn luyện và đánh giá (Kế hoạch)
- Chia tập huấn luyện và kiểm thử, phân tầng theo nhãn; bổ sung chia theo thời gian và kiểm tra chéo (cross-validation).
- Bù lệch lớp (`class_weight='balanced'`) vì trễ chỉ khoảng 10–15%.
- Chỉ số: precision, recall, F1, ROC-AUC, kèm ma trận nhầm lẫn; so sánh rule base, Logistic Regression, mô hình cây.
- Chọn mô hình dựa trên số liệu và khả năng giải thích; ghi rõ lý do chọn và lý do loại.
- Quy ước cảnh báo: nguy cơ thấp (dưới 0,40), trung bình (0,40–0,70), cao (từ 0,70) theo v1.0 `[MỞ: xem lại ngưỡng sau khi có dữ liệu mới]`.

### 6.4. Giải thích nguyên nhân trễ (Kế hoạch)
Thay quy tắc viết sẵn bằng giải thích tính từ mô hình: hệ số của Logistic Regression, hoặc SHAP cho mô hình cây. Đầu ra vẫn tối đa 3 lý do (giữ định dạng `top_reasons`).

## 7. Tích hợp vào hệ thống (Kế hoạch và ràng buộc)

- Giữ endpoint `POST /predict` và định dạng phản hồi (`delay_probability`, `is_delayed_predicted`, `risk_level`, `top_reasons`, `model_version`, `timestamp`).
- Công đoạn áp dụng: xem mục 13.2 (đề xuất cả Tiếp nhận và Thẩm định; chờ chốt). Nội dung cũ "chỉ Thẩm định" đã được thay thế.
- Thay đổi đặc trưng đầu vào (bỏ `debt_to_equity`, thêm số lần trả sửa...) làm đổi hợp đồng `/predict`: **cần PO duyệt trước** (Master 6A).
- Khi mô hình tương thích PA1, bỏ cơ chế hiển thị "Chưa có dự báo tương thích PA1" cho các hồ sơ phù hợp; vẫn báo lỗi thật khi ML lỗi.
- Bàn giao: phiên bản mô hình mới (đặt tên rõ), lệnh huấn luyện, báo cáo đánh giá, giới hạn của mô hình, cách quay về phiên bản trước.

## 8. Dashboard (Mở)

Yêu cầu của thầy: tổng số, danh sách, trích lọc, tình trạng, thời gian lưu; lọc theo nhân viên và trạng thái; xử lý theo công đoạn chậm. Backend đã có các route `overview`, `sla-bottlenecks`, `early-warnings`, `stage-distribution`, `overdue-supplements`. **Chưa kiểm tra** giao diện có bộ lọc theo nhân viên và trạng thái hay chưa.

## 9. Nhật ký tiến độ

| Ngày | Việc đã làm | Bằng chứng |
|---|---|---|
| 04/11/2026 | Rà soát mô hình v1.0 (dữ liệu, script, predictor, cách backend gọi) | Đọc trực tiếp mã nguồn; đếm số liệu trên CSV |
| 04/11/2026 | Phát hiện 22,3% hồ sơ trong dữ liệu vượt 10 tỷ; đối chiếu các trường với thông tin doanh nghiệp nộp | Mục 2.2, 3 |
| 04/11/2026 | Tìm nguồn dữ liệu mở (4 lượt tìm kiếm); xác định BPI Challenge 2012 là nguồn phù hợp nhất | Mục 4 |
| 04/11/2026 | Tải và phân tích BPI Challenge 2012 (13.087 hồ sơ, 262.200 sự kiện, MD5 khớp) | Mục 11.1 |
| 04/11/2026 | Mô phỏng 12.000 hồ sơ SME, huấn luyện và so sánh rule base với 3 mô hình, giải thích nguyên nhân | Mục 11.2 đến 11.5; mã trong `ml-service/experiments/v2/` |

## 10. Quyết định và câu hỏi mở

1. Xác nhận với thầy: dữ liệu giả lập hiệu chỉnh từ nguồn mở và khảo sát có đủ, hay cần dữ liệu thật?
2. Xác nhận với thầy: "rule base trước rồi đến mô hình" có đúng cách hiểu ở mục 1 không?
3. PO duyệt: được phép đổi đầu vào của `/predict` (thêm, bỏ đặc trưng) hay phải giữ nguyên 10 trường?
4. Có thực hiện khảo sát cán bộ tín dụng không; ai thực hiện, bao nhiêu người?
5. Tải và kiểm tra giấy phép BPI Challenge 2012 và 2017.
6. Có thêm mô hình thứ ba (Gradient Boosting) không?
7. Dự báo áp dụng cho công đoạn Thẩm định, Tiếp nhận, hay cả hai? (đề xuất hiện tại: cả hai, xem mục 13.2, chờ chốt)

---

## 11. Thực nghiệm v2 (đã chạy ngày 04/11/2026)

Toàn bộ nằm trong `ml-service/experiments/v2/`, **không ghi đè** dữ liệu, mô hình hay mã đang chạy của `ml-service/`. Chạy trong container tạm từ ảnh `smesystem-ml-service` (máy chủ không có Python). Chưa tích hợp vào hệ thống, chưa đổi hợp đồng `/predict`.

### 11.1. Bước 1: phân tích nguồn mở BPI Challenge 2012 (Đã có)
Dữ liệu tải từ 4TU.ResearchData, kiểm tra MD5 khớp (`74c7ba9a…`), số liệu đếm khớp công bố: 13.087 hồ sơ, 262.200 sự kiện. Phân tích bằng script Node tự viết (thư mục tạm của phiên làm việc, không nằm trong repo).

| Phát hiện | Giá trị |
|---|---|
| Kết cục | Từ chối 58,3% (trung vị 0,2 giờ, tự động), hủy 21,4%, duyệt 17,2% |
| Hồ sơ được duyệt, thời gian cả hồ sơ (giờ lịch) | Trung vị 348 giờ (14,5 ngày), P90 691 giờ |
| Thời gian đến khi gửi đề nghị | Trung vị 5,7 giờ, P75 21,7 giờ, P90 45,6 giờ |
| Thời gian làm trực tiếp mỗi việc | Trung vị 0 đến 0,2 giờ (rất ngắn) |
| Thời gian **chờ hàng đợi** (ví dụ xác thực hồ sơ) | Trung vị 25,8 giờ, P90 118 giờ, đuôi dài |
| Hồ sơ có bước theo dõi hồ sơ chưa đủ | 12,6% tổng (1.647 hồ sơ); số lần lặp đuôi dài |

Kết luận dùng được: trễ chủ yếu do **chờ trong hàng đợi**, không do làm lâu; phân phối chờ có đuôi dài (P90/trung vị khoảng 4,6, tương đương sigma khoảng 1,19 của phân phối lognormal); khoảng 22% hồ sơ cần theo dõi bổ sung (ước tính).
Cảnh báo: so sánh "có bước theo dõi bổ sung: 404 giờ, không có: 8 giờ" bị lẫn bởi hồ sơ từ chối tự động nên không dùng để kết luận quan hệ nhân quả. Dữ liệu là giờ lịch (gồm cuối tuần), bối cảnh vay cá nhân ở Hà Lan.

### 11.2. Bước 2 và 3: bộ mô phỏng hồ sơ SME (`simulate.py`) (Đã có)
- 12.000 hồ sơ, hạt giống 2026. Số tiền 0,01 đến 10 tỷ (0% vượt 10 tỷ). Không có công đoạn cấp trên.
- Đầu vào chỉ gồm thông tin doanh nghiệp nộp hoặc hệ thống có tại thời điểm hồ sơ vào Thẩm định: số tiền, thời hạn, phạm vi kinh doanh, số năm hoạt động, doanh thu, có dư nợ, đề xuất tài sản bảo đảm, số lần bổ sung, số lần trả sửa, tải công việc cán bộ, giờ ở Tiếp nhận.
- Thời gian Thẩm định (giờ làm việc) = (thời gian làm + thời gian chờ hàng đợi) nhân hệ số ẩn của cán bộ (không đưa vào đặc trưng). Thời gian chờ có hình dạng lognormal sigma 1,2 **lấy từ BPIC**, tăng theo tải công việc.
- **Nhãn `is_late` = tổng giờ làm việc ở Thẩm định > 24 giờ** (định mức mặc định trong seed). Kết quả mô phỏng: 1.341 hồ sơ trễ trên 12.000 (11,18%). Trung vị 12,1 giờ, P90 25,0 giờ.
- Hiệu chỉnh: một tham số (`WAIT_BASE_MEDIAN`) được chỉnh từ 3,0 xuống 2,0 để tỷ lệ trễ từ 16,3% về khoảng 11%, gần mục tiêu của thầy (khoảng 10 trễ, 90 đúng hạn). Đây là chọn lựa có chủ đích, đã ghi trong mã.
- **Mỗi tham số được gắn nhãn nguồn trong mã:** `[BPIC]`, `[HT]` (hệ thống), `[GD]` (giả định). Các tham số `[GD]` (tỷ trọng ngành, tỷ lệ trả sửa, mức thời gian làm, hệ số tăng theo tải...) **chưa có căn cứ khảo sát**, cần cán bộ tín dụng xác nhận.

### 11.3. Bước 4: rule base (`rule_score` trong `train_compare.py`) (Đã có)
Cộng điểm theo ngưỡng thô: bổ sung từ 2 lần (+2) hoặc 1 lần (+1); cán bộ từ 10 hồ sơ (+2) hoặc từ 8 (+1); đề xuất tài sản bảo đảm (+1); có dư nợ (+1); số tiền trên 5 tỷ (+1); đã trả sửa (+1); giờ Tiếp nhận trên 4 (+1). Báo trễ khi điểm từ 4 (ngưỡng chọn trên tập huấn luyện để F1 cao nhất). Ngưỡng là **giả định chưa khảo sát**.

### 11.4. Bước 5: huấn luyện và so sánh (Đã có)
Chia 70/30 phân tầng (8.400 huấn luyện, 3.600 kiểm thử, tỷ lệ trễ 11,2% ở cả hai), kiểm tra chéo 5 lần trên tập huấn luyện. Ba mô hình cùng tiền xử lý, bù lệch lớp (`class_weight` cân bằng), ngưỡng dự đoán 0,5.

| Phương án | ROC-AUC (kiểm thử) | ROC-AUC (CV 5 lần) | PR-AUC (kiểm thử) | Precision | Recall | F1 | Bắt được bao nhiêu hồ sơ trễ khi cảnh báo 20% hồ sơ điểm cao nhất |
|---|---|---|---|---|---|---|---|
| Rule base | 0,677 | - | 0,205 | 0,208 | 0,503 | 0,295 | 37,8% |
| **Logistic Regression** | **0,716** | 0,715 ± 0,013 | **0,283** | 0,207 | 0,639 | 0,312 | **44,5%** |
| Random Forest | 0,693 | 0,697 ± 0,009 | 0,261 | 0,203 | 0,540 | 0,295 | 41,8% |
| Gradient Boosting | 0,668 | 0,662 ± 0,008 | 0,236 | 0,195 | 0,475 | 0,276 | 39,8% |

Mốc so sánh: tỷ lệ trễ nền là 11,2% (PR-AUC của dự đoán ngẫu nhiên xấp xỉ 0,11); cảnh báo ngẫu nhiên 20% hồ sơ bắt được khoảng 20% hồ sơ trễ.

**Nhận định (chỉ dựa trên số liệu trên):**
1. Các mô hình đều **chỉ ở mức vừa phải** (ROC-AUC khoảng 0,67 đến 0,72). Nguyên nhân hợp lý: phần lớn biến động thời gian đến từ thời gian chờ ngẫu nhiên (đuôi dài) và hệ số ẩn của cán bộ, không quan sát được tại thời điểm dự báo. Khác hẳn v1.0 (AUC 0,99) vì ở v1.0 nhãn là hàm xác định của đặc trưng.
2. **Logistic Regression tốt nhất** ở mọi chỉ số và ổn định nhất; mô hình cây không hơn. Điều này nhất quán với việc quan hệ trong mô phỏng gần tuyến tính theo logarit. Lý do chọn: chính xác hơn, ổn định, **giải thích được trực tiếp**, nhỏ gọn.
3. Rule base có AUC 0,677, mô hình học máy hơn rule base không nhiều (AUC +0,04). Đây là kết quả trung thực: bộ quy tắc hợp lý đã nắm phần lớn tín hiệu.
4. Với precision khoảng 0,2 ở ngưỡng 0,5, mô hình **không phù hợp làm bộ phân loại cứng**; phù hợp làm công cụ **xếp hạng ưu tiên**: cảnh báo 20% hồ sơ nguy cơ cao nhất bắt được khoảng 44,5% hồ sơ trễ (gấp khoảng 2,2 lần ngẫu nhiên).

### 11.5. Bước 6: giải thích nguyên nhân (Đã có)
- **Hệ số Logistic Regression (đã chuẩn hóa), nhóm tăng nguy cơ mạnh nhất:** số lần yêu cầu bổ sung (+0,465), cán bộ đang giữ nhiều hồ sơ (+0,429), có đề xuất tài sản bảo đảm (+0,396), số tiền lớn (+0,200), doanh nghiệp đang có dư nợ (+0,191), số lần trả sửa (+0,133).
- **Độ quan trọng hoán vị của Random Forest (mức giảm AUC):** số lần bổ sung 0,077; tài sản bảo đảm 0,041; tải công việc 0,024; các đặc trưng còn lại gần 0. Hai phương pháp **cùng chỉ ra ba nguyên nhân hàng đầu**.
- **Giải thích từng hồ sơ:** đóng góp của từng đặc trưng = hệ số nhân giá trị chuẩn hóa; lấy tối đa 3 yếu tố làm tăng nguy cơ nhiều nhất làm `top_reasons`. Ví dụ hồ sơ có 5 lần bổ sung, cán bộ giữ 20 hồ sơ, có đề xuất tài sản bảo đảm: xác suất trễ 0,99, trễ thật; ba lý do tương ứng. Giải thích này **tính từ mô hình**, thay cho quy tắc viết sẵn của v1.0.

### 11.6. Giới hạn bắt buộc nêu khi báo cáo
- **Đây là dữ liệu mô phỏng, nhãn là kết quả của quy trình giả định.** Các con số hiệu suất chỉ cho biết mô hình học được quy luật trong mô phỏng, không chứng minh độ chính xác trên hồ sơ thật.
- Nguồn mở (BPIC 2012) chỉ dùng để hiệu chỉnh **hình dạng** phân phối chờ và tỷ lệ bổ sung; bối cảnh khác (vay cá nhân, Hà Lan, giờ lịch).
- Các tham số `[GD]` chưa khảo sát. Trước khi báo cáo cuối cần khảo sát cán bộ tín dụng và cập nhật.
- Mô hình chưa tích hợp; việc dùng đầu vào mới (số lần trả sửa, tài sản bảo đảm, dư nợ, phạm vi kinh doanh) **thay đổi hợp đồng `/predict`**, cần PO duyệt.

### 11.7. Cách chạy lại (không cần cài Python)
Từ thư mục gốc dự án, dùng container tạm (đặt `MSYS_NO_PATHCONV=1` nếu dùng Git Bash trên Windows). Hai lệnh, chạy lần lượt `simulate.py` rồi `train_compare.py`:

    docker run --rm -v "<đường dẫn>/ml-service/experiments:/work" --entrypoint python smesystem-ml-service /work/v2/simulate.py
    docker run --rm -v "<đường dẫn>/ml-service/experiments:/work" --entrypoint python smesystem-ml-service /work/v2/train_compare.py

Đầu ra: `v2/data/sme_appraisal_delay_sim_v2.csv`, `v2/data/sim_summary.json`, `v2/results/metrics_v2.json`. Hạt giống cố định nên chạy lại cho cùng kết quả.

### 11.8. Việc còn lại
1. Khảo sát cán bộ tín dụng để thay các tham số `[GD]`.
2. Phân tích BPIC có kiểm soát nhóm kết cục (điểm lẫn ở 11.1).
3. Thử thêm chia theo thời gian, hiệu chỉnh xác suất (calibration) và chọn ngưỡng theo mục tiêu vận hành.
4. Xin PO duyệt đổi đầu vào, rồi tích hợp (giữ `/predict`, `top_reasons` từ hệ số hồi quy), kiểm thử hồi quy backend và giao diện.
5. Kiểm tra dashboard theo yêu cầu thầy.

---

## 12. Điểm mạnh của mô hình

Mỗi điểm dưới đây có bằng chứng kèm theo. Các con số hiệu suất đo trên **dữ liệu mô phỏng** (mục 11), nên chỉ cho biết mô hình học được quy luật trong mô phỏng, chưa chứng minh trên hồ sơ thật.

| STT | Điểm mạnh | Bằng chứng |
|---|---|---|
| 1 | **Nhỏ, nhanh, tái lập được.** Không cần máy chủ riêng hay GPU. Huấn luyện và so sánh cả rule base lẫn 3 mô hình, kiểm tra chéo 5 lần, tính giải thích mất khoảng 31 giây; sinh 12.000 hồ sơ mất khoảng 3 giây. Hạt giống cố định nên chạy lại cho cùng kết quả | Đo thực tế ngày 04/11/2026 (mục 11.7) |
| 2 | **Nhãn gắn với SLA thật.** "Trễ" là kết quả mô phỏng quy trình so với định mức công đoạn, không phải công thức đặt sẵn như v1.0 | Mục 11.2 |
| 3 | **Dữ liệu lưu thời gian thực, gán lại nhãn được.** Khi SLA đổi chỉ cần gán nhãn lại và huấn luyện lại trong vài chục giây, không phải sinh dữ liệu mới | Thiết kế mục 13.1; thời gian huấn luyện đã đo |
| 4 | **Có ích để xếp ưu tiên.** Logistic Regression: cảnh báo 20% hồ sơ có điểm cao nhất bắt được khoảng 44,5% hồ sơ trễ (gấp khoảng 2,2 lần chọn ngẫu nhiên); PR-AUC 0,283 so với mức nền 0,11 | Mục 11.4 |
| 5 | **Giải thích được nguyên nhân từ chính mô hình.** Hệ số Logistic Regression và độ quan trọng hoán vị của Random Forest cùng chỉ ba yếu tố hàng đầu (số lần bổ sung, tải công việc của cán bộ, tài sản bảo đảm). Mỗi hồ sơ có tối đa 3 lý do tính từ mô hình, thay cho quy tắc viết sẵn của v1.0 | Mục 11.5 |
| 6 | **So sánh có hệ thống và trung thực.** Rule base, Logistic Regression, Random Forest, Gradient Boosting cùng một bộ dữ liệu, một cách chia, một bộ chỉ số, có kiểm tra chéo. Lý do chọn dựa trên số liệu | Mục 11.4 |
| 7 | **Ranh giới rõ ràng.** Mô hình chỉ cảnh báo nguy cơ trễ SLA, không chấm điểm tín dụng và không thay quyết định phê duyệt hay từ chối | Master mục 1 và 6A |
| 8 | **Chịu lỗi và trung thực.** Dịch vụ dự báo chạy tách biệt; lỗi ML không làm hỏng giao dịch nghiệp vụ; khi không áp dụng được hệ thống nói "không áp dụng" thay vì bịa xác suất | Master mục 5; `prediction.service.ts` |
| 9 | **Đúng phạm vi SME mới.** Số tiền tối đa 10 tỷ, không có cấp trên; đặc trưng lấy từ thông tin doanh nghiệp thật sự nộp và từ diễn biến xử lý đang có trong hệ thống | Mục 3, 11.2 |
| 10 | **Thay thế được mà không đụng nghiệp vụ.** Mô hình chạy thành dịch vụ riêng với hợp đồng `/predict` rõ ràng, có thể thay mô hình hoặc phiên bản mà không ảnh hưởng phần quản lý hồ sơ | Master mục 6A |

**Giới hạn đi kèm (phải nêu cùng điểm mạnh):** dữ liệu là mô phỏng, tham số `[GD]` chưa khảo sát, độ chính xác chỉ ở mức vừa phải (ROC-AUC khoảng 0,67 đến 0,72), precision khoảng 0,2 ở ngưỡng 0,5 nên phù hợp **xếp hạng ưu tiên** hơn là phân loại cứng, dự báo cập nhật theo sự kiện nên có thể lỗi thời. Chi tiết ở mục 11.6 và mục 14.

---

## 13. Đề xuất xây dựng lại mô hình (v3), thay thế mục 5 đến 7 ở những điểm mâu thuẫn

Trạng thái: **đề xuất, chờ chốt và chờ PO duyệt**. Phạm vi: hạn mức tối đa 10 tỷ, không còn cấp trên, quy trình Tiếp nhận, Thẩm định, Hoàn tất. **SLA chưa chốt**, nên thiết kế không phụ thuộc vào con số SLA. Rule base tạm gác, tập trung vào mô hình.

### 13.1. Nguyên tắc thiết kế
1. Bộ dữ liệu lưu **thời gian thực** (giờ làm việc đã dùng ở mỗi công đoạn), nhãn "trễ" gán sau bằng một tham số SLA. SLA đổi thì gán nhãn lại và huấn luyện lại.
2. Hiệu chỉnh thời gian xử lý từ **nguồn tham khảo và khảo sát**, không từ SLA. Tỷ lệ trễ là kết quả theo từng SLA. Gợi ý SLA hợp lý có thể lấy theo phân vị 85–90 của thời gian xử lý thực để cho tỷ lệ trễ khoảng 10–15%.
3. Mô hình gắn với một SLA cố định: SLA là ngưỡng gán nhãn, không phải đầu vào. Ghi **phiên bản SLA** cùng phiên bản mô hình.
4. Giờ làm việc ở huấn luyện và lúc chạy thật dùng **cùng bộ tính PA1 và cùng lịch**.

### 13.2. Phạm vi dự báo (đề xuất hai công đoạn)
| | Tiếp nhận | Thẩm định |
|---|---|---|
| Nhãn "trễ" | Giờ làm việc **phía ngân hàng** (trừ thời gian chờ doanh nghiệp) vượt định mức Tiếp nhận | Giờ làm việc vượt định mức Thẩm định |
| Thời điểm dự báo | Khi tạo khoản vay; **làm mới khi doanh nghiệp nộp bổ sung xong** và hồ sơ quay về cho cán bộ | Khi vào Thẩm định; làm mới khi có yêu cầu làm rõ hoặc điều chuyển |
| Đặc trưng nổi bật | Số lần bổ sung, số tài liệu cần kiểm tra lại, số lần trả sửa, tải cán bộ, tài sản bảo đảm, dư nợ, số tiền | Như Tiếp nhận, cộng giờ đã dùng ở Tiếp nhận |

Lý do giữ Tiếp nhận: trong công đoạn này sau khi doanh nghiệp bổ sung xong, CBTD vẫn phải kiểm tra từng tài liệu, giải quyết bổ sung, xác nhận đủ hồ sơ, xác định hạn mức, lập tờ trình, và SLA chỉ trừ thời gian chờ doanh nghiệp. Hồ sơ **chờ doanh nghiệp** thì không dự báo trễ SLA (lỗi không phải của ngân hàng).
Hướng mở rộng sau: dự báo nguy cơ doanh nghiệp bổ sung quá hạn (bị đóng mã TC05). `[MỞ]`

### 13.3. Các bước
| Bước | Việc | Phụ thuộc SLA chốt |
|---|---|---|
| 0 | Chốt định nghĩa nhãn, thời điểm dự báo, đặc trưng, phạm vi | Không |
| 1 | Tìm nguồn tham khảo (BPIC 2012 đã tải; thêm BPIC 2017; tài liệu ngân hàng; phiếu khảo sát cán bộ). Sản phẩm: bảng nguồn dữ liệu | Không |
| 2 | Phân tích nguồn có kiểm soát nhóm kết cục; lập bảng tham số, mỗi tham số ghi nguồn | Không |
| 3 | Bộ mô phỏng v3: quy trình hai công đoạn, giờ làm việc PA1, số tiền ≤ 10 tỷ, yếu tố ẩn của cán bộ, từ 10.000 hồ sơ; kiểm tra chất lượng dữ liệu | Không |
| 4 | Gán nhãn theo nhiều kịch bản SLA; chia tập huấn luyện, kiểm thử, kể cả chia theo thời gian | Dùng tham số, chạy nhiều kịch bản |
| 5 | Huấn luyện: mô hình cơ sở theo tỷ lệ nền, Logistic Regression, Random Forest, Gradient Boosting; kiểm tra chéo; hiệu chỉnh xác suất; chọn ngưỡng | Theo kịch bản |
| 6 | Đánh giá định lượng và độ nhạy (tham số giả định ±20%, đổi SLA, giảm số mẫu, bỏ nhóm đặc trưng) | Theo kịch bản |
| 7 | Giải thích nguyên nhân (hệ số hoặc SHAP), giữ định dạng `top_reasons` tối đa 3 lý do | Không |
| 8 | Tích hợp vào hệ thống: **đổi hợp đồng `/predict` cần PO duyệt**, đặt tên phiên bản, quay lui được, sửa các điểm lệch (`debt_to_equity`, nhóm ngành, tương thích PA1) | Có |
| 9 | Kiểm thử đơn vị, tích hợp backend, ML, giao diện, hồi quy; báo cáo giới hạn | Có |

### 13.4. Từ điển dữ liệu đầu vào (đề xuất)
**Cố định, biết từ lúc nộp:** số tiền đề nghị và hạn mức chính thức, thời hạn vay, phạm vi kinh doanh (`businessScope`), số năm hoạt động, doanh thu năm, có dư nợ (`hasExistingDebt`), có đề xuất tài sản bảo đảm (`collateral.mode`), số tài liệu nộp theo nhóm A–F.
**Thay đổi theo diễn biến:** số lần bổ sung, số tài liệu bổ sung phải kiểm tra, số lần trả sửa, tải công việc cán bộ, số lần điều chuyển, giờ làm việc đã dùng ở Tiếp nhận (phía ngân hàng), trạng thái đang chờ doanh nghiệp hay ngân hàng.
**Không dùng làm đầu vào (rò rỉ):** thời gian thực tế của chính công đoạn đang dự báo, kết quả phê duyệt hay từ chối, thời gian chờ hàng đợi của chính công đoạn đó.
**Dữ liệu huấn luyện cần thêm:** giờ vào và ra từng công đoạn, các khoảng tạm dừng, người xử lý, định mức SLA lưu theo phiên bản, phiên bản lịch ngày lễ.

### 13.5. Cách dùng nhãn rủi ro trong hệ thống (đề xuất, cần PO duyệt)
- **Hiện tại:** mức rủi ro chỉ hiển thị (huy hiệu ở dashboard, màn điều chuyển, Kanban, chi tiết hồ sơ) và danh sách cảnh báo sớm sắp theo xác suất trễ giảm dần. Không có bộ lọc theo mức rủi ro, không có thông báo khi chuyển sang mức cao, không đổi trạng thái, không tự điều chuyển.
- **Không làm:** đổi trạng thái nghiệp vụ, tự chuyển công đoạn, tự điều chuyển cán bộ theo dự báo (ML chỉ cảnh báo; chỉ Quản lý phân công).
- **Nên làm:** coi mức rủi ro là thuộc tính riêng. Nhóm trạng thái: mức rủi ro (Thấp, Trung bình, Cao); tình trạng dự báo (chưa có, không áp dụng, lỗi dịch vụ). Thêm bộ lọc theo mức rủi ro kết hợp lọc theo cán bộ và trạng thái; thông báo cho Quản lý và cán bộ phụ trách khi chuyển lên mức Cao; hiển thị tối đa 3 lý do.
- **Email cho doanh nghiệp:** không dựa trên dự báo trễ SLA, vì đó là trễ phía ngân hàng, doanh nghiệp không được thấy dự báo ML, và precision khoảng 0,2 sẽ gửi nhầm nhiều. Chỉ nhắc doanh nghiệp khi hồ sơ **đang chờ doanh nghiệp bổ sung**, theo quy tắc thời gian sẵn có (ngày 5, ngày 10), nội dung chỉ nêu chứng từ còn thiếu và hạn nộp, có giới hạn tần suất.

---

## 14. Nhật ký trao đổi và quyết định (04/11/2026)

### 14.1. Mô hình chạy khi nào
- (**Đã được thay thế ngày 09/11/2026**: v4 chấm theo lịch 08:00 và 13:00 mỗi ngày làm việc, xem SME_MASTER mục 5.) Bản gốc: mô hình **không chạy theo lịch mỗi ngày**. Chạy **theo sự kiện**: sau mỗi lần chuyển bước chưa hoàn tất, khi trình tờ trình lần đầu, khi tạo yêu cầu bổ sung, sau khi điều chuyển. Cán bộ thẩm quyền và Quản lý có thể **bấm tính lại** từng hồ sơ; CBTD chỉ xem. Bộ hẹn giờ duy nhất trong backend là nhắc quá hạn bổ sung lúc 08:00, không liên quan mô hình.
- **Khoảng hở được xác định:** nếu hồ sơ nằm yên không có sự kiện, dự báo cũ vẫn hiện. Mô hình cũng không có đặc trưng "đã ở công đoạn bao lâu", nên chạy lại hằng ngày cũng không đổi kết quả. Phát hiện hồ sơ quá hạn thực tế cần **đồng hồ SLA** (giờ đã dùng so với định mức), không phải mô hình. Đã phân biệt hai loại quy tắc: quy tắc dự báo (ước đoán trước) và quy tắc theo thời gian (đo thực tế).
- Điểm hở khác nghi ngờ nhưng chưa kiểm chứng: đề nghị đã nộp nhưng chưa được phân công thì chưa thành khoản vay nên không có SLA công đoạn lẫn dự báo.

### 14.2. Rule base so với mô hình
- Rule base cộng điểm theo ngưỡng do người đặt. Logistic Regression thực chất là cộng điểm nhưng trọng số do dữ liệu quyết định; Random Forest, Gradient Boosting bắt được tương tác.
- Kết quả đã đo: ROC-AUC rule base 0,677, Logistic Regression 0,716. Mô hình hơn khoảng 0,04, chỉ hơn một chút.
- So sánh có thể bị **khập khiễng** nếu: dữ liệu mô phỏng, rule base viết cùng người với bộ mô phỏng nên "biết trước" quy luật, chọn ngưỡng không đồng đều, đặc trưng và cách chia dữ liệu khác nhau. Cách làm công bằng: cùng đặc trưng, cùng cách chia, chỉ số không phụ thuộc ngưỡng, viết quy tắc dựa trên khảo sát độc lập.
- **Quyết định:** tạm gác phần rule base, tập trung xây dựng và đánh giá mô hình. Phần rule base do người phụ trách làm riêng.

### 14.3. Công đoạn dự báo
- Ban đầu đề xuất chỉ dự báo ở Thẩm định (khớp tài liệu Master "tính khi vào Thẩm định" và ý nghĩa của đặc trưng giờ ở Tiếp nhận). Việc thu hẹp thời điểm kích hoạt so với mã hiện tại (đang gọi sau nhiều sự kiện) vẫn đổi hành vi nhìn thấy được, cần PO duyệt.
- **Chỉnh lại sau góp ý của người dùng:** Tiếp nhận không chỉ có chờ doanh nghiệp; sau khi doanh nghiệp bổ sung xong, CBTD vẫn phải kiểm tra tài liệu, giải quyết bổ sung, xác nhận, lập tờ trình. Nhận định trước đó "trễ ở Tiếp nhận chủ yếu do chờ doanh nghiệp" là **quá mạnh và đã được sửa**.
- **Đề xuất hiện tại:** dự báo ở **cả hai công đoạn** (mục 13.2), nhãn theo thời gian phía ngân hàng. Trạng thái: **chờ chốt**.

### 14.4. Cách dùng nhãn rủi ro và thông báo
Nội dung ở mục 13.5. Tóm tắt: không đẩy hồ sơ lên hay đổi trạng thái; thêm lọc, ưu tiên và thông báo nội bộ (cần duyệt); không gửi email cho doanh nghiệp dựa trên dự báo.

### 14.5. Bài học về SLA (liên quan mô hình)
- Định mức hiện tại trong cơ sở dữ liệu: Tiếp nhận 4 giờ, Thẩm định 24 giờ, Cấp trên 48 giờ, Hoàn tất 8 giờ. Bảng kích hoạt PA1 đang trống nên hệ thống tính theo giờ liên tục 24/7; lịch làm việc duy nhất trong mã chỉ phủ 26/10 đến 08/11/2026.
- **Đề xuất (chưa chốt):** dùng PA1, khai báo theo ngày làm việc, Tiếp nhận 10 ngày (80 giờ), Thẩm định 5 ngày (40 giờ), nạp lịch ngày lễ cả năm 2026 do PO cung cấp, gỡ công đoạn Cấp trên. Chi tiết ở `2026-11-04-ke-hoach-sua-sla-va-tai-khoan-mo-phong.md`.
- Phương án "SLA chỉ chạy khi có người truy cập" được xem xét và **không khuyên dùng**: hồ sơ bị bỏ quên thì đồng hồ đứng yên, dễ bị lách, đo sai thứ cần đo.
- Cán bộ nghỉ phép hoặc nghỉ đột xuất: SLA không tạm dừng; xử lý bằng điều chuyển hồ sơ; đề xuất thêm chức năng khai báo vắng mặt và điều chuyển hàng loạt (cần duyệt).

### 14.6. Thời gian huấn luyện
Đo thực tế: huấn luyện và so sánh khoảng 31 giây, sinh dữ liệu khoảng 3 giây. Thời gian huấn luyện không phải vấn đề; công sức nằm ở chuẩn bị dữ liệu và nhãn, đánh giá độ nhạy, tích hợp và kiểm thử.

### 14.7. Danh sách việc còn mở sau các trao đổi
1. Chốt phạm vi dự báo hai công đoạn hay chỉ Thẩm định.
2. PO chốt SLA, danh sách ngày nghỉ 2026, kích hoạt PA1.
3. PO duyệt đổi đầu vào của `/predict`, thu hẹp thời điểm kích hoạt, bộ lọc và thông báo theo mức rủi ro.
4. Khảo sát cán bộ tín dụng để thay các tham số giả định.
5. Tải và kiểm tra giấy phép BPI Challenge 2012, 2017; lập bảng nguồn dữ liệu để nộp thầy.
6. Xác nhận với thầy: dữ liệu giả lập hiệu chỉnh có đủ không; cách hiểu "rule base trước rồi đến mô hình".

---

## 15. Xây dựng bộ dữ liệu huấn luyện v3 (06/11/2026)

### 15.1. Quyết định của người phụ trách (06/11/2026)
- **Bỏ rule base**, chỉ làm mô hình. (Thay cho trạng thái "tạm gác" ở mục 14.2.)
- Dùng **dữ liệu mở để hiệu chỉnh**; thiếu thì dùng dữ liệu giả lập.
- Dự báo ở **cả hai công đoạn** Tiếp nhận và Thẩm định (chốt phạm vi ở mục 13.2).
- Việc đang làm: xây bộ dữ liệu huấn luyện trước; chưa huấn luyện.

### 15.2. Rà soát lại trước khi làm
- Đã đọc lại `AGENTS.md`, chính sách chung và `Project.md`. Lưu ý: chính sách ghi `docs` chỉ duy trì hai tài liệu `SME_MASTER.md`, `SME_KY_THUAT.md` và kết quả của đợt điều chỉnh mô hình phải cập nhật vào Master. File nhật ký này nằm ngoài quy tắc đó; **cần chuyển phần tóm tắt vào `SME_MASTER.md` khi hoàn tất** và cân nhắc việc giữ các tệp trong `docs/ai`.
- **CodeGraph bị chặn:** `npm run graph:check` báo cấu hình đổi, `npm run graph:build` lỗi `ENOENT ... T:\SME%20SYSTEM\node_modules\@optave\codegraph\package.json` (đường dẫn thư mục dự án có khoảng trắng bị mã hóa thành `%20`). **Chưa khắc phục**, nên phân tích cấu trúc lần này dựa trên đọc trực tiếp mã nguồn, không qua CodeGraph. Công việc hôm nay chỉ tạo tệp mới trong `ml-service/experiments/v3/`, không sửa mã nguồn hệ thống.
- Đối chiếu với hệ thống (đã kiểm chứng ở các mục trước): các trường doanh nghiệp nộp, diễn biến Tiếp nhận (bổ sung, kiểm tra tài liệu, xác nhận đủ hồ sơ, lập tờ trình) và Thẩm định (làm rõ không dừng SLA), SLA PA1 tạm dừng khi chờ doanh nghiệp, trần 10 tỷ.

### 15.3. Các bước đã làm
| Bước | Việc | Kết quả |
|---|---|---|
| 1 | Trích tham số từ BPI Challenge 2012, **tính theo giờ làm việc** (không còn giờ lịch) và có kiểm soát kết cục. Script: `ml-service/experiments/v3/tools/extract_bpic_params.cjs` | `params/bpic2012_params.json` |
| 2 | Bộ mô phỏng v3 `simulate_v3.py`: hai công đoạn, thời gian chờ doanh nghiệp tách riêng, yếu tố ẩn, ba bảng dữ liệu | 20.000 hồ sơ; 28.190 snapshot Tiếp nhận; 26.604 snapshot Thẩm định |
| 3 | Kiểm tra chất lượng `check_quality_v3.py` | 13 phép kiểm tra **đạt hết** |
| 4 | Kiểm tra tái lập | Hai lần chạy cho ba tệp CSV giống hệt (MD5) |
| 5 | Từ điển dữ liệu và hướng dẫn | `ml-service/experiments/v3/README.md` |

### 15.4. Kết quả trích từ BPIC 2012 (giờ làm việc)
| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| Hàng đợi bắt đầu xử lý (`W_Completeren`) | Trung vị 2,0 giờ; độ lệch chuẩn log 1,09; độ nhạy theo hàng đợi 0,56 (hệ số xác định 0,24) | Dùng cho thời gian chờ ở cả hai công đoạn |
| Hàng đợi xác thực (`W_Valideren`) | Trung vị 9,7 giờ; độ lệch chuẩn log 1,57; độ nhạy 0,64 (hệ số xác định 0,06) | Tham chiếu đuôi dài (không dùng mặc định) |
| Tỷ lệ cần theo dõi bổ sung | 22,4% hồ sơ qua tiền chấp nhận | Tỷ lệ cần bổ sung |
| Số lần theo dõi (khi có) | Trung vị 5, P90 14 | **Không dùng** cho số vòng bổ sung chính thức vì BPIC đếm lần gọi |
| Hiệu ứng của bước theo dõi, đã kiểm soát kết cục | Hồ sơ có bước theo dõi tốn thêm 1,30 lần (được duyệt) và 1,27 lần (bị hủy) | Dùng để kiểm tra mức hợp lý |
| Hồ sơ được duyệt, tổng thời gian | Trung vị 81,7 giờ; P90 163,8 giờ | So với tổng mô phỏng (gồm chờ doanh nghiệp): trung vị 59,1; P90 146,3 |

Điểm đáng chú ý: độ nhạy theo hàng đợi trong BPIC có hệ số xác định rất thấp (0,06 và 0,24), nghĩa là tải công việc giải thích được ít biến thiên thời gian chờ. Điều này được giữ trong mô phỏng (tương quan tải và giờ xử lý chỉ khoảng 0,08 đến 0,09), nên mô hình sau này **sẽ khó đạt độ chính xác cao**, đây là kết quả hợp lý chứ không phải lỗi.

### 15.5. Điều chỉnh khi kiểm tra chất lượng (ghi lại để minh bạch)
- **Lần chạy đầu** dùng độ lệch 1,57 cho thời gian chờ: đuôi quá dài (Thẩm định P99 hơn 250 giờ), tỷ lệ trễ 24% ở mốc 40 giờ. **Đổi sang 1,09** (của hàng đợi bắt đầu xử lý), ghi lý do trong mã; vẫn cho phép đổi lại bằng `SIM_SIGMA_QUEUE`.
- **Phép kiểm tra "hồ sơ có bổ sung lâu hơn 1,3 lần"** ban đầu so sai đối tượng (tổng gồm cả chờ doanh nghiệp: 2,36 lần). Sửa thành so **giờ phía ngân hàng** (1,33 lần), vì bước theo dõi của BPIC là ngân hàng gọi khách, tương đương việc ngân hàng xử lý hơn là chờ doanh nghiệp.
- Các điều chỉnh này đều là **quyết định mô hình hóa của người xây dựng**, không phải kết quả đo từ dữ liệu thật. Cần xác nhận khi khảo sát.

### 15.6. Số liệu SLA từ dữ liệu giả lập (để PO tham khảo khi chốt SLA)
| | Tiếp nhận | Thẩm định |
|---|---|---|
| Trung vị (giờ làm việc ngân hàng) | 29,8 | 20,2 |
| P90 | 62,3 | 52,5 |
| Tỷ lệ trễ nếu SLA = đề xuất 80 và 40 giờ | **4,5%** | **17,9%** |
| SLA cho tỷ lệ trễ khoảng 10% | khoảng 62 giờ (khoảng 8 ngày) | khoảng 52 giờ (khoảng 6,5 ngày) |
| SLA cho tỷ lệ trễ khoảng 15% | khoảng 54 giờ | khoảng 44 giờ |

Diễn giải thận trọng: đây là hệ quả của giả định `[GD]`. Nó cho thấy mức SLA 80 giờ ở Tiếp nhận rất rộng so với thời gian mô phỏng, còn 40 giờ ở Thẩm định hơi chặt. Chỉ dùng để thảo luận, không để chốt SLA nếu chưa khảo sát.

### 15.7. Việc tiếp theo
1. **Khảo sát cán bộ tín dụng** để thay các tham số `[GD]` (trung vị thời gian từng việc, tỷ lệ trả sửa và bổ sung, số tài liệu bổ sung, hàng chờ Thẩm định).
2. Chạy thêm kịch bản đuôi dài (`SIM_SIGMA_QUEUE=1.566`) và độ nhạy theo các tham số giả định.
3. **Huấn luyện** (bước kế tiếp, chưa làm): hai mô hình cho hai công đoạn, gán nhãn theo kịch bản SLA, so sánh Logistic Regression, Random Forest, Gradient Boosting, chia theo `split` của hồ sơ, giải thích nguyên nhân từ mô hình.
4. PO chốt SLA và duyệt đổi hợp đồng `/predict` trước khi tích hợp.
5. Khắc phục CodeGraph (đường dẫn có khoảng trắng) trước khi sửa mã tích hợp; chuyển phần tóm tắt vào `SME_MASTER.md`.

---

## 16. Huấn luyện mô hình v3 (06/11/2026)
Script `ml-service/experiments/v3/train_v3.py`; kết quả `results/metrics_v3.json`; mô hình `models/*.joblib` (4 tệp). Chia train/valid/test theo hồ sơ; chọn mô hình theo PR-AUC trên valid; so Logistic Regression, Random Forest, Gradient Boosting và đường cơ sở "chỉ biết giờ đã dùng". Nhãn = giờ công đoạn vượt SLA. Hai kịch bản SLA (chưa chốt): A = 80/40 giờ (đề xuất PO), B = 54/44 giờ (khoảng 15% trễ).

| Công đoạn / kịch bản | Mô hình tốt nhất | ROC-AUC test | PR-AUC test (tỷ lệ trễ) | Đường cơ sở (AUC) |
|---|---|---|---|---|
| Tiếp nhận, A (80h) | Logistic Regression | 0,775 | 0,481 (0,064) | 0,697 |
| Tiếp nhận, B (54h) | Gradient Boosting | 0,725 | 0,559 (0,196) | 0,665 |
| Thẩm định, A (40h) | Random Forest | 0,783 | 0,683 (0,260) | 0,695 |
| Thẩm định, B (44h) | Gradient Boosting | 0,783 | 0,651 (0,222) | 0,691 |

Nhận xét trung thực:
- Mô hình hơn đường cơ sở 0,03 đến 0,09 AUC. Ba thuật toán gần như ngang nhau, vì dữ liệu giả lập có cấu trúc đơn giản.
- Theo thời điểm: **lúc vào công đoạn (TN_T0, TD_VAO) dự báo yếu** (AUC 0,54 đến 0,65); **sau khi có diễn biến (bổ sung, làm rõ) dự báo tốt** (AUC 0,89 đến 0,93). Giá trị chính của mô hình nằm ở việc cập nhật theo sự kiện, không phải đoán từ đầu.
- Yếu tố quan trọng nhất (hoán vị): giờ đã dùng; sau đó số vòng bổ sung (Tiếp nhận), giờ Tiếp nhận đã tốn và vòng làm rõ (Thẩm định), tải cán bộ. Các trường hồ sơ (số tiền, ngành) ít ảnh hưởng, đúng với cách mô phỏng.
- Con số này đo trên **dữ liệu giả lập do chính tôi sinh**, chỉ chứng minh quy trình và hành vi mô hình; không chứng minh độ chính xác trên dữ liệu ngân hàng thật.
- Chưa tích hợp vào `ml-service` (cần PO chốt SLA và duyệt đổi hợp đồng /predict); chưa cập nhật SME_MASTER.

---

## 17. Mô hình hoàn chỉnh và đánh giá nghiêm ngặt (06/11/2026)
Script `train_final_v3.py` → `results/final_v3.json`, `models/final_*.joblib` (kèm bộ hiệu chỉnh xác suất isotonic và ngưỡng cảnh báo). Thay đổi so với mục 16: bỏ `class_weight` (xác suất không bị lệch), hiệu chỉnh xác suất trên valid, chọn mô hình theo log-loss, đường cơ sở là Logistic Regression chỉ có giờ đã dùng và loại thời điểm, đánh giá theo từng thời điểm và theo hồ sơ.

**Mô hình chọn:** Tiếp nhận = Logistic Regression (cả hai kịch bản); Thẩm định = Gradient Boosting.

| | Tiếp nhận A (80h) | Tiếp nhận B (54h) | Thẩm định A (40h) | Thẩm định B (44h) |
|---|---|---|---|---|
| Brier mô hình / chỉ biết tỷ lệ chung | 0,042 / 0,060 | 0,120 / 0,158 | 0,132 / 0,192 | 0,120 / 0,173 |
| AUC lúc vào (T0 / VAO): mô hình | 0,57 | 0,54 | 0,64 | 0,64 |
| AUC sau diễn biến: mô hình / cơ sở | 0,922 / 0,921 | 0,894 / 0,892 | 0,918 / 0,912 | 0,917 / 0,918 |
| Hồ sơ trễ được cảnh báo kịp (recall) | 32% | 35% | 24% | 31% |
| Độ chính xác cảnh báo | 44% | 46% | 71% | 52% |
| Hồ sơ đúng hạn bị báo nhầm | 1,7% | 6,9% | 2,1% | 5,2% |
| Báo trước hạn (trung vị giờ làm việc) | 28 | 24 | 4,5 | 8 |

**Kết luận trung thực**
- Xác suất sau hiệu chỉnh **khớp thực tế** (các nhóm mười phần trăm: dự báo sát tỷ lệ trễ quan sát), nên hiển thị "xác suất trễ" là hợp lý.
- Sau diễn biến, mô hình **không hơn** đường cơ sở giờ-đã-dùng (chênh dưới 0,01 AUC). Phần gia tăng nhỏ nằm ở lúc vào công đoạn (AUC 0,54 đến 0,64, đường cơ sở là 0,5 vì chưa biết gì) và ở độ chuẩn của xác suất (Brier tốt hơn một chút).
- Theo hồ sơ, cảnh báo bắt được khoảng một phần ba hồ sơ trễ trước hạn; Thẩm định báo trước ngắn (4,5 đến 8 giờ) vì hồ sơ trễ ở đó thường lộ dấu hiệu muộn.
- Nguyên nhân giới hạn: dữ liệu giả lập chỉ có ít yếu tố ẩn giải thích được thời gian, nên trần dự báo thấp. Chỉ dữ liệu thật hoặc khảo sát mới nói được trần thực sự.
- Ngưỡng cảnh báo hiện chọn theo độ chính xác ≥ 50% trên valid, đang chạm cận dưới của dải tìm (0,20 đến 0,32); PO cần chọn cân bằng giữa bắt nhiều và báo nhầm ít.

---

## 18. Mô hình v4 và tích hợp vào hệ thống (06/11/2026)
- `simulate_v4.py` (dòng thời gian: snapshot lúc vào, lúc có sự kiện và mỗi 8 giờ làm việc) → `train_v4.py` (nhận biết SLA, hiệu chỉnh xác suất, hai mức cảnh báo 0,35 và 0,60, bỏ `return_count` vì hệ thống không có số liệu tin cậy) → `results/metrics_v4.json`. Mô hình triển khai: `ml-service/app/model/v4_*.joblib`.
- Kết quả và giới hạn: ghi trong `docs/SME_MASTER.md` mục 5. Lưu ý khi đọc "thu hồi 97%" ở mức Chú ý: đó là tỷ lệ hồ sơ trễ có ít nhất một cảnh báo trước hạn, trong đó nhiều cảnh báo đến muộn (báo trước trung vị 24 giờ Tiếp nhận, 16 giờ Thẩm định ở mức Chú ý; 16 và 8 giờ ở mức Khẩn); không nên trình bày như "đoán trước từ đầu". Lúc mới vào công đoạn mô hình vẫn yếu (AUC 0,53 đến 0,64).
- Tích hợp: `ml-service` (schemas, predictor, main), `backend/src/modules/prediction` (service, `prediction-features.ts`, `prediction-status.ts`), thông báo dự phòng ở hai thành phần giao diện. Không đổi lược đồ DB.
- Kiểm chứng: 392 test backend; kiểm thử đầu-cuối trên DB tạm `sme_e2e` (đã xóa) cho Tiếp nhận PA1, Thẩm định PA1 và công đoạn cách cũ; DB `sme_loan` không bị thay đổi.
- Phát hiện: DB `sme_loan` local đang thiếu cột/enum so với schema (ví dụ `assignment_version`, còn `CAP_TREN`), tức các file SQL trong `backend/prisma` chưa áp dụng; không do đợt này, cần PO/dev áp dụng trước khi demo.
- Còn lại: chấm điểm định kỳ hằng ngày ở backend (chưa làm), kích hoạt PA1 trong DB (PO), CodeGraph chưa chạy được do đường dẫn có khoảng trắng.

## 19. Chấm điểm định kỳ và dữ liệu demo (06/11/2026)
- Thêm `PredictionSchedulerService`: mỗi ngày làm việc 08:00 giờ Việt Nam chấm lại hồ sơ đang mở; 7 test đơn vị; chạy thật chấm 12 hồ sơ (bỏ 2 hồ sơ đang chờ doanh nghiệp); 399 test backend đạt.
- Hồ sơ demo quá khứ (194) và lịch sử SLA: xem `docs/ai/2026-11-04-ke-hoach-sua-sla-va-tai-khoan-mo-phong.md`. Không dùng để huấn luyện lại.
- Đã xóa hai hồ sơ mẫu cũ `SME-20260915-0002`, `SME-20260925-0004` (kèm một thông báo nội bộ) theo yêu cầu của người phụ trách; dự báo v1 đi theo hồ sơ nên DB chỉ còn dự báo v4. Hồ sơ mẫu `SME-20260901-0001` (đã duyệt, không có lịch sử công đoạn) được giữ.

## 20. CodeGraph chạy được sau khi đổi tên thư mục (06/11/2026)
- Nguyên nhân lỗi: `@optave/codegraph` 3.17.0 tìm `package.json` của chính nó bằng `new URL(import.meta.url).pathname` nên không giải mã `%20` khi đường dẫn có dấu cách. Đổi `SME SYSTEM` thành `SME_SYSTEM` thì `graph:build`/`graph:check` đạt (213 file, 4586 nút, 9132 cạnh).
- `fn-impact predictForApplication` (13 hàm phụ thuộc: chuyển công đoạn, bổ sung hồ sơ, tờ trình, chấm định kỳ, controller) và `fn-impact predictionStatusOf` (10 hàm: dashboard, danh sách và chi tiết hồ sơ) khớp phạm vi đã kiểm thử bằng 398 test backend. Lưu ý: CodeGraph không thấy lời gọi qua tham số kiểu `any` ở `assignment.transactions.ts`, đã kiểm riêng bằng test `assignmentPrediction`.
- Đổi tên thư mục đổi tên project Docker Compose; máy này giữ `COMPOSE_PROJECT_NAME=smesystem` trong `.env` để dùng lại volume Postgres cũ.
