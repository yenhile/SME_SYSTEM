"""Chẩn đoán bổ sung cho mô hình v4 (đợt 2 thực nghiệm, phục vụ bài báo và khóa luận). KHÔNG sửa mô hình đang chạy.

Chạy:  python eval_diagnostics_v4.py          -> results/diagnostics_v4.json (+ hình trong results/figures nếu có matplotlib)
       python eval_diagnostics_v4.py --quick  -> bản thử nhanh

Nội dung:
 1. Đường ROC và bảng độ nhạy theo ngưỡng cảnh báo (độ chính xác, độ phủ, báo nhầm theo hồ sơ) cho mô hình đang dùng.
 2. Đánh giá phần lý do giải thích: tỷ lệ lý do rơi vào nhóm có cơ chế thật trong bộ mô phỏng, nhóm yếu, nhóm gián tiếp.
 3. Trần lý thuyết: cho mô hình THẤY ba biến ẩn (tốc độ cán bộ tín dụng, tốc độ Thẩm quyền, độ phức tạp thực) rồi đo lại.
    Cần chạy lại bộ mô phỏng theo đúng thứ tự (kết quả giống hệt dữ liệu hiện có, có kiểm tra) để thu giá trị biến ẩn.
 4. Độ nhạy theo giả định mô phỏng: đổi từng nhóm tham số giả định rồi xem kết luận chính có còn đúng không.
Yêu cầu: simulate_v4.py, eval_extra_v4.py cùng thư mục; data/*.csv; models/v4_*.joblib (do train_v4.py tạo).
"""
import importlib
import json
import os
import sys
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve

import eval_extra_v4 as E

QUICK = E.QUICK
HERE, DATA, RES, MOD = E.HERE, E.DATA, E.RES, E.MOD
OUT = os.path.join(RES, "diagnostics_v4_quick.json" if QUICK else "diagnostics_v4.json")
FIG = os.path.join(RES, "figures")
TIME_GROUP = ("elapsed_hours", "sla_hours", "remaining_hours")
NOT_REASONS = {"annual_revenue_billion", "established_years", "loan_term_months"}
MIN_DELTA = 0.05
# Phân nhóm đặc trưng theo cơ chế trong simulate_v4.py (xem simulate_one):
#  direct: đặc trưng trực tiếp làm đổi thời gian xử lý; weak: có ảnh hưởng nhỏ qua độ phức tạp của hồ sơ;
#  proxy: không gây chậm trực tiếp nhưng tương quan với biến ẩn (độ phức tạp, tốc độ) hoặc là hệ quả của dòng thời gian.
DRIVER_GROUPS = {
    "tiep_nhan": {"direct": {"time", "officer_workload", "supplement_rounds_so_far", "items_pending_review"},
                  "weak": {"collateral_mode", "has_existing_debt", "proposed_amount_billion"},
                  "proxy": {"business_scope", "hours_since_last_event"}},
    "tham_dinh": {"direct": {"time", "appraisal_queue_len", "appraisers_active", "clarify_rounds_so_far", "clarify_open"},
                  "weak": {"supplement_rounds_total", "collateral_mode", "has_existing_debt", "proposed_amount_billion"},
                  "proxy": {"tn_bank_hours", "business_scope", "hours_since_last_event"}},
}


def prob_art(art, df):
    p = art["calibrator"].predict(art["pipeline"].predict_proba(df[art["features"]])[:, 1])
    return np.clip(p, 0.0, 1.0)


def official(sname):
    cfg = E.STAGES[sname]
    raw = pd.read_csv(os.path.join(DATA, cfg["file"]))
    pool = E.pool_of(raw, cfg["grid"], 7)
    tr, va = pool[pool.split == "train"], pool[pool.split == "valid"]
    return cfg, raw, tr, va


