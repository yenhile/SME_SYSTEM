# Hướng dẫn chạy lại mô hình trên Colab hoặc Kaggle để lấy bằng chứng

Mục đích: có một lần chạy **độc lập, trên máy khác**, cho thấy kết quả tái lập được. Không cần GPU. Thời gian: khoảng 15 đến 40 phút trên CPU của Colab (trên máy 12 CPU chỉ 2,6 phút).

## 0. Chuẩn bị (2 tệp, nằm cùng thư mục `paper/colab/`)

| Tệp | Nội dung |
|---|---|
| `ml-experiments-v4.zip` (2,2 MB) | Mã (`simulate_v4.py`, `check_quality_v4.py`, `train_v4.py`, `eval_extra_v4.py`), dữ liệu 3 tệp CSV, tham số, kết quả gốc để đối chiếu |
| `colab_v4.ipynb` | Notebook chạy từng bước, có sẵn ô đối chiếu và ô tóm tắt |

Dữ liệu trong zip là dữ liệu **mô phỏng**, không có thông tin khách hàng thật, đăng lên công khai được.

## 1. Chạy trên Google Colab (khuyến nghị)

1. Vào https://colab.research.google.com, chọn **File, Upload notebook**, chọn `colab_v4.ipynb`.
2. Chọn **Runtime, Change runtime type**: giữ **CPU**.
3. Chạy lần lượt từng ô (Shift+Enter):
   - **Ô 1 (môi trường):** cài `scikit-learn==1.9.1`, `pandas==3.1.1`. Nếu in ra phiên bản khác 1.9.1, chọn **Runtime, Restart session** rồi chạy lại ô này. Nếu `pip` báo không cài được `pandas==3.1.1` vì Python quá cũ, ghi lại phiên bản Python Colab đang dùng và cài bản mới nhất, nhưng khi đó số liệu có thể lệch ở chữ số thập phân cuối.
   - **Ô 2 (nạp mã):** bấm chọn tệp `ml-experiments-v4.zip` khi hộp thoại hiện ra.
   - **Ô 3 (băm dữ liệu):** ba mã SHA-256 phải bắt đầu bằng `833860F5EA7B8B36` (cases), `6DE288F18E4853A7` (tham_dinh), `F5EA70B5FCE0774A` (tiep_nhan). Trùng nghĩa là dữ liệu giống hệt.
   - **Ô 4 (chất lượng dữ liệu):** kỳ vọng 31/31 mục đạt.
   - **Ô 5 (huấn luyện lại và đối chiếu):** kỳ vọng in ra "Số giá trị đối chiếu: 393; lệch: 0", AUC mô hình Tiếp nhận 0,8241 và Thẩm định 0,7201 (đã kiểm chạy thử trên bản sao, đúng như vậy).
   - **Ô 6 (thực nghiệm bổ sung):** chạy `eval_extra_v4.py`. Muốn thử nhanh thì đổi thành `!python eval_extra_v4.py --quick`.
   - **Ô 7 (tóm tắt):** in các bảng để dán vào bài.
   - **Ô 7b (chẩn đoán bổ sung):** chạy `eval_diagnostics_v4.py`: đường ROC, độ nhạy theo ngưỡng, đánh giá lý do giải thích, **trần lý thuyết** (chạy lại mô phỏng để lấy biến ẩn; phải in "lệch 0 / 20000"), độ nhạy theo giả định mô phỏng, rồi vẽ 6 hình. Khoảng 10 đến 30 phút.
   - **Ô 7c:** in tóm tắt chẩn đoán và hiển thị các hình (đường ROC, ngưỡng, bóc tách, SLA nhận biết).
   - **Ô 8 (tải về):** tải `ket-qua-v4.zip` về máy.
4. Cuối cùng chọn **File, Download, Download .ipynb** (bản có kết quả sau khi chạy) và **File, Print** lưu thành PDF.

Lưu ý Colab: phiên chạy tối đa vài giờ và bị ngắt khi không hoạt động; nếu ngắt giữa chừng phải chạy lại từ ô 1.

## 2. Chạy trên Kaggle

