const { query } = require('../config/database');

/**
 * Permission Service
 *
 * Handles all permission checking logic with the following precedence:
 * 1. Explicit Deny (highest priority) - permissions table with permission='deny'
 * 2. Super Admin - has all permissions
 * 3. Folder Admin - for folder-scoped resources
 * 4. Explicit Allow - permissions table with permission='allow'
 * 5. Role-based permissions - from role_default_permissions
 * 6. Default Deny - no permission found
 */

class PermissionService {

  /**
   * Check if user has permission for an action on a resource
   *
   * @param {string} userId - User ID
   * @param {string} resourceType - Type of resource (file_request, folder, media_file, etc.)
   * @param {string} action - Action to perform (view, create, edit, delete, etc.)
   * @param {string|null} resourceId - Specific resource ID or null for general permission
   * @returns {Promise<boolean>} - True if user has permission
   */
  async checkPermission(userId, resourceType, action, resourceId = null) {
    try {
      // Step 1: Check for explicit DENY - highest priority
      const explicitDeny = await this._checkExplicitPermission(userId, resourceType, action, resourceId, 'deny');
      if (explicitDeny) {
        return false;
      }

      // Step 2: Check if user is Super Admin
      const isSuperAdmin = await this._isSuperAdmin(userId);
      if (isSuperAdmin) {
        return true;
      }

      // Step 3: Check folder admin permissions (if resource is folder-related)
      if (['folder', 'file_request', 'media_file'].includes(resourceType) && resourceId) {
        const folderId = await this._getFolderIdForResource(resourceType, resourceId);
        if (folderId) {
          const isFolderAdmin = await this._isFolderAdmin(userId, folderId, action);
          if (isFolderAdmin) {
            return true;
          }
        }
      }

      // Step 4: Check for explicit ALLOW
      const explicitAllow = await this._checkExplicitPermission(userId, resourceType, action, resourceId, 'allow');
      if (explicitAllow) {
        return true;
      }

      // Step 5: Check role-based permissions
      const rolePermission = await this._checkRolePermission(userId, resourceType, action, resourceId);
      if (rolePermission) {
        return true;
      }

      // Step 6: Default deny
      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false; // Fail secure - deny on error
    }
  }

  /**
   * Check multiple permissions at once
   * Returns an object with action as key and boolean as value
   */
  async checkPermissions(userId, resourceType, actions, resourceId = null) {
    const results = {};
    for (const action of actions) {
      results[action] = await this.checkPermission(userId, resourceType, action, resourceId);
    }
    return results;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId) {
    try {
      // Get user's roles
      const rolesResult = await query(
        `SELECT r.name, r.description, ur.scope_type, ur.scope_id, ur.expires_at
         FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)`,
        [userId]
      );

      // Get explicit permissions
      const permissionsResult = await query(
        `SELECT resource_type, resource_id, action, permission, expires_at, reason
         FROM permissions
         WHERE user_id = $1 AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         ORDER BY resource_type, action`,
        [userId]
      );

      // Get folder admin assignments
      const folderAdminResult = await query(
        `SELECT fa.folder_id, f.name as folder_name,
                fa.can_grant_access, fa.can_revoke_access,
                fa.can_manage_requests, fa.can_delete_files
         FROM folder_admins fa
         JOIN folders f ON fa.folder_id = f.id
         WHERE fa.user_id = $1 AND fa.is_active = TRUE
         AND (fa.expires_at IS NULL OR fa.expires_at > CURRENT_TIMESTAMP)`,
        [userId]
      );

      // Get UI permissions
      const uiPermissionsResult = await query(
        `SELECT ui_element, is_visible, is_enabled, custom_label
         FROM ui_permissions
         WHERE user_id = $1`,
        [userId]
      );

      return {
        roles: rolesResult.rows,
        permissions: permissionsResult.rows,
        folderAdmin: folderAdminResult.rows,
        uiPermissions: uiPermissionsResult.rows,
        isSuperAdmin: await this._isSuperAdmin(userId)
      };
    } catch (error) {
      console.error('Error getting user permissions:', error);
      throw error;
    }
  }

