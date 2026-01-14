const permissionService = require('../services/permissionService');

/**
 * Permission Middleware
 *
 * Protects routes by checking if the authenticated user has permission
 * to perform the requested action on the specified resource type.
 */

/**
 * Generic permission check middleware
 *
 * @param {string} resourceType - Type of resource (file_request, folder, media_file, etc.)
 * @param {string} action - Action to perform (view, create, edit, delete, etc.)
 * @param {object} options - Additional options
 * @param {function} options.getResourceId - Function to extract resource ID from request (req) => resourceId
 * @param {boolean} options.checkOwnership - If true, checks if user owns the resource
 * @returns {Function} Express middleware
 */
function requirePermission(resourceType, action, options = {}) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Extract resource ID if provided
      let resourceId = null;
      if (options.getResourceId) {
        resourceId = options.getResourceId(req);
      } else if (req.params.id) {
        resourceId = req.params.id;
      }

      // Check ownership if required
      if (options.checkOwnership && resourceId) {
        const isOwner = await checkOwnership(userId, resourceType, resourceId);
        if (isOwner) {
          return next(); // Owners always have permission
        }
      }

      // Check permission
      const hasPermission = await permissionService.checkPermission(
        userId,
        resourceType,
        action,
        resourceId
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: `You do not have permission to ${action} ${resourceType}${resourceId ? ` with ID ${resourceId}` : ''}`
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check if user is Super Admin
 */
function requireSuperAdmin() {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const hasPermission = await permissionService.checkPermission(userId, 'admin_panel', 'manage');

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'Super Admin access required'
        });
      }

      next();
    } catch (error) {
      console.error('Super Admin check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check if user is folder admin for the specified folder
 */
function requireFolderAdmin(getFolderId) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const folderId = typeof getFolderId === 'function' ? getFolderId(req) : getFolderId;

      if (!folderId) {
        return res.status(400).json({
          success: false,
          error: 'Bad request',
          message: 'Folder ID is required'
        });
      }

      const hasPermission = await permissionService.checkPermission(userId, 'folder', 'manage', folderId);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied',
          message: 'Folder admin access required'
        });
      }

      next();
    } catch (error) {
      console.error('Folder admin check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check if user can perform any of the specified actions
 */
function requireAnyPermission(resourceType, actions, options = {}) {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      let resourceId = null;
      if (options.getResourceId) {
        resourceId = options.getResourceId(req);
      } else if (req.params.id) {
        resourceId = req.params.id;
      }

      // Check each action until one passes
      for (const action of actions) {
        const hasPermission = await permissionService.checkPermission(
          userId,
          resourceType,
          action,
          resourceId
        );

        if (hasPermission) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        error: 'Permission denied',
        message: `You do not have permission to perform any of: ${actions.join(', ')} on ${resourceType}`
      });
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        message: error.message
      });
    }
  };
}

/**
 * Check if user owns a resource
 */
async function checkOwnership(userId, resourceType, resourceId) {
  const { query } = require('../config/database');

  try {
    switch (resourceType) {
      case 'file_request':
        const frResult = await query(
          'SELECT 1 FROM file_requests WHERE id = $1 AND created_by = $2',
          [resourceId, userId]
        );
        return frResult.rows.length > 0;

      case 'folder':
        const folderResult = await query(
          'SELECT 1 FROM folders WHERE id = $1 AND created_by = $2',
          [resourceId, userId]
        );
        return folderResult.rows.length > 0;

      case 'media_file':
        const mfResult = await query(
          'SELECT 1 FROM media_files WHERE id = $1 AND uploaded_by = $2',
          [resourceId, userId]
        );
        return mfResult.rows.length > 0;

      case 'canvas':
        const canvasResult = await query(
          'SELECT 1 FROM canvas_briefs WHERE id = $1 AND created_by = $2',
          [resourceId, userId]
        );
        return canvasResult.rows.length > 0;

      default:
        return false;
    }
  } catch (error) {
    console.error('Ownership check error:', error);
    return false;
  }
}

/**
 * Attach user permissions to request object
 * This middleware adds req.permissions with all user permissions
 * Useful for controllers that need to check multiple permissions
 */
function attachPermissions() {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const permissions = await permissionService.getUserPermissions(userId);
      req.permissions = permissions;
      next();
    } catch (error) {
      console.error('Error attaching permissions:', error);
      // Don't fail the request, just continue without permissions
      req.permissions = null;
      next();
    }
  };
}

/**
 * Common permission middleware shortcuts
 */
const permissions = {
  // File Requests
  canViewFileRequests: () => requirePermission('file_request', 'view'),
  canCreateFileRequest: () => requirePermission('file_request', 'create'),
  canEditFileRequest: () => requirePermission('file_request', 'edit'),
  canDeleteFileRequest: () => requirePermission('file_request', 'delete'),

  // Folders
  canViewFolders: () => requirePermission('folder', 'view'),
  canCreateFolder: () => requirePermission('folder', 'create'),
  canEditFolder: () => requirePermission('folder', 'edit'),
  canDeleteFolder: () => requirePermission('folder', 'delete'),

  // Media Files
  canViewMediaFiles: () => requirePermission('media_file', 'view'),
  canUploadMedia: () => requirePermission('media_file', 'upload'),
  canDownloadMedia: () => requirePermission('media_file', 'download'),
  canDeleteMedia: () => requirePermission('media_file', 'delete'),

  // Canvas
  canViewCanvas: () => requirePermission('canvas', 'view'),
  canCreateCanvas: () => requirePermission('canvas', 'create'),
  canEditCanvas: () => requirePermission('canvas', 'edit'),

  // Analytics
  canViewAnalytics: () => requirePermission('analytics', 'view'),

  // Admin Panel
  canAccessAdminPanel: () => requirePermission('admin_panel', 'view'),
  canManageUsers: () => requirePermission('user', 'manage'),

  // Super Admin only
  requireSuperAdmin,

  // Folder Admin
  requireFolderAdmin
};

module.exports = {
  requirePermission,
  requireSuperAdmin,
  requireFolderAdmin,
  requireAnyPermission,
  attachPermissions,
  checkOwnership,
  permissions
};
