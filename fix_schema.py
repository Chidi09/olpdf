"""Fix FK constraints that block custom auth users.

Runs inside the production Docker container (olpdf-api-green).
"""
import os
import sys

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("FATAL: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

SQL = """
DO $$
DECLARE
  constraints TEXT[] := ARRAY[
    'profiles_id_fkey',
    'documents_user_id_fkey',
    'user_ai_settings_user_id_fkey',
    'api_keys_user_id_fkey'
  ];
  c TEXT;
BEGIN
  FOREACH c IN ARRAY constraints LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = c AND table_schema = 'public'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',
        (SELECT table_name FROM information_schema.table_constraints
         WHERE constraint_name = c AND table_schema = 'public'),
        c);
      RAISE NOTICE 'Dropped constraint: %', c;
    END IF;
  END LOOP;
END;
$$;
"""

# Step 1: Create the exec_sql function
print("Step 1: Creating custom function via PostgREST...")

# The PostgREST schema cache needs the function to exist.
# We'll create it via a direct HTTP call that mimics Supabase's own tooling.
# Actually, Supabase doesn't allow creating functions via REST.
# We need to use the database connection directly.

# Try using the supabase-py client's ability to make raw requests
from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Try to find the database host from the URL
import re
match = re.search(r'https?://([^.]+)\.supabase\.co', SUPABASE_URL)
if match:
    project_ref = match.group(1)
    print(f"Project ref: {project_ref}")

    # Try the database connection API
    try:
        r = httpx.get(
            f"https://api.supabase.com/v1/projects/{project_ref}/postgres",
            headers={"Authorization": f"Bearer {SUPABASE_KEY}"},
        )
        if r.status_code == 200:
            db_info = r.json()
            print(f"DB connection info: {db_info}")
        else:
            print(f"DB API status: {r.status_code} - {r.text[:200]}")
    except Exception as e:
        print(f"DB API error: {e}")

# Fallback: try connecting via direct postgres URL
db_url = os.environ.get("DIRECT_DATABASE_URL", "")
if db_url:
    print("Found DIRECT_DATABASE_URL, connecting...")
    import psycopg2
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(SQL)
        conn.commit()
        cur.close()
        conn.close()
        print("SQL migration completed successfully!")
        sys.exit(0)
    except Exception as e:
        print(f"psql error: {e}")
else:
    print("No DIRECT_DATABASE_URL available")

print("\n=== MANUAL STEP REQUIRED ===")
print("Run this SQL in Supabase dashboard SQL editor:")
print(SQL)
print("\nThen restart the app: docker restart olpdf-api-green")
