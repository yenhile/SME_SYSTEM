"""Bộ mô phỏng v3: hồ sơ vay SME qua hai công đoạn Tiếp nhận và Thẩm định, thời gian tính theo GIỜ LÀM VIỆC.

Mục đích: tạo bộ dữ liệu để huấn luyện mô hình dự báo nguy cơ trễ SLA ở cả hai công đoạn.
Không thay thế mô hình, dữ liệu hay mã đang chạy của ml-service.

Nguyên tắc thiết kế
  1. Dữ liệu lưu THỜI GIAN THỰC (giờ làm việc ngân hàng đã dùng). Nhãn "trễ" gán sau bằng một ngưỡng SLA tham số,
     nên SLA chưa chốt vẫn dùng được và đổi SLA chỉ cần gán nhãn lại.
  2. Hình dạng phân phối thời gian chờ và tỷ lệ cần bổ sung lấy từ BPI Challenge 2012 (params/bpic2012_params.json).
     Mức thời gian (trung vị) của từng việc là giả định cần khảo sát cán bộ tín dụng xác nhận.
  3. Thời gian chờ doanh nghiệp bổ sung chỉ ghi riêng (dn_wait_*), KHÔNG tính vào giờ ngân hàng (đúng chính sách SLA PA1).
  4. Có yếu tố ẩn (kinh nghiệm cán bộ, độ phức tạp thực) không đưa vào đặc trưng, để mô hình không đạt điểm ảo.
  5. Số tiền tối đa 10 tỷ; không có công đoạn cấp trên.

Nhãn nguồn của từng tham số: [BPIC] rút từ BPI Challenge 2012; [HT] theo hệ thống SME; [GD] giả định cần khảo sát.
"""
import hashlib
import json
import os
import sys

import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
SEED = int(os.environ.get("SIM_SEED", 2026))
N = int(os.environ.get("SIM_N", 20000))

with open(os.path.join(HERE, "params", "bpic2012_params.json"), encoding="utf-8") as fh:
    BPIC = json.load(fh)

# ----------------------------------------------------------------------------------------------
# Tham số
# ----------------------------------------------------------------------------------------------
PARAMS = {
    # [BPIC] hình dạng phân phối thời gian chờ và độ nhạy theo hàng đợi
    "sigma_review_queue": BPIC["review_queue_W_Valideren"]["lognormal_sigma"],
    "beta_review_queue": BPIC["review_queue_W_Valideren"]["queue_elasticity_beta"],
    "sigma_first_handling": BPIC["first_handling_queue_W_Completeren"]["lognormal_sigma"],
    "beta_first_handling": BPIC["first_handling_queue_W_Completeren"]["queue_elasticity_beta"],
    # Độ lệch chuẩn (log) dùng cho thời gian chờ đến lượt xử lý ở cả hai công đoạn. Mặc định lấy của hàng đợi "bắt đầu xử lý" trong BPIC (1,09).
    # Không dùng 1,57 của hàng đợi xác thực vì cho đuôi quá dài (P99 hơn 250 giờ) so với mốc ngân hàng công bố (thẩm định thông thường 3-5 ngày).
    # Đặt SIM_SIGMA_QUEUE=1.566 để chạy kịch bản đuôi dài (phân tích độ nhạy).
    "sigma_queue_used": float(os.environ.get("SIM_SIGMA_QUEUE", BPIC["first_handling_queue_W_Completeren"]["lognormal_sigma"])),
    "bpic_chase_rate": BPIC["supplement_like_chase"]["chase_rate"],           # [BPIC] 22,4% hồ sơ cần theo dõi bổ sung
    "bpic_chase_ratio_target": 1.3,                                           # [BPIC] hồ sơ có theo dõi lâu hơn khoảng 1,27 đến 1,30 lần (đã kiểm soát kết cục)
    # [GD] mức thời gian (giờ làm việc), cần khảo sát
    "tn_first_wait_median": 4.0,       # BPIC trung vị 2,0 giờ, nhân 2 cho nghiệp vụ thủ công
    "tn_initial_work_median": 8.0,
    "tn_initial_work_sigma": 0.5,
    "tn_round_wait_median": 2.5,       # chờ đến lượt cán bộ kiểm tra bổ sung
    "tn_review_per_doc_median": 0.8,   # mỗi tài liệu bổ sung cần kiểm tra
    "tn_review_overhead": 0.5,
    "tn_proposal_work_median": 8.0,    # xác định hạn mức, xác nhận đủ hồ sơ, lập và trình tờ trình
    "tn_proposal_work_sigma": 0.45,
    "td_wait_median": 5.0,
    "td_review_median": 7.0,
    "td_review_sigma": 0.5,
    "td_clarify_cbtd_median": 5.0,     # cán bộ giải trình sau khi bị yêu cầu làm rõ (SLA không dừng)
    "td_clarify_cbtd_sigma": 0.6,
    "td_clarify_wait_median": 2.0,
    "td_clarify_review_median": 2.5,
    "td_decision_work": 0.5,
    "dn_wait_median": 24.0,            # doanh nghiệp phản hồi bổ sung (giờ làm việc), chỉ ghi, không tính SLA
    "dn_wait_sigma": 0.9,
    "hidden_speed_sigma": 0.25,        # tốc độ của từng cán bộ (ẩn)
    "hidden_complexity_sigma": 0.30,   # độ phức tạp thực của hồ sơ (ẩn, ảnh hưởng cả hai công đoạn)
    "workload_ref": 7,                 # tải tham chiếu của CBTD (số hồ sơ đang mở)
    "queue_ratio_ref": 1.6,            # số hồ sơ chờ thẩm định trên mỗi Thẩm quyền, tham chiếu
}
P = PARAMS
rng = np.random.default_rng(SEED)


