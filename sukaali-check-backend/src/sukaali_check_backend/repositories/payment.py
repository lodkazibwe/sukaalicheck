import uuid

from sqlalchemy.orm import Session

from sukaali_check_backend.models.payment_record import PaymentRecord


class PaymentRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> PaymentRecord:
        record = PaymentRecord(**kwargs)
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_by_reference(self, reference: str) -> PaymentRecord | None:
        return (
            self.db.query(PaymentRecord)
            .filter(PaymentRecord.reference == reference)
            .first()
        )

    def get_by_facility_id(self, facility_uuid: uuid.UUID) -> list[PaymentRecord]:
        return (
            self.db.query(PaymentRecord)
            .filter(PaymentRecord.facility_id == facility_uuid)
            .all()
        )

    def update_status(self, reference: str, status: str) -> None:
        record = self.get_by_reference(reference)
        if record:
            record.status = status
            self.db.commit()

    def set_provider_ref(self, reference: str, provider_ref: str) -> None:
        record = self.get_by_reference(reference)
        if record:
            record.provider_ref = provider_ref
            self.db.commit()

    def mark_failed(self, reference: str, reason: str | None) -> None:
        record = self.get_by_reference(reference)
        if record:
            record.status = "failed"
            record.failure_reason = (reason or "")[:255] or None
            self.db.commit()

    def get_active_record(self, facility_uuid: uuid.UUID) -> PaymentRecord | None:
        return (
            self.db.query(PaymentRecord)
            .filter(
                PaymentRecord.facility_id == facility_uuid,
                PaymentRecord.status.in_(["pending", "completed"]),
            )
            .first()
        )
