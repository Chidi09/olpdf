#!/usr/bin/env python3
"""
Run SQL migrations from apps/api/migrations/ against the Supabase Postgres DB.
Tracks applied migrations in a schema_migrations table for idempotency.
Called by entrypoint.sh before starting gunicorn.

Requires SUPABASE_DB_PASSWORD in environment:
  Supabase Dashboard → Project Settings → Database → Database Password
"""
import os
import ssl
import sys
from pathlib import Path

import pg8000

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
# Direct Postgres password — separate from the service role key.
# Find it at: Supabase Dashboard → Project Settings → Database → Database Password
SUPABASE_DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")


def get_connection():
    if not SUPABASE_URL or not SUPABASE_DB_PASSWORD:
        print("[migrate] SUPABASE_DB_PASSWORD not set — skipping migrations")
        print("[migrate]   Get it from: Supabase Dashboard → Project Settings → Database")
        return None

    project_ref = SUPABASE_URL.split("https://")[1].split(".")[0]
    db_host = f"db.{project_ref}.supabase.co"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    return pg8000.connect(
        host=db_host,
        port=5432,
        user="postgres",
        password=SUPABASE_DB_PASSWORD,
        database="postgres",
        ssl_context=ctx,
        timeout=30,
    )


def run():
    sql_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not sql_files:
        print("[migrate] No SQL files found — nothing to do")
        return

    print(f"[migrate] {len(sql_files)} migration file(s) found")

    try:
        conn = get_connection()
    except Exception as e:
        print(f"[migrate] Connection failed: {e} — skipping")
        return

    if conn is None:
        return

    try:
        cur = conn.cursor()

        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename   TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.commit()

        applied = skipped = 0
        for path in sql_files:
            name = path.name
            cur.execute("SELECT 1 FROM schema_migrations WHERE filename = %s", (name,))
            if cur.fetchone():
                print(f"[migrate]   skip  {name}")
                skipped += 1
                continue

            print(f"[migrate]   apply {name} ...")
            try:
                cur.execute(path.read_text(encoding="utf-8"))
                cur.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s) ON CONFLICT DO NOTHING",
                    (name,),
                )
                conn.commit()
                print(f"[migrate]   ✓     {name}")
                applied += 1
            except Exception as e:
                conn.rollback()
                print(f"[migrate]   ERROR {name}: {e}")
                print("[migrate] Aborting — fix the migration and redeploy")
                sys.exit(1)

        print(f"[migrate] Done — {applied} applied, {skipped} skipped")
    finally:
        conn.close()


if __name__ == "__main__":
    run()
