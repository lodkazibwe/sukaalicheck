import uuid

from sqlalchemy.orm import Session

from sukaali_check_backend.models.prediction_record import PredictionRecord


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
