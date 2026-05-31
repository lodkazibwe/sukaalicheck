from datetime import datetime, timedelta

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from sukaali_check_backend.config import settings
from sukaali_check_backend.core.exceptions import AuthError, ConflictError, ForbiddenError
from sukaali_check_backend.core.email import send_admin_notification
from sukaali_check_backend.core.security import (
    SCOPE_FACILITY,
    SCOPE_FIRST_LOGIN,
    SCOPE_PAYMENT_DONE,
    create_access_token,
    hash_password,
    verify_password,
)
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.otp_token import OtpTokenRepository
from sukaali_check_backend.repositories.specialist import SpecialistRepository
from sukaali_check_backend.schemas.auth import FacilityOut, LoginResponse, SignupRequest, SignupResponse


_DISTRICT_CODES: dict[str, str] = {
    "kampala": "KLA",
    "wakiso": "WKS",
    "mukono": "MKN",
    "mpigi": "MPG",
    "masaka": "MSK",
    "luweero": "LWR",
    "butambala": "BTM",
    "other": "OTH",
}

_TYPE_CODES: dict[str, str] = {
    "hospital": "HOS",
    "clinic": "CLI",
    "health_centre": "HCT",
    "herbal": "HER",
    "pharmacy": "PHM",
}

_OWNERSHIP_CODES: dict[str, str] = {
    "private": "PR",
    "government": "GV",
    "ngo": "NG",
    "faith_based": "FB",
}


def _build_facility_id(district: str, facility_type: str, ownership: str, seq: int) -> str:
    dist = _DISTRICT_CODES.get(district.lower(), district[:3].upper())
    ftype = _TYPE_CODES.get(facility_type.lower(), facility_type[:3].upper())
    own = _OWNERSHIP_CODES.get(ownership.lower(), ownership[:2].upper())
    return f"{dist}-{ftype}-{own}-{seq:03d}"


def signup(db: Session, data: SignupRequest, background_tasks: BackgroundTasks) -> SignupResponse:
    facility_repo = FacilityRepository(db)
    specialist_repo = SpecialistRepository(db)

    if facility_repo.get_by_email(str(data.facility_email)):
        raise ConflictError("Email already registered")

    dist = _DISTRICT_CODES.get(data.district.lower(), data.district[:3].upper())
    ftype = _TYPE_CODES.get(data.facility_type.lower(), data.facility_type[:3].upper())
    own = _OWNERSHIP_CODES.get(data.ownership.lower(), data.ownership[:2].upper())
    prefix = f"{dist}-{ftype}-{own}"
    seq = facility_repo.next_sequence_for_prefix(prefix)
    facility_id = _build_facility_id(data.district, data.facility_type, data.ownership, seq)

    facility = facility_repo.create(
        facility_id=facility_id,
        facility_name=data.facility_name,
        facility_type=data.facility_type,
        ownership=data.ownership,
        district=data.district,
        physical_address=data.physical_address,
        facility_phone=data.facility_phone,
        facility_email=str(data.facility_email),
        status="pending_approval",
    )

    specialist_repo.create(
        facility_id=facility.id,
        specialist_name=data.specialist_name,
        specialist_title=data.specialist_title,
        licence_number=data.licence_number,
        specialist_phone=data.specialist_phone,
    )

    background_tasks.add_task(
        send_admin_notification,
        facility_name=data.facility_name,
        specialist_name=data.specialist_name,
        licence_number=data.licence_number,
        facility_email=str(data.facility_email),
    )

    return SignupResponse(
        message="Application submitted successfully. You will receive an email when your application is approved.",
        facility_id=facility_id,
    )


def login(db: Session, facility_id: str, password: str) -> LoginResponse:
    facility_repo = FacilityRepository(db)
    otp_repo = OtpTokenRepository(db)

    facility = facility_repo.get_by_facility_id(facility_id)
    if not facility:
        raise AuthError("Invalid credentials")

    if facility.locked_until and facility.locked_until > datetime.utcnow():
        raise ForbiddenError("Account temporarily locked. Try again later.")

    if facility.status == "pending_approval":
        raise ForbiddenError("Your application is under review")

    if facility.status == "rejected":
        raise ForbiddenError("Your application was not approved")

    if facility.status == "pending_payment":
        otp_token = otp_repo.get_valid_token(facility.id)

        # Payment completed but password never set: OTP is already consumed.
        # Re-issue a payment_done token so the user can resume at change-password.
        if not otp_token and facility.plan_type and not facility.password_hash:
            token = create_access_token(
                data={"facility_id": facility.facility_id},
                scope=SCOPE_PAYMENT_DONE,
                expires_delta=timedelta(minutes=30),
            )
            return LoginResponse(
                access_token=token,
                scope=SCOPE_PAYMENT_DONE,
                facility=FacilityOut.model_validate(facility),
            )

        if not otp_token:
            raise AuthError("No valid activation code found. Please contact support.")

        if not verify_password(password, otp_token.token_hash):
            otp_repo.increment_failed_attempts(otp_token.id)
            raise AuthError("Invalid activation code")

        otp_repo.mark_used(otp_token.id)
        token = create_access_token(
            data={"facility_id": facility.facility_id},
            scope=SCOPE_FIRST_LOGIN,
            expires_delta=timedelta(minutes=30),
        )
        return LoginResponse(
            access_token=token,
            scope=SCOPE_FIRST_LOGIN,
            facility=FacilityOut.model_validate(facility),
        )

    if facility.status == "active":
        if not facility.password_hash or not verify_password(password, facility.password_hash):
            new_count = facility_repo.increment_failed_attempts(facility.facility_id)
            if new_count >= 10:
                facility_repo.set_locked_until(
                    facility.facility_id, datetime.utcnow() + timedelta(minutes=15)
                )
            raise AuthError("Invalid credentials")

        facility_repo.reset_failed_attempts(facility.facility_id)
        token = create_access_token(
            data={"facility_id": facility.facility_id},
            scope=SCOPE_FACILITY,
            expires_delta=timedelta(minutes=settings.jwt_expire_minutes),
        )
        return LoginResponse(
            access_token=token,
            scope=SCOPE_FACILITY,
            facility=FacilityOut.model_validate(facility),
        )

    raise AuthError("Invalid credentials")


def change_password(
    db: Session, facility_id: str, new_password: str, scope: str
) -> LoginResponse:
    facility_repo = FacilityRepository(db)

    facility = facility_repo.get_by_facility_id(facility_id)
    if not facility:
        raise AuthError("Facility not found")

    facility_repo.set_password_hash(facility_id, hash_password(new_password))

    if scope == SCOPE_PAYMENT_DONE and facility.status == "pending_payment":
        facility_repo.update_status(facility_id, "active")

    # Re-fetch to get updated status
    facility = facility_repo.get_by_facility_id(facility_id)

    token = create_access_token(
        data={"facility_id": facility_id},
        scope=SCOPE_FACILITY,
        expires_delta=timedelta(minutes=settings.jwt_expire_minutes),
    )
    return LoginResponse(
        access_token=token,
        scope=SCOPE_FACILITY,
        facility=FacilityOut.model_validate(facility),
    )
