# Mô hình dự báo nguy cơ trễ SLA (v4.0): giải thích từ A đến Z

Tài liệu này giải thích mô hình và dữ liệu dùng để huấn luyện, viết cho người **chưa quen học máy** nhưng cần hiểu, vận hành hoặc sửa phần liên quan (kể cả người phụ trách SLA). Mọi con số lấy từ `app/model/model_metadata.json`, `experiments/v3/results/metrics_v4.json` và mã nguồn hiện hành; chỗ nào là giả định hoặc chưa kiểm chứng đều ghi rõ.

Cập nhật: 09/11/2026. Trạng thái và quyết định của dự án nằm ở [docs/SME_MASTER.md](../docs/SME_MASTER.md) mục 5.

---

## 1. Đọc nhanh (một trang)

- **Mô hình trả lời đúng một câu hỏi:** "Hồ sơ đang ở công đoạn *Tiếp nhận* hoặc *Thẩm định* này có nguy cơ **không kịp hạn SLA** không?" Kết quả là một xác suất từ 0 đến 1 kèm tối đa 3 lý do vận hành.
- **Mô hình KHÔNG làm:** không chấm điểm tín dụng, không gợi ý cho vay hay từ chối, không quyết định gì thay con người. Doanh nghiệp không bao giờ thấy cảnh báo này.
- **Hai mô hình nhỏ**, mỗi công đoạn một cái (`v4_tiep_nhan.joblib`, `v4_tham_dinh.joblib`), chạy trong dịch vụ FastAPI `ml-service` (cổng 8000). Backend gọi `POST /predict`, lưu kết quả vào bảng `delay_predictions`, giao diện đọc ra.
- **Dữ liệu huấn luyện là dữ liệu GIẢ LẬP** (20.000 hồ sơ do chương trình `simulate_v4.py` sinh ra), hình dạng thời gian chờ lấy theo một bộ dữ liệu công khai (BPI Challenge 2012). **Không có dữ liệu thật của ngân hàng.** Điều này quyết định mức độ tin cậy; xem mục 9.
- **Mô hình chỉ hơn "đồng hồ SLA đơn thuần" một chút** (AUC 0,82 so với 0,80 ở Tiếp nhận; 0,72 so với 0,69 ở Thẩm định). Giá trị chính là: xác suất có hiệu chỉnh, lý do kèm theo, và đổi SLA không cần huấn luyện lại.
- **Mức cảnh báo:** Bình thường (xác suất dưới 35%), Chú ý (từ 35%), Khẩn (từ 60%), Quá hạn (đã vượt SLA, tính trực tiếp). **Riêng Thẩm định không dùng mức Chú ý** (mục 8.3).
- **Không cần huấn luyện lại** khi đổi SLA trong khoảng 24–128 giờ (Tiếp nhận) hoặc 16–80 giờ (Thẩm định). Ngoài khoảng đó mô hình từ chối dự báo.

---

## 2. Bài toán, nói bằng lời thường

Mỗi hồ sơ vay đi qua các công đoạn; mỗi công đoạn có hạn SLA tính bằng **giờ làm việc** của ngân hàng (thứ Hai đến thứ Sáu, 08:00–12:00 và 13:00–17:00; thời gian chờ doanh nghiệp bổ sung bị trừ ra). Hiện hành: Tiếp nhận 112 giờ, Thẩm định 40 giờ, Hoàn tất 8 giờ (không dự báo).

Quản lý chi nhánh không thể ngồi canh từng hồ sơ. Ý tưởng: tại mỗi thời điểm, nhìn vào "hồ sơ này đã dùng bao nhiêu giờ, còn bao nhiêu giờ, tính chất hồ sơ ra sao, cán bộ đang bận cỡ nào, hàng chờ dài cỡ nào" rồi ước lượng **xác suất cuối cùng hồ sơ sẽ vượt SLA**. Nếu xác suất cao thì nhắc Quản lý can thiệp (giao lại, đẩy nhanh) **trước khi** trễ thật.

Hai khái niệm cần phân biệt:
- **Quá hạn:** đã vượt SLA. Đây là sự thật, backend tính trực tiếp theo thời gian thực, không cần mô hình (`slaOverdue`).
- **Nguy cơ trễ:** chưa vượt nhưng có khả năng sẽ vượt. Đây mới là việc của mô hình.

---

## 3. Dữ liệu huấn luyện

