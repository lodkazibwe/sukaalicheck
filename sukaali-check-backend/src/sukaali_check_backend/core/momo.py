"""MTN MoMo Collection API client (RequestToPay).

Synchronous (mirrors the sync payment service/routes). The access token is cached
module-level and refreshed shortly before it expires.
"""
import base64
import logging
import re
import time
import uuid

import httpx

from sukaali_check_backend.config import settings
from sukaali_check_backend.core.exceptions import PaymentProviderError

logger = logging.getLogger(__name__)

_TIMEOUT = 15.0
_TOKEN_REFRESH_MARGIN = 60  # refresh this many seconds before expiry

_token_cache: dict[str, float | str | None] = {"token": None, "expires_at": 0.0}


def _base_headers() -> dict[str, str]:
    return {
        "Ocp-Apim-Subscription-Key": settings.momo_subscription_key,
        "X-Target-Environment": settings.momo_target_environment,
    }


def _get_token() -> str:
    now = time.time()
    cached = _token_cache["token"]
    if cached and now < float(_token_cache["expires_at"]):
        return str(cached)

    basic = base64.b64encode(
        f"{settings.momo_api_user}:{settings.momo_api_key}".encode()
    ).decode()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(
                f"{settings.momo_base_url}/collection/token/",
                headers={
                    "Authorization": f"Basic {basic}",
                    "Ocp-Apim-Subscription-Key": settings.momo_subscription_key,
                },
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPError as e:
        logger.error("MoMo token request failed: %s", e)
        raise PaymentProviderError("Could not authenticate with the payment provider")

    token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + expires_in - _TOKEN_REFRESH_MARGIN
    return token


def _normalize_msisdn(raw: str) -> str:
    """Normalize a phone number to a bare MSISDN, e.g. '+256 772 123 456' -> '256772123456'."""
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("0"):
        digits = "256" + digits[1:]
    elif digits.startswith("7") and len(digits) == 9:
        digits = "256" + digits
    return digits


def request_to_pay(
    amount: int,
    external_id: str,
    msisdn: str,
    payer_message: str,
    payee_note: str,
) -> str:
    """Send a RequestToPay. Returns the MoMo transaction reference (X-Reference-Id)."""
    token = _get_token()
    reference_id = str(uuid.uuid4())
    body = {
        "amount": str(amount),
        "currency": settings.momo_currency,
        "externalId": external_id,
        "payer": {"partyIdType": "MSISDN", "partyId": _normalize_msisdn(msisdn)},
        "payerMessage": payer_message,
        "payeeNote": payee_note,
    }
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(
                f"{settings.momo_base_url}/collection/v1_0/requesttopay",
                headers={
                    **_base_headers(),
                    "Authorization": f"Bearer {token}",
                    "X-Reference-Id": reference_id,
                    "Content-Type": "application/json",
                },
                json=body,
            )
            r.raise_for_status()
    except httpx.HTTPError as e:
        logger.error("MoMo requesttopay failed for %s: %s", external_id, e)
        raise PaymentProviderError("Could not initiate the mobile money request")
    return reference_id


def get_status(momo_ref: str) -> dict:
    """Look up a RequestToPay transaction. Returns the provider JSON (status, reason, ...)."""
    token = _get_token()
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.get(
                f"{settings.momo_base_url}/collection/v1_0/requesttopay/{momo_ref}",
                headers={**_base_headers(), "Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            return r.json()
    except httpx.HTTPError as e:
        logger.error("MoMo status lookup failed for %s: %s", momo_ref, e)
        raise PaymentProviderError("Could not check the payment status")
