"""Huấn luyện mô hình v4: nhận biết SLA, chấm điểm theo dòng thời gian, hai mức cảnh báo, giải thích nguyên nhân.

- Mỗi dòng huấn luyện có một mức SLA lấy ngẫu nhiên từ lưới (giờ làm việc); nhãn = tổng giờ công đoạn > SLA đó.
  Nhờ vậy ở vận hành, backend truyền SLA đang áp dụng (PO có thể đặt lại) mà không phải huấn luyện lại.
- Chỉ dùng dòng còn trong hạn (giờ đã dùng < SLA). Hồ sơ đã quá hạn là trạng thái xác định, không cần mô hình.
- Ứng viên: Logistic Regression, Gradient Boosting; chọn theo log-loss trên valid sau hiệu chỉnh isotonic.
- Hai mức cảnh báo theo xác suất đã hiệu chỉnh: CHU_Y >= 0.35, KHAN >= 0.60.
Chạy: python train_v4.py  -> results/metrics_v4.json, models/v4_*.joblib
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA, RES, MOD = (os.path.join(HERE, d) for d in ("data", "results", "models"))
os.makedirs(RES, exist_ok=True)
os.makedirs(MOD, exist_ok=True)

CAT = ["business_scope", "collateral_mode"]
BASE_NUM = ["proposed_amount_billion", "loan_term_months", "established_years", "annual_revenue_billion", "has_existing_debt"]
SLA_NUM = ["elapsed_hours", "sla_hours", "remaining_hours"]
STAGES = {
    "tiep_nhan": dict(file="tiep_nhan_timeline_v4.csv", grid=[24, 32, 40, 48, 56, 64, 80, 96, 112, 128],
                      num=BASE_NUM + ["supplement_rounds_so_far", "items_pending_review", "hours_since_last_event", "officer_workload"] + SLA_NUM),
    "tham_dinh": dict(file="tham_dinh_timeline_v4.csv", grid=[16, 24, 32, 40, 48, 56, 64, 80],
                      num=BASE_NUM + ["supplement_rounds_total", "tn_bank_hours", "appraisal_queue_len", "appraisers_active",
                                      "clarify_rounds_so_far", "clarify_open", "hours_since_last_event"] + SLA_NUM),
}
EVAL = {"A_80_40": {"tiep_nhan": 80, "tham_dinh": 40}, "C_112_40": {"tiep_nhan": 112, "tham_dinh": 40}, "B_54_44": {"tiep_nhan": 54, "tham_dinh": 44}}
T_WATCH, T_URGENT = 0.35, 0.60
EPS = 1e-4


def make(kind, num, cat):
    pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore"), cat), ("n", StandardScaler() if kind in ("lr", "base") else "passthrough", num)])
    est = {"lr": LogisticRegression(max_iter=3000), "base": LogisticRegression(max_iter=3000),
           "gb": HistGradientBoostingClassifier(max_depth=5, learning_rate=0.06, max_iter=400, l2_regularization=1.0, random_state=1)}[kind]
    return Pipeline([("pre", pre), ("m", est)])


def with_sla(df, L):
    d = df.copy()
    d["sla_hours"] = L
    d["remaining_hours"] = d.sla_hours - d.elapsed_hours
    return d


def auc(y, p):
    return round(float(roc_auc_score(y, p)), 4) if 0 < y.sum() < len(y) else None


def clip(p):
    return np.clip(p, EPS, 1 - EPS)


out = {}
for sname, cfg in STAGES.items():
    raw = pd.read_csv(os.path.join(DATA, cfg["file"]))
    rng = np.random.default_rng(7)
    Lrow = rng.choice(cfg["grid"], size=len(raw))
    pool = with_sla(raw, Lrow)
    pool = pool[pool.elapsed_hours < pool.sla_hours].copy()
    pool["y"] = (pool.stage_hours_total > pool.sla_hours).astype(int)
    feats = CAT + cfg["num"]
    tr, va = pool[pool.split == "train"], pool[pool.split == "valid"]
    # đường cơ sở: chỉ giờ đã dùng, SLA, còn lại (không có thông tin hồ sơ, tải, bổ sung)
    bfe = SLA_NUM
    base = make("base", bfe, []).fit(tr[bfe], tr.y)
    biso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(base.predict_proba(va[bfe])[:, 1], va.y)

    cands = {}
    for kind in ("lr", "gb"):
        pipe = make(kind, cfg["num"], CAT).fit(tr[feats], tr.y)
        iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(pipe.predict_proba(va[feats])[:, 1], va.y)
        cands[kind] = (pipe, iso, float(log_loss(va.y, clip(iso.predict(pipe.predict_proba(va[feats])[:, 1])))))
    best = min(cands, key=lambda k: cands[k][2])
    pipe, iso, _ = cands[best]
    res = {"best_model": best, "valid_logloss": {k: round(v[2], 4) for k, v in cands.items()}, "n_train_rows": int(len(tr)), "scenarios": {}}

    def predict(d):
        return clip(iso.predict(pipe.predict_proba(d[feats])[:, 1]))

    # tham chiếu cho giải thích nguyên nhân (thay từng đặc trưng bằng giá trị điển hình)
    ref = {c: float(tr[c].median()) for c in cfg["num"]}
    ref.update({c: str(tr[c].mode().iloc[0]) for c in CAT})

    for scen, sla in EVAL.items():
        L = sla[sname]
        te = with_sla(raw[raw.split == "test"], L)
        te = te[te.elapsed_hours < L].copy()
        te["y"] = (te.stage_hours_total > L).astype(int)
        te["p"] = predict(te)
        te["pb"] = clip(biso.predict(base.predict_proba(te[bfe])[:, 1]))
        fam = te.point
        r = {"sla_hours": L, "rows": int(len(te)), "late_rate": round(float(te.y.mean()), 4),
             "overall": {"auc_model": auc(te.y, te.p), "auc_baseline": auc(te.y, te.pb),
                         "brier_model": round(float(brier_score_loss(te.y, te.p)), 4), "brier_baseline": round(float(brier_score_loss(te.y, te.pb)), 4),
                         "brier_prior": round(float(brier_score_loss(te.y, np.full(len(te), te.y.mean()))), 4)}}
        r["per_point"] = {}
        for f in sorted(fam.unique()):
            m = fam == f
            r["per_point"][f] = {"n": int(m.sum()), "late_rate": round(float(te.y[m].mean()), 4),
                                 "auc_model": auc(te.y[m], te.p[m]), "auc_baseline": auc(te.y[m], te.pb[m])}
        # độ tin cậy
        q = pd.qcut(te.p, 10, duplicates="drop")
        cal = te.assign(q=q).groupby("q", observed=True).agg(pred=("p", "mean"), actual=("y", "mean"), n=("y", "size"))
        r["calibration_deciles"] = [{"pred": round(float(x.pred), 3), "actual": round(float(x.actual), 3), "n": int(x.n)} for x in cal.itertuples()]
        # theo hồ sơ: cảnh báo đầu tiên của mỗi mức
        case_y = te.groupby("case_id").y.max()
        late_cases = set(case_y[case_y == 1].index)
        r["case_level"] = {"cases": int(len(case_y)), "late_cases": len(late_cases)}
        for name, thr in (("watch", T_WATCH), ("urgent", T_URGENT)):
            al = te[te.p >= thr].sort_values(["case_id", "elapsed_hours"]).groupby("case_id").head(1)
            got = al[al.case_id.isin(late_cases)]
            lead = (L - got.elapsed_hours).values
            r["case_level"][name] = {"threshold": thr, "alerted": int(len(al)), "late_caught": int(len(got)),
                                     "recall": round(len(got) / max(1, len(late_cases)), 4),
                                     "precision": round(len(got) / max(1, len(al)), 4),
                                     "false_alarm_share_of_ontime": round((len(al) - len(got)) / max(1, len(case_y) - len(late_cases)), 4),
                                     "lead_hours_median": round(float(np.median(lead)), 1) if len(lead) else None,
                                     "lead_hours_p25": round(float(np.percentile(lead, 25)), 1) if len(lead) else None}
        res["scenarios"][scen] = r
        print(sname, scen, best, r["overall"], r["case_level"]["watch"], r["case_level"]["urgent"])
    joblib.dump({"pipeline": pipe, "calibrator": iso, "features": feats, "num": cfg["num"], "cat": CAT, "ref": ref, "kind": best,
                 "stage": sname, "sla_grid": cfg["grid"], "thresholds": {"watch": T_WATCH, "urgent": T_URGENT}, "version": "v4.0"},
                os.path.join(MOD, f"v4_{sname}.joblib"))
    out[sname] = res

with open(os.path.join(RES, "metrics_v4.json"), "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=2)
print("OK")