def lognorm(median, sigma):
    return float(median * np.exp(sigma * rng.standard_normal()))


def split_of(case_id: str) -> str:
    h = int(hashlib.md5(case_id.encode()).hexdigest(), 16) % 100
    return "train" if h < 70 else ("valid" if h < 85 else "test")


def draw_case(i):
    """Thông tin hồ sơ và các biến ẩn."""
    amount = float(np.clip(rng.lognormal(np.log(2.0), 0.9), 0.01, 10.0))               # [HT] trần 10 tỷ; [GD] phân phối
    term = int(rng.choice([3, 6, 9, 12], p=[0.10, 0.25, 0.25, 0.40]))                    # [GD] vốn lưu động ngắn hạn
    scope = str(rng.choice(["SAN_XUAT", "THUONG_MAI", "DICH_VU", "KHAC"], p=[0.30, 0.40, 0.25, 0.05]))  # [HT] businessScope; [GD] tỷ trọng
    years = int(np.clip(rng.gamma(2.5, 3.5), 1, 40))                                     # [GD]
    revenue = float(max(rng.lognormal(np.log(15.0), 0.8), amount * 1.2))                 # [GD] tỷ đồng
    has_debt = int(rng.random() < 0.55)                                                  # [GD] hasExistingDebt
    collateral = str(rng.choice(["PROPOSED", "NONE_REQUESTED", "UNDECIDED"], p=[0.55, 0.30, 0.15]))  # [HT] collateral.mode; [GD] tỷ trọng
    p_return = 0.12 + 0.05 * (collateral == "PROPOSED") + 0.03 * has_debt               # [GD]
    returns = 0
    while returns < 3 and rng.random() < p_return * (0.6 ** returns):
        returns += 1
    workload = int(np.clip(rng.poisson(P["workload_ref"]) + 1, 1, 20))                   # [GD] CBTD đang giữ bao nhiêu hồ sơ
    p_supp = (P["bpic_chase_rate"] - 0.05) + 0.05 * has_debt + 0.05 * (collateral == "PROPOSED") + 0.03 * (scope == "SAN_XUAT")  # [BPIC] tỷ lệ; [GD] phụ thuộc
    rounds = 0
    if rng.random() < p_supp:
        rounds = int(min(1 + rng.geometric(0.55) - 1, 4))                                # [GD] số vòng bổ sung chính thức (BPIC đếm lần gọi nên không dùng trực tiếp)
    return dict(amount=amount, term=term, scope=scope, years=years, revenue=revenue, has_debt=has_debt,
                collateral=collateral, returns=returns, workload=workload, rounds=rounds)


