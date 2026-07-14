from typing import Literal

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    age: int
    sex: Literal["Male", "Female"]
    weight_kg: float
    height_cm: float
    family_history_diabetes: Literal["yes", "no"]
    hypertension: Literal["yes", "no"]
    physical_activity: Literal["low", "intermediate", "high"]
    diet_quality: int
    blood_glucose: float | None = None

    # Additional clinical intake (data-only, not used in prediction)
    waist_circumference: float | None = None
    cardiovascular_disease: Literal["yes", "no"] | None = None
    pcos: Literal["yes", "no"] | None = None
    gestational_diabetes: Literal["yes", "no"] | None = None
    smoking: Literal["yes", "no"] | None = None


class PredictResponse(BaseModel):
    prediction_id: str
    risk_level: Literal["low", "intermediate", "high"]
    risk_score: int
    key_factors: list[str]
    created_at: str


class HbA1cUpdateRequest(BaseModel):
    hba1c_result: float = Field(ge=0, le=20)


class RecordOut(BaseModel):
    model_config = {"from_attributes": True}

    prediction_id: str
    age: int
    sex: str
    bmi: float
    risk_level: Literal["low", "intermediate", "high"]
    risk_score: int
    key_factors: list[str]
    created_at: str

    # Additional clinical intake
    waist_circumference: float | None = None
    cardiovascular_disease: str | None = None
    pcos: str | None = None
    gestational_diabetes: str | None = None
    smoking: str | None = None

    # Confirmatory HbA1c result (comment is derived server-side)
    hba1c_result: float | None = None
    hba1c_comment: str | None = None
    hba1c_result_date: str | None = None


class RecordsResponse(BaseModel):
    records: list[RecordOut]
    total: int
