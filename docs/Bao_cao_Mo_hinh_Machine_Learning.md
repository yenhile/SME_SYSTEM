# BÁO CÁO KẾT QUẢ NGHIÊN CỨU VÀ HUẤN LUYỆN MÔ HÌNH HỌC MÁY (MACHINE LEARNING)
## BÀI TOÁN DỰ BÁO NGUY CƠ CHẬM TRỄ XỬ LÝ HỒ SƠ VAY VỐN DOANH NGHIỆP NHỎ VÀ VỪA (SME)

- **Đề tài**: Hệ thống quản lý quy trình xét duyệt hồ sơ vay vốn của doanh nghiệp nhỏ và vừa, tích hợp mô hình dự báo nguy cơ chậm xử lý hồ sơ.
- **Tác giả**: Lê Thị Yến Nhi - Voòng Thị Yến Trang | GVHD: TS. Ngô Hữu Dũng
- **Dịch vụ triển khai**: Python 3.12 / FastAPI Service (`ml-service`)

---

## 1. MÔ TẢ BÀI TOÁN & MỤC TIÊU ĐỊNH LƯỢNG

Trong hoạt động xét duyệt tín dụng nội bộ ngân hàng, việc hồ sơ bị chậm trễ tiến độ xử lý so với cam kết chất lượng dịch vụ (**SLA**) thường chỉ được phát hiện khi thời gian đã tiêu tốn gần hết hoặc sự trễ hạn đã xảy ra. 

Mục tiêu của bài toán Học máy là: **Dự báo sớm xác suất một hồ sơ vay đang xử lý có nguy cơ bị trễ hạn SLA ($P(\text{delay}) \ge 0.5$)**, đồng thời **chỉ ra các nguyên nhân cốt lõi (Explainability)** dẫn đến nguy cơ này để Quản lý chi nhánh kịp thời can thiệp hoặc điều chuyển cán bộ phụ trách.

- **Dạng bài toán**: Phân loại nhị phân (Binary Classification).
- **Nhãn mục tiêu ($Y$)**: 
  - $Y = 1$: Hồ sơ bị trễ hạn SLA (Vi phạm thời gian quy định).
  - $Y = 0$: Hồ sơ hoàn thành đúng hạn SLA.

---

## 2. BỘ DỮ LIỆU THỰC NGHIỆM (DATASET)

Do tính bảo mật cao của dữ liệu tín dụng ngân hàng, đề tài xây dựng bộ dữ liệu mô phỏng gồm **3.000 hồ sơ vay SME** dựa trên các quy tắc nghiệp vụ và phân phối thực tế tại các chi nhánh ngân hàng Việt Nam:

- **Quy mô mẫu**: 3.000 hồ sơ.
- **Tỷ lệ phân phối lớp**:
  - Hồ sơ đúng hạn ($Y = 0$): **2.667 mẫu (88.90%)**.
  - Hồ sơ trễ hạn ($Y = 1$): **333 mẫu (11.10%)** (Mô phỏng sát thực tế khoảng 10-15% hồ sơ gặp trục trặc tiến độ).
- **Danh sách 10 biến đặc trưng (Features)**:
  1. `loan_amount`: Số tiền đề xuất vay (VNĐ, từ 500 triệu đến 25 tỷ).
  2. `loan_term_months`: Thời hạn vay (6, 12, 24, 36, 60 tháng).
  3. `loan_type`: Loại vay (`VAY_VON_LUU_DONG`, `VAY_DAU_TU_TSCD`, `THAU_CHI`).
  4. `industry`: Ngành nghề (`San_Xuat`, `Xay_Dung`, `Thuong_Mai_Dich_Vu`, `Nong_Nghiep`, `Van_Tai_Kho_Bai`).
  5. `established_years`: Số năm hoạt động của doanh nghiệp (1 đến 25 năm).
  6. `annual_revenue`: Doanh thu năm gần nhất của doanh nghiệp (VNĐ).
  7. `debt_to_equity`: Tỷ lệ nợ trên vốn chủ sở hữu (Đòn bẩy tài chính).
  8. `supplement_count`: Số lần bị yêu cầu bổ sung chứng từ (0, 1, 2, 3, 4 lần).
  9. `officer_workload`: Tải công việc của cán bộ phụ trách (số hồ sơ đang xử lý đồng thời).
  10. `previous_stage_duration_hours`: Thời gian hồ sơ đã lưu vết ở công đoạn trước (giờ).

---

## 3. TIỀN XỬ LÝ & PHÂN CHIA TẬP DỮ LIỆU

- **Phân chia tập dữ liệu**: 80% Huấn luyện (Train set: 2.400 mẫu) và 20% Kiểm thử (Test set: 600 mẫu), áp dụng kỹ thuật **Stratified Sampling** để đảm bảo tỷ lệ mẫu trễ hạn ở cả 2 tập là đồng nhất.
- **Xử lý đặc trưng**:
  - Đặc trưng số (Numeric): Chuẩn hóa bằng **StandardScaler** ($z = \frac{x - \mu}{\sigma}$).
  - Đặc trưng phân loại (Categorical): Mã hóa nhị phân bằng **One-Hot Encoding**.
