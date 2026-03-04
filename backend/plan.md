# Offline Sync — Backend Implementation Plan

## Context

MERT field users operate in environments with spotty connectivity. The backend needs to support three things so that frontend clients (web PWA and mobile app) can operate offline and safely sync when connectivity returns:

1. **Idempotency** — prevent duplicate records when the client retries a request it isn't sure was received
2. **Delta sync** — let a client efficiently fetch only what changed while it was offline
3. **Batch operations** — let a client replay a queue of mutations in a single request on reconnect

This document covers every file that needs to be created or modified. No frontend changes are in scope.

---

## Repository Layout After Implementation

```
backend/
├── config/
│   ├── auth.js               (no change)
│   ├── database.js           (no change)
│   └── idempotency.js        (NEW)
├── routes/
│   ├── analytics.js          (no change)
│   ├── auth.js               (no change)
│   ├── casualties.js         (MODIFIED — wire idempotency middleware)
│   ├── event.js              (MODIFIED — wire idempotency middleware)
│   ├── group.js              (MODIFIED — wire idempotency middleware)
│   ├── resources.js          (MODIFIED — wire idempotency middleware)
│   ├── sync.js               (NEW)
│   └── tasks.js              (MODIFIED — wire idempotency middleware)
├── services/
│   ├── casualties.service.js (NEW)
│   ├── resources.service.js  (NEW)
│   └── tasks.service.js      (NEW)
├── migrations/
│   └── 001_offline_sync.sql  (NEW)
├── server.js                 (MODIFIED — mount sync route, start cleanup job)
└── ...
```

---

## Step 1 — Database Migration

Create `backend/migrations/001_offline_sync.sql`.

```sql
CREATE TABLE idempotency_keys (
    key VARCHAR(100) PRIMARY KEY,
    professional_id VARCHAR(50) NOT NULL
        REFERENCES professionals(professional_id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(200) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_professional ON idempotency_keys(professional_id);
```

This migration must be run against the database before deploying the application changes. Add a note in the file header to that effect.

---

## Step 2 — Idempotency Middleware

Create `backend/config/idempotency.js`.

### Behaviour

- Only applies to `POST`, `PUT`, and `DELETE` requests.
- If the request has no `Idempotency-Key` header, pass through unchanged. This keeps existing clients working without modification.
- The key must be a valid UUID v4. Reject with `400` if malformed.
- Scope keys per `professional_id` — the same UUID submitted by two different users is treated as two different keys.
- On a cache hit (key exists, not expired, same professional), return the cached `response_status` and `response_body` directly without executing any handler logic.
- On a cache miss, intercept `res.json` before it sends. After the handler calls `res.json(body)`, if `statusCode` is 2xx, insert the key + response into `idempotency_keys` with `expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'`. Then let the original send proceed.
- Use `ON CONFLICT (key) DO NOTHING` on insert to handle the rare race condition where two identical requests arrive simultaneously.
- If the database insert for caching fails, log the error but do **not** fail the request (fail open).
- `req.user` is required, so this middleware must always be applied after `authenticateToken`.

### Export

```js
module.exports = { idempotencyMiddleware };
```

---

## Step 3 — Service Layer

Extract pure business logic out of the route handlers for the three resource types that field users write offline: casualties, tasks, and resource requests. These service functions are called both by the existing route handlers and by the batch dispatcher in Step 4.

### `backend/services/casualties.service.js`

Extract and export the following functions. Each accepts `(body, user, pool)` and returns `{ status: Number, body: Object }`. They should contain exactly the logic that currently lives inside the route handler, including all validation, DB queries, and audit log writes. Do **not** call `res.json` — return the response object instead.

- `createCasualty(body, user, pool)` — logic from `POST /casualties/add`
- `updateCasualtyStatus(casualtyId, body, user, pool)` — logic from `PUT /casualties/update/:casualtyId/status`

### `backend/services/tasks.service.js`

- `createTask(body, user, pool)` — logic from `POST /tasks/create`
- `updateTask(taskId, body, user, pool)` — logic from `PUT /tasks/update/:taskId`

### `backend/services/resources.service.js`

- `createResource(body, user, pool)` — logic from `POST /resources/create`
- `updateResource(resourceRequestId, body, user, pool)` — logic from `PUT /resources/update/:resourceRequestId`
- `confirmResource(resourceRequestId, body, user, pool)` — logic from `PUT /resources/confirm/:resourceRequestId`

