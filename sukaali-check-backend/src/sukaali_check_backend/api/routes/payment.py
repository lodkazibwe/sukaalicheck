from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from sukaali_check_backend.api.deps import get_current_admin, get_db, get_first_login_facility
from sukaali_check_backend.schemas.payment import (
    ConfirmPaymentRequest,
    InitiatePaymentRequest,
    InitiatePaymentResponse,
    PlanOption,
)
from sukaali_check_backend.services import payment_service

router = APIRouter()


@router.get("/plans", response_model=list[PlanOption])
def get_plans() -> list[PlanOption]:
    return payment_service.get_plans()


@router.post("/initiate", response_model=InitiatePaymentResponse)
def initiate_payment(
    data: InitiatePaymentRequest,
    payload: dict = Depends(get_first_login_facility),
    db: Session = Depends(get_db),
) -> InitiatePaymentResponse:
    return payment_service.initiate(
        db,
        facility_id=payload["facility_id"],
        plan_type=data.plan_type,
        momo_number=data.momo_number,
        camp_start_date=data.camp_start_date,
    )


@router.post("/confirm")
def confirm_payment(
    data: ConfirmPaymentRequest,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return payment_service.confirm(db, data.reference)
