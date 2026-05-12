#!/bin/bash
BASE=http://localhost:8003
EMAIL="test-v-$(date +%s)@olpdf.xyz"
PASS="TestPass123!"

echo "=== Signup ==="
S=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test\"}")
T=$(echo "$S" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
echo "Token: ${T:0:30}..."
echo "Signup response: $S"

echo "=== Create Document ==="
curl -sv -X POST "$BASE/api/documents/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T" \
  -d '{"meta":{"title":"Test"},"blocks":[]}' 2>&1

echo ""
echo "=== Save AI Settings ==="
curl -sv -X PUT "$BASE/api/ai-settings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T" \
  -d '{"provider":"gemini_free","model":"gemini-2.5-flash"}' 2>&1

echo ""
echo "=== API Key ==="
curl -sv -X POST "$BASE/api/keys" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $T" \
  -d '{"name":"TestKey","scopes":["documents:read"]}' 2>&1
