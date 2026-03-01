#!/bin/bash
# Casualties API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./casualties-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
EVENT_URL="http://localhost:3000/event"
CAMPS_URL="http://localhost:3000/camps"
BASE_URL="http://localhost:3000/casualties"
FAKE_EVENT_ID="evt_nonexistent_12345"
FAKE_CAMP_ID="cmp_nonexistent_12345"
FAKE_CASUALTY_ID="inj_nonexistent_12345"

TEST_EMAIL="commander.casualties@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.casualties@pennmert.org"
MEMBER_PASSWORD="MemberPass123!"
OUTSIDER_EMAIL="outsider.casualties@pennmert.org"
OUTSIDER_PASSWORD="OutsiderPass123!"

# =============================================================================
# SETUP: Register Commander and login
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
REGISTER_HTTP=$(echo "$REGISTER_RESP" | tail -n1)
if [[ "$REGISTER_HTTP" != "201" && "$REGISTER_HTTP" != "409" ]]; then
  echo "Register failed ($REGISTER_HTTP)"
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
echo "Commander ID: $COMMANDER_PROF_ID"

# =============================================================================
# SETUP: Register Member (joins event, has access)
# =============================================================================
echo ""
echo "=== SETUP: Register Member ==="
MEMBER_REG=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Member\",
    \"email\": \"$MEMBER_EMAIL\",
    \"password\": \"$MEMBER_PASSWORD\",
    \"role\": \"MERT Member\"
  }")
if [[ $(echo "$MEMBER_REG" | tail -n1) != "201" && $(echo "$MEMBER_REG" | tail -n1) != "409" ]]; then
  echo "Member register failed"
  exit 1
fi
MEMBER_LOGIN=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\"}")
TOKEN2=$(echo "$MEMBER_LOGIN" | jq -r '.token')
MEMBER_PROF_ID=$(echo "$MEMBER_LOGIN" | jq -r '.user.professional_id')
echo "Member ID: $MEMBER_PROF_ID"

# =============================================================================
# SETUP: Register Outsider (never joins event - for 403 access tests)
# =============================================================================
echo ""
echo "=== SETUP: Register Outsider ==="
OUTSIDER_REG=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Outsider\",
    \"email\": \"$OUTSIDER_EMAIL\",
    \"password\": \"$OUTSIDER_PASSWORD\",
    \"role\": \"MERT Member\"
  }")
if [[ $(echo "$OUTSIDER_REG" | tail -n1) != "201" && $(echo "$OUTSIDER_REG" | tail -n1) != "409" ]]; then
  echo "Outsider register failed"
  exit 1
fi
OUTSIDER_LOGIN=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$OUTSIDER_EMAIL\", \"password\": \"$OUTSIDER_PASSWORD\"}")
TOKEN3=$(echo "$OUTSIDER_LOGIN" | jq -r '.token')
OUTSIDER_PROF_ID=$(echo "$OUTSIDER_LOGIN" | jq -r '.user.professional_id')
echo "Outsider ID: $OUTSIDER_PROF_ID"

# =============================================================================
# SETUP: Create event, start it, create camps, Member joins
# =============================================================================
echo ""
echo "=== SETUP: Create event ==="
EVT_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440030")" \
  -d '{
    "name": "Casualties Test Drill",
    "location": "Franklin Field",
    "status": "upcoming"
  }')
EVT_ID=$(echo "$EVT_RESP" | jq -r '.event.event_id')
INVITE_CODE=$(echo "$EVT_RESP" | jq -r '.event.invite_code')
if [[ -z "$EVT_ID" || "$EVT_ID" == "null" ]]; then
  echo "Create event failed: $EVT_RESP"
  exit 1
fi
echo "Event: $EVT_ID"

curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null

echo "=== SETUP: Create camps ==="
CAMP1_RESP=$(curl -s -X POST "$CAMPS_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440031")" \
  -d "{\"eventId\": \"$EVT_ID\", \"locationName\": \"Triage A\", \"capacity\": 10}")
CAMP_ID=$(echo "$CAMP1_RESP" | jq -r '.camp.camp_id')

CAMP2_RESP=$(curl -s -X POST "$CAMPS_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440032")" \
  -d "{\"eventId\": \"$EVT_ID\", \"locationName\": \"Treatment B\", \"capacity\": 5}")
CAMP_ID2=$(echo "$CAMP2_RESP" | jq -r '.camp.camp_id')

echo "=== SETUP: Member joins event with camp ==="
curl -s -X POST "$EVENT_URL/join" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\", \"camp_id\": \"$CAMP_ID\"}" >/dev/null

