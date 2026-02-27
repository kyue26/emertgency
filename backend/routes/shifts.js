const express = require('express');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// POST /shifts/check-in
router.post('/check-in', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const professionalId = req.user.professional_id;

    await client.query('BEGIN');

    const profResult = await client.query(
      'SELECT current_event_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    if (profResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const eventId = profResult.rows[0].current_event_id;
    if (!eventId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You must be in an event to check in'
      });
    }

    const openShift = await client.query(
      'SELECT shift_id FROM shifts WHERE professional_id = $1 AND check_out IS NULL',
      [professionalId]
    );

    if (openShift.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'You already have an open shift. Check out first.'
      });
    }

    const shiftId = `shft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await client.query(
      `INSERT INTO shifts (shift_id, professional_id, event_id, check_in)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *`,
      [shiftId, professionalId, eventId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Checked in successfully',
      shift: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Check-in error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check in',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// POST /shifts/check-out
router.post('/check-out', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const professionalId = req.user.professional_id;

    await client.query('BEGIN');

    const openShift = await client.query(
      'SELECT shift_id, check_in FROM shifts WHERE professional_id = $1 AND check_out IS NULL',
      [professionalId]
    );

    if (openShift.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No open shift to check out of'
      });
    }

    const result = await client.query(
      `UPDATE shifts SET check_out = CURRENT_TIMESTAMP
       WHERE shift_id = $1 RETURNING *`,
      [openShift.rows[0].shift_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Checked out successfully',
      shift: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Check-out error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check out',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// GET /shifts/my-shifts
router.get('/my-shifts', authenticateToken, async (req, res) => {
  try {
    const professionalId = req.user.professional_id;

    const profResult = await pool.query(
      'SELECT current_event_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    if (profResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const eventId = profResult.rows[0].current_event_id;
    if (!eventId) {
      return res.json({
        success: true,
        is_on_duty: false,
        current_shift: null,
        total_shifts: 0,
        total_hours: 0,
        shifts: []
      });
    }

    const shiftsResult = await pool.query(
      `SELECT shift_id, check_in, check_out,
              CASE
                WHEN check_out IS NOT NULL THEN EXTRACT(EPOCH FROM (check_out - check_in)) / 3600.0
                ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - check_in)) / 3600.0
              END as duration_hours
       FROM shifts
       WHERE professional_id = $1 AND event_id = $2
       ORDER BY check_in DESC`,
      [professionalId, eventId]
    );

    const shifts = shiftsResult.rows;
    const currentShift = shifts.find(s => s.check_out === null) || null;
    const isOnDuty = currentShift !== null;

    const totalHours = shifts.reduce((sum, s) => sum + parseFloat(s.duration_hours), 0);

    res.json({
      success: true,
      is_on_duty: isOnDuty,
      current_shift: currentShift,
      total_shifts: shifts.length,
      total_hours: Math.round(totalHours * 100) / 100,
      shifts: shifts.map(s => ({
        shift_id: s.shift_id,
        check_in: s.check_in,
        check_out: s.check_out,
        duration_hours: Math.round(parseFloat(s.duration_hours) * 100) / 100
      }))
    });
  } catch (error) {
    console.error('Get my shifts error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve shifts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