# ---------------------------------------------------------------- 1. ROC và ngưỡng
def roc_and_thresholds(sname):
    cfg, raw, tr, va = official(sname)
    L = cfg["live_sla"]
    pred = E.fit_cal(cfg["chosen"], tr, va, cfg["num"], E.CAT, 1)
    base = E.fit_cal("base", tr, va, E.SLA_NUM, [], 1)
    te = E.test_at(raw, L)
    te["p"], te["pb"] = pred(te), base(te)
    out = {"live_sla": L, "chosen": cfg["chosen"], "test_rows": int(len(te))}
    for name, col in (("model", "p"), ("baseline", "pb")):
        fpr, tpr, _ = roc_curve(te.y, te[col])
        idx = np.unique(np.linspace(0, len(fpr) - 1, 120).astype(int))
        out["roc_" + name] = {"fpr": [round(float(x), 4) for x in fpr[idx]], "tpr": [round(float(x), 4) for x in tpr[idx]], "auc": E.auc(te.y, te[col])}
    sweep = []
    for t in np.round(np.arange(0.10, 0.91, 0.05), 2):
        cl = E.case_level(te, "p", L, {"t": float(t)})["t"]
        sweep.append({"threshold": round(float(t), 2), "alerted": cl["alerted"], "precision": cl["precision"], "recall": cl["recall"],
                      "false_alarm": cl["false_alarm"], "lead_hours_median": cl["lead_hours_median"]})
    out["threshold_sweep"] = sweep
    return out


# ---------------------------------------------------------------- 2. Lý do giải thích
def reasons_eval(sname):
    cfg, raw, tr, va = official(sname)
    art = joblib.load(os.path.join(MOD, f"v4_{sname}.joblib"))
    L = cfg["live_sla"]
    te = E.test_at(raw, L)
    p = prob_art(art, te)
    te = te.assign(p=p)
    sub = te[te.p >= 0.10].copy()
    if QUICK:
        sub = sub.sample(min(len(sub), 800), random_state=0)
    deltas = {}
    t = sub.copy()
    t["elapsed_hours"], t["remaining_hours"] = 0.0, t["sla_hours"]
    deltas["time"] = sub.p.values - prob_art(art, t)
    for col in art["features"]:
        if col in TIME_GROUP or col in NOT_REASONS:
            continue
        t = sub.copy()
        t[col] = art["ref"][col]
        deltas[col] = sub.p.values - prob_art(art, t)
    D = pd.DataFrame(deltas, index=sub.index)
    groups = DRIVER_GROUPS[sname]
    counts = {"direct": 0, "weak": 0, "proxy": 0, "other": 0}
    per_feature, n_reasons, with_reason = {}, 0, 0
    for _, row in D.iterrows():
        picked = [c for c, d in row.sort_values(ascending=False).items() if d >= MIN_DELTA][:3]
        with_reason += int(len(picked) > 0)
        for c in picked:
            n_reasons += 1
            per_feature[c] = per_feature.get(c, 0) + 1
            g = next((k for k, v in groups.items() if c in v), "other")
            counts[g] += 1
    alerted = sub[sub.p >= 0.35]
    return {"rows_explained": int(len(sub)), "rows_with_at_least_one_reason": int(with_reason), "reasons_total": int(n_reasons),
            "share_by_group": {k: round(v / max(1, n_reasons), 4) for k, v in counts.items()},
            "per_feature_count": dict(sorted(per_feature.items(), key=lambda x: -x[1])),
            "alerts_ge_035": int(len(alerted)),
            "note": "direct = cơ chế trực tiếp trong mô phỏng; weak = ảnh hưởng nhỏ qua độ phức tạp; proxy = đại diện cho biến ẩn hoặc hệ quả dòng thời gian; other = ngoài phân loại"}