# =============================================================================
# FAIL: POST /casualties - Missing event_id (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /casualties - Missing event_id (expect 400) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"color": "red"}' | jq .

# =============================================================================
# FAIL: POST /casualties - Non-existent event (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: POST /casualties - Non-existent event (expect 404) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$FAKE_EVENT_ID\", \"color\": \"red\"}" | jq .

# =============================================================================
# FAIL: POST /casualties - Invalid color (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /casualties - Invalid color (expect 400) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT_ID\", \"color\": \"purple\"}" | jq .

# =============================================================================
# FAIL: POST /casualties - Camp not found (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: POST /casualties - Camp not found (expect 404) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT_ID\", \"camp_id\": \"$FAKE_CAMP_ID\", \"color\": \"red\"}" | jq .

# =============================================================================
# 1. POST /casualties - Create multiple casualties
# =============================================================================
echo ""
echo "=== 1. POST /casualties - Create red casualty (no camp) ==="
CAS1_RESP=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440050")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"color\": \"red\",
    \"breathing\": true,
    \"conscious\": false,
    \"bleeding\": true
  }")
CAS_ID=$(echo "$CAS1_RESP" | jq -r '.casualty.injured_person_id')
echo "$CAS1_RESP" | jq .
if [[ -z "$CAS_ID" || "$CAS_ID" == "null" ]]; then
  echo "Create casualty failed: $CAS1_RESP"
  exit 1
fi

echo ""
echo "=== 2. POST /casualties - Create yellow casualty (with camp) ==="
CAS2_RESP=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440051")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"camp_id\": \"$CAMP_ID\",
    \"color\": \"yellow\",
    \"breathing\": true,
    \"conscious\": true,
    \"bleeding\": false
  }")
CAS_ID2=$(echo "$CAS2_RESP" | jq -r '.casualty.injured_person_id')
echo "$CAS2_RESP" | jq -c '.success, .casualty.color, .casualty.camp_id'

echo ""
echo "=== 3. POST /casualties - Create green casualty (Member creates) ==="
CAS3_RESP=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440052")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"camp_id\": \"$CAMP_ID\",
    \"color\": \"green\",
    \"breathing\": true,
    \"conscious\": true
  }")
CAS_ID3=$(echo "$CAS3_RESP" | jq -r '.casualty.injured_person_id')
echo "$CAS3_RESP" | jq -c '.success, .casualty.color'

echo ""
echo "=== 4. POST /casualties - Create black casualty ==="
CAS4_RESP=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440053")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"color\": \"black\",
    \"breathing\": false,
    \"conscious\": false
  }")
CAS_ID4=$(echo "$CAS4_RESP" | jq -r '.casualty.injured_person_id')
echo "$CAS4_RESP" | jq -c '.success, .casualty.color'

# =============================================================================
# 5. GET /casualties - List
# =============================================================================
echo ""
echo "=== 5. GET /casualties ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 5b. GET /casualties?event_id=$EVT_ID ==="
curl -s -X GET "$BASE_URL?event_id=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 5c. GET /casualties?camp_id=$CAMP_ID ==="
curl -s -X GET "$BASE_URL?camp_id=$CAMP_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 5d. GET /casualties?color=red ==="
curl -s -X GET "$BASE_URL?color=red" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 5e. GET /casualties?event_id=$EVT_ID&page=1&limit=2 ==="
curl -s -X GET "$BASE_URL?event_id=$EVT_ID&page=1&limit=2" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 6. GET /casualties/statistics
# =============================================================================
echo ""
echo "=== 6. GET /casualties/statistics ==="
curl -s -X GET "$BASE_URL/statistics" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 6b. GET /casualties/statistics?event_id=$EVT_ID ==="
curl -s -X GET "$BASE_URL/statistics?event_id=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /casualties/:id - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /casualties/$FAKE_CASUALTY_ID (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_CASUALTY_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /casualties/:id - Outsider has no access (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: GET /casualties/$CAS_ID (Outsider, expect 403) ==="
curl -s -X GET "$BASE_URL/$CAS_ID" -H "Authorization: Bearer $TOKEN3" | jq .

# =============================================================================
# 7. GET /casualties/:casualtyId - Success
# =============================================================================
echo ""
echo "=== 7. GET /casualties/$CAS_ID ==="
curl -s -X GET "$BASE_URL/$CAS_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 8. PUT /casualties/update/:casualtyId/status - Update
# =============================================================================
echo ""
echo "=== 8. PUT /casualties/update/$CAS_ID/status ==="
curl -s -X PUT "$BASE_URL/update/$CAS_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440033")" \
  -d '{
    "color": "yellow",
    "hospital_status": "Transported to HUP",
    "breathing": true,
    "conscious": true
  }' | jq .

