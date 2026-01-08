const MetadataTag = require('../models/MetadataTag');
const logger = require('../utils/logger');

class MetadataTagController {
  /**
   * Get all tags with usage counts
   * GET /api/metadata-tags
   */
  async getAllTags(req, res, next) {
    try {
      const { category, search } = req.query;

      const tags = await MetadataTag.getAllWithUsage({ category, search });

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      logger.error('Get metadata tags failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Get tag by ID
   * GET /api/metadata-tags/:id
   */
  async getTag(req, res, next) {
    try {
      const { id } = req.params;

      const tag = await MetadataTag.findById(id);

      if (!tag || !tag.is_active) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      }

      res.json({
        success: true,
        data: tag
      });
    } catch (error) {
      logger.error('Get metadata tag failed', { error: error.message, tagId: req.params.id });
      next(error);
    }
  }

  /**
   * Create new tag
   * POST /api/metadata-tags
   */
  async createTag(req, res, next) {
    try {
      const { name, category, description } = req.body;
      const userId = req.user.id;

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Tag name is required'
        });
      }

      // Check for duplicate name
      const existingTags = await MetadataTag.getAllWithUsage({ search: name.trim() });
      const duplicate = existingTags.find(
        t => t.name.toLowerCase() === name.trim().toLowerCase()
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: 'A tag with this name already exists'
        });
      }

      const tag = await MetadataTag.createTag({
        name: name.trim(),
        category: category?.trim() || 'general',
        description: description?.trim(),
        created_by: userId
      });

      logger.info('Metadata tag created', { tagId: tag.id, name: tag.name, userId });

      res.status(201).json({
        success: true,
        message: 'Tag created successfully',
        data: tag
      });
    } catch (error) {
      logger.error('Create metadata tag failed', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * Update tag
   * PATCH /api/metadata-tags/:id
   */
  async updateTag(req, res, next) {
    try {
      const { id } = req.params;
      const { name, category, description } = req.body;

      const updates = {};
      if (name !== undefined) updates.name = name.trim();
      if (category !== undefined) updates.category = category?.trim();
      if (description !== undefined) updates.description = description?.trim();

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      // Check for duplicate name if name is being updated
      if (updates.name) {
        const existingTags = await MetadataTag.getAllWithUsage({ search: updates.name });
        const duplicate = existingTags.find(
          t => t.name.toLowerCase() === updates.name.toLowerCase() && t.id !== id
        );

        if (duplicate) {
          return res.status(400).json({
            success: false,
            error: 'A tag with this name already exists'
          });
        }
      }

      const tag = await MetadataTag.updateTag(id, updates);

      if (!tag) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      }

      logger.info('Metadata tag updated', { tagId: id, userId: req.user.id });

      res.json({
        success: true,
        message: 'Tag updated successfully',
        data: tag
      });
    } catch (error) {
      logger.error('Update metadata tag failed', { error: error.message, tagId: req.params.id });
      next(error);
    }
  }

  /**
   * Delete tag
   * DELETE /api/metadata-tags/:id
   */
  async deleteTag(req, res, next) {
    try {
      const { id } = req.params;

      // Check if tag exists
      const tag = await MetadataTag.findById(id);
      if (!tag || !tag.is_active) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      }

      await MetadataTag.deleteTag(id);

      logger.info('Metadata tag deleted', { tagId: id, userId: req.user.id });

      res.json({
        success: true,
        message: 'Tag deleted successfully'
      });
    } catch (error) {
      logger.error('Delete metadata tag failed', { error: error.message, tagId: req.params.id });
      next(error);
    }
  }

  /**
   * Get all unique categories
   * GET /api/metadata-tags/categories
   */
  async getCategories(req, res, next) {
    try {
      const categories = await MetadataTag.getCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error('Get tag categories failed', { error: error.message });
      next(error);
    }
  }

  /**
   * Add tag to media file
   * POST /api/media/:mediaId/tags
   */
  async addTagToFile(req, res, next) {
    try {
      const { mediaId } = req.params;
      const { tag_id } = req.body;
      const userId = req.user.id;

      if (!tag_id) {
        return res.status(400).json({
          success: false,
          error: 'tag_id is required'
        });
      }

      // Verify tag exists
      const tag = await MetadataTag.findById(tag_id);
      if (!tag || !tag.is_active) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found'
        });
      }

      await MetadataTag.addTagToFile(mediaId, tag_id, userId);

      logger.info('Tag added to file', { mediaId, tagId: tag_id, userId });

      res.status(201).json({
        success: true,
        message: 'Tag added to file successfully'
      });
    } catch (error) {
      logger.error('Add tag to file failed', { error: error.message, mediaId: req.params.mediaId });
      next(error);
    }
  }

  /**
   * Remove tag from media file
   * DELETE /api/media/:mediaId/tags/:tagId
   */
  async removeTagFromFile(req, res, next) {
    try {
      const { mediaId, tagId } = req.params;

      await MetadataTag.removeTagFromFile(mediaId, tagId);

      logger.info('Tag removed from file', { mediaId, tagId, userId: req.user.id });

      res.json({
        success: true,
        message: 'Tag removed from file successfully'
      });
    } catch (error) {
      logger.error('Remove tag from file failed', {
        error: error.message,
        mediaId: req.params.mediaId,
        tagId: req.params.tagId
      });
      next(error);
    }
  }

  /**
   * Get tags for a specific media file
   * GET /api/media/:mediaId/tags
   */
  async getFileTags(req, res, next) {
    try {
      const { mediaId } = req.params;

      const tags = await MetadataTag.getFileTagsFromFile(mediaId);

      res.json({
        success: true,
        data: tags
      });
    } catch (error) {
      logger.error('Get file tags failed', { error: error.message, mediaId: req.params.mediaId });
      next(error);
    }
  }

  /**
   * Get files with a specific tag
   * GET /api/metadata-tags/:id/files
   */
  async getFilesWithTag(req, res, next) {
    try {
      const { id } = req.params;

      const files = await MetadataTag.getFilesWithTag(id);

      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      logger.error('Get files with tag failed', { error: error.message, tagId: req.params.id });
      next(error);
    }
  }

  /**
   * Bulk add tags to file
   * POST /api/media/:mediaId/tags/bulk
   */
  async bulkAddTagsToFile(req, res, next) {
    try {
      const { mediaId } = req.params;
      const { tag_ids } = req.body;
      const userId = req.user.id;

      if (!tag_ids || !Array.isArray(tag_ids) || tag_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'tag_ids array is required'
        });
      }

      const count = await MetadataTag.bulkAddTagsToFile(mediaId, tag_ids, userId);

      logger.info('Tags bulk added to file', { mediaId, count, userId });

      res.json({
        success: true,
        message: `${count} tags added to file successfully`,
        data: { count }
      });
    } catch (error) {
      logger.error('Bulk add tags to file failed', {
        error: error.message,
        mediaId: req.params.mediaId
      });
      next(error);
    }
  }
}

module.exports = new MetadataTagController();
