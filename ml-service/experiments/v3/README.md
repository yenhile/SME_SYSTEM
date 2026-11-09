# Thí nghiệm huấn luyện mô hình v4

Thư mục này chứa mã sinh dữ liệu mô phỏng và huấn luyện của mô hình **v4.0 đang chạy**. Tên thư mục `v3` được giữ để không làm gãy đường dẫn cũ; mã và kết quả v1, v2, v3 đã gỡ ngày 09/11/2026 (xem lịch sử git).

**Giải thích đầy đủ mô hình và dữ liệu: [../../README.md](../../README.md).**

| Tệp | Nội dung |
|---|---|
| `simulate_v4.py` | Bộ mô phỏng 20.000 hồ sơ, sinh `data/cases_v4.csv`, `tiep_nhan_timeline_v4.csv`, `tham_dinh_timeline_v4.csv` (đã có sẵn trong git, khoảng 18 MB; hạt giống 2026 nên chạy lại cho cùng kết quả) |
| `train_v4.py` | Huấn luyện hai mô hình, hiệu chỉnh isotonic, đánh giá, ghi `models/v4_*.joblib` và `results/metrics_v4.json` |
| `params/bpic2012_params.json` | Tham số hình dạng phân phối rút từ BPI Challenge 2012 (chỉ số liệu tổng hợp) |
| `data/generation_config_v4.json` | Hạt giống, số lượng và toàn bộ tham số dùng khi sinh |
| `results/metrics_v4.json` | Kết quả đánh giá chi tiết (AUC, Brier, độ tin cậy, theo hồ sơ) |
| `tools/extract_bpic_params.cjs` | Trích tham số từ BPIC (cần tải dữ liệu gốc từ 4TU.ResearchData, không nằm trong repo) |
| `tools/make_demo_fixture.cjs`, `tools/ui_audit.cjs` | Dựng dữ liệu demo; kiểm tra giao diện bằng Chrome không giao diện |

Chạy lại (từ thư mục này): `python simulate_v4.py` rồi `python train_v4.py`; sau đó sao chép `models/v4_*.joblib` vào `app/model/` và cập nhật `app/model/model_metadata.json`.
