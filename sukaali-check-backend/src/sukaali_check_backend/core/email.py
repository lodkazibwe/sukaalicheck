import logging
from pathlib import Path

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
from jinja2 import Environment, FileSystemLoader

from sukaali_check_backend.config import settings

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates" / "email"


def _get_mail_config() -> ConnectionConfig:
    return ConnectionConfig(
        MAIL_USERNAME=settings.mail_username,
        MAIL_PASSWORD=settings.mail_password,
        MAIL_FROM=settings.mail_from,
        MAIL_PORT=settings.mail_port,
        MAIL_SERVER=settings.mail_server,
        MAIL_STARTTLS=settings.mail_tls,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=bool(settings.mail_username),
        VALIDATE_CERTS=True,
    )


async def send_admin_notification(
    facility_name: str, specialist_name: str, licence_number: str, facility_email: str
) -> None:
    try:
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        template = env.get_template("admin_new_signup.html")
        html_body = template.render(
            facility_name=facility_name,
            specialist_name=specialist_name,
            licence_number=licence_number,
            facility_email=facility_email,
        )
        message = MessageSchema(
            subject=f"New Facility Application: {facility_name}",
            recipients=[settings.admin_email],
            body=html_body,
            subtype=MessageType.html,
        )
        fm = FastMail(_get_mail_config())
        await fm.send_message(message)
    except Exception as e:
        logger.error("Failed to send admin notification: %s", e)


async def send_otp_email(to_email: str, facility_name: str, facility_id: str, otp: str) -> None:
    try:
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        template = env.get_template("facility_otp.html")
        html_body = template.render(facility_name=facility_name, facility_id=facility_id, otp=otp)
        message = MessageSchema(
            subject="SukaaliCheck — Your Activation Code",
            recipients=[to_email],
            body=html_body,
            subtype=MessageType.html,
        )
        fm = FastMail(_get_mail_config())
        await fm.send_message(message)
    except Exception as e:
        logger.error("Failed to send OTP email to %s: %s", to_email, e)