### 3.1. Vì sao phải giả lập
Hệ thống chưa chạy thật nên chưa có lịch sử xử lý hồ sơ. Để vẫn huấn luyện và trình diễn được, nhóm dùng một **bộ mô phỏng** (`experiments/v3/simulate_v4.py`) sinh ra hồ sơ và dòng thời gian xử lý. Hệ quả cần nhớ: mô hình học "quy luật mà người viết bộ mô phỏng đã cài vào", không phải quy luật của ngân hàng thật.

### 3.2. Các tham số được lấy từ đâu
Mỗi tham số trong mã được gắn một trong ba nhãn:
- **[BPIC]**: rút từ BPI Challenge 2012 (nhật ký xử lý hồ sơ vay thật của một ngân hàng Hà Lan, công khai). Chỉ lấy **hình dạng phân phối** của thời gian chờ (độ lệch chuẩn log, độ nhạy theo hàng đợi, tỷ lệ hồ sơ cần theo dõi bổ sung 22,4%), lưu ở `params/bpic2012_params.json`. Không có dữ liệu hồ sơ nào của BPIC trong repo.
- **[HT]**: theo hệ thống SME (ví dụ trần 10 tỷ, các giá trị `businessScope`, `collateral.mode`).
- **[GD]**: **giả định** do nhóm đặt (ví dụ trung vị thời gian xử lý từng việc, tỷ trọng các loại hồ sơ). Các giá trị này **cần khảo sát cán bộ tín dụng thật để xác nhận**; đây là điểm yếu lớn nhất của dữ liệu.

### 3.3. Một hồ sơ mô phỏng được sinh ra như thế nào
Với mỗi trong 20.000 hồ sơ (hạt giống cố định 2026, chạy lại cho cùng kết quả):
1. **Thông tin hồ sơ và doanh nghiệp:** số tiền (lognormal, 0,01–10 tỷ), thời hạn (3/6/9/12 tháng), ngành (`SAN_XUAT`, `THUONG_MAI`, `DICH_VU`, `KHAC`), số năm hoạt động, doanh thu, có nợ hiện có hay không, chế độ tài sản bảo đảm (`PROPOSED`, `NONE_REQUESTED`, `UNDECIDED`), số lần bị trả sửa trước khi tiếp nhận.
2. **Tải cán bộ:** số hồ sơ cán bộ tín dụng đang giữ (Poisson quanh 7).
3. **Biến ẩn (cố ý không đưa vào mô hình):** tốc độ của cán bộ tín dụng, tốc độ của Thẩm quyền, độ phức tạp thực của hồ sơ. Mục đích: để mô hình không đạt điểm cao một cách giả tạo vì "biết hết".
4. **Công đoạn Tiếp nhận:** chờ đến lượt xử lý, xử lý ban đầu, rồi 0 đến 4 vòng yêu cầu bổ sung (mỗi vòng: doanh nghiệp phản hồi, cán bộ chờ đến lượt, kiểm tra từng tài liệu), cuối cùng xác định hạn mức và lập tờ trình. Kết quả là **tổng giờ ngân hàng ở Tiếp nhận** (thời gian doanh nghiệp chờ bổ sung chỉ ghi riêng, không tính).
5. **Công đoạn Thẩm định:** số Thẩm quyền hoạt động (**2 hoặc 3, xác suất bằng nhau**), số hồ sơ đang chờ ở Thẩm định (Poisson quanh 4), chờ đến lượt, thẩm định, 0 đến 3 vòng làm rõ (Thẩm quyền yêu cầu, cán bộ tín dụng giải trình trong lúc SLA vẫn chạy, Thẩm quyền xem lại), quyết định. Kết quả là **tổng giờ ở Thẩm định**.

### 3.4. Từ hồ sơ đến dòng dữ liệu: "ảnh chụp theo dòng thời gian"
Mô hình phải dự báo ở **nhiều thời điểm** của cùng một hồ sơ, đúng như lúc vận hành. Vì vậy mỗi hồ sơ sinh ra nhiều dòng, mỗi dòng là một "ảnh chụp" tại một thời điểm hồ sơ còn đang mở:
- lúc vào công đoạn (`TN_T0` hoặc `TD_VAO`);
- mỗi khi có sự kiện (doanh nghiệp nộp bổ sung, Thẩm quyền yêu cầu làm rõ);
- đầu mỗi ngày làm việc (mỗi 8 giờ) khi hồ sơ còn mở, giống lượt chấm định kỳ.

Quy mô thực tế của bộ dữ liệu v4:

