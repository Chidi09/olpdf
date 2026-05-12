"""Try accessing auth schema via supabase client."""
import os, sys
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# The underlying postgrest client exposes a schema() method
# Try to access the auth schema
try:
    # Create a new postgrest client for auth schema
    from postgrest import SyncPostgrestClient
    from supabase.lib.client_options import ClientOptions
    
    auth_client = SyncPostgrestClient(
        f"{SUPABASE_URL}/rest/v1",
        schema="auth",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
    )
    
    # Try to query auth.users
    result = auth_client.table("users").select("id").limit(1).execute()
    print(f"auth.users query: {result}")
except Exception as e:
    print(f"auth schema access failed: {e}")

# Alternative: use the supabase client's auth API to sign up
# This uses the user-facing auth endpoint
try:
    supabase.auth.sign_up({"email": f"test-py-{os.urandom(4).hex()}@test.com", "password": "TestPass123!"})
    print("sign_up succeeded!")
    print(f"User: {supabase.auth.get_user()}")
except Exception as e:
    print(f"sign_up failed: {e}")

# Try to get the current user session
try:
    user = supabase.auth.get_user()
    print(f"Current user: {user}")
except Exception as e:
    print(f"get_user failed: {e}")
