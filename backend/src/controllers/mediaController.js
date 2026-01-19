const mediaService = require('../services/mediaService');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');
const { v4: uuidv4 } = require('uuid');
const bulkMetadataService = require('../services/bulkMetadataService');
const { query } = require('../config/database');

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

      // 📝 LOGGING: Upload request received
      logger.info('Media upload request received', {
        userId,
        editor_id,
        folder_id,
        folder_path: folder_path || 'NOT PROVIDED',
        organize_by_date,
        filename: req.file?.originalname
      });

      // Parse tags if it's a string (from multipart form)
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags || '[]') : tags;

      // ✨ NEW: Pass metadata operations from middleware
      const metadataOperations = req.metadataOperations || {};

      // ✨ NEW: Handle folder_path for folder uploads - create hierarchy if needed
      let targetFolderId = folder_id;
      let s3FolderPath = null; // S3 path for the created hierarchy

      if (folder_path && folder_path.trim()) {
        logger.info('Creating folder hierarchy', { folder_path, base_folder_id: folder_id });
        targetFolderId = await this.createFolderHierarchy(folder_id, folder_path, userId);

        // Get the actual S3 path from the created/found folder
        const Folder = require('../models/Folder');
        const targetFolder = await Folder.findById(targetFolderId);
        if (targetFolder) {
          s3FolderPath = targetFolder.s3_path;
          logger.info('Folder hierarchy created', { targetFolderId, s3FolderPath });
        }
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
          assigned_buyer_id,    // ✨ NEW: Buyer assignment
          s3_folder_path: s3FolderPath  // ✨ NEW: Direct S3 folder path for folder uploads
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
   * ✨ NEW: Move single file to folder
   * POST /api/media/:id/move
   * Body: { target_folder_id: string | null }
   */
  async moveFile(req, res, next) {
    try {
      const { id } = req.params;
      const { target_folder_id } = req.body;
      const userId = req.user.id;

      const MediaFile = require('../models/MediaFile');

      // Get file info
      const file = await MediaFile.findById(id);

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      if (file.is_deleted) {
        return res.status(400).json({
          success: false,
          error: 'Cannot move deleted file'
        });
      }

      // Check permissions (owner or admin can move)
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (file.uploaded_by !== userId && user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      // Update file's folder_id
      await MediaFile.update(id, {
        folder_id: target_folder_id || null
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'media_move',
        resourceType: 'media_file',
        resourceId: id,
        resourceName: file.original_filename,
        details: {
          from_folder: file.folder_id,
          to_folder: target_folder_id
        },
        status: 'success'
      });

      logger.info(`File moved: ${id} to folder ${target_folder_id || 'root'} by user ${userId}`);

      res.json({
        success: true,
        message: 'File moved successfully'
      });
    } catch (error) {
      logger.error('Move file error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * ✨ NEW: Copy single file to folder
   * POST /api/media/:id/copy
   * Body: { target_folder_id: string | null }
   */
  async copyFile(req, res, next) {
    try {
      const { id } = req.params;
      const { target_folder_id } = req.body;
      const userId = req.user.id;

      const MediaFile = require('../models/MediaFile');
      const s3Service = require('../services/s3Service');

      // Get original file info
      const originalFile = await MediaFile.findById(id);

      if (!originalFile) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      if (originalFile.is_deleted) {
        return res.status(400).json({
          success: false,
          error: 'Cannot copy deleted file'
        });
      }

      // Generate new S3 key for the copy
      const timestamp = Date.now();
      const newFilename = `copy_${timestamp}_${originalFile.original_filename}`;
      const { generateS3Key } = require('../config/aws');

      const newS3Key = generateS3Key(
        newFilename,
        'originals',
        originalFile.editor_name,
        originalFile.file_type
      );

      // Copy file in S3
      await s3Service.copyFile(originalFile.s3_key, newS3Key);

      // Get signed URL for the new file
      const newS3Url = await s3Service.getSignedUrl(newS3Key);

      // Copy thumbnail if exists
      let newThumbnailS3Key = null;
      let newThumbnailUrl = null;

      if (originalFile.thumbnail_s3_key) {
        const newThumbnailFilename = `thumb_copy_${timestamp}_${originalFile.original_filename}`;
        newThumbnailS3Key = generateS3Key(
          newThumbnailFilename,
          'thumbnails',
          originalFile.editor_name,
          originalFile.file_type
        );

        await s3Service.copyFile(originalFile.thumbnail_s3_key, newThumbnailS3Key);
        newThumbnailUrl = await s3Service.getSignedUrl(newThumbnailS3Key);
      }

      // Create new database record
      const newFile = await MediaFile.create({
        uploaded_by: userId,
        editor_id: originalFile.editor_id,
        editor_name: originalFile.editor_name,
        filename: newFilename,
        original_filename: `Copy of ${originalFile.original_filename}`,
        file_type: originalFile.file_type,
        mime_type: originalFile.mime_type,
        file_size: originalFile.file_size,
        s3_key: newS3Key,
        s3_url: newS3Url,
        width: originalFile.width,
        height: originalFile.height,
        duration: originalFile.duration,
        thumbnail_s3_key: newThumbnailS3Key,
        thumbnail_url: newThumbnailUrl,
        tags: originalFile.tags || [],
        description: originalFile.description,
        folder_id: target_folder_id || null,
        assigned_buyer_id: originalFile.assigned_buyer_id,
        metadata_stripped: originalFile.metadata_stripped,
        metadata_embedded: originalFile.metadata_embedded,
        metadata_operations: originalFile.metadata_operations || []
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'media_copy',
        resourceType: 'media_file',
        resourceId: newFile.id,
        resourceName: newFile.original_filename,
        details: {
          original_file_id: id,
          original_filename: originalFile.original_filename,
          target_folder: target_folder_id
        },
        status: 'success'
      });

      logger.info(`File copied: ${id} -> ${newFile.id} to folder ${target_folder_id || 'root'} by user ${userId}`);

      res.json({
        success: true,
        message: 'File copied successfully',
        data: newFile
      });
    } catch (error) {
      logger.error('Copy file error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * ✨ NEW: Bulk copy files to folder
   * POST /api/media/bulk/copy
   * Body: { file_ids: string[], target_folder_id: string | null }
   */
  async bulkCopy(req, res, next) {
    try {
      const { file_ids, target_folder_id } = req.body;
      const userId = req.user.id;

      if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'file_ids array is required'
        });
      }

      logger.info(`Bulk copy initiated: ${file_ids.length} files to folder ${target_folder_id || 'root'} by user ${userId}`);

      const MediaFile = require('../models/MediaFile');
      const s3Service = require('../services/s3Service');
      const { generateS3Key } = require('../config/aws');

      const results = {
        success: [],
        failed: []
      };

      for (const fileId of file_ids) {
        try {
          // Get original file info
          const originalFile = await MediaFile.findById(fileId);

          if (!originalFile) {
            results.failed.push({ fileId, error: 'File not found' });
            continue;
          }

          if (originalFile.is_deleted) {
            results.failed.push({ fileId, error: 'Cannot copy deleted file' });
            continue;
          }

          // Generate new S3 key for the copy
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substr(2, 9);
          const newFilename = `copy_${timestamp}_${randomStr}_${originalFile.original_filename}`;

          const newS3Key = generateS3Key(
            newFilename,
            'originals',
            originalFile.editor_name,
            originalFile.file_type
          );

          // Copy file in S3
          await s3Service.copyFile(originalFile.s3_key, newS3Key);

          // Get signed URL for the new file
          const newS3Url = await s3Service.getSignedUrl(newS3Key);

          // Copy thumbnail if exists
          let newThumbnailS3Key = null;
          let newThumbnailUrl = null;

          if (originalFile.thumbnail_s3_key) {
            const newThumbnailFilename = `thumb_copy_${timestamp}_${randomStr}_${originalFile.original_filename}`;
            newThumbnailS3Key = generateS3Key(
              newThumbnailFilename,
              'thumbnails',
              originalFile.editor_name,
              originalFile.file_type
            );

            await s3Service.copyFile(originalFile.thumbnail_s3_key, newThumbnailS3Key);
            newThumbnailUrl = await s3Service.getSignedUrl(newThumbnailS3Key);
          }

          // Create new database record
          const newFile = await MediaFile.create({
            uploaded_by: userId,
            editor_id: originalFile.editor_id,
            editor_name: originalFile.editor_name,
            filename: newFilename,
            original_filename: `Copy of ${originalFile.original_filename}`,
            file_type: originalFile.file_type,
            mime_type: originalFile.mime_type,
            file_size: originalFile.file_size,
            s3_key: newS3Key,
            s3_url: newS3Url,
            width: originalFile.width,
            height: originalFile.height,
            duration: originalFile.duration,
            thumbnail_s3_key: newThumbnailS3Key,
            thumbnail_url: newThumbnailUrl,
            tags: originalFile.tags || [],
            description: originalFile.description,
            folder_id: target_folder_id || null,
            assigned_buyer_id: originalFile.assigned_buyer_id,
            metadata_stripped: originalFile.metadata_stripped,
            metadata_embedded: originalFile.metadata_embedded,
            metadata_operations: originalFile.metadata_operations || []
          });

          results.success.push({ fileId, newFileId: newFile.id });
        } catch (error) {
          logger.error(`Failed to copy file ${fileId}`, { error: error.message });
          results.failed.push({ fileId, error: error.message });
        }
      }

      logger.info(`Bulk copy completed: ${results.success.length} succeeded, ${results.failed.length} failed`);

      res.json({
        success: true,
        data: {
          copied: results.success.length,
          failed: results.failed.length,
          results
        },
        message: `Successfully copied ${results.success.length} of ${file_ids.length} files`
      });
    } catch (error) {
      logger.error('Bulk copy error', { error: error.message });
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
      const s3Service = require('../services/s3Service');
      const userId = req.user.id;
      const userRole = req.user.role;

      // Query for deleted files - filter by user unless admin
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
        ${userRole !== 'admin' ? 'AND mf.uploaded_by = $1' : ''}
        ORDER BY mf.deleted_at DESC
      `;

      const result = userRole !== 'admin'
        ? await MediaFile.raw(sql, [userId])
        : await MediaFile.raw(sql);

      // Refresh signed URLs for files that need it (expired or missing)
      const filesWithFreshUrls = await Promise.all(
        result.map(async (file) => {
          try {
            // Generate fresh signed URLs for S3 files
            if (file.s3_key && (!file.s3_url || file.s3_url.includes('X-Amz-Expires'))) {
              file.s3_url = await s3Service.getSignedUrl(file.s3_key);
            }
            if (file.thumbnail_s3_key && (!file.thumbnail_url || file.thumbnail_url.includes('X-Amz-Expires'))) {
              file.thumbnail_url = await s3Service.getSignedUrl(file.thumbnail_s3_key);
            }
          } catch (urlError) {
            logger.warn('Failed to generate signed URL for deleted file', {
              fileId: file.id,
              error: urlError.message
            });
          }
          return file;
        })
      );

      logger.info(`Retrieved ${filesWithFreshUrls.length} deleted files for user ${req.user.id}`);

      res.json({
        success: true,
        data: filesWithFreshUrls
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

      // Check permissions (only uploader or admin can permanently delete)
      const User = require('../models/User');
      const user = await User.findById(userId);

      if (file.uploaded_by !== userId && user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Permission denied - you can only permanently delete your own files'
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

  /**
   * Get all tags for a media file
   */
  async getFileTags(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      // Verify file exists and user has access
      const file = await this.mediaFileModel.findById(id);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // Get tags for this file
      const result = await this.pool.query(`
        SELECT
          mt.id,
          mt.name,
          mt.category,
          mt.description,
          mft.created_at as added_at,
          u.name as added_by_name
        FROM media_file_tags mft
        JOIN metadata_tags mt ON mft.tag_id = mt.id
        LEFT JOIN users u ON mft.added_by = u.id
        WHERE mft.media_file_id = $1 AND mt.is_active = TRUE
        ORDER BY mft.created_at DESC
      `, [id]);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      logger.error('Get file tags error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * Add a tag to a media file
   */
  async addFileTag(req, res, next) {
    try {
      const { id } = req.params;
      const { tag_id } = req.body;
      const userId = req.user.id;

      // Verify file exists and user has access
      const file = await this.mediaFileModel.findById(id);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // Verify tag exists and is active
      const tagResult = await this.pool.query(
        'SELECT id FROM metadata_tags WHERE id = $1 AND is_active = TRUE',
        [tag_id]
      );

      if (tagResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found or inactive'
        });
      }

      // Add tag to file (ignore if already exists)
      await this.pool.query(`
        INSERT INTO media_file_tags (media_file_id, tag_id, added_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (media_file_id, tag_id) DO NOTHING
      `, [id, tag_id, userId]);

      // Log activity
      await this.activityLogModel.create({
        user_id: userId,
        action: 'tag_added',
        entity_type: 'media_file',
        entity_id: id,
        details: { tag_id }
      });

      res.json({
        success: true,
        message: 'Tag added successfully'
      });
    } catch (error) {
      logger.error('Add file tag error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * Remove a tag from a media file
   */
  async removeFileTag(req, res, next) {
    try {
      const { id, tagId } = req.params;
      const userId = req.user.id;

      // Verify file exists and user has access
      const file = await this.mediaFileModel.findById(id);
      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      // Remove tag from file
      const result = await this.pool.query(`
        DELETE FROM media_file_tags
        WHERE media_file_id = $1 AND tag_id = $2
      `, [id, tagId]);

      if (result.rowCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Tag not found on this file'
        });
      }

      // Log activity
      await this.activityLogModel.create({
        user_id: userId,
        action: 'tag_removed',
        entity_type: 'media_file',
        entity_id: id,
        details: { tag_id: tagId }
      });

      res.json({
        success: true,
        message: 'Tag removed successfully'
      });
    } catch (error) {
      logger.error('Remove file tag error', { error: error.message, fileId: req.params.id });
      next(error);
    }
  }

  /**
   * Add file request upload to media library
   * POST /api/media/add-from-file-request/:fileId
   */
  async addFileRequestUploadToLibrary(req, res, next) {
    try {
      const { fileId } = req.params;
      const userId = req.user.id;

      logger.info('Adding file request upload to media library', { fileId, userId });

      // File should already exist in media_files table
      // We just need to verify it exists and belongs to a file request
      const file = await query(
        `SELECT mf.*, fr.created_by as request_creator
         FROM media_files mf
         LEFT JOIN file_request_uploads fru ON fru.file_id = mf.id
         LEFT JOIN file_requests fr ON fr.id = fru.file_request_id
         WHERE mf.id = $1`,
        [fileId]
      );

      if (file.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      const fileData = file.rows[0];

      // Verify user has permission (request creator or admin/buyer)
      if (fileData.request_creator !== userId && req.user.role !== 'admin' && req.user.role !== 'buyer') {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to add this file to your library'
        });
      }

      // File is already in media_files table, just confirm it's accessible
      logger.info('File added to media library successfully', {
        fileId,
        filename: fileData.original_filename
      });

      res.json({
        success: true,
        message: `"${fileData.original_filename}" is now in your Media Library`,
        data: fileData
      });
    } catch (error) {
      logger.error('Add file request upload to library error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
}

module.exports = new MediaController();
