import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}
r = httpx.get(f'{SUPABASE_URL}/rest/v1/profiles?select=id&limit=1', headers=headers)
print('Profiles:', r.status_code, r.text)
