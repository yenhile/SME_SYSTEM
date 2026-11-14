# Kết quả thực nghiệm bổ sung của mô hình v4 (dùng cho bài báo và khóa luận)

Nguồn: `ml-service/experiments/v3/results/experiments_v4.json`, sinh bởi `eval_extra_v4.py` (chạy ngày 13/11/2026). Mô hình đang chạy và `metrics_v4.json` **không bị đổi**. Dữ liệu là **mô phỏng** (20.000 hồ sơ), mọi kết luận chỉ về phương pháp.

## 1. Cách đo (ghi vào phần thực nghiệm)

| Mục | Giá trị |
|---|---|
| Môi trường | Python 3.12.16, scikit-learn 1.9.1, pandas 3.1.1, numpy 2.5.4; Linux (WSL2), 12 CPU; chạy 2,6 phút |
| Cấu hình đo | Tiếp nhận SLA 112 giờ, Thẩm định SLA 40 giờ, trên tập kiểm tra 15% hồ sơ |
| Dòng kiểm tra | Tiếp nhận 15.806 dòng (tỷ lệ trễ 3,66%); Thẩm định 10.455 dòng (28,74%) |
| Lần chạy "chính thức" | Đúng cách chia và hạt giống của `train_v4.py`; tái lập đúng số trong `metrics_v4.json` (AUC 0,8241 và 0,7201) |
| 5 hạt giống | Mỗi hạt giống đổi đồng thời: cách chia 70/15/15 theo hồ sơ, mức SLA gán ngẫu nhiên cho từng dòng huấn luyện, hạt giống của mô hình |
| Hiệu chỉnh | Hồi quy đẳng điệu trên tập kiểm định, áp cho mọi thuật toán |
| Khoảng tin cậy | Bootstrap theo **hồ sơ** (1.000 lần lấy mẫu lại), 95%; khoảng Wilson cho độ chính xác và độ phủ |
| Tham số | Gradient Boosting: độ sâu 5, tốc độ học 0,06, 400 vòng, l2 = 1,0; Random Forest: 200 cây, lá tối thiểu 20 mẫu; Logistic Regression: 3.000 vòng lặp tối đa |

## 2. So sánh thuật toán (trung bình ± độ lệch chuẩn của 5 hạt giống)

**Tiếp nhận (SLA 112 giờ).** Thuật toán đang dùng: Gradient Boosting.

| Mô hình | AUC | Brier | Log-loss | ECE |
|---|---|---|---|---|
| Luật ngưỡng (giờ đã dùng / SLA) | 0,7952 ± 0,0013 | không áp dụng | | |
| Đường cơ sở (chỉ đồng hồ SLA) | 0,7925 ± 0,0028 | 0,0297 ± 0,0049 | 0,1245 ± 0,0164 | 0,0128 ± 0,0039 |
| Logistic Regression | 0,8019 ± 0,0072 | 0,0293 ± 0,0049 | 0,1226 ± 0,0168 | 0,0116 ± 0,0041 |
| Random Forest | 0,8057 ± 0,0127 | 0,0280 ± 0,0044 | 0,1197 ± 0,0161 | 0,0093 ± 0,0037 |
| **Gradient Boosting** | **0,8131 ± 0,0165** | 0,0284 ± 0,0045 | 0,1212 ± 0,0165 | 0,0105 ± 0,0041 |

Lần chạy chính thức: luật 0,7992; cơ sở 0,7971; LR 0,8161; RF 0,8171; GB **0,8241**.

**Thẩm định (SLA 40 giờ).** Thuật toán đang dùng: Logistic Regression.

| Mô hình | AUC | Brier | Log-loss | ECE |
|---|---|---|---|---|
| Luật ngưỡng | 0,6856 ± 0,0025 | không áp dụng | | |
| Đường cơ sở | 0,6858 ± 0,0028 | 0,1798 ± 0,0005 | 0,5422 ± 0,0011 | 0,0141 ± 0,0059 |
| **Logistic Regression** | **0,7159 ± 0,0042** | 0,1794 ± 0,0007 | 0,5416 ± 0,0027 | 0,0188 ± 0,0067 |
| Random Forest | 0,7263 ± 0,0049 | 0,1748 ± 0,0010 | 0,5285 ± 0,0029 | 0,0192 ± 0,0034 |
| Gradient Boosting | 0,7193 ± 0,0099 | 0,1768 ± 0,0024 | 0,5322 ± 0,0071 | 0,0158 ± 0,0036 |

