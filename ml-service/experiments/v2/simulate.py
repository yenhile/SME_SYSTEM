"""Bước 3: mô phỏng hồ sơ SME qua công đoạn Thẩm định (giờ làm việc PA1) và dán nhãn trễ SLA.

Thực nghiệm v2, không thay thế mô hình đang chạy. Mọi tham số ghi rõ nguồn:
  [BPIC]  = hình dạng phân phối rút từ BPI Challenge 2012 (phân tích ngày 04/11/2026)
  [GD]    = giả định, CẦN khảo sát cán bộ tín dụng để xác nhận
  [HT]    = lấy từ cấu hình hoặc quy tắc của hệ thống SME
Nhãn is_late là kết quả mô phỏng (tổng giờ làm việc ở Thẩm định so với định mức), không phải công thức logit trực tiếp.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

N = int(os.environ.get("SIM_N", 12000))
SEED = int(os.environ.get("SIM_SEED", 2026))
SLA_THAM_DINH_HOURS = 24   # [HT] định mức công đoạn Thẩm định (seed: standardSlaHours=24)
WAIT_SIGMA = 1.2           # [BPIC] P90/trung vị thời gian chờ W_Valideren aanvraag = 118/25.8 ≈ 4.6 => sigma ≈ 1.19
WAIT_BASE_MEDIAN = float(os.environ.get("SIM_WAIT_BASE", 2.0))  # [GD] trung vị giờ chờ hàng đợi khi cán bộ có 7 hồ sơ; hiệu chỉnh để tỷ lệ trễ ~11% (thầy: khoảng 10 trễ, 90 đúng hạn)
HERE = os.path.dirname(__file__)


def main():
    rng = np.random.default_rng(SEED)

    # --- Thông tin doanh nghiệp nộp (có trong form portal) ---
    amount = np.clip(rng.lognormal(mean=np.log(2.0), sigma=0.9, size=N), 0.01, 10.0)  # tỷ đồng, [HT] trần 10 tỷ; [GD] phân phối
    term = rng.choice([3, 6, 9, 12], size=N, p=[0.10, 0.25, 0.25, 0.40])               # [GD] vốn lưu động ngắn hạn
    scope = rng.choice(["SAN_XUAT", "THUONG_MAI", "DICH_VU", "KHAC"], size=N, p=[0.30, 0.40, 0.25, 0.05])  # [HT] businessScope; [GD] tỷ trọng
    years = np.clip(rng.gamma(2.5, 3.5, size=N), 1, 40).astype(int)                    # [GD]
    revenue = np.maximum(rng.lognormal(np.log(15.0), 0.8, size=N), amount * 1.2)       # tỷ đồng, [GD]
    has_debt = rng.random(N) < 0.55                                                    # [GD] hasExistingDebt
    collateral = rng.choice(["PROPOSED", "NONE_REQUESTED", "UNDECIDED"], size=N, p=[0.55, 0.30, 0.15])  # [HT] collateral.mode; [GD] tỷ trọng

    # --- Diễn biến trước Thẩm định ---
    p_need_supp = 0.16 + 0.05 * has_debt + 0.05 * (collateral == "PROPOSED")           # [BPIC] ~22% hồ sơ cần theo dõi bổ sung; [GD] phụ thuộc
    need_supp = rng.random(N) < p_need_supp
    supplement = np.where(need_supp, np.minimum(1 + rng.geometric(0.5, size=N) - 1, 5), 0)  # [BPIC] đuôi dài số lần lặp
    returns = rng.choice([0, 1, 2, 3], size=N, p=[0.80, 0.14, 0.045, 0.015])            # [GD] số lần trả sửa
    workload = np.clip(rng.poisson(7, size=N), 1, 20)                                  # [GD] hồ sơ đang mở của cán bộ
    intake_hours = rng.lognormal(np.log(2.5), 0.6, size=N) + 1.5 * returns             # [GD]; [HT] định mức Tiếp nhận 4 giờ

    # --- Thẩm định: thời gian làm + thời gian chờ hàng đợi (giờ làm việc) ---
    service_med = (4.0 + 1.0 * amount ** 0.6 + 2.5 * (collateral == "PROPOSED") + 1.5 * has_debt
                   + 2.0 * supplement + 1.2 * returns + 0.5 * (scope == "SAN_XUAT"))   # [GD]
    service = service_med * rng.lognormal(0, 0.35, size=N)
    wait_med = WAIT_BASE_MEDIAN * np.exp(0.13 * (workload - 7))                        # [GD] tải cao => chờ lâu hơn ([BPIC]: trễ chủ yếu do chờ)
    wait = wait_med * rng.lognormal(0, WAIT_SIGMA, size=N)                             # [BPIC] hình dạng đuôi dài
    speed = rng.lognormal(0, 0.25, size=N)                                             # yếu tố ẩn (kinh nghiệm cán bộ), KHÔNG đưa vào đặc trưng
    total = (service + wait) * speed

    df = pd.DataFrame({
        "application_id": [f"SIM-{i + 1:05d}" for i in range(N)],
        "proposed_amount_billion": np.round(amount, 2),
        "loan_term_months": term,
        "business_scope": scope,
        "established_years": years,
        "annual_revenue_billion": np.round(revenue, 2),
        "has_existing_debt": has_debt.astype(int),
        "collateral_mode": collateral,
        "supplement_count": supplement,
        "return_count": returns,
        "officer_workload": workload,
        "intake_work_hours": np.round(intake_hours, 1),
        "appraisal_work_hours": np.round(total, 1),   # chỉ để kiểm tra, KHÔNG dùng làm đặc trưng
        "is_late": (total > SLA_THAM_DINH_HOURS).astype(int),
    })
    out_dir = os.path.join(HERE, "data")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "sme_appraisal_delay_sim_v2.csv")
    df.to_csv(path, index=False, encoding="utf-8")

    summary = {
        "seed": SEED, "n": N, "sla_hours": SLA_THAM_DINH_HOURS, "wait_base_median": WAIT_BASE_MEDIAN,
        "late_count": int(df.is_late.sum()), "late_rate": round(float(df.is_late.mean()), 4),
        "max_amount_billion": float(df.proposed_amount_billion.max()),
        "share_over_10_billion": float((df.proposed_amount_billion > 10).mean()),
        "appraisal_hours_p50": round(float(np.percentile(total, 50)), 1),
        "appraisal_hours_p90": round(float(np.percentile(total, 90)), 1),
        "supplement_share": round(float((supplement > 0).mean()), 4),
    }
    with open(os.path.join(out_dir, "sim_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
