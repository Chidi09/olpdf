import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}', 'Prefer': 'return=representation'}

# Insert a document with owner_id inside JSON
payload = {
    "title": "Bypass Test",
    "document_model": {"meta": {"title": "Bypass Test"}, "blocks": [], "owner_id": "test-user-123"},
    "status": "ready"
}
r = httpx.post(f'{SUPABASE_URL}/rest/v1/documents', headers=headers, json=payload)
print('Insert:', r.status_code, r.text[:200])

if r.status_code == 201:
    headers.pop('Prefer', None)
    # PostgREST JSON querying
    r2 = httpx.get(f'{SUPABASE_URL}/rest/v1/documents?document_model-%3E%3Eowner_id=eq.test-user-123', headers=headers)
    print('Query by JSON:', r2.status_code, r2.text[:200])
