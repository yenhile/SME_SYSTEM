"""Bước 4 đến 6: rule base, huấn luyện và so sánh mô hình, giải thích nguyên nhân trễ.

Chạy sau simulate.py. Không ghi đè mô hình hay dữ liệu của ml-service hiện hành.
"""
import json
import os
import sys

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(__file__)
SEED = 42
NUMERIC = ["proposed_amount_billion", "loan_term_months", "established_years", "annual_revenue_billion",
           "has_existing_debt", "supplement_count", "return_count", "officer_workload", "intake_work_hours"]
CATEGORICAL = ["business_scope", "collateral_mode"]
TARGET = "is_late"
LABELS_VI = {
    "proposed_amount_billion": "Số tiền đề nghị lớn", "loan_term_months": "Thời hạn vay",
    "established_years": "Số năm hoạt động", "annual_revenue_billion": "Doanh thu năm",
    "has_existing_debt": "Doanh nghiệp đang có dư nợ", "supplement_count": "Số lần yêu cầu bổ sung",
    "return_count": "Số lần trả sửa", "officer_workload": "Cán bộ đang giữ nhiều hồ sơ",
    "intake_work_hours": "Thời gian ở Tiếp nhận dài",
    "collateral_mode_PROPOSED": "Có đề xuất tài sản bảo đảm cần thẩm định",
    "business_scope_SAN_XUAT": "Ngành sản xuất",
}


def rule_score(d: pd.DataFrame) -> np.ndarray:
    """Rule base: cộng điểm theo ngưỡng thô, KHÔNG phải công thức dùng để sinh dữ liệu. [GD] ngưỡng cần khảo sát xác nhận."""
    s = np.zeros(len(d))
    s += np.where(d.supplement_count >= 2, 2, np.where(d.supplement_count == 1, 1, 0))
    s += np.where(d.officer_workload >= 10, 2, np.where(d.officer_workload >= 8, 1, 0))
    s += (d.collateral_mode == "PROPOSED").astype(int)
    s += d.has_existing_debt
    s += (d.proposed_amount_billion > 5).astype(int)
    s += (d.return_count >= 1).astype(int)
    s += (d.intake_work_hours > 4).astype(int)
    return s


def metrics(y, prob, pred):
    tn, fp, fn, tp = confusion_matrix(y, pred).ravel()
    order = np.argsort(-prob)
    k = int(0.2 * len(y))
    recall_at_20 = float(np.asarray(y)[order[:k]].sum() / max(1, np.asarray(y).sum()))
    return {
        "precision": round(precision_score(y, pred), 4), "recall": round(recall_score(y, pred), 4),
        "f1": round(f1_score(y, pred), 4), "roc_auc": round(roc_auc_score(y, prob), 4),
        "pr_auc": round(average_precision_score(y, prob), 4), "recall_at_top20pct": round(recall_at_20, 4),
        "tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp),
    }


def main():
    df = pd.read_csv(os.path.join(HERE, "data", "sme_appraisal_delay_sim_v2.csv"))
    X, y = df[NUMERIC + CATEGORICAL], df[TARGET]
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.30, random_state=SEED, stratify=y)
    result = {"n_train": len(Xtr), "n_test": len(Xte), "late_rate_train": round(float(ytr.mean()), 4),
              "late_rate_test": round(float(yte.mean()), 4), "models": {}}

    # --- Rule base ---
    s_tr, s_te = rule_score(Xtr), rule_score(Xte)
    best_t, best_f = 0, -1
    for t in range(1, 10):
        f = f1_score(ytr, (s_tr >= t).astype(int))
        if f > best_f:
            best_t, best_f = t, f
    prob_rule = s_te / max(1.0, s_tr.max())
    result["models"]["Rule base"] = {**metrics(yte, prob_rule, (s_te >= best_t).astype(int)), "threshold_score": best_t}

    pre = ColumnTransformer([("num", StandardScaler(), NUMERIC),
                             ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL)])
    models = {
        "Logistic Regression": LogisticRegression(class_weight="balanced", max_iter=2000, random_state=SEED),
        "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_leaf=10,
                                                class_weight="balanced", random_state=SEED, n_jobs=-1),
        "Gradient Boosting": HistGradientBoostingClassifier(max_depth=4, learning_rate=0.08, max_iter=200,
                                                            class_weight="balanced", random_state=SEED),
    }
    fitted = {}
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    for name, clf in models.items():
        pipe = Pipeline([("pre", pre), ("clf", clf)])
        cv_auc = cross_val_score(pipe, Xtr, ytr, cv=skf, scoring="roc_auc")
        cv_ap = cross_val_score(pipe, Xtr, ytr, cv=skf, scoring="average_precision")
        pipe.fit(Xtr, ytr)
        prob = pipe.predict_proba(Xte)[:, 1]
        m = metrics(yte, prob, (prob >= 0.5).astype(int))
        m["cv5_roc_auc_mean"], m["cv5_roc_auc_std"] = round(float(cv_auc.mean()), 4), round(float(cv_auc.std()), 4)
        m["cv5_pr_auc_mean"], m["cv5_pr_auc_std"] = round(float(cv_ap.mean()), 4), round(float(cv_ap.std()), 4)
        result["models"][name] = m
        fitted[name] = pipe

    # --- Giải thích: hệ số Logistic Regression (đã chuẩn hóa) ---
    lr = fitted["Logistic Regression"]
    names = list(lr.named_steps["pre"].get_feature_names_out())
    coefs = lr.named_steps["clf"].coef_[0]
    result["lr_coefficients"] = sorted(
        [{"feature": n.replace("num__", "").replace("cat__", ""), "coef": round(float(c), 3)} for n, c in zip(names, coefs)],
        key=lambda r: -abs(r["coef"]))

    # --- Giải thích: độ quan trọng hoán vị của Random Forest trên tập kiểm thử ---
    rf = fitted["Random Forest"]
    pi = permutation_importance(rf, Xte, yte, scoring="roc_auc", n_repeats=5, random_state=SEED, n_jobs=-1)
    result["rf_permutation_importance"] = sorted(
        [{"feature": f, "auc_drop": round(float(v), 4)} for f, v in zip(NUMERIC + CATEGORICAL, pi.importances_mean)],
        key=lambda r: -r["auc_drop"])

    # --- Ví dụ giải thích từng hồ sơ bằng Logistic Regression: đóng góp = hệ số x giá trị đã chuẩn hóa ---
    Xt = lr.named_steps["pre"].transform(Xte)
    probs = lr.predict_proba(Xte)[:, 1]
    examples = []
    for idx in np.argsort(-probs)[:3]:
        contrib = Xt[idx] * coefs
        top = np.argsort(-contrib)[:3]
        reasons = []
        for j in top:
            raw = names[j].replace("num__", "").replace("cat__", "")
            if contrib[j] > 0:
                reasons.append({"feature": raw, "contribution": round(float(contrib[j]), 3),
                                "label": LABELS_VI.get(raw, raw)})
        row = Xte.iloc[idx].to_dict()
        examples.append({"prob_late": round(float(probs[idx]), 3), "actual_late": int(yte.iloc[idx]),
                         "inputs": row, "top_reasons": reasons})
    result["lr_explain_examples"] = examples

    out_dir = os.path.join(HERE, "results")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "metrics_v2.json"), "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2, default=str)
    print(json.dumps(result, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
