import os, httpx, json
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
headers = {'apikey': SUPABASE_KEY, 'Authorization': f'Bearer {SUPABASE_KEY}'}

# Try inserting into documents without user_id
payload = {
    "title": "Null Test",
    "document_model": {"meta": {"title": "Null Test"}, "blocks": []},
    "status": "ready"
}
r = httpx.post(f'{SUPABASE_URL}/rest/v1/documents', headers=headers, json=payload)
print('Documents NULL test:', r.status_code, r.text)

# Try user_ai_settings without user_id
r2 = httpx.post(f'{SUPABASE_URL}/rest/v1/user_ai_settings', headers=headers, json={"provider": "gemini_free"})
print('AI settings NULL test:', r2.status_code, r2.text)