### Updating the existing route handlers

Once each service function exists, update the corresponding route handler to call the service function and then do `return res.status(result.status).json(result.body)`. The validation middleware (express-validator), `authenticateToken`, and `idempotencyMiddleware` stay in the route file — only the DB logic moves.

---

## Step 4 — Sync Routes

Create `backend/routes/sync.js`. Mount two routes on this file.

---

### `GET /sync`

**Query parameters:**
- `since` (required) — ISO 8601 timestamp. Returns all records with `updated_at > since`.
- `event_id` (required) — scopes the sync to one event.

**Validation:**
- Both params required; `since` must be valid ISO 8601.
- Reject with `400` if `since` is older than 48 hours, with message: `"Sync window too large. Maximum lookback is 48 hours. Please do a full refresh."`

**Authorization:**
- Commander: access any event.
- Others: must be assigned to a camp in the event (same check as in `casualties.js` `checkEventAccess`).
- Return `404` if event not found, `403` if access denied.

**Response — run all of the following queries in parallel via `Promise.all`:**

1. **Updated casualties** — `injured_persons` where `event_id = $event_id AND updated_at > $since`, joined to `camps` for `location_name`.
2. **Updated tasks** — `tasks` where `event_id = $event_id AND updated_at > $since`, joined to `professionals` for `assigned_to_name` and `created_by_name`.
3. **Updated resource requests** — `resource_requests` where `event_id = $event_id AND updated_at > $since`, joined to `professionals` for `requested_by_name`.
4. **Updated camps** — `camps` where `event_id = $event_id AND updated_at > $since`.
5. **Deleted casualties** — query `casualty_audit_log` for rows where `changes->>'action' = 'deleted'` and `changed_at > $since`, filtered to casualties that no longer exist in `injured_persons` for this event. Return only the `casualty_id` values.

**Response shape:**
```json
{
  "success": true,
  "serverTime": "<ISO8601 — client stores this as next `since` value>",
  "event_id": "...",
  "changes": {
    "casualties": [...],
    "tasks": [...],
    "resources": [...],
    "camps": [...],
    "deleted": {
      "casualties": ["inj_abc", "inj_def"]
    }
  },
  "counts": {
    "casualties": 3,
    "tasks": 1,
    "resources": 0,
    "camps": 0,
    "deleted_casualties": 2
  }
}
```

**Important note for frontend teams:** The client must use `serverTime` from the response (not its local clock) as the `since` value on the next sync call. This avoids clock skew issues across devices.

---

### `POST /sync/batch`

Accepts an ordered array of operations and processes them sequentially. Returns per-operation results. Individual failures do not abort the batch.

**Request body:**
```json
{
  "operations": [
    {
      "idempotency_key": "<uuid v4>",
      "method": "POST",
      "path": "casualties/add",
      "body": { ... }
    }
  ]
}
```

**Validation:**
- `operations` must be a non-empty array, maximum length 100.
- Each operation must have `idempotency_key`, `method`, `path`, and `body`. Reject the entire batch with `400` if any operation is malformed.

**Processing loop (sequential, not parallel):**

For each operation:
1. Check `idempotency_keys` for a cached result scoped to `req.user.professional_id`. If found and not expired, push `{ idempotency_key, status, body, replayed: true }` to results and `continue`.
2. If not cached, call `dispatchOperation(operation, req.user, pool)`.
3. Cache the result in `idempotency_keys` with `ON CONFLICT DO NOTHING`.
4. Push `{ idempotency_key, status, body, replayed: false }` to results.
5. On any thrown error, push `{ idempotency_key, status: 500, body: { success: false, message: 'Operation failed' }, replayed: false }` and continue.

**`dispatchOperation` function** (internal, not exported):

Maps `method` + `path` to a service function call. Supported operations:

| method | path | service call |
|--------|------|--------------|
| POST | `casualties/add` | `createCasualty(body, user, pool)` |
| PUT | `casualties/update/:casualtyId/status` | `updateCasualtyStatus(casualtyId, body, user, pool)` |
| POST | `tasks/create` | `createTask(body, user, pool)` |
| PUT | `tasks/update/:taskId` | `updateTask(taskId, body, user, pool)` |
| POST | `resources/create` | `createResource(body, user, pool)` |
| PUT | `resources/update/:resourceRequestId` | `updateResource(resourceRequestId, body, user, pool)` |
| PUT | `resources/confirm/:resourceRequestId` | `confirmResource(resourceRequestId, body, user, pool)` |