# =============================================================================
# 9. PUT /casualties/:casualtyId - Transfer to different camp
# =============================================================================
echo ""
echo "=== 9. PUT /casualties/$CAS_ID2 - Transfer camp ==="
curl -s -X PUT "$BASE_URL/$CAS_ID2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"camp_id\": \"$CAMP_ID2\"}" | jq .

# =============================================================================
# FAIL: PUT - Camp in different event (we only have one event, so use fake camp)
# =============================================================================
echo ""
echo "=== FAIL: PUT /casualties/$CAS_ID - Camp not in event (expect 400) ==="
curl -s -X PUT "$BASE_URL/$CAS_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"camp_id\": \"$FAKE_CAMP_ID\"}" | jq .

# =============================================================================
# FAIL: PUT - No changes (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: PUT /casualties/$CAS_ID - No changes (expect 400) ==="
curl -s -X PUT "$BASE_URL/$CAS_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"color\": \"yellow\"}" | jq .

# =============================================================================
# 10. GET /casualties/:casualtyId/history
# =============================================================================
echo ""
echo "=== 10. GET /casualties/$CAS_ID/history ==="
curl -s -X GET "$BASE_URL/$CAS_ID/history" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: DELETE - Member cannot delete Commander's casualty (expect 403)
# CAS_ID created by Commander
# =============================================================================
echo ""
echo "=== FAIL: DELETE /casualties/$CAS_ID (Member deletes Commander's, expect 403) ==="
curl -s -X DELETE "$BASE_URL/$CAS_ID" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 11. DELETE - Member deletes own casualty (CAS_ID3)
# =============================================================================
echo ""
echo "=== 11. DELETE /casualties/$CAS_ID3 (Member deletes own) ==="
curl -s -X DELETE "$BASE_URL/$CAS_ID3" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# FAIL: POST /casualties - Finished event (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /casualties - Finished event (expect 400) ==="
EVT2_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440040")" \
  -d '{"name": "Finished Event", "status": "upcoming"}')
EVT2_ID=$(echo "$EVT2_RESP" | jq -r '.event.event_id // empty')
curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/stop" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT2_ID\", \"color\": \"red\"}" | jq .

# =============================================================================
# 12. DELETE - Commander deletes remaining casualties (before event stop)
# =============================================================================
echo ""
echo "=== 12. DELETE /casualties (Commander deletes remaining) ==="
curl -s -X DELETE "$BASE_URL/$CAS_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$BASE_URL/$CAS_ID2" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$BASE_URL/$CAS_ID4" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

# =============================================================================
# FAIL: PUT/DELETE - Finished event (expect 400)
# Create EVT3, add casualty, stop, then try to modify/delete
# =============================================================================
echo ""
echo "=== FAIL: PUT/DELETE casualty in finished event (expect 400) ==="
EVT3_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440041")" \
  -d '{"name": "Event For Finished Test", "status": "upcoming"}')
EVT3_ID=$(echo "$EVT3_RESP" | jq -r '.event.event_id // empty')
curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
CAS_FIN_RESP=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440054")" \
  -d "{\"event_id\": \"$EVT3_ID\", \"color\": \"green\"}")
CAS_FIN_ID=$(echo "$CAS_FIN_RESP" | jq -r '.casualty.injured_person_id // empty')
curl -s -X POST "$EVENT_URL/stop" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X PUT "$BASE_URL/$CAS_FIN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"color": "yellow"}' | jq .
curl -s -X DELETE "$BASE_URL/$CAS_FIN_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Leave events, delete events, delete users
# =============================================================================
echo ""
echo "=== CLEANUP: Leave events, delete events ==="
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" >/dev/null
curl -s -X DELETE "$EVENT_URL/delete/$EVT_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
[[ -n "$EVT2_ID" && "$EVT2_ID" != "null" ]] && curl -s -X DELETE "$EVENT_URL/delete/$EVT2_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
[[ -n "$EVT3_ID" && "$EVT3_ID" != "null" ]] && curl -s -X DELETE "$EVENT_URL/delete/$EVT3_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== CLEANUP: Delete test users ==="
echo "Deleting outsider $OUTSIDER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$OUTSIDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
echo "Deleting member $MEMBER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
echo "Deleting commander $COMMANDER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
