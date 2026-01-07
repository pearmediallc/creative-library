const { query, transaction } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const mediaService = require('../services/mediaService');
const { logActivity } = require('../middleware/activityLogger');

class FileRequestController {
  /**
   * Generate unique token for file request
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create new file request
   * POST /api/file-requests
   */
  async create(req, res, next) {
    try {
      const userId = req.user.id;
      const {
        title,
        description,
        folder_id,
        deadline,
        allow_multiple_uploads = true,
        require_email = false,
        custom_message
      } = req.body;

      // Validation
      if (!title || title.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Title is required'
        });
      }

      // Validate deadline if provided
      if (deadline) {
        const deadlineDate = new Date(deadline);
        if (isNaN(deadlineDate.getTime()) || deadlineDate < new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Deadline must be a valid future date'
          });
        }
      }

      // Verify folder exists if provided
      if (folder_id) {
        const folderResult = await query(
          'SELECT id, created_by FROM folders WHERE id = $1 AND is_deleted = FALSE',
          [folder_id]
        );
        if (folderResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Folder not found'
          });
        }
      }

      // Generate unique token
      const requestToken = this.generateToken();

      // Create file request
      const result = await query(
        `INSERT INTO file_requests
        (title, description, created_by, folder_id, request_token, deadline,
         allow_multiple_uploads, require_email, custom_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          title.trim(),
          description || null,
          userId,
          folder_id || null,
          requestToken,
          deadline || null,
          allow_multiple_uploads,
          require_email,
          custom_message || null
        ]
      );

      const fileRequest = result.rows[0];

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_created',
        resourceType: 'file_request',
        resourceId: fileRequest.id,
        resourceName: fileRequest.title,
        details: {
          deadline: fileRequest.deadline,
          folder_id: fileRequest.folder_id,
          require_email: fileRequest.require_email
        },
        status: 'success'
      });

      logger.info('File request created', {
        fileRequestId: fileRequest.id,
        userId,
        title
      });

      res.status(201).json({
        success: true,
        message: 'File request created successfully',
        data: fileRequest
      });
    } catch (error) {
      logger.error('Create file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get all file requests for current user
   * GET /api/file-requests
   */
  async getAll(req, res, next) {
    try {
      const userId = req.user.id;
      const { status } = req.query; // active, closed, all

      let whereClause = 'WHERE created_by = $1';
      const params = [userId];

      if (status === 'active') {
        whereClause += ' AND is_active = TRUE';
      } else if (status === 'closed') {
        whereClause += ' AND is_active = FALSE';
      }

      const result = await query(
        `SELECT
          fr.*,
          f.name as folder_name,
          COUNT(DISTINCT fru.id) as upload_count
        FROM file_requests fr
        LEFT JOIN folders f ON fr.folder_id = f.id
        LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
        ${whereClause}
        GROUP BY fr.id, f.name
        ORDER BY fr.created_at DESC`,
        params
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get file requests error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get single file request details
   * GET /api/file-requests/:id
   */
  async getOne(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await query(
        `SELECT
          fr.*,
          f.name as folder_name,
          COUNT(DISTINCT fru.id) as upload_count,
          u.name as creator_name,
          u.email as creator_email
        FROM file_requests fr
        LEFT JOIN folders f ON fr.folder_id = f.id
        LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
        LEFT JOIN users u ON fr.created_by = u.id
        WHERE fr.id = $1 AND fr.created_by = $2
        GROUP BY fr.id, f.name, u.name, u.email`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Get uploaded files
      const uploadsResult = await query(
        `SELECT
          fru.*,
          mf.original_filename,
          mf.file_type,
          mf.file_size,
          mf.thumbnail_url,
          mf.cloudfront_url
        FROM file_request_uploads fru
        JOIN media_files mf ON fru.file_id = mf.id
        WHERE fru.file_request_id = $1
        ORDER BY fru.created_at DESC`,
        [id]
      );

      const fileRequest = result.rows[0];
      fileRequest.uploads = uploadsResult.rows;

      res.json({
        success: true,
        data: fileRequest
      });
    } catch (error) {
      logger.error('Get file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Update file request
   * PATCH /api/file-requests/:id
   */
  async update(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const {
        title,
        description,
        deadline,
        allow_multiple_uploads,
        require_email,
        custom_message
      } = req.body;

      // Verify ownership
      const checkResult = await query(
        'SELECT id, is_active FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      if (checkResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Build update query
      const updates = [];
      const params = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description || null);
      }
      if (deadline !== undefined) {
        if (deadline && new Date(deadline) < new Date()) {
          return res.status(400).json({
            success: false,
            error: 'Deadline must be a future date'
          });
        }
        updates.push(`deadline = $${paramCount++}`);
        params.push(deadline || null);
      }
      if (allow_multiple_uploads !== undefined) {
        updates.push(`allow_multiple_uploads = $${paramCount++}`);
        params.push(allow_multiple_uploads);
      }
      if (require_email !== undefined) {
        updates.push(`require_email = $${paramCount++}`);
        params.push(require_email);
      }
      if (custom_message !== undefined) {
        updates.push(`custom_message = $${paramCount++}`);
        params.push(custom_message || null);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update'
        });
      }

      updates.push(`updated_at = NOW()`);
      params.push(id, userId);

      const result = await query(
        `UPDATE file_requests
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND created_by = $${paramCount + 1}
        RETURNING *`,
        params
      );

      await logActivity({
        req,
        actionType: 'file_request_updated',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: result.rows[0].title,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'File request updated successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Close file request
   * POST /api/file-requests/:id/close
   */
  async close(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const result = await query(
        `UPDATE file_requests
        SET is_active = FALSE, closed_at = NOW(), closed_by = $2, updated_at = NOW()
        WHERE id = $1 AND created_by = $2 AND is_active = TRUE
        RETURNING *`,
        [id, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found or already closed'
        });
      }

      await logActivity({
        req,
        actionType: 'file_request_closed',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: result.rows[0].title,
        status: 'success'
      });

      logger.info('File request closed', { fileRequestId: id, userId });

      res.json({
        success: true,
        message: 'File request closed successfully',
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Close file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Delete file request
   * DELETE /api/file-requests/:id
   */
  async delete(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      // Get file request details first
      const frResult = await query(
        'SELECT title FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      if (frResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Delete file request (cascade will handle uploads)
      await query(
        'DELETE FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      await logActivity({
        req,
        actionType: 'file_request_deleted',
        resourceType: 'file_request',
        resourceId: id,
        resourceName: frResult.rows[0].title,
        status: 'success'
      });

      logger.info('File request deleted', { fileRequestId: id, userId });

      res.json({
        success: true,
        message: 'File request deleted successfully'
      });
    } catch (error) {
      logger.error('Delete file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get public file request details (no auth)
   * GET /api/public/file-request/:token
   */
  async getPublic(req, res, next) {
    try {
      const { token } = req.params;

      const result = await query(
        `SELECT
          fr.id,
          fr.title,
          fr.description,
          fr.deadline,
          fr.allow_multiple_uploads,
          fr.require_email,
          fr.custom_message,
          fr.is_active,
          u.name as creator_name
        FROM file_requests fr
        JOIN users u ON fr.created_by = u.id
        WHERE fr.request_token = $1`,
        [token]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = result.rows[0];

      // Check if expired
      if (fileRequest.deadline && new Date(fileRequest.deadline) < new Date()) {
        fileRequest.is_expired = true;
      }

      res.json({
        success: true,
        data: fileRequest
      });
    } catch (error) {
      logger.error('Get public file request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Upload file to request (no auth required)
   * POST /api/public/file-request/:token/upload
   */
  async uploadToRequest(req, res, next) {
    try {
      const { token } = req.params;
      const { uploader_email, uploader_name } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      // Get file request
      const frResult = await query(
        `SELECT fr.*, u.id as creator_id
        FROM file_requests fr
        JOIN users u ON fr.created_by = u.id
        WHERE fr.request_token = $1`,
        [token]
      );

      if (frResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = frResult.rows[0];

      // Validate request is active
      if (!fileRequest.is_active) {
        return res.status(400).json({
          success: false,
          error: 'This file request is no longer accepting uploads'
        });
      }

      // Validate deadline
      if (fileRequest.deadline && new Date(fileRequest.deadline) < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'This file request has expired'
        });
      }

      // Validate email if required
      if (fileRequest.require_email && !uploader_email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required for this file request'
        });
      }

      // Upload file to S3 (as the request creator)
      const mediaFile = await mediaService.uploadMedia(
        req.file,
        fileRequest.creator_id,
        null, // No editor assignment for public uploads
        {
          tags: ['file-request-upload'],
          description: `Uploaded via file request: ${fileRequest.title}`,
          folder_id: fileRequest.folder_id
        }
      );

      // Track the upload
      await query(
        `INSERT INTO file_request_uploads
        (file_request_id, file_id, uploaded_by_email, uploaded_by_name)
        VALUES ($1, $2, $3, $4)`,
        [
          fileRequest.id,
          mediaFile.id,
          uploader_email || null,
          uploader_name || null
        ]
      );

      logger.info('File uploaded via request', {
        fileRequestId: fileRequest.id,
        fileId: mediaFile.id,
        uploaderEmail: uploader_email
      });

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filename: mediaFile.original_filename,
          file_type: mediaFile.file_type,
          file_size: mediaFile.file_size
        }
      });
    } catch (error) {
      logger.error('Public upload error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new FileRequestController();
