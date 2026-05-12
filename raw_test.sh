#!/bin/bash
BASE="http://localhost:8003"
EMAIL="test-raw-$(date +%s)@olpdf.xyz"
PASS="TestPass123!"

S=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"T\"}")
T=$(echo "$S" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

echo "=== Create Doc (RAW) ==="
curl -s -X POST "$BASE/api/documents/create" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"meta":{"title":"Test"},"blocks":[]}'
echo ""

echo "=== Save AI (RAW) ==="
curl -s -X PUT "$BASE/api/ai-settings" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"provider":"gemini_free","model":"gemini-2.5-flash"}'
echo ""

echo "=== Create API Key (RAW) ==="
curl -s -X POST "$BASE/api/keys" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"name":"TestKey","scopes":["documents:read"]}'
echo ""

echo "=== List Docs (RAW) ==="
curl -s "$BASE/api/documents" -H "Authorization: Bearer $T"
echo ""
