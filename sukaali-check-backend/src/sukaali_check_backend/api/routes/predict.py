from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from sukaali_check_backend.api.deps import get_current_facility, get_db
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.prediction import PredictionRepository
from sukaali_check_backend.schemas.predict import (
    PredictRequest,
    PredictResponse,
    RecordOut,
    RecordsResponse,
)
from sukaali_check_backend.services import predict_service

router = APIRouter()


@router.post("", response_model=PredictResponse)
def run_prediction(
    data: PredictRequest,
    payload: dict = Depends(get_current_facility),
    db: Session = Depends(get_db),
) -> PredictResponse:
    return predict_service.predict(data, payload["facility_id"], db)


@router.get("/records/{prediction_id}", response_model=RecordOut)
def get_record(
    prediction_id: str,
    payload: dict = Depends(get_current_facility),
    db: Session = Depends(get_db),
) -> RecordOut:
    facility = FacilityRepository(db).get_by_facility_id(payload["facility_id"])
    if not facility:
        raise HTTPException(status_code=404, detail="Record not found")
    record = PredictionRepository(db).get_by_prediction_id(prediction_id)
    if not record or record.facility_id != facility.id:
        raise HTTPException(status_code=404, detail="Record not found")
    return RecordOut(
        prediction_id=record.prediction_id,
        age=record.age,
        sex=record.sex,
        bmi=record.bmi,
        risk_level=record.risk_level,
        risk_score=record.risk_score,
        key_factors=record.key_factors,
        created_at=record.created_at.isoformat(),
    )


@router.get("/records", response_model=RecordsResponse)
def list_records(
    risk: str | None = None,
    limit: int = 50,
    offset: int = 0,
    payload: dict = Depends(get_current_facility),
    db: Session = Depends(get_db),
) -> RecordsResponse:
    facility = FacilityRepository(db).get_by_facility_id(payload["facility_id"])
    if not facility:
        return RecordsResponse(records=[], total=0)
    repo = PredictionRepository(db)
    rows = repo.list_by_facility(facility.id, risk=risk, limit=limit, offset=offset)
    total = repo.count_by_facility(facility.id, risk=risk)
    return RecordsResponse(
        records=[
            RecordOut(
                prediction_id=r.prediction_id,
                age=r.age,
                sex=r.sex,
                bmi=r.bmi,
                risk_level=r.risk_level,
                risk_score=r.risk_score,
                key_factors=r.key_factors,
                created_at=r.created_at.isoformat(),
            )
            for r in rows
        ],
        total=total,
    )