- **Xử lý mất cân bằng lớp (Class Imbalance)**: Kích hoạt tham số `class_weight='balanced'` trong cả hai mô hình để điều chỉnh trọng số phạt đối với lớp thiểu số (hồ sơ trễ hạn), giúp mô hình không bị thiên vị về lớp đa số.

---

## 4. KẾT QUẢ HUẤN LUYỆN & SO SÁNH 2 MÔ HÌNH

Hai mô hình học máy được lựa chọn huấn luyện và đối chiếu:
1. **Mô hình 1 (Baseline đối chứng)**: *Logistic Regression* - Mô hình tuyến tính cổ điển, diễn giải đơn giản, tốc độ thực thi nhanh.
2. **Mô hình 2 (Mô hình đề xuất)**: *Random Forest Classifier* - Mô hình học kết hợp (Ensemble Learning) gồm 150 cây quyết định, có khả năng bắt các mối quan hệ phi tuyến tính phức tạp.

### Bảng so sánh hiệu năng trên tập Kiểm thử (Test set - 600 mẫu):

| Chỉ số đánh giá | Logistic Regression (Baseline) | Random Forest Classifier (Đề xuất) | Ý nghĩa nghiệp vụ ngân hàng |
| :--- | :---: | :---: | :--- |
| **Accuracy** (Độ chính xác tổng thể) | 96.67% | **97.00%** | Tỷ lệ dự báo đúng trên toàn bộ tập hồ sơ |
| **Precision** (Độ chuẩn xác) | 77.01% | **82.67%** | Trong số các hồ sơ bị gắn cờ "Trễ", có 82.67% thực sự trễ $\rightarrow$ **Giảm tối đa báo động giả** |
| **Recall** (Độ nhạy) | **100.00%** | **92.54%** | Khả năng phát hiện hồ sơ trễ $\rightarrow$ **Không bỏ sót các hồ sơ nguy cơ cao** |
| **F1-Score** (Trung bình điều hòa) | 87.01% | **87.32%** | Cân bằng tối ưu giữa Precision và Recall |
| **ROC-AUC** (Diện tích dưới đường cong ROC) | **99.82%** | **99.27%** | Khả năng phân biệt cực kỳ xuất sắc giữa 2 lớp |

### Biện luận lựa chọn mô hình:
Mặc dù Logistic Regression đạt Recall tuyệt đối, nhưng độ chuẩn xác (Precision) của nó chỉ đạt **77.01%** (gây ra nhiều cảnh báo giả, làm phiền người quản lý chi nhánh). 

**Random Forest Classifier** đạt **Precision vượt trội (82.67%)** đồng thời vẫn duy trì **Recall rất cao (92.54%)** và **F1-Score cao nhất (87.32%)**. Do đó, Random Forest được lựa chọn làm mô hình chính thức triển khai vào dịch vụ `ml-service`.

---

## 5. TẦM QUAN TRỌNG CỦA CÁC ĐẶC TRƯNG (FEATURE IMPORTANCE & XAI)

Mô hình Random Forest cung cấp cơ chế trích xuất độ quan trọng của đặc trưng (**Feature Importance**), giúp giải thích nguyên nhân gây trễ hạn một cách minh bạch (Explainable AI - XAI):

```
Tầm quan trọng của các yếu tố ảnh hưởng đến Nguy cơ Trễ hạn SLA:
1. supplement_count              [██████████████████████████████] 67.13%
2. officer_workload              [████]                           7.77%
3. annual_revenue                [██]                             5.26%
4. loan_amount                   [██]                             4.81%
5. previous_stage_duration_hours [█]                              3.75%
6. established_years             [█]                              2.85%
7. industry (Xây dựng)           [█]                              2.42%
8. debt_to_equity                [█]                              2.15%
```

### Kết luận ý nghĩa thực tiễn:
1. **Số lần yêu cầu bổ sung chứng từ (`supplement_count`: 67.13%)** là nguyên nhân số 1 gây trễ hạn tiến độ xét duyệt. Khi một hồ sơ phải yêu cầu bổ sung từ 2 lần trở lên, xác suất trễ SLA tăng vọt lên trên 80%.
2. **Tải công việc của cán bộ (`officer_workload`: 7.77%)** là yếu tố quan trọng thứ 2. Cán bộ phụ trách trên 10 hồ sơ đồng thời có xu hướng phản hồi chậm hơn, là căn cứ trực tiếp để Quản lý chi nhánh thực hiện nghiệp vụ **Điều chuyển hồ sơ (UC18)**.
3. Các yếu tố về ngành nghề (`Xay_Dung`) và quy mô khoản vay lớn đóng vai trò làm phức tạp thêm quá trình thẩm định phương án.

---

## 6. ĐÓNG GÓI & TÍCH HỢP HỆ THỐNG

- Mô hình Random Forest đã được tuần tự hóa và lưu tại: `ml-service/app/model/delay_model.joblib`.
- Metadata và bảng đối sánh được lưu tại: `ml-service/app/model/model_metadata.json`.
- Giao diện REST API của `ml-service`:
  - `GET /health`: Kiểm tra trạng thái nạp mô hình.
  - `GET /metadata`: Cung cấp thông số đánh giá cho Dashboard.
  - `POST /predict`: Tiếp nhận vector đặc trưng của hồ sơ $\rightarrow$ Trả về xác suất trễ, nhãn nguy cơ và **Top 3 nguyên nhân giải thích cụ thể**.
