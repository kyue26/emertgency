const express = require('express');
const { query, body, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');
const { createCasualty, updateCasualtyStatus } = require('../services/casualties.service');
const { createTask, updateTask } = require('../services/tasks.service');
const { createResource, updateResource, confirmResource } = require('../services/resources.service');

const router = express.Router();

// ---------------------------------------------------------------------------
// Authorization helper — replicates the checkEventAccess logic from
// casualties.js: commanders can access any event, others must be assigned
// to a camp in the event.
// ---------------------------------------------------------------------------
const checkSyncEventAccess = async (req, res, eventId) => {
  const result = await pool.query(
    `SELECT e.event_id, e.status,
            EXISTS(
              SELECT 1 FROM professionals p
              JOIN camps c ON p.current_camp_id = c.camp_id
              WHERE c.event_id = e.event_id AND p.professional_id = $1
            ) as has_access
     FROM events e WHERE e.event_id = $2`,
    [req.user.professional_id, eventId]
  );

  if (result.rows.length === 0) {
    return { ok: false, status: 404, message: 'Event not found' };
  }

  const event = result.rows[0];

  if (req.user.role !== 'Commander' && !event.has_access) {
    return { ok: false, status: 403, message: 'You do not have access to this event' };
  }

  return { ok: true, event };
};

// ---------------------------------------------------------------------------
// GET /sync?since=<ISO8601>&event_id=<id>
// Returns all records changed after `since` for the given event.
// ---------------------------------------------------------------------------
router.get('/', authenticateToken, [
  query('since').notEmpty().isISO8601().withMessage('since must be a valid ISO 8601 timestamp'),
  query('event_id').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { since, event_id } = req.query;

    // Fetch DB clock so serverTime and updated_at share the same clock source
    const serverTimeResult = await pool.query('SELECT NOW() AS now');
    const serverTime = serverTimeResult.rows[0].now.toISOString();

    // Reject sync windows older than 48 hours (cutoff relative to DB clock)
    const sinceDate = new Date(since);
    const cutoff = new Date(new Date(serverTime) - 48 * 60 * 60 * 1000);
    if (sinceDate < cutoff) {
      return res.status(400).json({
        success: false,
        message: 'Sync window too large. Maximum lookback is 48 hours. Please do a full refresh.'
      });
    }

    // Authorization check
    const access = await checkSyncEventAccess(req, res, event_id);
    if (!access.ok) {
      return res.status(access.status).json({ success: false, message: access.message });
    }

    // Run all queries in parallel
    const [
      casualtiesResult,
      tasksResult,
      resourcesResult,
      campsResult,
      deletedResult
    ] = await Promise.all([
      // Updated casualties joined to camps for location_name
      pool.query(
        `SELECT ip.*, c.location_name
         FROM injured_persons ip
         LEFT JOIN camps c ON ip.camp_id = c.camp_id
         WHERE ip.event_id = $1 AND ip.updated_at > $2`,
        [event_id, sinceDate]
      ),

      // Updated tasks joined to professionals for name fields
      pool.query(
        `SELECT t.*,
                p_assigned.name as assigned_to_name,
                p_creator.name as created_by_name
         FROM tasks t
         LEFT JOIN professionals p_assigned ON t.assigned_to = p_assigned.professional_id
         LEFT JOIN professionals p_creator ON t.created_by = p_creator.professional_id
         WHERE t.event_id = $1 AND t.updated_at > $2`,
        [event_id, sinceDate]
      ),

      // Updated resource requests joined to professionals for requester name
      pool.query(
        `SELECT rr.*,
                p.name as requested_by_name
         FROM resource_requests rr
         LEFT JOIN professionals p ON rr.requested_by = p.professional_id
         WHERE rr.event_id = $1 AND rr.updated_at > $2`,
        [event_id, sinceDate]
      ),

      // Updated camps
      pool.query(
        `SELECT * FROM camps
         WHERE event_id = $1 AND updated_at > $2`,
        [event_id, sinceDate]
      ),

      // Deleted casualties recorded in the tracking table since `since`
      pool.query(
        `SELECT casualty_id FROM deleted_casualties
         WHERE event_id = $1 AND deleted_at > $2`,
        [event_id, sinceDate]
      )
    ]);

    const casualties = casualtiesResult.rows;
    const tasks = tasksResult.rows;
    const resources = resourcesResult.rows;
    const camps = campsResult.rows;
    const deletedCasualties = deletedResult.rows.map(r => r.casualty_id);

    return res.json({
      success: true,
      serverTime,
      event_id,
      changes: {
        casualties,
        tasks,
        resources,
        camps,
        deleted: {
          casualties: deletedCasualties
        }
      },
      counts: {
        casualties: casualties.length,
        tasks: tasks.length,
        resources: resources.length,
        camps: camps.length,
        deleted_casualties: deletedCasualties.length
      }
    });
  } catch (error) {
    console.error('GET /sync error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Sync failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ---------------------------------------------------------------------------
// dispatchOperation — maps method + path to a service function call.
// Returns { status, body }.
// ---------------------------------------------------------------------------
const PATH_PATTERNS = [
  {
    method: 'POST',
    re: /^casualties\/add$/,
    call: (match, body, user) => createCasualty(body, user, pool)
  },
  {
    method: 'PUT',
    re: /^casualties\/update\/([^/]+)\/status$/,
    call: (match, body, user) => updateCasualtyStatus(match[1], body, user, pool)
  },
  {
    method: 'POST',
    re: /^tasks\/create$/,
    call: (match, body, user) => createTask(body, user, pool)
  },
  {
    method: 'PUT',
    re: /^tasks\/update\/([^/]+)$/,
    call: (match, body, user) => updateTask(match[1], body, user, pool)
  },
  {
    method: 'POST',
    re: /^resources\/create$/,
    call: (match, body, user) => createResource(body, user, pool)
  },
  {
    method: 'PUT',
    re: /^resources\/update\/([^/]+)$/,
    call: (match, body, user) => updateResource(match[1], body, user, pool)
  },
  {
    method: 'PUT',
    re: /^resources\/confirm\/([^/]+)$/,
    call: (match, body, user) => confirmResource(match[1], body, user, pool)
  }
];

const dispatchOperation = (operation, user) => {
  const { method, path, body } = operation;
  for (const entry of PATH_PATTERNS) {
    if (entry.method !== method) continue;
    const match = path.match(entry.re);
    if (match) return entry.call(match, body, user);
  }
  return Promise.resolve({
    status: 400,
    body: { success: false, message: `Unknown operation: ${method} ${path}` }
  });
};

// ---------------------------------------------------------------------------
// POST /sync/batch
// Accepts an ordered array of operations, processes them sequentially.
// Individual failures do not abort the batch.
// ---------------------------------------------------------------------------
router.post('/batch', authenticateToken, [
  body('operations').isArray({ min: 1, max: 100 }).withMessage('operations must be a non-empty array of at most 100 items'),
  body('operations.*.idempotency_key').notEmpty().withMessage('each operation must have an idempotency_key'),
  body('operations.*.method').notEmpty().withMessage('each operation must have a method'),
  body('operations.*.path').notEmpty().withMessage('each operation must have a path'),
  body('operations.*.body').exists().withMessage('each operation must have a body')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { operations } = req.body;
    const professionalId = req.user.professional_id;
    const results = [];

    for (const operation of operations) {
      const { idempotency_key, method, path, body: opBody } = operation;

      try {
        // Check idempotency cache first
        const cached = await pool.query(
          `SELECT response_status, response_body
           FROM idempotency_keys
           WHERE key = $1
             AND professional_id = $2
             AND expires_at > CURRENT_TIMESTAMP`,
          [idempotency_key, professionalId]
        );

        if (cached.rows.length > 0) {
          const { response_status, response_body } = cached.rows[0];
          results.push({
            idempotency_key,
            status: response_status,
            body: response_body,
            replayed: true
          });
          continue;
        }

        // Cache miss — dispatch to service
        const result = await dispatchOperation({ method, path, body: opBody }, req.user);

        // Cache the result if successful
        if (result.status >= 200 && result.status < 300) {
          try {
            await pool.query(
              `INSERT INTO idempotency_keys
                 (key, professional_id, method, path, response_status, response_body, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP + INTERVAL '24 hours')
               ON CONFLICT (key) DO NOTHING`,
              [
                idempotency_key,
                professionalId,
                method,
                path,
                result.status,
                JSON.stringify(result.body)
              ]
            );
          } catch (cacheErr) {
            console.error('Batch idempotency cache write error:', cacheErr.message);
          }
        }

        results.push({
          idempotency_key,
          status: result.status,
          body: result.body,
          replayed: false
        });
      } catch (opErr) {
        console.error(`Batch operation error [${method} ${path}]:`, opErr.message);
        results.push({
          idempotency_key,
          status: 500,
          body: { success: false, message: 'Operation failed' },
          replayed: false
        });
      }
    }

    const succeeded = results.filter(r => r.status >= 200 && r.status < 300).length;
    const failed = results.length - succeeded;

    return res.json({
      success: true,
      processed: results.length,
      succeeded,
      failed,
      results
    });
  } catch (error) {
    console.error('POST /sync/batch error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Batch sync failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
