#!/bin/bash
# Groups API curl examples - run in order to test all endpoints (success + failure cases)
# Usage: Run server first (npm start), then: ./groups-curl-examples.sh
# Requires: jq (brew install jq)

set +e
AUTH_URL="http://localhost:3000/auth"
BASE_URL="http://localhost:3000/groups"
FAKE_GROUP_ID="grp_nonexistent_12345"
FAKE_PROF_ID="prof_nonexistent_12345"

TEST_EMAIL="commander.groups@pennmert.org"
TEST_PASSWORD="CommanderPass123!"
MEMBER_EMAIL="member.groups@pennmert.org"
MEMBER_PASSWORD="MemberPass123!"
OUTSIDER_EMAIL="outsider.groups@pennmert.org"
OUTSIDER_PASSWORD="OutsiderPass123!"

# =============================================================================
# SETUP: Register Commander, Member, Outsider
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
echo "=== SETUP: Register Member and Outsider ==="
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Member\", \"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\", \"role\": \"MERT Member\"}" >/dev/null
curl -s -X POST "$AUTH_URL/register" -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Outsider\", \"email\": \"$OUTSIDER_EMAIL\", \"password\": \"$OUTSIDER_PASSWORD\", \"role\": \"MERT Member\"}" >/dev/null

MEMBER_LOGIN=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" \
  -d "{\"email\": \"$MEMBER_EMAIL\", \"password\": \"$MEMBER_PASSWORD\"}")
TOKEN2=$(echo "$MEMBER_LOGIN" | jq -r '.token')
MEMBER_PROF_ID=$(echo "$MEMBER_LOGIN" | jq -r '.user.professional_id')

OUTSIDER_LOGIN=$(curl -s -X POST "$AUTH_URL/login" -H "Content-Type: application/json" \
  -d "{\"email\": \"$OUTSIDER_EMAIL\", \"password\": \"$OUTSIDER_PASSWORD\"}")
TOKEN3=$(echo "$OUTSIDER_LOGIN" | jq -r '.token')
OUTSIDER_PROF_ID=$(echo "$OUTSIDER_LOGIN" | jq -r '.user.professional_id')
echo "Commander: $COMMANDER_PROF_ID, Member: $MEMBER_PROF_ID, Outsider: $OUTSIDER_PROF_ID"

# =============================================================================
# SETUP: Clean up any existing test groups (Alpha Team, Beta Team) from prior runs
# =============================================================================
echo ""
echo "=== SETUP: Clean up existing test groups ==="
GROUPS_JSON=$(curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN")
for name in "Alpha Team" "Beta Team" "Alpha Team Updated" "Beta Team Updated"; do
  GID=$(echo "$GROUPS_JSON" | jq -r --arg n "$name" '.groups[]? | select(.group_name == $n) | .group_id')
  if [[ -n "$GID" && "$GID" != "null" ]]; then
    echo "Deleting existing group: $name ($GID)"
    curl -s -X DELETE "$BASE_URL/delete/$GID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success, .message'
  fi
done
echo "Cleanup done."

# =============================================================================
# FAIL: POST /groups/register - Missing group_name (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST /groups/register - Missing group_name (expect 400) ==="
curl -s -X POST "$BASE_URL/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .

# =============================================================================
# 1. POST /groups/register - Create groups
# =============================================================================
echo ""
echo "=== 1. POST /groups/register - Commander creates group ==="
GRP1_RESP=$(curl -s -X POST "$BASE_URL/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440090")" \
  -d '{"group_name": "Alpha Team", "max_members": 10}')
GRP_ID=$(echo "$GRP1_RESP" | jq -r '.group.group_id')
echo "$GRP1_RESP" | jq .
if [[ -z "$GRP_ID" || "$GRP_ID" == "null" ]]; then
  echo "Create group failed: $GRP1_RESP"
  exit 1
fi

echo ""
echo "=== 2. POST /groups/register - Member creates group (self as lead) ==="
GRP2_RESP=$(curl -s -X POST "$BASE_URL/register" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440091")" \
  -d '{"group_name": "Alpha Team", "max_members": 10}')
echo "Duplicate name attempt (expect 409):"
echo "$GRP2_RESP" | jq -c '.success, .message'

GRP2_RESP=$(curl -s -X POST "$BASE_URL/register" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440092")" \
  -d '{"group_name": "Beta Team", "max_members": 10}')
GRP_ID2=$(echo "$GRP2_RESP" | jq -r '.group.group_id')
echo "$GRP2_RESP" | jq -c '.success, .group.group_name'

# =============================================================================
# 3. GET /groups - List
# =============================================================================
echo ""
echo "=== 3. GET /groups ==="
curl -s -X GET "$BASE_URL" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 3b. GET /groups?view=membership ==="
curl -s -X GET "$BASE_URL?view=membership" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 3c. GET /groups?include_members=true ==="
curl -s -X GET "$BASE_URL?include_members=true" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 3d. GET /groups?page=1&limit=1 ==="
curl -s -X GET "$BASE_URL?page=1&limit=1" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /groups/:groupId - Non-existent (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: GET /groups/$FAKE_GROUP_ID (expect 404) ==="
curl -s -X GET "$BASE_URL/$FAKE_GROUP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 4. GET /groups/:groupId - Get single group
# =============================================================================
echo ""
echo "=== 4. GET /groups/$GRP_ID ==="
curl -s -X GET "$BASE_URL/$GRP_ID" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 4b. GET /groups/$GRP_ID?view=membership ==="
curl -s -X GET "$BASE_URL/$GRP_ID?view=membership" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: PUT - Member cannot update Commander's group (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: PUT /groups/update/$GRP_ID (Member updates Commander's group, expect 403) ==="
curl -s -X PUT "$BASE_URL/update/$GRP_ID" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440093")" \
  -d '{"group_name": "Alpha Team Updated"}' | jq .

# =============================================================================
# 5. PUT /groups/update/:groupId - Commander updates group
# =============================================================================
echo ""
echo "=== 5. PUT /groups/update/$GRP_ID (Commander updates) ==="
curl -s -X PUT "$BASE_URL/update/$GRP_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440094")" \
  -d '{"group_name": "Alpha Team", "max_members": 15}' | jq .

