/**
 * Team Permissions Middleware
 * Checks granular team permissions
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Check if user has specific team permission
 * @param {string} requiredPermission - Permission field name (e.g., 'can_manage_members')
 */
function checkTeamPermission(requiredPermission) {
  return async (req, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;

      if (!teamId) {
        return res.status(400).json({ error: 'Team ID is required' });
      }

      // Get team member with permissions
      const result = await query(
        `SELECT tm.*, t.owner_id
         FROM team_members tm
         JOIN teams t ON tm.team_id = t.id
         WHERE tm.team_id = $1 AND tm.user_id = $2`,
        [teamId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'Not a team member' });
      }

      const member = result.rows[0];

      // Team owner has all permissions
      if (member.owner_id === userId) {
        req.teamMember = member;
        return next();
      }

      // Check specific permission
      if (!member[requiredPermission]) {
        logger.warn('Team permission denied', {
          user_id: userId,
          team_id: teamId,
          required_permission: requiredPermission
        });
        return res.status(403).json({
          error: `Insufficient permissions: ${requiredPermission} required`
        });
      }

      req.teamMember = member;
      next();
    } catch (error) {
      logger.error('Team permission check failed', {
        error: error.message,
        team_id: req.params.teamId,
        user_id: req.user?.id
      });
      res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Check if user is a team member (any role)
 */
function isTeamMember(req, res, next) {
  return checkTeamPermission('user_id')(req, res, next);
}

module.exports = {
  checkTeamPermission,
  isTeamMember
};
