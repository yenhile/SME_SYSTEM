"""Thực nghiệm bổ sung cho mô hình v4 (phục vụ bài báo và khóa luận). KHÔNG sửa mô hình đang chạy.

Chạy:  python eval_extra_v4.py            -> results/experiments_v4.json   (đầy đủ, vài chục phút trên CPU)
       python eval_extra_v4.py --quick    -> bản thử nhanh (1 hạt giống, rừng nhỏ), không ghi đè kết quả đầy đủ

Nội dung (mỗi công đoạn, đo ở cấu hình đang chạy: Tiếp nhận 112 giờ, Thẩm định 40 giờ):
 1. So sánh thuật toán trên cùng dữ liệu và cùng cách hiệu chỉnh: luật ngưỡng, đường cơ sở (chỉ biết đồng hồ SLA),
    Logistic Regression, Random Forest, Gradient Boosting. Lặp 5 hạt giống + lần chạy "chính thức" (đúng cách chia của train_v4.py).
 2. Khoảng tin cậy bootstrap theo hồ sơ (cụm) cho AUC của mô hình, đường cơ sở và hiệu của chúng; khoảng Wilson cho độ chính xác/độ phủ.
 3. Bóc tách thành phần: bỏ thông tin hồ sơ, bỏ đặc trưng vận hành, bỏ "giờ kể từ thao tác gần nhất", bỏ hiệu chỉnh, chỉ còn đồng hồ SLA.
 4. SLA là đầu vào hay cố định: mô hình huấn luyện ở một mức SLA đơn lẻ so với mô hình nhận biết SLA, đo ở các mức SLA khác.
 5. Độ trễ suy luận của mô hình đang chạy (một hồ sơ mỗi lần gọi).
Dữ liệu: data/*.csv (có trong git). Môi trường được ghi vào kết quả (phiên bản Python, thư viện, CPU).
"""
import json
import os
import platform
import sys
import time

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

QUICK = "--quick" in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
DATA, RES, MOD = (os.path.join(HERE, d) for d in ("data", "results", "models"))
OUT = os.path.join(RES, "experiments_v4_quick.json" if QUICK else "experiments_v4.json")

CAT = ["business_scope", "collateral_mode"]
BASE_NUM = ["proposed_amount_billion", "loan_term_months", "established_years", "annual_revenue_billion", "has_existing_debt"]
SLA_NUM = ["elapsed_hours", "sla_hours", "remaining_hours"]
STAGES = {
    "tiep_nhan": dict(file="tiep_nhan_timeline_v4.csv", grid=[24, 32, 40, 48, 56, 64, 80, 96, 112, 128], live_sla=112, chosen="gb",
                      other_sla=[48, 80], ops=["supplement_rounds_so_far", "items_pending_review", "officer_workload"],
                      num=BASE_NUM + ["supplement_rounds_so_far", "items_pending_review", "hours_since_last_event", "officer_workload"] + SLA_NUM),
    "tham_dinh": dict(file="tham_dinh_timeline_v4.csv", grid=[16, 24, 32, 40, 48, 56, 64, 80], live_sla=40, chosen="lr",
                      other_sla=[24, 64],
                      ops=["supplement_rounds_total", "tn_bank_hours", "appraisal_queue_len", "appraisers_active", "clarify_rounds_so_far", "clarify_open"],
                      num=BASE_NUM + ["supplement_rounds_total", "tn_bank_hours", "appraisal_queue_len", "appraisers_active",
                                      "clarify_rounds_so_far", "clarify_open", "hours_since_last_event"] + SLA_NUM),
}
T_WATCH, T_URGENT = 0.35, 0.60
EPS = 1e-4
SEEDS = [1] if QUICK else [1, 2, 3, 4, 5]
RF_TREES = 40 if QUICK else 200
N_BOOT = 100 if QUICK else 1000


def make(kind, num, cat, seed):
    pre = ColumnTransformer([("c", OneHotEncoder(handle_unknown="ignore"), cat),
                             ("n", StandardScaler() if kind in ("lr", "base") else "passthrough", num)])
    est = {"lr": LogisticRegression(max_iter=3000), "base": LogisticRegression(max_iter=3000),
           "rf": RandomForestClassifier(n_estimators=RF_TREES, min_samples_leaf=20, n_jobs=-1, random_state=seed),
           "gb": HistGradientBoostingClassifier(max_depth=5, learning_rate=0.06, max_iter=400, l2_regularization=1.0, random_state=seed)}[kind]
    return Pipeline([("pre", pre), ("m", est)])