1. Vào https://www.kaggle.com, **Create, New Dataset**, tải `ml-experiments-v4.zip` lên (đặt tên ví dụ `sme-ml-v4`), để riêng tư.
2. **Create, New Notebook**, chọn **File, Import Notebook** rồi chọn `colab_v4.ipynb`.
3. **Add Data**, thêm dataset vừa tạo. Bật **Internet** trong cài đặt (để `pip install` chạy được).
4. Ở ô 2: bỏ comment đoạn **Kaggle**, comment đoạn **Colab**, sửa `<tên-dataset>` cho đúng.
5. Bỏ ô 8 (không cần). Kaggle tự lưu mọi tệp trong `/kaggle/working` vào mục **Output**.
6. Bấm **Save Version, Save & Run All (Commit)**. Kaggle lưu bản chạy có nhật ký và đánh số phiên bản, đây là bằng chứng tốt.

## 3. Bằng chứng cần giữ (đưa vào phụ lục khóa luận, nêu trong bài báo)

| Bằng chứng | Ghi chú |
|---|---|
| Notebook `.ipynb` hoặc PDF có kết quả đầy đủ | Thấy cả ô môi trường (phiên bản Python, thư viện) và kết quả |
| `ket-qua-v4.zip` | Có `experiments_v4.json` và `diagnostics_v4.json` (số liệu), `metrics_v4.json` (kết quả huấn luyện), mô hình, thư mục `figures` (6 hình PNG) |
| Ảnh chụp ô 3, 4, 5, 7b | Băm dữ liệu trùng, 31/31 đạt, lệch 0; mô phỏng lại khớp 20.000/20.000 |
| Đường dẫn bản Kaggle (nếu dùng) | Ghi số phiên bản và ngày chạy |
| Mã nguồn + dữ liệu mô phỏng | Có trong kho Git của dự án và trong zip |

## 4. Thông tin cần ghi trong bài báo và khóa luận (đã có sẵn, chỉ cần chép)

| Nội dung | Giá trị |
|---|---|
| Dữ liệu | 20.000 hồ sơ mô phỏng; 106.705 dòng Tiếp nhận và 83.629 dòng Thẩm định; chia 70/15/15 theo hồ sơ |
| Nhãn | Tổng giờ công đoạn lớn hơn SLA; SLA lấy ngẫu nhiên từ lưới (24–128 giờ Tiếp nhận, 16–80 giờ Thẩm định) |
| Thuật toán so sánh | Luật ngưỡng, Logistic Regression, Random Forest, Gradient Boosting; đường cơ sở chỉ biết đồng hồ SLA |
| Hiệu chỉnh | Hồi quy đẳng điệu trên tập kiểm định |
| Chỉ số | AUC, Brier, log-loss, ECE, độ chính xác và độ phủ ở ngưỡng 0,35 và 0,60 |
| Độ tin cậy | 5 hạt giống (đổi cách chia, mức SLA và hạt giống mô hình), bootstrap theo hồ sơ 1.000 lần, khoảng Wilson |
| Số liệu cụ thể | Xem `paper/ket-qua-thuc-nghiem.md` (bảng so sánh, bootstrap, bóc tách, SLA nhận biết, độ trễ) |
| Giới hạn phải nói | Dữ liệu mô phỏng; tham số giả định chưa xác nhận bởi cán bộ thật; Tiếp nhận chỉ 38 hồ sơ trễ trong tập kiểm tra |

## 5. Nếu số liệu trên Colab khác số trong tài liệu

- **Lệch ở chữ số thập phân cuối:** bình thường nếu phiên bản thư viện khác (cần đúng scikit-learn 1.9.1 và pandas 3.1.1).
- **Lệch nhiều ở Gradient Boosting:** thuật toán này tự dừng sớm bằng một tập con ngẫu nhiên; kết quả phụ thuộc hạt giống. Lần chạy "chính thức" dùng hạt giống 1; các lần "hạt giống 1 đến 5" khác nhau là đúng thiết kế (đó là phần đo độ dao động).
- **Băm dữ liệu không trùng:** tệp bị đổi (ví dụ xuống dòng khi mở bằng Excel). Giải nén lại từ zip gốc, không mở CSV bằng Excel.
- **`import` lỗi vì thiếu thư viện:** chạy lại ô 1; Kaggle cần bật Internet.

## 6. Tự chạy lại trên máy bạn (không cần Colab)

Từ thư mục gốc dự án, khi Docker đang chạy:

```
docker run --rm --entrypoint python -v "T:\SME_SYSTEM\ml-service:/work" -w /work/experiments/v3 smesystem-ml-service:latest eval_extra_v4.py
```

Kết quả ghi vào `ml-service/experiments/v3/results/experiments_v4.json`. Chạy tiếp `python eval_diagnostics_v4.py` (thay `eval_extra_v4.py`) để có `diagnostics_v4.json` và các hình. Hai lệnh này **không** đổi mô hình đang chạy.
