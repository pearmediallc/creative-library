const express = require('express');
const router = express.Router();
const rbacController = require('../controllers/rbacController');
const { authenticateToken: auth } = require('../middleware/auth');
const { permissions, requireSuperAdmin } = require('../middleware/permissionMiddleware');

// ==================== USER ENDPOINTS (Authenticated users) ====================

/**
 * @route   GET /api/rbac/permissions/me
 * @desc    Get all permissions for authenticated user
 * @access  Private
 */
router.get('/permissions/me', auth, rbacController.getMyPermissions);

/**
 * @route   GET /api/rbac/permissions/ui
 * @desc    Get UI permissions for authenticated user (sidebar visibility)
 * @access  Private
 */
router.get('/permissions/ui', auth, rbacController.getMyUIPermissions);

/**
 * @route   POST /api/rbac/permissions/check
 * @desc    Check if user has specific permission
 * @access  Private
 * @body    { resourceType, action, resourceId? }
 */
router.post('/permissions/check', auth, rbacController.checkPermission);

/**
 * @route   POST /api/rbac/permissions/check-multiple
 * @desc    Check multiple permissions at once
 * @access  Private
 * @body    { resourceType, actions: [], resourceId? }
 */
router.post('/permissions/check-multiple', auth, rbacController.checkMultiplePermissions);

// ==================== ADMIN ENDPOINTS (Admin & Super Admin only) ====================

/**
 * @route   GET /api/rbac/users
 * @desc    Get all users with their permissions
 * @access  Private (Admin only)
 */
router.get('/users', auth, permissions.canAccessAdminPanel(), rbacController.getAllUsersPermissions);

/**
 * @route   GET /api/rbac/users/:userId
 * @desc    Get permissions for specific user
 * @access  Private (Admin only)
 */
router.get('/users/:userId', auth, permissions.canAccessAdminPanel(), rbacController.getUserPermissions);

/**
 * @route   POST /api/rbac/permissions/grant
 * @desc    Grant permission to a user
 * @access  Private (Admin only)
 * @body    { userId, resourceType, action, permission, resourceId?, expiresAt?, reason? }
 */
router.post('/permissions/grant', auth, permissions.canManageUsers(), rbacController.grantPermission);

/**
 * @route   POST /api/rbac/permissions/revoke
 * @desc    Revoke permission from a user
 * @access  Private (Admin only)
 * @body    { userId, resourceType, action, resourceId? }
 */
router.post('/permissions/revoke', auth, permissions.canManageUsers(), rbacController.revokePermission);

/**
 * @route   POST /api/rbac/roles/assign
 * @desc    Assign role to a user
 * @access  Private (Admin only)
 * @body    { userId, roleName, scopeType?, scopeId?, expiresAt? }
 */
router.post('/roles/assign', auth, permissions.canManageUsers(), rbacController.assignRole);

/**
 * @route   POST /api/rbac/roles/remove
 * @desc    Remove role from a user
 * @access  Private (Admin only)
 * @body    { userId, roleName, scopeType?, scopeId? }
 */
router.post('/roles/remove', auth, permissions.canManageUsers(), rbacController.removeRole);

/**
 * @route   GET /api/rbac/roles
 * @desc    Get all available roles
 * @access  Private (Admin only)
 */
router.get('/roles', auth, permissions.canAccessAdminPanel(), rbacController.getRoles);

/**
 * @route   GET /api/rbac/roles/:roleId/permissions
 * @desc    Get default permissions for a role
 * @access  Private (Admin only)
 */
router.get('/roles/:roleId/permissions', auth, permissions.canAccessAdminPanel(), rbacController.getRolePermissions);

// ==================== FOLDER ADMIN ENDPOINTS ====================

/**
 * @route   POST /api/rbac/folder-admin/add
 * @desc    Add folder admin
 * @access  Private (Admin or Folder Admin only)
 * @body    { userId, folderId, permissions: {...}, expiresAt? }
 */
router.post('/folder-admin/add', auth, rbacController.addFolderAdmin);

/**
 * @route   POST /api/rbac/folder-admin/remove
 * @desc    Remove folder admin
 * @access  Private (Admin or Folder Admin only)
 * @body    { userId, folderId }
 */
router.post('/folder-admin/remove', auth, rbacController.removeFolderAdmin);

/**
 * @route   GET /api/rbac/folder-admin/:folderId
 * @desc    Get all admins for a folder
 * @access  Private
 */
router.get('/folder-admin/:folderId', auth, rbacController.getFolderAdmins);

// ==================== UI PERMISSIONS ENDPOINTS ====================

/**
 * @route   POST /api/rbac/ui-permissions
 * @desc    Set UI permission for a user
 * @access  Private (Admin only)
 * @body    { userId, uiElement, isVisible, isEnabled?, customLabel? }
 */
router.post('/ui-permissions', auth, permissions.canManageUsers(), rbacController.setUIPermission);

// ==================== AUDIT LOG ENDPOINTS ====================

/**
 * @route   GET /api/rbac/audit-log
 * @desc    Get permission audit log
 * @access  Private (Admin only)
 * @query   userId, targetUserId, actionType, startDate, endDate, limit, offset
 */
router.get('/audit-log', auth, permissions.canAccessAdminPanel(), rbacController.getAuditLog);

// ==================== MAINTENANCE ENDPOINTS ====================

/**
 * @route   POST /api/rbac/cleanup-expired
 * @desc    Deactivate expired permissions (cron job or manual)
 * @access  Private (Super Admin only)
 */
router.post('/cleanup-expired', auth, requireSuperAdmin(), rbacController.cleanupExpiredPermissions);

module.exports = router;
