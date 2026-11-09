import logging
import os
import json
import secrets
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import PredictionRequest, PredictionResponse
from app.predictor import predictor, SlaOutOfRange

logger = logging.getLogger("ml-service")


def require_api_key(x_api_key: str = Header(default="")) -> None:
    """Khi đặt biến ML_API_KEY, chỉ backend (gửi đúng khóa trong header X-API-Key) được gọi /predict. Không đặt = chạy local không xác thực."""
    expected = os.environ.get("ML_API_KEY", "")
    if expected and not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Thiếu hoặc sai khóa truy cập.")


app = FastAPI(
    title="SME Loan Delay Prediction Service",
    description="Dịch vụ Học máy Dự báo Nguy cơ Chậm tiến độ xử lý Hồ sơ vay Doanh nghiệp nhỏ và vừa (SME)",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    # Backend gọi server-to-server nên mặc định không mở CORS cho trình duyệt; cần thì liệt kê tên miền trong ML_CORS_ORIGINS (phân tách bằng dấu phẩy).
    allow_origins=[o.strip() for o in os.environ.get("ML_CORS_ORIGINS", "").split(",") if o.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)

@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "prediction",
        "model_loaded": predictor.model is not None,
        "model_version": predictor.model_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.post("/predict", response_model=PredictionResponse, dependencies=[Depends(require_api_key)])
def predict_loan_delay(request: PredictionRequest):
    try:
        return predictor.predict(request)
    except SlaOutOfRange as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception:
        logger.exception("Lỗi khi dự báo")
        raise HTTPException(status_code=500, detail="Lỗi khi dự báo. Xem log dịch vụ ML để biết chi tiết.")

@app.get("/metadata")
def get_model_metadata() -> dict:
    meta_path = os.path.join(os.path.dirname(__file__), 'model', 'model_metadata.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"message": "Chưa có thông tin metadata mô hình."}
