// casualties.service.js
// Pure business logic extracted from routes/casualties.js.
// Each function accepts (body, user, pool) and returns { status, body }.
// No res.json calls — callers decide how to send the response.

const logCasualtyChange = async (client, casualtyId, professionalId, changes, previousState) => {
  try {
    await client.query(
      `INSERT INTO casualty_audit_log
       (casualty_id, changed_by, changes, previous_state, changed_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [casualtyId, professionalId, JSON.stringify(changes), JSON.stringify(previousState)]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
  }
};

// POST /casualties - Create casualty (accepts event_id/eventId, camp_id/campId, injured_person_id/injuredPersonId)
const createCasualty = async (body, user, pool) => {
  const event_id = body.event_id || body.eventId;
  if (!event_id) {
    return { status: 400, body: { success: false, message: 'event_id or eventId is required' } };
  }
  const camp_id = body.camp_id || body.campId;
  const color = body.color;
  const breathing = body.breathing;
  const conscious = body.conscious;
  const bleeding = body.bleeding;
  const hospital_status = body.hospital_status || body.hospitalStatus;
  const other_information = body.other_information || body.otherInformation;
  const injured_person_id = body.injured_person_id || body.injuredPersonId || `inj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    if (eventCheck.rows[0].status === 'finished') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot add casualties to finished events' } };
    }

    if (camp_id) {
      const campCheck = await client.query(
        'SELECT camp_id, event_id FROM camps WHERE camp_id = $1',
        [camp_id]
      );

      if (campCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 404, body: { success: false, message: 'Camp not found' } };
      }

      if (campCheck.rows[0].event_id !== event_id) {
        await client.query('ROLLBACK');
        return { status: 400, body: { success: false, message: 'Camp does not belong to specified event' } };
      }
    }

    const result = await client.query(
      `INSERT INTO injured_persons
       (injured_person_id, event_id, camp_id, color, breathing, conscious, bleeding,
        hospital_status, other_information, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        injured_person_id, event_id, camp_id, color,
        breathing ?? null, conscious ?? null, bleeding ?? null,
        hospital_status || null, other_information || null,
        user.professional_id
      ]
    );

    await logCasualtyChange(client, injured_person_id, user.professional_id, { action: 'created', ...body }, null);

    await client.query('COMMIT');

    return {
      status: 201,
      body: {
        success: true,
        message: 'Casualty created successfully',
        casualty: result.rows[0]
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createCasualty error:', error.message);

    if (error.code === '23503') {
      return { status: 400, body: { success: false, message: 'Invalid event_id or camp_id' } };
    }
    if (error.code === '23505') {
      return { status: 409, body: { success: false, message: 'Casualty ID already exists' } };
    }

    return { status: 500, body: { success: false, message: 'Failed to create casualty' } };
  } finally {
    client.release();
  }
};

// PUT /casualties/update/:casualtyId/status
const updateCasualtyStatus = async (casualtyId, body, user, pool) => {
  const color = body.color;
  const breathing = body.breathing;
  const conscious = body.conscious;
  const bleeding = body.bleeding;
  const hospital_status = body.hospital_status ?? body.hospitalStatus;
  const other_information = body.other_information ?? body.otherInformation;
  const camp_id = body.camp_id ?? body.campId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentState = await client.query(
      `SELECT ip.*, e.status as event_status
       FROM injured_persons ip
       JOIN events e ON ip.event_id = e.event_id
       WHERE ip.injured_person_id = $1`,
      [casualtyId]
    );

    if (currentState.rows.length === 0) {
      await client.query('ROLLBACK');
      return { status: 404, body: { success: false, message: 'Casualty not found' } };
    }

    const casualty = currentState.rows[0];

    if (user.role !== 'Commander') {
      const accessCheck = await client.query(
        `SELECT 1 FROM professionals p
         JOIN camps c ON p.current_camp_id = c.camp_id
         WHERE c.event_id = $1 AND p.professional_id = $2`,
        [casualty.event_id, user.professional_id]
      );

      if (accessCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 403, body: { success: false, message: 'You do not have access to modify this casualty' } };
      }
    }

    if (casualty.event_status === 'finished') {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'Cannot modify casualties in finished events' } };
    }

    if (camp_id && camp_id !== casualty.camp_id) {
      const campCheck = await client.query(
        'SELECT camp_id, event_id FROM camps WHERE camp_id = $1',
        [camp_id]
      );

      if (campCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return { status: 404, body: { success: false, message: 'Camp not found' } };
      }

      if (campCheck.rows[0].event_id !== casualty.event_id) {
        await client.query('ROLLBACK');
        return { status: 400, body: { success: false, message: 'Cannot transfer casualty to camp in different event' } };
      }
    }

    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (color && color !== casualty.color) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
      changes.color = { from: casualty.color, to: color };
    }
    if (breathing !== undefined && breathing !== casualty.breathing) {
      updates.push(`breathing = $${paramCount++}`);
      values.push(breathing);
      changes.breathing = { from: casualty.breathing, to: breathing };
    }
    if (conscious !== undefined && conscious !== casualty.conscious) {
      updates.push(`conscious = $${paramCount++}`);
      values.push(conscious);
      changes.conscious = { from: casualty.conscious, to: conscious };
    }
    if (bleeding !== undefined && bleeding !== casualty.bleeding) {
      updates.push(`bleeding = $${paramCount++}`);
      values.push(bleeding);
      changes.bleeding = { from: casualty.bleeding, to: bleeding };
    }
    if (hospital_status !== undefined && hospital_status !== casualty.hospital_status) {
      updates.push(`hospital_status = $${paramCount++}`);
      values.push(hospital_status || null);
      changes.hospital_status = { from: casualty.hospital_status, to: hospital_status };
    }
    if (other_information !== undefined && other_information !== casualty.other_information) {
      updates.push(`other_information = $${paramCount++}`);
      values.push(other_information || null);
      changes.other_information = { from: casualty.other_information, to: other_information };
    }
    if (camp_id && camp_id !== casualty.camp_id) {
      updates.push(`camp_id = $${paramCount++}`);
      values.push(camp_id);
      changes.camp_id = { from: casualty.camp_id, to: camp_id };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return { status: 400, body: { success: false, message: 'No changes detected' } };
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(user.professional_id);
    values.push(casualtyId);

    const result = await client.query(
      `UPDATE injured_persons SET ${updates.join(', ')}
       WHERE injured_person_id = $${paramCount}
       RETURNING *`,
      values
    );

    await logCasualtyChange(client, casualtyId, user.professional_id, changes, casualty);

    await client.query('COMMIT');

    return {
      status: 200,
      body: {
        success: true,
        message: 'Casualty status updated successfully',
        casualty: result.rows[0],
        changes: Object.keys(changes)
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateCasualtyStatus error:', error.message);

    if (error.code === '23503') {
      return { status: 400, body: { success: false, message: 'Invalid camp_id' } };
    }

    return { status: 500, body: { success: false, message: 'Failed to update casualty' } };
  } finally {
    client.release();
  }
};

module.exports = { createCasualty, updateCasualtyStatus };
