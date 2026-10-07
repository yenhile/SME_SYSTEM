# ml-service/scripts/generate_synthetic_data.py
import os
import sys
import numpy as np
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def generate_dataset(n_samples=3000, random_state=42):
    np.random.seed(random_state)
    
    app_ids = [f"SME-2025-{i+1:04d}" for i in range(n_samples)]
    
    # 1. Loan characteristics
    loan_types = ['VAY_VON_LUU_DONG', 'VAY_DAU_TU_TSCD', 'THAU_CHI']
    loan_type_probs = [0.55, 0.30, 0.15]
    loan_type_col = np.random.choice(loan_types, size=n_samples, p=loan_type_probs)
    
    # Số tiền vay (500 triệu đến 25 tỷ)
    loan_amounts = np.round(np.exp(np.random.uniform(np.log(5e8), np.log(2.5e10), size=n_samples)) / 1e7) * 1e7
    
    # Thời hạn vay (tháng)
    terms_by_type = {
        'VAY_VON_LUU_DONG': [6, 9, 12],
        'VAY_DAU_TU_TSCD': [24, 36, 48, 60],
        'THAU_CHI': [6, 12]
    }
    loan_terms = [int(np.random.choice(terms_by_type[lt])) for lt in loan_type_col]
    
    # 2. SME Characteristics
    industries = ['San_Xuat', 'Xay_Dung', 'Thuong_Mai_Dich_Vu', 'Nong_Nghiep', 'Van_Tai_Kho_Bai']
    industry_probs = [0.30, 0.20, 0.30, 0.10, 0.10]
    industry_col = np.random.choice(industries, size=n_samples, p=industry_probs)
    
    established_years = np.random.randint(1, 25, size=n_samples)
    
    # Doanh thu năm (tỷ đồng)
    annual_revenue = np.round(loan_amounts * np.random.uniform(1.8, 6.5, size=n_samples) / 1e7) * 1e7
    
    # Tỷ lệ nợ trên vốn chủ sở hữu (Debt-to-Equity)
    debt_to_equity = np.round(np.random.uniform(0.4, 4.5, size=n_samples), 2)
    
    # 3. Workflow & Operational Characteristics
    # Số lần yêu cầu bổ sung hồ sơ
    supplement_probs = [0.65, 0.22, 0.08, 0.04, 0.01]
    supplement_counts = np.random.choice([0, 1, 2, 3, 4], size=n_samples, p=supplement_probs)
    
    # Tải công việc của cán bộ phụ trách (số hồ sơ đang xử lý đồng thời)
    officer_workloads = np.random.randint(2, 18, size=n_samples)
    
    # Thời gian lưu ở công đoạn Tiếp nhận trước khi thẩm định (giờ)
    stage_1_durations = np.round(np.random.gamma(shape=3.0, scale=1.2, size=n_samples), 1)
    stage_1_durations = np.clip(stage_1_durations, 1.0, 12.0)
    
    # 4. Target Calculation (is_delayed) với tỷ lệ thực tế ~12-14% trễ hạn
    # Logit model phản ánh các nguyên nhân gây trễ thực tế trong ngân hàng:
    logit = (
        -3.4
        + 1.35 * supplement_counts                       # Bổ sung nhiều lần là nguyên nhân hàng đầu
        + 0.16 * (officer_workloads - 6)                # Cán bộ quá tải (> 6 hồ sơ)
        + 0.45 * (industry_col == 'Xay_Dung')           # Xây dựng có hồ sơ dự toán phức tạp
        + 0.35 * (loan_type_col == 'VAY_DAU_TU_TSCD')   # Vay mua TSCĐ cần định giá máy móc/nhà xưởng
        + 0.06 * (loan_amounts / 1e9)                   # Khoản vay lớn cần soi xét kỹ
        + 0.12 * (stage_1_durations - 4.0)              # Bị dây dưa từ công đoạn tiếp nhận
        - 0.04 * established_years                      # DN lâu năm hồ sơ minh bạch hơn
        + np.random.normal(0, 0.35, size=n_samples)     # Nhiễu thực tế
    )
    
    delay_prob = 1.0 / (1.0 + np.exp(-logit))
    # Dán nhãn nhị phân
    is_delayed = (delay_prob >= 0.5).astype(int)
    
    df = pd.DataFrame({
        'application_id': app_ids,
        'loan_amount': loan_amounts,
        'loan_term_months': loan_terms,
        'loan_type': loan_type_col,
        'industry': industry_col,
        'established_years': established_years,
        'annual_revenue': annual_revenue,
        'debt_to_equity': debt_to_equity,
        'supplement_count': supplement_counts,
        'officer_workload': officer_workloads,
        'previous_stage_duration_hours': stage_1_durations,
        'delay_probability_true': np.round(delay_prob, 3),
        'is_delayed': is_delayed
    })
    
    print(f"Tổng số mẫu: {len(df)}")
    print(f"Số hồ sơ trễ hạn: {df['is_delayed'].sum()} ({df['is_delayed'].mean() * 100:.2f}%)")
    print(f"Số hồ sơ đúng hạn: {len(df) - df['is_delayed'].sum()} ({(1 - df['is_delayed'].mean()) * 100:.2f}%)")
    
    return df

if __name__ == '__main__':
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    out_file = os.path.join(data_dir, 'synthetic_loan_delay_dataset.csv')
    
    df = generate_dataset(n_samples=3000)
    df.to_csv(out_file, index=False, encoding='utf-8')
    print(f"Đã lưu dataset thành công tại: {out_file}")