def with_sla(df, L):
    d = df.copy()
    d["sla_hours"] = L
    d["remaining_hours"] = d.sla_hours - d.elapsed_hours
    return d


def clip(p):
    return np.clip(p, EPS, 1 - EPS)


def auc(y, p):
    y = np.asarray(y)
    return float(roc_auc_score(y, p)) if 0 < y.sum() < len(y) else float("nan")


def ece(y, p, bins=10):
    q = pd.qcut(pd.Series(p), bins, duplicates="drop")
    g = pd.DataFrame({"y": np.asarray(y), "p": np.asarray(p), "q": q.values}).groupby("q", observed=True).agg(y=("y", "mean"), p=("p", "mean"), n=("y", "size"))
    return float((g.n * (g.y - g.p).abs()).sum() / g.n.sum())


def basic(y, p):
    return {"auc": auc(y, p), "brier": float(brier_score_loss(y, p)), "logloss": float(log_loss(y, clip(p))), "ece": ece(y, p)}


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    ph = k / n
    d = 1 + z * z / n
    c = (ph + z * z / (2 * n)) / d
    h = z * np.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n)) / d
    return [round(float(c - h), 4), round(float(c + h), 4)]


def case_level(te, col, L, thresholds):
    case_y = te.groupby("case_id").y.max()
    late = set(case_y[case_y == 1].index)
    out = {"cases": int(len(case_y)), "late_cases": len(late)}
    for name, thr in thresholds.items():
        al = te[te[col] >= thr].sort_values(["case_id", "elapsed_hours"]).groupby("case_id").head(1)
        got = al[al.case_id.isin(late)]
        lead = (L - got.elapsed_hours).values
        ontime = max(1, len(case_y) - len(late))
        out[name] = {"threshold": thr, "alerted": int(len(al)), "late_caught": int(len(got)),
                     "recall": round(len(got) / max(1, len(late)), 4), "precision": round(len(got) / max(1, len(al)), 4),
                     "false_alarm": round((len(al) - len(got)) / ontime, 4),
                     "recall_ci": wilson(len(got), len(late)), "precision_ci": wilson(len(got), len(al)),
                     "lead_hours_median": round(float(np.median(lead)), 1) if len(lead) else None}
    return out


def split_raw(raw, seed, official):
    r = raw.copy()
    if not official:
        cases = raw.case_id.unique()
        perm = np.random.default_rng(1000 + seed).permutation(cases)
        n = len(perm)
        a, b = int(0.7 * n), int(0.85 * n)
        smap = {**dict.fromkeys(perm[:a], "train"), **dict.fromkeys(perm[a:b], "valid"), **dict.fromkeys(perm[b:], "test")}
        r["split"] = r.case_id.map(smap)
    return r


def pool_of(raw, grid, seed):
    Lrow = np.random.default_rng(seed).choice(grid, size=len(raw))
    pool = with_sla(raw, Lrow)
    pool = pool[pool.elapsed_hours < pool.sla_hours].copy()
    pool["y"] = (pool.stage_hours_total > pool.sla_hours).astype(int)
    return pool


def test_at(raw, L):
    te = with_sla(raw[raw.split == "test"], L)
    te = te[te.elapsed_hours < L].copy()
    te["y"] = (te.stage_hours_total > L).astype(int)
    return te


def fit_cal(kind, tr, va, num, cat, seed, calibrate=True):
    feats = cat + num
    pipe = make(kind, num, cat, seed).fit(tr[feats], tr.y)
    pv = pipe.predict_proba(va[feats])[:, 1]
    iso = IsotonicRegression(out_of_bounds="clip", y_min=0, y_max=1).fit(pv, va.y) if calibrate else None

    def predict(d):
        p = pipe.predict_proba(d[feats])[:, 1]
        return clip(iso.predict(p)) if iso is not None else clip(p)
    return predict


