#!/bin/bash
# Shifts API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./shifts-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
EVENT_URL="http://localhost:3000/event"
BASE_URL="http://localhost:3000/shifts"

TEST_EMAIL="commander.shifts@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.shifts@pennmert.org"
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
# SETUP: Create event, start it, Member joins (must be in event to check in)
# =============================================================================
echo ""
echo "=== SETUP: Create event and start ==="
EVT_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440200")" \
  -d '{"name": "Shifts Test Drill", "status": "upcoming"}')
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
# FAIL: POST /shifts/check-in - User not in event (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /shifts/check-in (Member not in event - use Commander before join)... ==="
# Commander creates event but hasn't joined - actually Commander creates event. Let me check.
# Commander creates event - does that auto-join? No. Commander needs to explicitly join or start.
# When Commander creates event, they're not in it. When they call start, do they join? Let me check event routes.
# Actually - when you create an event, you might be the creator. Let me check. The professionals test has Commander create event and start. So Commander might be in the event after start. I'll use a different user - register Outsider who never joins.
echo "=== SETUP: Register Outsider (never joins event) ==="
OUTSIDER_EMAIL="outsider.shifts@pennmert.org"
OUTSIDER_PASSWORD="OutsiderPass123!"
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Outsider\", \"email\": \"$OUTSIDER_EMAIL\", \"password\": \"$OUTSIDER_PASSWORD\", \"role\": \"MERT Member\"}" >/dev/null
OUTSIDER_LOGIN=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" \
  -d "{\"email\": \"$OUTSIDER_EMAIL\", \"password\": \"$OUTSIDER_PASSWORD\"}")
TOKEN3=$(echo "$OUTSIDER_LOGIN" | jq -r '.token')
OUTSIDER_PROF_ID=$(echo "$OUTSIDER_LOGIN" | jq -r '.user.professional_id')
echo "=== FAIL: POST /shifts/check-in (Outsider not in event, expect 400) ==="
curl -s -X POST "$BASE_URL/check-in" -H "Authorization: Bearer $TOKEN3" | jq .

# =============================================================================
# 1. GET /shifts/my-shifts - Before check-in (empty)
# =============================================================================
echo ""
echo "=== 1. GET /shifts/my-shifts (Member, before check-in) ==="
curl -s -X GET "$BASE_URL/my-shifts" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 2. POST /shifts/check-in - Member checks in
# =============================================================================
echo ""
echo "=== 2. POST /shifts/check-in (Member) ==="
CHECKIN_RESP=$(curl -s -X POST "$BASE_URL/check-in" -H "Authorization: Bearer $TOKEN2")
echo "$CHECKIN_RESP" | jq .
SHIFT_ID=$(echo "$CHECKIN_RESP" | jq -r '.shift.shift_id')
if [[ -z "$SHIFT_ID" || "$SHIFT_ID" == "null" ]]; then
  echo "Check-in failed: $CHECKIN_RESP"
  exit 1
fi

# =============================================================================
# 3. GET /shifts/my-shifts - After check-in (on duty)
# =============================================================================
echo ""
echo "=== 3. GET /shifts/my-shifts (Member, on duty) ==="
curl -s -X GET "$BASE_URL/my-shifts" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# FAIL: POST /shifts/check-in - Already checked in (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /shifts/check-in (Member already checked in, expect 400) ==="
curl -s -X POST "$BASE_URL/check-in" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 4. POST /shifts/check-out - Member checks out
# =============================================================================
echo ""
echo "=== 4. POST /shifts/check-out (Member) ==="
curl -s -X POST "$BASE_URL/check-out" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 5. GET /shifts/my-shifts - After check-out (shows completed shift)
# =============================================================================
echo ""
echo "=== 5. GET /shifts/my-shifts (Member, after check-out) ==="
curl -s -X GET "$BASE_URL/my-shifts" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# FAIL: POST /shifts/check-out - No open shift (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /shifts/check-out (Member, no open shift, expect 400) ==="
curl -s -X POST "$BASE_URL/check-out" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 6. Commander check-in/check-out (Commander in event)
# =============================================================================
echo ""
echo "=== 6. Commander check-in ==="
# Commander needs to be in event - does start put them in? Let me check event routes.
# Actually when you create an event, you might need to join. Let me check - in events test, Commander creates event.
# I need to check if Commander is in event after create+start. Looking at event.js - create doesn't auto-join. start transitions status. So Commander might not be in event. Let me have Commander join the event too.
curl -s -X POST "$EVENT_URL/join" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\"}" >/dev/null
curl -s -X POST "$BASE_URL/check-in" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 6b. GET /shifts/my-shifts (Commander) ==="
curl -s -X GET "$BASE_URL/my-shifts" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 6c. Commander check-out ==="
curl -s -X POST "$BASE_URL/check-out" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 7. Multiple shifts - Member does second check-in/check-out
# =============================================================================
echo ""
echo "=== 7. Member second check-in ==="
curl -s -X POST "$BASE_URL/check-in" -H "Authorization: Bearer $TOKEN2" | jq .

echo ""
echo "=== 7b. Member second check-out ==="
curl -s -X POST "$BASE_URL/check-out" -H "Authorization: Bearer $TOKEN2" | jq .

echo ""
echo "=== 7c. GET /shifts/my-shifts (Member, two completed shifts) ==="
curl -s -X GET "$BASE_URL/my-shifts" -H "Authorization: Bearer $TOKEN2" | jq .

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
curl -s -X DELETE "$AUTH_URL/delete/$OUTSIDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
