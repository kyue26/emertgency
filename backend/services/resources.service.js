// resources.service.js
// Pure business logic extracted from routes/resources.js.
// Each function accepts (body, user, pool) and returns { status, body }.

const logResourceChange = async (client, resourceRequestId, professionalId, action, details) => {
  try {
    await client.query(
      `INSERT INTO resource_request_audit_log
       (resource_request_id, action, changed_by, details, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [resourceRequestId, action, professionalId, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

// POST /resources/create
const createResource = async (body, user, pool) => {
  const { event_id, resource_name, quantity, priority, time_of_arrival, notes } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventCheck = await client.query(
      'SELECT event_id, status FROM events WHERE event_id = $1',
      [event_id]
    );

    if (eventCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Event not found' } };
    }

    if (eventCheck.rows[0].status === 'finished' || eventCheck.rows[0].status === 'cancelled') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot create resource requests for finished or cancelled events' } };
    }

    const resource_request_id = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO resource_requests
       (resource_request_id, event_id, resource_name, quantity, priority,
        time_of_arrival, notes, requested_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        resource_request_id,
        event_id,
        resource_name,
        quantity || 1,
        priority || 'medium',
        time_of_arrival || null,
        notes || null,
        user.professional_id
      ]
    );

    await logResourceChange(
      client,
      resource_request_id,
      user.professional_id,
      'created',
      { resource_name, quantity: quantity || 1, priority: priority || 'medium' }
    );

    await client.query('COMMIT');

    return {
      status: 201,
      body: {
        success: true,
        message: 'Resource request created successfully',
        resourceRequest: result.rows[0]
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createResource error:', error.message);

    if (error.code === '23503') {
      return { status: 400, body: { success: false, message: 'Invalid event_id' } };
    }

    return { status: 500, body: { success: false, message: 'Failed to create resource request' } };
  } finally {
    client.release();
  }
};

// PUT /resources/update/:resourceRequestId
const updateResource = async (resourceRequestId, body, user, pool) => {
  const { resource_name, quantity, priority, time_of_arrival, notes } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentState = await client.query(
      `SELECT rr.*, e.status as event_status
       FROM resource_requests rr
       JOIN events e ON rr.event_id = e.event_id
       WHERE rr.resource_request_id = $1`,
      [resourceRequestId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Resource request not found' } };
    }

    const resourceRequest = currentState.rows[0];

    if (user.role !== 'Commander' && resourceRequest.requested_by !== user.professional_id) {
      await client.query('ROLLBACK');
      return { status: 403, body: { success: false, message: 'You can only modify your own resource requests' } };
    }

    if (resourceRequest.event_status === 'finished' || resourceRequest.event_status === 'cancelled') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot modify resource requests in finished or cancelled events' } };
    }

    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (resource_name && resource_name !== resourceRequest.resource_name) {
      updates.push(`resource_name = $${paramCount++}`);
      values.push(resource_name);
      changes.resource_name = { from: resourceRequest.resource_name, to: resource_name };
    }
    if (quantity !== undefined && quantity !== resourceRequest.quantity) {
      updates.push(`quantity = $${paramCount++}`);
      values.push(quantity);
      changes.quantity = { from: resourceRequest.quantity, to: quantity };
    }
    if (priority && priority !== resourceRequest.priority) {
      updates.push(`priority = $${paramCount++}`);
      values.push(priority);
      changes.priority = { from: resourceRequest.priority, to: priority };
    }
    if (time_of_arrival !== undefined) {
      updates.push(`time_of_arrival = $${paramCount++}`);
      values.push(time_of_arrival || null);
      changes.time_of_arrival = { from: resourceRequest.time_of_arrival, to: time_of_arrival };
    }
    if (notes !== undefined && notes !== resourceRequest.notes) {
      updates.push(`notes = $${paramCount++}`);
      values.push(notes || null);
      changes.notes = { from: resourceRequest.notes, to: notes };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'No changes detected' } };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(resourceRequestId);

    const result = await client.query(
      `UPDATE resource_requests SET ${updates.join(', ')}
       WHERE resource_request_id = $${paramCount}
       RETURNING *`,
      values
    );

    await logResourceChange(client, resourceRequestId, user.professional_id, 'updated', changes);

    await client.query('COMMIT');

    return {
      status: 200,
      body: {
        success: true,
        message: 'Resource request updated successfully',
        resourceRequest: result.rows[0],
        changes: Object.keys(changes)
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateResource error:', error.message);
    return { status: 500, body: { success: false, message: 'Failed to update resource request' } };
  } finally {
    client.release();
  }
};

// PUT /resources/confirm/:resourceRequestId
const confirmResource = async (resourceRequestId, body, user, pool) => {
  const { confirmed, time_of_arrival } = body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentState = await client.query(
      `SELECT rr.*, e.status as event_status
       FROM resource_requests rr
       JOIN events e ON rr.event_id = e.event_id
       WHERE rr.resource_request_id = $1`,
      [resourceRequestId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Resource request not found' } };
    }

    const resourceRequest = currentState.rows[0];

    if (resourceRequest.event_status === 'finished' || resourceRequest.event_status === 'cancelled') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot confirm resource requests in finished or cancelled events' } };
    }

    const updates = ['confirmed = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [confirmed];
    let paramCount = 2;

    if (confirmed) {
      updates.push(`confirmed_by = $${paramCount++}`);
      values.push(user.professional_id);

      if (time_of_arrival) {
        updates.push(`time_of_arrival = $${paramCount++}`);
        values.push(time_of_arrival);
      }
    } else {
      updates.push('confirmed_by = NULL');
    }

    values.push(resourceRequestId);

    const result = await client.query(
      `UPDATE resource_requests SET ${updates.join(', ')}
       WHERE resource_request_id = $${paramCount}
       RETURNING *`,
      values
    );

    await logResourceChange(
      client,
      resourceRequestId,
      user.professional_id,
      confirmed ? 'confirmed' : 'unconfirmed',
      { confirmed, time_of_arrival }
    );

    await client.query('COMMIT');

    return {
      status: 200,
      body: {
        success: true,
        message: `Resource request ${confirmed ? 'confirmed' : 'unconfirmed'} successfully`,
        resourceRequest: result.rows[0]
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('confirmResource error:', error.message);
    return { status: 500, body: { success: false, message: 'Failed to confirm resource request' } };
  } finally {
    client.release();
  }
};

module.exports = { createResource, updateResource, confirmResource };
