from datetime import date
from enum import Enum

from pydantic import BaseModel, model_validator

from sukaali_check_backend.schemas.auth import FacilityOut


class PlanType(str, Enum):
    monthly = "monthly"
    annual = "annual"
    camp_week = "camp_week"


class PlanOption(BaseModel):
    plan_type: str
    label: str
    amount: int
    duration_label: str


class InitiatePaymentRequest(BaseModel):
    plan_type: PlanType
    momo_number: str
    camp_start_date: date | None = None

    @model_validator(mode="after")
    def validate_camp_week(self) -> "InitiatePaymentRequest":
        if self.plan_type == PlanType.camp_week and self.camp_start_date is None:
            raise ValueError("camp_start_date is required for camp_week plan")
        return self


class InitiatePaymentResponse(BaseModel):
    reference: str
    plan_type: str
    amount: int
    plan_start_date: date
    plan_end_date: date
    status: str  # "completed" (auto path) | "pending" (MoMo path)
    access_token: str | None = None  # present only when status == "completed"
    token_type: str = "bearer"


class RenewPaymentResponse(BaseModel):
    reference: str
    plan_type: str
    amount: int
    plan_start_date: date
    plan_end_date: date
    status: str  # "completed" (auto path) | "pending" (MoMo path)
    facility: FacilityOut | None = None  # present only when status == "completed"


class PaymentStatusResponse(BaseModel):
    status: str  # "pending" | "completed" | "failed"
    access_token: str | None = None
    token_type: str = "bearer"
    scope: str | None = None
    reason: str | None = None


class RenewStatusResponse(BaseModel):
    status: str  # "pending" | "completed" | "failed"
    facility: FacilityOut | None = None
    reason: str | None = None


class ConfirmPaymentRequest(BaseModel):
    reference: str
