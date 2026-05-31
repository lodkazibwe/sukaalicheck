import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator


class SignupRequest(BaseModel):
    facility_name: str
    facility_type: str
    ownership: str
    district: str
    physical_address: str
    facility_phone: str
    facility_email: EmailStr
    specialist_name: str
    specialist_title: str
    licence_number: str
    specialist_phone: str


class SignupResponse(BaseModel):
    message: str
    facility_id: str


class LoginRequest(BaseModel):
    facility_id: str
    password: str


class FacilityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    facility_id: str
    facility_name: str
    status: str
    plan_type: str | None = None
    subscription_expires_at: datetime | None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    scope: str
    facility: FacilityOut


class ChangePasswordRequest(BaseModel):
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self
