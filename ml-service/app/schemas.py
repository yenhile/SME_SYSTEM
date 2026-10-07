# ml-service/app/schemas.py
from typing import Optional, List
from pydantic import BaseModel, Field

class PredictionRequest(BaseModel):
    application_id: Optional[str] = Field(default="SME-TEST-0001", description="Mã hồ sơ vay")
    loan_amount: float = Field(..., description="Số tiền đề xuất vay (VNĐ)", ge=10000000)
    loan_term_months: int = Field(..., description="Thời hạn vay (tháng)", ge=1, le=120)
    loan_type: str = Field(..., description="Loại vay: VAY_VON_LUU_DONG, VAY_DAU_TU_TSCD, THAU_CHI")
    industry: str = Field(..., description="Ngành nghề: San_Xuat, Xay_Dung, Thuong_Mai_Dich_Vu, Nong_Nghiep, Van_Tai_Kho_Bai")
    established_years: int = Field(default=5, description="Số năm hoạt động của doanh nghiệp", ge=0)
    annual_revenue: float = Field(..., description="Doanh thu hàng năm (VNĐ)", ge=0)
    debt_to_equity: float = Field(default=1.5, description="Tỷ lệ nợ trên vốn chủ sở hữu", ge=0.0)
    supplement_count: int = Field(default=0, description="Số lần yêu cầu bổ sung chứng từ", ge=0)
    officer_workload: int = Field(default=5, description="Số hồ sơ cán bộ phụ trách đang xử lý", ge=1)
    previous_stage_duration_hours: float = Field(default=3.5, description="Thời gian đã xử lý ở công đoạn trước (giờ)", ge=0.0)

    class Config:
        json_schema_extra = {
            "example": {
                "application_id": "SME-20260915-0002",
                "loan_amount": 8000000000,
                "loan_term_months": 60,
                "loan_type": "VAY_DAU_TU_TSCD",
                "industry": "Xay_Dung",
                "established_years": 8,
                "annual_revenue": 45000000000,
                "debt_to_equity": 2.1,
                "supplement_count": 2,
                "officer_workload": 12,
                "previous_stage_duration_hours": 5.2
            }
        }

class PredictionResponse(BaseModel):
    application_id: str
    delay_probability: float = Field(..., description="Xác suất hồ sơ bị trễ hạn SLA (0.0 - 1.0)")
    is_delayed_predicted: bool = Field(..., description="Nhãn dự báo (True: Trễ, False: Đúng hạn)")
    risk_level: str = Field(..., description="Mức độ nguy cơ: THẤP, TRUNG BÌNH, CAO")
    top_reasons: List[str] = Field(..., description="Các yếu tố giải thích nguyên nhân gây trễ (Explainability / XAI)")
    model_version: str
    timestamp: str
