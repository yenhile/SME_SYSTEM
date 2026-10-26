# ml-service/scripts/evaluate_model.py
"""Đánh giá mô hình dự báo nguy cơ trễ SLA (TK-12). Chỉ đọc: KHÔNG ghi đè delay_model.joblib hay model_metadata.json.

Cách chạy (cần pandas, scikit-learn, joblib):
    python ml-service/scripts/evaluate_model.py > evaluation_result.json
Kết quả là JSON in ra stdout; số liệu trong docs/Bao_cao_Mo_hinh_Machine_Learning.md lấy từ đây.
"""
import contextlib
import importlib.util
import io
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, brier_score_loss, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_CSV = os.path.join(HERE, '..', 'data', 'synthetic_loan_delay_dataset.csv')
MODEL_FILE = os.path.join(HERE, '..', 'app', 'model', 'delay_model.joblib')
META_FILE = os.path.join(HERE, '..', 'app', 'model', 'model_metadata.json')
GENERATOR = os.path.join(HERE, 'generate_synthetic_data.py')

NUMERIC = ['loan_amount', 'loan_term_months', 'established_years', 'annual_revenue', 'debt_to_equity',
           'supplement_count', 'officer_workload', 'previous_stage_duration_hours']
CATEGORICAL = ['loan_type', 'industry']
TARGET = 'is_delayed'


def load_generator():
    spec = importlib.util.spec_from_file_location('generate_synthetic_data', GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def pipeline(kind, drop=None):
    numeric = [c for c in NUMERIC if c != drop]
    pre = ColumnTransformer([('num', StandardScaler(), numeric),
                             ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), CATEGORICAL)])
    clf = (LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42) if kind == 'lr'
           else RandomForestClassifier(n_estimators=150, max_depth=8, class_weight='balanced', random_state=42))
    return Pipeline([('preprocessor', pre), ('classifier', clf)])