# =============================================================================
# 6. PUT /groups/update/:groupId - Member (as lead) updates own group
# =============================================================================
echo ""
echo "=== 6. PUT /groups/update/$GRP_ID2 (Member/lead updates own group) ==="
curl -s -X PUT "$BASE_URL/update/$GRP_ID2" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440095")" \
  -d '{"group_name": "Beta Team Updated"}' | jq .

# =============================================================================
# 7. POST /groups/:groupId/members/add - Add Outsider to Alpha
# =============================================================================
echo ""
echo "=== 7. POST /groups/$GRP_ID/members/add ==="
curl -s -X POST "$BASE_URL/$GRP_ID/members/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440096")" \
  -d "{\"professional_id\": \"$OUTSIDER_PROF_ID\"}" | jq .

# =============================================================================
# FAIL: POST members/add - Already in group (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: POST members/add - Already in group (expect 400) ==="
curl -s -X POST "$BASE_URL/$GRP_ID/members/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"professional_id\": \"$OUTSIDER_PROF_ID\"}" | jq .

# =============================================================================
# FAIL: POST members/add - Professional not found (expect 404)
# =============================================================================
echo ""
echo "=== FAIL: POST members/add - Professional not found (expect 404) ==="
curl -s -X POST "$BASE_URL/$GRP_ID/members/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"professional_id\": \"$FAKE_PROF_ID\"}" | jq .

# =============================================================================
# FAIL: DELETE members/remove - Cannot remove lead (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: DELETE members/remove - Remove lead (expect 400) ==="
curl -s -X DELETE "$BASE_URL/$GRP_ID/members/remove/$COMMANDER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 8. DELETE /groups/:groupId/members/remove/:professionalId
# =============================================================================
echo ""
echo "=== 8. DELETE /groups/$GRP_ID/members/remove/$OUTSIDER_PROF_ID ==="
curl -s -X DELETE "$BASE_URL/$GRP_ID/members/remove/$OUTSIDER_PROF_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: DELETE /groups/delete - Member cannot delete (expect 403)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /groups/delete/$GRP_ID2 (Member deletes, expect 403) ==="
curl -s -X DELETE "$BASE_URL/delete/$GRP_ID2" -H "Authorization: Bearer $TOKEN2" | jq .

# =============================================================================
# FAIL: DELETE /groups/delete - Group has members, no force (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: DELETE /groups/delete/$GRP_ID (has members, no force, expect 400) ==="
curl -s -X POST "$BASE_URL/$GRP_ID/members/add" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440097")" \
  -d "{\"professional_id\": \"$OUTSIDER_PROF_ID\"}" >/dev/null
curl -s -X DELETE "$BASE_URL/delete/$GRP_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 9. DELETE /groups/delete/:groupId - With force
# =============================================================================
echo ""
echo "=== 9. DELETE /groups/delete/$GRP_ID?force=true ==="
curl -s -X DELETE "$BASE_URL/delete/$GRP_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq .

echo ""
echo "=== 9b. DELETE /groups/delete/$GRP_ID2?force=true ==="
curl -s -X DELETE "$BASE_URL/delete/$GRP_ID2?force=true" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Delete test users
# =============================================================================
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
