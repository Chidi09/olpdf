"""
FastAPI Depends() functions — single import point for route files.
"""
from .auth import get_current_user, require_auth, check_ownership, require_role

__all__ = ["get_current_user", "require_auth", "check_ownership", "require_role"]
