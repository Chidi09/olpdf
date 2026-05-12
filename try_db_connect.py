"""Try direct Postgres connection via SSL using service role key."""
import os, sys, ssl, socket, struct

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Extract hostname from URL
from urllib.parse import urlparse
parsed = urlparse(SUPABASE_URL)
hostname = parsed.hostname  # zyicxexnkinkhanzxwzl.supabase.co
print(f"Hostname: {hostname}")

# Try connecting to the Postgres port (5432) with SSL
try:
    # First, try to get SSL certificates
    import httpx
    # Try the Supabase API to get a direct connection string
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    # Try connecting to the database via a subdomain
    db_host = f"db.{hostname}"
    print(f"DB host: {db_host}")
    
    # Try to use psycopg2 if available
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=db_host,
            port=5432,
            user="postgres",
            password=SUPABASE_KEY,  # service role key as password
            dbname="postgres",
            sslmode="require",
            connect_timeout=10,
        )
        cur = conn.cursor()
        cur.execute("SELECT 1")
        print(f"Connected! Result: {cur.fetchone()}")
        cur.close()
        conn.close()
    except ImportError:
        print("psycopg2 not installed - will try raw SSL socket")
    except Exception as e:
        print(f"psycopg2 connection failed: {e}")
    
    # Try pg8000 as alternative
    try:
        import pg8000
        conn = pg8000.connect(
            host=db_host,
            port=5432,
            user="postgres",
            password=SUPABASE_KEY,
            database="postgres",
            ssl_context=ssl.create_default_context(),
        )
        cur = conn.cursor()
        cur.execute("SELECT 1")
        print(f"pg8000 Connected! Result: {cur.fetchone()}")
        cur.close()
        conn.close()
    except ImportError:
        print("pg8000 not installed")
    except Exception as e:
        print(f"pg8000 failed: {e}")
        
except Exception as e:
    print(f"All connection methods failed: {e}")

print("\nUnable to connect directly to database.")
print("Run the SQL in Supabase dashboard -> SQL Editor:")
print("(instructions provided separately)")
