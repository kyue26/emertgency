#!/bin/bash
# Professionals API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./professionals-curl-examples.sh
# Requires: jq (brew install jq)
# Note: Professionals are created via auth/register; this tests GET and PUT only.

set +e
AUTH_URL="http://localhost:3000/auth"
EVENT_URL="http://localhost:3000/event"
TASKS_URL="http://localhost:3000/tasks"
BASE_URL="http://localhost:3000/professionals"
FAKE_PROF_ID="prof_nonexistent_12345"

TEST_EMAIL="commander.prof@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.prof@pennmert.org"
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
# SETUP: Register Member
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
# SETUP: Create event and task (for professional_task_summary to have data)
# =============================================================================
echo ""
echo "=== SETUP: Create event and task ==="
EVT_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440080")" \
  -d '{"name": "Prof Test Drill", "status": "upcoming"}')
EVT_ID=$(echo "$EVT_RESP" | jq -r '.event.event_id')
INVITE_CODE=$(echo "$EVT_RESP" | jq -r '.event.invite_code')
curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/join" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\"}" >/dev/null
curl -s -X POST "$TASKS_URL/create" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440081")" \
  -d "{\"event_id\": \"$EVT_ID\", \"assigned_to\": \"$MEMBER_PROF_ID\", \"task_description\": \"Test task\"}" >/dev/null

# =============================================================================
# 1. GET /professionals - List all
# =============================================================================
echo ""
echo "=== 1. GET /professionals ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /professionals/:id - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /professionals/$FAKE_PROF_ID (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 2. GET /professionals/:id - Get single professional
# =============================================================================
echo ""
echo "=== 2. GET /professionals/$COMMANDER_PROF_ID ==="
curl -s -X GET "$BASE_URL/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 2b. GET /professionals/$MEMBER_PROF_ID ==="
curl -s -X GET "$BASE_URL/$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /professionals/:id/tasks - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /professionals/$FAKE_PROF_ID/tasks (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_PROF_ID/tasks" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 3. GET /professionals/:id/tasks - Task summary
# =============================================================================
echo ""
echo "=== 3. GET /professionals/$MEMBER_PROF_ID/tasks ==="
curl -s -X GET "$BASE_URL/$MEMBER_PROF_ID/tasks" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 3b. GET /professionals/$COMMANDER_PROF_ID/tasks ==="
curl -s -X GET "$BASE_URL/$COMMANDER_PROF_ID/tasks" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: PUT /professionals/:id - Member cannot update other (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: PUT /professionals/$COMMANDER_PROF_ID (Member updates Commander, expect 403) ==="
curl -s -X PUT "$BASE_URL/$COMMANDER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"name": "Hacked Name"}' | jq .

# =============================================================================
# 4. PUT /professionals/:id - Member updates own profile
# =============================================================================
echo ""
echo "=== 4. PUT /professionals/$MEMBER_PROF_ID (Member updates own) ==="
curl -s -X PUT "$BASE_URL/$MEMBER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Member Updated", "phone_number": "+15551234567"}' | jq .

# =============================================================================
# 5. PUT /professionals/:id - Commander updates Member
# =============================================================================
echo ""
echo "=== 5. PUT /professionals/$MEMBER_PROF_ID (Commander updates Member) ==="
curl -s -X PUT "$BASE_URL/$MEMBER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "Medical Officer", "name": "Test Member Final"}' | jq .

# =============================================================================
# FAIL: PUT /professionals/:id - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: PUT /professionals/$FAKE_PROF_ID (expect 404) ==="
curl -s -X PUT "$BASE_URL/$FAKE_PROF_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Fake"}' | jq .

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
echo "Deleting member $MEMBER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
echo "Deleting commander $COMMANDER_PROF_ID..."
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
