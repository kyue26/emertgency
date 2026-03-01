#!/bin/bash
# Camps API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./camps-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
EVENTS_URL="http://localhost:3000/events"
BASE_URL="http://localhost:3000/camps"
FAKE_EVENT_ID="evt_nonexistent_12345"
FAKE_CAMP_ID="cmp_nonexistent_12345"

TEST_EMAIL="commander.camps@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.camps@pennmert.org"
MEMBER_PASSWORD="MemberPass123!"

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
REGISTER_BODY=$(echo "$REGISTER_RESP" | sed '$d')
if [[ "$REGISTER_HTTP" != "201" && "$REGISTER_HTTP" != "409" ]]; then
  echo "Register failed ($REGISTER_HTTP): $REGISTER_BODY"
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
echo "Token obtained. Commander ID: $COMMANDER_PROF_ID"

# =============================================================================
# SETUP: Register Member
# =============================================================================
echo ""
echo "=== SETUP: Register MERT Member ==="
MEMBER_REG_RESP=$(curl -s -w "\n%{http_code}" -X POST "$AUTH_URL/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Member\",
    \"email\": \"$MEMBER_EMAIL\",
    \"password\": \"$MEMBER_PASSWORD\",
    \"role\": \"MERT Member\"
  }")
MEMBER_REG_HTTP=$(echo "$MEMBER_REG_RESP" | tail -n1)
if [[ "$MEMBER_REG_HTTP" != "201" && "$MEMBER_REG_HTTP" != "409" ]]; then
  echo "Member register failed ($MEMBER_REG_HTTP)"
  exit 1
fi
MEMBER_LOGIN_RESP=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\"}")
TOKEN2=$(echo "$MEMBER_LOGIN_RESP" | jq -r '.token')
MEMBER_PROF_ID=$(echo "$MEMBER_LOGIN_RESP" | jq -r '.user.professional_id')
echo "Member ID: $MEMBER_PROF_ID"

# =============================================================================
# SETUP: Create and start event (camps require active event)
# =============================================================================
echo ""
echo "=== SETUP: Create event ==="
CREATE_RESP=$(curl -s -X POST "$EVENTS_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440010")" \
  -d '{
    "name": "Camps Test Drill",
    "location": "Franklin Field",
    "start_time": "2025-04-15T09:00:00.000Z",
    "finish_time": "2025-04-15T17:00:00.000Z",
    "status": "upcoming"
  }')
EVT_ID=$(echo "$CREATE_RESP" | jq -r '.event.event_id')
INVITE_CODE=$(echo "$CREATE_RESP" | jq -r '.event.invite_code')
if [[ -z "$EVT_ID" || "$EVT_ID" == "null" ]]; then
  echo "Create event failed: $CREATE_RESP"
  exit 1
fi
echo "Event: $EVT_ID, invite_code: $INVITE_CODE"

echo "=== SETUP: Start event ==="
curl -s -X POST "$EVENTS_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | jq -c '.success'

# =============================================================================
# FAIL: POST /camps - Non-existent event (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: POST /camps - Non-existent eventId (expect 404) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"eventId\": \"$FAKE_EVENT_ID\",
    \"locationName\": \"Triage X\",
    \"capacity\": 5
  }" | jq .

# =============================================================================
# FAIL: POST /camps - Missing eventId (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /camps - Missing eventId (expect 400) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationName": "Triage X", "capacity": 5}' | jq .

# =============================================================================
# FAIL: POST /camps - Missing locationName (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /camps - Missing locationName (expect 400) ==="
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\": \"$EVT_ID\", \"capacity\": 5}" | jq .

# =============================================================================
# 1. POST /camps - Create multiple camps for single event
# =============================================================================
echo ""
echo "=== 1. POST /camps - Create Triage A ==="
CAMP_CREATE=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440011")" \
  -d "{
    \"eventId\": \"$EVT_ID\",
    \"locationName\": \"Triage A\",
    \"capacity\": 5
  }")
