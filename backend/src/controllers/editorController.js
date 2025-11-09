const Editor = require('../models/Editor');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');

class EditorController {
  /**
   * Get all editors
   * GET /api/editors
   */
  async getEditors(req, res, next) {
    try {
      const includeStats = req.query.includeStats === 'true';
      const isAdmin = req.user?.role === 'admin';

      let editors;
      // Only admins can get stats, others get basic list
      if (includeStats && isAdmin) {
        editors = await Editor.getAllWithStats();
      } else {
        editors = await Editor.getActiveEditors();
      }

      res.json({
        success: true,
        data: editors
      });
    } catch (error) {
      logger.error('Get editors error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get single editor with stats
   * GET /api/editors/:id
   */
  async getEditor(req, res, next) {
    try {
      const editor = await Editor.findById(req.params.id);

      if (!editor) {
        return res.status(404).json({
          success: false,
          error: 'Editor not found'
        });
      }

      const stats = await Editor.getPerformanceStats(editor.id);

      res.json({
        success: true,
        data: {
          ...editor,
          stats
        }
      });
    } catch (error) {
      logger.error('Get editor error', { error: error.message, editorId: req.params.id });
      next(error);
    }
  }

  /**
   * Create new editor (Admin only)
   * POST /api/editors
   */
  async createEditor(req, res, next) {
    try {
      const { name, display_name } = req.body;

      // Check if editor already exists
      const existing = await Editor.findByName(name);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Editor with this name already exists'
        });
      }

      const editor = await Editor.createEditor({ name, display_name });

      logger.info('Editor created', { editorId: editor.id, name });

      // Log activity
      await logActivity({
        req,
        actionType: 'editor_create',
        resourceType: 'editor',
        resourceId: editor.id,
        resourceName: editor.display_name,
        details: { name: editor.name },
        status: 'success'
      });

      res.status(201).json({
        success: true,
        message: 'Editor created successfully',
        data: editor
      });
    } catch (error) {
      logger.error('Create editor error', { error: error.message });
      next(error);
    }
  }

  /**
   * Update editor (Admin only)
   * PATCH /api/editors/:id
   */
  async updateEditor(req, res, next) {
    try {
      const editor = await Editor.findById(req.params.id);

      if (!editor) {
        return res.status(404).json({
          success: false,
          error: 'Editor not found'
        });
      }

      const updates = {};
      if (req.body.name) updates.name = req.body.name.toUpperCase();
      if (req.body.display_name !== undefined) updates.display_name = req.body.display_name;
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;

      const updatedEditor = await Editor.update(req.params.id, updates);

      logger.info('Editor updated', { editorId: req.params.id, updates });

      // Log activity
      await logActivity({
        req,
        actionType: 'editor_update',
        resourceType: 'editor',
        resourceId: req.params.id,
        resourceName: updatedEditor.display_name,
        details: { updates },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Editor updated successfully',
        data: updatedEditor
      });
    } catch (error) {
      logger.error('Update editor error', { error: error.message, editorId: req.params.id });
      next(error);
    }
  }

  /**
   * Delete editor (Admin only) - Soft delete by setting is_active to false
   * DELETE /api/editors/:id
   */
  async deleteEditor(req, res, next) {
    try {
      const editor = await Editor.findById(req.params.id);

      if (!editor) {
        return res.status(404).json({
          success: false,
          error: 'Editor not found'
        });
      }

      // Soft delete by setting is_active to false
      const deletedEditor = await Editor.update(req.params.id, { is_active: false });

      logger.info('Editor deleted (soft delete)', { editorId: req.params.id });

      // Log activity
      await logActivity({
        req,
        actionType: 'editor_delete',
        resourceType: 'editor',
        resourceId: req.params.id,
        resourceName: deletedEditor.display_name,
        details: { soft_delete: true },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Editor deleted successfully',
        data: deletedEditor
      });
    } catch (error) {
      logger.error('Delete editor error', { error: error.message, editorId: req.params.id });
      next(error);
    }
  }
}

module.exports = new EditorController();
