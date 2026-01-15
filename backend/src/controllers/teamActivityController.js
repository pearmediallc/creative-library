/**
 * Team Activity Controller
 * Handles team activity feed and logging
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get team activity feed
 * GET /api/teams/:teamId/activity
 */
async function getTeamActivity(req, res) {
  try {
    const { teamId } = req.params;
    const { type, userId, limit = 50, offset = 0 } = req.query;
    const currentUserId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, currentUserId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Build query with optional filters
    let whereConditions = ['ta.team_id = $1'];
    let params = [teamId];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`ta.activity_type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    if (userId) {
      whereConditions.push(`ta.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await query(
      `SELECT
        ta.*,
        u.username,
        u.email
       FROM team_activity ta
       JOIN users u ON ta.user_id = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY ta.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team activity failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch team activity' });
  }
}

/**
 * Log team activity (internal use or webhooks)
 * POST /api/teams/:teamId/activity
 */
async function logTeamActivity(req, res) {
  try {
    const { teamId } = req.params;
    const { activityType, resourceType, resourceId, metadata } = req.body;
    const userId = req.user.id;

    if (!activityType) {
      return res.status(400).json({ error: 'Activity type is required' });
    }

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const result = await query(
      `INSERT INTO team_activity (team_id, user_id, activity_type, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [teamId, userId, activityType, resourceType || null, resourceId || null, metadata || {}]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Log team activity failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to log team activity' });
  }
}

module.exports = {
  getTeamActivity,
  logTeamActivity
};
