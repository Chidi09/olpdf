import base64
import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError

from ..core.supabase_client import supabase, supabase_admin

router = APIRouter(prefix="/auth", tags=["auth"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _api_secret() -> str:
    secret = (os.environ.get("API_JWT_SECRET") or "").strip()
    if not secret:
        raise HTTPException(status_code=500, detail="API_JWT_SECRET not configured")
    return secret


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120000)
    return f"pbkdf2_sha256$120000${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds_str, salt_b64, digest_b64 = stored.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        rounds = int(rounds_str)
        salt = base64.urlsafe_b64decode(salt_b64.encode())
        expected = base64.urlsafe_b64decode(digest_b64.encode())
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def _create_session_token(user: Dict[str, Any]) -> str:
    exp = _now() + timedelta(days=14)
    payload = {
        "sub": str(user["id"]),
        "email": user.get("email"),
        "name": user.get("name", ""),
        "image": user.get("image"),
        "iat": int(_now().timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, _api_secret(), algorithm="HS256")


def _decode_session_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, _api_secret(), algorithms=["HS256"], options={"verify_aud": False})
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid session token")


def _get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    res = supabase.table("user").select("*").eq("email", email.lower()).limit(1).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    try:
        return supabase.table("user").select("*").eq("id", user_id).single().execute().data
    except Exception:
        return None


def _upsert_profile(user: Dict[str, Any]) -> None:
    payload = {
        "id": str(user["id"]),
        "email": user.get("email") or "",
        "full_name": user.get("name") or "",
        "avatar_url": user.get("image"),
    }
    try:
        supabase.table("profiles").upsert(payload).execute()
    except Exception:
        # profiles.id may reference auth.users in some environments.
        # Do not fail auth flow if profile sync cannot be completed.
        return


def _ensure_auth_user_id(email: str, name: str) -> str:
    """Create a user in auth.users via the Supabase admin API.

    Returns a valid auth.users UUID, or falls back to a synthetic UUID if the
    admin API is unavailable.  Callers **must** handle the case where the
    returned UUID does not exist in auth.users (e.g. by catching FK violations
    gracefully when writing to tables that reference profiles.id).
    """
    import logging
    logger = logging.getLogger("olpdf-api")
    for attempt in range(2):
        try:
            created = supabase_admin.auth.admin.create_user(
                {
                    "email": email,
                    "email_confirm": True,
                    "user_metadata": {"full_name": name},
                    "password": secrets.token_urlsafe(24),
                }
            )
            user = getattr(created, "user", None) or (created.get("user") if isinstance(created, dict) else None)
            user_id = getattr(user, "id", None) or (user.get("id") if isinstance(user, dict) else None)
            if user_id:
                logger.info("Created auth.users entry for %s → %s", email, user_id)
                return str(user_id)
        except Exception as exc:
            logger.warning("admin.create_user attempt %d failed for %s: %s", attempt + 1, email, exc)
    logger.warning("Falling back to synthetic UUID for %s", email)
    return str(uuid.uuid4())


def _get_password_hash(email: str) -> Optional[str]:
    try:
        account = (
            supabase.table("account")
            .select("password")
            .eq("providerId", "credential")
            .eq("accountId", email.lower())
            .single()
            .execute()
            .data
        )
        return account.get("password")
    except Exception:
        return None


def _save_magic_token(email: str, token: str) -> None:
    expires = (_now() + timedelta(minutes=10)).isoformat()
    payload = {
        "id": str(uuid.uuid4()),
        "identifier": f"magic:{email.lower()}",
        "value": token,
        "expiresAt": expires,
        "createdAt": _now().isoformat(),
        "updatedAt": _now().isoformat(),
    }
    supabase.table("verification").insert(payload).execute()


async def _send_magic_link_email(email: str, callback_url: str, token: str) -> None:
    resend_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not resend_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY not configured")

    base_url = (os.environ.get("APP_URL") or os.environ.get("BETTER_AUTH_URL") or "https://www.olpdf.xyz").strip()
    if callback_url.startswith("/"):
        link = f"{base_url}{callback_url}?magicToken={token}"
    else:
        sep = "&" if "?" in callback_url else "?"
        link = f"{callback_url}{sep}magicToken={token}"

    html = (
        "<div style='font-family:sans-serif;max-width:480px;margin:0 auto'>"
        "<h2 style='color:#f97316'>Sign in to OLPDF</h2>"
        "<p>Click below to sign in. This link expires in 10 minutes.</p>"
        f"<a href='{link}' style='display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700'>Sign In</a>"
        "</div>"
    )

    payload = {
        "from": "OLPDF <no-reply@olpdf.xyz>",
        "to": [email],
        "subject": "Your OLPDF sign-in link",
        "html": html,
    }
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if res.status_code >= 400:
            raise HTTPException(status_code=502, detail="Failed to send magic link email")


class SignupInput(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class MagicStartInput(BaseModel):
    email: EmailStr
    callbackURL: Optional[str] = "/dashboard"


class MagicVerifyInput(BaseModel):
    token: str


class SessionInput(BaseModel):
    token: str


@router.post("/signup")
async def signup(payload: SignupInput):
    email = payload.email.lower().strip()
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if _get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already exists")

    user_id = _ensure_auth_user_id(email, payload.name.strip())
    user_row = {
        "id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "emailVerified": True,
        "image": None,
    }
    supabase.table("user").insert(user_row).execute()
    supabase.table("account").insert(
        {
            "id": str(uuid.uuid4()),
            "accountId": email,
            "providerId": "credential",
            "userId": user_id,
            "password": _hash_password(payload.password),
        }
    ).execute()
    _upsert_profile(user_row)

    token = _create_session_token(user_row)
    return {"token": token, "user": user_row}


@router.post("/login")
async def login(payload: LoginInput):
    email = payload.email.lower().strip()
    user = _get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    hashed = _get_password_hash(email)
    if not hashed or not _verify_password(payload.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_session_token(user)
    return {"token": token, "user": user}


@router.post("/magic-link/start")
async def magic_link_start(payload: MagicStartInput):
    email = payload.email.lower().strip()
    token = secrets.token_urlsafe(32)
    _save_magic_token(email, token)
    await _send_magic_link_email(email, payload.callbackURL or "/dashboard", token)

    return {"ok": True}


@router.post("/magic-link/verify")
async def magic_link_verify(payload: MagicVerifyInput):
    row = (
        supabase.table("verification")
        .select("*")
        .eq("value", payload.token)
        .order("createdAt", desc=True)
        .limit(1)
        .execute()
        .data
    )
    if not row:
        raise HTTPException(status_code=401, detail="Invalid magic token")
    item = row[0]
    exp = datetime.fromisoformat(str(item["expiresAt"]).replace("Z", "+00:00"))
    if exp < _now():
        raise HTTPException(status_code=401, detail="Magic token expired")
    email = str(item["identifier"]).replace("magic:", "", 1)
    user = _get_user_by_email(email)
    if not user:
        user = {
            "id": _ensure_auth_user_id(email, email.split("@")[0]),
            "name": email.split("@")[0],
            "email": email,
            "emailVerified": True,
            "image": None,
        }
        supabase.table("user").insert(user).execute()
        _upsert_profile(user)
    token = _create_session_token(user)
    return {"token": token, "user": user}


def _oauth_state(provider: str, callback: str, nxt: str) -> str:
    payload = {
        "provider": provider,
        "callback": callback,
        "next": nxt,
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(minutes=10)).timestamp()),
    }
    return jwt.encode(payload, _api_secret(), algorithm="HS256")


def _oauth_state_decode(state: str) -> Dict[str, Any]:
    try:
        return jwt.decode(state, _api_secret(), algorithms=["HS256"], options={"verify_aud": False})
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid oauth state")


@router.get("/oauth/{provider}/start")
async def oauth_start(provider: str, callback: str = Query(...), next: str = Query("/dashboard")):
    provider = provider.lower()
    state = _oauth_state(provider, callback, next)
    if provider == "google":
        client_id = (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()
        if not client_id:
            raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID missing")
        url = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={client_id}"
            f"&redirect_uri={callback}"
            "&response_type=code"
            "&scope=openid%20email%20profile"
            f"&state={state}"
            "&prompt=select_account"
        )
        return {"url": url}
    if provider == "github":
        client_id = (os.environ.get("GITHUB_CLIENT_ID") or "").strip()
        if not client_id:
            raise HTTPException(status_code=500, detail="GITHUB_CLIENT_ID missing")
        url = (
            "https://github.com/login/oauth/authorize"
            f"?client_id={client_id}"
            f"&redirect_uri={callback}"
            "&scope=read:user%20user:email"
            f"&state={state}"
        )
        return {"url": url}
    raise HTTPException(status_code=400, detail="Unsupported provider")


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, code: str = Query(...), state: str = Query(...), callback: str = Query(...)):
    provider = provider.lower()
    payload = _oauth_state_decode(state)
    if payload.get("provider") != provider or payload.get("callback") != callback:
        raise HTTPException(status_code=400, detail="OAuth state mismatch")

    async with httpx.AsyncClient(timeout=20) as client:
        if provider == "google":
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": (os.environ.get("GOOGLE_CLIENT_ID") or "").strip(),
                    "client_secret": (os.environ.get("GOOGLE_CLIENT_SECRET") or "").strip(),
                    "redirect_uri": callback,
                    "grant_type": "authorization_code",
                },
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            user_res = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_res.raise_for_status()
            profile = user_res.json()
            email = str(profile.get("email", "")).lower()
            name = profile.get("name") or email.split("@")[0]
            image = profile.get("picture")
            account_id = str(profile.get("id"))
        elif provider == "github":
            token_res = await client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={
                    "client_id": (os.environ.get("GITHUB_CLIENT_ID") or "").strip(),
                    "client_secret": (os.environ.get("GITHUB_CLIENT_SECRET") or "").strip(),
                    "code": code,
                    "redirect_uri": callback,
                    "state": state,
                },
            )
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            user_res = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
            )
            user_res.raise_for_status()
            profile = user_res.json()
            email = (profile.get("email") or "").lower()
            if not email:
                emails_res = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
                )
                emails_res.raise_for_status()
                emails = emails_res.json()
                primary = next((e for e in emails if e.get("primary")), None) or (emails[0] if emails else None)
                email = (primary or {}).get("email", "").lower()
            name = profile.get("name") or profile.get("login") or email.split("@")[0]
            image = profile.get("avatar_url")
            account_id = str(profile.get("id"))
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")

    if not email:
        raise HTTPException(status_code=400, detail="OAuth provider did not return email")

    user = _get_user_by_email(email)
    if not user:
        user = {
            "id": _ensure_auth_user_id(email, name),
            "name": name,
            "email": email,
            "emailVerified": True,
            "image": image,
        }
        supabase.table("user").insert(user).execute()
    else:
        supabase.table("user").update({"name": name, "image": image, "emailVerified": True}).eq("id", user["id"]).execute()
        user = _get_user_by_id(str(user["id"])) or user

    try:
        supabase.table("account").select("id").eq("providerId", provider).eq("accountId", account_id).single().execute()
    except Exception:
        supabase.table("account").insert(
            {
                "id": str(uuid.uuid4()),
                "accountId": account_id,
                "providerId": provider,
                "userId": user["id"],
            }
        ).execute()

    _upsert_profile(user)
    token = _create_session_token(user)
    return {"token": token, "user": user, "next": payload.get("next") or "/dashboard"}


@router.post("/session")
async def session(payload: SessionInput):
    claims = _decode_session_token(payload.token)
    user = _get_user_by_id(str(claims.get("sub")))
    if not user:
        raise HTTPException(status_code=401, detail="Session user not found")
    return {"user": user}


@router.post("/logout")
async def logout():
    return {"ok": True}
