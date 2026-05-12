import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}

# Try inserting into books without user_id
payload = {
    "title": "Null Test",
    "meta": {"title": "Null Test"}
}
r = httpx.post(f'{SUPABASE_URL}/rest/v1/books', headers=headers, json=payload)
print('Books NULL test:', r.status_code, r.text)
