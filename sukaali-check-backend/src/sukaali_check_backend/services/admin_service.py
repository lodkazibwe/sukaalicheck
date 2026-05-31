import uuid
from datetime import datetime, timedelta

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from sukaali_check_backend.core.exceptions import AuthError, NotFoundError, ValidationError
from sukaali_check_backend.core.email import send_otp_email
from sukaali_check_backend.core.security import (
    SCOPE_ADMIN,
    create_access_token,
    generate_otp,
    hash_otp,
    verify_password,
)
from sukaali_check_backend.repositories.admin_repo import AdminRepository
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.otp_token import OtpTokenRepository


def admin_login(db: Session, username: str, password: str) -> dict:
    repo = AdminRepository(db)
    admin = repo.get_by_username(username)
    if not admin or not verify_password(password, admin.password_hash):
        raise AuthError("Invalid admin credentials")
    token = create_access_token(
        data={"sub": admin.username, "admin_id": str(admin.id)},
        scope=SCOPE_ADMIN,
        expires_delta=timedelta(hours=12),
    )
    return {"access_token": token, "token_type": "bearer", "scope": SCOPE_ADMIN, "username": admin.username}


def approve(db: Session, facility_uuid: uuid.UUID, background_tasks: BackgroundTasks) -> dict:
    facility_repo = FacilityRepository(db)
    otp_repo = OtpTokenRepository(db)

    facility = facility_repo.get_by_id(facility_uuid)
    if not facility:
        raise NotFoundError("Facility not found")
    if facility.status != "pending_approval":
        raise ValidationError(f"Facility is not in pending_approval status (current: {facility.status})")

    otp_repo.invalidate_all_for_facility(facility.id)

    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(hours=24)
    otp_repo.create(facility.id, hash_otp(otp), expires_at)

    facility_repo.update_status(facility.facility_id, "pending_payment")

    background_tasks.add_task(
        send_otp_email,
        to_email=facility.facility_email,
        facility_name=facility.facility_name,
        facility_id=facility.facility_id,
        otp=otp,
    )

    return {
        "message": f"Facility {facility.facility_id} approved. Activation code sent to {facility.facility_email}."
    }


def reject(db: Session, facility_uuid: uuid.UUID, reason: str) -> dict:
    facility_repo = FacilityRepository(db)

    facility = facility_repo.get_by_id(facility_uuid)
    if not facility:
        raise NotFoundError("Facility not found")

    facility_repo.update_status(facility.facility_id, "rejected")

    return {"message": f"Facility {facility.facility_id} rejected. Reason: {reason}"}
