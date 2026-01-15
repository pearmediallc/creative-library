/**
 * Team Activity Controller
 * Handles team activity logs
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get team activity
 * GET /api/teams/:teamId/activity
 */
async function getTeamActivity(req, res) {
  try {
    const { teamId } = req.params;
    const { limit = 20, offset = 0, activityType } = req.query;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    let whereClause = 'ta.team_id = $1';
    const params = [teamId];

    if (activityType) {
      whereClause += ' AND ta.activity_type = $2';
      params.push(activityType);
    }

    const result = await query(
      `SELECT
        ta.*,
        u.name as user_name
       FROM team_activity ta
       LEFT JOIN users u ON ta.user_id = u.id
       WHERE ${whereClause}
       ORDER BY ta.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team activity failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to fetch team activity' });
  }
}

/**
 * Log team activity
 * POST /api/teams/:teamId/activity
 */
async function logTeamActivity(req, res) {
  try {
    const { teamId } = req.params;
    const { activityType, activityData } = req.body;
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
      `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [teamId, userId, activityType, JSON.stringify(activityData || {})]
    );

    logger.info('Team activity logged', {
      team_id: teamId,
      activity_type: activityType,
      user_id: userId
    });

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logger.error('Log team activity failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to log team activity' });
  }
}

module.exports = {
  getTeamActivity,
  logTeamActivity
};
