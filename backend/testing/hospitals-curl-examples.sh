#!/bin/bash
# Hospitals API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./hospitals-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
BASE_URL="http://localhost:3000/hospitals"
FAKE_HOSP_ID="99999"

TEST_EMAIL="commander.hospitals@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.hospitals@pennmert.org"
MEMBER_PASSWORD="MemberPass123!"

# =============================================================================
# SETUP: Register Commander and Member
# =============================================================================
echo "=== SETUP: Register Commander ==="
REGISTER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Commander\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"role\": \"Commander\"
  }")
if [[ $(echo "$REGISTER_RESP" | tail -n1) != "201" && $(echo "$REGISTER_RESP" | tail -n1) != "409" ]]; then
  echo "Register failed"
  exit 1
fi

echo "=== SETUP: Login ==="
LOGIN_RESP=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")
if ! command -v jq &>/dev/null; then
  echo "jq required. Install: brew install jq"
  exit 1
fi
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token')
COMMANDER_PROF_ID=$(echo "$LOGIN_RESP" | jq -r '.user.professional_id')
if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "Login failed: $LOGIN_RESP"
  exit 1
fi

echo ""
echo "=== SETUP: Register Member ==="
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Member\", \"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\", \"role\": \"MERT Member\"}" >/dev/null
MEMBER_LOGIN=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" \
  -d "{\"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\"}")
TOKEN2=$(echo "$MEMBER_LOGIN" | jq -r '.token')
MEMBER_PROF_ID=$(echo "$MEMBER_LOGIN" | jq -r '.user.professional_id')
echo "Commander: $COMMANDER_PROF_ID, Member: $MEMBER_PROF_ID"

# =============================================================================
# 1. GET /hospitals - List all
# =============================================================================
echo ""
echo "=== 1. GET /hospitals ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 1b. GET /hospitals?isActive=true ==="
curl -s -X GET "$BASE_URL?isActive=true" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 1c. GET /hospitals?isActive=false ==="
curl -s -X GET "$BASE_URL?isActive=false" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 2. GET /hospitals/:id - Get single (use first existing)
# =============================================================================
echo ""
echo "=== 2. GET /hospitals/:id ==="
FIRST_HOSP_ID=$(curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq -r '.hospitals[0].hospital_id')
if [[ -n "$FIRST_HOSP_ID" && "$FIRST_HOSP_ID" != "null" ]]; then
  curl -s -X GET "$BASE_URL/$FIRST_HOSP_ID" -H "Authorization: Bearer $TOKEN" | jq .
else
  echo "No hospitals found, skipping"
fi

# =============================================================================
# FAIL: GET /hospitals/:id - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /hospitals/$FAKE_HOSP_ID (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_HOSP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 3. POST /hospitals - Create (Commander or Medical Officer only)
# =============================================================================
echo ""
echo "=== 3. POST /hospitals (Commander creates) ==="
CREATE_RESP=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Trauma Center",
    "distance": "3.2 miles",
    "traumaLevel": 1,
    "capacity": 50,
    "contact_number": "+1-555-123-4567",
    "address": "123 Test St",
    "isActive": true
  }')
HOSP_ID=$(echo "$CREATE_RESP" | jq -r '.hospital.hospital_id')
echo "$CREATE_RESP" | jq .
if [[ -z "$HOSP_ID" || "$HOSP_ID" == "null" ]]; then
  echo "Create hospital failed: $CREATE_RESP"
  exit 1
fi

# =============================================================================
# FAIL: POST /hospitals - Member cannot create (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: POST /hospitals (Member creates, expect 403) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"name": "Unauthorized Hospital"}' | jq .

# =============================================================================
# FAIL: POST /hospitals - Missing name (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /hospitals (Missing name, expect 400) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "distance": "5 miles",
    "traumaLevel": 2
  }' | jq .

# =============================================================================
# 4. PUT /hospitals/:id - Update
# =============================================================================
echo ""
echo "=== 4. PUT /hospitals/$HOSP_ID (Commander updates) ==="
curl -s -X PUT "$BASE_URL/$HOSP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Trauma Center (Updated)",
    "capacity": 75,
    "is_active": true
  }' | jq .

# =============================================================================
# FAIL: PUT /hospitals/:id - Member cannot update (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: PUT /hospitals/$HOSP_ID (Member updates, expect 403) ==="
curl -s -X PUT "$BASE_URL/$HOSP_ID" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked Name"}' | jq .

# =============================================================================
# 5. GET /hospitals/:id - Verify update
# =============================================================================
echo ""
echo "=== 5. GET /hospitals/$HOSP_ID (verify update) ==="
curl -s -X GET "$BASE_URL/$HOSP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 6. DELETE /hospitals/:id - Commander only
# =============================================================================
echo ""
echo "=== 6. DELETE /hospitals/$HOSP_ID (Commander deletes) ==="
curl -s -X DELETE "$BASE_URL/$HOSP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: DELETE - Member cannot delete (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /hospitals (Member creates then deletes - Member cannot delete) ==="
# Create another hospital as Commander first
CREATE2=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Temp Hospital for Delete Test"}')
HOSP_ID2=$(echo "$CREATE2" | jq -r '.hospital.hospital_id')
echo "Member tries to delete (expect 403):"
curl -s -X DELETE "$BASE_URL/$HOSP_ID2" -H "Authorization: Bearer $TOKEN2" | jq .
# Clean up - Commander deletes
curl -s -X DELETE "$BASE_URL/$HOSP_ID2" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

# =============================================================================
# FAIL: DELETE - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /hospitals/$FAKE_HOSP_ID (expect 404) ==="
curl -s -X DELETE "$BASE_URL/$FAKE_HOSP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Delete test users
# =============================================================================
echo ""
echo "=== CLEANUP: Delete test users ==="
curl -s -X DELETE "$AUTH_URL/delete/$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