def metrics(y_true, prob, threshold=0.5):
    pred = (prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    return {
        'accuracy': round(accuracy_score(y_true, pred), 4),
        'precision': round(precision_score(y_true, pred, zero_division=0), 4),
        'recall': round(recall_score(y_true, pred), 4),
        'f1_score': round(f1_score(y_true, pred), 4),
        'roc_auc': round(roc_auc_score(y_true, prob), 4),
        'confusion_matrix': {'TN': int(tn), 'FP': int(fp), 'FN': int(fn), 'TP': int(tp)},
    }


def split(df, drop=None):
    cols = [c for c in NUMERIC if c != drop] + CATEGORICAL
    return train_test_split(df[cols], df[TARGET], test_size=0.20, random_state=42, stratify=df[TARGET])


def main():
    out = {'environment': {'python': sys.version.split()[0], 'scikit_learn': sklearn.__version__,
                           'pandas': pd.__version__, 'numpy': np.__version__}}
    df = pd.read_csv(DATA_CSV)
    gen = load_generator()
    out['dataset'] = {'rows': len(df), 'delayed': int(df[TARGET].sum()), 'delay_rate': round(float(df[TARGET].mean()), 4)}

    # 1. Dữ liệu trong repo có tái tạo được bằng script sinh dữ liệu không
    with contextlib.redirect_stdout(io.StringIO()):
        regen = gen.generate_dataset(n_samples=3000, random_state=42)
    same = all(np.allclose(regen[c], df[c]) if c in NUMERIC or c == TARGET else (regen[c].values == df[c].values).all()
               for c in NUMERIC + CATEGORICAL + [TARGET])
    out['dataset']['reproducible_from_generator_seed42'] = bool(same)

    # 2. Huấn luyện lại đúng cấu hình train_and_compare.py và đối chiếu metadata đã lưu
    X_train, X_test, y_train, y_test = split(df)
    out['split'] = {'train': len(X_train), 'test': len(X_test), 'test_delayed': int(y_test.sum()),
                    'majority_class_accuracy': round(float(1 - y_test.mean()), 4)}
    results = {}
    fitted = {}
    for kind in ('lr', 'rf'):
        pipe = pipeline(kind).fit(X_train, y_train)
        fitted[kind] = pipe
        results[kind] = metrics(y_test, pipe.predict_proba(X_test)[:, 1])
    out['retrained'] = results
    saved = joblib.load(MODEL_FILE)
    out['saved_model_on_same_test_set'] = metrics(y_test, saved.predict_proba(X_test)[:, 1])
    with open(META_FILE, encoding='utf-8') as f:
        meta = json.load(f)
    out['metadata_reported'] = {m['model_name']: {k: m[k] for k in ('accuracy', 'precision', 'recall', 'f1_score', 'roc_auc')}
                                for m in meta['metrics_comparison']}

    # 3. Kiểm định chéo 5 lớp (toàn bộ dữ liệu)
    X_all, y_all = df[NUMERIC + CATEGORICAL], df[TARGET]
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scoring = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc']
    out['cross_validation_5fold'] = {}
    for kind in ('lr', 'rf'):
        r = cross_validate(pipeline(kind), X_all, y_all, cv=cv, scoring=scoring)
        out['cross_validation_5fold'][kind] = {m: {'mean': round(float(r[f'test_{m}'].mean()), 4),
                                                    'std': round(float(r[f'test_{m}'].std()), 4)} for m in scoring}

    # 4. Ngưỡng quyết định (Random Forest, tập test)
    prob_rf = fitted['rf'].predict_proba(X_test)[:, 1]
    out['threshold_sensitivity_rf'] = {str(t): {k: v for k, v in metrics(y_test, prob_rf, t).items()
                                               if k in ('precision', 'recall', 'f1_score')} for t in (0.3, 0.4, 0.5, 0.6, 0.7)}
    out['brier_score_rf'] = round(float(brier_score_loss(y_test, prob_rf)), 4)

    # 5. Mức nguy cơ theo cách predictor.py phân loại: tỷ lệ trễ thực tế trong từng mức
    bands = {'THẤP (<0.40)': prob_rf < 0.40, 'TRUNG BÌNH (0.40-0.70)': (prob_rf >= 0.40) & (prob_rf < 0.70), 'CAO (>=0.70)': prob_rf >= 0.70}
    out['risk_bands_rf'] = {name: {'n': int(mask.sum()), 'actual_delay_rate': round(float(y_test.values[mask].mean()), 4) if mask.any() else None}
                            for name, mask in bands.items()}

    # 6. Tầm quan trọng: impurity (đã lưu) so với permutation trên tập test
    perm = permutation_importance(fitted['rf'], X_test, y_test, scoring='roc_auc', n_repeats=10, random_state=42)
    out['permutation_importance_rf_roc_auc_drop'] = {c: {'mean': round(float(m), 4), 'std': round(float(s), 4)}
                                                      for c, m, s in sorted(zip(X_test.columns, perm.importances_mean, perm.importances_std),
                                                                            key=lambda t: -t[1])}

    # 7. Bỏ đặc trưng supplement_count (đặc trưng chủ đạo)
    Xtr, Xte, ytr, yte = split(df, drop='supplement_count')
    abl = pipeline('rf', drop='supplement_count').fit(Xtr, ytr)
    out['ablation_rf_without_supplement_count'] = metrics(yte, abl.predict_proba(Xte)[:, 1])

    # 8. Độ ổn định theo seed sinh dữ liệu (cùng công thức sinh nhãn)
    stability = []
    for seed in (1, 2, 3, 4, 5):
        with contextlib.redirect_stdout(io.StringIO()):
            d = gen.generate_dataset(n_samples=3000, random_state=seed)
        a, b, c, e = split(d)
        p = pipeline('rf').fit(a, c).predict_proba(b)[:, 1]
        m = metrics(e, p)
        stability.append({'seed': seed, 'delay_rate': round(float(d[TARGET].mean()), 4), 'f1_score': m['f1_score'], 'roc_auc': m['roc_auc']})
    out['seed_stability_rf'] = stability

    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