Lần chạy chính thức: luật 0,6863; cơ sở 0,6865; LR **0,7201**; RF 0,7280; GB 0,7118.

## 3. Khoảng tin cậy bootstrap (lần chạy chính thức, 1.000 lần)

| Công đoạn | AUC mô hình đang dùng | AUC đường cơ sở | Hiệu (mô hình trừ cơ sở) | Tỷ lệ lần mô hình hơn |
|---|---|---|---|---|
| Tiếp nhận | 0,8241 [0,7906; 0,8576] | 0,7971 [0,7905; 0,8037] | +0,0269 [**−0,0060**; 0,0593] | 94,4% |
| Thẩm định | 0,7201 [0,7061; 0,7340] | 0,6865 [0,6802; 0,6924] | +0,0335 [0,0200; 0,0465] | 100% |

Khoảng Wilson 95% của các tỷ lệ cảnh báo (lần chạy chính thức):

| Công đoạn, mức | Độ chính xác | Độ phủ | Báo nhầm hồ sơ đúng hạn |
|---|---|---|---|
| Tiếp nhận, Khẩn (ngưỡng 0,60) | 78,4% [62,8; 88,6] | 76,3% [60,8; 87,0] | 0,3% |
| Tiếp nhận, Chú ý (0,35) | 47,4% [36,5; 58,5] | 94,7% [82,7; 98,5] | 1,3% |
| Thẩm định, Khẩn | 57,7% [54,2; 61,1] | 86,5% [83,4; 89,2] | 13,7% |
| Thẩm định, Chú ý | 41,2% [38,5; 44,0] | 96,8% [95,0; 98,0] | 29,7% |

Tiếp nhận chỉ có 38 hồ sơ trễ trong tập kiểm tra nên khoảng rộng; qua 5 hạt giống, độ phủ mức Khẩn của Gradient Boosting dao động 0,74 ± 0,09.

## 4. Bóc tách thành phần (AUC, 5 hạt giống)

| Biến thể (thuật toán đang dùng) | Tiếp nhận | Thẩm định |
|---|---|---|
| Đầy đủ | 0,8131 ± 0,0165 | 0,7159 ± 0,0042 |
| Bỏ thông tin hồ sơ (số tiền, ngành, doanh thu…) | **0,8291 ± 0,0060** | 0,7142 ± 0,0018 |
| Bỏ đặc trưng vận hành riêng công đoạn | 0,7875 ± 0,0220 | 0,6933 ± 0,0057 |
| Bỏ "giờ kể từ thao tác gần nhất" | 0,8088 ± 0,0168 | 0,7132 ± 0,0031 |
| Không hiệu chỉnh (xác suất thô) | 0,8157 ± 0,0156 | 0,7177 ± 0,0032 |
| Chỉ đồng hồ SLA | 0,7913 ± 0,0037 | 0,6858 ± 0,0028 |

ECE (sai số hiệu chỉnh, nhỏ hơn thì tốt): ở Thẩm định, hiệu chỉnh đẳng điệu giúp (ECE 0,0188 so với 0,0240 khi không hiệu chỉnh); ở Tiếp nhận thì không (0,0105 so với 0,0067), vì chỉ có vài chục hồ sơ trễ để học bộ hiệu chỉnh.

## 5. SLA là đầu vào so với mô hình huấn luyện ở một mức SLA cố định

Mô hình cố định huấn luyện ở SLA đang chạy (Tiếp nhận 112, Thẩm định 40), rồi đo ở mức SLA khác.

| Đo ở | Mô hình nhận biết SLA: AUC / Brier | Mô hình SLA cố định: AUC / Brier |
|---|---|---|
| Tiếp nhận, SLA 48 | 0,6933 / 0,1777 | 0,5667 / 0,2696 |
| Tiếp nhận, SLA 80 | 0,7682 / 0,0704 | 0,6690 / 0,0858 |
| Thẩm định, SLA 24 | 0,6538 / 0,2327 | 0,6526 / 0,3091 |
| Thẩm định, SLA 64 | 0,7765 / 0,0999 | 0,7720 / 0,1610 |

Đây là bằng chứng mạnh nhất cho thiết kế "SLA là đầu vào": khi đổi định mức, mô hình cố định sai về xác suất (Brier tăng 20 đến 50%), mô hình nhận biết SLA thì không.

