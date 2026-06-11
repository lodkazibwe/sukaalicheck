import logging
from pathlib import Path

import httpx
from jinja2 import Environment, FileSystemLoader

from sukaali_check_backend.config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"
RESEND_API = "https://api.resend.com/emails"


async def _send(to: str | list[str], subject: str, html: str) -> None:
    recipients = [to] if isinstance(to, str) else to
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            RESEND_API,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.mail_from,
                "to": recipients,
                "subject": subject,
                "html": html,
            },
        )
        r.raise_for_status()


async def send_admin_notification(
    facility_name: str, specialist_name: str, licence_number: str, facility_email: str
) -> None:
    try:
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        html = env.get_template("admin_new_signup.html").render(
            facility_name=facility_name,
            specialist_name=specialist_name,
            licence_number=licence_number,
            facility_email=facility_email,
        )
        await _send(
            to=settings.admin_email,
            subject=f"New Facility Application: {facility_name}",
            html=html,
        )
    except Exception as e:
        logger.error("Failed to send admin notification: %s", e)


async def send_rejection_email(to_email: str, facility_name: str, reason: str) -> None:
    try:
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        html = env.get_template("facility_rejection.html").render(
            facility_name=facility_name,
            reason=reason,
        )
        await _send(
            to=to_email,
            subject="SukaaliCheck — Application Update",
            html=html,
        )
    except Exception as e:
        logger.error("Failed to send rejection email to %s: %s", to_email, e)


async def send_otp_email(to_email: str, facility_name: str, facility_id: str, otp: str) -> None:
    try:
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        html = env.get_template("facility_otp.html").render(
            facility_name=facility_name,
            facility_id=facility_id,
            otp=otp,
        )
        await _send(
            to=to_email,
            subject="SukaaliCheck — Your Activation Code",
            html=html,
        )
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", to_email, e)
