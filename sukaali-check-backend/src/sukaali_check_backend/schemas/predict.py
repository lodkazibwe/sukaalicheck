from typing import Literal

from pydantic import BaseModel


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


class PredictResponse(BaseModel):
    prediction_id: str
    risk_level: Literal["low", "intermediate", "high"]
    risk_score: int
    key_factors: list[str]
    created_at: str


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


class RecordsResponse(BaseModel):
    records: list[RecordOut]
    total: int
