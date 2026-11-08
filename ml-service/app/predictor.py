# ml-service/app/predictor.py — mô hình v4: dự báo nguy cơ vượt SLA theo công đoạn, có giải thích nguyên nhân
import os
from datetime import datetime, timezone
from typing import Dict, List

import joblib
import pandas as pd

from app.schemas import PredictionRequest, PredictionResponse

MODEL_DIR = os.path.join(os.path.dirname(__file__), "model")
ARTIFACTS = {"TIEP_NHAN": "v4_tiep_nhan.joblib", "THAM_DINH": "v4_tham_dinh.joblib"}
TIME_GROUP = ("elapsed_hours", "sla_hours", "remaining_hours")
MIN_DELTA = 0.05   # chỉ nêu nguyên nhân mà bỏ đi thì xác suất giảm ít nhất 5 điểm phần trăm
# Đặc trưng hồ sơ không có cơ chế làm chậm xử lý trong dữ liệu huấn luyện: vẫn là đầu vào của mô hình nhưng không được nêu như "nguyên nhân" vì chỉ là nhiễu.
NOT_REASONS = {"annual_revenue_billion", "established_years", "loan_term_months"}


class SlaOutOfRange(ValueError):
    """SLA nằm ngoài dải mô hình đã học: không dự báo thay vì ngoại suy."""