| Tệp | Số dòng | Nội dung |
|---|---|---|
| `cases_v4.csv` | 20.000 | một dòng mỗi hồ sơ, kèm tổng giờ từng công đoạn |
| `tiep_nhan_timeline_v4.csv` | 106.705 | ảnh chụp ở Tiếp nhận |
| `tham_dinh_timeline_v4.csv` | 83.629 | ảnh chụp ở Thẩm định |
| `generation_config_v4.json` | | hạt giống, số lượng, toàn bộ tham số (có trong git) |

Các tệp CSV **không nằm trong git** (bị `.gitignore`, khoảng vài chục MB); chạy lại `simulate_v4.py` để tạo, kết quả giống hệt do hạt giống cố định.

### 3.5. Nhãn (đáp án) và cách chia dữ liệu
- **Nhãn của một dòng:** `y = 1` nếu *tổng giờ cuối cùng của công đoạn lớn hơn SLA*, ngược lại `y = 0`. Tức là mô hình học dự đoán "cuối cùng có trễ không" từ thông tin tại thời điểm chụp.
- **Điểm quan trọng: nhãn được gán sau, theo một mức SLA tham số.** Mỗi dòng huấn luyện được gán một mức SLA lấy ngẫu nhiên từ một lưới (Tiếp nhận: 24, 32, 40, 48, 56, 64, 80, 96, 112, 128 giờ; Thẩm định: 16, 24, 32, 40, 48, 56, 64, 80 giờ). Nhờ vậy mô hình **biết SLA là một đầu vào**, và lúc vận hành chỉ cần truyền SLA hiện hành (ví dụ Admin đổi 112 thành 100) mà **không phải huấn luyện lại**.
- **Chỉ dùng dòng còn trong hạn** (giờ đã dùng nhỏ hơn SLA). Hồ sơ đã quá hạn là chuyện đã biết, không cần dự đoán.
- **Chia dữ liệu theo hồ sơ, không theo dòng:** băm mã hồ sơ để chia train 70%, valid 15%, test 15%. Nhờ vậy các ảnh chụp của cùng một hồ sơ không bao giờ nằm ở hai tập khác nhau (nếu chia theo dòng thì mô hình "học thuộc" hồ sơ và điểm kiểm tra cao giả tạo).

### 3.6. Từ điển dữ liệu (các cột của bảng ảnh chụp)

Cột dùng chung cho cả hai công đoạn:

| Cột | Ý nghĩa | Nguồn trong hệ thống |
|---|---|---|
| `case_id`, `split` | Mã hồ sơ mô phỏng, tập train/valid/test | |
| `proposed_amount_billion` | Số tiền đề nghị (tỷ đồng) | `proposedAmount` (hoặc `officialAmount` nếu đã có) |
| `loan_term_months` | Thời hạn vay | `loanTermMonths` |
| `business_scope` | Ngành: `SAN_XUAT`, `THUONG_MAI`, `DICH_VU`, `KHAC` | `businessScope` của form V2 (hồ sơ cũ suy từ tên ngành) |
| `established_years` | Số năm hoạt động | năm hiện tại trừ `establishedYear` |
| `annual_revenue_billion` | Doanh thu năm (tỷ đồng) | `annualRevenue` |
| `has_existing_debt` | Có dư nợ hiện có (0/1) | `hasExistingDebt` |
| `collateral_mode` | `PROPOSED`, `NONE_REQUESTED`, `UNDECIDED` | `collateral.mode` |
| `return_count` | Số lần bị trả sửa (có trong dữ liệu **nhưng không dùng làm đặc trưng**) | |
| `point` | Điểm chụp (`TN_T0`, `TN_EV`, `TN_D`, `TD_VAO`, `TD_EV`, `TD_D`) | |
| `elapsed_hours` | Giờ làm việc ngân hàng đã dùng ở công đoạn tại lúc chụp | tính bằng lịch làm việc + trừ thời gian tạm dừng |
| `hours_since_last_event` | Giờ làm việc kể từ thao tác gần nhất | thao tác gần nhất trong công đoạn |
| `stage_hours_total` | **Đáp án:** tổng giờ cuối cùng của công đoạn (chỉ dùng để gán nhãn, không phải đầu vào) | |

Riêng Tiếp nhận: `supplement_rounds_so_far` (số vòng bổ sung đã có), `items_pending_review` (số tài liệu bổ sung đang chờ kiểm tra), `officer_workload` (số hồ sơ cán bộ tín dụng đang giữ).

