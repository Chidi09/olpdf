"""One-shot script: drop FK constraints on profiles.id -> auth.users.id.

The app uses a custom credential auth flow that creates users in the `user`
table, NOT in Supabase Auth's `auth.users` table.  The `profiles.id` column
has a FK constraint referencing `auth.users.id` which causes all writes to
fail for custom-auth users.

This script drops that FK constraint and all downstream FK constraints that
reference `profiles.id`, so the app can function with its own user system.
"""
import os
import sys

from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# The postgrest client can call RPC functions on the supabase side.
# We'll try to drop the FK constraint via a SQL function.
SQL = """
DO $$
BEGIN
  -- Drop FK on auth.users if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    RAISE NOTICE 'Dropped profiles_id_fkey';
  END IF;

  -- Drop FK on documents -> profiles if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'documents_user_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.documents DROP CONSTRAINT documents_user_id_fkey;
    RAISE NOTICE 'Dropped documents_user_id_fkey';
  END IF;

  -- Drop FK on user_ai_settings -> profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_ai_settings_user_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.user_ai_settings DROP CONSTRAINT user_ai_settings_user_id_fkey;
    RAISE NOTICE 'Dropped user_ai_settings_user_id_fkey';
  END IF;

  -- Drop FK on api_keys -> profiles
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'api_keys_user_id_fkey'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.api_keys DROP CONSTRAINT api_keys_user_id_fkey;
    RAISE NOTICE 'Dropped api_keys_user_id_fkey';
  END IF;

  RAISE NOTICE 'All FK constraints removed';
END;
$$;
"""

print("Attempting to run SQL migration via pg_dump or RPC...")

# Try supabase's RPC interface first
try:
    result = supabase.rpc("exec_sql", {"query": SQL}).execute()
    print("RPC exec_sql succeeded:", result)
    sys.exit(0)
except Exception as e:
    print(f"RPC exec_sql failed: {e}")

# Fallback: try the direct postgrest SQL endpoint
try:
    import httpx
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    body = {"query": SQL}
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json=body,
    )
    print(f"HTTP fallback status: {r.status_code}")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    print(f"HTTP fallback failed: {e}")

print("\nNOTE: If all methods failed, run this SQL manually in Supabase SQL editor:")
print(SQL)
