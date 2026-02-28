import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all resource requests
router.get('/', authenticate, async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        rr.*,
        e.name as event_name,
        p.name as requested_by_name
      FROM resource_requests rr
      LEFT JOIN events e ON rr.event_id = e.event_id
      LEFT JOIN professionals p ON rr.requested_by = p.professional_id
      ORDER BY rr.created_at DESC
    `;

    const result = await query(sqlQuery);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching resource requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource requests',
      error: error.message
    });
  }
});

// Get resource requests for a specific event
router.get('/event/:eventId', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;

    const sqlQuery = `
      SELECT 
        rr.*,
        p.name as requested_by_name
      FROM resource_requests rr
      LEFT JOIN professionals p ON rr.requested_by = p.professional_id
      WHERE rr.event_id = $1
      ORDER BY rr.created_at DESC
    `;

    const result = await query(sqlQuery, [eventId]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching resource requests for event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource requests for event',
      error: error.message
    });
  }
});

// Create a new resource request
router.post('/', authenticate, async (req, res) => {
  try {
    const { resource_request_id, event_id, resource_name, confirmed, time_of_arrival } = req.body;
    const requested_by = req.user.professionalId;

    const sqlQuery = `
      INSERT INTO resource_requests 
        (resource_request_id, event_id, resource_name, confirmed, time_of_arrival, requested_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await query(sqlQuery, [
      resource_request_id,
      event_id,
      resource_name,
      confirmed || false,
      time_of_arrival,
      requested_by
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Resource request created successfully'
    });
  } catch (error) {
    console.error('Error creating resource request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create resource request',
      error: error.message
    });
  }
});

// Update a resource request
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { resource_name, confirmed, time_of_arrival } = req.body;

    const sqlQuery = `
      UPDATE resource_requests 
      SET 
        resource_name = COALESCE($1, resource_name),
        confirmed = COALESCE($2, confirmed),
        time_of_arrival = COALESCE($3, time_of_arrival),
        updated_at = CURRENT_TIMESTAMP
      WHERE resource_request_id = $4
      RETURNING *
    `;

    const result = await query(sqlQuery, [
      resource_name,
      confirmed,
      time_of_arrival,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resource request not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Resource request updated successfully'
    });
  } catch (error) {
    console.error('Error updating resource request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resource request',
      error: error.message
    });
  }
});

// Delete a resource request
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const sqlQuery = 'DELETE FROM resource_requests WHERE resource_request_id = $1 RETURNING *';
    const result = await query(sqlQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Resource request not found'
      });
    }

    res.json({
      success: true,
      message: 'Resource request deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting resource request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource request',
      error: error.message
    });
  }
});

export default router;
