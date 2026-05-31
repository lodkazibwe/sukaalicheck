from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sukaali_check_backend.core.exceptions import AuthError, ForbiddenError
from sukaali_check_backend.core.security import (
    SCOPE_ADMIN,
    SCOPE_FACILITY,
    SCOPE_FIRST_LOGIN,
    SCOPE_PAYMENT_DONE,
    decode_access_token,
)
from sukaali_check_backend.db.session import get_db  # re-export for convenience

bearer_scheme = HTTPBearer()


def _require_scope(token: str, *allowed_scopes: str) -> dict:
    payload = decode_access_token(token)
    scope = payload.get("scope")
    if scope not in allowed_scopes:
        raise ForbiddenError(f"Insufficient scope. Required: {allowed_scopes}, got: {scope}")
    return payload


def get_current_facility(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    return _require_scope(credentials.credentials, SCOPE_FACILITY)


def get_first_login_facility(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    return _require_scope(credentials.credentials, SCOPE_FIRST_LOGIN)


def get_payment_done_facility(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    return _require_scope(credentials.credentials, SCOPE_PAYMENT_DONE)


def get_first_login_or_payment_done_facility(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    return _require_scope(credentials.credentials, SCOPE_FIRST_LOGIN, SCOPE_PAYMENT_DONE)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    return _require_scope(credentials.credentials, SCOPE_ADMIN)


def get_any_authenticated(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    return _require_scope(
        credentials.credentials,
        SCOPE_FACILITY,
        SCOPE_FIRST_LOGIN,
        SCOPE_PAYMENT_DONE,
        SCOPE_ADMIN,
    )
