const MediaFile = require('../models/MediaFile');
const s3Service = require('../services/s3Service');
const logger = require('../utils/logger');

class VersionController {
  /**
   * Get version history for a file
   * GET /api/media/:id/versions
   */
  async getVersionHistory(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Get original file
      const originalFile = await MediaFile.findById(id);
      if (!originalFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check access permissions
      if (originalFile.uploaded_by !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get all versions (files with this parent_file_id or files that have this as parent)
      const sql = `
        SELECT * FROM media_files
        WHERE (parent_file_id = $1 OR id = $1)
          AND is_deleted = FALSE
        ORDER BY version_number DESC, created_at DESC
      `;
      const versions = await MediaFile.raw(sql, [id]);

      res.json({
        success: true,
        data: Array.isArray(versions) ? versions : versions.rows || []
      });
    } catch (error) {
      logger.error('Get version history failed', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * Create new version of a file
   * POST /api/media/:id/versions
   */
  async createVersion(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Get original file
      const originalFile = await MediaFile.findById(id);
      if (!originalFile) {
        return res.status(404).json({ error: 'Original file not found' });
      }

      // Check ownership
      if (originalFile.uploaded_by !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get latest version number
      const sql = `
        SELECT COALESCE(MAX(version_number), 0) as max_version
        FROM media_files
        WHERE parent_file_id = $1 OR id = $1
      `;
      const result = await MediaFile.raw(sql, [id]);
      const maxVersion = Array.isArray(result) ? result[0].max_version : result.rows[0].max_version;
      const newVersionNumber = parseInt(maxVersion) + 1;

      // Upload new version to S3 (use mediaService for consistency)
      const mediaService = require('../services/mediaService');
      const newVersion = await mediaService.uploadMedia(
        file,
        userId,
        originalFile.editor_id,
        {
          tags: originalFile.tags,
          description: req.body.description || `Version ${newVersionNumber} of ${originalFile.original_filename}`,
          folder_id: originalFile.folder_id,
          assigned_buyer_id: originalFile.assigned_buyer_id,
          parent_file_id: id,
          version_number: newVersionNumber
        }
      );

      logger.info('File version created', {
        originalFileId: id,
        newVersionId: newVersion.id,
        versionNumber: newVersionNumber,
        userId
      });

      res.status(201).json({
        success: true,
        data: newVersion
      });
    } catch (error) {
      logger.error('Create version failed', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * Restore a specific version (make it the current version)
   * POST /api/media/:id/versions/:versionId/restore
   */
  async restoreVersion(req, res, next) {
    try {
      const { id, versionId } = req.params;
      const userId = req.user.id;

      // Get original file
      const originalFile = await MediaFile.findById(id);
      if (!originalFile) {
        return res.status(404).json({ error: 'Original file not found' });
      }

      // Check ownership
      if (originalFile.uploaded_by !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get version to restore
      const versionFile = await MediaFile.findById(versionId);
      if (!versionFile || versionFile.parent_file_id !== id) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // Create new version from the old version (essentially duplicating it as latest)
      const sql = `
        SELECT COALESCE(MAX(version_number), 0) as max_version
        FROM media_files
        WHERE parent_file_id = $1 OR id = $1
      `;
      const result = await MediaFile.raw(sql, [id]);
      const maxVersion = Array.isArray(result) ? result[0].max_version : result.rows[0].max_version;
      const newVersionNumber = parseInt(maxVersion) + 1;

      // Copy the S3 file
      const newS3Key = versionFile.s3_key.replace(/(\.[^.]+)$/, `_v${newVersionNumber}$1`);

      // Create new database entry as restored version
      const restoredVersion = await MediaFile.createMediaFile({
        uploaded_by: userId,
        editor_id: versionFile.editor_id,
        editor_name: versionFile.editor_name,
        filename: versionFile.filename,
        original_filename: versionFile.original_filename,
        file_type: versionFile.file_type,
        mime_type: versionFile.mime_type,
        file_size: versionFile.file_size,
        s3_key: versionFile.s3_key, // Reuse same S3 object
        s3_url: versionFile.s3_url,
        width: versionFile.width,
        height: versionFile.height,
        duration: versionFile.duration,
        thumbnail_url: versionFile.thumbnail_url,
        tags: versionFile.tags,
        description: `Restored from version ${versionFile.version_number}`,
        folder_id: originalFile.folder_id,
        assigned_buyer_id: originalFile.assigned_buyer_id,
        parent_file_id: id,
        version_number: newVersionNumber
      });

      logger.info('Version restored', {
        originalFileId: id,
        restoredFromVersionId: versionId,
        newVersionId: restoredVersion.id,
        versionNumber: newVersionNumber,
        userId
      });

      res.json({
        success: true,
        data: restoredVersion,
        message: `Version ${versionFile.version_number} restored as version ${newVersionNumber}`
      });
    } catch (error) {
      logger.error('Restore version failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Delete a specific version
   * DELETE /api/media/:id/versions/:versionId
   */
  async deleteVersion(req, res, next) {
    try {
      const { id, versionId } = req.params;
      const userId = req.user.id;

      // Prevent deleting the original file through version endpoint
      if (id === versionId) {
        return res.status(400).json({ error: 'Cannot delete original file through version endpoint' });
      }

      // Get original file
      const originalFile = await MediaFile.findById(id);
      if (!originalFile) {
        return res.status(404).json({ error: 'Original file not found' });
      }

      // Check ownership
      if (originalFile.uploaded_by !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get version to delete
      const versionFile = await MediaFile.findById(versionId);
      if (!versionFile || versionFile.parent_file_id !== id) {
        return res.status(404).json({ error: 'Version not found' });
      }

      // Soft delete the version
      await MediaFile.softDelete(versionId, userId);

      logger.info('Version deleted', { fileId: id, versionId, userId });

      res.json({
        success: true,
        message: 'Version deleted successfully'
      });
    } catch (error) {
      logger.error('Delete version failed', { error: error.message });
      next(error);
    }
  }
}

module.exports = new VersionController();
