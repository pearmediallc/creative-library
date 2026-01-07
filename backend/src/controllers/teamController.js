const Team = require('../models/Team');
const logger = require('../utils/logger');

class TeamController {
  /**
   * Create a new team
   * POST /api/teams
   */
  async createTeam(req, res, next) {
    try {
      const { name, description } = req.body;
      const userId = req.user.id;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Team name is required' });
      }

      const team = await Team.createTeam({
        name: name.trim(),
        description: description?.trim(),
        owner_id: userId
      });

      logger.info('Team created', { teamId: team.id, userId });

      res.status(201).json({
        success: true,
        data: team
      });
    } catch (error) {
      logger.error('Create team failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get user's teams
   * GET /api/teams
   */
  async getUserTeams(req, res, next) {
    try {
      const userId = req.user.id;

      const teams = await Team.getUserTeams(userId);

      res.json({
        success: true,
        data: teams
      });
    } catch (error) {
      logger.error('Get teams failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get team details with members
   * GET /api/teams/:id
   */
  async getTeam(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const team = await Team.getTeamWithMembers(id);

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      // Check if user has access to this team
      const hasAccess = team.owner_id === userId ||
        team.members.some(m => m.user_id === userId);

      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        success: true,
        data: team
      });
    } catch (error) {
      logger.error('Get team failed', { error: error.message, teamId: req.params.id });
      next(error);
    }
  }

  /**
   * Update team
   * PATCH /api/teams/:id
   */
  async updateTeam(req, res, next) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user.id;

      // Check if user is team admin
      const isAdmin = await Team.isTeamAdmin(id, userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only team admins can update the team' });
      }

      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim();

      const team = await Team.updateTeam(id, updates);

      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      logger.info('Team updated', { teamId: id, userId });

      res.json({
        success: true,
        data: team
      });
    } catch (error) {
      logger.error('Update team failed', { error: error.message, teamId: req.params.id });
      next(error);
    }
  }

  /**
   * Delete team
   * DELETE /api/teams/:id
   */
  async deleteTeam(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Check if user is team owner
      const team = await Team.findById(id);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }

      if (team.owner_id !== userId) {
        return res.status(403).json({ error: 'Only team owner can delete the team' });
      }

      await Team.deleteTeam(id);

      logger.info('Team deleted', { teamId: id, userId });

      res.json({
        success: true,
        message: 'Team deleted successfully'
      });
    } catch (error) {
      logger.error('Delete team failed', { error: error.message, teamId: req.params.id });
      next(error);
    }
  }

  /**
   * Add member to team
   * POST /api/teams/:id/members
   */
  async addMember(req, res, next) {
    try {
      const { id } = req.params;
      const { user_id, role = 'member' } = req.body;
      const userId = req.user.id;

      if (!user_id) {
        return res.status(400).json({ error: 'user_id is required' });
      }

      // Check if user is team admin
      const isAdmin = await Team.isTeamAdmin(id, userId);
      if (!isAdmin) {
        return res.status(403).json({ error: 'Only team admins can add members' });
      }

      const membership = await Team.addMember(id, user_id, role);

      logger.info('Team member added', { teamId: id, newMemberId: user_id, addedBy: userId });

      res.status(201).json({
        success: true,
        data: membership
      });
    } catch (error) {
      logger.error('Add team member failed', { error: error.message, teamId: req.params.id });
      next(error);
    }
  }

  /**
   * Remove member from team
   * DELETE /api/teams/:id/members/:userId
   */
  async removeMember(req, res, next) {
    try {
      const { id, userId: memberUserId } = req.params;
      const userId = req.user.id;

      // Check if user is team admin or removing themselves
      const isAdmin = await Team.isTeamAdmin(id, userId);
      const isRemovingSelf = memberUserId === userId;

      if (!isAdmin && !isRemovingSelf) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      await Team.removeMember(id, memberUserId);

      logger.info('Team member removed', { teamId: id, removedUserId: memberUserId, removedBy: userId });

      res.json({
        success: true,
        message: 'Member removed successfully'
      });
    } catch (error) {
      logger.error('Remove team member failed', { error: error.message, teamId: req.params.id });
      next(error);
    }
  }
}

module.exports = new TeamController();
