"""Query FK constraint details via information_schema REST API."""
import os, sys, httpx, json

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Accept": "application/json",
}

# Query information_schema for FK constraints referencing profiles.id
# This only works if information_schema is exposed
print("=== FK constraints referencing profiles ===")
r = httpx.get(f"{SUPABASE_URL}/rest/v1/information_schema.table_constraints", headers=headers,
    params={
        "constraint_type": "eq.FOREIGN KEY",
        "table_schema": "eq.public",
        "order": "constraint_name.asc",
    })
if r.status_code == 200:
    constraints = r.json()
    for c in constraints:
        print(f"  {c.get('constraint_name')} on {c.get('table_schema')}.{c.get('table_name')}")
else:
    print(f"Error: {r.status_code} - {r.text[:300]}")

# Query referential_constraints for details
print("\n=== Referential constraint details ===")
r = httpx.get(f"{SUPABASE_URL}/rest/v1/information_schema.referential_constraints", headers=headers,
    params={
        "constraint_schema": "eq.public",
        "order": "constraint_name.asc",
    })
if r.status_code == 200:
    details = r.json()
    for d in details:
        print(f"  {d.get('constraint_name')}: {d.get('update_rule')} / {d.get('delete_rule')}")
        if 'constraint_name' in d and 'profiles' in d.get('constraint_name',''):
            print(f"    UNIQUE_CONSTRAINT_SCHEMA: {d.get('unique_constraint_schema')}")
            print(f"    UNIQUE_CONSTRAINT_NAME: {d.get('unique_constraint_name')}")
else:
    print(f"Error: {r.status_code} - {r.text[:300]}")

# Direct query using /rest/v1/rpc/ to call a pg_catalog function
# This is a long shot but might work if the function exists
print("\n=== Trying pg_catalog via rpc ===")
r2 = httpx.get(f"{SUPABASE_URL}/rest/v1/rpc/", headers=headers)
print(f"RPC directory: {r2.status_code}")

if r2.status_code == 200:
    print(f"Functions: {json.dumps(r2.json(), indent=2)[:500]}")

# LAST RESORT: check what user table is accessible
print(f"\n=== Checking accessible tables ===")
for tbl in ["user", "users", "auth.users"]:
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/{tbl}", headers=headers, params={"limit": "1"})
    print(f"  /rest/v1/{tbl}: {r.status_code} - {r.text[:100]}")