# ---------------------------------------------------------------- 3. Trần lý thuyết (thấy biến ẩn)
def simulate_with_latents(n_cases):
    S = importlib.import_module("simulate_v4")
    orig = S.lognorm
    rec = []

    def spy(median, sigma):
        v = orig(median, sigma)
        rec.append(float(v))
        return v
    S.lognorm = spy
    rows, bad = [], 0
    ref_cases = pd.read_csv(os.path.join(DATA, "cases_v4.csv"), nrows=n_cases)
    for i in range(n_cases):
        rec.clear()
        case_row, _, _ = S.simulate_one(i)
        rows.append({"case_id": case_row["case_id"], "speed_cb": rec[0], "speed_tq": rec[1], "complexity": rec[2]})
        if abs(case_row["tn_bank_hours"] - float(ref_cases.tn_bank_hours.iloc[i])) > 0.011:
            bad += 1
    S.lognorm = orig
    return pd.DataFrame(rows), bad


def oracle_eval(sname, lat):
    cfg = E.STAGES[sname]
    raw = pd.read_csv(os.path.join(DATA, cfg["file"]))
    raw = raw.merge(lat, on="case_id", how="inner")
    L = cfg["live_sla"]
    pool = E.pool_of(raw, cfg["grid"], 7)
    tr, va = pool[pool.split == "train"], pool[pool.split == "valid"]
    te = E.test_at(raw, L)
    out = {"cases_used": int(raw.case_id.nunique()), "test_rows": int(len(te)), "late_rate": float(te.y.mean())}
    lat_cols = ["speed_cb", "speed_tq", "complexity"]
    for kind in ("lr", "gb"):
        for tag, num in (("observable", cfg["num"]), ("with_hidden", cfg["num"] + lat_cols)):
            pred = E.fit_cal(kind, tr, va, num, E.CAT, 1)
            out[f"{kind}_{tag}"] = E.basic(te.y, pred(te))
    return out


# ---------------------------------------------------------------- 4. Độ nhạy theo giả định mô phỏng
def build_timelines(S, n_cases, seed):
    S.rng = np.random.default_rng(seed)
    tn, td = [], []
    for i in range(n_cases):
        _, b, c = S.simulate_one(i)
        tn.extend(b)
        td.extend(c)
    return pd.DataFrame(tn), pd.DataFrame(td)


def eval_scenario(tn, td):
    res = {}
    # Tiếp nhận đo thêm ở SLA 80 giờ vì ở SLA 112 giờ có rất ít hồ sơ trễ (kết quả nhiễu)
    for sname, raw, slas in (("tiep_nhan", tn, (112, 80)), ("tham_dinh", td, (40,))):
        cfg = E.STAGES[sname]
        pool = E.pool_of(raw, cfg["grid"], 7)
        tr, va = pool[pool.split == "train"], pool[pool.split == "valid"]
        preds = {kind: E.fit_cal(kind, tr, va, num, cat, 1) for kind, num, cat in (("base", E.SLA_NUM, []), ("lr", cfg["num"], E.CAT), ("gb", cfg["num"], E.CAT))}
        for L in slas:
            te = E.test_at(raw, L)
            r = {"sla": L, "late_rate": round(float(te.y.mean()), 4), "test_rows": int(len(te)), "late_rows": int(te.y.sum())}
            ok = te.y.nunique() > 1
            for kind in ("base", "lr", "gb"):
                r[kind + "_auc"] = round(E.auc(te.y, preds[kind](te)), 4) if ok else None
            ch = cfg["chosen"]
            r["gain_chosen_vs_base"] = None if not ok else round(r[ch + "_auc"] - r["base_auc"], 4)
            res[f"{sname}_sla{L}"] = r
    return res


