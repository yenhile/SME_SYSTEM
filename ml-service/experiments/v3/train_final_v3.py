"""Mô hình hoàn chỉnh v3: huấn luyện, hiệu chỉnh xác suất, đánh giá theo thời điểm và theo hồ sơ.

- Mô hình ứng viên: LR, RF, GB (không dùng class_weight để xác suất không bị lệch).
- Hiệu chỉnh xác suất bằng isotonic trên tập valid (mô hình fit trên train).
- Chọn mô hình theo log-loss trên valid sau hiệu chỉnh.
- Đường cơ sở: Logistic Regression chỉ dùng giờ đã dùng + loại thời điểm (không có thông tin hồ sơ/tải).
- Đánh giá test: (a) theo từng thời điểm dự báo so với đường cơ sở, (b) độ tin cậy xác suất,
  (c) theo hồ sơ: cảnh báo sớm bắt được bao nhiêu hồ sơ trễ, báo trước bao nhiêu giờ, bao nhiêu báo nhầm.
Chạy: python train_final_v3.py -> results/final_v3.json, models/final_*.joblib
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import IsotonicRegression
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA, RES, MOD = (os.path.join(HERE, d) for d in ("data", "results", "models"))
CAT = ["business_scope", "collateral_mode", "point"]
BASE_NUM = ["proposed_amount_billion", "loan_term_months", "established_years", "annual_revenue_billion", "has_existing_debt", "return_count"]
STAGES = {
    "tiep_nhan": dict(file="tiep_nhan_snapshots_v3.csv", total="tn_bank_hours_total", elapsed="bank_hours_so_far",
                      num=BASE_NUM + ["supplement_rounds_so_far", "items_pending_review", "bank_hours_so_far", "officer_workload"]),
    "tham_dinh": dict(file="tham_dinh_snapshots_v3.csv", total="td_hours_total", elapsed="td_hours_so_far",
                      num=BASE_NUM + ["supplement_rounds_total", "tn_bank_hours", "appraisal_queue_len", "appraisers_active", "clarify_rounds_so_far", "td_hours_so_far"]),
}
SCENARIOS = {"A_de_xuat_PO": {"tiep_nhan": 80, "tham_dinh": 40}, "B_tre_15pct": {"tiep_nhan": 54, "tham_dinh": 44}}
EPS = 1e-4


def make(kind, num, cat=CAT):
    pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore"), cat), ("n", StandardScaler() if kind in ("lr", "base") else "passthrough", num)])
    est = {"lr": LogisticRegression(max_iter=3000), "base": LogisticRegression(max_iter=3000),
           "rf": RandomForestClassifier(n_estimators=300, min_samples_leaf=30, n_jobs=-1, random_state=1),
           "gb": HistGradientBoostingClassifier(max_depth=4, learning_rate=0.06, max_iter=300, l2_regularization=1.0, random_state=1)}[kind]
    return Pipeline([("pre", pre), ("m", est)])


def auc(y, p):
    return round(float(roc_auc_score(y, p)), 4) if 0 < y.sum() < len(y) else None


def clip(p):
    return np.clip(p, EPS, 1 - EPS)


out = {}
for sname, cfg in STAGES.items():
    df = pd.read_csv(os.path.join(DATA, cfg["file"]))
    feats = CAT + cfg["num"]
    base_feats = ["point", cfg["elapsed"]]
    fam = df.point.str.replace(r"_\d+$", "", regex=True)
    tr, va, te = (df.split == s for s in ("train", "valid", "test"))
    for scen, sla in SCENARIOS.items():
        L = sla[sname]
        y = (df[cfg["total"]] > L).astype(int)
        res = {"sla_hours": L, "late_rate_test": round(float(y[te].mean()), 4)}
        # ----- đường cơ sở có hiệu chỉnh -----
        bp = make("base", [cfg["elapsed"]], ["point"]).fit(df.loc[tr, base_feats], y[tr])
        biso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(bp.predict_proba(df.loc[va, base_feats])[:, 1], y[va])
        pb_te = clip(biso.predict(bp.predict_proba(df.loc[te, base_feats])[:, 1]))
        # ----- ứng viên -----
        cands = {}
        for kind in ("lr", "rf", "gb"):
            pipe = make(kind, cfg["num"]).fit(df.loc[tr, feats], y[tr])
            iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(pipe.predict_proba(df.loc[va, feats])[:, 1], y[va])
            pv = clip(iso.predict(pipe.predict_proba(df.loc[va, feats])[:, 1]))
            cands[kind] = (pipe, iso, log_loss(y[va], pv))
        best = min(cands, key=lambda k: cands[k][2])
        pipe, iso, _ = cands[best]
        p_te = clip(iso.predict(pipe.predict_proba(df.loc[te, feats])[:, 1]))
        res["best_model"] = best
        res["valid_logloss"] = {k: round(float(v[2]), 4) for k, v in cands.items()}
        # (a) theo thời điểm
        yt = y[te].values
        ft = fam[te].values
        rows = {}
        for f in sorted(set(ft)):
            m = ft == f
            rows[f] = {"n": int(m.sum()), "late_rate": round(float(yt[m].mean()), 4), "auc_model": auc(yt[m], p_te[m]), "auc_baseline": auc(yt[m], pb_te[m]),
                       "brier_model": round(float(brier_score_loss(yt[m], p_te[m])), 4), "brier_baseline": round(float(brier_score_loss(yt[m], pb_te[m])), 4)}
        res["per_point"] = rows
        res["overall"] = {"auc_model": auc(yt, p_te), "auc_baseline": auc(yt, pb_te),
                          "brier_model": round(float(brier_score_loss(yt, p_te)), 4), "brier_baseline": round(float(brier_score_loss(yt, pb_te)), 4),
                          "brier_prior_only": round(float(brier_score_loss(yt, np.full(len(yt), yt.mean()))), 4)}
        # (b) độ tin cậy: 10 nhóm theo xác suất dự báo
        q = pd.qcut(p_te, 10, duplicates="drop")
        cal = pd.DataFrame({"p": p_te, "y": yt, "q": q}).groupby("q", observed=True).agg(pred=("p", "mean"), actual=("y", "mean"), n=("y", "size"))
        res["calibration_deciles"] = [{"pred": round(float(r.pred), 3), "actual": round(float(r.actual), 3), "n": int(r.n)} for r in cal.itertuples()]
        # (c) theo hồ sơ: chọn ngưỡng trên valid sao cho độ chính xác cảnh báo >= 0.5 (snapshot còn trong hạn)
        pv_all = clip(iso.predict(pipe.predict_proba(df.loc[va, feats])[:, 1]))
        ok_va = (df.loc[va, cfg["elapsed"]].values < L)
        yv = y[va].values
        thr = None
        for t in np.arange(0.2, 0.96, 0.02):
            m = ok_va & (pv_all >= t)
            if m.sum() >= 50 and yv[m].mean() >= 0.5:
                thr = float(round(t, 2))
                break
        res["alert_threshold"] = thr
        if thr is not None:
            d = df[te].copy()
            d["p"], d["y"] = p_te, yt
            d["ok"] = d[cfg["elapsed"]] < L
            alerts = d[d.ok & (d.p >= thr)].sort_values(["case_id", cfg["elapsed"]]).groupby("case_id").head(1)
            case = d.groupby("case_id").y.max()
            late_cases = set(case[case == 1].index)
            al = set(alerts.case_id)
            caught = [c for c in al if c in late_cases]
            lead = (L - alerts[alerts.case_id.isin(caught)][cfg["elapsed"]]).values
            res["case_level"] = {"cases_test": int(len(case)), "late_cases": len(late_cases), "alerted_cases": len(al),
                                 "late_cases_alerted_before_deadline": len(caught),
                                 "recall_late_cases": round(len(caught) / max(1, len(late_cases)), 4),
                                 "precision_alerts": round(len(caught) / max(1, len(al)), 4),
                                 "false_alarm_cases": len(al) - len(caught),
                                 "false_alarm_share_of_ontime_cases": round((len(al) - len(caught)) / max(1, len(case) - len(late_cases)), 4),
                                 "lead_hours_median": round(float(np.median(lead)), 1) if len(lead) else None,
                                 "lead_hours_p25": round(float(np.percentile(lead, 25)), 1) if len(lead) else None}
        out[f"{sname}__{scen}"] = res
        joblib.dump({"pipeline": pipe, "calibrator": iso, "features": feats, "sla_hours": L, "kind": best, "alert_threshold": thr,
                     "stage": sname, "scenario": scen}, os.path.join(MOD, f"final_{sname}_{scen}.joblib"))
        print(sname, scen, best, "overall", res["overall"], "case", res.get("case_level"))

with open(os.path.join(RES, "final_v3.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=2)
print("OK")
