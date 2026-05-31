from fastapi import APIRouter, BackgroundTasks, Depends, Request, status
from sqlalchemy.orm import Session

from sukaali_check_backend.api.deps import get_any_authenticated, get_current_facility, get_db, get_first_login_or_payment_done_facility
from sukaali_check_backend.core.rate_limit import limiter
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.schemas.auth import (
    ChangePasswordRequest,
    FacilityOut,
    LoginRequest,
    LoginResponse,
    SignupRequest,
    SignupResponse,
)
from sukaali_check_backend.services import auth_service

router = APIRouter()


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
def signup(
    request: Request,
    data: SignupRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SignupResponse:
    return auth_service.signup(db, data, background_tasks)


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    data: LoginRequest,
    db: Session = Depends(get_db),
) -> LoginResponse:
    return auth_service.login(db, data.facility_id, data.password)


@router.post("/change-password", response_model=LoginResponse)
@limiter.limit("10/minute")
def change_password(
    request: Request,
    data: ChangePasswordRequest,
    payload: dict = Depends(get_first_login_or_payment_done_facility),
    db: Session = Depends(get_db),
) -> LoginResponse:
    return auth_service.change_password(
        db, payload["facility_id"], data.new_password, payload["scope"]
    )


@router.post("/signout", status_code=status.HTTP_200_OK)
def signout(payload: dict = Depends(get_any_authenticated)) -> dict:
    return {"message": "Signed out"}


@router.get("/me", response_model=FacilityOut)
def me(
    payload: dict = Depends(get_current_facility),
    db: Session = Depends(get_db),
) -> FacilityOut:
    facility = FacilityRepository(db).get_by_facility_id(payload["facility_id"])
    return FacilityOut.model_validate(facility)
