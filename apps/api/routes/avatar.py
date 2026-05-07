import httpx
from fastapi import APIRouter, Depends, HTTPException
from ..auth_utils import require_auth
from ..storage_client import r2_storage
from ..supabase_client import supabase

router = APIRouter(prefix="/api/avatar", tags=["avatar"])

DICEBEAR_BASE = "https://api.dicebear.com/9.x/lorelei/png"


@router.post("/generate")
async def generate_avatar(user: dict = Depends(require_auth)) -> dict:
    user_id = user["sub"]

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(DICEBEAR_BASE, params={"seed": user_id, "size": "200"})
        if resp.status_code != 200:
            raise HTTPException(502, "Failed to fetch avatar from DiceBear")
        image_bytes = resp.content

    object_key = f"avatars/{user_id}.png"
    url = r2_storage.upload_bytes(image_bytes, object_key)
    if not url:
        raise HTTPException(500, "Failed to upload avatar to storage")

    supabase.table("profiles").update({"avatar_url": url}).eq("id", user_id).execute()

    return {"avatar_url": url}
