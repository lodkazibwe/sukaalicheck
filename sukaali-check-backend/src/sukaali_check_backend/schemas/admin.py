import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SpecialistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    specialist_name: str
    specialist_title: str
    licence_number: str
    specialist_phone: str


class FacilityListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    facility_id: str
    facility_name: str
    district: str
    status: str
    created_at: datetime


class FacilityDetail(FacilityListItem):
    facility_type: str
    ownership: str
    physical_address: str
    facility_phone: str
    facility_email: str
    specialist: SpecialistOut | None = None


class ApproveRequest(BaseModel):
    notes: str | None = None


class RejectRequest(BaseModel):
    reason: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    scope: str
    username: str
