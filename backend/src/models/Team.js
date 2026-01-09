const BaseModel = require('./BaseModel');

class Team extends BaseModel {
  constructor() {
    super('teams');
  }

  /**
   * Override findById to filter by is_active
   * @param {string} id - Team ID
   * @returns {Promise<Object|null>} Team or null
   */
  async findById(id) {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = $1 AND is_active = TRUE`;
    const result = await this.raw(sql, [id]);
    return result[0] || null;
  }

  /**
   * Create a new team
   * @param {Object} data - Team data
   * @returns {Promise<Object>} Created team
   */
  async createTeam(data) {
    const sql = `
      INSERT INTO ${this.tableName} (name, description, owner_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await this.raw(sql, [data.name, data.description || null, data.owner_id]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Get teams owned by or where user is a member
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Teams
   */
  async getUserTeams(userId) {
    const sql = `
      SELECT DISTINCT t.*,
        u.name as owner_name,
        COUNT(DISTINCT tm.user_id) as member_count
      FROM ${this.tableName} t
      LEFT JOIN users u ON u.id = t.owner_id
      LEFT JOIN team_members tm ON tm.team_id = t.id
      WHERE t.owner_id = $1 OR t.id IN (
        SELECT team_id FROM team_members WHERE user_id = $1 AND is_active = TRUE
      )
      AND t.is_active = TRUE
      GROUP BY t.id, u.name
      ORDER BY t.created_at DESC
    `;
    const result = await this.raw(sql, [userId]);
    return Array.isArray(result) ? result : result.rows || [];
  }

  /**
   * Get team with members
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} Team with members array
   */
  async getTeamWithMembers(teamId) {
    // Get team details
    const teamSql = `
      SELECT t.*, u.name as owner_name
      FROM ${this.tableName} t
      LEFT JOIN users u ON u.id = t.owner_id
      WHERE t.id = $1 AND t.is_active = TRUE
    `;
    const teamResult = await this.raw(teamSql, [teamId]);
    const team = Array.isArray(teamResult) ? teamResult[0] : teamResult.rows?.[0];

    if (!team) {
      return null;
    }

    // Get team members
    const membersSql = `
      SELECT
        tm.user_id,
        tm.role,
        tm.joined_at as added_at,
        u.name as user_name,
        u.email as user_email
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1 AND tm.is_active = TRUE
      ORDER BY tm.joined_at DESC
    `;
    const membersResult = await this.raw(membersSql, [teamId]);
    team.members = Array.isArray(membersResult) ? membersResult : membersResult.rows || [];

    return team;
  }

  /**
   * Update team
   * @param {string} teamId - Team ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated team
   */
  async updateTeam(teamId, updates) {
    const sql = `
      UPDATE ${this.tableName}
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await this.raw(sql, [
      updates.name || null,
      updates.description || null,
      teamId
    ]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Delete team (soft delete)
   * @param {string} teamId - Team ID
   * @returns {Promise<boolean>} Success
   */
  async deleteTeam(teamId) {
    const sql = `
      UPDATE ${this.tableName}
      SET is_active = FALSE,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `;
    const result = await this.raw(sql, [teamId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Add member to team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @param {string} role - Member role (member, admin)
   * @returns {Promise<Object>} Created membership
   */
  async addMember(teamId, userId, role = 'member') {
    const sql = `
      INSERT INTO team_members (team_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (team_id, user_id)
      DO UPDATE SET is_active = TRUE, role = $3, joined_at = NOW()
      RETURNING *
    `;
    const result = await this.raw(sql, [teamId, userId, role]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Remove member from team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success
   */
  async removeMember(teamId, userId) {
    const sql = `
      UPDATE team_members
      SET is_active = FALSE
      WHERE team_id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await this.raw(sql, [teamId, userId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Check if user is team owner or admin
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Is owner or admin
   */
  async isTeamAdmin(teamId, userId) {
    const sql = `
      SELECT 1
      FROM ${this.tableName} t
      LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $2
      WHERE t.id = $1
        AND (t.owner_id = $2 OR (tm.role = 'admin' AND tm.is_active = TRUE))
      LIMIT 1
    `;
    const result = await this.raw(sql, [teamId, userId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Check if user is a member of team
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Is member
   */
  async isMember(teamId, userId) {
    const sql = `
      SELECT 1
      FROM team_members
      WHERE team_id = $1 AND user_id = $2 AND is_active = TRUE
      LIMIT 1
    `;
    const result = await this.raw(sql, [teamId, userId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Get team members
   * @param {string} teamId - Team ID
   * @returns {Promise<Array>} Team members with user details
   */
  async getMembers(teamId) {
    const sql = `
      SELECT
        tm.id,
        tm.team_id,
        tm.user_id,
        tm.role,
        tm.joined_at,
        u.name,
        u.email,
        u.role as user_role
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = $1 AND tm.is_active = TRUE
      ORDER BY tm.joined_at DESC
    `;
    const result = await this.raw(sql, [teamId]);
    return Array.isArray(result) ? result : result.rows || [];
  }

  /**
   * Update member role
   * @param {string} teamId - Team ID
   * @param {string} userId - User ID
   * @param {string} role - New role (member, admin)
   * @returns {Promise<Object>} Updated membership
   */
  async updateMemberRole(teamId, userId, role) {
    const sql = `
      UPDATE team_members
      SET role = $1, updated_at = NOW()
      WHERE team_id = $2 AND user_id = $3 AND is_active = TRUE
      RETURNING *
    `;
    const result = await this.raw(sql, [role, teamId, userId]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }
}

module.exports = new Team();
