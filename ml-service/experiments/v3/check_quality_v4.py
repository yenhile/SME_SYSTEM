"""Kiểm tra chất lượng bộ dữ liệu huấn luyện v4 (chạy sau simulate_v4.py, trước train_v4.py).

Kiểm các lỗi dễ làm hỏng mô hình mà không ai thấy: trùng hoặc rò rỉ giữa train/valid/test, giá trị ngoài miền, thiếu dòng lúc vào công đoạn,
thời gian không đơn điệu, nhãn "rò" vào đặc trưng, tỷ lệ trễ lệch xa so với kỳ vọng. Không sửa dữ liệu, chỉ báo PASS/FAIL.

Chạy: python check_quality_v4.py   ->  in kết quả, ghi results/quality_report_v4.json, thoát mã 1 nếu có mục FAIL.
"""
import json
import os
import sys

import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
RES = os.path.join(HERE, "results")
os.makedirs(RES, exist_ok=True)

cases = pd.read_csv(os.path.join(DATA, "cases_v4.csv"))
tn = pd.read_csv(os.path.join(DATA, "tiep_nhan_timeline_v4.csv"))
td = pd.read_csv(os.path.join(DATA, "tham_dinh_timeline_v4.csv"))

checks = []


def check(name, ok, detail=""):
    checks.append({"check": name, "result": "PASS" if ok else "FAIL", "detail": str(detail)})


# 1. Quy mô và khóa
check("20.000 hồ sơ, mã hồ sơ không trùng", len(cases) == 20000 and cases.case_id.is_unique, f"{len(cases)} dòng, {cases.case_id.nunique()} mã")
check("không có ô trống ở cả ba bảng", not (cases.isna().any().any() or tn.isna().any().any() or td.isna().any().any()))

# 2. Chia tập theo hồ sơ: không hồ sơ nào nằm ở hai tập, tỷ lệ gần 70/15/15
for name, df in (("Tiếp nhận", tn), ("Thẩm định", td)):
    per_case = df.groupby("case_id").split.nunique()
    check(f"{name}: mỗi hồ sơ chỉ thuộc một tập (không rò rỉ train/valid/test)", int(per_case.max()) == 1)
    check(f"{name}: tập của bảng ảnh chụp khớp tập của hồ sơ", df.drop_duplicates("case_id").merge(cases[["case_id", "split"]], on="case_id", suffixes=("", "_c")).eval("split == split_c").all())
share = cases.split.value_counts(normalize=True)
check("tỷ lệ chia tập gần 70/15/15 (sai lệch dưới 2 điểm %)", all(abs(share.get(k, 0) - v) < 0.02 for k, v in (("train", 0.70), ("valid", 0.15), ("test", 0.15))), share.round(3).to_dict())

# 3. Miền giá trị của hồ sơ
check("số tiền trong 0,01–10 tỷ", cases.proposed_amount_billion.between(0.01, 10).all())
check("thời hạn vay thuộc {3,6,9,12}", set(cases.loan_term_months.unique()) <= {3, 6, 9, 12})
check("ngành hợp lệ", set(cases.business_scope.unique()) <= {"SAN_XUAT", "THUONG_MAI", "DICH_VU", "KHAC"})
check("chế độ tài sản bảo đảm hợp lệ", set(cases.collateral_mode.unique()) <= {"PROPOSED", "NONE_REQUESTED", "UNDECIDED"})
check("has_existing_debt chỉ 0/1", set(cases.has_existing_debt.unique()) <= {0, 1})
check("doanh thu không nhỏ hơn 1,2 lần số tiền vay (đúng cách sinh)", (cases.annual_revenue_billion >= cases.proposed_amount_billion * 1.19).all())
check("số Thẩm quyền chỉ 2 hoặc 3 (khoảng mô hình học)", set(cases.appraisers_active.unique()) <= {2, 3}, sorted(cases.appraisers_active.unique().tolist()))

