#!/bin/bash
# Analytics API curl examples - run in order to test all endpoints
# Usage: Run server first (npm start), then: ./analytics-curl-examples.sh
# Requires: jq (brew install jq)
# Note: Analytics routes are mounted at root: /locations/active, /reports/hospital-transfers, /reports/summary

set +e
AUTH_URL="http://localhost:3000/auth"
EVENT_URL="http://localhost:3000/event"
BASE_URL="http://localhost:3000"

TEST_EMAIL="commander.analytics@pennmert.org"
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
echo "Commander ID: $COMMANDER_PROF_ID"

# =============================================================================
# SETUP: Create event and start (for active locations)
# =============================================================================
echo ""
echo "=== SETUP: Create event and start ==="
EVT_RESP=$(curl -s -X POST "$EVENT_URL/create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen 2>/dev/null || echo "550e8400-e29b-41d4-a716-446655440300")" \
  -d '{"name": "Analytics Test Drill", "status": "upcoming"}')
EVT_ID=$(echo "$EVT_RESP" | jq -r '.event.event_id')
if [[ -z "$EVT_ID" || "$EVT_ID" == "null" ]]; then
  echo "Create event failed: $EVT_RESP"
  exit 1
fi
curl -s -X POST "$EVENT_URL/start" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
echo "Event: $EVT_ID"

# =============================================================================
# 1. GET /locations/active - Active locations (camps in in_progress events)
# =============================================================================
echo ""
echo "=== 1. GET /locations/active ==="
curl -s -X GET "$BASE_URL/locations/active" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 2. GET /reports/hospital-transfers - Hospitals + transfer stats
# =============================================================================
echo ""
echo "=== 2. GET /reports/hospital-transfers ==="
curl -s -X GET "$BASE_URL/reports/hospital-transfers" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 3. GET /reports/summary - Summary report (no filters)
# =============================================================================
echo ""
echo "=== 3. GET /reports/summary ==="
curl -s -X GET "$BASE_URL/reports/summary" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 4. GET /reports/summary?event_id=... - Filter by event
# =============================================================================
echo ""
echo "=== 4. GET /reports/summary?event_id=$EVT_ID ==="
curl -s -X GET "$BASE_URL/reports/summary?event_id=$EVT_ID" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# 5. GET /reports/summary?start_date=...&end_date=... - Filter by date range
# =============================================================================
echo ""
echo "=== 5. GET /reports/summary?start_date=2020-01-01&end_date=2030-12-31 ==="
curl -s -X GET "$BASE_URL/reports/summary?start_date=2020-01-01&end_date=2030-12-31" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /reports/summary - Only start_date (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: GET /reports/summary?start_date=2020-01-01 (missing end_date, expect 400) ==="
curl -s -X GET "$BASE_URL/reports/summary?start_date=2020-01-01" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /reports/summary - Only end_date (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: GET /reports/summary?end_date=2030-12-31 (missing start_date, expect 400) ==="
curl -s -X GET "$BASE_URL/reports/summary?end_date=2030-12-31" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# FAIL: GET /reports/summary - Invalid event_id (expect 400)
# =============================================================================
echo ""
echo "=== FAIL: GET /reports/summary?event_id=invalid (expect 400) ==="
curl -s -X GET "$BASE_URL/reports/summary?event_id=invalid" -H "Authorization: Bearer $TOKEN" | jq .

# =============================================================================
# CLEANUP: Delete event, delete user
# =============================================================================
echo ""
echo "=== CLEANUP: Delete event, delete user ==="
curl -s -X POST "$EVENT_URL/leave" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" >/dev/null
curl -s -X DELETE "$EVENT_URL/delete/$EVT_ID?force=true" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== CLEANUP: Delete test user ==="
curl -s -X DELETE "$AUTH_URL/delete/$COMMANDER_PROF_ID" -H "Authorization: Bearer $TOKEN" | jq -c '.success'

echo ""
echo "=== Done ==="
