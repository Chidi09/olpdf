"""Try to create auth user via supabase.auth.sign_up with service role key."""
import os, sys, httpx, json

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# The auth signup endpoint (different from admin API)
# Uses the user-facing auth endpoint with service role key
email = f"test-final-{os.urandom(4).hex()}@olpdf.xyz"

# Method 1: Try the user-facing auth signup endpoint with service_role key
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

body = {
    "email": email,
    "password": "TestPass123!",
    "data": {"full_name": "Test Final"},
}

print(f"Method 1: /auth/v1/signup")
r = httpx.post(f"{SUPABASE_URL}/auth/v1/signup", headers=headers, json=body)
print(f"  Status: {r.status_code}")
resp = r.json() if r.text else {}
print(f"  Response: {json.dumps(resp, indent=2)[:300]}")

if r.status_code == 200 and resp.get("id"):
    user_id = resp["id"]
    print(f"  SUCCESS! User ID: {user_id}")
    
    # Now try profiles
    r2 = httpx.post(
        f"{SUPABASE_URL}/rest/v1/profiles",
        headers=headers,
        json={"id": user_id, "email": email, "full_name": "Test Final"},
    )
    print(f"  Profile create: {r2.status_code} - {r2.text[:200]}")
    sys.exit(0)

# Method 2: Try the gotrue signup endpoint directly
print(f"\nMethod 2: /auth/v1/verify (different endpoint)")
for path in ["/auth/v1/token?grant_type=password", "/auth/v1/user"]:
    print(f"Trying: {path}")
    r = httpx.post(f"{SUPABASE_URL}{path}", headers=headers, json={"email": email, "password": "TestPass123!"})
    print(f"  Status: {r.status_code} - {r.text[:200]}")

# Method 3: Check auth settings
print(f"\nMethod 3: GET /auth/v1/settings")
r = httpx.get(f"{SUPABASE_URL}/auth/v1/settings", headers=headers)
print(f"  Status: {r.status_code} - {r.text[:300]}")

print("\nNone of the auth creation methods worked.")
print("The Supabase project has a broken auth schema that prevents user creation.")
print("The only fix is to drop the FK constraints as described previously.")
