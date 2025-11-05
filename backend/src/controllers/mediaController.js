const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');

class MediaController {
  /**
   * Upload media file
   * POST /api/media/upload
   * Body: { editor_id, tags, description }
   * File: multipart/form-data
   */
  async upload(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const { editor_id, tags, description } = req.body;
      const userId = req.user.id;

      // Parse tags if it's a string (from multipart form)
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags || '[]') : tags;

      const mediaFile = await mediaService.uploadMedia(
        req.file,
        userId,
        editor_id,
        {
          tags: parsedTags,
          description
        }
      );

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: mediaFile
      });
    } catch (error) {
      logger.error('Upload controller error', { error: error.message });
      if (error.message === 'Monthly upload limit reached') {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get media files with filters
   * GET /api/media
   * Query params: editor_id, media_type, tags, search, limit, offset
   */
  async getFiles(req, res, next) {
    try {
      const filters = {
        editor_id: req.query.editor_id,
        media_type: req.query.media_type,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        search: req.query.search,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      // All users can see all files (removed role restriction)
      // Buyers need to see all creatives to use them in campaigns

      const result = await mediaService.getMediaFiles(filters, req.user.id);

      // Disable caching for media list
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get files controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get single media file
   * GET /api/media/:id
   */
  async getFile(req, res, next) {
    try {
      const mediaFile = await mediaService.getMediaFile(req.params.id);

      // Check permission (owner or admin)
      if (mediaFile.uploaded_by !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      res.json({
        success: true,
        data: mediaFile
      });
    } catch (error) {
      if (error.message === 'Media file not found' || error.message === 'Media file has been deleted') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Update media file metadata
   * PATCH /api/media/:id
   * Body: { editor_id, tags, description }
   */
  async updateFile(req, res, next) {
    try {
      const updates = {
        editor_id: req.body.editor_id,
        tags: req.body.tags,
        description: req.body.description
      };

      const updatedFile = await mediaService.updateMediaFile(
        req.params.id,
        req.user.id,
        updates
      );

      res.json({
        success: true,
        message: 'Media file updated successfully',
        data: updatedFile
      });
    } catch (error) {
      if (error.message === 'Media file not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Permission denied') {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete media file
   * DELETE /api/media/:id
   */
  async deleteFile(req, res, next) {
    try {
      await mediaService.deleteMediaFile(req.params.id, req.user.id);

      res.json({
        success: true,
        message: 'Media file deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Media file not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      if (error.message === 'Permission denied') {
        return res.status(403).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get storage statistics
   * GET /api/media/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await mediaService.getStorageStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get stats controller error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new MediaController();