def run_one(raw0, cfg, seed, official, mseed=None):
    """Một lần chạy đầy đủ: so sánh thuật toán, bóc tách, SLA nhận biết vs cố định. Trả về dict kết quả."""
    mseed = seed if mseed is None else mseed  # hạt giống của mô hình (Gradient Boosting dừng sớm bằng tập con ngẫu nhiên)
    raw = split_raw(raw0, seed, official)
    pool = pool_of(raw, cfg["grid"], 7 if official else seed)
    tr, va = pool[pool.split == "train"], pool[pool.split == "valid"]
    L = cfg["live_sla"]
    te = test_at(raw, L)
    res = {"n_train_rows": int(len(tr)), "n_valid_rows": int(len(va)), "test_rows": int(len(te)), "test_late_rate": float(te.y.mean()), "models": {}, "ablation": {}, "fixed_vs_aware": {}}
    thr = {"watch": T_WATCH, "urgent": T_URGENT}
    # luật ngưỡng: điểm = tỷ lệ đã dùng của SLA (không học gì)
    te["p_rule"] = (te.elapsed_hours / L).clip(0, 1)
    res["models"]["rule"] = {"auc": auc(te.y, te.p_rule), "case_level": case_level(te, "p_rule", L, {"rule_0.8": 0.8})}
    # đường cơ sở và ba thuật toán
    for kind, num, cat in (("base", SLA_NUM, []), ("lr", cfg["num"], CAT), ("rf", cfg["num"], CAT), ("gb", cfg["num"], CAT)):
        t0 = time.time()
        pred = fit_cal(kind, tr, va, num, cat, mseed)
        te["p_" + kind] = pred(te)
        m = basic(te.y, te["p_" + kind])
        m["case_level"] = case_level(te, "p_" + kind, L, thr)
        m["fit_seconds"] = round(time.time() - t0, 1)
        res["models"][kind] = m
    # bóc tách trên thuật toán đang dùng
    ch = cfg["chosen"]
    variants = {
        "full": (cfg["num"], CAT, True),
        "no_case_info": ([c for c in cfg["num"] if c not in BASE_NUM], [], True),
        "no_operational": ([c for c in cfg["num"] if c not in cfg["ops"]], CAT, True),
        "no_last_event": ([c for c in cfg["num"] if c != "hours_since_last_event"], CAT, True),
        "no_calibration": (cfg["num"], CAT, False),
        "clock_only": (SLA_NUM, [], True),
    }
    for name, (num, cat, cal) in variants.items():
        if name == "full":
            res["ablation"][name] = {k: res["models"][ch][k] for k in ("auc", "brier", "logloss", "ece")}
            continue
        pred = fit_cal(ch, tr, va, num, cat, mseed, calibrate=cal)
        res["ablation"][name] = basic(te.y, pred(te))
    # SLA nhận biết hay cố định
    fixed_feats = [c for c in cfg["num"] if c not in ("sla_hours", "remaining_hours")]
    ftr = with_sla(raw[raw.split == "train"], L)
    ftr = ftr[ftr.elapsed_hours < L].copy()
    ftr["y"] = (ftr.stage_hours_total > L).astype(int)
    fva = with_sla(raw[raw.split == "valid"], L)
    fva = fva[fva.elapsed_hours < L].copy()
    fva["y"] = (fva.stage_hours_total > L).astype(int)
    fixed = fit_cal(ch, ftr, fva, fixed_feats, CAT, mseed)
    aware = fit_cal(ch, tr, va, cfg["num"], CAT, mseed)
    for L2 in cfg["other_sla"]:
        t2 = test_at(raw, L2)
        res["fixed_vs_aware"][str(L2)] = {"aware": basic(t2.y, aware(t2)), "fixed_at_%d" % L: basic(t2.y, fixed(t2)), "late_rate": float(t2.y.mean()), "rows": int(len(t2))}
    return res, te


def bootstrap(te, n_rep, seed=0):
    ids = te.case_id.values
    uniq, inv = np.unique(ids, return_inverse=True)
    idx = [np.where(inv == i)[0] for i in range(len(uniq))]
    rng = np.random.default_rng(seed)
    y, ch, bs = te.y.values, te["p_chosen"].values, te["p_base"].values
    a, b = [], []
    for _ in range(n_rep):
        pick = rng.integers(0, len(uniq), len(uniq))
        ii = np.concatenate([idx[k] for k in pick])
        if 0 < y[ii].sum() < len(ii):
            a.append(roc_auc_score(y[ii], ch[ii]))
            b.append(roc_auc_score(y[ii], bs[ii]))
    a, b = np.array(a), np.array(b)
    d = a - b
    q = lambda v: [round(float(np.percentile(v, 2.5)), 4), round(float(np.percentile(v, 97.5)), 4)]
    return {"reps": int(len(a)), "auc_model_ci": q(a), "auc_baseline_ci": q(b), "auc_diff_mean": round(float(d.mean()), 4), "auc_diff_ci": q(d),
            "share_model_better": round(float((d > 0).mean()), 4)}