def sensitivity(n_cases):
    S = importlib.import_module("simulate_v4")
    P0 = dict(S.PARAMS)

    def scaled(pred, f):
        return {k: v * f for k, v in P0.items() if pred(k) and isinstance(v, (int, float))}
    scen = {
        "goc": {},
        "bien_an_it_hon (sigma ẩn x0,5)": scaled(lambda k: k.startswith("hidden_"), 0.5),
        "bien_an_nhieu_hon (sigma ẩn x1,5)": scaled(lambda k: k.startswith("hidden_"), 1.5),
        "thoi_gian_xu_ly_giam_20%": scaled(lambda k: k.endswith("_median") and not k.startswith("dn_"), 0.8),
        "thoi_gian_xu_ly_tang_20%": scaled(lambda k: k.endswith("_median") and not k.startswith("dn_"), 1.2),
        "do_nhay_hang_cho_yeu (beta x0,5)": scaled(lambda k: k.startswith("beta_"), 0.5),
        "do_nhay_hang_cho_manh (beta x1,5)": scaled(lambda k: k.startswith("beta_"), 1.5),
    }
    out = {}
    for k, (name, change) in enumerate(scen.items()):
        S.PARAMS.update(P0)
        S.PARAMS.update(change)
        t0 = time.time()
        tn, td = build_timelines(S, n_cases, 2026 + k)
        out[name] = eval_scenario(tn, td)
        out[name]["seconds"] = round(time.time() - t0, 1)
        print("  độ nhạy:", name, {k: v["gain_chosen_vs_base"] for k, v in out[name].items() if isinstance(v, dict)}, flush=True)
    S.PARAMS.update(P0)
    return out


# ---------------------------------------------------------------- hình
def figures(diag, exp):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except Exception as e:  # noqa: BLE001
        print("Không có matplotlib, bỏ qua vẽ hình:", e)
        return
    os.makedirs(FIG, exist_ok=True)
    BLUE, ORANGE, GRAY = "#2a78d6", "#eb6834", "#8a8984"
    plt.rcParams.update({"font.size": 11, "axes.spines.top": False, "axes.spines.right": False})
    title = {"tiep_nhan": "Tiếp nhận (SLA 112 giờ)", "tham_dinh": "Thẩm định (SLA 40 giờ)"}
    for s in ("tiep_nhan", "tham_dinh"):
        d = diag["roc_threshold"][s]
        fig, ax = plt.subplots(figsize=(4.6, 4.2))
        ax.plot(d["roc_baseline"]["fpr"], d["roc_baseline"]["tpr"], color=GRAY, lw=2, label=f"Đường cơ sở (AUC {d['roc_baseline']['auc']:.3f})")
        ax.plot(d["roc_model"]["fpr"], d["roc_model"]["tpr"], color=BLUE, lw=2, label=f"Mô hình (AUC {d['roc_model']['auc']:.3f})")
        ax.plot([0, 1], [0, 1], ls="--", color=GRAY, lw=1)
        ax.set_xlabel("Tỷ lệ báo nhầm"); ax.set_ylabel("Tỷ lệ phát hiện"); ax.set_title(title[s]); ax.legend(loc="lower right", frameon=False)
        fig.tight_layout(); fig.savefig(os.path.join(FIG, f"roc_{s}.png"), dpi=200); plt.close(fig)
        sw = d["threshold_sweep"]
        fig, ax = plt.subplots(figsize=(4.6, 4.2))
        xs = [r["threshold"] for r in sw]
        ax.plot(xs, [r["precision"] for r in sw], color=BLUE, lw=2, label="Độ chính xác")
        ax.plot(xs, [r["recall"] for r in sw], color=ORANGE, lw=2, label="Độ phủ")
        ax.plot(xs, [r["false_alarm"] for r in sw], color=GRAY, lw=2, label="Báo nhầm")
        for t in (0.35, 0.60):
            ax.axvline(t, color=GRAY, ls=":", lw=1)
        ax.set_xlabel("Ngưỡng xác suất"); ax.set_ylabel("Tỷ lệ theo hồ sơ"); ax.set_title(title[s]); ax.legend(frameon=False)
        fig.tight_layout(); fig.savefig(os.path.join(FIG, f"nguong_{s}.png"), dpi=200); plt.close(fig)
    labels = {"full": "Đầy đủ", "no_case_info": "Bỏ thông tin hồ sơ", "no_operational": "Bỏ đặc trưng vận hành", "no_last_event": "Bỏ giờ từ thao tác gần nhất",
              "no_calibration": "Không hiệu chỉnh", "clock_only": "Chỉ đồng hồ SLA"}
    fig, axs = plt.subplots(1, 2, figsize=(9.2, 3.8), sharex=False)
    for ax, s in zip(axs, ("tiep_nhan", "tham_dinh")):
        ab = exp["stages"][s]["seeds"]["ablation"]
        names = list(ab)
        m = [ab[k]["auc"]["mean"] for k in names]
        e = [ab[k]["auc"]["std"] for k in names]
        ax.barh([labels[k] for k in names], m, xerr=e, color=BLUE, height=0.6, ecolor=GRAY)
        ax.set_xlim(0.65, 0.86); ax.invert_yaxis(); ax.set_xlabel("AUC (trung bình ± độ lệch chuẩn)"); ax.set_title(title[s])
    fig.tight_layout(); fig.savefig(os.path.join(FIG, "boc_tach.png"), dpi=200); plt.close(fig)
    fig, axs = plt.subplots(1, 2, figsize=(9.2, 3.8))
    for ax, s in zip(axs, ("tiep_nhan", "tham_dinh")):
        fv = exp["stages"][s]["seeds"]["fixed_vs_aware"]
        slas = list(fv)
        w = 0.36
        xs = np.arange(len(slas))
        fk = [k for k in fv[slas[0]] if k.startswith("fixed_at_")][0]
        ax.bar(xs - w / 2, [fv[x]["aware"]["brier"]["mean"] for x in slas], w, color=BLUE, label="SLA là đầu vào")
        ax.bar(xs + w / 2, [fv[x][fk]["brier"]["mean"] for x in slas], w, color=ORANGE, label="SLA cố định")
        ax.set_xticks(xs); ax.set_xticklabels([f"SLA {x}" for x in slas]); ax.set_ylabel("Điểm Brier (nhỏ hơn là tốt)"); ax.set_title(title[s]); ax.legend(frameon=False)
    fig.tight_layout(); fig.savefig(os.path.join(FIG, "sla_nhan_biet.png"), dpi=200); plt.close(fig)
    print("Đã vẽ hình vào", FIG)


