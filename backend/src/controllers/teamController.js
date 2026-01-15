/**
 * Team Controller
 * Handles team management, members, and team-owned folders
 */

const { query } = require('../config/database');
const Folder = require('../models/Folder');
const logger = require('../utils/logger');

/**
 * Create a new team
 * POST /api/teams
 */
async function createTeam(req, res) {
  try {
    const { name, description } = req.body;
    const ownerId = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    if (name.length > 255) {
      return res.status(400).json({ error: 'Team name must be 255 characters or less' });
    }

    // Check team limit per user (max 10 teams owned)
    const teamCountResult = await query(
      'SELECT COUNT(*) FROM teams WHERE owner_id = $1',
      [ownerId]
    );

    if (parseInt(teamCountResult.rows[0].count) >= 10) {
      return res.status(400).json({ error: 'Maximum 10 teams per user' });
    }

    // Create team
    const result = await query(
      `INSERT INTO teams (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description || null, ownerId]
    );

    const team = result.rows[0];

    // Add owner as a team member with lead role
    await query(
      `INSERT INTO team_members (team_id, user_id, team_role, can_manage_members, can_create_folders, can_delete_files, can_manage_templates, can_view_analytics)
       VALUES ($1, $2, 'lead', true, true, true, true, true)`,
      [team.id, ownerId]
    );

    logger.info('Team created', { team_id: team.id, owner_id: ownerId, name });

    res.status(201).json({
      success: true,
      data: team,
      message: 'Team created successfully'
    });
  } catch (error) {
    logger.error('Create team failed', { error: error.message });
    res.status(500).json({ error: 'Failed to create team' });
  }
}

/**
 * Get all teams for the current user
 * GET /api/teams
 */
async function getUserTeams(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT
        t.*,
        tm.team_role,
        u.name as owner_username,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
        (SELECT COUNT(*) FROM folders WHERE team_id = t.id) as folder_count
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE tm.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get user teams failed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

/**
 * Get team details
 * GET /api/teams/:teamId
 */
async function getTeam(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Get team details
    const teamResult = await query(
      `SELECT
        t.*,
        u.name as owner_username,
        u.email as owner_email
       FROM teams t
       LEFT JOIN users u ON t.owner_id = u.id
       WHERE t.id = $1`,
      [teamId]
    );

    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team members
    const membersResult = await query(
      `SELECT
        tm.*,
        u.name,
        u.email,
        u.role as user_role
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = $1
       ORDER BY tm.joined_at ASC`,
      [teamId]
    );

    const team = teamResult.rows[0];
    team.members = membersResult.rows;

    res.json({
      success: true,
      data: team
    });
  } catch (error) {
    logger.error('Get team failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch team' });
  }
}

/**
 * Update team
 * PUT /api/teams/:teamId
 */
async function updateTeam(req, res) {
  try {
    const { teamId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.id;

    // Get team and check ownership or lead role
    const teamResult = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    const isOwner = team.owner_id === userId;

    const memberResult = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    const isLead = memberResult.rows.length > 0 && memberResult.rows[0].team_role === 'lead';

    if (!isOwner && !isLead) {
      return res.status(403).json({ error: 'Only team owner or lead can update team' });
    }

    if (name && name.trim().length === 0) {
      return res.status(400).json({ error: 'Team name cannot be empty' });
    }

    if (name && name.length > 255) {
      return res.status(400).json({ error: 'Team name must be 255 characters or less' });
    }

    // Update team
    const updateResult = await query(
      `UPDATE teams
       SET name = COALESCE($1, name),
           description = COALESCE($2, description)
       WHERE id = $3
       RETURNING *`,
      [name?.trim() || null, description !== undefined ? description : null, teamId]
    );

    logger.info('Team updated', { team_id: teamId, updated_by: userId });

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Team updated successfully'
    });
  } catch (error) {
    logger.error('Update team failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to update team' });
  }
}

/**
 * Delete team
 * DELETE /api/teams/:teamId
 */
async function deleteTeam(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check ownership
    const teamResult = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    if (team.owner_id !== userId) {
      return res.status(403).json({ error: 'Only team owner can delete the team' });
    }

    // Check if team has folders
    const folderCountResult = await query(
      'SELECT COUNT(*) FROM folders WHERE team_id = $1',
      [teamId]
    );

    const folderCount = parseInt(folderCountResult.rows[0].count);
    if (folderCount > 0) {
      return res.status(400).json({
        error: `Cannot delete team with ${folderCount} folder(s). Please delete or transfer folders first.`
      });
    }

    // Delete team (cascades to team_members, team_activity, etc.)
    await query('DELETE FROM teams WHERE id = $1', [teamId]);

    logger.info('Team deleted', { team_id: teamId, owner_id: userId });

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    logger.error('Delete team failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to delete team' });
  }
}

/**
 * Add member to team
 * POST /api/teams/:teamId/members
 */
async function addTeamMember(req, res) {
  try {
    const { teamId } = req.params;
    const { userId: newMemberId, teamRole = 'member' } = req.body;
    const currentUserId = req.user.id;

    if (!newMemberId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!['lead', 'member', 'guest'].includes(teamRole)) {
      return res.status(400).json({ error: 'Invalid team role. Must be lead, member, or guest' });
    }

    // Check team exists
    const teamResult = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    const isOwner = team.owner_id === currentUserId;

    // Check if current user can add members
    const currentMemberResult = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, currentUserId]
    );

    if (currentMemberResult.rows.length === 0 && !isOwner) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    const canManage = isOwner ||
      (currentMemberResult.rows.length > 0 && currentMemberResult.rows[0].can_manage_members);

    if (!canManage) {
      return res.status(403).json({ error: 'You do not have permission to add members' });
    }

    // Check if user exists
    const userResult = await query('SELECT * FROM users WHERE id = $1', [newMemberId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already a member
    const existingMember = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, newMemberId]
    );

    if (existingMember.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    // Get role preset permissions
    const presetResult = await query(
      'SELECT permissions FROM team_role_presets WHERE role_name = $1',
      [teamRole]
    );

    const permissions = presetResult.rows[0]?.permissions || {};

    // Add member
    const result = await query(
      `INSERT INTO team_members (
        team_id, user_id, team_role,
        can_manage_members, can_create_folders, can_delete_files,
        can_manage_templates, can_view_analytics
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        teamId,
        newMemberId,
        teamRole,
        permissions.can_manage_members || false,
        permissions.can_create_folders !== false,
        permissions.can_delete_files || false,
        permissions.can_manage_templates || false,
        permissions.can_view_analytics !== false
      ]
    );

    // Log activity
    await query(
      `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, 'member_joined', $3)`,
      [teamId, currentUserId, JSON.stringify({ new_member_id: newMemberId, added_by: currentUserId, role: teamRole })]
    );

    logger.info('Team member added', { team_id: teamId, new_member_id: newMemberId, role: teamRole });

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Team member added successfully'
    });
  } catch (error) {
    logger.error('Add team member failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to add team member' });
  }
}