def aggregate(runs, getter):
    vals = np.array([getter(r) for r in runs], dtype=float)
    return {"mean": round(float(np.nanmean(vals)), 4), "std": round(float(np.nanstd(vals, ddof=1)) if len(vals) > 1 else 0.0, 4), "n": int(len(vals))}


def latency():
    out = {}
    for sname, cfg in STAGES.items():
        bundle = joblib.load(os.path.join(MOD, f"v4_{sname}.joblib"))
        df = pd.read_csv(os.path.join(DATA, cfg["file"]), nrows=2000)
        row = with_sla(df.iloc[[500]], cfg["live_sla"])
        feats = bundle["features"]
        times = []
        for _ in range(300):
            t0 = time.perf_counter()
            p = bundle["pipeline"].predict_proba(row[feats])[:, 1]
            bundle["calibrator"].predict(p)
            times.append((time.perf_counter() - t0) * 1000)
        times = np.array(times[20:])
        out[sname] = {"model": bundle["kind"], "ms_median": round(float(np.median(times)), 2), "ms_p95": round(float(np.percentile(times, 95)), 2), "calls": int(len(times))}
    return out


def main():
    t_start = time.time()
    result = {"env": {"python": platform.python_version(), "sklearn": sklearn.__version__, "pandas": pd.__version__, "numpy": np.__version__,
                      "platform": platform.platform(), "cpu_count": os.cpu_count(), "quick": QUICK, "seeds": SEEDS, "rf_trees": RF_TREES, "bootstrap_reps": N_BOOT},
              "stages": {}}
    for sname, cfg in STAGES.items():
        raw0 = pd.read_csv(os.path.join(DATA, cfg["file"]))
        print(f"== {sname}: lần chạy chính thức", flush=True)
        off, te = run_one(raw0, cfg, 7, True, mseed=1)  # đúng cách chia và hạt giống của train_v4.py
        te["p_chosen"] = te["p_" + cfg["chosen"]]
        stage = {"live_sla": cfg["live_sla"], "chosen": cfg["chosen"], "official": off, "bootstrap": bootstrap(te, N_BOOT)}
        runs = []
        for s in SEEDS:
            print(f"== {sname}: hạt giống {s}", flush=True)
            r, _ = run_one(raw0, cfg, s, False)
            runs.append(r)
        stage["seeds"] = {"values": SEEDS, "models": {}, "ablation": {}, "fixed_vs_aware": {}}
        for k in ("base", "lr", "rf", "gb"):
            stage["seeds"]["models"][k] = {m: aggregate(runs, lambda r, k=k, m=m: r["models"][k][m]) for m in ("auc", "brier", "logloss", "ece")}
            for thr in ("watch", "urgent"):
                for m in ("precision", "recall", "false_alarm"):
                    stage["seeds"]["models"][k][f"{thr}_{m}"] = aggregate(runs, lambda r, k=k, thr=thr, m=m: r["models"][k]["case_level"][thr][m])
        stage["seeds"]["models"]["rule"] = {"auc": aggregate(runs, lambda r: r["models"]["rule"]["auc"])}
        for v in runs[0]["ablation"]:
            stage["seeds"]["ablation"][v] = {m: aggregate(runs, lambda r, v=v, m=m: r["ablation"][v][m]) for m in ("auc", "brier", "logloss", "ece")}
        for L2 in runs[0]["fixed_vs_aware"]:
            keyf = [k for k in runs[0]["fixed_vs_aware"][L2] if k.startswith("fixed_at_")][0]
            stage["seeds"]["fixed_vs_aware"][L2] = {
                "aware": {m: aggregate(runs, lambda r, L2=L2, m=m: r["fixed_vs_aware"][L2]["aware"][m]) for m in ("auc", "brier")},
                keyf: {m: aggregate(runs, lambda r, L2=L2, m=m, keyf=keyf: r["fixed_vs_aware"][L2][keyf][m]) for m in ("auc", "brier")}}
        result["stages"][sname] = stage
    result["latency_model_only"] = latency()
    result["runtime_minutes"] = round((time.time() - t_start) / 60, 1)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("Đã ghi", OUT, "trong", result["runtime_minutes"], "phút")


if __name__ == "__main__":
    main()
