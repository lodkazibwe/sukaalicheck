import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from sukaali_check_backend.models.prediction_record import PredictionRecord


def hba1c_comment(value: float) -> str:
    """Derive an interpretation comment from an HbA1c result (standard thresholds)."""
    if value < 5.7:
        return "Normal"
    if value < 6.5:
        return "Prediabetes range"
    return "Elevated — diabetes range"


class PredictionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> PredictionRecord:
        record = PredictionRecord(**kwargs)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_by_facility(
        self,
        facility_uuid: uuid.UUID,
        risk: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[PredictionRecord]:
        q = self.db.query(PredictionRecord).filter(
            PredictionRecord.facility_id == facility_uuid
        )
        if risk:
            q = q.filter(PredictionRecord.risk_level == risk)
        return q.order_by(PredictionRecord.created_at.desc()).offset(offset).limit(limit).all()

    def count_by_facility(
        self,
        facility_uuid: uuid.UUID,
        risk: str | None = None,
    ) -> int:
        q = self.db.query(PredictionRecord).filter(
            PredictionRecord.facility_id == facility_uuid
        )
        if risk:
            q = q.filter(PredictionRecord.risk_level == risk)
        return q.count()

    def get_by_prediction_id(self, prediction_id: str) -> PredictionRecord | None:
        return (
            self.db.query(PredictionRecord)
            .filter(PredictionRecord.prediction_id == prediction_id)
            .first()
        )

    def update_hba1c(self, prediction_id: str, value: float) -> PredictionRecord | None:
        record = self.get_by_prediction_id(prediction_id)
        if record is None:
            return None
        record.hba1c_result = value
        record.hba1c_comment = hba1c_comment(value)
        record.hba1c_result_date = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(record)
        return record
