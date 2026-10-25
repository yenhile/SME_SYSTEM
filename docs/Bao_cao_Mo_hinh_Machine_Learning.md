# Báo cáo đánh giá mô hình Machine Learning — dự báo nguy cơ trễ SLA

Phiên bản mô hình: `v1.0-rf`. Ngày lập: 24/10/2026. Phạm vi: DEC-04 (dữ liệu synthetic; ML chỉ cảnh báo sớm nguy cơ trễ SLA, không ra quyết định tín dụng).

## 1. Mục đích và phạm vi sử dụng

Mô hình ước lượng **xác suất một hồ sơ vay trễ định mức thời gian xử lý (SLA)** để cán bộ và quản lý ưu tiên theo dõi. Mô hình **không** dự báo khả năng trả nợ, nợ xấu hay điều kiện duyệt/từ chối vay, và kết quả không được dùng để tự động duyệt hoặc từ chối hồ sơ. Việc phê duyệt vẫn do người có thẩm quyền quyết định theo quy trình.

## 2. Dữ liệu

Toàn bộ dữ liệu là **dữ liệu tổng hợp (synthetic)** do `ml-service/scripts/generate_synthetic_data.py` sinh ra, cố định hạt giống 42, không có dữ liệu khách hàng thật. Tệp `ml-service/data/synthetic_loan_delay_dataset.csv` được kiểm tra là tái tạo được chính xác từ script (tham số `n_samples=3000`, `random_state=42`).

| Mục | Giá trị |
|---|---|
| Số mẫu | 3.000 |
| Hồ sơ trễ (nhãn 1) | 333 (11,1%) |
| Hồ sơ đúng hạn (nhãn 0) | 2.667 (88,9%) |
| Tập huấn luyện / kiểm thử | 2.400 / 600, chia 80/20, phân tầng theo nhãn, `random_state=42` |
| Hồ sơ trễ trong tập kiểm thử | 67 |

**Đặc trưng đầu vào (10):** số tiền vay, thời hạn vay (tháng), số năm hoạt động, doanh thu năm, tỷ lệ nợ/vốn chủ (`debt_to_equity`), số lần yêu cầu bổ sung (`supplement_count`), tải công việc của cán bộ (`officer_workload`), thời gian lưu ở công đoạn tiếp nhận (giờ), loại vay, ngành.

**Cách tạo nhãn.** Nhãn `is_delayed` không đến từ hồ sơ thật. Script tính một giá trị logit từ chính các đặc trưng trên rồi cộng nhiễu ngẫu nhiên (chuẩn, độ lệch 0,35), đổi sang xác suất và gán nhãn trễ khi xác suất ≥ 0,5:

`logit = -3,4 + 1,35·supplement_count + 0,16·(officer_workload − 6) + 0,45·[ngành Xây dựng] + 0,35·[vay đầu tư TSCĐ] + 0,06·(số tiền vay/1 tỷ) + 0,12·(thời gian tiếp nhận − 4) − 0,04·số năm hoạt động + nhiễu`

Các đặc trưng **không** tham gia công thức này: thời hạn vay, `debt_to_equity`, các ngành còn lại; doanh thu năm được sinh từ số tiền vay. Ghi chú trong script nêu tỷ lệ trễ kỳ vọng 12–14%, thực tế sinh ra là 11,1%.

## 3. Mô hình

Hai mô hình được huấn luyện cùng pipeline tiền xử lý (chuẩn hóa số, one-hot cho biến phân loại):

| Mô hình | Cấu hình |
|---|---|
| Logistic Regression (cơ sở) | `class_weight='balanced'`, `max_iter=1000` |
| Random Forest (đang triển khai) | 150 cây, `max_depth=8`, `class_weight='balanced'` |

Mô hình triển khai là Random Forest (`ml-service/app/model/delay_model.joblib`). Ngưỡng dự đoán trễ là 0,5. Mức nguy cơ hiển thị: THẤP (< 0,40), TRUNG BÌNH (0,40–0,70), CAO (≥ 0,70).

## 4. Kết quả

### 4.1. Tập kiểm thử (600 mẫu, 67 hồ sơ trễ)

| Mô hình | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Luôn dự đoán "đúng hạn" (mốc so sánh) | 0,8883 | — | 0,0000 | — | — |
| Logistic Regression | 0,9667 | 0,7701 | 1,0000 | 0,8701 | 0,9982 |
| **Random Forest** | **0,9700** | **0,8267** | **0,9254** | **0,8732** | **0,9927** |

