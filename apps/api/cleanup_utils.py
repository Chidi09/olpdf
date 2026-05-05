
from datetime import datetime, timedelta, timezone
from .supabase_client import supabase

def cleanup_old_exports(bucket_name: str = "exports", hours: int = 24):
    """Delete files older than the specified number of hours from the given bucket."""
    try:
        # List files in the bucket
        files = supabase.storage.from_(bucket_name).list()
        
        now = datetime.now(timezone.utc)
        delete_count = 0
        
        for file in files:
            created_at = datetime.fromisoformat(file['created_at'].replace('Z', '+00:00'))
            if now - created_at > timedelta(hours=hours):
                supabase.storage.from_(bucket_name).remove([file['name']])
                delete_count += 1
                
        return {"status": "success", "deleted_count": delete_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}