  /**
   * Grant a permission to a user
   */
  async grantPermission(grantedBy, userId, resourceType, action, permission = 'allow', options = {}) {
    try {
      const { resourceId = null, expiresAt = null, reason = null } = options;

      const result = await query(
        `INSERT INTO permissions (user_id, resource_type, resource_id, action, permission, granted_by, expires_at, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, resource_type, COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'::uuid), action)
         DO UPDATE SET
           permission = EXCLUDED.permission,
           granted_by = EXCLUDED.granted_by,
           granted_at = CURRENT_TIMESTAMP,
           expires_at = EXCLUDED.expires_at,
           reason = EXCLUDED.reason,
           is_active = TRUE
         RETURNING *`,
        [userId, resourceType, resourceId, action, permission, grantedBy, expiresAt, reason]
      );

      // Log the action
      await this._logPermissionChange('permission_granted', grantedBy, userId, 'permission', result.rows[0].id, {
        resourceType,
        action,
        permission,
        resourceId,
        expiresAt,
        reason
      });

      return result.rows[0];
    } catch (error) {
      console.error('Error granting permission:', error);
      throw error;
    }
  }

  /**
   * Revoke a permission from a user
   */
  async revokePermission(revokedBy, userId, resourceType, action, resourceId = null) {
    try {
      const result = await query(
        `UPDATE permissions
         SET is_active = FALSE
         WHERE user_id = $1
           AND resource_type = $2
           AND action = $3
           AND (resource_id = $4 OR ($4 IS NULL AND resource_id IS NULL))
         RETURNING *`,
        [userId, resourceType, action, resourceId]
      );

      if (result.rows.length > 0) {
        await this._logPermissionChange('permission_revoked', revokedBy, userId, 'permission', result.rows[0].id, {
          resourceType,
          action,
          resourceId
        });
      }

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error revoking permission:', error);
      throw error;
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(assignedBy, userId, roleName, options = {}) {
    try {
      const { scopeType = 'global', scopeId = null, expiresAt = null } = options;

      // Get role ID
      const roleResult = await query('SELECT id FROM roles WHERE name = $1', [roleName]);
      if (roleResult.rows.length === 0) {
        throw new Error(`Role not found: ${roleName}`);
      }
      const roleId = roleResult.rows[0].id;

      const result = await query(
        `INSERT INTO user_roles (user_id, role_id, scope_type, scope_id, granted_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, role_id, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
         DO UPDATE SET
           granted_by = EXCLUDED.granted_by,
           granted_at = CURRENT_TIMESTAMP,
           expires_at = EXCLUDED.expires_at,
           is_active = TRUE
         RETURNING *`,
        [userId, roleId, scopeType, scopeId, assignedBy, expiresAt]
      );

      await this._logPermissionChange('role_assigned', assignedBy, userId, 'role', result.rows[0].id, {
        roleName,
        scopeType,
        scopeId,
        expiresAt
      });

      return result.rows[0];
    } catch (error) {
      console.error('Error assigning role:', error);
      throw error;
    }
  }

  /**
   * Remove a role from a user
   */
  async removeRole(removedBy, userId, roleName, scopeType = 'global', scopeId = null) {
    try {
      const result = await query(
        `UPDATE user_roles ur
         SET is_active = FALSE
         FROM roles r
         WHERE ur.role_id = r.id
           AND ur.user_id = $1
           AND r.name = $2
           AND ur.scope_type = $3
           AND (ur.scope_id = $4 OR ($4 IS NULL AND ur.scope_id IS NULL))
         RETURNING ur.*`,
        [userId, roleName, scopeType, scopeId]
      );

      if (result.rows.length > 0) {
        await this._logPermissionChange('role_revoked', removedBy, userId, 'role', result.rows[0].id, {
          roleName,
          scopeType,
          scopeId
        });
      }

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error removing role:', error);
      throw error;
    }
  }

  /**
   * Add a folder admin
   */
  async addFolderAdmin(assignedBy, userId, folderId, permissions = {}) {
    try {
      const {
        canGrantAccess = true,
        canRevokeAccess = true,
        canManageRequests = true,
        canDeleteFiles = false,
        expiresAt = null
      } = permissions;

      const result = await query(
        `INSERT INTO folder_admins
          (folder_id, user_id, can_grant_access, can_revoke_access, can_manage_requests, can_delete_files, assigned_by, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (folder_id, user_id)
         DO UPDATE SET
           can_grant_access = EXCLUDED.can_grant_access,
           can_revoke_access = EXCLUDED.can_revoke_access,
           can_manage_requests = EXCLUDED.can_manage_requests,
           can_delete_files = EXCLUDED.can_delete_files,
           assigned_by = EXCLUDED.assigned_by,
           assigned_at = CURRENT_TIMESTAMP,
           expires_at = EXCLUDED.expires_at,
           is_active = TRUE
         RETURNING *`,
        [folderId, userId, canGrantAccess, canRevokeAccess, canManageRequests, canDeleteFiles, assignedBy, expiresAt]
      );

      await this._logPermissionChange('folder_admin_added', assignedBy, userId, 'folder_admin', result.rows[0].id, {
        folderId,
        permissions
      });

      return result.rows[0];
    } catch (error) {
      console.error('Error adding folder admin:', error);
      throw error;
    }
  }

  /**
   * Remove a folder admin
   */
  async removeFolderAdmin(removedBy, userId, folderId) {
    try {
      const result = await query(
        `UPDATE folder_admins
         SET is_active = FALSE
         WHERE folder_id = $1 AND user_id = $2
         RETURNING *`,
        [folderId, userId]
      );

      if (result.rows.length > 0) {
        await this._logPermissionChange('folder_admin_removed', removedBy, userId, 'folder_admin', result.rows[0].id, {
          folderId
        });
      }

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error removing folder admin:', error);
      throw error;
    }
  }

  /**
   * Set UI permission for a user
   */
  async setUIPermission(grantedBy, userId, uiElement, isVisible, isEnabled = true, customLabel = null) {
    try {
      const result = await query(
        `INSERT INTO ui_permissions (user_id, ui_element, is_visible, is_enabled, custom_label, granted_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, ui_element)
         DO UPDATE SET
           is_visible = EXCLUDED.is_visible,
           is_enabled = EXCLUDED.is_enabled,
           custom_label = EXCLUDED.custom_label,
           granted_by = EXCLUDED.granted_by,
           granted_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userId, uiElement, isVisible, isEnabled, customLabel, grantedBy]
      );

      await this._logPermissionChange('ui_permission_set', grantedBy, userId, 'ui_permission', result.rows[0].id, {
        uiElement,
        isVisible,
        isEnabled,
        customLabel
      });

      return result.rows[0];
    } catch (error) {
      console.error('Error setting UI permission:', error);
      throw error;
    }
  }

  /**
   * Get UI permissions for a user (used by frontend to show/hide sidebar items)
   */
  async getUIPermissions(userId) {
    try {
      // Check if user is Super Admin - they see everything
      const isSuperAdmin = await this._isSuperAdmin(userId);
      if (isSuperAdmin) {
        return {
          dashboard: { visible: true, enabled: true },
          file_requests: { visible: true, enabled: true },
          media_library: { visible: true, enabled: true },
          canvas: { visible: true, enabled: true },
          analytics: { visible: true, enabled: true },
          admin_panel: { visible: true, enabled: true }
        };
      }

      // Get explicit UI permissions
      const result = await query(
        `SELECT ui_element, is_visible, is_enabled, custom_label
         FROM ui_permissions
         WHERE user_id = $1`,
        [userId]
      );

      // Build permissions object
      const permissions = {};
      result.rows.forEach(row => {
        permissions[row.ui_element] = {
          visible: row.is_visible,
          enabled: row.is_enabled,
          customLabel: row.custom_label
        };
      });

      // Set defaults for elements without explicit permissions based on user roles
      const defaultPermissions = await this._getDefaultUIPermissions(userId);

      return { ...defaultPermissions, ...permissions };
    } catch (error) {
      console.error('Error getting UI permissions:', error);
      throw error;
    }
  }

  /**
   * Get permission audit log
   */
  async getAuditLog(filters = {}) {
    try {
      const { userId, targetUserId, actionType, startDate, endDate, limit = 100, offset = 0 } = filters;

      let whereConditions = [];
      let params = [];
      let paramIndex = 1;

      if (userId) {
        whereConditions.push(`performed_by = $${paramIndex++}`);
        params.push(userId);
      }

      if (targetUserId) {
        whereConditions.push(`target_user_id = $${paramIndex++}`);
        params.push(targetUserId);
      }

      if (actionType) {
        whereConditions.push(`action_type = $${paramIndex++}`);
        params.push(actionType);
      }

      if (startDate) {
        whereConditions.push(`created_at >= $${paramIndex++}`);
        params.push(startDate);
      }

      if (endDate) {
        whereConditions.push(`created_at <= $${paramIndex++}`);
        params.push(endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      params.push(limit, offset);

      const result = await query(
        `SELECT
           pal.*,
           performer.name as performer_name,
           performer.email as performer_email,
           target.name as target_user_name,
           target.email as target_user_email
         FROM permission_audit_log pal
         JOIN users performer ON pal.performed_by = performer.id
         LEFT JOIN users target ON pal.target_user_id = target.id
         ${whereClause}
         ORDER BY pal.created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        params
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting audit log:', error);
      throw error;
    }
  }

  /**
   * Deactivate expired permissions (should be called periodically)
   */
  async deactivateExpiredPermissions() {
    try {
      await query('SELECT deactivate_expired_permissions()');
      return true;
    } catch (error) {
      console.error('Error deactivating expired permissions:', error);
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  async _checkExplicitPermission(userId, resourceType, action, resourceId, permission) {
    const result = await query(
      `SELECT 1 FROM permissions
       WHERE user_id = $1
         AND resource_type = $2
         AND action = $3
         AND (resource_id = $4 OR resource_id IS NULL)
         AND permission = $5
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [userId, resourceType, action, resourceId, permission]
    );
    return result.rows.length > 0;
  }

  async _isSuperAdmin(userId) {
    const result = await query(
      `SELECT 1 FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND r.name = 'Super Admin'
         AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0;
  }

  async _isFolderAdmin(userId, folderId, action) {
    const result = await query(
      `SELECT can_grant_access, can_revoke_access, can_manage_requests, can_delete_files
       FROM folder_admins
       WHERE user_id = $1
         AND folder_id = $2
         AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [userId, folderId]
    );

    if (result.rows.length === 0) return false;

    const perms = result.rows[0];

    // Map actions to folder admin permissions
    const actionMap = {
      view: true, // Folder admins can always view
      create: perms.can_manage_requests,
      edit: perms.can_manage_requests,
      delete: perms.can_delete_files,
      assign: perms.can_grant_access,
      unassign: perms.can_revoke_access
    };

    return actionMap[action] || false;
  }

  async _checkRolePermission(userId, resourceType, action, resourceId) {
    // Check user's active roles and their default permissions
    const result = await query(
      `SELECT 1 FROM user_roles ur
       JOIN role_default_permissions rdp ON ur.role_id = rdp.role_id
       WHERE ur.user_id = $1
         AND rdp.resource_type = $2
         AND rdp.action = $3
         AND rdp.permission = 'allow'
         AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
         AND (ur.scope_type = 'global' OR (ur.scope_type IN ('folder', 'request') AND ur.scope_id = $4))
       LIMIT 1`,
      [userId, resourceType, action, resourceId]
    );

    return result.rows.length > 0;
  }

  async _getFolderIdForResource(resourceType, resourceId) {
    if (resourceType === 'folder') {
      return resourceId;
    }

    if (resourceType === 'file_request') {
      const result = await query('SELECT folder_id FROM file_requests WHERE id = $1', [resourceId]);
      return result.rows.length > 0 ? result.rows[0].folder_id : null;
    }

    if (resourceType === 'media_file') {
      // Media files can be associated with file requests which are in folders
      const result = await query(
        `SELECT fr.folder_id
         FROM media_files mf
         LEFT JOIN file_request_uploads fru ON mf.id = fru.media_file_id
         LEFT JOIN file_requests fr ON fru.file_request_id = fr.id
         WHERE mf.id = $1
         LIMIT 1`,
        [resourceId]
      );
      return result.rows.length > 0 ? result.rows[0].folder_id : null;
    }

    return null;
  }

  async _getDefaultUIPermissions(userId) {
    // Get user's roles to determine default UI visibility
    const result = await query(
      `SELECT DISTINCT r.name
       FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND ur.is_active = TRUE
         AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)`,
      [userId]
    );

    const roleNames = result.rows.map(r => r.name);

    // Default visibility based on roles
    const defaults = {
      dashboard: { visible: true, enabled: true },
      file_requests: { visible: false, enabled: true },
      media_library: { visible: false, enabled: true },
      canvas: { visible: false, enabled: true },
      analytics: { visible: false, enabled: true },
      admin_panel: { visible: false, enabled: true }
    };

    // Admin and Super Admin see everything
    if (roleNames.includes('Super Admin') || roleNames.includes('Admin')) {
      Object.keys(defaults).forEach(key => {
        defaults[key].visible = true;
      });
    }
    // Buyers see file requests, canvas, analytics
    else if (roleNames.includes('Buyer')) {
      defaults.file_requests.visible = true;
      defaults.canvas.visible = true;
      defaults.analytics.visible = true;
    }
    // Editors see media library
    else if (roleNames.includes('Editor')) {
      defaults.media_library.visible = true;
      defaults.file_requests.visible = true;
    }
    // Viewers see limited items
    else if (roleNames.includes('Viewer')) {
      defaults.file_requests.visible = true;
      defaults.media_library.visible = true;
    }

    return defaults;
  }

  async _logPermissionChange(actionType, performedBy, targetUserId, resourceType, resourceId, details) {
    try {
      await query(
        `INSERT INTO permission_audit_log
          (action_type, performed_by, target_user_id, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [actionType, performedBy, targetUserId, resourceType, resourceId, JSON.stringify(details)]
      );
    } catch (error) {
      console.error('Error logging permission change:', error);
      // Don't throw - logging should not break the operation
    }
  }
}

module.exports = new PermissionService();
