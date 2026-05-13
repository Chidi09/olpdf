from fastapi import APIRouter, Depends
from ..auth_utils import require_auth
from ..supabase_client import supabase

router = APIRouter(prefix="/api/avatar", tags=["avatar"])

DICEBEAR_BASE = "https://api.dicebear.com/9.x/lorelei/png"


@router.post("/generate")
async def generate_avatar(user: dict = Depends(require_auth)) -> dict:
    user_id = user["sub"]
    url = f"{DICEBEAR_BASE}?seed={user_id}&size=200"

    supabase.table("profiles").update({"avatar_url": url}).eq("id", user_id).execute()

    return {"avatar_url": url}
