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
      console.log('=== FILE REQUEST CREATE START ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      console.log('User:', req.user);

      const userId = req.user.id;
      const {
        title,
        description,
        request_type,
        concept_notes,
        num_creatives = 1,
        platform,
        vertical,
        folder_id,
        deadline,
        allow_multiple_uploads = true,
        require_email = false,
        custom_message,
        editor_id,
        editor_ids,
        assigned_buyer_id
      } = req.body;

      console.log('Parsed values:', {
        userId,
        title,
        request_type,
        folder_id,
        editor_id,
        editor_ids,
        assigned_buyer_id
      });

      // Validation - either title OR request_type is required
      const requestTitle = request_type || title;
      if (!requestTitle || requestTitle.trim() === '') {
        console.log('ERROR: Missing title/request_type');
        return res.status(400).json({
          success: false,
          error: 'Title or request_type is required'
        });
      }

      // Validate num_creatives
      if (num_creatives && (num_creatives < 1 || !Number.isInteger(num_creatives))) {
        return res.status(400).json({
          success: false,
          error: 'num_creatives must be a positive integer'
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
        console.log('Verifying folder_id:', folder_id);
        try {
          const folderResult = await query(
            'SELECT id, owner_id, name FROM folders WHERE id = $1 AND is_deleted = FALSE',
            [folder_id]
          );
          console.log('Folder query result:', folderResult.rows);
          if (folderResult.rows.length === 0) {
            console.log('ERROR: Folder not found');
            return res.status(404).json({
              success: false,
              error: 'Folder not found'
            });
          }
        } catch (folderError) {
          console.error('Folder verification error:', folderError);
          throw folderError;
        }
      }

      // Verify editor exists if provided
      if (editor_id) {
        console.log('Verifying editor_id:', editor_id);
        try {
          const editorResult = await query(
            'SELECT id, name, display_name FROM editors WHERE id = $1 AND is_active = TRUE',
            [editor_id]
          );
          console.log('Editor query result:', editorResult.rows);
          if (editorResult.rows.length === 0) {
            console.log('ERROR: Editor not found in editors table');
            return res.status(404).json({
              success: false,
              error: 'Editor not found'
            });
          }
        } catch (editorError) {
          console.error('Editor verification error:', editorError);
          throw editorError;
        }
      }

      // Verify all editors in editor_ids array
      if (editor_ids && Array.isArray(editor_ids) && editor_ids.length > 0) {
        console.log('Verifying editor_ids array:', editor_ids);
        for (const edId of editor_ids) {
          try {
            const editorResult = await query(
              'SELECT id, name, display_name FROM editors WHERE id = $1 AND is_active = TRUE',
              [edId]
            );
            console.log(`Editor ${edId} query result:`, editorResult.rows);
            if (editorResult.rows.length === 0) {
              console.log(`ERROR: Editor ${edId} not found in editors table`);
              return res.status(404).json({
                success: false,
                error: `Editor with ID ${edId} not found`
              });
            }
          } catch (editorError) {
            console.error(`Editor ${edId} verification error:`, editorError);
            throw editorError;
          }
        }
      }

      // Verify buyer exists if provided
      if (assigned_buyer_id) {
        const buyerResult = await query(
          'SELECT id FROM users WHERE id = $1 AND role = $2',
          [assigned_buyer_id, 'buyer']
        );
        if (buyerResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Buyer not found'
          });
        }
      }

      // Generate unique token
      const requestToken = this.generateToken();
      console.log('Generated request token:', requestToken);

      // Create file request
      console.log('About to insert file request with values:', {
        title: requestTitle.trim(),
        description: description || concept_notes || null,
        request_type: request_type || requestTitle.trim(),
        concept_notes: concept_notes || description || null,
        num_creatives,
        platform: platform || null,
        vertical: vertical || null,
        created_by: userId,
        folder_id: folder_id || null,
        request_token: requestToken,
        deadline: deadline || null,
        allow_multiple_uploads,
        require_email,
        custom_message: custom_message || null,
        assigned_buyer_id: assigned_buyer_id || null,
        assigned_at: (editor_id || (editor_ids && editor_ids.length > 0)) ? new Date() : null
      });

      let result;
      try {
        result = await query(
          `INSERT INTO file_requests
          (title, description, request_type, concept_notes, num_creatives, platform, vertical, created_by, folder_id, request_token, deadline,
           allow_multiple_uploads, require_email, custom_message, assigned_buyer_id, assigned_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *`,
          [
            requestTitle.trim(),
            description || concept_notes || null,
            request_type || requestTitle.trim(),
            concept_notes || description || null,
            num_creatives,
            platform || null,
            vertical || null,
            userId,
            folder_id || null,
            requestToken,
            deadline || null,
            allow_multiple_uploads,
            require_email,
            custom_message || null,
            assigned_buyer_id || null,
            (editor_id || (editor_ids && editor_ids.length > 0)) ? new Date() : null
          ]
        );
        console.log('Insert successful, returned:', result.rows[0]);
      } catch (insertError) {
        console.error('INSERT ERROR:', insertError);
        console.error('Error details:', {
          message: insertError.message,
          code: insertError.code,
          detail: insertError.detail,
          hint: insertError.hint,
          table: insertError.table,
          column: insertError.column
        });
        throw insertError;
      }

      const fileRequest = result.rows[0];

      // Handle multi-editor assignment
      const editorsToAssign = editor_ids || (editor_id ? [editor_id] : []);
      if (editorsToAssign.length > 0) {
        for (const edId of editorsToAssign) {
          await query(
            `INSERT INTO file_request_editors (request_id, editor_id, status)
             VALUES ($1, $2, 'pending')
             ON CONFLICT (request_id, editor_id) DO NOTHING`,
            [fileRequest.id, edId]
          );
        }
      }

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
      console.error('=== FILE REQUEST CREATE ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      logger.error('Create file request error', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        detail: error.detail
      });
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
      const userRole = req.user.role;
      const { status } = req.query; // active, closed, all

      // Check if user is an editor (creative role)
      const isEditor = userRole === 'creative';

      let whereClause;
      let params;

      if (isEditor) {
        // For editors: Find their editor_id and show requests assigned to them
        const editorResult = await query(
          'SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE',
          [userId]
        );

        if (editorResult.rows.length === 0) {
          // Editor profile doesn't exist, return empty array
          logger.warn('Editor profile not found for user', { userId });
          return res.json({
            success: true,
            data: []
          });
        }

        const editorId = editorResult.rows[0].id;
        whereClause = `WHERE fre.editor_id = $1`;
        params = [editorId];

        if (status === 'active') {
          whereClause += ' AND fr.is_active = TRUE';
        } else if (status === 'closed') {
          whereClause += ' AND fr.is_active = FALSE';
        }

        // Query for editor: show requests assigned to them via file_request_editors
        const result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) as upload_count,
            fre.status as my_assignment_status,
            fre.created_at as assigned_at
          FROM file_request_editors fre
          JOIN file_requests fr ON fre.request_id = fr.id
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
          ${whereClause}
          GROUP BY fr.id, f.name, fre.status, fre.created_at
          ORDER BY fre.created_at DESC`,
          params
        );

        logger.info('Editor file requests fetched', {
          userId,
          editorId,
          requestCount: result.rows.length
        });

        return res.json({
          success: true,
          data: result.rows
        });
      } else {
        // For non-editors (admin, buyer): show requests they created
        whereClause = 'WHERE created_by = $1';
        params = [userId];

        if (status === 'active') {
          whereClause += ' AND is_active = TRUE';
        } else if (status === 'closed') {
          whereClause += ' AND is_active = FALSE';
        }

        const result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) as upload_count,
            buyer.name as buyer_name,
            buyer.email as buyer_email,
            creator.name as created_by_name,
            STRING_AGG(DISTINCT e.display_name, ', ') as assigned_editors
          FROM file_requests fr
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
          LEFT JOIN users buyer ON fr.assigned_buyer_id = buyer.id
          LEFT JOIN users creator ON fr.created_by = creator.id
          LEFT JOIN file_request_editors fre ON fr.id = fre.request_id
          LEFT JOIN editors e ON fre.editor_id = e.id
          ${whereClause}
          GROUP BY fr.id, f.name, buyer.name, buyer.email, creator.name
          ORDER BY fr.created_at DESC`,
          params
        );

        return res.json({
          success: true,
          data: result.rows
        });
      }
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
      const userRole = req.user.role;
      const { id } = req.params;

      // Check if user is an editor
      const isEditor = userRole === 'creative';

      let result;
      if (isEditor) {
        // For editors: check if they're assigned to this request
        const editorResult = await query(
          'SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE',
          [userId]
        );

        if (editorResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Editor profile not found'
          });
        }

        const editorId = editorResult.rows[0].id;

        // Query with editor assignment check
        result = await query(
          `SELECT
            fr.*,
            f.name as folder_name,
            COUNT(DISTINCT fru.id) as upload_count,
            u.name as creator_name,
            u.email as creator_email
          FROM file_request_editors fre
          JOIN file_requests fr ON fre.request_id = fr.id
          LEFT JOIN folders f ON fr.folder_id = f.id
          LEFT JOIN file_request_uploads fru ON fr.id = fru.file_request_id
          LEFT JOIN users u ON fr.created_by = u.id
          WHERE fr.id = $1 AND fre.editor_id = $2
          GROUP BY fr.id, f.name, u.name, u.email`,
          [id, editorId]
        );
      } else {
        // For non-editors: check if they created the request
        result = await query(
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
      }

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found or you do not have access'
        });
      }

      // Get uploaded files
      // 📝 LOGGING: Fetching file request uploads
      logger.info('Fetching uploaded files for file request', { file_request_id: id });

      const uploadsResult = await query(
        `SELECT
          fru.*,
          mf.original_filename,
          mf.file_type,
          mf.file_size,
          mf.thumbnail_url,
          mf.s3_url
        FROM file_request_uploads fru
        JOIN media_files mf ON fru.file_id = mf.id
        WHERE fru.file_request_id = $1
        ORDER BY fru.created_at DESC`,
        [id]
      );

      logger.info('File request uploads fetched', { count: uploadsResult.rows.length });

      // Get assigned editors with assignment history
      let editorsResult = { rows: [] };
      try {
        editorsResult = await query(
          `SELECT
            e.id,
            e.name,
            e.display_name,
            fre.status,
            fre.created_at,
            fre.accepted_at,
            fre.started_at,
            fre.completed_at
          FROM file_request_editors fre
          JOIN editors e ON fre.editor_id = e.id
          WHERE fre.request_id = $1
          ORDER BY fre.created_at ASC`,
          [id]
        );
        logger.info('Assigned editors fetched', {
          requestId: id,
          count: editorsResult.rows.length,
          editors: editorsResult.rows.map(r => ({ id: r.id, name: r.name, status: r.status }))
        });
      } catch (editorError) {
        logger.error('Failed to fetch assigned editors', {
          requestId: id,
          error: editorError.message,
          stack: editorError.stack
        });
        // Continue without assigned editors data
      }

      const fileRequest = result.rows[0];
      fileRequest.uploads = uploadsResult.rows;
      fileRequest.assigned_editors = editorsResult.rows;

      // Calculate num_creatives_requested (use from DB if available, fallback to editors count)
      fileRequest.num_creatives_requested = fileRequest.num_creatives || editorsResult.rows.length || 0;

      // Calculate total time to complete (in hours)
      if (fileRequest.created_at && fileRequest.completed_at) {
        const createdDate = new Date(fileRequest.created_at);
        const completedDate = new Date(fileRequest.completed_at);
        const diffMs = completedDate.getTime() - createdDate.getTime();
        fileRequest.time_to_complete_hours = (diffMs / (1000 * 60 * 60)).toFixed(2);
      }

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
      // Use editor_id and assigned_buyer_id from file request if specified
      const mediaFile = await mediaService.uploadMedia(
        req.file,
        fileRequest.creator_id,
        fileRequest.editor_id || null, // Use editor from request if specified
        {
          tags: ['file-request-upload'],
          description: `Uploaded via file request: ${fileRequest.title}`,
          folder_id: fileRequest.folder_id,
          assigned_buyer_id: fileRequest.assigned_buyer_id || null // Assign to buyer if specified
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

  /**
   * Assign multiple editors to a file request
   * POST /api/file-requests/:id/assign-editors
   */
  async assignEditors(req, res, next) {
    try {
      const { id } = req.params;
      const { editor_ids } = req.body;
      const userId = req.user.id;

      logger.info('assignEditors called', {
        requestId: id,
        editor_ids,
        editor_ids_type: typeof editor_ids,
        editor_ids_isArray: Array.isArray(editor_ids),
        userId,
        body: req.body
      });

      if (!Array.isArray(editor_ids) || editor_ids.length === 0) {
        logger.error('Invalid editor_ids', { editor_ids, type: typeof editor_ids });
        return res.status(400).json({
          success: false,
          error: 'editor_ids must be a non-empty array'
        });
      }

      // Verify file request exists and user owns it
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1 AND created_by = $2',
        [id, userId]
      );

      logger.info('File request query result', {
        found: requestResult.rows.length,
        requestId: id,
        userId
      });

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Verify all editors exist
      const editorsResult = await query(
        'SELECT id FROM editors WHERE id = ANY($1) AND is_active = TRUE',
        [editor_ids]
      );

      logger.info('Editors verification', {
        requestedCount: editor_ids.length,
        foundCount: editorsResult.rows.length,
        requestedIds: editor_ids,
        foundIds: editorsResult.rows.map(r => r.id)
      });

      if (editorsResult.rows.length !== editor_ids.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more editors not found or inactive',
          details: {
            requested: editor_ids,
            found: editorsResult.rows.map(r => r.id)
          }
        });
      }

      // Insert editor assignments (ON CONFLICT DO NOTHING for idempotency)
      for (const editorId of editor_ids) {
        await query(
          `INSERT INTO file_request_editors (request_id, editor_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (request_id, editor_id) DO NOTHING`,
          [id, editorId]
        );
      }

      // Update assigned_at timestamp
      await query(
        'UPDATE file_requests SET assigned_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );

      logger.info('Editors assigned to file request', {
        requestId: id,
        editorIds: editor_ids,
        userId
      });

      res.json({
        success: true,
        message: 'Editors assigned successfully',
        assigned_count: editor_ids.length
      });
    } catch (error) {
      logger.error('Assign editors error', { error: error.message });
      next(error);
    }
  }

  /**
   * Create folder for file request (editor use)
   * POST /api/file-requests/:id/folders
   */
  async createRequestFolder(req, res, next) {
    try {
      const { id } = req.params;
      const { folder_name, description } = req.body;
      const userId = req.user.id;

      if (!folder_name || folder_name.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'folder_name is required'
        });
      }

      // Verify file request exists
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Create folder
      const result = await query(
        `INSERT INTO file_request_folders (request_id, folder_name, description, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, folder_name.trim(), description || null, userId]
      );

      const folder = result.rows[0];

      logger.info('File request folder created', {
        folderId: folder.id,
        requestId: id,
        userId
      });

      res.status(201).json({
        success: true,
        message: 'Folder created successfully',
        data: folder
      });
    } catch (error) {
      logger.error('Create request folder error', { error: error.message });
      next(error);
    }
  }

  /**
   * Complete a file request (mark as completed with optional delivery note)
   * POST /api/file-requests/:id/complete
   */
  async completeRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { delivery_note } = req.body;
      const userId = req.user.id;

      // Get file request with assignment details
      const requestResult = await query(
        `SELECT fr.*, fre.accepted_at, fre.editor_id
         FROM file_requests fr
         LEFT JOIN file_request_editors fre ON fr.id = fre.request_id AND fre.user_id = $1
         WHERE fr.id = $2`,
        [userId, id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      const fileRequest = requestResult.rows[0];

      // Calculate time to complete
      let timeToComplete = null;
      if (fileRequest.assigned_at) {
        const now = new Date();
        const assigned = new Date(fileRequest.assigned_at);
        timeToComplete = Math.floor((now - assigned) / (1000 * 60)); // minutes
      }

      // Update file request
      await query(
        `UPDATE file_requests
         SET
           delivery_note = $1,
           completed_at = CURRENT_TIMESTAMP,
           time_to_complete_minutes = $2
         WHERE id = $3`,
        [delivery_note || null, timeToComplete, id]
      );

      logger.info('File request completed', {
        requestId: id,
        userId,
        timeToComplete
      });

      res.json({
        success: true,
        message: 'File request completed successfully',
        time_to_complete_minutes: timeToComplete
      });
    } catch (error) {
      logger.error('Complete request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Reassign file request to different editors (admin only)
   * POST /api/file-requests/:id/reassign
   */
  async reassignRequest(req, res, next) {
    try {
      const { id } = req.params;
      const { new_editor_ids, reason } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(new_editor_ids) || new_editor_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'new_editor_ids must be a non-empty array'
        });
      }

      // Verify file request exists
      const requestResult = await query(
        'SELECT * FROM file_requests WHERE id = $1',
        [id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File request not found'
        });
      }

      // Remove old editor assignments
      await query(
        'DELETE FROM file_request_editors WHERE request_id = $1',
        [id]
      );

      // Add new editor assignments
      for (const editorId of new_editor_ids) {
        await query(
          `INSERT INTO file_request_editors (request_id, editor_id, status)
           VALUES ($1, $2, 'pending')`,
          [id, editorId]
        );
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'file_request_reassigned',
        resourceType: 'file_request',
        resourceId: id,
        details: {
          new_editor_ids,
          reason
        },
        status: 'success'
      });

      logger.info('File request reassigned', {
        requestId: id,
        newEditorIds: new_editor_ids,
        userId
      });

      res.json({
        success: true,
        message: 'File request reassigned successfully',
        assigned_count: new_editor_ids.length
      });
    } catch (error) {
      logger.error('Reassign request error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get folders for a file request
   * GET /api/file-requests/:id/folders
   */
  async getRequestFolders(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT
           frf.*,
           u.full_name as created_by_name,
           COUNT(fru.id) as file_count
         FROM file_request_folders frf
         LEFT JOIN users u ON frf.created_by = u.id
         LEFT JOIN file_request_uploads fru ON fru.folder_id = frf.id
         WHERE frf.request_id = $1
         GROUP BY frf.id, u.full_name
         ORDER BY frf.created_at ASC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get request folders error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get assigned editors for a file request
   * GET /api/file-requests/:id/editors
   */
  async getAssignedEditors(req, res, next) {
    try {
      const { id } = req.params;

      const result = await query(
        `SELECT
           fre.*,
           e.name as editor_name,
           e.display_name as editor_display_name,
           u.full_name as user_name,
           u.email as user_email
         FROM file_request_editors fre
         LEFT JOIN editors e ON fre.editor_id = e.id
         LEFT JOIN users u ON fre.user_id = u.id
         WHERE fre.request_id = $1
         ORDER BY fre.created_at ASC`,
        [id]
      );

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get assigned editors error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new FileRequestController();