## 6. Độ trễ

| Phép đo | Tiếp nhận | Thẩm định |
|---|---|---|
| Chỉ mô hình (một hồ sơ, trung vị / p95) | 7,1 / 9,3 ms | 2,5 / 3,6 ms |
| Qua API `POST /predict` (300 lần, trung vị / p95) | 9,3 / 16,4 ms | 41,3 / 64,2 ms |

Thẩm định chậm hơn qua API vì ca thử có xác suất cao nên phải tính phần lý do giải thích (thay từng yếu tố bằng giá trị điển hình, nhiều lần dự báo). Tiếp nhận ca thử xác suất thấp nên bỏ qua phần này. Cả hai đủ nhanh cho việc chấm theo sự kiện và lượt quét định kỳ.

## 7. Những điều phải ghi đúng trong bài (khác với bản nháp cũ)

1. **Tiếp nhận hơn đường cơ sở nhưng chưa đủ bằng chứng thống kê.** Khoảng tin cậy của hiệu AUC cắt qua 0 ([−0,006; 0,059]). Qua 5 hạt giống mức hơn là +0,021 (0,8131 so với 0,7925). Thẩm định hơn có ý nghĩa thống kê (+0,030 đến +0,034, khoảng không chứa 0).
2. **Con số 0,824 là kết quả của một lần chia dữ liệu thuận lợi.** Trung bình 5 lần là 0,813 ± 0,017. Nên báo cả hai.
3. **Ba thuật toán cho kết quả gần nhau** (chênh nằm trong độ lệch chuẩn ở Tiếp nhận; ở Thẩm định Random Forest nhỉnh hơn khoảng 0,01 AUC và có log-loss tốt hơn rõ). Việc chọn Logistic Regression cho Thẩm định là hợp lý vì đơn giản và dễ giải thích, nhưng không phải là phương án tốt nhất về số liệu; Random Forest không nằm trong các ứng viên lúc chọn. Nên nói thẳng.
4. **Thông tin hồ sơ không đóng góp khả năng dự báo, và ở Tiếp nhận có thể gây nhiễu** (bỏ đi AUC còn tăng từ 0,813 lên 0,829). Sức dự báo đến từ đặc trưng vận hành (tải cán bộ, số vòng bổ sung, hàng chờ, số người thẩm quyền, số lần làm rõ). Điều này khớp với cách mô phỏng: các đặc trưng hồ sơ không được cài làm nguyên nhân gây chậm.
5. **Hiệu chỉnh đẳng điệu có ích ở Thẩm định, không ích ở Tiếp nhận** (ít hồ sơ trễ).
6. Luật ngưỡng đơn giản (giờ đã dùng chia SLA) gần như bằng đường cơ sở học máy, nên "mốc so sánh" thật sự là đồng hồ SLA.

## 8. Cần làm tiếp để bài báo và khóa luận đầy đủ

- Chạy lại toàn bộ trên Colab hoặc Kaggle theo `paper/colab/HUONG_DAN_COLAB_KAGGLE.md` và giữ bản notebook có kết quả làm bằng chứng.
- Cập nhật bản nháp `paper/bai-bao/main.tex` và `paper/chuong5-kltn.md`: thay các câu "hơn đường cơ sở khoảng 0,03 AUC" bằng nhận định ở mục 7, thêm Bảng so sánh thuật toán (mục 2), bảng bóc tách (mục 4) và bảng SLA nhận biết (mục 5). Chưa sửa vì bạn nói sẽ viết sau.
- Chưa làm: đánh giá trên dữ liệu thật hoặc bộ BPI Challenge 2012 gốc; thay đổi mô hình đang chạy (không đổi theo ghi chú trong Master).

---

# Đợt 2: chẩn đoán bổ sung (ngày 13/11/2026)

Nguồn: `results/diagnostics_v4.json`, sinh bởi `eval_diagnostics_v4.py` (1,6 phút). Hình: thư mục `paper/hinh/` (`roc_*.png`, `nguong_*.png`, `boc_tach.png`, `sla_nhan_biet.png`).

## 9. Trần lý thuyết: cho mô hình thấy ba biến ẩn

