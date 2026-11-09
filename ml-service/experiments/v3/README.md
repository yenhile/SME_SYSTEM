# Bộ dữ liệu huấn luyện v3: dự báo nguy cơ trễ SLA ở Tiếp nhận và Thẩm định

Thực nghiệm độc lập, **không thay thế** dữ liệu, mô hình hay mã đang chạy của `ml-service/`. Chưa tích hợp vào hệ thống. Ngày tạo: 06/11/2026.

## 1. Phạm vi
- Hai công đoạn: **Tiếp nhận** và **Thẩm định**. Không có công đoạn cấp trên; số tiền tối đa 10 tỷ đồng.
- Thời gian tính theo **giờ làm việc** (thứ Hai đến thứ Sáu, 08:00–12:00 và 13:00–17:00), phía **ngân hàng**. Thời gian chờ doanh nghiệp bổ sung chỉ ghi riêng, không tính vào giờ ngân hàng.
- ML chỉ dự báo nguy cơ **trễ SLA**, không liên quan quyết định tín dụng. Không dùng rule base trong thực nghiệm này.
- Dữ liệu là **mô phỏng**, hình dạng phân phối hiệu chỉnh từ BPI Challenge 2012. Không phải dữ liệu thật của ngân hàng.

## 2. Các tệp
| Tệp | Nội dung |
|---|---|
| `tools/extract_bpic_params.cjs` | Trích tham số thống kê tổng hợp từ BPI Challenge 2012 (cần tải dữ liệu gốc từ 4TU.ResearchData, không nằm trong repo) |
| `params/bpic2012_params.json` | Tham số rút từ BPIC (chỉ số liệu tổng hợp, không có dữ liệu hồ sơ) |
| `simulate_v3.py` | Bộ mô phỏng, đọc tham số BPIC và các giả định `[GD]` trong mã |
| `check_quality_v3.py` | Kiểm tra chất lượng và lập bảng kịch bản SLA |
| `data/cases_v3.csv` | Mỗi hồ sơ một dòng, kèm tổng giờ từng công đoạn (20.000 dòng) |
| `data/tiep_nhan_snapshots_v3.csv` | Ảnh chụp tại các thời điểm dự báo ở Tiếp nhận (28.190 dòng) |
| `data/tham_dinh_snapshots_v3.csv` | Ảnh chụp tại các thời điểm dự báo ở Thẩm định (26.604 dòng) |
| `data/generation_config_v3.json` | Hạt giống, số lượng, toàn bộ tham số dùng khi sinh |
| `data/quality_report_v3.json` | Kết quả kiểm tra và bảng kịch bản SLA |

## 3. Cách chạy lại (không cần cài Python lên máy)
Từ thư mục gốc dự án, dùng container tạm của `ml-service` (Git Bash trên Windows cần `MSYS_NO_PATHCONV=1`):

    docker run --rm -v "<đường dẫn>/ml-service/experiments:/work" --entrypoint python smesystem-ml-service /work/v3/simulate_v3.py
    docker run --rm -v "<đường dẫn>/ml-service/experiments:/work" --entrypoint python smesystem-ml-service /work/v3/check_quality_v3.py

Hạt giống cố định (2026): chạy lại cho **cùng kết quả** (đã kiểm tra: ba tệp CSV giống hệt theo MD5 sau hai lần chạy). Đổi số lượng bằng `SIM_N`, hạt giống bằng `SIM_SEED`, độ dày đuôi thời gian chờ bằng `SIM_SIGMA_QUEUE` (ví dụ 1.566 cho kịch bản đuôi dài, chưa chạy).

## 4. Từ điển dữ liệu

### 4.1. Các cột dùng chung ở cả ba tệp CSV
| Cột | Ý nghĩa | Nguồn trong hệ thống |
|---|---|---|
| `case_id` | Mã hồ sơ mô phỏng (`SIM3-xxxxxx`) | |
| `split` | Tập huấn luyện (`train` 70%), kiểm tra (`valid` 15%), thử (`test` 15%), chia **theo hồ sơ** bằng băm mã hồ sơ | |
| `proposed_amount_billion` | Số tiền đề nghị (tỷ đồng), 0,01 đến 10 | `proposedAmount` |
| `loan_term_months` | Thời hạn vay (3, 6, 9, 12) | `loanTermMonths` |
| `business_scope` | `SAN_XUAT`, `THUONG_MAI`, `DICH_VU`, `KHAC` | `businessScope` (form V2) |
| `established_years` | Số năm hoạt động | `establishedYear` |
| `annual_revenue_billion` | Doanh thu năm (tỷ đồng) | `annualRevenue` |
| `has_existing_debt` | Có dư nợ hiện có (0 hoặc 1) | `hasExistingDebt` |
| `collateral_mode` | `PROPOSED`, `NONE_REQUESTED`, `UNDECIDED` | `collateral.mode` |
| `return_count` | Số lần đề nghị bị trả sửa trước khi tiếp nhận | số lần nộp trừ 1 |

