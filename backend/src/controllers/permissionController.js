const FilePermission = require('../models/FilePermission');
const MediaFile = require('../models/MediaFile');
const Folder = require('../models/Folder');
const logger = require('../utils/logger');

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
        expires_at
      } = req.body;
      const userId = req.user.id;

      // Validate required fields
      if (!resource_type || !resource_id || !grantee_type || !grantee_id || !permission_type) {
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
        permission_type,
        granted_by: userId,
        expires_at: expires_at || null
      });

      logger.info('Permission granted', { permissionId: permission.id, grantedBy: userId });

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
   * Helper: Verify user owns a resource
   * @private
   */
  async verifyUserOwnership(resourceType, resourceId, userId) {
    try {
      if (resourceType === 'file') {
        const file = await MediaFile.findById(resourceId);
        return file && file.uploaded_by === userId;
      } else if (resourceType === 'folder') {
        const folder = await Folder.findById(resourceId);
        return folder && folder.created_by === userId;
      }
      return false;
    } catch (error) {
      logger.error('Verify ownership failed', { error: error.message });
      return false;
    }
  }
}

module.exports = new PermissionController();