def main():
    if "--figures-only" in sys.argv:  # chỉ vẽ lại hình từ kết quả đã có
        with open(OUT.replace("_quick", ""), encoding="utf-8") as f:
            d = json.load(f)
        with open(os.path.join(RES, "experiments_v4.json"), encoding="utf-8") as f:
            figures(d, json.load(f))
        return
    t0 = time.time()
    diag = {"env": {"quick": QUICK, "python": sys.version.split()[0]}, "roc_threshold": {}, "reasons": {}, "oracle": {}, "sensitivity": {}}
    for s in E.STAGES:
        print("== ROC, ngưỡng:", s, flush=True)
        diag["roc_threshold"][s] = roc_and_thresholds(s)
    for s in E.STAGES:
        print("== lý do giải thích:", s, flush=True)
        diag["reasons"][s] = reasons_eval(s)
    n_or = 2000 if QUICK else int(os.environ.get("SIM_N", 20000))
    print(f"== trần lý thuyết: mô phỏng lại {n_or} hồ sơ để lấy biến ẩn", flush=True)
    lat, bad = simulate_with_latents(n_or)
    diag["oracle"]["check"] = {"cases": int(len(lat)), "mismatch_vs_csv": int(bad)}
    print("   kiểm tra khớp với dữ liệu hiện có: lệch", bad, "/", len(lat), flush=True)
    for s in E.STAGES:
        diag["oracle"][s] = oracle_eval(s, lat)
    print("== độ nhạy theo giả định mô phỏng", flush=True)
    diag["sensitivity"] = sensitivity(1200 if QUICK else int(os.environ.get("SIM_N", 20000)))
    diag["runtime_minutes"] = round((time.time() - t0) / 60, 1)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(diag, f, ensure_ascii=False, indent=1)
    exp_path = os.path.join(RES, "experiments_v4.json")
    if os.path.exists(exp_path):
        with open(exp_path, encoding="utf-8") as f:
            figures(diag, json.load(f))
    print("Đã ghi", OUT, "trong", diag["runtime_minutes"], "phút")


if __name__ == "__main__":
    main()
