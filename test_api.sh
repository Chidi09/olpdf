#!/bin/bash
BASE="http://localhost:8003"
EMAIL="test-$(date +%s)@olpdf.xyz"
PASS="TestPass123!"
P=0; F=0
pass() { P=$((P+1)); echo "  PASS: $1"; }
fail() { F=$((F+1)); echo "  FAIL: $1 - $2"; }

echo "=== 1. Health ==="
R=$(curl -sf "$BASE/health")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('status')=='healthy'" 2>/dev/null && pass "Health" || fail "Health" "$R"

echo "=== 2. Signup ==="
S=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Test User\"}")
T=$(echo "$S" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$T" ] && pass "Signup" || fail "Signup" "$S"

echo "=== 3. Login ==="
L=$(curl -sf -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
T=$(echo "$L" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
[ -n "$T" ] && pass "Login" || fail "Login" "$L"

echo "=== 4. Create Doc ==="
D=$(curl -sf -X POST "$BASE/api/documents/create" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"meta":{"title":"Test Doc"},"blocks":[]}')
DI=$(echo "$D" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$DI" ] && pass "Create (ID: $DI)" || fail "Create" "$D"

echo "=== 5. List Docs ==="
LST=$(curl -sf "$BASE/api/documents" -H "Authorization: Bearer $T")
C=$(echo "$LST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
[ "$C" -ge 1 ] && pass "List ($C docs)" || fail "List" "$LST"

echo "=== 6. Get Doc ==="
G=$(curl -sf "$BASE/api/documents/$DI" -H "Authorization: Bearer $T")
echo "$G" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id')=='$DI'" 2>/dev/null && pass "Get" || fail "Get" "$G"

echo "=== 7. Update Title ==="
PCH=$(curl -sf -X PATCH "$BASE/api/documents/$DI/title" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"title":"Updated Title"}')
echo "$PCH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('status')=='success'" 2>/dev/null && pass "Update title" || fail "Update" "$PCH"

echo "=== 8. AI Settings ==="
AI=$(curl -sf "$BASE/api/ai-settings" -H "Authorization: Bearer $T")
echo "$AI" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('provider')" 2>/dev/null && pass "AI settings" || fail "AI" "$AI"

echo "=== 9. Save AI ==="
AIS=$(curl -sf -X PUT "$BASE/api/ai-settings" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"provider":"gemini_free","model":"gemini-2.5-flash"}')
echo "$AIS" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('status')=='saved'" 2>/dev/null && pass "Save AI" || fail "Save AI" "$AIS"

echo "=== 10. API Key ==="
K=$(curl -sf -X POST "$BASE/api/keys" -H "Content-Type: application/json" -H "Authorization: Bearer $T" -d '{"name":"TestKey","scopes":["documents:read"]}')
KP=$(echo "$K" | python3 -c "import sys,json; print(json.load(sys.stdin).get('prefix',''))" 2>/dev/null)
[[ "$KP" == olp_* ]] && pass "API key ($KP)" || fail "API key" "$K"

echo "=== 11. Templates ==="
TPL=$(curl -sf "$BASE/templates/" -H "Authorization: Bearer $T")
echo "$TPL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d, list)" 2>/dev/null && pass "Templates" || fail "Templates" "$TPL"

echo "=== 12. Delete Doc ==="
curl -sf -X DELETE "$BASE/api/documents/$DI" -H "Authorization: Bearer $T" > /dev/null && pass "Delete" || fail "Delete" "error"

echo ""
echo "PASSED: $P/$((P+F))  FAILED: $F"
