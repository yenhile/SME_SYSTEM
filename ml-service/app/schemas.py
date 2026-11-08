# ml-service/app/schemas.py — hợp đồng /predict v2 (mô hình v4, nhận biết SLA, theo công đoạn)
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

Stage = Literal["TIEP_NHAN", "THAM_DINH"]
BusinessScope = Literal["SAN_XUAT", "THUONG_MAI", "DICH_VU", "KHAC"]
CollateralMode = Literal["PROPOSED", "NONE_REQUESTED", "UNDECIDED"]


class PredictionRequest(BaseModel):
    application_id: Optional[str] = Field(default="SME-TEST-0001", description="Mã hồ sơ vay")
    stage: Stage = Field(..., description="Công đoạn cần dự báo: TIEP_NHAN hoặc THAM_DINH")
    sla_hours: float = Field(..., gt=0, description="SLA của công đoạn đang áp dụng, tính bằng giờ làm việc")
    elapsed_hours: float = Field(..., ge=0, description="Giờ làm việc ngân hàng đã dùng ở công đoạn (không tính thời gian chờ doanh nghiệp)")
    hours_since_last_event: float = Field(default=0.0, ge=0, description="Giờ làm việc kể từ thao tác gần nhất trên hồ sơ")

    # Thông tin hồ sơ và doanh nghiệp
    proposed_amount_billion: float = Field(..., ge=0.0, description="Số tiền đề xuất vay (tỷ đồng)")
    loan_term_months: int = Field(..., ge=1, le=120)
    established_years: int = Field(default=5, ge=0)
    annual_revenue_billion: float = Field(..., ge=0.0, description="Doanh thu năm (tỷ đồng)")
    has_existing_debt: int = Field(default=0, ge=0, le=1)
    business_scope: BusinessScope = "THUONG_MAI"
    collateral_mode: CollateralMode = "UNDECIDED"

    # Tiếp nhận
    supplement_rounds_so_far: int = Field(default=0, ge=0)
    items_pending_review: int = Field(default=0, ge=0, description="Số tài liệu doanh nghiệp vừa bổ sung đang chờ cán bộ kiểm tra")
    officer_workload: int = Field(default=7, ge=1, description="Số hồ sơ cán bộ tín dụng đang giữ")

    # Thẩm định
    supplement_rounds_total: int = Field(default=0, ge=0)
    tn_bank_hours: float = Field(default=0.0, ge=0.0, description="Giờ làm việc ngân hàng đã dùng ở Tiếp nhận")
    appraisal_queue_len: int = Field(default=4, ge=0, description="Số hồ sơ đang ở công đoạn Thẩm định")
    appraisers_active: int = Field(default=3, ge=1, description="Số Thẩm quyền đang hoạt động")
    clarify_rounds_so_far: int = Field(default=0, ge=0)
    clarify_open: int = Field(default=0, ge=0, le=1, description="1 nếu đang có yêu cầu làm rõ chưa xử lý xong")

    class Config:
        json_schema_extra = {
            "example": {
                "application_id": "SME-20261106-0002", "stage": "THAM_DINH", "sla_hours": 40, "elapsed_hours": 24,
                "hours_since_last_event": 8, "proposed_amount_billion": 5.0, "loan_term_months": 12, "established_years": 8,
                "annual_revenue_billion": 45.0, "has_existing_debt": 1, "business_scope": "SAN_XUAT", "collateral_mode": "PROPOSED",
                "supplement_rounds_total": 1, "tn_bank_hours": 44.0, "appraisal_queue_len": 6, "appraisers_active": 2,
                "clarify_rounds_so_far": 1, "clarify_open": 1,
            }
        }


class PredictionResponse(BaseModel):
    application_id: str
    stage: Stage
    delay_probability: float = Field(..., description="Xác suất hồ sơ vượt SLA của công đoạn (0.0 - 1.0), đã hiệu chỉnh")
    alert_level: Literal["BINH_THUONG", "CHU_Y", "KHAN", "QUA_HAN"] = Field(..., description="Mức cảnh báo theo ngưỡng 0,35 và 0,60; QUA_HAN khi đã vượt SLA")
    risk_level: str = Field(..., description="Tương thích bản cũ: THẤP, TRUNG BÌNH, CAO")
    is_delayed_predicted: bool
    remaining_hours: float = Field(..., description="Giờ làm việc còn lại đến hạn SLA (âm nếu đã quá hạn)")
    top_reasons: List[str] = Field(..., description="Nguyên nhân chính làm tăng nguy cơ (tối đa 3)")
    model_version: str
    timestamp: str
