"""Try to create auth user via direct GoTrue REST API.
Runs inside Docker container."""
import os, sys, httpx, json

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# GoTrue admin API endpoint
gotrue_url = f"{SUPABASE_URL}/auth/v1/admin/users"
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

email = f"test-fix-{os.urandom(4).hex()}@olpdf.xyz"
body = {
    "email": email,
    "password": "TestPass123!",
    "email_confirm": True,
    "user_metadata": {"full_name": "Test Fix"},
}

print(f"GoTrue endpoint: {gotrue_url}")
r = httpx.post(gotrue_url, headers=headers, json=body)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:500]}")

if r.status_code == 201:
    user = r.json()
    user_id = user.get("id")
    print(f"Created user: {user_id}")
    
    # Now try creating a profile with the same ID
    r2 = httpx.post(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers=headers,
        json={"id": user_id, "email": email, "full_name": "Test Fix"},
    )
    print(f"Profile create status: {r2.status_code}")
    print(f"Profile response: {r2.text[:300]}")
    
    if r2.status_code == 201:
        print("SUCCESS: user + profile created")
        sys.exit(0)

# If GoTrue fails, try the bulk_users endpoint
if r.status_code == 404:
    print("GoTrue admin endpoint not found, trying v2...")
    for path in ["/auth/v2/admin/users", "/auth/admin/users", "/auth/v1/users"]:
        gotrue_url2 = f"{SUPABASE_URL}{path}"
        r = httpx.post(gotrue_url2, headers=headers, json=body)
        print(f"{path}: {r.status_code} - {r.text[:200]}")

print("\nAll auth user creation methods failed.")
print("The app needs the FK constraints removed from the database.")
print("Run the SQL in Supabase dashboard -> SQL Editor:")