# 4. Dòng thời gian
for name, df, t0, total_col in (("Tiếp nhận", tn, "TN_T0", "tn_bank_hours"), ("Thẩm định", td, "TD_VAO", "td_bank_hours")):
    first = df.groupby("case_id").elapsed_hours.min()
    check(f"{name}: mọi hồ sơ có ảnh chụp lúc vào công đoạn (elapsed = 0)", len(first) == len(cases) and (first == 0).all(), f"{len(first)} hồ sơ")
    check(f"{name}: điểm chụp lúc vào đúng tên {t0}", (df[df.elapsed_hours == 0].point == t0).all())
    ties = int((df.elapsed_hours == df.stage_hours_total).sum())   # bằng nhau chỉ do làm tròn 2 chữ số khi thời điểm chụp sát ngay dưới tổng giờ
    check(f"{name}: giờ đã dùng không vượt tổng giờ của công đoạn (chỉ chụp khi hồ sơ còn mở; bằng nhau do làm tròn dưới 0,1% số dòng)", bool((df.elapsed_hours <= df.stage_hours_total).all()) and ties < 0.001 * len(df), f"{ties} dòng bằng nhau")
    check(f"{name}: giờ không có thao tác nhỏ hơn hoặc bằng giờ đã dùng", (df.hours_since_last_event <= df.elapsed_hours + 1e-6).all())
    mono = df.sort_values(["case_id", "elapsed_hours"]).groupby("case_id").elapsed_hours.apply(lambda s: s.is_monotonic_increasing).all()
    check(f"{name}: giờ đã dùng tăng dần trong từng hồ sơ", bool(mono))
    merged = df.drop_duplicates("case_id").merge(cases[["case_id", total_col]], on="case_id")
    check(f"{name}: tổng giờ trong bảng ảnh chụp khớp bảng hồ sơ", (abs(merged.stage_hours_total - merged[total_col]) < 0.011).all())

# 5. Rò rỉ nhãn: cột đáp án không được nằm trong đặc trưng của train_v4.py
train_src = open(os.path.join(HERE, "train_v4.py"), encoding="utf-8").read()
feature_block = train_src[train_src.index("CAT = ["):train_src.index("EVAL = ")]
check("cột đáp án stage_hours_total không nằm trong danh sách đặc trưng", "stage_hours_total" not in feature_block)
check("cột return_count (không dùng) không bị đưa vào đặc trưng", "return_count" not in feature_block)

# 6. Tỷ lệ trễ ở các mức SLA đang dùng (kỳ vọng nằm trong khoảng hợp lý, không phải 0% hay 100%)
late = {
    "Tiếp nhận SLA 112": float((cases.tn_bank_hours > 112).mean()),
    "Tiếp nhận SLA 80": float((cases.tn_bank_hours > 80).mean()),
    "Thẩm định SLA 40": float((cases.td_bank_hours > 40).mean()),
}
check("tỷ lệ hồ sơ trễ Tiếp nhận SLA 80 trong 2%–20%", 0.02 <= late["Tiếp nhận SLA 80"] <= 0.20, late)
check("tỷ lệ hồ sơ trễ Thẩm định SLA 40 trong 10%–50%", 0.10 <= late["Thẩm định SLA 40"] <= 0.50, late)
check("tỷ lệ trễ ở SLA 112 hiếm nhưng không bằng 0 (cảnh báo: số mẫu trễ ít nên số liệu nhiễu)", 0.0 < late["Tiếp nhận SLA 112"] < 0.10, late)

summary = {
    "rows": {"cases": len(cases), "tiep_nhan_snapshots": len(tn), "tham_dinh_snapshots": len(td)},
    "median_hours": {"tiep_nhan": round(float(cases.tn_bank_hours.median()), 1), "tham_dinh": round(float(cases.td_bank_hours.median()), 1)},
    "p90_hours": {"tiep_nhan": round(float(cases.tn_bank_hours.quantile(0.9)), 1), "tham_dinh": round(float(cases.td_bank_hours.quantile(0.9)), 1)},
    "late_rate_cases": {k: round(v, 4) for k, v in late.items()},
}
failed = [c for c in checks if c["result"] == "FAIL"]
for c in checks:
    print(f"[{c['result']}] {c['check']}" + (f"  ({c['detail']})" if c["result"] == "FAIL" and c["detail"] else ""))
print(f"\n{len(checks) - len(failed)}/{len(checks)} mục đạt")
with open(os.path.join(RES, "quality_report_v4.json"), "w", encoding="utf-8") as fh:
    json.dump({"summary": summary, "checks": checks}, fh, ensure_ascii=False, indent=2)
sys.exit(1 if failed else 0)
