"""One-time MTN MoMo *sandbox* provisioning helper.

Creates a sandbox API User + API Key from your Collection subscription key, then
prints the values to paste into `.env` (MOMO_API_USER / MOMO_API_KEY).

Prerequisites in your environment / .env:
    MOMO_SUBSCRIPTION_KEY   Collection product primary key (Ocp-Apim-Subscription-Key)
    MOMO_CALLBACK_HOST      any https host you control, e.g. https://sukaalicheck.com
    MOMO_BASE_URL           defaults to https://sandbox.momodeveloper.mtn.com

Run:
    uv run python scripts/provision_momo_sandbox.py
"""
import sys
import uuid

import httpx

from sukaali_check_backend.config import settings


def main() -> int:
    sub_key = settings.momo_subscription_key
    if not sub_key:
        print("ERROR: MOMO_SUBSCRIPTION_KEY is not set in your .env", file=sys.stderr)
        return 1

    base = settings.momo_base_url
    callback_host = settings.momo_callback_host or "https://example.com"
    api_user = str(uuid.uuid4())

    with httpx.Client(timeout=30.0) as client:
        # 1. Create the API user (the X-Reference-Id becomes the API user id).
        r = client.post(
            f"{base}/v1_0/apiuser",
            headers={
                "X-Reference-Id": api_user,
                "Ocp-Apim-Subscription-Key": sub_key,
                "Content-Type": "application/json",
            },
            json={"providerCallbackHost": callback_host},
        )
        if r.status_code not in (201, 409):
            print(f"ERROR creating API user ({r.status_code}): {r.text}", file=sys.stderr)
            return 1

        # 2. Create the API key for that user.
        r = client.post(
            f"{base}/v1_0/apiuser/{api_user}/apikey",
            headers={"Ocp-Apim-Subscription-Key": sub_key},
        )
        if r.status_code != 201:
            print(f"ERROR creating API key ({r.status_code}): {r.text}", file=sys.stderr)
            return 1
        api_key = r.json()["apiKey"]

    print("\nSandbox credentials provisioned. Add these to your .env:\n")
    print(f"MOMO_API_USER={api_user}")
    print(f"MOMO_API_KEY={api_key}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