Ma trận nhầm lẫn (tập kiểm thử):

| | Dự đoán đúng hạn | Dự đoán trễ |
|---|---|---|
| **Logistic Regression** — thực tế đúng hạn | 513 | 20 |
| **Logistic Regression** — thực tế trễ | 0 | 67 |
| **Random Forest** — thực tế đúng hạn | 520 | 13 |
| **Random Forest** — thực tế trễ | 5 | 62 |

Số liệu trên khớp hoàn toàn với `model_metadata.json` đã lưu, và mô hình đã lưu cho kết quả giống hệt trên cùng tập kiểm thử. Brier score của Random Forest là 0,0322.

### 4.2. Kiểm định chéo 5 lớp (toàn bộ 3.000 mẫu, trung bình ± độ lệch chuẩn)

| Mô hình | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 0,9620 ± 0,0053 | 0,7567 ± 0,0281 | 0,9730 ± 0,0174 | 0,8508 ± 0,0162 | 0,9953 ± 0,0015 |
| Random Forest | 0,9597 ± 0,0073 | 0,7646 ± 0,0320 | 0,9219 ± 0,0372 | 0,8355 ± 0,0290 | 0,9866 ± 0,0030 |

### 4.3. Ảnh hưởng của ngưỡng (Random Forest, tập kiểm thử)

| Ngưỡng | Precision | Recall | F1 |
|---|---|---|---|
| 0,3 | 0,5982 | 1,0000 | 0,7486 |
| 0,4 | 0,7143 | 0,9701 | 0,8228 |
| **0,5 (đang dùng)** | 0,8267 | 0,9254 | 0,8732 |
| 0,6 | 0,8889 | 0,8358 | 0,8615 |
| 0,7 | 0,9434 | 0,7463 | 0,8333 |

Hạ ngưỡng giúp bắt thêm hồ sơ trễ (recall tăng) nhưng tạo thêm cảnh báo sai (precision giảm). Việc chọn ngưỡng là quyết định vận hành, chưa được PO chốt.

### 4.4. Tỷ lệ trễ thực tế theo mức nguy cơ (Random Forest, tập kiểm thử)

| Mức nguy cơ | Số hồ sơ | Tỷ lệ trễ thực tế |
|---|---|---|
| THẤP (< 0,40) | 509 | 0,4% |
| TRUNG BÌNH (0,40–0,70) | 38 | 39,5% |
| CAO (≥ 0,70) | 53 | 94,3% |

Trên dữ liệu synthetic này, mức nguy cơ phân tách khá rõ. Điều này chưa chứng minh hiệu quả trên dữ liệu thật (xem mục 6).

## 5. Đặc trưng quan trọng

| Đặc trưng | Độ quan trọng lưu trong mô hình (impurity) | Mức giảm ROC-AUC khi xáo trộn (permutation, tập kiểm thử) |
|---|---|---|
| `supplement_count` | 0,6713 | 0,3766 ± 0,0374 |
| `officer_workload` | 0,0777 | 0,0254 ± 0,0058 |
| `annual_revenue` | 0,0526 | 0,0040 ± 0,0011 |
| `loan_amount` | 0,0481 | 0,0037 ± 0,0011 |
| `previous_stage_duration_hours` | 0,0375 | 0,0034 ± 0,0013 |
| `debt_to_equity` | 0,0321 | −0,0005 ± 0,0005 |
| `established_years` | 0,0288 | 0,0038 ± 0,0006 |
| `loan_term_months` | 0,0141 | 0,0003 ± 0,0005 |

Hai cách đo cùng cho thấy `supplement_count` chi phối kết quả. Khi **loại bỏ** đặc trưng này và huấn luyện lại, ROC-AUC của Random Forest tụt từ 0,9927 xuống **0,6590** và F1 từ 0,8732 xuống 0,2805. Cách đo impurity còn đánh giá cao `debt_to_equity` và `annual_revenue` dù ảnh hưởng thực tế gần bằng 0; nên ưu tiên số liệu permutation khi giải thích mô hình.

## 6. Giới hạn (cần nêu khi thuyết minh)