Riêng Thẩm định: `supplement_rounds_total` (số vòng bổ sung ở Tiếp nhận), `tn_bank_hours` (giờ đã tốn ở Tiếp nhận), `appraisal_queue_len` (số hồ sơ đang chờ ở Thẩm định), `appraisers_active` (số Thẩm quyền hoạt động), `clarify_rounds_so_far` (số lần đã làm rõ), `clarify_open` (đang có yêu cầu làm rõ chưa xử lý xong, 0/1).

---

## 4. Mô hình học

### 4.1. Cấu trúc
- **Hai mô hình riêng**, mỗi công đoạn một cái, vì hai công đoạn có đặc trưng khác nhau.
- **Đầu vào:** các cột ở mục 3.6 (trừ đáp án) cộng ba đại lượng thời gian: giờ đã dùng, SLA, giờ còn lại. Đặc trưng dạng chữ (ngành, tài sản bảo đảm) được mã hóa one-hot; số được chuẩn hóa (với mô hình tuyến tính).
- **Đầu ra:** xác suất vượt SLA, sau đó **hiệu chỉnh**.

### 4.2. Chọn thuật toán
Mỗi công đoạn thử hai thuật toán và chọn cái có **log-loss thấp hơn trên tập valid** (sau hiệu chỉnh):
- Logistic Regression: đơn giản, dễ giải thích.
- Gradient Boosting (`HistGradientBoostingClassifier`): mạnh hơn khi có quan hệ phi tuyến.

| Công đoạn | Log-loss valid (LR / GB) | Được chọn |
|---|---|---|
| Tiếp nhận | 0,3738 / 0,3638 | Gradient Boosting |
| Thẩm định | 0,4557 / 0,4585 | Logistic Regression |

Chênh lệch nhỏ, nghĩa là dữ liệu mô phỏng không có cấu trúc phi tuyến phức tạp.

### 4.3. Hiệu chỉnh xác suất (isotonic)
Đầu ra thô của thuật toán chưa chắc là xác suất đúng nghĩa ("0,6" chưa chắc là 60% thật). Mô hình học thêm một **bộ hiệu chỉnh isotonic** trên tập valid để "nếu nói 60% thì khoảng 60% hồ sơ như vậy thực sự trễ". Điều này quan trọng vì người dùng đọc con số như một xác suất.

### 4.4. Đường cơ sở (baseline) để so sánh trung thực
Để biết mô hình có đáng không, so với một mô hình đơn giản **chỉ biết giờ đã dùng, SLA và giờ còn lại** (không biết gì về hồ sơ, tải, bổ sung). Nếu mô hình chỉ ngang đường cơ sở thì phần "thông minh" không có giá trị. Kết quả ở mục 5.

### 4.5. Ngưỡng cảnh báo
Hai ngưỡng trên xác suất đã hiệu chỉnh: **Chú ý từ 0,35**, **Khẩn từ 0,60**. Đây là lựa chọn của dự án, không phải kết quả tối ưu hóa. Chúng nằm trong tệp mô hình (`thresholds`) và trong `model_metadata.json`.

### 4.6. Tệp mô hình
Mỗi tệp `.joblib` là một "gói" gồm: pipeline đã huấn luyện, bộ hiệu chỉnh, danh sách đặc trưng, giá trị tham chiếu (trung vị/giá trị phổ biến, dùng để giải thích), lưới SLA, ngưỡng, phiên bản.
**Lưu ý vận hành:** tệp `.joblib` phụ thuộc phiên bản `scikit-learn`; `requirements.txt` chỉ ghim khoảng (`>=1.6,<2.0`). Image hiện tại dùng scikit-learn **1.9.1** (kiểm tra ngày 09/11/2026). Nếu dựng lại image với phiên bản khác nhiều thì tải mô hình có thể lỗi hoặc cho kết quả khác. Khi đó huấn luyện lại bằng đúng phiên bản đang dùng.

---

## 5. Kết quả đo được (trên tập test, dữ liệu giả lập)

Mỗi công đoạn được đo ở nhiều cấu hình SLA. Cấu hình đang chạy của hệ thống là **Tiếp nhận 112 giờ, Thẩm định 40 giờ** (kịch bản `C_112_40`).

