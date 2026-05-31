import uuid
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from sukaali_check_backend.models.facility import Facility


class FacilityRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, facility_uuid: uuid.UUID) -> Facility | None:
        return self.db.query(Facility).filter(Facility.id == facility_uuid).first()

    def get_by_facility_id(self, facility_id: str) -> Facility | None:
        return self.db.query(Facility).filter(Facility.facility_id == facility_id).first()

    def get_by_email(self, email: str) -> Facility | None:
        return self.db.query(Facility).filter(Facility.facility_email == email).first()

    def create(self, **kwargs) -> Facility:
        facility = Facility(**kwargs)
        self.db.add(facility)
        self.db.commit()
        self.db.refresh(facility)
        return facility

    def update_status(self, facility_id: str, status: str) -> Facility | None:
        facility = self.get_by_facility_id(facility_id)
        if facility:
            facility.status = status
            self.db.commit()
            self.db.refresh(facility)
        return facility

    def set_password_hash(self, facility_id: str, password_hash: str) -> None:
        facility = self.get_by_facility_id(facility_id)
        if facility:
            facility.password_hash = password_hash
            self.db.commit()

    def set_plan(self, facility_id: str, plan_type: str, subscription_expires_at: datetime) -> None:
        facility = self.get_by_facility_id(facility_id)
        if facility:
            facility.plan_type = plan_type
            facility.subscription_expires_at = subscription_expires_at
            self.db.commit()

    def increment_failed_attempts(self, facility_id: str) -> int:
        facility = self.get_by_facility_id(facility_id)
        if facility:
            facility.failed_login_attempts += 1
            self.db.commit()
            return facility.failed_login_attempts
        return 0

    def reset_failed_attempts(self, facility_id: str) -> None:
        facility = self.get_by_facility_id(facility_id)
        if facility:
            facility.failed_login_attempts = 0
            facility.locked_until = None
            self.db.commit()

    def set_locked_until(self, facility_id: str, locked_until: datetime) -> None:
        facility = self.get_by_facility_id(facility_id)
        if facility:
            facility.locked_until = locked_until
            self.db.commit()

    def list_by_status(self, status: str | None = None) -> list[Facility]:
        q = self.db.query(Facility)
        if status:
            q = q.filter(Facility.status == status)
        return q.order_by(Facility.created_at.desc()).all()

    def next_facility_sequence_value(self) -> int:
        result = self.db.execute(text("SELECT nextval('facility_id_seq')"))
        return result.scalar()

    def next_sequence_for_prefix(self, prefix: str) -> int:
        result = self.db.execute(
            text("SELECT COUNT(*) + 1 FROM facilities WHERE facility_id LIKE :pattern"),
            {"pattern": f"{prefix}-%"},
        )
        return result.scalar()
