const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../config/auth');

const router = express.Router();

// GET /hospitals - Get all hospitals (optional ?isActive=true/false)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.query;

    let queryText = 'SELECT * FROM hospitals';
    const params = [];

    if (isActive !== undefined) {
      queryText += ' WHERE is_active = $1';
      params.push(isActive === 'true');
    }

    queryText += ' ORDER BY trauma_level, name';

    const result = await pool.query(queryText, params);

    res.json({
      success: true,
      hospitals: result.rows
    });
  } catch (error) {
    console.error('Get hospitals error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hospitals',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /hospitals/:id - Get hospital by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM hospitals WHERE hospital_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      hospital: result.rows[0]
    });
  } catch (error) {
    console.error('Get hospital error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /hospitals - Create new hospital
router.post('/', authenticateToken, authorize('Commander', 'Medical Officer'), async (req, res) => {
  try {
    const {
      name,
      distance,
      traumaLevel,
      trauma_level,
      capacity,
      contactNumber,
      contact_number,
      address,
      isActive,
      is_active
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Hospital name is required'
      });
    }

    const result = await pool.query(
      `INSERT INTO hospitals (name, distance, trauma_level, capacity, contact_number, address, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name,
        distance ?? null,
        traumaLevel ?? trauma_level ?? null,
        capacity ?? null,
        contactNumber ?? contact_number ?? null,
        address ?? null,
        isActive !== false && is_active !== false
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Hospital created successfully',
      hospital: result.rows[0]
    });
  } catch (error) {
    console.error('Create hospital error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /hospitals/:id - Update hospital
router.put('/:id', authenticateToken, authorize('Commander', 'Medical Officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      distance,
      traumaLevel,
      trauma_level,
      capacity,
      contactNumber,
      contact_number,
      address,
      isActive,
      is_active
    } = req.body;

    const result = await pool.query(
      `UPDATE hospitals
       SET name = COALESCE($1, name),
           distance = COALESCE($2, distance),
           trauma_level = COALESCE($3, trauma_level),
           capacity = COALESCE($4, capacity),
           contact_number = COALESCE($5, contact_number),
           address = COALESCE($6, address),
           is_active = COALESCE($7, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE hospital_id = $8
       RETURNING *`,
      [
        name ?? null,
        distance ?? null,
        traumaLevel ?? trauma_level ?? null,
        capacity ?? null,
        contactNumber ?? contact_number ?? null,
        address ?? null,
        isActive ?? is_active ?? null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital updated successfully',
      hospital: result.rows[0]
    });
  } catch (error) {
    console.error('Update hospital error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /hospitals/:id - Delete hospital
router.delete('/:id', authenticateToken, authorize('Commander'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM hospitals WHERE hospital_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    res.json({
      success: true,
      message: 'Hospital deleted successfully',
      hospital: result.rows[0]
    });
  } catch (error) {
    console.error('Delete hospital error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete hospital',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