### 4.2. `cases_v3.csv` (thêm)
| Cột | Ý nghĩa |
|---|---|
| `officer_workload_t0` | Số hồ sơ CBTD đang giữ lúc tiếp nhận |
| `supplement_rounds` | Số vòng yêu cầu bổ sung ở Tiếp nhận (0 đến 4) |
| `supplement_items_total` | Tổng số tài liệu bổ sung cần kiểm tra |
| `appraisal_queue_len`, `appraisers_active` | Số hồ sơ đang chờ ở Thẩm định và số Thẩm quyền hoạt động lúc vào Thẩm định |
| `clarify_rounds` | Số lần Thẩm quyền yêu cầu làm rõ tờ trình (0 đến 3) |
| `tn_bank_hours` | **Tổng giờ làm việc phía ngân hàng ở Tiếp nhận** (dùng gán nhãn) |
| `dn_wait_hours` | Giờ doanh nghiệp chờ bổ sung (chỉ để tham khảo, không tính SLA) |
| `td_bank_hours` | **Tổng giờ làm việc ở Thẩm định** (dùng gán nhãn) |

### 4.3. `tiep_nhan_snapshots_v3.csv` (thêm)
Điểm dự báo: `TN_T0` (khi tạo khoản vay) và `TN_BS_k` (khi doanh nghiệp nộp xong bổ sung lần thứ k, hồ sơ quay về cán bộ).
| Cột | Vai trò |
|---|---|
| `point` | Điểm dự báo |
| `supplement_rounds_so_far` | Đặc trưng: số vòng bổ sung đã diễn ra |
| `items_pending_review` | Đặc trưng: số tài liệu bổ sung đang chờ kiểm tra |
| `bank_hours_so_far` | Đặc trưng: giờ ngân hàng đã dùng ở Tiếp nhận tại thời điểm đó |
| `officer_workload` | Đặc trưng: tải CBTD tại thời điểm đó |
| `tn_bank_hours_total` | **Đáp án**: tổng giờ ngân hàng ở Tiếp nhận (gán nhãn trễ bằng ngưỡng SLA) |

### 4.4. `tham_dinh_snapshots_v3.csv` (thêm)
Điểm dự báo: `TD_VAO` (khi vào Thẩm định) và `TD_LR_k` (khi CBTD gửi lại sau lần làm rõ thứ k).
| Cột | Vai trò |
|---|---|
| `point` | Điểm dự báo |
| `supplement_rounds_total` | Đặc trưng: số vòng bổ sung đã có ở Tiếp nhận |
| `tn_bank_hours` | Đặc trưng: giờ ngân hàng đã dùng ở Tiếp nhận |
| `appraisal_queue_len`, `appraisers_active` | Đặc trưng: hàng chờ Thẩm định |
| `clarify_rounds_so_far` | Đặc trưng: số lần đã làm rõ |
| `td_hours_so_far` | Đặc trưng: giờ đã dùng ở Thẩm định tại thời điểm đó |
| `td_hours_total` | **Đáp án**: tổng giờ ở Thẩm định (gán nhãn trễ bằng ngưỡng SLA) |

### 4.5. Quy tắc dùng
- **Nhãn "trễ" = tổng giờ vượt ngưỡng SLA** (ví dụ `late = tn_bank_hours_total > SLA_TN`). Ngưỡng SLA là tham số, chưa chốt.
- **Không được dùng làm đặc trưng:** `tn_bank_hours_total`, `td_hours_total`, `tn_bank_hours`/`td_bank_hours` ở bảng hồ sơ cho dự báo của chính công đoạn đó, `dn_wait_hours` (rò rỉ đáp án).
- Mỗi hồ sơ có **nhiều dòng snapshot**: chia dữ liệu theo `split` (theo hồ sơ), không chia ngẫu nhiên theo dòng.
- Các đặc trưng đều là thông tin có tại thời điểm dự báo trong hệ thống thật (xem cột "nguồn" ở mục 4.1 và diễn biến xử lý đã có trong lịch sử công đoạn).

