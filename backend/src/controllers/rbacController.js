const permissionService = require('../services/permissionService');
const { query } = require('../config/database');

/**
 * RBAC (Role-Based Access Control) Controller
 * Handles all RBAC permission-related API endpoints
 */

/**
 * Get all permissions for the authenticated user
 * GET /api/rbac/permissions/me
 */
async function getMyPermissions(req, res) {
  try {
    const userId = req.user.id;
    const permissions = await permissionService.getUserPermissions(userId);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get permissions',
      message: error.message
    });
  }
}

/**
 * Get UI permissions for the authenticated user
 * GET /api/rbac/permissions/ui
 */
async function getMyUIPermissions(req, res) {
  try {
    const userId = req.user.id;
    const uiPermissions = await permissionService.getUIPermissions(userId);

    res.json({
      success: true,
      data: uiPermissions
    });
  } catch (error) {
    console.error('Error getting UI permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get UI permissions',
      message: error.message
    });
  }
}

/**
 * Check if user has specific permission
 * POST /api/rbac/permissions/check
 * Body: { resourceType, action, resourceId? }
 */
async function checkPermission(req, res) {
  try {
    const userId = req.user.id;
    const { resourceType, action, resourceId } = req.body;

    if (!resourceType || !action) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'resourceType and action are required'
      });
    }

    const hasPermission = await permissionService.checkPermission(
      userId,
      resourceType,
      action,
      resourceId
    );

    res.json({
      success: true,
      data: {
        hasPermission,
        resourceType,
        action,
        resourceId
      }
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check permission',
      message: error.message
    });
  }
}

/**
 * Check multiple permissions at once
 * POST /api/rbac/permissions/check-multiple
 * Body: { resourceType, actions: [], resourceId? }
 */
async function checkMultiplePermissions(req, res) {
  try {
    const userId = req.user.id;
    const { resourceType, actions, resourceId } = req.body;

    if (!resourceType || !actions || !Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'resourceType and actions array are required'
      });
    }

    const permissions = await permissionService.checkPermissions(
      userId,
      resourceType,
      actions,
      resourceId
    );

    res.json({
      success: true,
      data: {
        permissions,
        resourceType,
        resourceId
      }
    });
  } catch (error) {
    console.error('Error checking multiple permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check permissions',
      message: error.message
    });
  }
}

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get all users with their permissions (Admin only)
 * GET /api/rbac/users
 */