/**
 * Remove member from team
 * DELETE /api/teams/:teamId/members/:userId
 */
async function removeTeamMember(req, res) {
  try {
    const { teamId, userId: memberToRemove } = req.params;
    const currentUserId = req.user.id;

    // Check team exists
    const teamResult = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    const isOwner = team.owner_id === currentUserId;

    // Cannot remove the owner
    if (memberToRemove === team.owner_id) {
      return res.status(400).json({ error: 'Cannot remove team owner. Delete the team instead.' });
    }

    // Check permissions
    const currentMemberResult = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, currentUserId]
    );

    const isSelf = currentUserId === memberToRemove;
    const canManage = isOwner ||
      (currentMemberResult.rows.length > 0 && currentMemberResult.rows[0].can_manage_members);

    if (!isSelf && !canManage) {
      return res.status(403).json({ error: 'You do not have permission to remove members' });
    }

    // Remove member
    const deleteResult = await query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING *',
      [teamId, memberToRemove]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in team' });
    }

    // Log activity
    await query(
      `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, 'member_left', $3)`,
      [teamId, currentUserId, JSON.stringify({ removed_member_id: memberToRemove, removed_by: currentUserId, is_self_removal: isSelf })]
    );

    logger.info('Team member removed', { team_id: teamId, removed_member_id: memberToRemove });

    res.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    logger.error('Remove team member failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to remove team member' });
  }
}

/**
 * Update team member role
 * PUT /api/teams/:teamId/members/:userId/role
 */
