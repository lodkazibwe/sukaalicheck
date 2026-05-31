import secrets
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from sukaali_check_backend.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from sukaali_check_backend.core.security import SCOPE_PAYMENT_DONE, create_access_token
from sukaali_check_backend.models.payment_record import PaymentRecord
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.payment import PaymentRepository
from sukaali_check_backend.schemas.payment import InitiatePaymentResponse, PlanOption, PlanType

PLAN_PRICES: dict[str, int] = {
    "monthly": 70_000,
    "annual": 750_000,
    "camp_week": 100_000,
}


def get_plans() -> list[PlanOption]:
    return [
        PlanOption(
            plan_type="monthly",
            label="Monthly",
            amount=70_000,
            duration_label="30 days",
        ),
        PlanOption(
            plan_type="annual",
            label="Annual",
            amount=750_000,
            duration_label="365 days",
        ),
        PlanOption(
            plan_type="camp_week",
            label="Camp Week",
            amount=100_000,
            duration_label="5 consecutive days",
        ),
    ]


def initiate(
    db: Session,
    facility_id: str,
    plan_type: PlanType,
    momo_number: str,
    camp_start_date: date | None,
) -> InitiatePaymentResponse:
    facility_repo = FacilityRepository(db)
    payment_repo = PaymentRepository(db)

    facility = facility_repo.get_by_facility_id(facility_id)
    if not facility:
        raise NotFoundError("Facility not found")
    if facility.status != "pending_payment":
        raise ForbiddenError("Payment is only available for facilities pending payment")

    existing = payment_repo.get_active_record(facility.id)
    if existing:
        raise ConflictError("An active or completed payment record already exists")

    today = date.today()

    if plan_type == PlanType.camp_week:
        if camp_start_date is None:
            raise ValidationError("camp_start_date is required for camp_week plan")
        if camp_start_date < today:
            raise ValidationError("camp_start_date must be today or a future date")
        plan_start = today
        plan_end = camp_start_date + timedelta(days=4)
    elif plan_type == PlanType.monthly:
        plan_start = today
        plan_end = today + timedelta(days=29)
        camp_start_date = None
    else:  # annual
        plan_start = today
        plan_end = today + timedelta(days=364)
        camp_start_date = None

    amount = PLAN_PRICES[plan_type.value]
    reference = f"SK-{secrets.token_hex(3).upper()}"

    record = payment_repo.create(
        facility_id=facility.id,
        reference=reference,
        plan_type=plan_type.value,
        momo_number=momo_number,
        amount=amount,
        camp_start_date=camp_start_date,
        plan_start_date=plan_start,
        plan_end_date=plan_end,
        status="pending",
    )

    token = _complete_payment(db, record)

    return InitiatePaymentResponse(
        reference=record.reference,
        plan_type=record.plan_type,
        amount=record.amount,
        plan_start_date=record.plan_start_date,
        plan_end_date=record.plan_end_date,
        status="completed",
        access_token=token,
    )


def confirm(db: Session, reference: str) -> dict:
    payment_repo = PaymentRepository(db)

    record = payment_repo.get_by_reference(reference)
    if not record:
        raise NotFoundError("Payment record not found")
    if record.status != "pending":
        raise ValidationError(f"Payment is not in pending status (current: {record.status})")

    _complete_payment(db, record)
    return {"message": f"Payment {reference} confirmed successfully"}


def _complete_payment(db: Session, record: PaymentRecord) -> str:
    """Auto-completes payment and returns a payment_done JWT."""
    payment_repo = PaymentRepository(db)
    facility_repo = FacilityRepository(db)

    payment_repo.update_status(record.reference, "completed")

    facility = facility_repo.get_by_id(record.facility_id)
    subscription_expires_at = datetime.combine(record.plan_end_date, datetime.max.time().replace(microsecond=0))
    facility_repo.set_plan(facility.facility_id, record.plan_type, subscription_expires_at)

    return create_access_token(
        data={"facility_id": facility.facility_id},
        scope=SCOPE_PAYMENT_DONE,
        expires_delta=timedelta(minutes=30),
    )
