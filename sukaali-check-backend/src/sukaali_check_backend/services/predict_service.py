import uuid
import warnings
from datetime import datetime, timezone

import numpy as np
from sqlalchemy.orm import Session

from sukaali_check_backend.core.exceptions import ValidationError as DomainValidationError
from sukaali_check_backend.core.model import MODEL_VERSION, get_feature_columns, get_model
from sukaali_check_backend.repositories.facility import FacilityRepository
from sukaali_check_backend.repositories.prediction import PredictionRepository
from sukaali_check_backend.schemas.predict import PredictRequest, PredictResponse

_SEX = {"Female": 0, "Male": 1}
_YES_NO = {"no": 0, "yes": 1}

# model.classes_ = [0, 1, 2] confirmed at startup
_CLASS_LABELS = {0: "low", 1: "intermediate", 2: "high"}


def predict(data: PredictRequest, facility_id: str, db: Session) -> PredictResponse:
    model = get_model()
    if model is None:
        raise DomainValidationError("Prediction model not loaded")

    bmi = data.weight_kg / ((data.height_cm / 100) ** 2)

    features = build_features(data, bmi)

    # Suppress sklearn's feature-name warning (model trained with DataFrame, we pass ndarray)
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=UserWarning)
        predicted_class = int(model.predict(features)[0])
        probabilities = model.predict_proba(features)[0]  # [P(low), P(inter), P(high)]

    risk_level = _CLASS_LABELS.get(predicted_class, "low")

    # Continuous 0–100 score weighted toward high risk
    risk_score = round(float(probabilities[1]) * 50 + float(probabilities[2]) * 100)
    risk_score = max(0, min(100, risk_score))

    result = PredictResponse(
        prediction_id=f"pred_{uuid.uuid4().hex[:12]}",
        risk_level=risk_level,
        risk_score=risk_score,
        key_factors=_key_factors(data, bmi),
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    facility = FacilityRepository(db).get_by_facility_id(facility_id)
    if facility:
        PredictionRepository(db).create(
            facility_id=facility.id,
            prediction_id=result.prediction_id,
            age=data.age,
            sex=data.sex,
            weight_kg=data.weight_kg,
            height_cm=data.height_cm,
            bmi=round(bmi, 2),
            family_history_diabetes=data.family_history_diabetes,
            hypertension=data.hypertension,
            physical_activity=data.physical_activity,
            diet_quality=data.diet_quality,
            blood_glucose=data.blood_glucose_mg_dl,
            blood_glucose_entered=data.blood_glucose,
            blood_glucose_unit=data.blood_glucose_unit,
            waist_circumference=data.waist_circumference,
            cardiovascular_disease=data.cardiovascular_disease,
            pcos=data.pcos,
            gestational_diabetes=data.gestational_diabetes,
            smoking=data.smoking,
            risk_level=result.risk_level,
            risk_score=result.risk_score,
            key_factors=result.key_factors,
            model_version=MODEL_VERSION,
        )

    return result


def build_features(data: PredictRequest, bmi: float) -> np.ndarray:
    """Encode the request into a 1-row matrix ordered by the model's feature columns."""
    encoded = {
        "age": data.age,
        "sex": _SEX[data.sex],
        "bmi": round(bmi, 2),
        "family_history_diabetes": _YES_NO[data.family_history_diabetes],
        "hypertension": _YES_NO[data.hypertension],
        "blood_glucose": data.blood_glucose_mg_dl,
    }
    return np.array([[encoded[col] for col in get_feature_columns()]])


def _key_factors(data: PredictRequest, bmi: float) -> list[str]:
    factors: list[str] = []
    if data.age >= 55:
        factors.append("Age ≥ 55")
    elif data.age >= 45:
        factors.append("Age 45–54")
    if bmi >= 30:
        factors.append("Obese (BMI ≥ 30)")
    elif bmi >= 25:
        factors.append("Overweight (BMI 25–29)")
    if data.family_history_diabetes == "yes":
        factors.append("Family history of diabetes")
    if data.hypertension == "yes":
        factors.append("Hypertension")
    # Fasting glucose thresholds
    glucose = data.blood_glucose_mg_dl
    if glucose >= 126:
        factors.append("High fasting glucose (≥ 7.0 mmol/L / 126 mg/dL)")
    elif glucose >= 100:
        factors.append("Borderline fasting glucose (5.6–6.9 mmol/L / 100–125 mg/dL)")
    return factors