CAMP_ID=$(echo "$CAMP_CREATE" | jq -r '.camp.camp_id')
echo "$CAMP_CREATE" | jq .
if [[ -z "$CAMP_ID" || "$CAMP_ID" == "null" ]]; then
  echo "Create camp failed: $CAMP_CREATE"
  exit 1
fi

echo ""
echo "=== 2. POST /camps - Create Treatment B ==="
CAMP_CREATE2=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440012")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"location_name\": \"Treatment B\",
    \"capacity\": 10
  }")
CAMP_ID2=$(echo "$CAMP_CREATE2" | jq -r '.camp.camp_id')
echo "$CAMP_CREATE2" | jq -c '.success, .camp.location_name'

echo ""
echo "=== 3. POST /camps - Create Transport C ==="
CAMP_CREATE3=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440013")" \
  -d "{\"eventId\": \"$EVT_ID\", \"locationName\": \"Transport C\", \"capacity\": 3}")
CAMP_ID3=$(echo "$CAMP_CREATE3" | jq -r '.camp.camp_id')
echo "$CAMP_CREATE3" | jq -c '.success, .camp.location_name'

echo ""
echo "=== 4. POST /camps - Create Staging D (no capacity) ==="
CAMP_CREATE4=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440014")" \
  -d "{\"eventId\": \"$EVT_ID\", \"locationName\": \"Staging D\"}")
CAMP_ID4=$(echo "$CAMP_CREATE4" | jq -r '.camp.camp_id')
echo "$CAMP_CREATE4" | jq -c '.success, .camp.location_name'

echo ""
echo "=== 5. POST /camps - Create Command Post ==="
CAMP_CREATE5=$(curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440015")" \
  -d "{\"eventId\": \"$EVT_ID\", \"locationName\": \"Command Post\", \"capacity\": 20}")
CAMP_ID5=$(echo "$CAMP_CREATE5" | jq -r '.camp.camp_id')
echo "$CAMP_CREATE5" | jq -c '.success, .camp.location_name'

# =============================================================================
# 6. GET /camps - List all camps
# =============================================================================
echo ""
echo "=== 6. GET /camps (all) ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 6b. GET /camps?eventId=$EVT_ID (filter by event) ==="
curl -s -X GET "$BASE_URL?eventId=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /camps/:id - Wrong eventId (expect 404)
# Camp exists but belongs to EVT_ID; we pass fake event
# =============================================================================
echo ""
echo "=== FAIL: GET /camps/$CAMP_ID?eventId=$FAKE_EVENT_ID (wrong event, expect 404) ==="
curl -s -X GET "$BASE_URL/$CAMP_ID?eventId=$FAKE_EVENT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /camps/:id - Non-existent camp (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /camps/$FAKE_CAMP_ID (non-existent camp, expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_CAMP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 7. GET /camps/:id - Get camp by ID (success)
# =============================================================================
echo ""
echo "=== 7. GET /camps/$CAMP_ID ==="
curl -s -X GET "$BASE_URL/$CAMP_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 7b. GET /camps/$CAMP_ID?eventId=$EVT_ID ==="
curl -s -X GET "$BASE_URL/$CAMP_ID?eventId=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: PUT /camps/:id - Missing eventId (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: PUT /camps/$CAMP_ID - Missing eventId (expect 400) ==="
curl -s -X PUT "$BASE_URL/$CAMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locationName": "Triage A - Bad"}' | jq .

# =============================================================================
# FAIL: PUT /camps/:id - Wrong eventId (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: PUT /camps/$CAMP_ID - Wrong eventId (expect 404) ==="
curl -s -X PUT "$BASE_URL/$CAMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\": \"$FAKE_EVENT_ID\", \"locationName\": \"Triage A - Bad\"}" | jq .

# =============================================================================
# 8. PUT /camps/:id - Update camp (success)
# =============================================================================
echo ""
echo "=== 8. PUT /camps/$CAMP_ID - Update ==="
curl -s -X PUT "$BASE_URL/$CAMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440016")" \
  -d "{
    \"eventId\": \"$EVT_ID\",
    \"locationName\": \"Triage A - Updated\",
    \"capacity\": 8
  }" | jq .

