import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func, text

from sukaali_check_backend.db.session import Base


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    facility_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("facilities.id"), nullable=False
    )
    prediction_id: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    # Patient input
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    sex: Mapped[str] = mapped_column(String(10), nullable=False)
    weight_kg: Mapped[float] = mapped_column(Float, nullable=False)
    height_cm: Mapped[float] = mapped_column(Float, nullable=False)
    bmi: Mapped[float] = mapped_column(Float, nullable=False)
    family_history_diabetes: Mapped[str] = mapped_column(String(3), nullable=False)
    hypertension: Mapped[str] = mapped_column(String(3), nullable=False)
    physical_activity: Mapped[str] = mapped_column(String(20), nullable=False)
    diet_quality: Mapped[int] = mapped_column(Integer, nullable=False)
    blood_glucose: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Prediction result
    risk_level: Mapped[str] = mapped_column(String(15), nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    key_factors: Mapped[list] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
