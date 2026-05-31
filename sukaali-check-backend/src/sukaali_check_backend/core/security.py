import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from sukaali_check_backend.core.exceptions import AuthError

SCOPE_FIRST_LOGIN = "first_login"
SCOPE_PAYMENT_DONE = "payment_done"
SCOPE_FACILITY = "facility"
SCOPE_ADMIN = "admin"


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def generate_otp() -> str:
    return str(secrets.randbelow(1_000_000)).zfill(6)


def hash_otp(otp: str) -> str:
    return hash_password(otp)


def create_access_token(data: dict, scope: str, expires_delta: timedelta) -> str:
    from sukaali_check_backend.config import settings

    payload = data.copy()
    payload["scope"] = scope
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    from sukaali_check_backend.config import settings

    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise AuthError("Token has expired")
    except jwt.InvalidTokenError:
        raise AuthError("Invalid token")
