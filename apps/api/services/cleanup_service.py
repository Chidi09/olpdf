from datetime import datetime, timedelta, timezone
from ..core.supabase_client import supabase


def cleanup_old_exports(bucket_name: str = "exports", hours: int = 24) -> dict:
    try:
        files = supabase.storage.from_(bucket_name).list()
        now = datetime.now(timezone.utc)
        delete_count = 0
        for file in files:
            created_at = datetime.fromisoformat(file["created_at"].replace("Z", "+00:00"))
            if now - created_at > timedelta(hours=hours):
                supabase.storage.from_(bucket_name).remove([file["name"]])
                delete_count += 1
        return {"status": "success", "deleted_count": delete_count}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
