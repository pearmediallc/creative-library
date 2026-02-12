const MediaFile = require('../models/MediaFile');
const logger = require('../utils/logger');

class StarredController {
  /**
   * Toggle starred status for a file
   * PUT /api/starred/:fileId
   */
  async toggleStarred(req, res, next) {
    try {
      const { fileId } = req.params;
      let { is_starred } = req.body || {};
      const userId = req.user.id;

      // Verify file exists and user has access
      const file = await MediaFile.findById(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // For now, allow any authenticated user to star files they can see
      // In production, you might want to check permissions

      // If caller didn't provide is_starred, treat this endpoint as a true toggle.
      if (typeof is_starred === 'undefined' || is_starred === null) {
        is_starred = !Boolean(file.is_starred);
      }

      const updatedFile = await MediaFile.toggleStarred(fileId, Boolean(is_starred));

      logger.info('File starred status toggled', {
        fileId,
        userId,
        isStarred: is_starred
      });

      res.json({
        success: true,
        data: updatedFile
      });
    } catch (error) {
      logger.error('Toggle starred failed', { error: error.message, fileId: req.params.fileId });
      next(error);
    }
  }

  /**
   * Get all starred files for current user
   * GET /api/starred
   */
  async getStarredFiles(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.role === 'admin';

      // Admins can see all starred files, others only their own
      const files = await MediaFile.getStarredFiles(isAdmin ? null : userId);

      res.json({
        success: true,
        data: files,
        count: files.length
      });
    } catch (error) {
      logger.error('Get starred files failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }
}

module.exports = new StarredController();
