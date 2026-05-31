import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from sukaali_check_backend.models.otp_token import OtpToken


class OtpTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, facility_uuid: uuid.UUID, token_hash: str, expires_at: datetime) -> OtpToken:
        token = OtpToken(facility_id=facility_uuid, token_hash=token_hash, expires_at=expires_at)
        self.db.add(token)
        self.db.commit()
        self.db.refresh(token)
        return token

    def get_valid_token(self, facility_uuid: uuid.UUID) -> OtpToken | None:
        now = datetime.utcnow()
        return (
            self.db.query(OtpToken)
            .filter(
                OtpToken.facility_id == facility_uuid,
                OtpToken.used_at.is_(None),
                OtpToken.expires_at > now,
                OtpToken.failed_attempts < 5,
            )
            .order_by(OtpToken.created_at.desc())
            .first()
        )

    def invalidate_all_for_facility(self, facility_uuid: uuid.UUID) -> None:
        now = datetime.utcnow()
        self.db.query(OtpToken).filter(
            OtpToken.facility_id == facility_uuid,
            OtpToken.used_at.is_(None),
        ).update({"used_at": now})
        self.db.commit()

    def mark_used(self, token_id: uuid.UUID) -> None:
        token = self.db.query(OtpToken).filter(OtpToken.id == token_id).first()
        if token:
            token.used_at = datetime.utcnow()
            self.db.commit()

    def increment_failed_attempts(self, token_id: uuid.UUID) -> int:
        token = self.db.query(OtpToken).filter(OtpToken.id == token_id).first()
        if token:
            token.failed_attempts += 1
            self.db.commit()
            if token.failed_attempts >= 5:
                token.used_at = datetime.utcnow()
                self.db.commit()
            return token.failed_attempts
        return 0
