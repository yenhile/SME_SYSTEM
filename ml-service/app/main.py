import os
import json
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import PredictionRequest, PredictionResponse
from app.predictor import predictor

app = FastAPI(
    title="SME Loan Delay Prediction Service",
    description="Dịch vụ Học máy Dự báo Nguy cơ Chậm tiến độ xử lý Hồ sơ vay Doanh nghiệp nhỏ và vừa (SME)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.post("/predict", response_model=PredictionResponse)
def predict_loan_delay(request: PredictionRequest):
    try:
        return predictor.predict(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi dự báo: {str(e)}")

@app.get("/metadata")
def get_model_metadata() -> dict:
    meta_path = os.path.join(os.path.dirname(__file__), 'model', 'model_metadata.json')
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"message": "Chưa có thông tin metadata mô hình."}
