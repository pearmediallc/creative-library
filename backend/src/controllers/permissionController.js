const FilePermission = require('../models/FilePermission');
const MediaFile = require('../models/MediaFile');
const Folder = require('../models/Folder');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const slackService = require('../services/slackService');
const { query } = require('../config/database');

class PermissionController {
  /**
   * Grant permission to a file or folder
   * POST /api/permissions
   */
  async grantPermission(req, res, next) {
    try {
      const {
        resource_type,
        resource_id,
        grantee_type,
        grantee_id,
        permission_type,
        // Backward-compat alias (some clients send permission_level)
        permission_level,
        expires_at
      } = req.body;
      const userId = req.user.id;

      const effectivePermissionType = permission_type || permission_level;

      // Validate required fields
      if (!resource_type || !resource_id || !grantee_type || !grantee_id || !effectivePermissionType) {
        return res.status(400).json({
          error: 'Missing required fields: resource_type, resource_id, grantee_type, grantee_id, permission_type'
        });
      }

      // Verify user owns the resource or has permission to share
      const hasPermission = await this.verifyUserOwnership(resource_type, resource_id, userId);
      if (!hasPermission) {
        return res.status(403).json({ error: 'You do not have permission to share this resource' });
      }

      const permission = await FilePermission.grantPermission({
        resource_type,
        resource_id,
        grantee_type,
        grantee_id,
        permission_type: effectivePermissionType,
        granted_by: userId,
        expires_at: expires_at || null
      });

      logger.info('Permission granted', { permissionId: permission.id, grantedBy: userId });

      // Send Slack notification if sharing with a user
      if (grantee_type === 'user' && resource_type === 'file') {
        try {
          const file = await MediaFile.findById(resource_id);
          const granterResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
          const granterName = granterResult.rows[0]?.name || 'Someone';
          const fileUrl = `${process.env.FRONTEND_URL}/media/${resource_id}`;

          await slackService.notifyFileShared(
            grantee_id,
            file.original_filename,
            granterName,
            fileUrl
          );
        } catch (slackError) {
          // Don't fail the request if Slack notification fails
          logger.warn('Slack notification failed for file share', { error: slackError.message });
        }
      }

      res.status(201).json({
        success: true,
        data: permission
      });
    } catch (error) {
      logger.error('Grant permission failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get permissions for a resource
   * GET /api/permissions?resource_type=file&resource_id=xxx
   */
  async getPermissions(req, res, next) {
    try {
      const { resource_type, resource_id } = req.query;
      const userId = req.user.id;

      if (!resource_type || !resource_id) {
        return res.status(400).json({ error: 'resource_type and resource_id are required' });
      }

      // Verify user owns the resource
      const hasPermission = await this.verifyUserOwnership(resource_type, resource_id, userId);
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const permissions = await FilePermission.getResourcePermissions(resource_type, resource_id);

      res.json({
        success: true,
        data: permissions
      });
    } catch (error) {
      logger.error('Get permissions failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Revoke a permission
   * DELETE /api/permissions/:id
   */
  async revokePermission(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get permission to verify ownership
      const permission = await FilePermission.findById(id);
      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      // Verify user owns the resource or granted this permission
      const hasPermission = await this.verifyUserOwnership(
        permission.resource_type,
        permission.resource_id,
        userId
      );

      if (!hasPermission && permission.granted_by !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await FilePermission.revokePermission(id);

      logger.info('Permission revoked', { permissionId: id, revokedBy: userId });

      res.json({
        success: true,
        message: 'Permission revoked successfully'
      });
    } catch (error) {
      logger.error('Revoke permission failed', { error: error.message, permissionId: req.params.id });
      next(error);
    }
  }

  /**
   * Share folder with team (bulk grant permissions)
   * POST /api/permissions/share-folder
   */
  async shareFolderWithTeam(req, res, next) {
    try {
      const { folder_id, team_id, permissions: permissionTypes } = req.body;
      const userId = req.user.id;

      if (!folder_id || !team_id || !permissionTypes || !Array.isArray(permissionTypes)) {
        return res.status(400).json({
          error: 'folder_id, team_id, and permissions (array) are required'
        });
      }

      // Verify user owns the folder
      const folder = await Folder.findById(folder_id);
      if (!folder || folder.created_by !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Create permissions for each permission type
      const permissionsToGrant = permissionTypes.map(permType => ({
        resource_type: 'folder',
        resource_id: folder_id,
        grantee_type: 'team',
        grantee_id: team_id,
        permission_type: permType,
        granted_by: userId
      }));

      const count = await FilePermission.bulkGrantPermissions(permissionsToGrant);

      logger.info('Folder shared with team', {
        folderId: folder_id,
        teamId: team_id,
        permissionsCount: count,
        sharedBy: userId
      });

      res.status(201).json({
        success: true,
        message: `Granted ${count} permissions to team`,
        data: { permissionsCount: count }
      });
    } catch (error) {
      logger.error('Share folder failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Get resources shared by the current user
   * GET /api/permissions/shared-by-me
   */
  async getSharedByMe(req, res, next) {
    try {
      const userId = req.user.id;

      // Query to get all permissions for files/folders owned by this user
      const sql = `
        SELECT
          fp.id as permission_id,
          fp.resource_type,
          fp.resource_id,
          fp.grantee_type,
          fp.grantee_id,
          fp.permission_type,
          fp.granted_at,
          CASE
            WHEN fp.grantee_type = 'user' THEN u.name
            WHEN fp.grantee_type = 'team' THEN t.name
          END as grantee_name,
          CASE
            WHEN fp.grantee_type = 'user' THEN u.email
            ELSE NULL
          END as grantee_email,
          -- File metadata
          CASE
            WHEN fp.resource_type = 'file' THEN mf.original_filename
            ELSE NULL
          END as file_name,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.file_type
            ELSE NULL
          END as file_type,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.file_size
            ELSE NULL
          END as file_size,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.thumbnail_url
            ELSE NULL
          END as thumbnail_url,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.s3_url
            ELSE NULL
          END as s3_url,
          -- Folder metadata
          CASE
            WHEN fp.resource_type = 'folder' THEN f.name
            ELSE NULL
          END as folder_name,
          CASE
            WHEN fp.resource_type = 'folder' THEN f.color
            ELSE NULL
          END as folder_color,
          -- Owner info
          CASE
            WHEN fp.resource_type = 'file' THEN mf.uploaded_by
            WHEN fp.resource_type = 'folder' THEN f.owner_id
          END as owner_id
        FROM file_permissions fp
        LEFT JOIN users u ON fp.grantee_type = 'user' AND fp.grantee_id = u.id
        LEFT JOIN teams t ON fp.grantee_type = 'team' AND fp.grantee_id = t.id
        LEFT JOIN media_files mf ON fp.resource_type = 'file' AND fp.resource_id = mf.id
        LEFT JOIN folders f ON fp.resource_type = 'folder' AND fp.resource_id = f.id
        WHERE (
          -- Files owned by user
          (fp.resource_type = 'file' AND mf.uploaded_by = $1 AND mf.is_deleted = FALSE)
          OR
          -- Folders owned by user
          (fp.resource_type = 'folder' AND f.owner_id = $1 AND f.is_deleted = FALSE)
        )
        AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
        ORDER BY fp.granted_at DESC
      `;

      const result = await FilePermission.raw(sql, [userId]);
      const permissions = Array.isArray(result) ? result : result.rows || [];

      // Group permissions by resource
      const resourceMap = new Map();

      permissions.forEach(perm => {
        const key = `${perm.resource_type}-${perm.resource_id}`;

        if (!resourceMap.has(key)) {
          resourceMap.set(key, {
            resource_type: perm.resource_type,
            resource_id: perm.resource_id,
            resource_name: perm.resource_type === 'file' ? perm.file_name : perm.folder_name,
            file_type: perm.file_type,
            file_size: perm.file_size,
            thumbnail_url: perm.thumbnail_url,
            s3_url: perm.s3_url,
            folder_color: perm.folder_color,
            shares: [],
            share_count: 0,
            most_recent_share: perm.granted_at
          });
        }

        resourceMap.get(key).shares.push({
          permission_id: perm.permission_id,
          grantee_name: perm.grantee_name,
          grantee_email: perm.grantee_email,
          grantee_type: perm.grantee_type,
          grantee_id: perm.grantee_id,
          permission_type: perm.permission_type,
          granted_at: perm.granted_at
        });

        resourceMap.get(key).share_count = resourceMap.get(key).shares.length;
      });

      // Convert map to array
      const sharedResources = Array.from(resourceMap.values());

      logger.info('Shared by me retrieved', { userId, count: sharedResources.length });

      res.json({
        success: true,
        data: sharedResources
      });
    } catch (error) {
      logger.error('Get shared by me failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Get files/folders shared with the current user
   * GET /api/permissions/shared-with-me
   */
  async getSharedWithMe(req, res, next) {
    try {
      const userId = req.user.id;

      // Query to get all resources shared with the user (directly or via team)
      const sql = `
        SELECT DISTINCT ON (fp.resource_type, fp.resource_id, fp.permission_type)
          fp.resource_type,
          fp.resource_id,
          fp.permission_type,
          fp.granted_at,
          fp.grantee_type,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.original_filename
            WHEN fp.resource_type = 'folder' THEN f.name
          END as resource_name,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.file_type
            ELSE NULL
          END as file_type,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.file_size
            ELSE NULL
          END as file_size,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.thumbnail_url
            ELSE NULL
          END as thumbnail_url,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.s3_url
            ELSE NULL
          END as s3_url,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.s3_url
            ELSE NULL
          END as download_url,
          CASE
            WHEN fp.resource_type = 'file' THEN mf.created_at
            WHEN fp.resource_type = 'folder' THEN f.created_at
          END as created_at,
          u.name as owner_name,
          u.email as owner_email
        FROM file_permissions fp
        LEFT JOIN team_members tm ON fp.grantee_type = 'team' AND fp.grantee_id = tm.team_id
        LEFT JOIN media_files mf ON fp.resource_type = 'file' AND fp.resource_id = mf.id AND mf.is_deleted = FALSE
        LEFT JOIN folders f ON fp.resource_type = 'folder' AND fp.resource_id = f.id AND f.is_deleted = FALSE
        LEFT JOIN users u ON (
          (fp.resource_type = 'file' AND mf.uploaded_by = u.id) OR
          (fp.resource_type = 'folder' AND f.owner_id = u.id)
        )
        WHERE (
          (fp.grantee_type = 'user' AND fp.grantee_id = $1)
          OR (fp.grantee_type = 'team' AND tm.user_id = $1 AND tm.is_active = TRUE)
        )
        AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
        AND (
          (fp.resource_type = 'file' AND mf.id IS NOT NULL) OR
          (fp.resource_type = 'folder' AND f.id IS NOT NULL)
        )
        ORDER BY fp.resource_type, fp.resource_id, fp.permission_type, fp.granted_at DESC
      `;

      const result = await FilePermission.raw(sql, [userId]);
      const rows = Array.isArray(result) ? result : result.rows || [];

      // Group permissions by resource
      const resourceMap = new Map();
      rows.forEach(row => {
        const key = `${row.resource_type}-${row.resource_id}`;
        if (!resourceMap.has(key)) {
          resourceMap.set(key, {
            resource_type: row.resource_type,
            resource_id: row.resource_id,
            resource_name: row.resource_name,
            file_type: row.file_type,
            file_size: row.file_size,
            thumbnail_url: row.thumbnail_url,
            s3_url: row.s3_url,
            download_url: row.download_url,
            created_at: row.created_at,
            owner_name: row.owner_name,
            owner_email: row.owner_email,
            shared_at: row.granted_at,
            permissions: []
          });
        }

        const resource = resourceMap.get(key);
        if (!resource.permissions.includes(row.permission_type)) {
          resource.permissions.push(row.permission_type);
        }

        // Update shared_at to the most recent grant
        if (new Date(row.granted_at) > new Date(resource.shared_at)) {
          resource.shared_at = row.granted_at;
        }
      });

      // Convert map to array and sort by most recently shared
      const sharedResources = Array.from(resourceMap.values())
        .sort((a, b) => new Date(b.shared_at) - new Date(a.shared_at));

      logger.info('Shared with me resources fetched', {
        userId,
        count: sharedResources.length
      });

      res.json({
        success: true,
        data: sharedResources
      });
    } catch (error) {
      logger.error('Get shared with me failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Helper: Verify user owns a resource
   * @private
   */
  async verifyUserOwnership(resourceType, resourceId, userId) {
    try {
      // Check if user is admin - admins have access to everything
      const userResult = await query('SELECT role FROM users WHERE id = $1', [userId]);
      const userRole = userResult.rows[0]?.role;

      if (userRole === 'admin' || userRole === 'super_admin') {
        return true; // Admins bypass ownership checks
      }

      if (resourceType === 'file') {
        const file = await MediaFile.findById(resourceId);

        // User can share if they uploaded it
        if (file && file.uploaded_by === userId) {
          return true;
        }

        // User can share if file is assigned to them
        if (file && file.assigned_buyer_id === userId) {
          return true;
        }

        // User can share if they created the file request that this file belongs to
        if (file && file.metadata?.request_id) {
          const fileRequest = await query(
            `SELECT created_by FROM file_requests WHERE id = $1`,
            [file.metadata.request_id]
          );
          if (fileRequest.rows.length > 0 && fileRequest.rows[0].created_by === userId) {
            return true;
          }
        }

        return false;
      } else if (resourceType === 'folder') {
        const folder = await Folder.findById(resourceId);
        if (folder && folder.created_by === userId) {
          return true; // User created the folder
        }

        // Check if user is the CREATOR of a file request targeting this folder
        // Only request creators can share folders, not assigned buyers
        const fileRequestCreator = await query(
          `SELECT 1 FROM file_requests
           WHERE folder_id = $1
             AND created_by = $2
           LIMIT 1`,
          [resourceId, userId]
        );

        if (fileRequestCreator.rows.length > 0) {
          return true; // User created the file request for this folder
        }

        return false;
      }
      return false;
    } catch (error) {
      logger.error('Verify ownership failed', { error: error.message });
      return false;
    }
  }

  /**
   * Create (or update) public link for a resource
   * POST /api/permissions/public-link
   *
   * This is the ergonomic API that UIs expect: pass the resource_type/resource_id.
   */
  async createPublicLinkForResource(req, res, next) {
    try {
      const { resource_type, resource_id, password, expires_at, expires_in_days, disable_download, max_views } = req.body;
      const userId = req.user.id;

      if (!resource_type || !resource_id) {
        return res.status(400).json({ success: false, error: 'resource_type and resource_id are required' });
      }

      // Verify user owns the resource
      const hasPermission = await this.verifyUserOwnership(resource_type, resource_id, userId);
      if (!hasPermission) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      // Create or reuse a permission row (we anchor on a self-view permission)
      // so file_permissions constraints (non-null grantee fields) are satisfied.
      const anchor = await FilePermission.grantPermission({
        resource_type,
        resource_id,
        grantee_type: 'user',
        grantee_id: userId,
        permission_type: 'view',
        granted_by: userId,
        expires_at: null
      }).catch(async (e) => {
        // If it already exists due to UNIQUE constraint, fetch it
        const existing = await FilePermission.raw(
          `SELECT * FROM file_permissions
           WHERE resource_type = $1 AND resource_id = $2
             AND grantee_type = 'user' AND grantee_id = $3
             AND permission_type = 'view'
           LIMIT 1`,
          [resource_type, resource_id, userId]
        );
        return Array.isArray(existing) ? existing[0] : existing.rows?.[0];
      });

      if (!anchor || !anchor.id) {
        return res.status(500).json({ success: false, error: 'Failed to create public link anchor permission' });
      }

      // Resolve expiry
      let resolvedExpiresAt = expires_at || null;
      if (!resolvedExpiresAt && expires_in_days) {
        const days = Number(expires_in_days);
        if (!Number.isNaN(days) && days > 0) {
          resolvedExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // Reuse existing createPublicLink implementation by calling it with :id
      req.params.id = anchor.id;
      req.body = {
        password: password || null,
        expires_at: resolvedExpiresAt,
        disable_download: disable_download || false,
        max_views: max_views || null
      };

      return this.createPublicLink(req, res, next);
    } catch (error) {
      logger.error('Create public link (resource) failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Create public link for a resource (legacy)
   * POST /api/permissions/:id/public-link
   */
  async createPublicLink(req, res, next) {"}
    try {
      const { id } = req.params;
      const { password, expires_at, disable_download, max_views } = req.body;
      const userId = req.user.id;

      // Get the resource from permissions or create new public link permission
      const permission = await FilePermission.findById(id);

      if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
      }

      // Verify user owns the resource
      const hasPermission = await this.verifyUserOwnership(
        permission.resource_type,
        permission.resource_id,
        userId
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Hash password if provided
      let hashedPassword = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Update permission with public link settings
      const sql = `
        UPDATE file_permissions
        SET
          is_public_link = TRUE,
          link_password = $1,
          link_expires_at = $2,
          disable_download = $3,
          max_views = $4
        WHERE id = $5
        RETURNING *
      `;

      const result = await FilePermission.raw(sql, [
        hashedPassword,
        expires_at || null,
        disable_download || false,
        max_views || null,
        id
      ]);

      const updatedPermission = Array.isArray(result) ? result[0] : result.rows?.[0];

      logger.info('Public link created', { permissionId: id, userId });

      res.json({
        success: true,
        data: {
          ...updatedPermission,
          link_password: undefined, // Don't send password hash
          token: id
        }
      });
    } catch (error) {
      logger.error('Create public link failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Update public link settings
   * PATCH /api/permissions/public-link/:linkId
   */
  async updatePublicLink(req, res, next) {
    try {
      const { linkId } = req.params;
      const { password, expires_at, disable_download, max_views } = req.body;
      const userId = req.user.id;

      const permission = await FilePermission.findById(linkId);

      if (!permission || !permission.is_public_link) {
        return res.status(404).json({ error: 'Public link not found' });
      }

      // Verify user owns the resource
      const hasPermission = await this.verifyUserOwnership(
        permission.resource_type,
        permission.resource_id,
        userId
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Hash password if provided
      let hashedPassword = permission.link_password;
      if (password !== undefined) {
        hashedPassword = password ? await bcrypt.hash(password, 10) : null;
      }

      const sql = `
        UPDATE file_permissions
        SET
          link_password = $1,
          link_expires_at = $2,
          disable_download = $3,
          max_views = $4
        WHERE id = $5
        RETURNING *
      `;

      const result = await FilePermission.raw(sql, [
        hashedPassword,
        expires_at !== undefined ? expires_at : permission.link_expires_at,
        disable_download !== undefined ? disable_download : permission.disable_download,
        max_views !== undefined ? max_views : permission.max_views,
        linkId
      ]);

      const updatedPermission = Array.isArray(result) ? result[0] : result.rows?.[0];

      logger.info('Public link updated', { linkId, userId });

      res.json({
        success: true,
        data: {
          ...updatedPermission,
          link_password: undefined
        }
      });
    } catch (error) {
      logger.error('Update public link failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Revoke public link
   * DELETE /api/permissions/public-link/:linkId
   */
  async revokePublicLink(req, res, next) {
    try {
      const { linkId } = req.params;
      const userId = req.user.id;

      const permission = await FilePermission.findById(linkId);

      if (!permission || !permission.is_public_link) {
        return res.status(404).json({ error: 'Public link not found' });
      }

      // Verify user owns the resource
      const hasPermission = await this.verifyUserOwnership(
        permission.resource_type,
        permission.resource_id,
        userId
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Remove public link settings
      const sql = `
        UPDATE file_permissions
        SET
          is_public_link = FALSE,
          link_password = NULL,
          link_expires_at = NULL,
          disable_download = FALSE,
          view_count = 0,
          last_viewed_at = NULL,
          max_views = NULL
        WHERE id = $1
        RETURNING *
      `;

      await FilePermission.raw(sql, [linkId]);

      logger.info('Public link revoked', { linkId, userId });

      res.json({
        success: true,
        message: 'Public link revoked successfully'
      });
    } catch (error) {
      logger.error('Revoke public link failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Get public link stats
   * GET /api/permissions/public-link/:linkId/stats
   */
  async getPublicLinkStats(req, res, next) {
    try {
      const { linkId } = req.params;
      const userId = req.user.id;

      const permission = await FilePermission.findById(linkId);

      if (!permission || !permission.is_public_link) {
        return res.status(404).json({ error: 'Public link not found' });
      }

      // Verify user owns the resource
      const hasPermission = await this.verifyUserOwnership(
        permission.resource_type,
        permission.resource_id,
        userId
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get access log stats
      const statsSql = `
        SELECT
          COUNT(*) as total_accesses,
          COUNT(DISTINCT ip_address) as unique_visitors,
          MAX(accessed_at) as last_access
        FROM public_link_access_log
        WHERE permission_id = $1
      `;

      const statsResult = await FilePermission.raw(statsSql, [linkId]);
      const stats = Array.isArray(statsResult) ? statsResult[0] : statsResult.rows?.[0];

      res.json({
        success: true,
        data: {
          view_count: permission.view_count || 0,
          last_viewed_at: permission.last_viewed_at,
          max_views: permission.max_views,
          expires_at: permission.link_expires_at,
          has_password: !!permission.link_password,
          disable_download: permission.disable_download,
          ...stats
        }
      });
    } catch (error) {
      logger.error('Get public link stats failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Verify public link password
   * POST /api/permissions/public/verify
   */
  async verifyPublicLinkPassword(req, res, next) {
    try {
      const { token, password } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      const permission = await FilePermission.findById(token);

      if (!permission || !permission.is_public_link) {
        return res.status(404).json({ error: 'Public link not found' });
      }

      // Check expiration
      if (permission.link_expires_at && new Date(permission.link_expires_at) < new Date()) {
        return res.status(410).json({ error: 'Link has expired' });
      }

      // Check max views
      if (permission.max_views && permission.view_count >= permission.max_views) {
        return res.status(410).json({ error: 'Maximum views reached' });
      }

      // Check password
      if (permission.link_password) {
        if (!password) {
          return res.status(401).json({
            error: 'Password required',
            requires_password: true
          });
        }

        const isValid = await bcrypt.compare(password, permission.link_password);
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid password' });
        }
      }

      // Get resource details
      let resourceData = null;
      if (permission.resource_type === 'file') {
        const file = await MediaFile.findById(permission.resource_id);
        if (!file || file.is_deleted) {
          return res.status(404).json({ error: 'File not found or deleted' });
        }
        resourceData = {
          id: file.id,
          filename: file.original_filename,
          file_type: file.file_type,
          file_size: file.file_size,
          thumbnail_url: file.thumbnail_url,
          s3_url: file.s3_url,
          download_url: file.download_url,
          description: file.description
        };
      } else if (permission.resource_type === 'folder') {
        const folder = await Folder.findById(permission.resource_id);
        if (!folder || folder.is_deleted) {
          return res.status(404).json({ error: 'Folder not found or deleted' });
        }
        resourceData = {
          id: folder.id,
          name: folder.name,
          description: folder.description,
          color: folder.color
        };
      }

      // Increment view count and log access
      const updateSql = `
        UPDATE file_permissions
        SET view_count = view_count + 1, last_viewed_at = NOW()
        WHERE id = $1
      `;
      await FilePermission.raw(updateSql, [token]);

      // Log access
      const logSql = `
        INSERT INTO public_link_access_log
          (permission_id, ip_address, user_agent, action)
        VALUES ($1, $2, $3, $4)
      `;
      await FilePermission.raw(logSql, [
        token,
        req.ip,
        req.headers['user-agent'],
        'view'
      ]);

      logger.info('Public link accessed', { token, ip: req.ip });

      res.json({
        success: true,
        data: {
          resource_type: permission.resource_type,
          resource: resourceData,
          disable_download: permission.disable_download,
          expires_at: permission.link_expires_at
        }
      });
    } catch (error) {
      logger.error('Verify public link password failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Get public resource (no password)
   * GET /api/permissions/public/:token
   */
  async getPublicResource(req, res, next) {
    try {
      const { token } = req.params;

      const permission = await FilePermission.findById(token);

      if (!permission || !permission.is_public_link) {
        return res.status(404).json({ error: 'Public link not found' });
      }

      // Check expiration
      if (permission.link_expires_at && new Date(permission.link_expires_at) < new Date()) {
        return res.status(410).json({ error: 'Link has expired' });
      }

      // Check max views
      if (permission.max_views && permission.view_count >= permission.max_views) {
        return res.status(410).json({ error: 'Maximum views reached' });
      }

      // If password protected, require verification
      if (permission.link_password) {
        return res.status(401).json({
          error: 'Password required',
          requires_password: true
        });
      }

      // Get resource details
      let resourceData = null;
      if (permission.resource_type === 'file') {
        const file = await MediaFile.findById(permission.resource_id);
        if (!file || file.is_deleted) {
          return res.status(404).json({ error: 'File not found or deleted' });
        }
        resourceData = {
          id: file.id,
          filename: file.original_filename,
          file_type: file.file_type,
          file_size: file.file_size,
          thumbnail_url: file.thumbnail_url,
          s3_url: file.s3_url,
          download_url: file.download_url,
          description: file.description
        };
      }

      res.json({
        success: true,
        data: {
          resource_type: permission.resource_type,
          resource: resourceData,
          disable_download: permission.disable_download,
          expires_at: permission.link_expires_at
        }
      });
    } catch (error) {
      logger.error('Get public resource failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Download public resource
   * GET /api/permissions/public/:token/download
   */
  async downloadPublicResource(req, res, next) {
    try {
      const { token } = req.params;
      const { password } = req.query;

      const permission = await FilePermission.findById(token);

      if (!permission || !permission.is_public_link) {
        return res.status(404).json({ error: 'Public link not found' });
      }

      // Check if download is disabled
      if (permission.disable_download) {
        return res.status(403).json({ error: 'Downloads are disabled for this link' });
      }

      // Check expiration
      if (permission.link_expires_at && new Date(permission.link_expires_at) < new Date()) {
        return res.status(410).json({ error: 'Link has expired' });
      }

      // Check password
      if (permission.link_password) {
        if (!password) {
          return res.status(401).json({ error: 'Password required' });
        }
        const isValid = await bcrypt.compare(password, permission.link_password);
        if (!isValid) {
          return res.status(401).json({ error: 'Invalid password' });
        }
      }

      // Get file
      if (permission.resource_type !== 'file') {
        return res.status(400).json({ error: 'Only files can be downloaded' });
      }

      const file = await MediaFile.findById(permission.resource_id);
      if (!file || file.is_deleted) {
        return res.status(404).json({ error: 'File not found or deleted' });
      }

      // Log download
      const logSql = `
        INSERT INTO public_link_access_log
          (permission_id, ip_address, user_agent, action)
        VALUES ($1, $2, $3, $4)
      `;
      await FilePermission.raw(logSql, [
        token,
        req.ip,
        req.headers['user-agent'],
        'download'
      ]);

      logger.info('Public link download', { token, fileId: file.id });

      res.json({
        success: true,
        data: {
          download_url: file.download_url,
          filename: file.original_filename
        }
      });
    } catch (error) {
      logger.error('Download public resource failed', { error: error.message });
      next(error);
    }
  }
}

module.exports = new PermissionController();
