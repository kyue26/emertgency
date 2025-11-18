const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const pool = require('../config/database');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

const requireCommanderOrLead = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    if (req.user.role === 'Commander') {
      return next();
    }

    const result = await pool.query(
      'SELECT lead_professional_id FROM groups WHERE group_id = $1',
      [groupId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (result.rows[0].lead_professional_id !== req.user.professional_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Only commanders or group leaders can modify groups' 
      });
    }

    next();
  } catch (error) {
    console.error('Authorization check error:', error.message);
    res.status(500).json({ success: false, message: 'Authorization check failed' });
  }
};

// GET /groups
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('include_members').optional().isBoolean().toBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { page = 1, limit = 20, include_members = false } = req.query;
    const offset = (page - 1) * limit;

    let query;
    if (include_members) {
      query = `
        SELECT g.*,
               p.name as lead_name,
               p.email as lead_email,
               COUNT(DISTINCT pm.professional_id) as member_count,
               json_agg(
                 json_build_object(
                   'professional_id', pm.professional_id,
                   'name', pm.name,
                   'role', pm.role,
                   'email', pm.email
                 )
               ) FILTER (WHERE pm.professional_id IS NOT NULL) as members
        FROM groups g
        LEFT JOIN professionals p ON g.lead_professional_id = p.professional_id
        LEFT JOIN professionals pm ON pm.group_id = g.group_id
        GROUP BY g.group_id, p.professional_id, p.name, p.email
        ORDER BY g.created_at DESC
        LIMIT $1 OFFSET $2
      `;
    } else {
      query = `
        SELECT g.*,
               p.name as lead_name,
               p.email as lead_email,
               COUNT(DISTINCT pm.professional_id) as member_count
        FROM groups g
        LEFT JOIN professionals p ON g.lead_professional_id = p.professional_id
        LEFT JOIN professionals pm ON pm.group_id = g.group_id
        GROUP BY g.group_id, p.professional_id, p.name, p.email
        ORDER BY g.created_at DESC
        LIMIT $1 OFFSET $2
      `;
    }

    const countQuery = 'SELECT COUNT(*) as total FROM groups';

    const [result, countResult] = await Promise.all([
      pool.query(query, [limit, offset]),
      pool.query(countQuery)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      groups: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Get groups error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve groups',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /groups/:groupId
router.get('/:groupId', authenticateToken, [
  param('groupId').notEmpty().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;

    const result = await pool.query(
      `SELECT g.*,
              p.name as lead_name,
              p.email as lead_email,
              p.role as lead_role,
              json_agg(
                json_build_object(
                  'professional_id', pm.professional_id,
                  'name', pm.name,
                  'role', pm.role,
                  'email', pm.email,
                  'phone_number', pm.phone_number,
                  'current_camp_id', pm.current_camp_id
                ) ORDER BY pm.name
              ) FILTER (WHERE pm.professional_id IS NOT NULL) as members
       FROM groups g
       LEFT JOIN professionals p ON g.lead_professional_id = p.professional_id
       LEFT JOIN professionals pm ON pm.group_id = g.group_id
       WHERE g.group_id = $1
       GROUP BY g.group_id, p.professional_id, p.name, p.email, p.role`,
      [groupId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    res.json({
      success: true,
      group: result.rows[0]
    });
  } catch (error) {
    console.error('Get group error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve group',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /groups/register
router.post('/register', authenticateToken, [
  body('group_name').notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('lead_professional_id').optional().trim(),
  body('max_members').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { group_name, lead_professional_id, max_members } = req.body;
    const leadId = lead_professional_id || req.user.professional_id;

    // Only commanders can create groups with different leads
    if (leadId !== req.user.professional_id && req.user.role !== 'Commander') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only commanders can assign other users as group leaders' 
      });
    }

    await client.query('BEGIN');

    // Verify lead professional exists
    const professionalCheck = await client.query(
      'SELECT professional_id, name, group_id FROM professionals WHERE professional_id = $1',
      [leadId]
    );

    if (professionalCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'Lead professional not found' 
      });
    }

    // Check if lead is already in another group
    if (professionalCheck.rows[0].group_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `${professionalCheck.rows[0].name} is already a member of another group` 
      });
    }

    // Check for duplicate group name
    const duplicateCheck = await client.query(
      'SELECT group_id FROM groups WHERE LOWER(group_name) = LOWER($1)',
      [group_name]
    );

    if (duplicateCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'A group with this name already exists' 
      });
    }

    const group_id = `grp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create group
    const result = await client.query(
      `INSERT INTO groups (group_id, group_name, lead_professional_id, max_members, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
      [group_id, group_name, leadId, max_members || 10, req.user.professional_id]
    );

    // Add lead as member
    await client.query(
      'UPDATE professionals SET group_id = $1 WHERE professional_id = $2',
      [group_id, leadId]
    );

    // Log group creation
    await client.query(
      `INSERT INTO group_audit_log (group_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [group_id, 'created', req.user.professional_id, JSON.stringify({ group_name, lead_professional_id: leadId })]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Group registration error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Group registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// PUT /groups/update/:groupId
router.put('/update/:groupId', authenticateToken, requireCommanderOrLead, [
  param('groupId').notEmpty().trim(),
  body('group_name').optional().notEmpty().trim().isLength({ min: 2, max: 100 }),
  body('lead_professional_id').optional().trim(),
  body('max_members').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;
    const { group_name, lead_professional_id, max_members } = req.body;

    await client.query('BEGIN');

    // Get current group state
    const groupCheck = await client.query(
      `SELECT g.*, COUNT(p.professional_id) as current_member_count
       FROM groups g
       LEFT JOIN professionals p ON p.group_id = g.group_id
       WHERE g.group_id = $1
       GROUP BY g.group_id`,
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupCheck.rows[0];
    const currentMemberCount = parseInt(group.current_member_count);

    // Validate new lead if provided
    if (lead_professional_id && lead_professional_id !== group.lead_professional_id) {
      const newLeadCheck = await client.query(
        'SELECT professional_id, name, group_id FROM professionals WHERE professional_id = $1',
        [lead_professional_id]
      );

      if (newLeadCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          success: false, 
          message: 'New lead professional not found' 
        });
      }

      // Check if new lead is in this group or no group
      if (newLeadCheck.rows[0].group_id && newLeadCheck.rows[0].group_id !== groupId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          success: false, 
          message: 'New lead is a member of a different group' 
        });
      }

      // Add new lead to group if not already a member
      if (!newLeadCheck.rows[0].group_id) {
        await client.query(
          'UPDATE professionals SET group_id = $1 WHERE professional_id = $2',
          [groupId, lead_professional_id]
        );
      }
    }

    // Check if reducing max_members below current count
    if (max_members !== undefined && max_members < currentMemberCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `Cannot reduce max_members to ${max_members}. Group currently has ${currentMemberCount} members.` 
      });
    }

    // Check for duplicate name
    if (group_name && group_name.toLowerCase() !== group.group_name.toLowerCase()) {
      const duplicateCheck = await client.query(
        'SELECT group_id FROM groups WHERE LOWER(group_name) = LOWER($1) AND group_id != $2',
        [group_name, groupId]
      );

      if (duplicateCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          success: false, 
          message: 'A group with this name already exists' 
        });
      }
    }

    const updates = [];
    const values = [];
    const changes = {};
    let paramCount = 1;

    if (group_name && group_name !== group.group_name) {
      updates.push(`group_name = $${paramCount++}`);
      values.push(group_name);
      changes.group_name = { from: group.group_name, to: group_name };
    }
    if (lead_professional_id && lead_professional_id !== group.lead_professional_id) {
      updates.push(`lead_professional_id = $${paramCount++}`);
      values.push(lead_professional_id);
      changes.lead_professional_id = { from: group.lead_professional_id, to: lead_professional_id };
    }
    if (max_members !== undefined && max_members !== group.max_members) {
      updates.push(`max_members = $${paramCount++}`);
      values.push(max_members);
      changes.max_members = { from: group.max_members, to: max_members };
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No changes detected' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.user.professional_id);
    values.push(groupId);

    const result = await client.query(
      `UPDATE groups SET ${updates.join(', ')} 
       WHERE group_id = $${paramCount} RETURNING *`,
      values
    );

    // Log the update
    await client.query(
      `INSERT INTO group_audit_log (group_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [groupId, 'updated', req.user.professional_id, JSON.stringify(changes)]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Group updated successfully',
      group: result.rows[0],
      changes: Object.keys(changes)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Group update error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Group update failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// POST /groups/:groupId/members/add
router.post('/:groupId/members/add', authenticateToken, requireCommanderOrLead, [
  param('groupId').notEmpty().trim(),
  body('professional_id').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;
    const { professional_id } = req.body;

    await client.query('BEGIN');

    // Check group exists and capacity
    const groupCheck = await client.query(
      `SELECT g.*, COUNT(p.professional_id) as current_member_count
       FROM groups g
       LEFT JOIN professionals p ON p.group_id = g.group_id
       WHERE g.group_id = $1
       GROUP BY g.group_id`,
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupCheck.rows[0];
    const currentCount = parseInt(group.current_member_count);

    if (currentCount >= group.max_members) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `Group is at capacity (${group.max_members} members)` 
      });
    }

    // Check professional exists and availability
    const professionalCheck = await client.query(
      'SELECT professional_id, name, group_id FROM professionals WHERE professional_id = $1',
      [professional_id]
    );

    if (professionalCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Professional not found' });
    }

    const professional = professionalCheck.rows[0];

    if (professional.group_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `${professional.name} is already a member of ${professional.group_id === groupId ? 'this' : 'another'} group` 
      });
    }

    // Add member
    await client.query(
      'UPDATE professionals SET group_id = $1 WHERE professional_id = $2',
      [groupId, professional_id]
    );

    // Log the addition
    await client.query(
      `INSERT INTO group_audit_log (group_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [groupId, 'member_added', req.user.professional_id, JSON.stringify({ professional_id, name: professional.name })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${professional.name} added to group successfully`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Add member error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to add member',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /groups/:groupId/members/remove/:professionalId
router.delete('/:groupId/members/remove/:professionalId', authenticateToken, requireCommanderOrLead, [
  param('groupId').notEmpty().trim(),
  param('professionalId').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId, professionalId } = req.params;

    await client.query('BEGIN');

    // Check group and member
    const groupCheck = await client.query(
      'SELECT lead_professional_id FROM groups WHERE group_id = $1',
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Can't remove the lead
    if (groupCheck.rows[0].lead_professional_id === professionalId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot remove group leader. Transfer leadership first.' 
      });
    }

    const memberCheck = await client.query(
      'SELECT professional_id, name, group_id FROM professionals WHERE professional_id = $1',
      [professionalId]
    );

    if (memberCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Professional not found' });
    }

    if (memberCheck.rows[0].group_id !== groupId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'Professional is not a member of this group' 
      });
    }

    // Remove member
    await client.query(
      'UPDATE professionals SET group_id = NULL WHERE professional_id = $1',
      [professionalId]
    );

    // Log removal
    await client.query(
      `INSERT INTO group_audit_log (group_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [groupId, 'member_removed', req.user.professional_id, JSON.stringify({ 
        professional_id: professionalId, 
        name: memberCheck.rows[0].name 
      })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `${memberCheck.rows[0].name} removed from group successfully`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Remove member error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to remove member',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

// DELETE /groups/delete/:groupId
router.delete('/delete/:groupId', authenticateToken, [
  param('groupId').notEmpty().trim(),
  query('force').optional().isBoolean().toBoolean()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { groupId } = req.params;
    const { force } = req.query;

    // Only commanders can delete groups
    if (req.user.role !== 'Commander') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only commanders can delete groups' 
      });
    }

    await client.query('BEGIN');

    // Check group and members
    const groupCheck = await client.query(
      `SELECT g.*, COUNT(p.professional_id) as member_count
       FROM groups g
       LEFT JOIN professionals p ON p.group_id = g.group_id
       WHERE g.group_id = $1
       GROUP BY g.group_id`,
      [groupId]
    );

    if (groupCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const group = groupCheck.rows[0];
    const memberCount = parseInt(group.member_count);

    // Warn if group has members
    if (memberCount > 0 && !force) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: `Group has ${memberCount} member(s). Use ?force=true to delete anyway.`,
        details: { members: memberCount }
      });
    }

    // Remove all members from group
    if (memberCount > 0) {
      await client.query(
        'UPDATE professionals SET group_id = NULL WHERE group_id = $1',
        [groupId]
      );
    }

    // Delete group
    await client.query('DELETE FROM groups WHERE group_id = $1', [groupId]);

    // Log deletion
    await client.query(
      `INSERT INTO group_audit_log (group_id, action, performed_by, details, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
      [groupId, 'deleted', req.user.professional_id, JSON.stringify({ 
        group_name: group.group_name,
        force,
        members_removed: memberCount 
      })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Group deleted successfully',
      members_removed: memberCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Group delete error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Group deletion failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

module.exports = router;