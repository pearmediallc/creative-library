/**
 * Team Analytics Controller
 * Handles team analytics and metrics
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
      'SELECT can_view_analytics FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Get member count
    const memberCount = await query(
      'SELECT COUNT(*) FROM team_members WHERE team_id = $1',
      [teamId]
    );

    // Get folder count
    const folderCount = await query(
      'SELECT COUNT(*) FROM folders WHERE team_id = $1',
      [teamId]
    );

    // Get activity count (last 30 days)
    const activityCount = await query(
      `SELECT COUNT(*) FROM team_activity 
       WHERE team_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [teamId]
    );

    // Get message count
    const messageCount = await query(
      `SELECT COUNT(*) FROM team_messages 
       WHERE team_id = $1 AND is_deleted = false`,
      [teamId]
    );

    // Get shared media count
    const sharedMediaCount = await query(
      'SELECT COUNT(*) FROM team_shared_media WHERE team_id = $1',
      [teamId]
    );

    // Get template count
    const templateCount = await query(
      'SELECT COUNT(*) FROM request_templates WHERE team_id = $1 AND is_active = true',
      [teamId]
    );

    res.json({
      success: true,
      data: {
        members: parseInt(memberCount.rows[0].count),
        folders: parseInt(folderCount.rows[0].count),
        recentActivity: parseInt(activityCount.rows[0].count),
        messages: parseInt(messageCount.rows[0].count),
        sharedMedia: parseInt(sharedMediaCount.rows[0].count),
        templates: parseInt(templateCount.rows[0].count)
      }
    });
  } catch (error) {
    logger.error('Get analytics summary failed', {
      error: error.message,
      team_id: req.params.teamId
    });
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
    const { period = '30' } = req.query;
    const userId = req.user.id;

    // Check permission
    const memberCheck = await query(
      'SELECT can_view_analytics FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Get activity trends
    const activityTrends = await query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM team_activity
       WHERE team_id = $1 AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [teamId]
    );

    // Get message trends
    const messageTrends = await query(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM team_messages
       WHERE team_id = $1 AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [teamId]
    );

    res.json({
      success: true,
      data: {
        activity: activityTrends.rows,
        messages: messageTrends.rows
      }
    });
  } catch (error) {
    logger.error('Get analytics trends failed', {
      error: error.message,
      team_id: req.params.teamId
    });
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

    // Check permission
    const memberCheck = await query(
      'SELECT can_view_analytics FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Get member activity stats
    const memberStats = await query(
      `SELECT 
         u.id,
         u.name,
         tm.team_role,
         COUNT(DISTINCT ta.id) as activity_count,
         COUNT(DISTINCT tmsg.id) as message_count,
         MAX(ta.created_at) as last_active
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       LEFT JOIN team_activity ta ON ta.team_id = tm.team_id AND ta.user_id = u.id
       LEFT JOIN team_messages tmsg ON tmsg.team_id = tm.team_id AND tmsg.user_id = u.id
       WHERE tm.team_id = $1
       GROUP BY u.id, u.name, tm.team_role
       ORDER BY activity_count DESC`,
      [teamId]
    );

    res.json({
      success: true,
      data: memberStats.rows
    });
  } catch (error) {
    logger.error('Get member analytics failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to fetch member analytics' });
  }
}

/**
 * Get request analytics
 * GET /api/teams/:teamId/analytics/requests
 */
async function getRequestAnalytics(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check permission
    const memberCheck = await query(
      'SELECT can_view_analytics FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    if (!memberCheck.rows[0].can_view_analytics) {
      return res.status(403).json({ error: 'You do not have permission to view analytics' });
    }

    // Get template usage stats
    const templateUsage = await query(
      `SELECT 
         rt.name,
         rt.usage_count,
         rt.created_at
       FROM request_templates rt
       WHERE rt.team_id = $1 AND rt.is_active = true
       ORDER BY rt.usage_count DESC
       LIMIT 10`,
      [teamId]
    );

    res.json({
      success: true,
      data: {
        topTemplates: templateUsage.rows
      }
    });
  } catch (error) {
    logger.error('Get request analytics failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to fetch request analytics' });
  }
}

module.exports = {
  getAnalyticsSummary,
  getAnalyticsTrends,
  getMemberAnalytics,
  getRequestAnalytics
};
