/**
 * Folder Access Controller
 * Handles granting and managing folder permissions
 */

const { query } = require('../config/database');
const Folder = require('../models/Folder');
const logger = require('../utils/logger');

/**
 * Grant access to a folder
 * POST /api/folders/:folderId/grant-access
 */
async function grantFolderAccess(req, res) {
  try {
    const { folderId } = req.params;
    const { userId: granteeUserId, permissionType, expiresAt } = req.body;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!granteeUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!permissionType || !['view', 'edit', 'delete'].includes(permissionType)) {
      return res.status(400).json({ error: 'Valid permission type is required (view, edit, delete)' });
    }

    // Check if folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Permission check: must be folder owner or admin
    const isOwner = folder.owner_id === currentUserId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Only folder owner or admin can grant access'
      });
    }

    // Check if permission already exists
    const existingPermission = await query(
      `SELECT id FROM permissions
       WHERE resource_type = 'folder'
         AND resource_id = $1
         AND grantee_type = 'user'
         AND grantee_id = $2
         AND permission_type = $3`,
      [folderId, granteeUserId, permissionType]
    );

    if (existingPermission.rows.length > 0) {
      return res.status(400).json({
        error: 'Permission already exists for this user'
      });
    }

    // Grant the permission
    const result = await query(
      `INSERT INTO permissions (
        resource_type,
        resource_id,
        grantee_type,
        grantee_id,
        permission_type,
        granted_by,
        granted_by_folder_owner,
        expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        'folder',
        folderId,
        'user',
        granteeUserId,
        permissionType,
        currentUserId,
        isOwner, // Mark if granted by folder owner
        expiresAt || null
      ]
    );

    // Get user details for response
    const userDetails = await query(
      `SELECT id, username, email, role FROM users WHERE id = $1`,
      [granteeUserId]
    );

    logger.info('Folder access granted', {
      folder_id: folderId,
      grantee_user_id: granteeUserId,
      permission_type: permissionType,
      granted_by: currentUserId
    });

    res.status(201).json({
      success: true,
      data: {
        permission: result.rows[0],
        user: userDetails.rows[0]
      },
      message: 'Access granted successfully'
    });
  } catch (error) {
    logger.error('Grant folder access failed', {
      error: error.message,
      folder_id: req.params.folderId
    });
    res.status(500).json({ error: 'Failed to grant folder access' });
  }
}

/**
 * Get all permissions for a folder
 * GET /api/folders/:folderId/permissions
 */
async function getFolderPermissions(req, res) {
  try {
    const { folderId } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    // Check if folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Permission check: must be folder owner, admin, or have view access
    const isOwner = folder.owner_id === currentUserId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    const hasAccess = await Folder.canAccess(currentUserId, folderId, 'view');

    if (!isOwner && !isAdmin && !hasAccess) {
      return res.status(403).json({
        error: 'You do not have permission to view folder permissions'
      });
    }

    // Get all permissions for this folder
    const result = await query(
      `SELECT
        p.*,
        u.username,
        u.email,
        u.role as user_role,
        granter.username as granted_by_username
      FROM permissions p
      JOIN users u ON p.grantee_id = u.id
      LEFT JOIN users granter ON p.granted_by = granter.id
      WHERE p.resource_type = 'folder'
        AND p.resource_id = $1
        AND p.grantee_type = 'user'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
      ORDER BY p.created_at DESC`,
      [folderId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get folder permissions failed', {
      error: error.message,
      folder_id: req.params.folderId
    });
    res.status(500).json({ error: 'Failed to fetch folder permissions' });
  }
}

/**
 * Revoke folder access
 * DELETE /api/folders/:folderId/permissions/:permissionId
 */
async function revokeFolderAccess(req, res) {
  try {
    const { folderId, permissionId } = req.params;
    const currentUserId = req.user.id;
    const userRole = req.user.role;

    // Check if folder exists
    const folder = await Folder.findById(folderId);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Permission check: must be folder owner or admin
    const isOwner = folder.owner_id === currentUserId;
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: 'Only folder owner or admin can revoke access'
      });
    }

    // Check if permission exists and belongs to this folder
    const permissionCheck = await query(
      `SELECT * FROM permissions
       WHERE id = $1 AND resource_type = 'folder' AND resource_id = $2`,
      [permissionId, folderId]
    );

    if (permissionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Permission not found' });
    }

    // Delete the permission
    await query(
      `DELETE FROM permissions WHERE id = $1`,
      [permissionId]
    );

    logger.info('Folder access revoked', {
      folder_id: folderId,
      permission_id: permissionId,
      revoked_by: currentUserId
    });

    res.json({
      success: true,
      message: 'Access revoked successfully'
    });
  } catch (error) {
    logger.error('Revoke folder access failed', {
      error: error.message,
      folder_id: req.params.folderId,
      permission_id: req.params.permissionId
    });
    res.status(500).json({ error: 'Failed to revoke folder access' });
  }
}

/**
 * Search users for granting access
 * GET /api/folders/search-users?q=query
 */
async function searchUsersForAccess(req, res) {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = `%${q.trim()}%`;

    // Search users by username or email
    const result = await query(
      `SELECT id, username, email, role
       FROM users
       WHERE (username ILIKE $1 OR email ILIKE $1)
         AND id != $2
       ORDER BY username ASC
       LIMIT 20`,
      [searchTerm, req.user.id] // Exclude current user
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Search users failed', {
      error: error.message,
      query: req.query.q
    });
    res.status(500).json({ error: 'Failed to search users' });
  }
}

module.exports = {
  grantFolderAccess,
  getFolderPermissions,
  revokeFolderAccess,
  searchUsersForAccess
};
