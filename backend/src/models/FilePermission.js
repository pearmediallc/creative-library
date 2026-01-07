const BaseModel = require('./BaseModel');

class FilePermission extends BaseModel {
  constructor() {
    super('file_permissions');
  }

  /**
   * Grant permission to a resource
   * @param {Object} data - Permission data
   * @returns {Promise<Object>} Created permission
   */
  async grantPermission(data) {
    const sql = `
      INSERT INTO ${this.tableName}
        (resource_type, resource_id, grantee_type, grantee_id, permission_type, granted_by, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (resource_type, resource_id, grantee_type, grantee_id, permission_type)
      DO UPDATE SET granted_by = $6, granted_at = NOW(), expires_at = $7
      RETURNING *
    `;
    const result = await this.raw(sql, [
      data.resource_type,
      data.resource_id,
      data.grantee_type,
      data.grantee_id,
      data.permission_type,
      data.granted_by,
      data.expires_at || null
    ]);
    return Array.isArray(result) ? result[0] : result.rows?.[0];
  }

  /**
   * Revoke permission
   * @param {string} permissionId - Permission ID
   * @returns {Promise<boolean>} Success
   */
  async revokePermission(permissionId) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE id = $1
      RETURNING id
    `;
    const result = await this.raw(sql, [permissionId]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Revoke all permissions for a resource
   * @param {string} resourceType - 'file' or 'folder'
   * @param {string} resourceId - Resource ID
   * @returns {Promise<number>} Number of revoked permissions
   */
  async revokeResourcePermissions(resourceType, resourceId) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE resource_type = $1 AND resource_id = $2
      RETURNING id
    `;
    const result = await this.raw(sql, [resourceType, resourceId]);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows.length;
  }

  /**
   * Get permissions for a resource
   * @param {string} resourceType - 'file' or 'folder'
   * @param {string} resourceId - Resource ID
   * @returns {Promise<Array>} Permissions with grantee details
   */
  async getResourcePermissions(resourceType, resourceId) {
    const sql = `
      SELECT fp.*,
        CASE
          WHEN fp.grantee_type = 'user' THEN u.name
          WHEN fp.grantee_type = 'team' THEN t.name
        END as grantee_name,
        CASE
          WHEN fp.grantee_type = 'user' THEN u.email
        END as grantee_email,
        gb.name as granted_by_name
      FROM ${this.tableName} fp
      LEFT JOIN users u ON fp.grantee_type = 'user' AND fp.grantee_id = u.id
      LEFT JOIN teams t ON fp.grantee_type = 'team' AND fp.grantee_id = t.id
      LEFT JOIN users gb ON fp.granted_by = gb.id
      WHERE fp.resource_type = $1 AND fp.resource_id = $2
        AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
      ORDER BY fp.granted_at DESC
    `;
    const result = await this.raw(sql, [resourceType, resourceId]);
    return Array.isArray(result) ? result : result.rows || [];
  }

  /**
   * Check if user has permission to a resource
   * @param {string} resourceType - 'file' or 'folder'
   * @param {string} resourceId - Resource ID
   * @param {string} userId - User ID
   * @param {string} permissionType - 'view', 'download', 'edit', 'delete'
   * @returns {Promise<boolean>} Has permission
   */
  async checkPermission(resourceType, resourceId, userId, permissionType) {
    const sql = `
      SELECT 1
      FROM ${this.tableName} fp
      LEFT JOIN team_members tm ON fp.grantee_type = 'team' AND fp.grantee_id = tm.team_id
      WHERE fp.resource_type = $1 AND fp.resource_id = $2
        AND (
          (fp.grantee_type = 'user' AND fp.grantee_id = $3)
          OR (fp.grantee_type = 'team' AND tm.user_id = $3 AND tm.is_active = TRUE)
        )
        AND fp.permission_type = $4
        AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
      LIMIT 1
    `;
    const result = await this.raw(sql, [resourceType, resourceId, userId, permissionType]);
    return !!(Array.isArray(result) ? result[0] : result.rows?.[0]);
  }

  /**
   * Get all resources a user has access to
   * @param {string} userId - User ID
   * @param {string} resourceType - 'file' or 'folder'
   * @param {string} permissionType - Optional specific permission type
   * @returns {Promise<Array>} Resource IDs
   */
  async getUserAccessibleResources(userId, resourceType, permissionType = null) {
    let sql = `
      SELECT DISTINCT fp.resource_id
      FROM ${this.tableName} fp
      LEFT JOIN team_members tm ON fp.grantee_type = 'team' AND fp.grantee_id = tm.team_id
      WHERE fp.resource_type = $1
        AND (
          (fp.grantee_type = 'user' AND fp.grantee_id = $2)
          OR (fp.grantee_type = 'team' AND tm.user_id = $2 AND tm.is_active = TRUE)
        )
        AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
    `;

    const params = [resourceType, userId];

    if (permissionType) {
      sql += ' AND fp.permission_type = $3';
      params.push(permissionType);
    }

    const result = await this.raw(sql, params);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows.map(row => row.resource_id);
  }

  /**
   * Bulk grant permissions (e.g., when sharing a folder with a team)
   * @param {Array<Object>} permissions - Array of permission objects
   * @returns {Promise<number>} Number of permissions created
   */
  async bulkGrantPermissions(permissions) {
    if (!permissions || permissions.length === 0) {
      return 0;
    }

    const values = permissions.map((p, index) => {
      const base = index * 7;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    }).join(', ');

    const params = [];
    permissions.forEach(p => {
      params.push(
        p.resource_type,
        p.resource_id,
        p.grantee_type,
        p.grantee_id,
        p.permission_type,
        p.granted_by,
        p.expires_at || null
      );
    });

    const sql = `
      INSERT INTO ${this.tableName}
        (resource_type, resource_id, grantee_type, grantee_id, permission_type, granted_by, expires_at)
      VALUES ${values}
      ON CONFLICT (resource_type, resource_id, grantee_type, grantee_id, permission_type)
      DO UPDATE SET granted_by = EXCLUDED.granted_by, granted_at = NOW(), expires_at = EXCLUDED.expires_at
      RETURNING id
    `;

    const result = await this.raw(sql, params);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows.length;
  }
}

module.exports = new FilePermission();