| | Tiếp nhận (SLA 112) | Thẩm định (SLA 40) |
|---|---|---|
| Tỷ lệ dòng trễ trong tập test | 3,66% | 28,74% |
| Số hồ sơ test / số hồ sơ trễ | 3.016 / 38 | 3.016 / 534 |
| AUC mô hình | **0,824** | **0,720** |
| AUC đường cơ sở | 0,797 | 0,687 |
| Brier mô hình / nếu đoán theo tỷ lệ chung | 0,0280 / 0,0353 | 0,1765 / 0,2048 |
| AUC ngay lúc vào công đoạn (`TN_T0`, `TD_VAO`) | **0,557** | **0,634** |
| Báo trước trung vị khi vượt ngưỡng Chú ý | 24,5 giờ | 16 giờ |
| Báo trước trung vị khi vượt ngưỡng Khẩn | 16 giờ | 8,2 giờ |
| Mức Khẩn: độ chính xác / bắt được ca trễ | 78,4% / 76,3% | 57,7% / 86,5% |
| Mức Chú ý: độ chính xác / bắt được ca trễ | 47,4% / 94,7% | 41,2% / 96,8% |
| Báo nhầm trên hồ sơ đúng hạn (Khẩn / Chú ý) | 0,3% / 1,3% | 13,7% / 29,7% |

Cách đọc:
- **AUC** đo khả năng xếp hồ sơ trễ lên trước hồ sơ đúng hạn (0,5 là đoán bừa, 1 là hoàn hảo). 0,82 và 0,72 là mức khá, không phải xuất sắc.
- **Hơn đường cơ sở chỉ một chút** (cộng khoảng 0,03): phần lớn sức mạnh đến từ đồng hồ SLA, không phải từ thông tin hồ sơ.
- **Lúc vừa vào công đoạn, mô hình gần như không phân biệt được** (AUC 0,557 ở Tiếp nhận). Vì vậy hồ sơ vừa tiếp nhận hầu như luôn hiện "Bình thường": đây là bản chất của dữ liệu, không phải lỗi.
- **Tiếp nhận ở SLA 112 giờ chỉ có 38 hồ sơ trễ trong tập test**, nên các con số của Tiếp nhận (độ chính xác, bắt ca trễ) **nhiễu**, đừng đọc quá chính xác.
- Độ tin cậy (calibration) theo từng phân vị nằm trong `metrics_v4.json` (`calibration_deciles`).

---

## 6. Cách mô hình giải thích lý do

Mỗi cảnh báo kèm tối đa 3 lý do. Cách tính (`predictor.py`, hàm `_reasons`): với từng yếu tố, **thay giá trị của hồ sơ bằng giá trị điển hình** (trung vị khi huấn luyện) rồi xem xác suất giảm bao nhiêu. Yếu tố nào làm xác suất giảm từ 5 điểm phần trăm trở lên thì được nêu, kèm mức "ảnh hưởng lớn" (từ 25 điểm), "vừa" (từ 10), "nhỏ".
- Nhóm thời gian (đã dùng bao nhiêu giờ, còn bao nhiêu) được gộp thành một lý do.
- **Doanh thu, số năm hoạt động, thời hạn vay không bao giờ được nêu làm lý do** (`NOT_REASONS`): trong dữ liệu mô phỏng chúng không gây chậm, chỉ là nhiễu, nêu ra sẽ gây hiểu nhầm.
- Chỉ giải thích khi xác suất từ 10% trở lên; dưới mức đó ghi "Chưa có yếu tố nào làm tăng đáng kể nguy cơ trễ SLA".
- **Cảnh giác:** đây là giải thích "mô hình dựa vào gì", không chứng minh quan hệ nhân quả ngoài đời. Con số "còn X giờ" trong lý do được tính **tại lúc chấm**, nên có thể lệch với cột SLA tính theo thời gian thực; vì vậy giao diện ghi thêm "Dự báo lúc HH:mm dd/MM".

---

## 7. Hợp đồng dịch vụ ML (`POST /predict`)

Dịch vụ: `app/main.py` (FastAPI), cổng 8000. Các đường: `GET /health`, `POST /predict`, `GET /metadata`.

**Bảo vệ:** nếu đặt biến môi trường `ML_API_KEY`, `/predict` yêu cầu header `X-API-Key` đúng (backend tự gửi khi cùng biến được đặt); không đặt thì chạy không xác thực (chỉ chấp nhận ở máy local). CORS mặc định tắt (`ML_CORS_ORIGINS` để mở). Lỗi nội bộ trả thông báo chung, chi tiết nằm trong log.

