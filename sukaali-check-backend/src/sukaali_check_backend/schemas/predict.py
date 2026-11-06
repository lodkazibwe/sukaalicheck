from typing import Literal

from pydantic import BaseModel, Field, model_validator

GlucoseUnit = Literal["mg/dL", "mmol/L"]

MMOL_TO_MG_DL = 18

# Accepted fasting glucose readings per unit (glucometer display range)
GLUCOSE_RANGE: dict[str, tuple[float, float]] = {
    "mg/dL": (20.0, 600.0),
    "mmol/L": (1.1, 33.3),
}


class PredictRequest(BaseModel):
    age: int = Field(ge=18, le=100)
    sex: Literal["Male", "Female"]
    weight_kg: float = Field(gt=0, le=300)
    height_cm: float = Field(gt=0, le=220)
    family_history_diabetes: Literal["yes", "no"]
    hypertension: Literal["yes", "no"]
    # Fasting blood glucose as read from the glucometer, in blood_glucose_unit.
    # The model takes mg/dL (trained on 30–200) — use blood_glucose_mg_dl.
    blood_glucose: float
    blood_glucose_unit: GlucoseUnit = "mg/dL"

    @model_validator(mode="after")
    def _check_glucose_range(self) -> "PredictRequest":
        low, high = GLUCOSE_RANGE[self.blood_glucose_unit]
        if not low <= self.blood_glucose <= high:
            raise ValueError(
                f"blood_glucose must be between {low} and {high} {self.blood_glucose_unit}"
            )
        return self

    @property
    def blood_glucose_mg_dl(self) -> float:
        if self.blood_glucose_unit == "mmol/L":
            return round(self.blood_glucose * MMOL_TO_MG_DL, 1)
        return self.blood_glucose

    # Additional clinical intake (data-only, not used in prediction)
    physical_activity: Literal["low", "intermediate", "high"] | None = None
    diet_quality: int | None = Field(default=None, ge=1, le=10)
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

    # Fasting glucose: mg/dL model input, plus the reading as entered (null on v1 records)
    blood_glucose: float | None = None
    blood_glucose_entered: float | None = None
    blood_glucose_unit: GlucoseUnit | None = None

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
