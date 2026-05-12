import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}

r = httpx.get(f'{SUPABASE_URL}/rest/v1/profiles?limit=1', headers=headers)
print('Profiles schema (from a row):', json.dumps(r.json(), indent=2))

# Let's try to insert a profile to see what columns are required
r2 = httpx.post(f'{SUPABASE_URL}/rest/v1/profiles', headers=headers, json={"id": "22c1ddd0-106e-4e33-a09e-e3be73dc3a36"})
print('Profiles insert test:', r2.status_code, r2.text)
