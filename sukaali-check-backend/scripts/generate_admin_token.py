"""
Generate a static admin JWT for Phase 1.

Usage:
    cd sukaali-check-backend
    uv run python scripts/generate_admin_token.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from datetime import timedelta
from sukaali_check_backend.core.security import SCOPE_ADMIN, create_access_token

token = create_access_token(
    data={"sub": "admin"},
    scope=SCOPE_ADMIN,
    expires_delta=timedelta(days=365),
)
print("Admin JWT (valid 1 year):")
print(token)