## 5. Nguồn của từng tham số
| Nhóm | Tham số | Nguồn |
|---|---|---|
| BPIC | Hình dạng thời gian chờ (độ lệch chuẩn log 1,09 của hàng đợi bắt đầu xử lý; 1,57 của hàng đợi xác thực làm tham chiếu đuôi dài), độ nhạy theo hàng đợi (0,56 và 0,64, hệ số xác định thấp 0,24 và 0,06), tỷ lệ cần bổ sung (22,4%), hồ sơ có bước theo dõi tốn thêm khoảng 1,27 đến 1,30 lần thời gian | `params/bpic2012_params.json` |
| Hệ thống | Số tiền tối đa 10 tỷ, các trường doanh nghiệp nộp, công đoạn Tiếp nhận và Thẩm định, SLA tạm dừng khi chờ doanh nghiệp, yêu cầu làm rõ không dừng SLA | Master, schema, form Portal V2 |
| Giả định, cần khảo sát | Trung vị thời gian của từng việc (chờ, kiểm tra, lập tờ trình, thẩm định, làm rõ), tỷ trọng ngành, tài sản bảo đảm, dư nợ, trả sửa, phân phối số tiền, số vòng bổ sung, số tài liệu bổ sung, hàng chờ và số Thẩm quyền, độ lớn yếu tố ẩn | Trong `simulate_v3.py` (nhãn `[GD]`), chưa có khảo sát |

Quyết định đã ghi: độ dày đuôi mặc định dùng độ lệch 1,09 (hàng đợi bắt đầu xử lý) thay vì 1,57, vì 1,57 cho đuôi quá dài (P99 hơn 250 giờ ở Thẩm định) so với mốc ngân hàng công bố.

## 6. Kết quả kiểm tra chất lượng (06/11/2026)
- 13 phép kiểm tra **đạt hết**: số tiền không vượt 10 tỷ, không thiếu dữ liệu, mã không trùng, thời gian không âm, mỗi hồ sơ một dòng điểm đầu, mọi snapshot cùng một tập, tỷ lệ cần bổ sung 23,8% (BPIC 22,4%), giờ ngân hàng của hồ sơ có bổ sung gấp 1,33 lần hồ sơ không có (BPIC 1,27–1,30), tải cán bộ và hàng chờ có tương quan dương với giờ xử lý, giờ đã dùng ở snapshot không vượt tổng.
- Phân phối giờ làm việc phía ngân hàng:

| | P50 | P75 | P90 | P95 | P99 |
|---|---|---|---|---|---|
| Tiếp nhận | 29,8 | 43,6 | 62,3 | 77,2 | 120,8 |
| Thẩm định | 20,2 | 33,2 | 52,5 | 68,7 | 114,2 |

- **Bảng kịch bản SLA** (tỷ lệ hồ sơ trễ theo mức SLA, giờ làm việc), lấy từ `quality_report_v3.json`:

| SLA Tiếp nhận (giờ) | 40 | 48 | 56 | 64 | 72 | 80 | 96 |
|---|---|---|---|---|---|---|---|
| Tỷ lệ trễ | 30,1% | 19,9% | 13,4% | 9,2% | 6,3% | 4,5% | 2,3% |

| SLA Thẩm định (giờ) | 24 | 32 | 40 | 48 | 56 | 64 | 80 |
|---|---|---|---|---|---|---|---|
| Tỷ lệ trễ | 40,5% | 26,5% | 17,9% | 12,2% | 8,5% | 6,1% | 3,2% |

- Với đề xuất chưa chốt (Tiếp nhận 80 giờ, Thẩm định 40 giờ): tỷ lệ trễ **4,5% và 17,9%**. Muốn tỷ lệ trễ khoảng 10%, SLA tương ứng là khoảng **62 giờ (Tiếp nhận)** và **52 giờ (Thẩm định)**. Các con số này là hệ quả của giả định `[GD]`, **không phải sự thật của ngân hàng**; cần khảo sát trước khi dựa vào.

## 7. Giới hạn
- Dữ liệu mô phỏng: kết quả mô hình sau này chỉ nói lên mô hình học được quy luật trong mô phỏng, không chứng minh độ chính xác trên hồ sơ thật.
- Trung vị thời gian từng việc và nhiều tỷ trọng là giả định chưa khảo sát.
- BPIC là vay cá nhân ở Hà Lan, năm 2011–2012; chỉ dùng hiệu chỉnh hình dạng. Độ nhạy theo hàng đợi trong BPIC rất yếu (hệ số xác định 0,06 và 0,24).
- Giấy phép BPIC là "4TU General Terms of Use": chưa đọc điều khoản; repo chỉ chứa tham số tổng hợp, không chứa dữ liệu gốc.
- Chưa mô phỏng: yêu cầu bổ sung do Thẩm quyền phát hành, điều chuyển giữa chừng, ngày nghỉ lễ và hồ sơ bị đóng quá hạn.
- Chưa chạy kịch bản đuôi dài (`SIM_SIGMA_QUEUE=1.566`) và chưa đo độ nhạy theo tham số giả định.
