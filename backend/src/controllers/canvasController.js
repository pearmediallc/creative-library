const Canvas = require('../models/Canvas');
const Notification = require('../models/Notification');
const { query } = require('../config/database');
const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');

class CanvasController {
  /**
   * Extract mentioned user IDs from canvas content
   * Mentions format: @Username (simple, clean format)
   */
  static async extractMentions(content) {
    const mentions = new Set();
    const mentionRegex = /@([\w\s]+)/g; // Matches @Username or @First Last

    // Collect all mentioned names
    const mentionedNames = new Set();

    // Canvas Brief format: check headline, script, and sample instructions
    if (content && (content.headline || content.script || content.samples)) {
      // Check headline
      if (content.headline) {
        let match;
        while ((match = mentionRegex.exec(content.headline)) !== null) {
          const name = match[1].trim();
          if (name) mentionedNames.add(name);
        }
      }

      // Check script
      if (content.script) {
        let match;
        while ((match = mentionRegex.exec(content.script)) !== null) {
          const name = match[1].trim();
          if (name) mentionedNames.add(name);
        }
      }

      // Check sample instructions
      if (content.samples && Array.isArray(content.samples)) {
        content.samples.forEach(sample => {
          if (sample.instruction) {
            let match;
            while ((match = mentionRegex.exec(sample.instruction)) !== null) {
              const name = match[1].trim();
              if (name) mentionedNames.add(name);
            }
          }
        });
      }
    }

    // Look up user IDs from names
    if (mentionedNames.size > 0) {
      const names = Array.from(mentionedNames);
      const placeholders = names.map((_, i) => `$${i + 1}`).join(',');
      const result = await query(
        `SELECT id FROM users WHERE name IN (${placeholders})`,
        names
      );
      result.rows.forEach(row => mentions.add(row.id));
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
      const userRole = req.user.role;

      // Verify request exists and user has access
      const fileRequestResult = await query(
        'SELECT id, created_by AS creator_id, editor_id, folder_id, assigned_buyer_id FROM file_requests WHERE id = $1',
        [requestId]
      );

      if (fileRequestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = fileRequestResult.rows[0];

      // Check access for different user types
      let hasAccess = false;

      // 1. Creator always has access
      if (fileRequest.creator_id === userId) {
        hasAccess = true;
      }
      // 2. Admin always has access
      else if (userRole === 'admin') {
        hasAccess = true;
      }
      // 3. Assigned buyer has access
      else if (fileRequest.assigned_buyer_id === userId) {
        hasAccess = true;
      }
      // 4. Assigned editor has access (need to check via editor_id lookup)
      else if (userRole === 'creative') {
        // Get editor_id from user_id
        const editorResult = await query(
          'SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE',
          [userId]
        );

        if (editorResult.rows.length > 0) {
          const editorId = editorResult.rows[0].id;

          // Check if this editor is assigned to the request
          const editorCheckResult = await query(
            'SELECT 1 FROM file_request_editors WHERE request_id = $1 AND editor_id = $2',
            [requestId, editorId]
          );

          if (editorCheckResult.rows.length > 0 || fileRequest.editor_id === editorId) {
            hasAccess = true;
          }
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'You do not have access to this canvas'
        });
      }

      // Get existing canvas or return empty structure
      let canvas = await Canvas.getByRequestId(requestId);

      if (!canvas) {
        // Return empty Canvas Brief structure (not saved yet)
        return res.json({
          success: true,
          canvas: {
            file_request_id: requestId,
            content: {
              headline: '',
              script: '',
              samples: []
            },
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
      const userRole = req.user.role;

      // Check permissions - creator, admin, or buyer can edit canvas
      const isCreator = fileRequest.creator_id === userId;
      const isAdmin = userRole === 'admin';
      const isBuyer = userRole === 'buyer';

      if (!isCreator && !isAdmin && !isBuyer) {
        return res.status(403).json({
          success: false,
          error: 'Only the request creator, buyers, or admins can edit the canvas'
        });
      }

      // Validate content - ONLY accept Canvas Brief format (headline/script/samples)
      if (!content || typeof content !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid canvas content - content must be an object'
        });
      }

      // Canvas Brief must have at least one of: headline, script, or samples
      const hasContent = content.headline || content.script || (content.samples && content.samples.length > 0);
      if (!hasContent) {
        return res.status(400).json({
          success: false,
          error: 'Canvas Brief must have at least a headline, script, or reference samples'
        });
      }

      // Get existing attachments if any
      const existing = await Canvas.getByRequestId(requestId);
      const attachments = existing?.attachments || [];

      // Upsert canvas
      const canvas = await Canvas.upsertCanvas(requestId, content, attachments);

      // Extract mentions and create notifications
      const mentionedUserIds = await CanvasController.extractMentions(content);

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

      logger.info('Canvas Brief saved', {
        canvasId: canvas.id,
        requestId,
        userId,
        hasHeadline: !!content.headline,
        hasScript: !!content.script,
        samplesCount: content.samples ? content.samples.length : 0,
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
        // Create empty Canvas Brief first
        await Canvas.upsertCanvas(requestId, {
          headline: '',
          script: '',
          samples: []
        }, []);
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
          folder_id: fileRequest.folder_id,
          request_id: requestId  // ✨ Store in file request folder structure
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
