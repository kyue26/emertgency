#!/bin/bash
# Tasks API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./tasks-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
EVENT_URL="http://localhost:3000/event"
BASE_URL="http://localhost:3000/tasks"
FAKE_EVENT_ID="evt_nonexistent_12345"
FAKE_TASK_ID="tsk_nonexistent_12345"
FAKE_PROF_ID="prof_nonexistent_12345"

TEST_EMAIL="commander.tasks@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.tasks@pennmert.org"
MEMBER_PASSWORD="MemberPass123!"
OUTSIDER_EMAIL="outsider.tasks@pennmert.org"
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
# SETUP: Register Member (joins event, gets tasks assigned)
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
# SETUP: Create event, start it, Member joins
# =============================================================================
echo ""
echo "=== SETUP: Create event ==="
EVT_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440060")" \
  -d '{
    "name": "Tasks Test Drill",
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

echo "=== SETUP: Member joins event ==="
curl -s -X POST "$EVENT_URL/join" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"invite_code\": \"$INVITE_CODE\"}" >/dev/null

# =============================================================================
# FAIL: POST /tasks/create - Missing event_id (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /tasks/create - Missing event_id (expect 400) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"assigned_to\": \"$MEMBER_PROF_ID\", \"task_description\": \"Do something\"}" | jq .

# =============================================================================
# FAIL: POST /tasks/create - Missing assigned_to (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /tasks/create - Missing assigned_to (expect 400) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT_ID\", \"task_description\": \"Do something\"}" | jq .

# =============================================================================
# FAIL: POST /tasks/create - Missing task_description (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /tasks/create - Missing task_description (expect 400) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT_ID\", \"assigned_to\": \"$MEMBER_PROF_ID\"}" | jq .

# =============================================================================
# FAIL: POST /tasks/create - Non-existent event (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: POST /tasks/create - Non-existent event (expect 404) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$FAKE_EVENT_ID\", \"assigned_to\": \"$MEMBER_PROF_ID\", \"task_description\": \"Do something\"}" | jq .

# =============================================================================
# FAIL: POST /tasks/create - Non-existent assignee (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: POST /tasks/create - Non-existent assignee (expect 404) ==="
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT_ID\", \"assigned_to\": \"$FAKE_PROF_ID\", \"task_description\": \"Do something\"}" | jq .

# =============================================================================
# 1. POST /tasks/create - Create tasks
# =============================================================================
echo ""
echo "=== 1. POST /tasks/create - Create task (Commander assigned to Member) ==="
TASK1_RESP=$(curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440061")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"assigned_to\": \"$MEMBER_PROF_ID\",
    \"task_description\": \"Triage incoming patients\",
    \"priority\": \"high\"
  }")
TASK_ID=$(echo "$TASK1_RESP" | jq -r '.task.task_id')
echo "$TASK1_RESP" | jq .
if [[ -z "$TASK_ID" || "$TASK_ID" == "null" ]]; then
  echo "Create task failed: $TASK1_RESP"
  exit 1
fi

echo ""
echo "=== 2. POST /tasks/create - Create second task ==="
TASK2_RESP=$(curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440062")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"assigned_to\": \"$MEMBER_PROF_ID\",
    \"task_description\": \"Transport patient to hospital\",
    \"priority\": \"critical\"
  }")
TASK_ID2=$(echo "$TASK2_RESP" | jq -r '.task.task_id')
echo "$TASK2_RESP" | jq -c '.success, .task.task_description'

echo ""
echo "=== 3. POST /tasks/create - Member creates task for self ==="
TASK3_RESP=$(curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440063")" \
  -d "{
    \"event_id\": \"$EVT_ID\",
    \"assigned_to\": \"$MEMBER_PROF_ID\",
    \"task_description\": \"Document triage notes\"
  }")
TASK_ID3=$(echo "$TASK3_RESP" | jq -r '.task.task_id')
echo "$TASK3_RESP" | jq -c '.success, .task.task_description'

# =============================================================================
# 4. GET /tasks - List
# =============================================================================
echo ""
echo "=== 4. GET /tasks ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4b. GET /tasks?event_id=$EVT_ID ==="
curl -s -X GET "$BASE_URL?event_id=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4c. GET /tasks?assigned_to=$MEMBER_PROF_ID ==="
curl -s -X GET "$BASE_URL?assigned_to=$MEMBER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4d. GET /tasks?status=pending ==="
curl -s -X GET "$BASE_URL?status=pending" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4e. GET /tasks?my_tasks=true (Member) ==="
curl -s -X GET "$BASE_URL?my_tasks=true" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# FAIL: GET /tasks/:taskId - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /tasks/$FAKE_TASK_ID (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_TASK_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /tasks/:taskId - Outsider has no access (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: GET /tasks/$TASK_ID (Outsider, expect 403) ==="
curl -s -X GET "$BASE_URL/$TASK_ID" -H "Authorization: Bearer $TOKEN3" | jq .