Chạy lại bộ mô phỏng theo đúng thứ tự để thu giá trị ba biến ẩn (tốc độ cán bộ tín dụng, tốc độ Thẩm quyền, độ phức tạp thực). Kiểm tra: dữ liệu sinh lại khớp **20.000/20.000** hồ sơ với dữ liệu hiện có (0 lệch). Sau đó huấn luyện cùng quy trình, cùng tập kiểm tra, có và không có ba biến ẩn.

| Công đoạn | Mô hình | AUC chỉ thấy đặc trưng quan sát được | AUC khi thấy cả biến ẩn |
|---|---|---|---|
| Tiếp nhận | Logistic Regression | 0,8161 | 0,8813 |
| Tiếp nhận | Gradient Boosting | 0,8241 | 0,8942 |
| Thẩm định | Logistic Regression | 0,7201 | 0,7761 |
| Thẩm định | Gradient Boosting | 0,7118 | 0,7740 |

Tính theo phần AUC vượt mức đoán bừa (0,5): mô hình đang dùng đạt khoảng **82%** ở Tiếp nhận (Gradient Boosting) và **80%** ở Thẩm định (Logistic Regression) so với mô hình thấy được cả biến ẩn.

**Cách diễn đạt trong bài:** mô hình khiêm tốn chủ yếu vì thông tin quan sát được tại thời điểm dự báo có hạn, không phải vì thuật toán yếu. Ngay cả khi biết cả ba biến ẩn, Thẩm định cũng chỉ đạt AUC khoảng 0,78, tức là bản thân việc trễ trong mô phỏng có độ ngẫu nhiên cao (thời gian từng bước theo phân phối log-chuẩn, số vòng làm rõ ngẫu nhiên). Đây là kết quả trong bộ mô phỏng, không suy ra được cho dữ liệu thật.

## 10. Độ nhạy theo ngưỡng cảnh báo (mô hình đang dùng, tập kiểm tra, theo hồ sơ)

**Tiếp nhận (SLA 112)**

| Ngưỡng | Số hồ sơ cảnh báo | Độ chính xác | Độ phủ | Báo nhầm hồ sơ đúng hạn | Báo trước trung vị (giờ) |
|---|---|---|---|---|---|
| 0,2 | 182 | 20,9% | 100,0% | 4,8% | 48 |
| 0,35 | 76 | 47,4% | 94,7% | 1,3% | 24.5 |
| 0,5 | 46 | 69,6% | 84,2% | 0,5% | 16 |
| 0,6 | 37 | 78,4% | 76,3% | 0,3% | 16 |
| 0,7 | 25 | 84,0% | 55,3% | 0,1% | 16 |
| 0,8 | 20 | 90,0% | 47,4% | 0,1% | 14.1 |

**Thẩm định (SLA 40)**

| Ngưỡng | Số hồ sơ cảnh báo | Độ chính xác | Độ phủ | Báo nhầm hồ sơ đúng hạn | Báo trước trung vị (giờ) |
|---|---|---|---|---|---|
| 0,2 | 2539 | 21,0% | 100,0% | 80,8% | 32 |
| 0,35 | 1254 | 41,2% | 96,8% | 29,7% | 16 |
| 0,5 | 978 | 50,4% | 92,3% | 19,5% | 16 |
| 0,6 | 801 | 57,7% | 86,5% | 13,7% | 8.2 |
| 0,7 | 350 | 72,9% | 47,8% | 3,8% | 8 |
| 0,8 | 52 | 82,7% | 8,1% | 0,4% | 8 |

Nhận xét: ở Thẩm định, tăng ngưỡng từ 0,60 lên 0,70 làm độ phủ rơi từ 86,5% xuống 47,8% (chỉ báo nhầm giảm từ 13,7% còn 3,8%), nên 0,60 là điểm cân bằng hợp lý; ngưỡng 0,35 thì báo nhầm gần 30%, là lý do không dùng mức Chú ý ở Thẩm định. Hai ngưỡng 0,35 và 0,60 là lựa chọn của dự án, đồ thị `nguong_*.png` cho thấy toàn bộ đường đánh đổi.

## 11. Đánh giá phần lý do giải thích

Trên các dòng kiểm tra có xác suất từ 10% trở lên. Phân loại đặc trưng theo cơ chế trong bộ mô phỏng: *trực tiếp* (làm đổi thời gian xử lý), *yếu* (ảnh hưởng nhỏ qua độ phức tạp hồ sơ), *đại diện* (không gây chậm trực tiếp nhưng tương quan với biến ẩn hoặc là hệ quả của dòng thời gian).