**Đầu vào chính** (đầy đủ ở `app/schemas.py`): `stage` (`TIEP_NHAN` hoặc `THAM_DINH`), `sla_hours`, `elapsed_hours`, `hours_since_last_event`, các trường hồ sơ ở mục 3.6 và các trường riêng của từng công đoạn.

**Đầu ra:** `delay_probability`, `alert_level` (`BINH_THUONG`, `CHU_Y`, `KHAN`, `QUA_HAN`), `risk_level` (tương thích bản cũ), `remaining_hours`, `top_reasons` (tối đa 3), `model_version`, `timestamp`.

**Hành vi đặc biệt:**
- `elapsed_hours >= sla_hours`: trả ngay `QUA_HAN`, xác suất 1,0, **không dùng mô hình**.
- `sla_hours` ngoài lưới đã học (Tiếp nhận 24–128, Thẩm định 16–80): trả **HTTP 422**, backend coi là "chưa dự báo". Không ngoại suy.
- Thiếu mô hình công đoạn: lỗi 500 (đã ghi log).

---

## 8. Phía hệ thống: lấy dữ liệu, gọi, lưu và hiển thị

### 8.1. Dữ liệu đầu vào lấy từ đâu (backend, `prediction.service.ts`, `prediction-features.ts`)
- **`elapsed_hours`:** số giờ làm việc ngân hàng từ lúc hồ sơ vào công đoạn đến bây giờ, theo lịch làm việc đã nạp và **trừ thời gian tạm dừng chờ doanh nghiệp** (SLA PA1). **Thiếu lịch cho ngày hiện tại thì không dự báo được** (`CALENDAR_OUT_OF_RANGE`); lịch hiện hành hết ngày **31/12/2026**.
- **`sla_hours`:** định mức SLA đang áp dụng của công đoạn mở.
- **`hours_since_last_event`:** từ thao tác gần nhất trong công đoạn (vào công đoạn, yêu cầu hoặc hoàn tất bổ sung, sự kiện tờ trình).
- **Tiếp nhận:** `officer_workload` = số hồ sơ đang mở của cán bộ phụ trách (mặc định 7 nếu chưa có người phụ trách); `items_pending_review` chỉ là **xấp xỉ 0 hoặc 1** (hệ thống chưa lưu số tài liệu bổ sung).
- **Thẩm định:** `tn_bank_hours` = giờ ngân hàng của công đoạn Tiếp nhận đã đóng; `appraisal_queue_len` = số hồ sơ đang ở Thẩm định; `appraisers_active` = số Thẩm quyền **chuyên trách đang mở, không tính tài khoản `test_*` và tài khoản kiêm CBTD** (tối thiểu 1); `clarify_*` lấy từ tờ trình.
- **Chỉ dự báo khi công đoạn mở tính SLA theo PA1** (giờ làm việc). Hồ sơ cũ tính SLA kiểu 24/7 trả "chưa dự báo".
- Lưu ý: khi huấn luyện, số Thẩm quyền chỉ là **2 hoặc 3**; giá trị ngoài khoảng đó (ví dụ 5) là ngoại suy và có thể cho xác suất khác nhiều. Giữ số tài khoản Thẩm quyền chuyên trách ở mức 2–3 nếu muốn dự báo đáng tin.

### 8.2. Gọi mô hình khi nào
Hồ sơ chuyển công đoạn; tiếp nhận đề nghị từ cổng; tạo hồ sơ tại quầy; CBTD trình tờ trình (mỗi bản); Thẩm quyền yêu cầu làm rõ; hoàn tất bổ sung; điều chuyển cán bộ; **lượt chấm định kỳ 08:00 và 13:00 giờ Việt Nam** mỗi ngày làm việc (bỏ qua hồ sơ đang chờ doanh nghiệp); chấm bù sau khi backend khởi động cho hồ sơ chưa có dự báo trong 6 giờ; Thẩm quyền hoặc Quản lý bấm chạy lại. Thao tác lặp không sinh dự báo trùng. **Lỗi hoặc ML tắt không làm hỏng nghiệp vụ**, chỉ ghi log.

