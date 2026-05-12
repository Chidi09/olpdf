"""Direct insert into auth.users via REST API."""
import os, sys, httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# Try inserting into auth.users through the rest API
import uuid
user_id = str(uuid.uuid4())
email = f"direct-{os.urandom(4).hex()}@test.com"

body = {
    "id": user_id,
    "email": email,
    "raw_user_meta_data": {"full_name": "Direct Test"},
    "email_confirmed_at": "2026-01-01T00:00:00Z",
    "confirmation_sent_at": "2026-01-01T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z",
}

print(f"Attempting to insert into auth.users with ID: {user_id}")
for schema in ["auth", "public"]:
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{schema}.users",
        headers=headers,
        json=body,
    )
    print(f"{schema}.users: {r.status_code} - {r.text[:200]}")
    if r.status_code in (200, 201):
        print(f"SUCCESS via {schema}.users!")
        break

# Also try profiles directly (might work without the FK if we bypass)
print("\nAttempting direct profile insert...")
r = httpx.post(
    f"{SUPABASE_URL}/rest/v1/profiles",
    headers=headers,
    json={"id": user_id, "email": email, "full_name": "Direct Test"},
)
print(f"profiles insert: {r.status_code} - {r.text[:300]}")
if r.status_code == 201:
    print("Profile created directly!")
