# ml-service/scripts/train_and_compare.py
import os
import sys
import json
import joblib
import pandas as pd
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, classification_report, confusion_matrix

def main():
    print("==========================================================")
    print("HUẤN LUYỆN VÀ SO SÁNH MÔ HÌNH DỰ BÁO NGUY CƠ CHẬM TRỄ (AI)")
    print("==========================================================")
    
    # 1. Đọc dữ liệu
    script_dir = os.path.dirname(__file__)
    data_path = os.path.join(script_dir, '..', 'data', 'synthetic_loan_delay_dataset.csv')
    df = pd.read_csv(data_path)
    print(f"Đã nạp dataset: {len(df)} dòng, tỷ lệ trễ hạn: {df['is_delayed'].mean() * 100:.2f}%\n")
    
    # 2. Định nghĩa các đặc trưng
    numeric_features = [
        'loan_amount',
        'loan_term_months',
        'established_years',
        'annual_revenue',
        'debt_to_equity',
        'supplement_count',
        'officer_workload',
        'previous_stage_duration_hours'
    ]
    categorical_features = ['loan_type', 'industry']
    target = 'is_delayed'
    
    X = df[numeric_features + categorical_features]
    y = df[target]
    
    # 3. Phân chia tập huấn luyện & kiểm thử (80% Train - 20% Test, phân tầng Stratified)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    print(f"Tập huấn luyện (Train): {len(X_train)} mẫu ({y_train.sum()} trễ hạn)")
    print(f"Tập kiểm thử (Test):     {len(X_test)} mẫu ({y_test.sum()} trễ hạn)\n")
    
    # 4. Pipeline Tiền xử lý dữ liệu
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore', sparse_output=False), categorical_features)
        ]
    )
    
    # 5. Huấn luyện Mô hình 1: Logistic Regression (Baseline)
    print("--- 1. Huấn luyện Mô hình 1 (Baseline): Logistic Regression ---")
    pipe_lr = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', LogisticRegression(class_weight='balanced', max_iter=1000, random_state=42))
    ])
    pipe_lr.fit(X_train, y_train)
    y_pred_lr = pipe_lr.predict(X_test)
    y_prob_lr = pipe_lr.predict_proba(X_test)[:, 1]
    
    metrics_lr = {
        'model_name': 'Logistic Regression (Baseline)',
        'accuracy': round(accuracy_score(y_test, y_pred_lr), 4),
        'precision': round(precision_score(y_test, y_pred_lr), 4),
        'recall': round(recall_score(y_test, y_pred_lr), 4),
        'f1_score': round(f1_score(y_test, y_pred_lr), 4),
        'roc_auc': round(roc_auc_score(y_test, y_prob_lr), 4)
    }
    print(f"Accuracy:  {metrics_lr['accuracy']:.4f}")
    print(f"Precision: {metrics_lr['precision']:.4f}")
    print(f"Recall:    {metrics_lr['recall']:.4f} (Khả năng phát hiện hồ sơ trễ)")
    print(f"F1-Score:  {metrics_lr['f1_score']:.4f}")
    print(f"ROC-AUC:   {metrics_lr['roc_auc']:.4f}\n")
    
    # 6. Huấn luyện Mô hình 2: Random Forest Classifier (Nâng cao)
    print("--- 2. Huấn luyện Mô hình 2 (Nâng cao): Random Forest Classifier ---")
    pipe_rf = Pipeline([
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(n_estimators=150, max_depth=8, class_weight='balanced', random_state=42))
    ])
    pipe_rf.fit(X_train, y_train)
    y_pred_rf = pipe_rf.predict(X_test)
    y_prob_rf = pipe_rf.predict_proba(X_test)[:, 1]
    
    metrics_rf = {
        'model_name': 'Random Forest Classifier (Đề xuất)',
        'accuracy': round(accuracy_score(y_test, y_pred_rf), 4),
        'precision': round(precision_score(y_test, y_pred_rf), 4),
        'recall': round(recall_score(y_test, y_pred_rf), 4),
        'f1_score': round(f1_score(y_test, y_pred_rf), 4),
        'roc_auc': round(roc_auc_score(y_test, y_prob_rf), 4)
    }
    print(f"Accuracy:  {metrics_rf['accuracy']:.4f}")
    print(f"Precision: {metrics_rf['precision']:.4f}")
    print(f"Recall:    {metrics_rf['recall']:.4f} (Khả năng phát hiện hồ sơ trễ)")
    print(f"F1-Score:  {metrics_rf['f1_score']:.4f}")
    print(f"ROC-AUC:   {metrics_rf['roc_auc']:.4f}\n")
    
    # 7. Trích xuất Tầm quan trọng của Đặc trưng (Feature Importance / Explainability)
    # Lấy tên các đặc trưng sau khi One-Hot Encoding
    ohe_categories = pipe_rf.named_steps['preprocessor'].named_transformers_['cat'].get_feature_names_out(categorical_features)
    all_feature_names = numeric_features + list(ohe_categories)
    importances = pipe_rf.named_steps['classifier'].feature_importances_
    
    feat_imp = pd.DataFrame({
        'feature': all_feature_names,
        'importance': importances
    }).sort_values(by='importance', ascending=False)
    
    print("--- 3. Top 5 Đặc trưng ảnh hưởng lớn nhất đến nguy cơ trễ hạn (XAI) ---")
    for idx, row in feat_imp.head(5).iterrows():
        print(f" - {row['feature']:30s}: {row['importance'] * 100:.2f}%")
    print()
    
    # 8. Lưu Mô hình tối ưu (Random Forest) vào thư mục app/model
    model_dir = os.path.join(script_dir, '..', 'app', 'model')
    os.makedirs(model_dir, exist_ok=True)
    model_file = os.path.join(model_dir, 'delay_model.joblib')
    joblib.dump(pipe_rf, model_file)
    print(f"Đã lưu mô hình tối ưu vào: {model_file}")
    
    # Lưu metadata để FastAPI load phục vụ giải thích nguyên nhân
    metadata = {
        'model_version': 'v1.0-rf',
        'metrics_comparison': [metrics_lr, metrics_rf],
        'top_features': feat_imp.head(10).to_dict(orient='records'),
        'numeric_features': numeric_features,
        'categorical_features': categorical_features
    }
    meta_file = os.path.join(model_dir, 'model_metadata.json')
    with open(meta_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"Đã lưu metadata mô hình vào: {meta_file}")
    
    return metrics_lr, metrics_rf, feat_imp

if __name__ == '__main__':
    main()
