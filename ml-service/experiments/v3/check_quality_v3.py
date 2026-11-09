"""Kiểm tra chất lượng bộ dữ liệu v3 và lập bảng kịch bản SLA. Chạy sau simulate_v3.py.

Ghi data/quality_report_v3.json. Không đọc hay ghi gì ngoài thư mục v3.
"""
import json
import os
import sys

import numpy as np
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
DATA = os.path.join(HERE, "data")
cases = pd.read_csv(os.path.join(DATA, "cases_v3.csv"))
tn = pd.read_csv(os.path.join(DATA, "tiep_nhan_snapshots_v3.csv"))
td = pd.read_csv(os.path.join(DATA, "tham_dinh_snapshots_v3.csv"))
with open(os.path.join(HERE, "params", "bpic2012_params.json"), encoding="utf-8") as fh:
    bpic = json.load(fh)

rep, checks = {}, []


def check(name, ok, detail):
    checks.append({"check": name, "pass": bool(ok), "detail": detail})


def pct(s):
    return {f"p{p}": round(float(np.percentile(s, p)), 1) for p in (10, 25, 50, 75, 90, 95, 99)}


# 1. Phạm vi và dữ liệu thiếu
check("Số tiền tối đa 10 tỷ", cases.proposed_amount_billion.max() <= 10.0, f"max={cases.proposed_amount_billion.max()}")
check("Số tiền tối thiểu 0,01 tỷ (10 triệu)", cases.proposed_amount_billion.min() >= 0.01, f"min={cases.proposed_amount_billion.min()}")
check("Không thiếu dữ liệu ở bảng hồ sơ", int(cases.isna().sum().sum()) == 0, "tổng ô thiếu=" + str(int(cases.isna().sum().sum())))
check("Không thiếu dữ liệu ở snapshot Tiếp nhận", int(tn.isna().sum().sum()) == 0, "")
check("Không thiếu dữ liệu ở snapshot Thẩm định", int(td.isna().sum().sum()) == 0, "")
check("Mã hồ sơ không trùng", cases.case_id.is_unique, "")
check("Thời gian không âm", (cases[["tn_bank_hours", "dn_wait_hours", "td_bank_hours"]] >= 0).all().all(), "")
check("Mỗi hồ sơ có đúng một dòng T0 và một dòng TD_VAO",
      (tn.point == "TN_T0").sum() == len(cases) and (td.point == "TD_VAO").sum() == len(cases), "")

# 2. Tách tập theo hồ sơ (không rò rỉ giữa các snapshot của cùng hồ sơ)
split_per_case = tn.groupby("case_id").split.nunique().max()
check("Mọi snapshot của một hồ sơ cùng một tập (train/valid/test)", split_per_case == 1, f"max số tập khác nhau trên mỗi hồ sơ={split_per_case}")
rep["split_share"] = cases.split.value_counts(normalize=True).round(3).to_dict()

# 3. Phân phối thời gian (giờ làm việc ngân hàng)
rep["tn_bank_hours"] = pct(cases.tn_bank_hours)
rep["td_bank_hours"] = pct(cases.td_bank_hours)
rep["dn_wait_hours_among_supplement_cases"] = pct(cases.loc[cases.supplement_rounds > 0, "dn_wait_hours"])
rep["total_hours_incl_dn_wait"] = pct(cases.tn_bank_hours + cases.dn_wait_hours + cases.td_bank_hours)

# 4. So với nguồn tham khảo
rate = float((cases.supplement_rounds > 0).mean())
check("Tỷ lệ cần bổ sung gần BPIC (22,4%)", abs(rate - bpic["supplement_like_chase"]["chase_rate"]) < 0.04,
      f"mô phỏng={rate:.3f}, BPIC={bpic['supplement_like_chase']['chase_rate']}")
tot = cases.tn_bank_hours + cases.dn_wait_hours + cases.td_bank_hours
ratio = float(tot[cases.supplement_rounds > 0].median() / tot[cases.supplement_rounds == 0].median())
bank_ratio = float(((cases.tn_bank_hours + cases.td_bank_hours)[cases.supplement_rounds > 0]).median() / ((cases.tn_bank_hours + cases.td_bank_hours)[cases.supplement_rounds == 0]).median())
check("Hồ sơ có bổ sung tốn thêm giờ ngân hàng cùng bậc với BPIC (hồ sơ có bước theo dõi lâu hơn 1,27 đến 1,30 lần, đã kiểm soát kết cục)", 1.15 <= bank_ratio <= 1.6,
      f"mô phỏng (giờ phía ngân hàng)={bank_ratio:.2f}; tổng gồm chờ doanh nghiệp={ratio:.2f} (không so với BPIC vì bước theo dõi của BPIC là ngân hàng gọi khách, khác chờ bổ sung chính thức)")