### 8.3. Lưu và hiển thị
- Mỗi lần chấm thêm một dòng vào `delay_predictions` (mức rủi ro, xác suất, lý do, `modelVersion` dạng `v4.0-<CÔNG_ĐOẠN>`). Bảng này **chưa có cơ chế dọn** và tăng mỗi ngày.
- **Chỉ hiện dự báo "hiện hành":** do mô hình v4, đúng công đoạn đang mở, và tạo **sau lúc** hồ sơ vào công đoạn đó (`currentStagePrediction`). Nếu không có thì ghi "Chưa có dự báo" kèm lý do. Nhờ đó cảnh báo của công đoạn trước hay của mô hình cũ không bao giờ hiện nhầm.
- **Thẩm định không dùng mức Chú ý** (quyết định 09/11/2026): ở Thẩm định, mức Chú ý chỉ đúng khoảng 41% và báo nhầm khoảng 30% hồ sơ đúng hạn, nên xác suất 35% đến dưới 60% ở Thẩm định hiển thị là Bình thường. Mô hình, ngưỡng và xác suất không đổi; chỉ khác cách quy mức khi lưu và hiển thị (`riskLevelOf(alert, stage)` và `currentStagePrediction`). Muốn quay lại: bỏ nhánh `THAM_DINH` trong hai hàm đó.
- **"Quá hạn"** lấy từ `slaOverdue` do backend tính theo thời gian thực, không chờ lượt chấm kế tiếp.
- Giao diện: bảng cảnh báo của Quản lý và Thẩm quyền (`GET /dashboard/early-warnings`), cảnh báo hồ sơ của riêng CBTD (`GET /dashboard/my-warnings`), danh sách và chi tiết hồ sơ. **Cổng doanh nghiệp không có dữ liệu dự báo** (theo thiết kế: tiến độ cho doanh nghiệp chỉ dựng từ các trường công khai; chưa có test riêng khẳng định điều này).

---

## 9. Giới hạn và rủi ro (nói thẳng khi trình bày)

1. **Dữ liệu giả lập.** Mọi số liệu đánh giá đo trên dữ liệu do chương trình sinh ra. Chất lượng với hồ sơ thật **chưa biết**. Các tham số nhãn [GD] là giả định chưa được cán bộ thật xác nhận.
2. **Hơn đường cơ sở chỉ một chút** (mục 5). Đừng quảng bá là "AI thông minh"; nói là "đồng hồ SLA có tính xác suất, có hiệu chỉnh và có giải thích nguyên nhân".
3. **Gần như vô dụng lúc hồ sơ vừa vào công đoạn** (AUC 0,557 ở Tiếp nhận).
4. **Số liệu Tiếp nhận nhiễu** ở SLA 112 giờ vì chỉ 38 ca trễ trong tập test.
5. **Báo nhầm ở Thẩm định cao** (mức Khẩn báo nhầm 13,7% hồ sơ đúng hạn; mức Chú ý, đã bỏ, là 29,7%). Báo nhầm nhiều thì người dùng sẽ quen bỏ qua cảnh báo.
6. **Số Thẩm quyền ngoài 2–3 là ngoại suy** (mục 8.1).
7. **`items_pending_review` chỉ xấp xỉ 0/1.**
8. **Lịch làm việc hết 31/12/2026**: sang 01/01/2027 mọi hồ sơ báo "ngoài lịch làm việc" cho tới khi nạp lịch mới (phần SLA, do người phụ trách SLA nạp).
9. **Bảng `delay_predictions` tăng mỗi ngày**, chưa có cơ chế dọn.
10. **Phụ thuộc phiên bản scikit-learn** của tệp `.joblib` (mục 4.6).
11. **Không có kiểm tra chất lượng dữ liệu v4 tự động** (bản kiểm tra của v3 đã bị gỡ cùng các tệp v3); nếu sinh lại dữ liệu, cần tự kiểm các phân phối.

---

## 10. Vận hành và sửa đổi

### 10.1. Chạy lại toàn bộ pipeline (khi cần)
Cần Python với `pandas`, `scikit-learn`, `joblib` (không cần cài lên máy nếu dùng container của `ml-service`). Từ thư mục `ml-service/experiments/v3`:

```
python simulate_v4.py     # sinh data/cases_v4.csv, tiep_nhan_timeline_v4.csv, tham_dinh_timeline_v4.csv
python train_v4.py        # huấn luyện, ghi models/v4_*.joblib và results/metrics_v4.json
```
Sau đó sao chép `models/v4_tiep_nhan.joblib` và `models/v4_tham_dinh.joblib` vào `app/model/`, cập nhật `app/model/model_metadata.json` (số liệu), dựng lại image `ml-service`. Đổi số hồ sơ bằng biến `SIM_N`, hạt giống bằng `SIM_SEED`.
Với container: `docker run --rm -v "<đường dẫn>/ml-service/experiments:/work" --entrypoint python smesystem-ml-service /work/v3/simulate_v4.py` (Git Bash trên Windows cần `MSYS_NO_PATHCONV=1`).