class DelayPredictor:
    def __init__(self) -> None:
        self.models: Dict[str, dict] = {}
        self.model_version = "v4.0"
        self._load()

    def _load(self) -> None:
        for stage, name in ARTIFACTS.items():
            path = os.path.join(MODEL_DIR, name)
            if os.path.exists(path):
                self.models[stage] = joblib.load(path)
                print(f"[ML Service] Đã tải mô hình {stage} từ: {path}")
            else:
                print(f"[ML Service] Cảnh báo: chưa có mô hình tại: {path}")

    @property
    def model(self):
        """Giữ tên cũ cho /health: có đủ hai mô hình thì coi là đã nạp."""
        return self.models if len(self.models) == len(ARTIFACTS) else None

    def _row(self, art: dict, req: PredictionRequest) -> dict:
        d = req.model_dump()
        d["remaining_hours"] = d["sla_hours"] - d["elapsed_hours"]
        return {c: d[c] for c in art["features"]}

    def _prob(self, art: dict, row: dict) -> float:
        p = float(art["calibrator"].predict(art["pipeline"].predict_proba(pd.DataFrame([row]))[:, 1])[0])
        return min(max(p, 0.0), 1.0)

    def _reasons(self, art: dict, row: dict, base_p: float, req: PredictionRequest) -> List[str]:
        """Giải thích bằng cách thay từng yếu tố bằng giá trị điển hình rồi xem xác suất giảm bao nhiêu."""
        ref = art["ref"]
        deltas = []
        # nhóm thời gian: so với lúc mới vào công đoạn (đã dùng 0 giờ)
        t = dict(row)
        t["elapsed_hours"] = 0.0
        t["remaining_hours"] = row["sla_hours"]
        deltas.append(("time", base_p - self._prob(art, t)))
        for col in art["features"]:
            if col in TIME_GROUP or col in NOT_REASONS:
                continue
            t = dict(row)
            t[col] = ref[col]
            deltas.append((col, base_p - self._prob(art, t)))
        out = []
        for col, delta in sorted(deltas, key=lambda x: -x[1]):
            if delta < MIN_DELTA:
                break
            text = self._text(col, req)
            if text:
                grade = "ảnh hưởng lớn" if delta >= 0.25 else ("ảnh hưởng vừa" if delta >= 0.10 else "ảnh hưởng nhỏ")
                out.append(f"{text} ({grade})")
            if len(out) == 3:
                break
        return out

    @staticmethod
    def _text(col: str, r: PredictionRequest) -> str:
        scope = {"SAN_XUAT": "sản xuất", "THUONG_MAI": "thương mại", "DICH_VU": "dịch vụ", "KHAC": "khác"}
        coll = {"PROPOSED": "có đề xuất tài sản bảo đảm", "NONE_REQUESTED": "không yêu cầu tài sản bảo đảm", "UNDECIDED": "chưa xác định tài sản bảo đảm"}
        return {
            "time": f"Đã dùng {r.elapsed_hours:.1f}/{r.sla_hours:.0f} giờ làm việc, còn {max(0.0, r.sla_hours - r.elapsed_hours):.1f} giờ",
            "hours_since_last_event": f"Hồ sơ chưa có thao tác mới trong {r.hours_since_last_event:.1f} giờ làm việc",
            "supplement_rounds_so_far": f"Đã có {r.supplement_rounds_so_far} lần yêu cầu bổ sung hồ sơ",
            "supplement_rounds_total": f"Đã có {r.supplement_rounds_total} lần yêu cầu bổ sung ở Tiếp nhận",
            "items_pending_review": f"{r.items_pending_review} tài liệu bổ sung đang chờ kiểm tra",
            "officer_workload": f"Cán bộ tín dụng đang giữ {r.officer_workload} hồ sơ",
            "tn_bank_hours": f"Tiếp nhận đã tốn {r.tn_bank_hours:.1f} giờ làm việc",
            "appraisal_queue_len": f"Hàng chờ Thẩm định {r.appraisal_queue_len} hồ sơ trên {r.appraisers_active} Thẩm quyền",
            "appraisers_active": f"Chỉ có {r.appraisers_active} Thẩm quyền đang hoạt động",
            "clarify_rounds_so_far": f"Đã có {r.clarify_rounds_so_far} lần yêu cầu làm rõ",
            "clarify_open": "Đang có yêu cầu làm rõ chưa xử lý xong",
            "proposed_amount_billion": f"Số tiền đề xuất lớn ({r.proposed_amount_billion:.1f} tỷ đồng)",
            "loan_term_months": f"Thời hạn vay {r.loan_term_months} tháng",
            "established_years": f"Doanh nghiệp hoạt động {r.established_years} năm",
            "annual_revenue_billion": f"Doanh thu năm {r.annual_revenue_billion:.1f} tỷ đồng",
            "has_existing_debt": "Doanh nghiệp đang có dư nợ" if r.has_existing_debt else "",
            "business_scope": f"Lĩnh vực {scope.get(r.business_scope, r.business_scope)}",
            "collateral_mode": f"Hồ sơ {coll.get(r.collateral_mode, r.collateral_mode)}",
        }.get(col, "")

    def predict(self, req: PredictionRequest) -> PredictionResponse:
        art = self.models.get(req.stage)
        if art is None:
            self._load()
            art = self.models.get(req.stage)
            if art is None:
                raise RuntimeError(f"Mô hình công đoạn {req.stage} chưa được nạp.")
        grid = art["sla_grid"]
        if not (min(grid) * 0.75 <= req.sla_hours <= max(grid) * 1.25):
            raise SlaOutOfRange(f"SLA {req.sla_hours:g} giờ nằm ngoài dải mô hình đã học ({min(grid)}–{max(grid)} giờ làm việc).")
        remaining = round(req.sla_hours - req.elapsed_hours, 2)
        now = datetime.now(timezone.utc).isoformat()
        app_id = req.application_id or "SME-UNKNOWN"

        if remaining <= 0:   # đã vượt SLA: trạng thái xác định, không cần mô hình
            return PredictionResponse(application_id=app_id, stage=req.stage, delay_probability=1.0, alert_level="QUA_HAN", risk_level="CAO",
                                      is_delayed_predicted=True, remaining_hours=remaining,
                                      top_reasons=[f"Đã dùng {req.elapsed_hours:.1f} giờ làm việc, vượt SLA {req.sla_hours:g} giờ"],
                                      model_version=self.model_version, timestamp=now)

        row = self._row(art, req)
        prob = self._prob(art, row)
        thr = art["thresholds"]
        if prob >= thr["urgent"]:
            level, risk = "KHAN", "CAO"
        elif prob >= thr["watch"]:
            level, risk = "CHU_Y", "TRUNG BÌNH"
        else:
            level, risk = "BINH_THUONG", "THẤP"
        reasons = self._reasons(art, row, prob, req) if prob >= 0.10 else []
        if not reasons:
            reasons = ["Chưa có yếu tố nào làm tăng đáng kể nguy cơ trễ SLA."]
        return PredictionResponse(application_id=app_id, stage=req.stage, delay_probability=round(prob, 4), alert_level=level, risk_level=risk,
                                  is_delayed_predicted=prob >= thr["watch"], remaining_hours=remaining, top_reasons=reasons,
                                  model_version=self.model_version, timestamp=now)


predictor = DelayPredictor()