# =============================================================================
# 5. GET /tasks/:taskId - Success
# =============================================================================
echo ""
echo "=== 5. GET /tasks/$TASK_ID ==="
curl -s -X GET "$BASE_URL/$TASK_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 6. GET /tasks/:taskId/audit
# =============================================================================
echo ""
echo "=== 6. GET /tasks/$TASK_ID/audit ==="
curl -s -X GET "$BASE_URL/$TASK_ID/audit" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 7. PUT /tasks/update/:taskId - Update status
# =============================================================================
echo ""
echo "=== 7. PUT /tasks/update/$TASK_ID - Update status to in_progress ==="
curl -s -X PUT "$BASE_URL/update/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440064")" \
  -d '{"status": "in_progress"}' | jq .

# =============================================================================
# 8. PUT /tasks/update/:taskId - Reassign (Commander only)
# =============================================================================
echo ""
echo "=== 8. PUT /tasks/update/$TASK_ID - Reassign to Commander ==="
curl -s -X PUT "$BASE_URL/update/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440065")" \
  -d "{\"assigned_to\": \"$COMMANDER_PROF_ID\"}" | jq .

# =============================================================================
# FAIL: PUT - Member cannot reassign (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: PUT /tasks/update/$TASK_ID2 - Member reassigns (expect 403) ==="
curl -s -X PUT "$BASE_URL/update/$TASK_ID2" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d "{\"assigned_to\": \"$COMMANDER_PROF_ID\"}" | jq .

# =============================================================================
# FAIL: PUT - Invalid status transition (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: PUT /tasks/update/$TASK_ID2 - Invalid transition pending->completed (expect 400) ==="
curl -s -X PUT "$BASE_URL/update/$TASK_ID2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' | jq .

# =============================================================================
# FAIL: PUT - No changes (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: PUT /tasks/update/$TASK_ID2 - No changes (expect 400) ==="
curl -s -X PUT "$BASE_URL/update/$TASK_ID2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priority": "critical"}' | jq .

# =============================================================================
# 9. PUT /tasks/update/:taskId - Complete task
# =============================================================================
echo ""
echo "=== 9. PUT /tasks/update/$TASK_ID - Complete task ==="
curl -s -X PUT "$BASE_URL/update/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440066")" \
  -d '{"status": "in_progress"}' | jq -c '.success'
curl -s -X PUT "$BASE_URL/update/$TASK_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440067")" \
  -d '{"status": "completed"}' | jq .

# =============================================================================
# FAIL: DELETE - Assignee cannot soft delete (expect 403)
# Soft delete = only creator or Commander
# =============================================================================
echo ""
echo "=== FAIL: DELETE /tasks/$TASK_ID2 (Member soft deletes, expect 403) ==="
curl -s -X DELETE "$BASE_URL/$TASK_ID2" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# 10. DELETE - Soft delete (Commander cancels)
# =============================================================================
echo ""
echo "=== 10. DELETE /tasks/$TASK_ID2 (soft delete) ==="
curl -s -X DELETE "$BASE_URL/$TASK_ID2" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 11. DELETE - Permanent delete (Member deletes own task)
# =============================================================================
echo ""
echo "=== 11. DELETE /tasks/$TASK_ID3?permanent=true (Member deletes own task) ==="
if [[ -n "$TASK_ID3" && "$TASK_ID3" != "null" ]]; then
  curl -s -X DELETE "$BASE_URL/$TASK_ID3?permanent=true" -H "Authorization: Bearer $TOKEN2" | jq .
else
  echo "Skipped (TASK_ID3 not created)"
fi

# =============================================================================
# FAIL: POST /tasks/create - Finished event (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /tasks/create - Finished event (expect 400) ==="
EVT2_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440070")" \
  -d '{"name": "Finished Event", "status": "upcoming"}')
EVT2_ID=$(echo "$EVT2_RESP" | jq -r '.event.event_id // empty')
curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/stop" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$BASE_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event_id\": \"$EVT2_ID\", \"assigned_to\": \"$MEMBER_PROF_ID\", \"task_description\": \"Do something\"}" | jq .

# =============================================================================
# 12. DELETE - Permanent delete remaining task
# =============================================================================
echo ""
echo "=== 12. DELETE /tasks/$TASK_ID?permanent=true ==="
curl -s -X DELETE "$BASE_URL/$TASK_ID?permanent=true" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Leave events, delete events, delete users
# =============================================================================
echo ""
echo "=== CLEANUP: Leave events, delete events ==="
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN2" -H "Content-Type: application/json" >/dev/null
curl -s -X DELETE "$EVENT_URL/delete/$EVT_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'
[[ -n "$EVT2_ID" && "$EVT2_ID" != "null" ]] && curl -s -X DELETE "$EVENT_URL/delete/$EVT2_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

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
