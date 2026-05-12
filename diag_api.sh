#!/bin/bash
BASE="http://localhost:8003"
EMAIL="test-diag-$(date +%s)@olpdf.xyz"
PASS="TestPass123!"

S=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test\"}")
T=$(echo "$S" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Token OK: ${#T} chars"

echo "=== GET /api/documents ==="
curl -s "$BASE/api/documents" -H "Authorization: Bearer $T" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: OK - {len(d)} documents')" 2>/dev/null || echo "FAILED"

echo "=== GET /api/ai-settings ==="
curl -s "$BASE/api/ai-settings" -H "Authorization: Bearer $T" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: provider={d.get(\"provider\")}')" 2>/dev/null || echo "FAILED"

echo "=== GET /api/keys ==="
curl -s "$BASE/api/keys" -H "Authorization: Bearer $T" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d)} keys')" 2>/dev/null || echo "FAILED"

echo "=== GET /api/books ==="
curl -s "$BASE/api/books" -H "Authorization: Bearer $T" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d)} books')" 2>/dev/null || echo "FAILED"

echo "=== POST create doc ==="
curl -s -X POST "$BASE/api/documents/create" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"meta":{"title":"Test"},"blocks":[]}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: id={d.get(\"id\",\"?\")}')" 2>/dev/null || echo "FAILED"
