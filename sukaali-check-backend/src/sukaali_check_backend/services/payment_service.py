import secrets
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from sukaali_check_backend.core import momo
from sukaali_check_backend.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationError
from sukaali_check_backend.core.security import SCOPE_PAYMENT_DONE, create_access_token
from sukaali_check_backend.models.payment_record import PaymentRecord
from sukaali_check_backend.repositories.app_setting import AppSettingRepository, PAYMENT_ENABLED_KEY
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.payment import PaymentRepository
from sukaali_check_backend.schemas.auth import FacilityOut
from sukaali_check_backend.schemas.payment import (
    InitiatePaymentResponse,
    PaymentStatusResponse,
    PlanOption,
    PlanType,
    RenewPaymentResponse,
    RenewStatusResponse,
)


def _payment_enabled(db: Session) -> bool:
    return AppSettingRepository(db).get(PAYMENT_ENABLED_KEY, "false") == "true"

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

    common = dict(
        facility_id=facility.id,
        reference=reference,
        plan_type=plan_type.value,
        momo_number=momo_number,
        amount=amount,
        camp_start_date=camp_start_date,
        plan_start_date=plan_start,
        plan_end_date=plan_end,
    )

    if _payment_enabled(db):
        # Charge via MoMo first so a provider failure leaves no orphan record.
        momo_ref = momo.request_to_pay(
            amount=amount,
            external_id=reference,
            msisdn=momo_number,
            payer_message=f"SukaaliCheck {plan_type.value} subscription",
            payee_note=f"Subscription {reference}",
        )
        record = payment_repo.create(status="pending", provider_ref=momo_ref, **common)
        return InitiatePaymentResponse(
            reference=record.reference,
            plan_type=record.plan_type,
            amount=record.amount,
            plan_start_date=record.plan_start_date,
            plan_end_date=record.plan_end_date,
            status="pending",
            access_token=None,
        )

    record = payment_repo.create(status="pending", **common)
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