# =============================================================================
# 9. Member joins event with camp_id (assigns member to Triage A)
# =============================================================================
echo ""
echo "=== 9. POST /events/join with camp_id (member -> Triage A) ==="
curl -s -X POST "$EVENTS_URL/join" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\", \"camp_id\": \"$CAMP_ID\"}" | jq .

# =============================================================================
# FAIL: PUT /camps/:id - Reduce capacity below assigned count (expect 400)
# Triage A has 1 member, capacity 8. Try to set capacity to 0.
# =============================================================================
echo ""
echo "=== FAIL: PUT /camps/$CAMP_ID - Capacity below assigned (expect 400) ==="
curl -s -X PUT "$BASE_URL/$CAMP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\": \"$EVT_ID\", \"capacity\": 0}" | jq .

# =============================================================================
# FAIL: DELETE /camps/:id - Missing eventId (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /camps/$CAMP_ID - Missing eventId (expect 400) ==="
curl -s -X DELETE "$BASE_URL/$CAMP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: DELETE /camps/:id - Wrong eventId (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /camps/$CAMP_ID?eventId=$FAKE_EVENT_ID (wrong event, expect 404) ==="
curl -s -X DELETE "$BASE_URL/$CAMP_ID?eventId=$FAKE_EVENT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: DELETE /camps/:id - Camp has member, no force (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /camps/$CAMP_ID (has member, no force, expect 400) ==="
curl -s -X DELETE "$BASE_URL/$CAMP_ID?eventId=$EVT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 10. DELETE /camps - Delete empty camps first
# =============================================================================
echo ""
echo "=== 10. DELETE /camps/$CAMP_ID2 (empty camp) ==="
curl -s -X DELETE "$BASE_URL/$CAMP_ID2?eventId=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 10b. DELETE /camps/$CAMP_ID3, $CAMP_ID4, $CAMP_ID5 (empty camps) ==="
curl -s -X DELETE "$BASE_URL/$CAMP_ID3?eventId=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$BASE_URL/$CAMP_ID4?eventId=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$BASE_URL/$CAMP_ID5?eventId=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

# =============================================================================
# 11. DELETE /camps/:id - Delete camp with member (force=true)
# =============================================================================
echo ""
echo "=== 11. DELETE /camps/$CAMP_ID?eventId=$EVT_ID&force=true (has member) ==="
curl -s -X DELETE "$BASE_URL/$CAMP_ID?eventId=$EVT_ID&force=true" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: POST /camps - Finished event (expect 400)
# Create second event, stop it, try to add camp
# =============================================================================
echo ""
echo "=== FAIL: POST /camps - Finished event (expect 400) ==="
EVT2_RESP=$(curl -s -X POST "$EVENTS_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440020")" \
  -d "{
    \"name\": \"Finished Event Test\",
    \"location\": \"Franklin Field\",
    \"status\": \"upcoming\"
  }")
EVT2_ID=$(echo "$EVT2_RESP" | jq -r '.event.event_id // empty')
curl -s -X POST "$EVENTS_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENTS_URL/stop" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$BASE_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\": \"$EVT2_ID\", \"locationName\": \"Camp in finished event\"}" | jq .

# =============================================================================
# CLEANUP: Leave events, delete events, delete users
# =============================================================================
echo ""
echo "=== CLEANUP: Leave events, delete events ==="
curl -s -X POST "$EVENTS_URL/leave" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" | jq -c '.success'
curl -s -X POST "$EVENTS_URL/leave" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" | jq -c '.success'
curl -s -X DELETE "$EVENTS_URL/delete/$EVT_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
[[ -n "$EVT2_ID" && "$EVT2_ID" != "null" ]] && curl -s -X DELETE "$EVENTS_URL/delete/$EVT2_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== CLEANUP: Delete test users ==="
echo "Deleting member $MEMBER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
echo "Deleting commander $COMMANDER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
