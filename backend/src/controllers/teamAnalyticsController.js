/**
 * Team Analytics Controller
 * Handles team analytics and insights
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Get analytics summary
 * GET /api/teams/:teamId/analytics/summary
 */
async function getAnalyticsSummary(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is a team member with analytics permission
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Get total files in team folders
    const filesResult = await query(
      `SELECT COUNT(*) as total
       FROM files f
       JOIN folders fold ON f.folder_id = fold.id
       WHERE fold.team_id = $1`,
      [teamId]
    );

    // Get total team folders
    const foldersResult = await query(
      'SELECT COUNT(*) as total FROM folders WHERE team_id = $1',
      [teamId]
    );

    // Get active members count
    const membersResult = await query(
      'SELECT COUNT(*) as total FROM team_members WHERE team_id = $1',
      [teamId]
    );

    // Get recent activity count (last 7 days)
    const activityResult = await query(
      `SELECT COUNT(*) as total
       FROM team_activity
       WHERE team_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
      [teamId]
    );

    // Get template usage count
    const templatesResult = await query(
      'SELECT COUNT(*) as total, SUM(usage_count) as total_uses FROM request_templates WHERE team_id = $1',
      [teamId]
    );

    res.json({
      success: true,
      data: {
        totalFiles: parseInt(filesResult.rows[0].total),
        totalFolders: parseInt(foldersResult.rows[0].total),
        totalMembers: parseInt(membersResult.rows[0].total),
        recentActivity: parseInt(activityResult.rows[0].total),
        totalTemplates: parseInt(templatesResult.rows[0].total || 0),
        totalTemplateUses: parseInt(templatesResult.rows[0].total_uses || 0)
      }
    });
  } catch (error) {
    logger.error('Get analytics summary failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
}

/**
 * Get analytics trends
 * GET /api/teams/:teamId/analytics/trends
 */
async function getAnalyticsTrends(req, res) {
  try {
    const { teamId } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;
    const userId = req.user.id;

    // Check permissions
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    // Get activity trends
    let dateGrouping;
    switch (groupBy) {
      case 'week':
        dateGrouping = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', created_at)";
        break;
      default:
        dateGrouping = "DATE_TRUNC('day', created_at)";
    }

    const trendsResult = await query(
      `SELECT
        ${dateGrouping} as date,
        activity_type,
        COUNT(*) as count
       FROM team_activity
       WHERE team_id = $1
         AND created_at >= $2::date
         AND created_at <= $3::date
       GROUP BY date, activity_type
       ORDER BY date ASC`,
      [teamId, start, end]
    );

    res.json({
      success: true,
      data: trendsResult.rows
    });
  } catch (error) {
    logger.error('Get analytics trends failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch analytics trends' });
  }
}

/**
 * Get member analytics
 * GET /api/teams/:teamId/analytics/members
 */
async function getMemberAnalytics(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check permissions
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Get member activity counts
    const result = await query(
      `SELECT
        tm.user_id,
        u.username,
        u.email,
        tm.team_role,
        COUNT(ta.id) as activity_count,
        MAX(ta.created_at) as last_active
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       LEFT JOIN team_activity ta ON ta.user_id = tm.user_id AND ta.team_id = tm.team_id
       WHERE tm.team_id = $1
       GROUP BY tm.user_id, u.username, u.email, tm.team_role
       ORDER BY activity_count DESC`,
      [teamId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get member analytics failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch member analytics' });
  }
}

/**
 * Get request analytics (placeholder for future file_requests integration)
 * GET /api/teams/:teamId/analytics/requests
 */
async function getRequestAnalytics(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check permissions
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Placeholder - would integrate with file_requests table in future
    res.json({
      success: true,
      data: {
        message: 'Request analytics will be available when file_requests are linked to teams',
        totalRequests: 0,
        completedRequests: 0,
        avgTurnaroundHours: 0
      }
    });
  } catch (error) {
    logger.error('Get request analytics failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch request analytics' });
  }
}

module.exports = {
  getAnalyticsSummary,
  getAnalyticsTrends,
  getMemberAnalytics,
  getRequestAnalytics
};