Return `{ status: 400, body: { success: false, message: 'Unknown operation: METHOD path' } }` for anything not in this table.

Extract path parameters using a regex match on the path string.

**Response shape:**
```json
{
  "success": true,
  "processed": 5,
  "succeeded": 4,
  "failed": 1,
  "results": [
    { "idempotency_key": "...", "status": 201, "body": { ... }, "replayed": false },
    { "idempotency_key": "...", "status": 200, "body": { ... }, "replayed": true }
  ]
}
```

---

## Step 5 — Wire Up Idempotency Middleware in Existing Routes

In each of the following route files, add `idempotencyMiddleware` to every `POST`, `PUT`, and `DELETE` route handler, immediately after `authenticateToken` in the middleware chain:

- `routes/casualties.js`
- `routes/tasks.js`
- `routes/resources.js`
- `routes/event.js`
- `routes/group.js`

Example pattern:
```js
const { idempotencyMiddleware } = require('../config/idempotency');

// Before:
router.post('/add', authenticateToken, checkEventAccess, [...validators], handler);

// After:
router.post('/add', authenticateToken, idempotencyMiddleware, checkEventAccess, [...validators], handler);
```

`idempotencyMiddleware` must come after `authenticateToken` (needs `req.user`) and before any other middleware or the handler.

---

## Step 6 — Update `server.js`

Two changes:

### 1. Mount the sync router

```js
const syncRoutes = require('./routes/sync');
// Add alongside the other route mounts:
app.use('/sync', syncRoutes);
```

Note: `authenticateToken` is applied inside `sync.js` per-route, consistent with the existing pattern in this codebase.

### 2. Start the idempotency key cleanup job

Add after the route mounts, before `app.listen`:

```js
// Purge expired idempotency keys hourly
setInterval(async () => {
  try {
    const result = await pool.query(
      'DELETE FROM idempotency_keys WHERE expires_at < CURRENT_TIMESTAMP'
    );
    if (result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} expired idempotency keys`);
    }
  } catch (err) {
    console.error('Idempotency cleanup error:', err.message);
  }
}, 60 * 60 * 1000);
```

---

## API Contract Summary for Frontend Teams

### New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/sync?since=<ISO8601>&event_id=<id>` | Fetch all changes since a timestamp |
| POST | `/sync/batch` | Replay a queue of offline mutations |

### New request header

`Idempotency-Key: <uuid v4>`

Include on any `POST`, `PUT`, or `DELETE` request. Generate the UUID client-side before the first attempt and persist it with the queued operation. Send the same key on every retry. The header is optional — omitting it is valid and the request processes normally.

### Sync usage pattern

```
1. On app load:        GET /sync?since=<stored_serverTime>&event_id=<id>
                       Seed local store with response data.
                       Store response.serverTime for next sync.

2. While offline:      Queue mutations locally with a generated UUID per operation.

3. On reconnect:       POST /sync/batch  with the queued operations array.
                       Then GET /sync?since=<last_serverTime>&event_id=<id> to catch
                       any changes made by other users while offline.
                       Store new serverTime.
```

### Idempotency replay behaviour

A replayed response (cache hit on `Idempotency-Key`) returns the same HTTP status and body shape as the original successful response. Clients should treat `replayed: true` results in batch responses identically to fresh results.

### Clock skew warning

Always use the `serverTime` value returned by `GET /sync` as the `since` parameter on the next call. Never use the device's local clock. Devices in the field may have drifted clocks that would cause records to be missed or over-fetched.

---

## Assumptions and Constraints

- No existing route signatures change. All new behaviour is additive.
- The `Idempotency-Key` header is opt-in. Clients that do not send it are unaffected.
- The batch endpoint supports only the seven mutation operations listed in the dispatch table. Read operations (`GET`) are not batchable — use the delta sync endpoint instead.
- Idempotency keys expire after 24 hours. A client that has been offline for longer than 24 hours and retries must handle the possibility that its earliest queued operations are no longer idempotency-protected. In practice, a 24-hour offline window exceeds any realistic MERT event duration.
- The 48-hour sync window on `GET /sync` is a safeguard against accidentally pulling the entire history of a large event. A client offline for more than 48 hours should prompt the user to do a full data reload.
- Service functions do not call `res.json` — they return `{ status, body }`. This is the key contract that makes them usable from both route handlers and the batch dispatcher.
