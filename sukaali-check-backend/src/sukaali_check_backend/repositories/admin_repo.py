from sqlalchemy.orm import Session

from sukaali_check_backend.models.admin import Admin

class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_username(self, username: str) -> Admin | None:
        return self.db.query(Admin).filter(Admin.username == username).first()

    def exists(self, username: str) -> bool:
        return self.db.query(Admin).filter(Admin.username == username).count() > 0

    def create(self, username: str, password_hash: str) -> Admin:
        admin = Admin(username=username, password_hash=password_hash)
        self.db.add(admin)
        self.db.commit()
        self.db.refresh(admin)
        return admin
