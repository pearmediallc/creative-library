const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');
const { v4: uuidv4 } = require('uuid');
const bulkMetadataService = require('../services/bulkMetadataService');

class MediaController {
  /**
   * Upload media file
   * POST /api/media/upload
   * Body: { editor_id, tags, description, folder_id, organize_by_date, assigned_buyer_id, folder_path }
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

      const { editor_id, tags, description, folder_id, organize_by_date, assigned_buyer_id, folder_path } = req.body;
      const userId = req.user.id;

      // Parse tags if it's a string (from multipart form)
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags || '[]') : tags;

      // ✨ NEW: Pass metadata operations from middleware
      const metadataOperations = req.metadataOperations || {};

      // ✨ NEW: Handle folder_path for folder uploads - create hierarchy if needed
      let targetFolderId = folder_id;
      if (folder_path && folder_path.trim()) {
        targetFolderId = await this.createFolderHierarchy(folder_id, folder_path, userId);
      }

      const mediaFile = await mediaService.uploadMedia(
        req.file,
        userId,
        editor_id,
        {
          tags: parsedTags,
          description,
          metadataOperations,  // ✨ Include metadata operations
          folder_id: targetFolderId,  // ✨ NEW: Target folder ID (potentially from hierarchy)
          organize_by_date: organize_by_date === 'true' || organize_by_date === true,  // ✨ NEW: Auto date-based folders
          assigned_buyer_id    // ✨ NEW: Buyer assignment
        }
      );

      // Log activity
      await logActivity({
        req,
        actionType: 'media_upload',
        resourceType: 'media_file',
        resourceId: mediaFile.id,
        resourceName: mediaFile.original_filename,
        details: {
          file_type: mediaFile.file_type,
          file_size: mediaFile.file_size,
          editor_name: mediaFile.editor_name,
          tags: mediaFile.tags
        },
        status: 'success'
      });

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
   * Get media files with advanced filters
   * GET /api/media
   * Query params: editor_id, media_type, tags, search, date_from, date_to,
   *               buyer_id, folder_id, size_min, size_max, width_min, width_max,
   *               height_min, height_max, limit, offset
   */
  async getFiles(req, res, next) {
    try {
      const filters = {
        editor_id: req.query.editor_id,
        media_type: req.query.media_type,
        tags: req.query.tags ? req.query.tags.split(',') : undefined,
        search: req.query.search,
        // ✨ NEW: Date range filters
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        // ✨ NEW: Buyer assignment filter
        buyer_id: req.query.buyer_id,
        // ✨ NEW: Folder filter
        folder_id: req.query.folder_id,
        // ✨ NEW: File size filters
        size_min: req.query.size_min ? parseInt(req.query.size_min) : undefined,
        size_max: req.query.size_max ? parseInt(req.query.size_max) : undefined,
        // ✨ NEW: Resolution filters
        width_min: req.query.width_min ? parseInt(req.query.width_min) : undefined,
        width_max: req.query.width_max ? parseInt(req.query.width_max) : undefined,
        height_min: req.query.height_min ? parseInt(req.query.height_min) : undefined,
        height_max: req.query.height_max ? parseInt(req.query.height_max) : undefined,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      // Role-based access control:
      // - Buyers and Admins can see all content
      // - Creatives can only see their own uploads

      const result = await mediaService.getMediaFiles(filters, req.user.id, req.user.role);

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

      // Log activity
      await logActivity({
        req,
        actionType: 'media_update',
        resourceType: 'media_file',
        resourceId: updatedFile.id,
        resourceName: updatedFile.original_filename,
        details: { updates },
        status: 'success'
      });

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
      // Get file info before deletion for logging
      const fileInfo = await mediaService.getMediaFile(req.params.id);

      await mediaService.deleteMediaFile(req.params.id, req.user.id);

      // Log activity
      await logActivity({
        req,
        actionType: 'media_delete',
        resourceType: 'media_file',
        resourceId: req.params.id,
        resourceName: fileInfo.original_filename,
        details: {
          file_type: fileInfo.file_type,
          editor_name: fileInfo.editor_name
        },
        status: 'success'
      });

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

  /**
   * Get media files for library selector (campaign launcher integration)
   * GET /api/media/select
   * Query params: editor_id (required), start_date, end_date, file_type
   */
  async selectFromLibrary(req, res, next) {
    try {
      const { editor_id, start_date, end_date, file_type } = req.query;

      // Validate required parameter
      if (!editor_id) {
        return res.status(400).json({
          success: false,
          error: 'editor_id is required'
        });
      }

      // Build filters
      const filters = {
        editor_id: editor_id,
        limit: 100, // Show up to 100 files
        offset: 0
      };

      // Add file type filter if specified
      if (file_type && file_type !== 'all') {
        filters.file_type = file_type;
      }

      // Get files using existing service method
      // Apply role-based access control (creatives see only their uploads)
      const result = await mediaService.getMediaFiles(filters, req.user.id, req.user.role);

      // Filter by date range if specified
      let files = result.files || [];
      if (start_date || end_date) {
        files = files.filter(file => {
          const fileDate = new Date(file.created_at);
          if (start_date && fileDate < new Date(start_date)) return false;
          if (end_date && fileDate > new Date(end_date)) return false;
          return true;
        });
      }

      res.json({
        success: true,
        data: {
          files: files,
          total: files.length
        }
      });
    } catch (error) {
      logger.error('Select from library controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * Download file - Proxy file from S3/CloudFront with CORS headers
   * GET /api/media/:id/download
   */
  async downloadFile(req, res, next) {
    try {
      const { id } = req.params;

      console.log('📥 Download request for file:', id);
      console.log('👤 Requested by user:', req.user.id, req.user.email);

      // Get file metadata
      const file = await mediaService.getMediaFile(id);

      if (!file) {
        console.log('❌ File not found:', id);
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      console.log('📂 File belongs to user:', file.user_id);

      console.log('✅ File found:', file.original_filename);
      console.log('📍 S3 URL:', file.s3_url);

      // Fetch file from S3/CloudFront
      const https = require('https');
      const http = require('http');
      const url = require('url');

      const parsedUrl = url.parse(file.s3_url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      console.log('🔗 Fetching from:', parsedUrl.href);

      protocol.get(parsedUrl.href, (proxyRes) => {
        console.log('📡 Response status from S3:', proxyRes.statusCode);
        console.log('📦 Content-Type:', proxyRes.headers['content-type']);
        console.log('📏 Content-Length:', proxyRes.headers['content-length']);

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

        // Set content headers from S3 response
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || file.mime_type);
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        res.setHeader('Content-Disposition', `inline; filename="${file.original_filename}"`);

        // Pipe S3 response to client
        proxyRes.pipe(res);

        proxyRes.on('end', async () => {
          console.log('✅ File download completed:', file.original_filename);

          // Log download activity
          try {
            await logActivity({
              req,
              actionType: 'media_download',
              resourceType: 'media_file',
              resourceId: id,
              resourceName: file.original_filename,
              details: {
                file_type: file.file_type,
                editor_name: file.editor_name
              },
              status: 'success'
            });
          } catch (logErr) {
            logger.error('Failed to log download activity', { error: logErr.message });
          }
        });
      }).on('error', (err) => {
        console.error('❌ Error fetching from S3:', err);
        logger.error('Download proxy error', { error: err.message, fileId: id });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch file from storage'
        });
      });
    } catch (error) {
      console.error('❌ Download controller error:', error);
      logger.error('Download file controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Start bulk metadata operation (async)
   * POST /api/media/bulk/metadata
   * Body: { file_ids: [], operation: 'add' | 'remove' | 'remove_and_add', metadata: {} }
   */
  async bulkMetadataOperation(req, res, next) {
    try {
      const { file_ids, operation, metadata } = req.body;
      const userId = req.user.id;

      // Validate input
      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids array is required and cannot be empty'
        });
      }

      if (!operation || !['add', 'remove', 'remove_and_add'].includes(operation)) {
        return res.status(400).json({
          success: false,
          error: 'operation must be: add, remove, or remove_and_add'
        });
      }

      // Create unique job ID
      const jobId = uuidv4();

      logger.info(`Starting bulk metadata operation ${jobId}: ${operation} on ${file_ids.length} files by user ${userId}`);

      // Start async processing (doesn't block response)
      bulkMetadataService.processBulkOperation(
        jobId,
        file_ids,
        operation,
        metadata || {},
        userId
      ).catch(error => {
        logger.error('Bulk operation background error:', error);
      });

      // Return job ID immediately
      res.json({
        success: true,
        message: 'Bulk metadata operation started',
        data: {
          job_id: jobId,
          status_url: `/api/media/bulk/status/${jobId}`,
          total_files: file_ids.length,
          operation: operation
        }
      });

    } catch (error) {
      logger.error('Bulk metadata operation error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Get bulk operation status
   * GET /api/media/bulk/status/:jobId
   */
  async getBulkOperationStatus(req, res, next) {
    try {
      const { jobId } = req.params;

      const job = bulkMetadataService.getJobStatus(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Job not found. It may have expired (jobs are kept for 1 hour)'
        });
      }

      res.json({
        success: true,
        data: job
      });

    } catch (error) {
      logger.error('Get bulk status error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Cancel bulk operation
   * POST /api/media/bulk/cancel/:jobId
   */
  async cancelBulkOperation(req, res, next) {
    try {
      const { jobId } = req.params;

      const cancelled = bulkMetadataService.cancelJob(jobId);

      if (!cancelled) {
        return res.status(400).json({
          success: false,
          error: 'Job cannot be cancelled (not found or already completed)'
        });
      }

      logger.info(`Bulk operation ${jobId} cancelled by user`);

      res.json({
        success: true,
        message: 'Bulk operation cancelled successfully'
      });

    } catch (error) {
      logger.error('Cancel bulk operation error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Get file metadata (EXIF, IPTC, XMP)
   * GET /api/media/:id/metadata
   */
  async getFileMetadata(req, res, next) {
    try {
      const { id } = req.params;

      const metadata = await mediaService.extractMetadata(id);

      res.json({
        success: true,
        message: 'Metadata extracted successfully',
        data: {
          file_id: id,
          metadata: metadata || {}
        }
      });

    } catch (error) {
      logger.error('Extract metadata error', { error: error.message, fileId: req.params.id });
      if (error.message === 'Media file not found') {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }

  /**
   * ✨ NEW: Bulk download files as ZIP
   * POST /api/media/bulk/download-zip
   * Body: { file_ids: [] }
   */
  async bulkDownloadZip(req, res, next) {
    try {
      const { file_ids } = req.body;
      const userId = req.user.id;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids array is required and cannot be empty'
        });
      }

      if (file_ids.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Maximum 100 files can be downloaded at once'
        });
      }

      logger.info(`Creating ZIP for ${file_ids.length} files requested by user ${userId}`);

      const zipStream = await mediaService.createBulkZip(file_ids, userId);

      // Set response headers for ZIP download
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="files-${timestamp}.zip"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      // Pipe the ZIP stream to response
      zipStream.pipe(res);

      zipStream.on('end', () => {
        logger.info(`ZIP download completed for ${file_ids.length} files`);
      });

      zipStream.on('error', (error) => {
        logger.error('ZIP stream error', { error: error.message });
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to create ZIP file'
          });
        }
      });

    } catch (error) {
      logger.error('Bulk download ZIP error', { error: error.message });
      if (!res.headersSent) {
        next(error);
      }
    }
  }

  /**
   * ✨ NEW: Bulk delete files
   * DELETE /api/media/bulk
   * Body: { file_ids: string[] }
   */
  async bulkDelete(req, res, next) {
    try {
      const { file_ids } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids array is required'
        });
      }

      // Only admins can bulk delete
      if (userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Only administrators can perform bulk delete'
        });
      }

      logger.info(`Bulk delete initiated: ${file_ids.length} files by user ${userId}`);

      const MediaFile = require('../models/MediaFile');
      const results = {
        success: [],
        failed: []
      };

      for (const fileId of file_ids) {
        try {
          // Soft delete the file
          await MediaFile.softDelete(fileId, userId);
          results.success.push(fileId);
        } catch (error) {
          logger.error(`Failed to delete file ${fileId}`, { error: error.message });
          results.failed.push({ fileId, error: error.message });
        }
      }

      logger.info(`Bulk delete completed: ${results.success.length} succeeded, ${results.failed.length} failed`);

      res.json({
        success: true,
        data: {
          deleted: results.success.length,
          failed: results.failed.length,
          results
        },
        message: `Successfully deleted ${results.success.length} of ${file_ids.length} files`
      });
    } catch (error) {
      logger.error('Bulk delete error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Bulk move files to folder
   * POST /api/media/bulk/move
   * Body: { file_ids: string[], target_folder_id: string | null }
   */
  async bulkMove(req, res, next) {
    try {
      const { file_ids, target_folder_id } = req.body;
      const userId = req.user.id;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids array is required'
        });
      }

      logger.info(`Bulk move initiated: ${file_ids.length} files to folder ${target_folder_id || 'root'} by user ${userId}`);

      const MediaFile = require('../models/MediaFile');
      const results = {
        success: [],
        failed: []
      };

      for (const fileId of file_ids) {
        try {
          // Update file's folder_id
          await MediaFile.update(fileId, {
            folder_id: target_folder_id || null
          });
          results.success.push(fileId);
        } catch (error) {
          logger.error(`Failed to move file ${fileId}`, { error: error.message });
          results.failed.push({ fileId, error: error.message });
        }
      }

      logger.info(`Bulk move completed: ${results.success.length} succeeded, ${results.failed.length} failed`);

      res.json({
        success: true,
        data: {
          moved: results.success.length,
          failed: results.failed.length,
          results
        },
        message: `Successfully moved ${results.success.length} of ${file_ids.length} files`
      });
    } catch (error) {
      logger.error('Bulk move error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Get deleted files (trash)
   * GET /api/media/deleted
   */
  async getDeletedFiles(req, res, next) {
    try {
      const MediaFile = require('../models/MediaFile');

      // Query for deleted files only
      const sql = `
        SELECT
          mf.*,
          u.name as uploader_name,
          u.email as uploader_email,
          e.display_name as editor_name
        FROM media_files mf
        LEFT JOIN users u ON u.id = mf.uploaded_by
        LEFT JOIN editors e ON e.id = mf.editor_id
        WHERE mf.is_deleted = TRUE
        ORDER BY mf.deleted_at DESC
      `;

      const result = await MediaFile.raw(sql);

      logger.info(`Retrieved ${result.length} deleted files for user ${req.user.id}`);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get deleted files error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Restore deleted file
   * POST /api/media/:id/restore
   */
  async restoreFile(req, res, next) {
    try {
      const MediaFile = require('../models/MediaFile');
      const fileId = req.params.id;
      const userId = req.user.id;

      // Get file info
      const file = await MediaFile.findById(fileId);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      if (!file.is_deleted) {
        return res.status(400).json({
          success: false,
          error: 'File is not in trash'
        });
      }

      // Check permissions (only uploader or admin can restore)
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (file.uploaded_by !== userId && user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      // Restore the file
      await MediaFile.update(fileId, {
        is_deleted: false,
        deleted_at: null,
        deleted_by: null
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'media_restore',
        resourceType: 'media_file',
        resourceId: fileId,
        resourceName: file.original_filename,
        details: {
          file_type: file.file_type,
          editor_name: file.editor_name
        },
        status: 'success'
      });

      logger.info(`File restored: ${fileId} by user ${userId}`);

      res.json({
        success: true,
        message: 'File restored successfully'
      });
    } catch (error) {
      logger.error('Restore file error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Permanently delete a file (admin only)
   * DELETE /api/media/:id/permanent
   */
  async permanentDeleteFile(req, res, next) {
    try {
      const MediaFile = require('../models/MediaFile');
      const s3Service = require('../services/s3Service');
      const fileId = req.params.id;
      const userId = req.user.id;

      // Get file info
      const file = await MediaFile.findById(fileId);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      if (!file.is_deleted) {
        return res.status(400).json({
          success: false,
          error: 'File must be in trash before permanent deletion. Use DELETE /api/media/:id to move to trash first.'
        });
      }

      // Delete from S3
      try {
        if (file.s3_key) {
          await s3Service.deleteFile(file.s3_key);
          logger.info(`Deleted S3 file: ${file.s3_key}`);
        }
        if (file.thumbnail_s3_key) {
          await s3Service.deleteFile(file.thumbnail_s3_key);
          logger.info(`Deleted S3 thumbnail: ${file.thumbnail_s3_key}`);
        }
      } catch (s3Error) {
        logger.error('S3 deletion failed', { error: s3Error.message, fileId });
        // Continue with database deletion even if S3 fails
      }

      // Hard delete from database
      await MediaFile.delete(fileId);

      // Log activity
      await logActivity({
        req,
        actionType: 'media_permanent_delete',
        resourceType: 'media_file',
        resourceId: fileId,
        resourceName: file.original_filename,
        details: {
          file_type: file.file_type,
          editor_name: file.editor_name,
          s3_key: file.s3_key
        },
        status: 'success'
      });

      logger.info(`File permanently deleted: ${fileId} by user ${userId}`);

      res.json({
        success: true,
        message: 'File permanently deleted'
      });
    } catch (error) {
      logger.error('Permanent delete error', { error: error.message });
      next(error);
    }
  }

  /**
   * ✨ NEW: Empty trash (permanently delete all deleted files) - admin only
   * DELETE /api/media/deleted/empty
   */
  async emptyTrash(req, res, next) {
    try {
      const MediaFile = require('../models/MediaFile');
      const s3Service = require('../services/s3Service');
      const userId = req.user.id;

      // Get all deleted files
      const deletedFiles = await MediaFile.raw(`
        SELECT * FROM media_files WHERE is_deleted = TRUE
      `);

      logger.info(`Emptying trash: ${deletedFiles.length} files to be permanently deleted by user ${userId}`);

      const results = {
        deleted: 0,
        failed: 0,
        errors: []
      };

      // Delete each file
      for (const file of deletedFiles) {
        try {
          // Delete from S3
          if (file.s3_key) {
            await s3Service.deleteFile(file.s3_key);
          }
          if (file.thumbnail_s3_key) {
            await s3Service.deleteFile(file.thumbnail_s3_key);
          }

          // Hard delete from database
          await MediaFile.delete(file.id);

          results.deleted++;
        } catch (error) {
          logger.error(`Failed to delete file ${file.id}`, { error: error.message });
          results.failed++;
          results.errors.push({
            fileId: file.id,
            filename: file.original_filename,
            error: error.message
          });
        }
      }

      // Log activity
      await logActivity({
        req,
        actionType: 'media_empty_trash',
        resourceType: 'media_file',
        resourceId: null,
        resourceName: 'Trash',
        details: {
          total_files: deletedFiles.length,
          deleted: results.deleted,
          failed: results.failed
        },
        status: results.failed === 0 ? 'success' : 'partial_success'
      });

      logger.info(`Trash emptied: ${results.deleted} files deleted, ${results.failed} failed`);

      res.json({
        success: true,
        message: `Trash emptied successfully. ${results.deleted} files permanently deleted.`,
        data: results
      });
    } catch (error) {
      logger.error('Empty trash error', { error: error.message });
      next(error);
    }
  }

  /**
   * Rename media file
   * PATCH /api/media/:id/rename
   * Body: { new_filename: string }
   */
  async renameFile(req, res, next) {
    try {
      const { id } = req.params;
      const { new_filename } = req.body;
      const userId = req.user.id;

      // Validate input
      if (!new_filename || !new_filename.trim()) {
        return res.status(400).json({
          success: false,
          error: 'new_filename is required'
        });
      }

      const mediaService = require('../services/mediaService');
      const s3Service = require('../services/s3Service');
      const MediaFile = require('../models/MediaFile');

      // Get the file
      const file = await MediaFile.findById(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'Media file not found'
        });
      }

      if (file.is_deleted) {
        return res.status(400).json({
          success: false,
          error: 'Cannot rename deleted file'
        });
      }

      // Check permissions (owner or admin can rename)
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (file.uploaded_by !== userId && user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      const oldFilename = file.original_filename;
      const newFilename = new_filename.trim();

      // If filename hasn't changed, no need to do anything
      if (oldFilename === newFilename) {
        return res.json({
          success: true,
          message: 'Filename unchanged',
          data: file
        });
      }

      // Extract file extension from old filename
      const oldExtension = oldFilename.substring(oldFilename.lastIndexOf('.'));
      const newExtension = newFilename.includes('.')
        ? newFilename.substring(newFilename.lastIndexOf('.'))
        : oldExtension;

      // Ensure new filename has an extension
      const finalFilename = newFilename.includes('.')
        ? newFilename
        : newFilename + oldExtension;

      // Generate new S3 key (keep same structure, just change filename)
      const oldS3Key = file.s3_key;
      const s3KeyParts = oldS3Key.split('/');
      s3KeyParts[s3KeyParts.length - 1] = finalFilename;
      const newS3Key = s3KeyParts.join('/');

      // Copy file to new key in S3
      await s3Service.copyFile(oldS3Key, newS3Key);

      // Get the new S3 URL
      const newS3Url = await s3Service.getSignedUrl(newS3Key);

      // Update database
      await MediaFile.update(id, {
        original_filename: finalFilename,
        filename: finalFilename,
        s3_key: newS3Key,
        s3_url: newS3Url
      });

      // Delete old S3 file
      await s3Service.deleteFile(oldS3Key);

      // Get updated file
      const updatedFile = await MediaFile.findById(id);

      // Log activity
      await logActivity({
        req,
        actionType: 'media_rename',
        resourceType: 'media_file',
        resourceId: id,
        resourceName: finalFilename,
        details: {
          old_filename: oldFilename,
          new_filename: finalFilename,
          old_s3_key: oldS3Key,
          new_s3_key: newS3Key
        },
        status: 'success'
      });

      logger.info(`File renamed: ${oldFilename} -> ${finalFilename} by user ${userId}`);

      res.json({
        success: true,
        message: 'File renamed successfully',
        data: updatedFile
      });
    } catch (error) {
      logger.error('Rename file error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * Create folder hierarchy from relative path
   * Helper method for folder uploads
   * @param {string} baseFolderId - Base folder ID (or null for root)
   * @param {string} relativePath - Relative path like "Photos/2024/January" or "folder1/subfolder2"
   * @param {string} userId - User ID
   * @returns {Promise<string>} Final folder ID
   */
  async createFolderHierarchy(baseFolderId, relativePath, userId) {
    try {
      const Folder = require('../models/Folder');
      const folderController = require('./folderController');

      // Split path by '/' and filter out empty segments
      const pathSegments = relativePath.split('/').filter(segment => segment.trim().length > 0);

      if (pathSegments.length === 0) {
        return baseFolderId;
      }

      let currentParentId = baseFolderId;

      // Create each folder level if it doesn't exist
      for (const folderName of pathSegments) {
        const folder = await folderController.findOrCreateFolder(
          folderName,
          currentParentId,
          userId,
          'user' // User-created folder type
        );
        currentParentId = folder.id;
      }

      logger.info(`Created folder hierarchy: ${relativePath}`, {
        baseFolderId,
        finalFolderId: currentParentId,
        userId
      });

      return currentParentId;
    } catch (error) {
      logger.error('Create folder hierarchy failed', {
        error: error.message,
        baseFolderId,
        relativePath,
        userId
      });
      throw error;
    }
  }

  /**
   * Get activity logs for a specific file
   * GET /api/media/:id/activity
   */
  async getFileActivity(req, res, next) {
    try {
      const fileId = req.params.id;
      const ActivityLog = require('../models/ActivityLog');

      // Get activity logs for this specific file
      const filters = {
        resourceType: 'media_file',
        resourceId: fileId,
        actionType: req.query.action_type,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const [logs, total] = await Promise.all([
        ActivityLog.getLogs(filters),
        ActivityLog.getCount(filters)
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + logs.length < total
          }
        }
      });
    } catch (error) {
      logger.error('Get file activity error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }
}

module.exports = new MediaController();