def renew(
    db: Session,
    facility_id: str,
    plan_type: PlanType,
    momo_number: str,
    camp_start_date: date | None,
) -> RenewPaymentResponse:
    """Renew the subscription of an already-active facility.

    Unlike ``initiate`` (first-time payment), this extends an existing
    subscription: monthly/annual plans stack onto the current expiry date when
    it is still in the future, otherwise they start today.
    """
    facility_repo = FacilityRepository(db)
    payment_repo = PaymentRepository(db)

    facility = facility_repo.get_by_facility_id(facility_id)
    if not facility:
        raise NotFoundError("Facility not found")
    if facility.status != "active":
        raise ForbiddenError("Only active facilities can renew a subscription")

    today = date.today()
    current_expiry = (
        facility.subscription_expires_at.date() if facility.subscription_expires_at else None
    )
    # Stack the new period onto the remaining subscription when still valid.
    base = current_expiry if current_expiry and current_expiry > today else today

    if plan_type == PlanType.camp_week:
        if camp_start_date is None:
            raise ValidationError("camp_start_date is required for camp_week plan")
        if camp_start_date < today:
            raise ValidationError("camp_start_date must be today or a future date")
        plan_start = today
        plan_end = camp_start_date + timedelta(days=4)
    elif plan_type == PlanType.monthly:
        plan_start = today
        plan_end = base + timedelta(days=29)
        camp_start_date = None
    else:  # annual
        plan_start = today
        plan_end = base + timedelta(days=364)
        camp_start_date = None

    amount = PLAN_PRICES[plan_type.value]
    reference = f"SK-{secrets.token_hex(3).upper()}"

    common = dict(
        facility_id=facility.id,
        reference=reference,
        plan_type=plan_type.value,
        momo_number=momo_number,
        amount=amount,
        camp_start_date=camp_start_date,
        plan_start_date=plan_start,
        plan_end_date=plan_end,
    )

    if _payment_enabled(db):
        momo_ref = momo.request_to_pay(
            amount=amount,
            external_id=reference,
            msisdn=momo_number,
            payer_message=f"SukaaliCheck {plan_type.value} renewal",
            payee_note=f"Renewal {reference}",
        )
        record = payment_repo.create(status="pending", provider_ref=momo_ref, **common)
        return RenewPaymentResponse(
            reference=record.reference,
            plan_type=record.plan_type,
            amount=record.amount,
            plan_start_date=record.plan_start_date,
            plan_end_date=record.plan_end_date,
            status="pending",
            facility=None,
        )

    record = payment_repo.create(status="pending", **common)
    _apply_subscription(db, record)
    facility = facility_repo.get_by_facility_id(facility_id)
    return RenewPaymentResponse(
        reference=record.reference,
        plan_type=record.plan_type,
        amount=record.amount,
        plan_start_date=record.plan_start_date,
        plan_end_date=record.plan_end_date,
        status="completed",
        facility=FacilityOut.model_validate(facility),
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


def _apply_subscription(db: Session, record: PaymentRecord) -> None:
    """Mark a payment completed and grant/extend the facility's subscription."""
    payment_repo = PaymentRepository(db)
    facility_repo = FacilityRepository(db)

    payment_repo.update_status(record.reference, "completed")

    facility = facility_repo.get_by_id(record.facility_id)
    subscription_expires_at = datetime.combine(record.plan_end_date, datetime.max.time().replace(microsecond=0))
    facility_repo.set_plan(facility.facility_id, record.plan_type, subscription_expires_at)


def _payment_done_token(facility_id: str) -> str:
    return create_access_token(
        data={"facility_id": facility_id},
        scope=SCOPE_PAYMENT_DONE,
        expires_delta=timedelta(minutes=30),
    )


def _complete_payment(db: Session, record: PaymentRecord) -> str:
    """Auto-completes payment and returns a payment_done JWT (first-time flow)."""
    _apply_subscription(db, record)
    facility = FacilityRepository(db).get_by_id(record.facility_id)
    return _payment_done_token(facility.facility_id)


def check_first_login_status(db: Session, reference: str, facility_id: str) -> PaymentStatusResponse:
    """Poll MoMo for a first-time payment; on success issue the payment_done token."""
    payment_repo = PaymentRepository(db)
    facility_repo = FacilityRepository(db)

    record = payment_repo.get_by_reference(reference)
    if not record:
        raise NotFoundError("Payment record not found")
    facility = facility_repo.get_by_id(record.facility_id)
    if not facility or facility.facility_id != facility_id:
        raise ForbiddenError("This payment does not belong to your account")

    if record.status == "completed":
        return PaymentStatusResponse(
            status="completed", access_token=_payment_done_token(facility.facility_id), scope=SCOPE_PAYMENT_DONE
        )
    if record.status == "failed":
        return PaymentStatusResponse(status="failed", reason=record.failure_reason)
    if not record.provider_ref:
        return PaymentStatusResponse(status="pending")

    result = momo.get_status(record.provider_ref)
    momo_status = result.get("status")
    if momo_status == "SUCCESSFUL":
        token = _complete_payment(db, record)
        return PaymentStatusResponse(status="completed", access_token=token, scope=SCOPE_PAYMENT_DONE)
    if momo_status == "FAILED":
        reason = result.get("reason") or "Payment failed"
        payment_repo.mark_failed(record.reference, reason)
        return PaymentStatusResponse(status="failed", reason=reason)
    return PaymentStatusResponse(status="pending")


def check_renew_status(db: Session, reference: str, facility_id: str) -> RenewStatusResponse:
    """Poll MoMo for a renewal payment; on success extend the subscription."""
    payment_repo = PaymentRepository(db)
    facility_repo = FacilityRepository(db)

    record = payment_repo.get_by_reference(reference)
    if not record:
        raise NotFoundError("Payment record not found")
    facility = facility_repo.get_by_id(record.facility_id)
    if not facility or facility.facility_id != facility_id:
        raise ForbiddenError("This payment does not belong to your account")

    if record.status == "completed":
        return RenewStatusResponse(status="completed", facility=FacilityOut.model_validate(facility))
    if record.status == "failed":
        return RenewStatusResponse(status="failed", reason=record.failure_reason)
    if not record.provider_ref:
        return RenewStatusResponse(status="pending")

    result = momo.get_status(record.provider_ref)
    momo_status = result.get("status")
    if momo_status == "SUCCESSFUL":
        _apply_subscription(db, record)
        facility = facility_repo.get_by_facility_id(facility_id)
        return RenewStatusResponse(status="completed", facility=FacilityOut.model_validate(facility))
    if momo_status == "FAILED":
        reason = result.get("reason") or "Payment failed"
        payment_repo.mark_failed(record.reference, reason)
        return RenewStatusResponse(status="failed", reason=reason)
    return RenewStatusResponse(status="pending")