| Công đoạn | Dòng được giải thích | Dòng có ít nhất 1 lý do | Lý do trực tiếp | Lý do yếu | Lý do đại diện |
|---|---|---|---|---|---|
| Tiếp nhận | 818 | 818 (100,0%) | 70,1% | 19,8% | 10,2% |
| Thẩm định | 10233 | 7524 (73,5%) | 75,4% | 3,6% | 21,0% |

Đặc trưng được nêu nhiều nhất:

- Tiếp nhận: time (806), proposed_amount_billion (340), items_pending_review (224), officer_workload (180), hours_since_last_event (110)
- Thẩm định: time (7300), tn_bank_hours (1677), appraisal_queue_len (1014), hours_since_last_event (605), proposed_amount_billion (400)

Đọc kết quả cho trung thực: hơn 70% lý do rơi vào nhóm có cơ chế thật và không có lý do nào nằm ngoài phân loại, nhưng (1) lý do "thời gian đã dùng" xuất hiện ở phần lớn dòng (Tiếp nhận 99%, Thẩm định 71%) nên phần giải thích ít thông tin; (2) ở Tiếp nhận khoảng 20% lý do chỉ vào "số tiền đề nghị", là yếu tố có ảnh hưởng nhỏ và bóc tách cho thấy nhóm thông tin hồ sơ không giúp dự báo, nên phần giải thích có thể nhấn mạnh yếu tố này hơn mức nó đáng; (3) ở Thẩm định khoảng 21% lý do thuộc nhóm đại diện (chủ yếu là giờ đã tốn ở Tiếp nhận), đóng vai trò thay cho độ phức tạp ẩn chứ không phải nguyên nhân. Chỉ đo tính khớp với cơ chế mô phỏng, chưa đo việc người dùng có hiểu và hành động theo lý do hay không.

## 12. Độ nhạy theo giả định mô phỏng

Đổi từng nhóm tham số giả định rồi sinh lại 20.000 hồ sơ, huấn luyện và đo lại. Cột là hiệu AUC của mô hình đang dùng trừ AUC đường cơ sở (dương nghĩa là mô hình hơn).

| Kịch bản | Tiếp nhận SLA 112 | Tiếp nhận SLA 80 | Thẩm định SLA 40 |
|---|---|---|---|
| goc | +0,027 (trễ 579) | +0,022 | +0,034 |
| bien_an_it_hon (sigma ẩn x0,5) | -0,019 (trễ 174) | +0,020 | +0,026 |
| bien_an_nhieu_hon (sigma ẩn x1,5) | +0,038 (trễ 1754) | +0,034 | +0,061 |
| thoi_gian_xu_ly_giam_20% | +0,031 (trễ 251) | +0,029 | +0,040 |
| thoi_gian_xu_ly_tang_20% | +0,013 (trễ 995) | +0,031 | +0,033 |
| do_nhay_hang_cho_yeu (beta x0,5) | +0,012 (trễ 632) | +0,032 | +0,039 |
| do_nhay_hang_cho_manh (beta x1,5) | +0,021 (trễ 518) | +0,044 | +0,039 |

Kết luận: ở **Thẩm định mô hình hơn đường cơ sở trong cả 7 kịch bản** (từ +0,026 đến +0,061), nên kết luận này không phụ thuộc vào một bộ giả định cụ thể. Ở **Tiếp nhận hơn ở SLA 80 giờ trong cả 7 kịch bản** (+0,020 đến +0,044); ở SLA 112 giờ hơn trong 6 kịch bản, và âm một kịch bản (sigma biến ẩn giảm một nửa, chỉ còn 174 dòng trễ trong tập kiểm tra, rất nhiễu). Điều này củng cố nhận định: Tiếp nhận hơi hơn đường cơ sở nhưng độ tin cậy thấp khi có rất ít hồ sơ trễ.

## 13. Cập nhật mục "những điều phải ghi đúng trong bài"

7. **Trần lý thuyết** (mục 9) là lập luận chính cho phần hạn chế: giải thích mức AUC bằng thông tin quan sát được có hạn.
8. **Kết luận về Thẩm định vững** trước thay đổi giả định mô phỏng (mục 12); kết luận về Tiếp nhận chỉ vững ở mức "hơi hơn".
9. **Phần lý do giải thích** khớp cơ chế mô phỏng nhưng ít thông tin và có thể nhấn quá mức "số tiền" (mục 11).
