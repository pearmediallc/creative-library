const Canvas = require('../models/Canvas');
const Notification = require('../models/Notification');
const { query } = require('../config/database');
const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');

// Product Brief Template
const PRODUCT_BRIEF_TEMPLATE = {
  blocks: [
    {
      type: 'heading',
      level: 2,
      content: '👥 The team',
      icon: '👥'
    },
    {
      type: 'text',
      content: 'Leads: use @ to add someone'
    },
    {
      type: 'text',
      content: 'Team members: use @ to add someone'
    },
    {
      type: 'heading',
      level: 2,
      content: '📦 Product description',
      icon: '📦'
    },
    {
      type: 'text',
      content: "Now's your chance to go deep – tell your team what this product's about."
    },
    {
      type: 'heading',
      level: 2,
      content: '⚠️ Problem statement',
      icon: '⚠️'
    },
    {
      type: 'text',
      content: 'Explain the core problem that this product would address.'
    },
    {
      type: 'heading',
      level: 2,
      content: '🔑 Key features',
      icon: '🔑'
    },
    {
      type: 'list',
      items: ['Feature 1', 'Feature 2', 'Feature 3']
    },
    {
      type: 'heading',
      level: 2,
      content: 'Milestones'
    },
    {
      type: 'checklist',
      items: [
        { text: 'Milestone 1 - Date', checked: false },
        { text: 'Milestone 2 - Date', checked: false },
        { text: 'Milestone 3 - Date', checked: false }
      ]
    },
    {
      type: 'heading',
      level: 2,
      content: '💡 Success criteria',
      icon: '💡'
    },
    {
      type: 'text',
      content: 'How will you measure product impact?'
    },
    {
      type: 'heading',
      level: 2,
      content: '⚠️ Challenges and risks',
      icon: '⚠️'
    },
    {
      type: 'text',
      content: 'Identify potential risks and how you plan to mitigate them.'
    },
    {
      type: 'heading',
      level: 2,
      content: '🔗 Resources and appendix',
      icon: '🔗'
    },
    {
      type: 'attachments',
      placeholder: 'Add reference files here'
    }
  ]
};

class CanvasController {
  /**
   * Extract mentioned user IDs from canvas content
   * Mentions format: @[User Name](user_id)
   */
  static extractMentions(content) {
    const mentions = new Set();
    const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;

    // Extract from all text content in blocks
    if (content && content.blocks) {
      content.blocks.forEach(block => {
        if (block.content) {
          let match;
          while ((match = mentionRegex.exec(block.content)) !== null) {
            mentions.add(match[2]); // user_id is in capture group 2
          }
        }

        // Check items array (for lists and checklists)
        if (block.items && Array.isArray(block.items)) {
          block.items.forEach(item => {
            const text = typeof item === 'string' ? item : item.text;
            if (text) {
              let match;
              while ((match = mentionRegex.exec(text)) !== null) {
                mentions.add(match[2]);
              }
            }
          });
        }
      });
    }

    return Array.from(mentions);
  }

  /**
   * Get or create canvas for a file request
   * GET /api/file-requests/:id/canvas
   */
  static async getCanvas(req, res) {
    try {
      const requestId = req.params.id; // Route uses /:id
      const userId = req.user.id;

      // Verify request exists and user has access
      const fileRequestResult = await query(
        'SELECT id, created_by AS creator_id, editor_id, folder_id FROM file_requests WHERE id = $1',
        [requestId]
      );

      if (fileRequestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = fileRequestResult.rows[0];

      // Check if user is creator or assigned editor
      const hasAccess = fileRequest.creator_id === userId ||
                       fileRequest.editor_id === userId;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this canvas'
        });
      }

      // Get existing canvas or return default template
      let canvas = await Canvas.getByRequestId(requestId);

      if (!canvas) {
        // Return default template (not saved yet)
        return res.json({
          success: true,
          canvas: {
            file_request_id: requestId,
            content: PRODUCT_BRIEF_TEMPLATE,
            attachments: [],
            created_at: null,
            updated_at: null
          },
          isTemplate: true
        });
      }

