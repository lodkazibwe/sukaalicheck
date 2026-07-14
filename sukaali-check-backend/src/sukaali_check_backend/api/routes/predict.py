from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from sukaali_check_backend.api.deps import get_current_facility, get_db
from sukaali_check_backend.models.prediction_record import PredictionRecord
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.prediction import PredictionRepository
from sukaali_check_backend.schemas.predict import (
    HbA1cUpdateRequest,
    PredictRequest,
    PredictResponse,
    RecordOut,
    RecordsResponse,
)
from sukaali_check_backend.services import predict_service

router = APIRouter()


def _record_out(record: PredictionRecord) -> RecordOut:
    return RecordOut(
        prediction_id=record.prediction_id,
        age=record.age,
        sex=record.sex,
        bmi=record.bmi,
        risk_level=record.risk_level,
        risk_score=record.risk_score,
        key_factors=record.key_factors,
        created_at=record.created_at.isoformat(),
        waist_circumference=record.waist_circumference,
        cardiovascular_disease=record.cardiovascular_disease,
        pcos=record.pcos,
        gestational_diabetes=record.gestational_diabetes,
        smoking=record.smoking,
        hba1c_result=record.hba1c_result,
        hba1c_comment=record.hba1c_comment,
        hba1c_result_date=(
            record.hba1c_result_date.isoformat() if record.hba1c_result_date else None
        ),
    )


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
    record = _get_owned_record(prediction_id, payload, db)
    return _record_out(record)


@router.patch("/records/{prediction_id}/hba1c", response_model=RecordOut)
def update_hba1c(
    prediction_id: str,
    data: HbA1cUpdateRequest,
    payload: dict = Depends(get_current_facility),
    db: Session = Depends(get_db),
) -> RecordOut:
    _get_owned_record(prediction_id, payload, db)
    record = PredictionRepository(db).update_hba1c(prediction_id, data.hba1c_result)
    if record is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return _record_out(record)


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
    return RecordsResponse(records=[_record_out(r) for r in rows], total=total)


def _get_owned_record(
    prediction_id: str, payload: dict, db: Session
) -> PredictionRecord:
    facility = FacilityRepository(db).get_by_facility_id(payload["facility_id"])
    if not facility:
        raise HTTPException(status_code=404, detail="Record not found")
    record = PredictionRepository(db).get_by_prediction_id(prediction_id)
    if not record or record.facility_id != facility.id:
        raise HTTPException(status_code=404, detail="Record not found")
    return record