async function updateTeamMemberRole(req, res) {
  try {
    const { teamId, userId: memberToUpdate } = req.params;
    const { teamRole } = req.body;
    const currentUserId = req.user.id;

    if (!['lead', 'member', 'guest'].includes(teamRole)) {
      return res.status(400).json({ error: 'Invalid team role' });
    }

    // Check team exists and ownership
    const teamResult = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    const isOwner = team.owner_id === currentUserId;

    // Cannot change owner's role
    if (memberToUpdate === team.owner_id) {
      return res.status(400).json({ error: 'Cannot change team owner role' });
    }

    // Check permissions
    const currentMemberResult = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, currentUserId]
    );

    const canManage = isOwner ||
      (currentMemberResult.rows.length > 0 && currentMemberResult.rows[0].can_manage_members);

    if (!canManage) {
      return res.status(403).json({ error: 'You do not have permission to change member roles' });
    }

    // Get role preset permissions
    const presetResult = await query(
      'SELECT permissions FROM team_role_presets WHERE role_name = $1',
      [teamRole]
    );

    const permissions = presetResult.rows[0]?.permissions || {};

    // Update member role
    const updateResult = await query(
      `UPDATE team_members
       SET team_role = $1,
           can_manage_members = $2,
           can_create_folders = $3,
           can_delete_files = $4,
           can_manage_templates = $5,
           can_view_analytics = $6
       WHERE team_id = $7 AND user_id = $8
       RETURNING *`,
      [
        teamRole,
        permissions.can_manage_members || false,
        permissions.can_create_folders !== false,
        permissions.can_delete_files || false,
        permissions.can_manage_templates || false,
        permissions.can_view_analytics !== false,
        teamId,
        memberToUpdate
      ]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in team' });
    }

    // Log activity
    await query(
      `INSERT INTO team_activity (team_id, user_id, activity_type, activity_data)
       VALUES ($1, $2, 'member_role_changed', $3)`,
      [teamId, currentUserId, JSON.stringify({ member_id: memberToUpdate, new_role: teamRole, changed_by: currentUserId })]
    );

    logger.info('Team member role updated', { team_id: teamId, member_id: memberToUpdate, new_role: teamRole });

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Team member role updated successfully'
    });
  } catch (error) {
    logger.error('Update team member role failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to update team member role' });
  }
}

/**
 * Get team folders
 * GET /api/teams/:teamId/folders
 */
async function getTeamFolders(req, res) {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Get team folders
    const result = await query(
      `SELECT
        f.*,
        u.name as owner_username,
        (SELECT COUNT(*) FROM files WHERE folder_id = f.id) as file_count
       FROM folders f
       LEFT JOIN users u ON f.owner_id = u.id
       WHERE f.team_id = $1
       ORDER BY f.created_at DESC`,
      [teamId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team folders failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch team folders' });
  }
}

/**
 * Get available users to add to team
 * GET /api/teams/:teamId/available-users
 */
async function getAvailableUsers(req, res) {
  try {
    const { teamId } = req.params;
    const { search = '' } = req.query;
    const userId = req.user.id;

    // Check if user can manage members
    const teamResult = await query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = teamResult.rows[0];
    const isOwner = team.owner_id === userId;

    const currentMemberResult = await query(
      'SELECT can_manage_members FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (!isOwner && (currentMemberResult.rows.length === 0 || !currentMemberResult.rows[0].can_manage_members)) {
      return res.status(403).json({ error: 'You do not have permission to manage members' });
    }

    // Get users who are NOT in this team
    let whereClause = `u.id NOT IN (SELECT user_id FROM team_members WHERE team_id = $1)`;
    const params = [teamId];

    if (search && search.trim().length > 0) {
      whereClause += ` AND (u.name ILIKE $2 OR u.email ILIKE $2)`;
      params.push(`%${search.trim()}%`);
    }

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role
       FROM users u
       WHERE ${whereClause}
       ORDER BY u.name ASC
       LIMIT 50`,
      params
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get available users failed', { error: error.message, team_id: req.params.teamId });
    res.status(500).json({ error: 'Failed to fetch available users' });
  }
}

module.exports = {
  createTeam,
  getUserTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
  getTeamFolders,
  getAvailableUsers
};
