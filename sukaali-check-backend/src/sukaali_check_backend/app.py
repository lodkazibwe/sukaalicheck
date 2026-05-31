import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from sukaali_check_backend.config import settings
from sukaali_check_backend.core.exceptions import DomainError
from sukaali_check_backend.core.rate_limit import limiter

logger = logging.getLogger(__name__)


def _seed_admin() -> None:
    from sukaali_check_backend.core.security import hash_password
    from sukaali_check_backend.db.session import SessionLocal
    from sukaali_check_backend.models.admin import Admin

    db = SessionLocal()
    try:
        if not db.query(Admin).filter(Admin.username == "admin").first():
            db.add(Admin(username="admin", password_hash=hash_password("admin@sukaali")))
            db.commit()
            logger.info("Default admin created (username=admin)")
    except Exception as e:
        logger.error("Failed to seed admin: %s", e)
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_admin()
    yield


app = FastAPI(
    title="SukaaliCheck API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    swagger_ui_parameters={"persistAuthorization": True},
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc) -> JSONResponse:
    return JSONResponse(status_code=429, content={"detail": "Too many requests"})


from sukaali_check_backend.api.routes.admin import router as admin_router  # noqa: E402
from sukaali_check_backend.api.routes.auth import router as auth_router  # noqa: E402
from sukaali_check_backend.api.routes.payment import router as payment_router  # noqa: E402

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(payment_router, prefix="/api/v1/payment", tags=["Payment"])


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    from fastapi.openapi.utils import get_openapi

    schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
    schema["components"]["securitySchemes"] = {
        "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    }
    for path in schema.get("paths", {}).values():
        for operation in path.values():
            operation.setdefault("security", [{"BearerAuth": []}])
    app.openapi_schema = schema
    return schema


app.openapi = custom_openapi
