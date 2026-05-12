#!/bin/bash
EMAIL="test-debug-$(date +%s)@olpdf.xyz"
PASS="TestPass123!"
BASE="http://localhost:8001"

echo "=== Signup ==="
S=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test User\"}")
echo "$S"
T=$(echo "$S" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Token: ${T:0:30}..."

echo "=== Create Doc ==="
R=$(curl -sv -X POST "$BASE/api/documents/create" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"meta":{"title":"Test Doc"},"blocks":[]}' 2>&1)
echo "$R" | tail -20

echo "=== List Docs ==="
curl -s "$BASE/api/documents" -H "Authorization: Bearer $T"
echo ""

echo "=== API Key ==="
curl -sv -X POST "$BASE/api/keys" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"name":"TestKey","scopes":["documents:read"]}' 2>&1 | tail -10

echo "=== Save AI ==="
curl -sv -X PUT "$BASE/api/ai-settings" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"provider":"gemini_free","model":"gemini-2.5-flash"}' 2>&1 | tail -10

echo "=== List Docs Again ==="
curl -s "$BASE/api/documents" -H "Authorization: Bearer $T"
echo ""
