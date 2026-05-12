import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}

r = httpx.post(f'{SUPABASE_URL}/rest/v1/api_keys', headers=headers, json={"name": "Test Key", "prefix": "olp_123", "key_hash": "hash123"})
print('API keys NULL test:', r.status_code, r.text)
