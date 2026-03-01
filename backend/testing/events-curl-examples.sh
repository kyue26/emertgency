#!/bin/bash
# Events API curl examples - run in order to test all endpoints
# Usage: Run server first (npm start), then: ./events-curl-examples.sh
# Requires: jq (brew install jq) for parsing responses

set +e   # Don't exit on curl failures so we can see all results
AUTH_URL="http://localhost:3000/auth"
BASE_URL="http://localhost:3000/events"

# Test user - must use @pennmert.org or @publicsafety.upenn.edu
TEST_EMAIL="commander.test@pennmert.org"
TEST_PASSWORD="CommanderPass123!"

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
# 201 = created, 409 = already exists (fine, use login)
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
# SETUP: Register second user (MERT Member) for join test
# =============================================================================
MEMBER_EMAIL="member.test@pennmert.org"
MEMBER_PASSWORD="MemberPass123!"
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
MEMBER_REG_BODY=$(echo "$MEMBER_REG_RESP" | sed '$d')
if [[ "$MEMBER_REG_HTTP" != "201" && "$MEMBER_REG_HTTP" != "409" ]]; then
  echo "Member register failed ($MEMBER_REG_HTTP): $MEMBER_REG_BODY"
  exit 1
fi
MEMBER_LOGIN_RESP=$(curl -s -X POST "$AUTH_URL/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\"}")
TOKEN2=$(echo "$MEMBER_LOGIN_RESP" | jq -r '.token')
MEMBER_PROF_ID=$(echo "$MEMBER_LOGIN_RESP" | jq -r '.user.professional_id')
echo "Member token obtained. Member ID: $MEMBER_PROF_ID"

# =============================================================================
# Create event first so EVT_ID and INVITE_CODE are available for later requests
# =============================================================================
echo ""
echo "=== 9. POST /events/create ==="
CREATE_RESP=$(curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440000")" \
  -d '{
    "name": "Spring Drill 2025",
    "location": "Franklin Field",
    "start_time": "2025-04-15T09:00:00.000Z",
    "finish_time": "2025-04-15T17:00:00.000Z",
    "status": "upcoming"
  }')
EVT_ID=$(echo "$CREATE_RESP" | jq -r '.event.event_id')
INVITE_CODE=$(echo "$CREATE_RESP" | jq -r '.event.invite_code')
echo "$CREATE_RESP" | jq .

if [[ -z "$EVT_ID" || "$EVT_ID" == "null" ]]; then
  echo "Create event failed: $CREATE_RESP"
  exit 1
fi
echo "Created event: $EVT_ID, invite_code: $INVITE_CODE"

# =============================================================================
# 1. GET /events - List events
# =============================================================================
echo ""
echo "=== 1. GET /events ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 1b. GET /events?status=upcoming&page=1&limit=10 ==="
curl -s -X GET "$BASE_URL?status=upcoming&page=1&limit=10" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 2. GET /events/active - Get active event for current user
# =============================================================================
echo ""
echo "=== 2. GET /events/active ==="
curl -s -X GET "$BASE_URL/active" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 3. GET /events/current - Get current event
# =============================================================================
echo ""
echo "=== 3. GET /events/current ==="
curl -s -X GET "$BASE_URL/current" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 4. GET /events/:eventId - Get single event
# =============================================================================
echo ""
echo "=== 4. GET /events/$EVT_ID ==="
curl -s -X GET "$BASE_URL/$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 5. GET /events/:eventId/statistics
# =============================================================================
echo ""
echo "=== 5. GET /events/$EVT_ID/statistics ==="
curl -s -X GET "$BASE_URL/$EVT_ID/statistics" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 6. GET /events/:eventId/invite-code (Commander only)
# =============================================================================
echo ""
echo "=== 6. GET /events/$EVT_ID/invite-code ==="
curl -s -X GET "$BASE_URL/$EVT_ID/invite-code" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 7. POST /events/start - Start event (upcoming -> in_progress)
# =============================================================================
echo ""
echo "=== 7. POST /events/start ==="
curl -s -X POST "$BASE_URL/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .

# =============================================================================
# 8. PUT /events/update/:eventId - Update event (while in_progress)
# =============================================================================
echo ""
echo "=== 8. PUT /events/update/$EVT_ID ==="
curl -s -X PUT "$BASE_URL/update/$EVT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440001")" \
  -d '{"name": "Spring Drill 2025 - Updated", "location": "Franklin Field (North)"}' | jq .

# =============================================================================
# 9. POST /events/join - Member joins with invite code (while event in_progress)
# =============================================================================
echo ""
echo "=== 9. POST /events/join (member, invite_code: $INVITE_CODE) ==="
curl -s -X POST "$BASE_URL/join" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\"}" | jq .

# =============================================================================
# 10. POST /events/stop - Stop event (in_progress -> finished)
# =============================================================================
echo ""
echo "=== 10. POST /events/stop ==="
curl -s -X POST "$BASE_URL/stop" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .

# =============================================================================
# 11. POST /events/leave - Leave current event
# =============================================================================
echo ""
echo "=== 11. POST /events/leave (Commander) ==="
curl -s -X POST "$BASE_URL/leave" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq .

echo ""
echo "=== 11b. POST /events/leave (Member) ==="
curl -s -X POST "$BASE_URL/leave" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" | jq .

# =============================================================================
# 12. DELETE /events/delete/:eventId - force=true since event has data
# =============================================================================
echo ""
echo "=== 12. DELETE /events/delete/$EVT_ID?force=true ==="
curl -s -X DELETE "$BASE_URL/delete/$EVT_ID?force=true" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Delete test users (Commander deletes member, then self)
# =============================================================================
echo ""
echo "=== CLEANUP: Delete test users ==="
echo "Deleting member $MEMBER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$MEMBER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo "Deleting commander $COMMANDER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== Done ==="