async function getAllUsersPermissions(req, res) {
  try {
    const result = await query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role as legacy_role,
        u.created_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'role_name', r.name,
              'scope_type', ur.scope_type,
              'scope_id', ur.scope_id,
              'expires_at', ur.expires_at
            )
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) as roles,
        COUNT(DISTINCT fa.folder_id) as folder_admin_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = TRUE
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN folder_admins fa ON u.id = fa.user_id AND fa.is_active = TRUE
      GROUP BY u.id, u.name, u.email, u.role, u.created_at
      ORDER BY u.name`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting all users permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users permissions',
      message: error.message
    });
  }
}

/**
 * Get permissions for a specific user (Admin only)
 * GET /api/rbac/users/:userId
 */
async function getUserPermissions(req, res) {
  try {
    const { userId } = req.params;
    const permissions = await permissionService.getUserPermissions(userId);

    res.json({
      success: true,
      data: permissions
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user permissions',
      message: error.message
    });
  }
}

/**
 * Grant permission to a user (Admin only)
 * POST /api/rbac/permissions/grant
 * Body: { userId, resourceType, action, permission, resourceId?, expiresAt?, reason? }
 */
async function grantPermission(req, res) {
  try {
    const grantedBy = req.user.id;
    const { userId, resourceType, action, permission = 'allow', resourceId, expiresAt, reason } = req.body;

    if (!userId || !resourceType || !action) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId, resourceType, and action are required'
      });
    }

    const result = await permissionService.grantPermission(
      grantedBy,
      userId,
      resourceType,
      action,
      permission,
      { resourceId, expiresAt, reason }
    );

    res.json({
      success: true,
      message: 'Permission granted successfully',
      data: result
    });
  } catch (error) {
    console.error('Error granting permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to grant permission',
      message: error.message
    });
  }
}

/**
 * Revoke permission from a user (Admin only)
 * POST /api/rbac/permissions/revoke
 * Body: { userId, resourceType, action, resourceId? }
 */
async function revokePermission(req, res) {
  try {
    const revokedBy = req.user.id;
    const { userId, resourceType, action, resourceId } = req.body;

    if (!userId || !resourceType || !action) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId, resourceType, and action are required'
      });
    }

    const result = await permissionService.revokePermission(
      revokedBy,
      userId,
      resourceType,
      action,
      resourceId
    );

    res.json({
      success: true,
      message: result ? 'Permission revoked successfully' : 'Permission not found',
      data: { revoked: result }
    });
  } catch (error) {
    console.error('Error revoking permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke permission',
      message: error.message
    });
  }
}

/**
 * Assign role to a user (Admin only)
 * POST /api/rbac/roles/assign
 * Body: { userId, roleName, scopeType?, scopeId?, expiresAt? }
 */
async function assignRole(req, res) {
  try {
    const assignedBy = req.user.id;
    const { userId, roleName, scopeType, scopeId, expiresAt } = req.body;

    if (!userId || !roleName) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId and roleName are required'
      });
    }

    const result = await permissionService.assignRole(
      assignedBy,
      userId,
      roleName,
      { scopeType, scopeId, expiresAt }
    );

    res.json({
      success: true,
      message: 'Role assigned successfully',
      data: result
    });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign role',
      message: error.message
    });
  }
}

/**
 * Remove role from a user (Admin only)
 * POST /api/rbac/roles/remove
 * Body: { userId, roleName, scopeType?, scopeId? }
 */
async function removeRole(req, res) {
  try {
    const removedBy = req.user.id;
    const { userId, roleName, scopeType = 'global', scopeId } = req.body;

    if (!userId || !roleName) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId and roleName are required'
      });
    }

    const result = await permissionService.removeRole(
      removedBy,
      userId,
      roleName,
      scopeType,
      scopeId
    );

    res.json({
      success: true,
      message: result ? 'Role removed successfully' : 'Role assignment not found',
      data: { removed: result }
    });
  } catch (error) {
    console.error('Error removing role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove role',
      message: error.message
    });
  }
}

/**
 * Add folder admin (Admin or Folder Admin only)
 * POST /api/rbac/folder-admin/add
 * Body: { userId, folderId, permissions: { canGrantAccess, canRevokeAccess, canManageRequests, canDeleteFiles }, expiresAt? }
 */
async function addFolderAdmin(req, res) {
  try {
    const assignedBy = req.user.id;
    const { userId, folderId, permissions = {}, expiresAt } = req.body;

    if (!userId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId and folderId are required'
      });
    }

    const result = await permissionService.addFolderAdmin(
      assignedBy,
      userId,
      folderId,
      { ...permissions, expiresAt }
    );

    res.json({
      success: true,
      message: 'Folder admin added successfully',
      data: result
    });
  } catch (error) {
    console.error('Error adding folder admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add folder admin',
      message: error.message
    });
  }
}

/**
 * Remove folder admin (Admin or Folder Admin only)
 * POST /api/rbac/folder-admin/remove
 * Body: { userId, folderId }
 */
async function removeFolderAdmin(req, res) {
  try {
    const removedBy = req.user.id;
    const { userId, folderId } = req.body;

    if (!userId || !folderId) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId and folderId are required'
      });
    }

    const result = await permissionService.removeFolderAdmin(
      removedBy,
      userId,
      folderId
    );

    res.json({
      success: true,
      message: result ? 'Folder admin removed successfully' : 'Folder admin assignment not found',
      data: { removed: result }
    });
  } catch (error) {
    console.error('Error removing folder admin:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove folder admin',
      message: error.message
    });
  }
}

/**
 * Get folder admins for a folder
 * GET /api/rbac/folder-admin/:folderId
 */
async function getFolderAdmins(req, res) {
  try {
    const { folderId } = req.params;

    const result = await query(
      `SELECT
        fa.*,
        u.name as user_name,
        u.email as user_email,
        assigner.name as assigned_by_name
      FROM folder_admins fa
      JOIN users u ON fa.user_id = u.id
      LEFT JOIN users assigner ON fa.assigned_by = assigner.id
      WHERE fa.folder_id = $1 AND fa.is_active = TRUE
      ORDER BY fa.assigned_at DESC`,
      [folderId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting folder admins:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get folder admins',
      message: error.message
    });
  }
}

/**
 * Set UI permission for a user (Admin only)
 * POST /api/rbac/ui-permissions
 * Body: { userId, uiElement, isVisible, isEnabled?, customLabel? }
 */
async function setUIPermission(req, res) {
  try {
    const grantedBy = req.user.id;
    const { userId, uiElement, isVisible, isEnabled = true, customLabel } = req.body;

    if (!userId || !uiElement || isVisible === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Bad request',
        message: 'userId, uiElement, and isVisible are required'
      });
    }

    const result = await permissionService.setUIPermission(
      grantedBy,
      userId,
      uiElement,
      isVisible,
      isEnabled,
      customLabel
    );

    res.json({
      success: true,
      message: 'UI permission set successfully',
      data: result
    });
  } catch (error) {
    console.error('Error setting UI permission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set UI permission',
      message: error.message
    });
  }
}

/**
 * Get permission audit log (Admin only)
 * GET /api/rbac/audit-log
 * Query params: userId, targetUserId, actionType, startDate, endDate, limit, offset
 */
async function getAuditLog(req, res) {
  try {
    const { userId, targetUserId, actionType, startDate, endDate, limit, offset } = req.query;

    const filters = {
      userId,
      targetUserId,
      actionType,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0
    };

    const logs = await permissionService.getAuditLog(filters);

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit: filters.limit,
        offset: filters.offset
      }
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get audit log',
      message: error.message
    });
  }
}

/**
 * Get all available roles
 * GET /api/rbac/roles
 */
async function getRoles(req, res) {
  try {
    const result = await query(
      `SELECT id, name, description, is_system_role
       FROM roles
       ORDER BY
         CASE name
           WHEN 'Super Admin' THEN 1
           WHEN 'Admin' THEN 2
           WHEN 'Buyer' THEN 3
           WHEN 'Editor' THEN 4
           WHEN 'Viewer' THEN 5
           ELSE 6
         END`
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get roles',
      message: error.message
    });
  }
}

/**
 * Get role default permissions
 * GET /api/rbac/roles/:roleId/permissions
 */
async function getRolePermissions(req, res) {
  try {
    const { roleId } = req.params;

    const result = await query(
      `SELECT
        rdp.resource_type,
        rdp.action,
        rdp.permission
      FROM role_default_permissions rdp
      WHERE rdp.role_id = $1
      ORDER BY rdp.resource_type, rdp.action`,
      [roleId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get role permissions',
      message: error.message
    });
  }
}

/**
 * Deactivate expired permissions (called by cron job or manually)
 * POST /api/rbac/cleanup-expired
 */
async function cleanupExpiredPermissions(req, res) {
  try {
    await permissionService.deactivateExpiredPermissions();

    res.json({
      success: true,
      message: 'Expired permissions deactivated successfully'
    });
  } catch (error) {
    console.error('Error cleaning up expired permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup expired permissions',
      message: error.message
    });
  }
}

module.exports = {
  // User endpoints
  getMyPermissions,
  getMyUIPermissions,
  checkPermission,
  checkMultiplePermissions,

  // Admin endpoints
  getAllUsersPermissions,
  getUserPermissions,
  grantPermission,
  revokePermission,
  assignRole,
  removeRole,
  addFolderAdmin,
  removeFolderAdmin,
  getFolderAdmins,
  setUIPermission,
  getAuditLog,
  getRoles,
  getRolePermissions,
  cleanupExpiredPermissions
};
