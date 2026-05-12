"""Try to connect to Postgres and run FK migration."""
import os, sys, ssl, traceback

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
PROJECT_REF = SUPABASE_URL.split("https://")[1].split(".")[0] if SUPABASE_URL else ""
DB_HOST = f"db.{PROJECT_REF}.supabase.co"

SQL = """
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT constraint_name, table_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
      AND table_schema = 'public'
      AND constraint_name IN (
        'profiles_id_fkey',
        'documents_user_id_fkey',
        'user_ai_settings_user_id_fkey',
        'api_keys_user_id_fkey'
      )
  ) LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    RAISE NOTICE 'Dropped % on %', r.constraint_name, r.table_name;
  END LOOP;
END;
$$;
"""

print(f"Connecting to {DB_HOST}:5432 as postgres...")

try:
    import pg8000
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    conn = pg8000.connect(
        host=DB_HOST,
        port=5432,
        user="postgres",
        password=SUPABASE_KEY,
        database="postgres",
        ssl_context=ctx,
        timeout=30,
    )
    print("Connected!")
    
    cur = conn.cursor()
    try:
        cur.execute(SQL)
        conn.commit()
        print("SQL migration completed successfully!")
        print("FK constraints dropped.")
    except Exception as e:
        conn.rollback()
        print(f"SQL execution failed: {e}")
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()
        
except ImportError:
    print("pg8000 not available")
except Exception as e:
    print(f"Connection failed: {e}")
    traceback.print_exc()
    
print("\nDone.")