def simulate_one(i):
    c = draw_case(i)
    case_id = f"SIM3-{i + 1:06d}"
    speed_cb = lognorm(1.0, P["hidden_speed_sigma"])
    speed_tq = lognorm(1.0, P["hidden_speed_sigma"])
    cpx = lognorm(1.0, P["hidden_complexity_sigma"])
    comp_tn = 1 + 0.15 * (c["collateral"] == "PROPOSED") + 0.10 * c["has_debt"] + 0.08 * c["returns"] + 0.05 * min(c["amount"], 10) ** 0.5
    qf_tn = ((1 + c["workload"]) / (1 + P["workload_ref"])) ** P["beta_first_handling"]

    # ---------------- Tiếp nhận (giờ làm việc phía ngân hàng) ----------------
    m_tn = speed_cb * cpx
    q0 = lognorm(P["tn_first_wait_median"] * qf_tn, P["sigma_first_handling"]) * m_tn
    w0 = lognorm(P["tn_initial_work_median"] * comp_tn, P["tn_initial_work_sigma"]) * m_tn
    bank_so_far = q0 + w0
    tn_snaps = [dict(point="TN_T0", supplement_rounds_so_far=0, items_pending_review=0, bank_hours_so_far=0.0,
                     officer_workload=c["workload"])]
    dn_wait_total = 0.0
    items_total = 0
    for k in range(1, c["rounds"] + 1):
        dn_wait_total += lognorm(P["dn_wait_median"], P["dn_wait_sigma"])               # không tính SLA
        items = 1 + int(rng.poisson(1.5))
        items_total += items
        w_k = int(np.clip(c["workload"] + rng.normal(0, 1.5), 1, 20))
        tn_snaps.append(dict(point=f"TN_BS_{k}", supplement_rounds_so_far=k, items_pending_review=items,
                             bank_hours_so_far=bank_so_far, officer_workload=w_k))
        qf_k = ((1 + w_k) / (1 + P["workload_ref"])) ** P["beta_review_queue"]
        qr = lognorm(P["tn_round_wait_median"] * qf_k, P["sigma_queue_used"]) * m_tn
        rv = (P["tn_review_overhead"] + sum(lognorm(P["tn_review_per_doc_median"], 0.5) for _ in range(items))) * m_tn
        bank_so_far += qr + rv
    tt = lognorm(P["tn_proposal_work_median"] * comp_tn, P["tn_proposal_work_sigma"]) * m_tn
    tn_total = bank_so_far + tt

    # ---------------- Thẩm định ----------------
    appraisers = int(rng.choice([2, 3], p=[0.5, 0.5]))                                   # [GD] số Thẩm quyền đang hoạt động
    queue_len = int(rng.poisson(4))                                                      # [GD] số hồ sơ đang chờ ở Thẩm định
    ratio = queue_len / appraisers
    qf_td = ((1 + ratio) / (1 + P["queue_ratio_ref"])) ** P["beta_review_queue"]
    m_td = speed_tq * cpx
    cx = 1 + 0.12 * min(c["amount"], 10) ** 0.5 + 0.20 * (c["collateral"] == "PROPOSED") + 0.10 * c["has_debt"] \
        + 0.06 * min(c["rounds"], 4) + 0.04 * c["returns"]
    qt = lognorm(P["td_wait_median"] * qf_td, P["sigma_queue_used"]) * m_td
    rw = lognorm(P["td_review_median"] * cx, P["td_review_sigma"]) * m_td
    td_so_far = qt + rw
    td_snaps = [dict(point="TD_VAO", clarify_rounds_so_far=0, td_hours_so_far=0.0)]
    p_cl = float(np.clip(0.12 + 0.10 * (c["collateral"] == "PROPOSED") + 0.05 * c["has_debt"] + 0.04 * min(c["rounds"], 3)
                         + 0.02 * (c["amount"] > 5), 0.0, 0.6))                        # [GD]
    clar = 0
    while clar < 3 and rng.random() < (p_cl if clar == 0 else 0.35):
        clar += 1
        resp = lognorm(P["td_clarify_cbtd_median"], P["td_clarify_cbtd_sigma"]) * speed_cb * cpx  # CBTD giải trình, SLA vẫn chạy
        td_so_far += resp
        td_snaps.append(dict(point=f"TD_LR_{clar}", clarify_rounds_so_far=clar, td_hours_so_far=td_so_far))
        td_so_far += (lognorm(P["td_clarify_wait_median"] * qf_td, P["sigma_queue_used"])
                      + lognorm(P["td_clarify_review_median"], 0.5)) * m_td
    td_total = td_so_far + P["td_decision_work"] * m_td

    static = dict(case_id=case_id, split=split_of(case_id),
                  proposed_amount_billion=round(c["amount"], 2), loan_term_months=c["term"], business_scope=c["scope"],
                  established_years=c["years"], annual_revenue_billion=round(c["revenue"], 2),
                  has_existing_debt=c["has_debt"], collateral_mode=c["collateral"], return_count=c["returns"])
    case_row = dict(**static, officer_workload_t0=c["workload"], supplement_rounds=c["rounds"], supplement_items_total=items_total,
                    appraisal_queue_len=queue_len, appraisers_active=appraisers, clarify_rounds=clar,
                    tn_bank_hours=round(tn_total, 2), dn_wait_hours=round(dn_wait_total, 2), td_bank_hours=round(td_total, 2))
    tn_rows = [dict(**static, **s, tn_bank_hours_total=round(tn_total, 2)) for s in tn_snaps]
    for s in tn_rows:
        s["bank_hours_so_far"] = round(s["bank_hours_so_far"], 2)
    td_rows = [dict(**static, supplement_rounds_total=c["rounds"], tn_bank_hours=round(tn_total, 2), appraisal_queue_len=queue_len,
                    appraisers_active=appraisers, **s, td_hours_total=round(td_total, 2)) for s in td_snaps]
    for s in td_rows:
        s["td_hours_so_far"] = round(s["td_hours_so_far"], 2)
    return case_row, tn_rows, td_rows


def main():
    cases, tn, td = [], [], []
    for i in range(N):
        a, b, c = simulate_one(i)
        cases.append(a); tn.extend(b); td.extend(c)
    out = os.path.join(HERE, "data")
    os.makedirs(out, exist_ok=True)
    pd.DataFrame(cases).to_csv(os.path.join(out, "cases_v3.csv"), index=False, encoding="utf-8")
    pd.DataFrame(tn).to_csv(os.path.join(out, "tiep_nhan_snapshots_v3.csv"), index=False, encoding="utf-8")
    pd.DataFrame(td).to_csv(os.path.join(out, "tham_dinh_snapshots_v3.csv"), index=False, encoding="utf-8")
    with open(os.path.join(out, "generation_config_v3.json"), "w", encoding="utf-8") as fh:
        json.dump({"seed": SEED, "n_cases": N, "params": PARAMS, "bpic_source": BPIC["source"],
                   "note": "Các tham số [GD] trong simulate_v3.py là giả định cần khảo sát cán bộ tín dụng."}, fh, ensure_ascii=False, indent=2)
    print(f"cases={len(cases)} tn_rows={len(tn)} td_rows={len(td)}")


if __name__ == "__main__":
    main()
