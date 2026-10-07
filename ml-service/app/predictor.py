# ml-service/app/predictor.py
import os
import joblib
import pandas as pd
from datetime import datetime, timezone
from app.schemas import PredictionRequest, PredictionResponse

class DelayPredictor:
    def __init__(self):
        self.model = None
        self.model_version = "v1.0-rf"
        self._load_model()

    def _load_model(self):
        model_path = os.path.join(os.path.dirname(__file__), 'model', 'delay_model.joblib')
        if os.path.exists(model_path):
            self.model = joblib.load(model_path)
            print(f"[ML Service] Đã tải mô hình thành công từ: {model_path}")
        else:
            print(f"[ML Service] Cảnh báo: Chưa tìm thấy mô hình tại: {model_path}")

    def predict(self, req: PredictionRequest) -> PredictionResponse:
        if self.model is None:
            self._load_model()
            if self.model is None:
                raise RuntimeError("Mô hình chưa được nạp vào bộ nhớ.")

        # Chuẩn bị DataFrame từ Request
        input_data = pd.DataFrame([{
            'loan_amount': req.loan_amount,
            'loan_term_months': req.loan_term_months,
            'established_years': req.established_years,
            'annual_revenue': req.annual_revenue,
            'debt_to_equity': req.debt_to_equity,
            'supplement_count': req.supplement_count,
            'officer_workload': req.officer_workload,
            'previous_stage_duration_hours': req.previous_stage_duration_hours,
            'loan_type': req.loan_type,
            'industry': req.industry
        }])

        # Dự báo xác suất
        prob = float(self.model.predict_proba(input_data)[0, 1])
        is_delayed = bool(prob >= 0.5)

        # Phân loại mức độ nguy cơ
        if prob >= 0.70:
            risk_level = "CAO"
        elif prob >= 0.40:
            risk_level = "TRUNG BÌNH"
        else:
            risk_level = "THẤP"

        # Giải thích nguyên nhân (Explainability / XAI)
        reasons = []
        if req.supplement_count >= 2:
            reasons.append(f"Hồ sơ đã yêu cầu bổ sung chứng từ {req.supplement_count} lần (Yếu tố ảnh hưởng lớn nhất +35% nguy cơ)")
        elif req.supplement_count == 1:
            reasons.append("Hồ sơ đã phát sinh 1 lần yêu cầu bổ sung chứng từ (+15% nguy cơ)")

        if req.officer_workload >= 10:
            reasons.append(f"Cán bộ phụ trách đang xử lý {req.officer_workload} hồ sơ cùng lúc (Tình trạng quá tải công việc)")
        elif req.officer_workload >= 7:
            reasons.append(f"Tải công việc của cán bộ tương đối cao ({req.officer_workload} hồ sơ)")

        if req.industry == 'Xay_Dung':
            reasons.append("Ngành Xây dựng có hồ sơ dự toán và pháp lý phức tạp, thời gian thẩm định thường kéo dài")

        if req.loan_amount >= 10000000000:
            reasons.append(f"Quy mô khoản vay lớn ({req.loan_amount / 1e9:.1f} tỷ VNĐ) đòi hỏi quy trình thẩm định chặt chẽ")

        if req.previous_stage_duration_hours >= 4.5:
            reasons.append(f"Thời gian lưu tại công đoạn Tiếp nhận ({req.previous_stage_duration_hours:.1f} giờ) đã vượt định mức")

        if req.established_years < 3:
            reasons.append(f"Doanh nghiệp mới thành lập ({req.established_years} năm), lịch sử tài chính cần nhiều thời gian đối soát")

        if not reasons:
            reasons.append("Hồ sơ tuân thủ quy chuẩn, đầy đủ chứng từ và cán bộ có tải công việc tối ưu.")

        return PredictionResponse(
            application_id=req.application_id or "SME-UNKNOWN",
            delay_probability=round(prob, 4),
            is_delayed_predicted=is_delayed,
            risk_level=risk_level,
            top_reasons=reasons[:3], # Lấy tối đa top 3 nguyên nhân quan trọng nhất
            model_version=self.model_version,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

predictor = DelayPredictor()
