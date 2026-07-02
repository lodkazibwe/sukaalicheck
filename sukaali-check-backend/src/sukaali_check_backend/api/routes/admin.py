import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from sukaali_check_backend.api.deps import get_current_admin, get_db
from sukaali_check_backend.core.exceptions import NotFoundError
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.specialist import SpecialistRepository
from sukaali_check_backend.schemas.admin import (
    AdminChangePasswordRequest,
    AdminLoginRequest,
    AdminLoginResponse,
    ApproveRequest,
    FacilityDetail,
    FacilityListItem,
    PaymentSettingRequest,
    PaymentSettingResponse,
    RejectRequest,
    SpecialistOut,
)
from sukaali_check_backend.services import admin_service

router = APIRouter()


@router.post("/auth/login", response_model=AdminLoginResponse)
def admin_login(data: AdminLoginRequest, db: Session = Depends(get_db)) -> dict:
    return admin_service.admin_login(db, data.username, data.password)


@router.post("/auth/change-password")
def admin_change_password(
    body: AdminChangePasswordRequest,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return admin_service.change_admin_password(
        db, payload["sub"], body.current_password, body.new_password
    )


@router.get("/settings/payment-enabled", response_model=PaymentSettingResponse)
def get_payment_enabled(
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PaymentSettingResponse:
    return PaymentSettingResponse(enabled=admin_service.get_payment_enabled(db))


@router.post("/settings/payment-enabled", response_model=PaymentSettingResponse)
def set_payment_enabled(
    body: PaymentSettingRequest,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> PaymentSettingResponse:
    return PaymentSettingResponse(enabled=admin_service.set_payment_enabled(db, body.enabled))


@router.get("/facilities", response_model=list[FacilityListItem])
def list_facilities(
    status: str | None = Query(None),
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> list[FacilityListItem]:
    facilities = FacilityRepository(db).list_by_status(status)
    return [FacilityListItem.model_validate(f) for f in facilities]


@router.get("/facilities/{facility_uuid}", response_model=FacilityDetail)
def get_facility(
    facility_uuid: uuid.UUID,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> FacilityDetail:
    facility = FacilityRepository(db).get_by_id(facility_uuid)
    if not facility:
        raise NotFoundError("Facility not found")

    specialist = SpecialistRepository(db).get_by_facility_id(facility.id)
    detail = FacilityDetail.model_validate(facility)
    if specialist:
        detail = detail.model_copy(update={"specialist": SpecialistOut.model_validate(specialist)})
    return detail


@router.post("/facilities/{facility_uuid}/approve")
def approve_facility(
    facility_uuid: uuid.UUID,
    body: ApproveRequest,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return admin_service.approve(db, facility_uuid, background_tasks)


@router.post("/facilities/{facility_uuid}/reject")
def reject_facility(
    facility_uuid: uuid.UUID,
    body: RejectRequest,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return admin_service.reject(db, facility_uuid, body.reason, background_tasks)


@router.post("/facilities/{facility_uuid}/resend-otp")
def resend_otp(
    facility_uuid: uuid.UUID,
    background_tasks: BackgroundTasks,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return admin_service.resend_otp(db, facility_uuid, background_tasks)


@router.delete("/facilities/{facility_uuid}")
def delete_facility(
    facility_uuid: uuid.UUID,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return admin_service.delete_facility(db, facility_uuid)


@router.post("/facilities/{facility_uuid}/unlock")
def unlock_facility(
    facility_uuid: uuid.UUID,
    payload: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
) -> dict:
    return admin_service.unlock(db, facility_uuid)
