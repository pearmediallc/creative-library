const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');
const { v4: uuidv4 } = require('uuid');
const bulkMetadataService = require('../services/bulkMetadataService');

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

      // ✨ NEW: Pass metadata operations from middleware
      const metadataOperations = req.metadataOperations || {};

      const mediaFile = await mediaService.uploadMedia(
        req.file,
        userId,
        editor_id,
        {
          tags: parsedTags,
          description,
          metadataOperations  // ✨ NEW: Include metadata operations
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
}

module.exports = new MediaController();
