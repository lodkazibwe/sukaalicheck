import uuid

from sqlalchemy.orm import Session

from sukaali_check_backend.models.specialist import Specialist


class SpecialistRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Specialist:
        specialist = Specialist(**kwargs)
        self.db.add(specialist)
        self.db.commit()
        self.db.refresh(specialist)
        return specialist

    def get_by_facility_id(self, facility_uuid: uuid.UUID) -> Specialist | None:
        return (
            self.db.query(Specialist)
            .filter(Specialist.facility_id == facility_uuid)
            .first()
        )
