"""Huấn luyện và đánh giá mô hình v3 cho hai công đoạn (Tiếp nhận, Thẩm định).

Nhãn = tổng giờ làm việc phía ngân hàng của công đoạn VƯỢT SLA (trễ). Không rule base.
Chia train/valid/test theo hồ sơ (cột split). Chọn mô hình theo PR-AUC trên valid, báo cáo trên test.
Chạy: python train_v3.py  -> results/metrics_v3.json, models/*.joblib
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA, RES, MOD = (os.path.join(HERE, d) for d in ("data", "results", "models"))
os.makedirs(RES, exist_ok=True)
os.makedirs(MOD, exist_ok=True)

CAT = ["business_scope", "collateral_mode", "point"]
BASE_NUM = ["proposed_amount_billion", "loan_term_months", "established_years", "annual_revenue_billion", "has_existing_debt", "return_count"]
STAGES = {
    "tiep_nhan": dict(file="tiep_nhan_snapshots_v3.csv", total="tn_bank_hours_total", elapsed="bank_hours_so_far",
                      num=BASE_NUM + ["supplement_rounds_so_far", "items_pending_review", "bank_hours_so_far", "officer_workload"]),
    "tham_dinh": dict(file="tham_dinh_snapshots_v3.csv", total="td_hours_total", elapsed="td_hours_so_far",
                      num=BASE_NUM + ["supplement_rounds_total", "tn_bank_hours", "appraisal_queue_len", "appraisers_active", "clarify_rounds_so_far", "td_hours_so_far"]),
}
# Kịch bản SLA (giờ làm việc). A = đề xuất của PO (chưa chốt); B = mức cho khoảng 15% hồ sơ trễ.
SCENARIOS = {"A_de_xuat_PO": {"tiep_nhan": 80, "tham_dinh": 40}, "B_tre_15pct": {"tiep_nhan": 54, "tham_dinh": 44}}


def build(kind, num):
    pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore"), CAT), ("n", StandardScaler() if kind == "lr" else "passthrough", num)])
    est = {"lr": LogisticRegression(max_iter=2000, class_weight="balanced"),
           "rf": RandomForestClassifier(n_estimators=300, min_samples_leaf=20, class_weight="balanced_subsample", n_jobs=-1, random_state=1),
           "gb": HistGradientBoostingClassifier(max_depth=4, learning_rate=0.06, max_iter=300, l2_regularization=1.0, random_state=1)}[kind]
    return Pipeline([("pre", pre), ("m", est)])


def metrics(y, p, prob=True):
    if y.sum() == 0 or y.sum() == len(y):
        return None
    top = np.argsort(-p)[: max(1, int(0.1 * len(p)))]
    return {"roc_auc": round(roc_auc_score(y, p), 4), "pr_auc": round(average_precision_score(y, p), 4), "brier": round(brier_score_loss(y, p), 4) if prob else None,
            "base_rate": round(float(y.mean()), 4), "precision_top10pct": round(float(y[top].mean()), 4),
            "recall_top10pct": round(float(y[top].sum() / y.sum()), 4)}


out, best_models = {}, {}
for sname, cfg in STAGES.items():
    df = pd.read_csv(os.path.join(DATA, cfg["file"]))
    feats = CAT + cfg["num"]
    for scen, sla in SCENARIOS.items():
        y_all = (df[cfg["total"]] > sla[sname]).astype(int)
        tr, va, te = (df.split == s for s in ("train", "valid", "test"))
        res = {"sla_hours": sla[sname], "late_rate": {"train": round(float(y_all[tr].mean()), 4), "test": round(float(y_all[te].mean()), 4)}, "models": {}}
        fitted = {}
        # Đường cơ sở: chỉ biết giờ đã dùng (không có mô hình), dùng chính giờ đã dùng làm điểm số
        res["baseline_hours_so_far_only"] = metrics(y_all[te].values, df.loc[te, cfg["elapsed"]].values, prob=False)
        for kind in ("lr", "rf", "gb"):
            pipe = build(kind, cfg["num"]).fit(df.loc[tr, feats], y_all[tr])
            pv = pipe.predict_proba(df.loc[va, feats])[:, 1]
            pt = pipe.predict_proba(df.loc[te, feats])[:, 1]
            res["models"][kind] = {"valid": metrics(y_all[va].values, pv), "test": metrics(y_all[te].values, pt)}
            fitted[kind] = pipe
        best = max(res["models"], key=lambda k: res["models"][k]["valid"]["pr_auc"])
        res["best_by_valid_pr_auc"] = best
        # Theo thời điểm dự báo (test), mô hình tốt nhất
        pt = fitted[best].predict_proba(df.loc[te, feats])[:, 1]
        fam = df.loc[te, "point"].str.replace(r"_\d+$", "", regex=True)
        res["best_test_by_point_family"] = {f: metrics(y_all[te].values[(fam == f).values], pt[(fam == f).values]) for f in fam.unique()}
        # Giải thích: tầm quan trọng hoán vị trên tập test (mẫu 5000 dòng)
        sub = df[te].sample(min(5000, int(te.sum())), random_state=1)
        pi = permutation_importance(fitted[best], sub[feats], y_all[sub.index], scoring="average_precision", n_repeats=5, random_state=1, n_jobs=1)
        res["permutation_importance_pr_auc_drop"] = dict(sorted({f: round(float(v), 4) for f, v in zip(feats, pi.importances_mean)}.items(), key=lambda kv: -kv[1]))
        if scen == "A_de_xuat_PO" or True:
            joblib.dump({"pipeline": fitted[best], "features": feats, "sla_hours": sla[sname], "kind": best}, os.path.join(MOD, f"{sname}_{scen}.joblib"))
        out[f"{sname}__{scen}"] = res
        print(sname, scen, "best", best, res["models"][best]["test"])

with open(os.path.join(RES, "metrics_v3.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=2)
print("OK")