### 10.2. Câu hỏi thường gặp
- **Đổi SLA (ví dụ Tiếp nhận 112 thành 100)?** Không cần huấn luyện lại, miễn còn trong 24–128 (Tiếp nhận) hoặc 16–80 (Thẩm định). Dự báo cũ vẫn ứng với SLA cũ cho tới lượt chấm kế tiếp.
- **Đổi ngưỡng 35% và 60%?** Sửa `T_WATCH`, `T_URGENT` trong `train_v4.py` rồi huấn luyện lại (ngưỡng nằm trong tệp mô hình) hoặc chỉ sửa lớp hiển thị. Đây là quyết định về ý nghĩa cảnh báo, cần người phụ trách mô hình duyệt.
- **Thêm đặc trưng mới?** Phải thêm vào bộ mô phỏng (nếu muốn nó có tác dụng thật), `STAGES` trong `train_v4.py`, `schemas.py`, `buildPredictPayload` ở backend, rồi huấn luyện lại. Thêm đặc trưng mà dữ liệu mô phỏng không cài quy luật thì mô hình sẽ không học được gì từ nó.
- **Khi có dữ liệu thật?** Nên huấn luyện lại bằng dữ liệu thật (giữ nguyên cách gán nhãn theo SLA tham số và chia theo hồ sơ), rồi so với đường cơ sở trước khi thay.
- **ML tắt thì sao?** Mọi thao tác nghiệp vụ vẫn chạy; dự báo cũ không hiện nếu không còn hiện hành; lượt chấm kế tiếp tự bù.
- **Kiểm tra nhanh dịch vụ:** `GET http://localhost:8000/health` (báo đã nạp đủ hai mô hình), `GET /metadata`.
- **Kiểm thử liên quan trong repo:** `backend/test/prediction-*.test.cjs`, `portal-accept-prediction`, `appraisal` (ca 10), `dashboard-warnings`; `frontend/scripts/check-sla-display.mjs`.

---

## 11. Lịch sử phiên bản và các bản cũ đã gỡ

| Phiên bản | Nội dung | Tình trạng |
|---|---|---|
| v1 (`v1.0-rf`) | Random Forest, 3.000 hồ sơ giả lập, một mô hình cho cả hệ thống, không biết SLA | Đã gỡ khỏi hệ thống ngày 09/11/2026 (cùng dữ liệu và các tập lệnh huấn luyện/đánh giá v1) |
| v2 | Thí nghiệm mô phỏng độ trễ ở khâu thẩm định (tập dữ liệu và mã huấn luyện riêng) | Đã gỡ |
| v3 | Mô phỏng theo BPIC, hai công đoạn, hai kịch bản nhãn cố định, chưa nhận biết SLA | Đã gỡ mã và kết quả; tham số BPIC (`params/`) được giữ vì v4 dùng |
| **v4.0** | Hai mô hình theo công đoạn, nhận biết SLA, dòng thời gian, hiệu chỉnh isotonic, hai ngưỡng, có giải thích | **Đang chạy** |

Mã và tệp đã gỡ vẫn xem được trong lịch sử git (trước commit gỡ ngày 09/11/2026). Trong DB chỉ còn dòng dự báo `v4.0-*`.

---

## 12. Thuật ngữ

- **SLA:** thời hạn xử lý của một công đoạn (giờ làm việc).
- **PA1:** cách tính SLA theo giờ làm việc ngân hàng, tạm dừng khi chờ doanh nghiệp.
- **AUC:** khả năng xếp hồ sơ trễ lên trước hồ sơ đúng hạn (0,5 là đoán bừa, 1 là hoàn hảo).
- **Hiệu chỉnh (calibration):** làm cho con số "xác suất" đúng nghĩa (nói 60% thì khoảng 60% thật sự xảy ra).
- **Brier score:** sai số bình phương trung bình của xác suất (càng thấp càng tốt).
- **Đường cơ sở (baseline):** mô hình đơn giản nhất để so sánh, ở đây chỉ biết giờ đã dùng và SLA.
- **Ảnh chụp (snapshot):** một dòng dữ liệu tại một thời điểm của một hồ sơ đang mở.
- **Biến ẩn:** yếu tố có trong mô phỏng nhưng cố ý không đưa vào mô hình.
- **BPIC 2012:** bộ nhật ký xử lý hồ sơ vay công khai dùng để lấy hình dạng phân phối thời gian chờ.
