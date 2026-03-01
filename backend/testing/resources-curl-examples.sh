#!/bin/bash
# Resources API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./resources-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
EVENT_URL="http://localhost:3000/event"
BASE_URL="http://localhost:3000/resources"
FAKE_RES_ID="res_nonexistent_12345"

TEST_EMAIL="commander.resources@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.resources@pennmert.org"
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
# SETUP: Create event, start it, Member joins (for access)
# =============================================================================
echo ""
echo "=== SETUP: Create event and start ==="
EVT_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440100")" \
  -d '{"name": "Resources Test Drill", "status": "upcoming"}')
EVT_ID=$(echo "$EVT_RESP" | jq -r '.event.event_id')
INVITE_CODE=$(echo "$EVT_RESP" | jq -r '.event.invite_code')
if [[ -z "$EVT_ID" || "$EVT_ID" == "null" ]]; then
  echo "Create event failed: $EVT_RESP"
  exit 1
fi
curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/join" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\"}" >/dev/null
echo "Event: $EVT_ID"

# =============================================================================
# FAIL: POST /resources/create - Missing event_id (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /resources/create - Missing event_id (expect 400) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440101")" \
  -d '{"resource_name": "Bandages"}' | jq .

# =============================================================================
# FAIL: POST /resources/create - Missing resource_name (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /resources/create - Missing resource_name (expect 400) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440102")" \
  -d "{\"event_id\": \"$EVT_ID\"}" | jq .

# =============================================================================
# 1. POST /resources/create - Commander creates resource
# =============================================================================
echo ""
echo "=== 1. POST /resources/create (Commander) ==="
RES1_RESP=$(curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440103")" \
  -d "{\"event_id\": \"$EVT_ID\", \"resource_name\": \"Bandages\", \"quantity\": 50, \"priority\": \"high\"}")
RES_ID=$(echo "$RES1_RESP" | jq -r '.resourceRequest.resource_request_id')
echo "$RES1_RESP" | jq .
if [[ -z "$RES_ID" || "$RES_ID" == "null" ]]; then
  echo "Create resource failed: $RES1_RESP"
  exit 1
fi

# =============================================================================
# 2. POST /resources/create - Member creates resource
# =============================================================================
echo ""
echo "=== 2. POST /resources/create (Member) ==="
RES2_RESP=$(curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440104")" \
  -d "{\"event_id\": \"$EVT_ID\", \"resource_name\": \"IV Fluids\", \"quantity\": 10, \"priority\": \"critical\"}")
RES_ID2=$(echo "$RES2_RESP" | jq -r '.resourceRequest.resource_request_id')
echo "$RES2_RESP" | jq .

# =============================================================================
# 3. GET /resources - List all
# =============================================================================
echo ""
echo "=== 3. GET /resources ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 3b. GET /resources?event_id=...&confirmed=false ==="
curl -s -X GET "$BASE_URL?event_id=$EVT_ID&confirmed=false" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 4. GET /resources/event/:eventId
# =============================================================================
echo ""
echo "=== 4. GET /resources/event/$EVT_ID ==="
curl -s -X GET "$BASE_URL/event/$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 5. GET /resources/:resourceRequestId - Get single
# =============================================================================
echo ""
echo "=== 5. GET /resources/$RES_ID ==="
curl -s -X GET "$BASE_URL/$RES_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /resources/:id - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /resources/$FAKE_RES_ID (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_RES_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 6. PUT /resources/update/:resourceRequestId - Commander updates
# =============================================================================
echo ""
echo "=== 6. PUT /resources/update/$RES_ID (Commander updates) ==="
curl -s -X PUT "$BASE_URL/update/$RES_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440105")" \
  -d '{"quantity": 75, "priority": "critical"}' | jq .

# =============================================================================
# 7. PUT /resources/update/:resourceRequestId - Member updates own
# =============================================================================
echo ""
echo "=== 7. PUT /resources/update/$RES_ID2 (Member updates own) ==="
curl -s -X PUT "$BASE_URL/update/$RES_ID2" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440106")" \
  -d '{"resource_name": "IV Fluids (Lactated Ringers)", "notes": "Urgent"}' | jq .

# =============================================================================
# FAIL: PUT /resources/update - Member cannot update Commander's resource (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: PUT /resources/update/$RES_ID (Member updates Commander's, expect 403) ==="
curl -s -X PUT "$BASE_URL/update/$RES_ID" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440107")" \
  -d '{"quantity": 999}' | jq .

# =============================================================================
# 8. PUT /resources/confirm/:resourceRequestId - Commander confirms
# =============================================================================
echo ""
echo "=== 8. PUT /resources/confirm/$RES_ID (Commander confirms) ==="
curl -s -X PUT "$BASE_URL/confirm/$RES_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440108")" \
  -d '{"confirmed": true, "time_of_arrival": "2025-04-15T10:30:00.000Z"}' | jq .

echo ""
echo "=== 8b. PUT /resources/confirm/$RES_ID2 (Commander confirms) ==="
curl -s -X PUT "$BASE_URL/confirm/$RES_ID2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440109")" \
  -d '{"confirmed": true}' | jq .

# =============================================================================
# 9. GET /resources/event/:eventId/summary
# =============================================================================
echo ""
echo "=== 9. GET /resources/event/$EVT_ID/summary ==="
curl -s -X GET "$BASE_URL/event/$EVT_ID/summary" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 10. PUT /resources/confirm - Unconfirm
# =============================================================================
echo ""
echo "=== 10. PUT /resources/confirm/$RES_ID2 (Unconfirm) ==="
curl -s -X PUT "$BASE_URL/confirm/$RES_ID2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440110")" \
  -d '{"confirmed": false}' | jq .

# =============================================================================
# 11. DELETE /resources/delete/:resourceRequestId - Member deletes own
# =============================================================================
echo ""
echo "=== 11. DELETE /resources/delete/$RES_ID2 (Member deletes own) ==="
curl -s -X DELETE "$BASE_URL/delete/$RES_ID2" \
  -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# FAIL: DELETE - Member cannot delete Commander's resource (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /resources/delete/$RES_ID (Member deletes Commander's, expect 403) ==="
curl -s -X DELETE "$BASE_URL/delete/$RES_ID" \
  -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 12. DELETE /resources/delete - Commander deletes
# =============================================================================
echo ""
echo "=== 12. DELETE /resources/delete/$RES_ID (Commander deletes) ==="
curl -s -X DELETE "$BASE_URL/delete/$RES_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: DELETE - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /resources/delete/$FAKE_RES_ID (expect 404) ==="
curl -s -X DELETE "$BASE_URL/delete/$FAKE_RES_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Leave event, delete event, delete users
# =============================================================================
echo ""
echo "=== CLEANUP: Leave event, delete event, delete users ==="
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" >/dev/null
curl -s -X DELETE "$EVENT_URL/delete/$EVT_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== CLEANUP: Delete test users ==="
curl -s -X DELETE "$AUTH_URL/delete/$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
