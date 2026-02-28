const express = require('express');
const pool = require('../config/database');
const { authenticateToken, authorize } = require('../config/auth');

const router = express.Router();

// GET /locations/active
router.get('/locations/active', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, e.name as event_name, e.status as event_status,
             COUNT(DISTINCT p.professional_id) as professionals_count,
             COUNT(DISTINCT ip.injured_person_id) as casualties_count
      FROM camps c
      JOIN events e ON c.event_id = e.event_id
      LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
      LEFT JOIN injured_persons ip ON ip.camp_id = c.camp_id
      WHERE e.status = 'in_progress'
      GROUP BY c.camp_id, e.event_id, e.name, e.status
      ORDER BY e.start_time DESC, c.location_name
    `);

    res.json({
      success: true,
      activeLocations: result.rows
    });
  } catch (error) {
    console.error('Get active locations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve active locations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /hospitals
router.get('/hospitals', authenticateToken, async (req, res) => {
  try {
    // Get hospital transfer statistics
    const statsResult = await pool.query(`
      SELECT 
        hospital_status,
        COUNT(*) as patient_count,
        COUNT(CASE WHEN color = 'red' THEN 1 END) as red_patients,
        COUNT(CASE WHEN color = 'yellow' THEN 1 END) as yellow_patients,
        COUNT(CASE WHEN color = 'green' THEN 1 END) as green_patients
      FROM injured_persons
      WHERE hospital_status IS NOT NULL AND hospital_status != ''
      GROUP BY hospital_status
      ORDER BY patient_count DESC
    `);

    // Fetch hospitals from database (create this table if it doesn't exist)
    const hospitalsResult = await pool.query(`
      SELECT name, distance, trauma_level, capacity, contact_number
      FROM hospitals
      WHERE is_active = true
      ORDER BY distance
    `);

    // Fallback to hardcoded list if database doesn't have hospitals table yet
    const hospitals = hospitalsResult.rows.length > 0 ? hospitalsResult.rows : [
      { name: 'Hospital of the University of Pennsylvania (HUP)', distance: '0.5 miles', trauma_level: 1 },
      { name: 'Penn Presbyterian Medical Center', distance: '2.3 miles', trauma_level: 1 },
      { name: "Children's Hospital of Philadelphia", distance: '1.2 miles', trauma_level: 1 },
      { name: 'Pennsylvania Hospital', distance: '1.8 miles', trauma_level: 2 },
      { name: 'Jefferson Hospital', distance: '2.5 miles', trauma_level: 1 }
    ];

    res.json({
      success: true,
      hospitals: hospitals,
      transferStatistics: statsResult.rows
    });
  } catch (error) {
    console.error('Get hospitals error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve hospital data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /reports/summary
router.get('/reports/summary', authenticateToken, async (req, res) => {
  try {
    const { event_id, start_date, end_date } = req.query;

    // Validate inputs
    if (event_id && isNaN(parseInt(event_id))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid event_id parameter' 
      });
    }

    if ((start_date && !end_date) || (!start_date && end_date)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both start_date and end_date are required when filtering by date' 
      });
    }

    // Build dynamic query safely
    let whereClause = '';
    const params = [];

    if (event_id) {
      whereClause = 'WHERE e.event_id = $1';
      params.push(event_id);
    } else if (start_date && end_date) {
      whereClause = 'WHERE e.start_time BETWEEN $1 AND $2';
      params.push(start_date, end_date);
    }

    // Get event statistics
    const eventStats = await pool.query(`
      SELECT 
        e.event_id,
        e.name as event_name,
        e.status,
        e.start_time,
        e.finish_time,
        COUNT(DISTINCT c.camp_id) as total_camps,
        COUNT(DISTINCT p.professional_id) as total_professionals,
        COUNT(DISTINCT ip.injured_person_id) as total_casualties,
        COUNT(DISTINCT CASE WHEN ip.color = 'green' THEN ip.injured_person_id END) as green_count,
        COUNT(DISTINCT CASE WHEN ip.color = 'yellow' THEN ip.injured_person_id END) as yellow_count,
        COUNT(DISTINCT CASE WHEN ip.color = 'red' THEN ip.injured_person_id END) as red_count,
        COUNT(DISTINCT CASE WHEN ip.color = 'black' THEN ip.injured_person_id END) as black_count,
        COUNT(DISTINCT t.task_id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.task_id END) as completed_tasks
      FROM events e
      LEFT JOIN camps c ON e.event_id = c.event_id
      LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
      LEFT JOIN injured_persons ip ON e.event_id = ip.event_id
      LEFT JOIN tasks t ON e.event_id = t.event_id
      ${whereClause}
      GROUP BY e.event_id, e.name, e.status, e.start_time, e.finish_time
      ORDER BY e.start_time DESC
    `, params);

    // FIXED: Get overall statistics without CROSS JOIN
    const overallStats = await pool.query(`
      SELECT 
        (SELECT COUNT(DISTINCT event_id) FROM events) as total_events,
        (SELECT COUNT(DISTINCT event_id) FROM events WHERE status = 'in_progress') as active_events,
        (SELECT COUNT(DISTINCT professional_id) FROM professionals) as total_professionals,
        (SELECT COUNT(DISTINCT group_id) FROM groups) as total_groups,
        (SELECT COUNT(DISTINCT injured_person_id) FROM injured_persons) as total_casualties_all_time
    `);

    res.json({
      success: true,
      summary: {
        overall: overallStats.rows[0],
        events: eventStats.rows,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get summary report error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate summary report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;