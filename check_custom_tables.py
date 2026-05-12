import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}

r = httpx.get(f'{SUPABASE_URL}/rest/v1/user?limit=1', headers=headers)
print('User table:', r.status_code, r.text[:200])

r2 = httpx.get(f'{SUPABASE_URL}/rest/v1/account?limit=1', headers=headers)
print('Account table:', r2.status_code, r2.text[:200])