ap = bpic["approved_case_total_wh"]
check("Tổng thời gian cả hồ sơ cùng bậc với BPIC (hồ sơ được duyệt: trung vị 81,7 giờ, P90 163,8 giờ)",
      0.3 * ap["p50"] <= np.percentile(tot, 50) <= 1.5 * ap["p50"], f"mô phỏng trung vị={np.percentile(tot, 50):.1f}, P90={np.percentile(tot, 90):.1f}")
rep["supplement_case_rate"] = round(rate, 4)
rep["chase_ratio_total_median_incl_dn_wait"] = round(ratio, 3)
rep["chase_ratio_bank_hours_median"] = round(bank_ratio, 3)

# 5. Quan hệ phải có hướng đúng (kiểm tra chiều, không tuyệt đối)
corr_tn_workload = cases[["officer_workload_t0", "tn_bank_hours"]].corr().iloc[0, 1]
corr_td_queue = cases[["appraisal_queue_len", "td_bank_hours"]].corr().iloc[0, 1]
check("Tải cán bộ tăng thì giờ Tiếp nhận tăng", corr_tn_workload > 0, f"tương quan={corr_tn_workload:.3f}")
check("Hàng chờ thẩm định dài thì giờ Thẩm định tăng", corr_td_queue > 0, f"tương quan={corr_td_queue:.3f}")
check("Số vòng bổ sung tăng thì giờ Tiếp nhận tăng", cases[["supplement_rounds", "tn_bank_hours"]].corr().iloc[0, 1] > 0, "")
check("Các yếu tố ẩn không đủ để đoán (tương quan đơn lẻ vẫn vừa phải)", abs(corr_tn_workload) < 0.6 and abs(corr_td_queue) < 0.6,
      f"|tn|={abs(corr_tn_workload):.3f}, |td|={abs(corr_td_queue):.3f}")
rep["corr_workload_vs_tn_hours"] = round(float(corr_tn_workload), 3)
rep["corr_queue_vs_td_hours"] = round(float(corr_td_queue), 3)

# 6. Snapshot hợp lý
tn_last = tn.sort_values(["case_id", "supplement_rounds_so_far"]).groupby("case_id").tail(1)
check("Giờ đã dùng ở snapshot không vượt tổng giờ của hồ sơ", (tn.bank_hours_so_far <= tn.tn_bank_hours_total + 1e-6).all(), "")
check("Giờ đã dùng ở snapshot Thẩm định không vượt tổng", (td.td_hours_so_far <= td.td_hours_total + 1e-6).all(), "")
rep["rows"] = {"cases": len(cases), "tiep_nhan_snapshots": len(tn), "tham_dinh_snapshots": len(td)}
rep["tn_rows_by_point_family"] = tn.point.str.replace(r"_\d+$", "", regex=True).value_counts().to_dict()
rep["td_rows_by_point_family"] = td.point.str.replace(r"_\d+$", "", regex=True).value_counts().to_dict()

# 7. Kịch bản SLA: tỷ lệ hồ sơ trễ theo từng mức (giờ làm việc)
def scenario(series, levels):
    return {str(h): round(float((series > h).mean()), 4) for h in levels}


rep["late_rate_by_sla_tiep_nhan"] = scenario(cases.tn_bank_hours, [24, 32, 40, 48, 56, 64, 72, 80, 96])
rep["late_rate_by_sla_tham_dinh"] = scenario(cases.td_bank_hours, [16, 24, 32, 40, 48, 56, 64, 80])
rep["sla_for_late_rate_tiep_nhan"] = {f"{int(q * 100)}%": round(float(np.percentile(cases.tn_bank_hours, 100 - q * 100)), 1) for q in (0.15, 0.10, 0.05)}
rep["sla_for_late_rate_tham_dinh"] = {f"{int(q * 100)}%": round(float(np.percentile(cases.td_bank_hours, 100 - q * 100)), 1) for q in (0.15, 0.10, 0.05)}

# 8. Trễ chung theo dự kiến PO (đề xuất chưa chốt): Tiếp nhận 80 giờ, Thẩm định 40 giờ
rep["proposed_sla_scenario"] = {"tn_80h_late_rate": round(float((cases.tn_bank_hours > 80).mean()), 4),
                                "td_40h_late_rate": round(float((cases.td_bank_hours > 40).mean()), 4)}

rep["checks"] = checks
rep["all_checks_pass"] = all(c["pass"] for c in checks)
with open(os.path.join(DATA, "quality_report_v3.json"), "w", encoding="utf-8") as fh:
    json.dump(rep, fh, ensure_ascii=False, indent=2)
print(json.dumps(rep, ensure_ascii=False, indent=2))
