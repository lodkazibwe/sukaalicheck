from sqlalchemy.orm import Session

from sukaali_check_backend.models.app_setting import AppSetting

PAYMENT_ENABLED_KEY = "payment_enabled"


class AppSettingRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, key: str, default: str | None = None) -> str | None:
        setting = self.db.query(AppSetting).filter(AppSetting.key == key).first()
        return setting.value if setting else default

    def set(self, key: str, value: str) -> None:
        setting = self.db.query(AppSetting).filter(AppSetting.key == key).first()
        if setting:
            setting.value = value
        else:
            setting = AppSetting(key=key, value=value)
            self.db.add(setting)
        self.db.commit()