1. **Vòng tròn giữa dữ liệu và nhãn.** Nhãn được tạo bằng công thức từ chính các đặc trưng (mục 2), nên mô hình chỉ học lại công thức đó. Các chỉ số cao (ROC-AUC 0,99) đo khả năng khôi phục luật do người viết script đặt ra, **không** đo khả năng dự báo trễ SLA của hồ sơ thật. Không được suy ra chất lượng thực tế từ các con số này.
2. **Random Forest không vượt Logistic Regression.** Do nhãn sinh từ công thức tuyến tính theo logit, Logistic Regression đạt ROC-AUC và F1 bằng hoặc cao hơn (tập kiểm thử và kiểm định chéo). Chênh lệch F1 giữa hai mô hình nằm trong sai số kiểm định chéo; chênh lệch ROC-AUC nhỏ (0,9953 so với 0,9866) nhưng nghiêng về Logistic Regression. Vì vậy chưa có cơ sở để nói Random Forest "tốt hơn" trên dữ liệu này.
3. **Mẫu kiểm thử nhỏ.** Tập kiểm thử chỉ có 67 hồ sơ trễ; một lần chia dữ liệu cho độ bất định lớn. Trên 5 bộ dữ liệu sinh với hạt giống khác (cùng công thức), F1 của Random Forest dao động 0,7559–0,8435 và ROC-AUC 0,9837–0,9919.
4. **Phụ thuộc vào một đặc trưng.** Dự báo gần như chỉ dựa vào số lần yêu cầu bổ sung (mục 5). Nếu thực tế khác công thức sinh dữ liệu, mô hình sẽ kém đi rõ rệt.
5. **Đầu vào khi vận hành khác dữ liệu huấn luyện.** Backend tính `debt_to_equity` bằng số tiền đề nghị vay chia vốn điều lệ, trong khi dữ liệu huấn luyện sinh ngẫu nhiên khoảng 0,4–4,5 theo nghĩa tỷ lệ nợ/vốn chủ. Vì mô hình hầu như không dùng đặc trưng này (mục 5) nên tác động hiện nhỏ, nhưng định nghĩa cần thống nhất nếu huấn luyện lại. Ngành nghề của doanh nghiệp cũng được ánh xạ về 5 nhóm cố định.
6. **Lý do hiển thị chưa phải giải thích của mô hình.** Phần "nguyên nhân" trong kết quả dự báo là các quy tắc cố định viết sẵn trong `predictor.py` (ví dụ ngưỡng số lần bổ sung, tải cán bộ, tỷ lệ phần trăm ghi trong câu chữ), không do mô hình hay SHAP tính ra, và không phải quan hệ nhân quả.
7. **Chưa có dữ liệu vận hành thật** để kiểm định lại, không có đánh giá về độ lệch theo nhóm doanh nghiệp, và mô hình chưa được cập nhật theo thời gian.

## 7. Phạm vi sử dụng và nguyên tắc AI

- Mô hình chỉ **cảnh báo sớm nguy cơ trễ SLA**; mọi quyết định cấp tín dụng do con người đưa ra theo quy trình.
- Khi dịch vụ ML lỗi, hệ thống báo lỗi thật và không thay bằng xác suất giả; lỗi ML không làm hồi lại bước nghiệp vụ đã hoàn tất.
- Không dùng kết quả này làm căn cứ từ chối hoặc ưu tiên duyệt hồ sơ.
- Muốn dùng trong nghiệp vụ thực tế cần: dữ liệu vận hành thật, nhãn trễ SLA đo từ lịch sử công đoạn, kiểm định trên dữ liệu chưa từng dùng để huấn luyện, và phê duyệt của PO.

## 8. Cách tái lập số liệu

Số liệu trong báo cáo được tạo bằng script chỉ đọc `ml-service/scripts/evaluate_model.py` (không ghi đè mô hình hay metadata đã lưu), chạy trong container `ml-service` với Python 3.12.15, scikit-learn 1.9.1, pandas 3.1.0, numpy 2.5.4:

```
python ml-service/scripts/evaluate_model.py > evaluation_result.json
```

Cần có `pandas`, `scikit-learn` và `joblib` (xem `ml-service/requirements.txt`). Chạy lại có thể khác số lẻ nhỏ nếu phiên bản thư viện khác. Hạt giống đã cố định, kết quả trên cùng phiên bản thư viện là lặp lại được.