      res.json({
        success: true,
        canvas,
        isTemplate: false
      });

    } catch (error) {
      logger.error('Failed to get canvas', { error: error.message, requestId: req.params.requestId });
      res.status(500).json({
        success: false,
        error: 'Failed to get canvas'
      });
    }
  }

  /**
   * Create or update canvas
   * POST /api/file-requests/:id/canvas
   */
  static async upsertCanvas(req, res) {
    try {
      const requestId = req.params.id;
      const { content } = req.body;
      const userId = req.user.id;

      // Verify request exists and user is creator
      const fileRequestResult = await query(
        'SELECT id, created_by AS creator_id FROM file_requests WHERE id = $1',
        [requestId]
      );

      if (fileRequestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = fileRequestResult.rows[0];

      if (fileRequest.creator_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only the request creator can edit the canvas'
        });
      }

      // Validate content
      if (!content || !content.blocks) {
        return res.status(400).json({
          success: false,
          error: 'Invalid canvas content'
        });
      }

      // Get existing attachments if any
      const existing = await Canvas.getByRequestId(requestId);
      const attachments = existing?.attachments || [];

      // Upsert canvas
      const canvas = await Canvas.upsertCanvas(requestId, content, attachments);

      // Extract mentions and create notifications
      const mentionedUserIds = CanvasController.extractMentions(content);

      if (mentionedUserIds.length > 0) {
        // Get current user's name
        const userResult = await query('SELECT name FROM users WHERE id = $1', [userId]);
        const userName = userResult.rows?.[0]?.name || 'Someone';

        // Create notifications for mentioned users
        try {
          await Notification.createMentionNotifications(mentionedUserIds, userId, {
            canvasId: canvas.id,
            fileRequestId: requestId,
            mentionedByName: userName
          });

          logger.info('Mention notifications created', {
            canvasId: canvas.id,
            requestId,
            mentionedUsers: mentionedUserIds.length
          });
        } catch (notifError) {
          // Don't fail the request if notifications fail
          logger.error('Failed to create mention notifications', {
            error: notifError.message,
            canvasId: canvas.id
          });
        }
      }

      logger.info('Canvas saved', {
        canvasId: canvas.id,
        requestId,
        userId,
        blockCount: content.blocks.length,
        mentions: mentionedUserIds.length
      });

      res.json({
        success: true,
        canvas
      });

    } catch (error) {
      logger.error('Failed to save canvas', { error: error.message, requestId: req.params.requestId });
      res.status(500).json({
        success: false,
        error: 'Failed to save canvas'
      });
    }
  }

  /**
   * Upload attachment to canvas
   * POST /api/file-requests/:id/canvas/attach
   */
  static async uploadAttachment(req, res) {
    try {
      const requestId = req.params.id;
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      // Verify request exists and user is creator
      const fileRequestResult = await query(
        'SELECT id, created_by AS creator_id, folder_id FROM file_requests WHERE id = $1',
        [requestId]
      );

      if (fileRequestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = fileRequestResult.rows[0];

      if (fileRequest.creator_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only the request creator can add attachments'
        });
      }

      // Check canvas exists
      const exists = await Canvas.exists(requestId);
      if (!exists) {
        // Create canvas with default template first
        await Canvas.upsertCanvas(requestId, PRODUCT_BRIEF_TEMPLATE, []);
      }

      // Upload file using media service
      // Use null for editorId (canvas attachments don't have an editor)
      const mediaFile = await mediaService.uploadMedia(
        req.file,
        userId,
        null, // No editor for canvas attachments
        {
          tags: ['canvas-attachment', `request-${requestId}`],
          description: `Canvas attachment for request ${requestId}`,
          folder_id: fileRequest.folder_id
        }
      );

      // Add attachment reference to canvas
      const attachment = {
        file_id: mediaFile.id,
        file_name: mediaFile.original_filename,
        file_url: mediaFile.s3_url,
        file_type: mediaFile.file_type,
        file_size: mediaFile.file_size,
        thumbnail_url: mediaFile.thumbnail_url,
        uploaded_at: new Date().toISOString()
      };

      const canvas = await Canvas.addAttachment(requestId, attachment);

      logger.info('Canvas attachment uploaded', {
        canvasId: canvas.id,
        requestId,
        fileId: mediaFile.id,
        fileName: mediaFile.original_filename
      });

      res.json({
        success: true,
        canvas,
        attachment
      });

    } catch (error) {
      logger.error('Failed to upload canvas attachment', {
        error: error.message,
        requestId: req.params.requestId
      });
      res.status(500).json({
        success: false,
        error: 'Failed to upload attachment'
      });
    }
  }

  /**
   * Remove attachment from canvas
   * DELETE /api/file-requests/:id/canvas/attachments/:fileId
   */
  static async removeAttachment(req, res) {
    try {
      const { id: requestId, fileId } = req.params;
      const userId = req.user.id;

      // Verify request exists and user is creator
      const fileRequestResult = await query(
        'SELECT id, created_by AS creator_id FROM file_requests WHERE id = $1',
        [requestId]
      );

      if (fileRequestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = fileRequestResult.rows[0];

      if (fileRequest.creator_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only the request creator can remove attachments'
        });
      }

      const canvas = await Canvas.removeAttachment(requestId, fileId);

      logger.info('Canvas attachment removed', {
        canvasId: canvas.id,
        requestId,
        fileId
      });

      res.json({
        success: true,
        canvas
      });

    } catch (error) {
      logger.error('Failed to remove canvas attachment', {
        error: error.message,
        requestId: req.params.requestId,
        fileId: req.params.fileId
      });
      res.status(500).json({
        success: false,
        error: 'Failed to remove attachment'
      });
    }
  }

  /**
   * Delete canvas
   * DELETE /api/file-requests/:id/canvas
   */
  static async deleteCanvas(req, res) {
    try {
      const requestId = req.params.id;
      const userId = req.user.id;

      // Verify request exists and user is creator
      const fileRequestResult = await query(
        'SELECT id, created_by AS creator_id FROM file_requests WHERE id = $1',
        [requestId]
      );

      if (fileRequestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = fileRequestResult.rows[0];

      if (fileRequest.creator_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Only the request creator can delete the canvas'
        });
      }

      await Canvas.deleteByRequestId(requestId);

      logger.info('Canvas deleted', { requestId, userId });

      res.json({
        success: true,
        message: 'Canvas deleted successfully'
      });

    } catch (error) {
      logger.error('Failed to delete canvas', { error: error.message, requestId: req.params.requestId });
      res.status(500).json({
        success: false,
        error: 'Failed to delete canvas'
      });
    }
  }
}

module.exports = CanvasController;
