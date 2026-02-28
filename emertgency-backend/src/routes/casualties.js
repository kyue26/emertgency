import express from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get casualty statistics by priority color
router.get('/statistics', authenticate, async (req, res) => {
  try {
    const sqlQuery = `
      SELECT 
        color,
        COUNT(*) FILTER (WHERE hospital_status IS NULL OR hospital_status = '') as in_treatment,
        COUNT(*) FILTER (WHERE hospital_status IS NOT NULL AND hospital_status != '') as transported,
        COUNT(*) as total
      FROM injured_persons
      GROUP BY color
      ORDER BY 
        CASE color
          WHEN 'red' THEN 1
          WHEN 'yellow' THEN 2
          WHEN 'green' THEN 3
          WHEN 'black' THEN 4
        END
    `;

    const result = await query(sqlQuery);
    
    // Format the response with all priority levels, even if count is 0
    const statistics = {
      red: { color: 'red', in_treatment: 0, transported: 0, total: 0 },
      yellow: { color: 'yellow', in_treatment: 0, transported: 0, total: 0 },
      green: { color: 'green', in_treatment: 0, transported: 0, total: 0 },
      black: { color: 'black', in_treatment: 0, transported: 0, total: 0 }
    };

    // Fill in actual data
    result.rows.forEach(row => {
      statistics[row.color] = {
        color: row.color,
        in_treatment: parseInt(row.in_treatment),
        transported: parseInt(row.transported),
        total: parseInt(row.total)
      };
    });

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching casualty statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch casualty statistics',
      error: error.message
    });
  }
});

export default router;
