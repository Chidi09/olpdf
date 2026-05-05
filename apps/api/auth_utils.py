import os
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verifies the Supabase JWT and returns the user payload."""
    if not SUPABASE_JWT_SECRET:
        # Fallback for local development if secret not set (NOT FOR PRODUCTION)
        if os.environ.get("OLPDF_DEV_MODE") == "true":
            return {"sub": "dev-user", "email": "dev@olpdf.io"}
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")

    token = credentials.credentials
    return verify_jwt_token(token)


def verify_jwt_token(token: str) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Missing token")

    jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not jwt_secret:
        if os.environ.get("OLPDF_DEV_MODE") == "true":
            return {"sub": "dev-user", "email": "dev@olpdf.io"}
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")

    try:
        payload = jwt.decode(
            token, 
            jwt_secret,
            algorithms=["HS256"], 
            options={"verify_aud": False}
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

def require_auth(payload: dict = Depends(get_current_user)):
    """Convenience dependency for routes that just need any valid user."""
    return payload
