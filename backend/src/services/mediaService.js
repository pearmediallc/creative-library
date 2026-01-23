const MediaFile = require('../models/MediaFile');
const User = require('../models/User');
const Editor = require('../models/Editor');
const s3Service = require('./s3Service');
const metadataService = require('./metadataService');
const logger = require('../utils/logger');
const archiver = require('archiver');
const https = require('https');
const http = require('http');

class MediaService {
  /**
   * Upload media file
   * @param {Object} file - File object from multer
   * @param {string} userId - User ID
   * @param {string} editorId - Selected editor ID
   * @param {Object} metadata - Additional metadata (tags, description, folder_id, organize_by_date, assigned_buyer_id, request_id)
   * @returns {Promise<Object>} Created media file record
   */
  async uploadMedia(file, userId, editorId, metadata = {}) {
    try {
      console.log('\n🚀 ========== MEDIA UPLOAD START ==========');
      console.log('📋 Upload Details:');
      console.log(`  └─ User ID: ${userId}`);
      console.log(`  └─ Editor ID: ${editorId}`);
      console.log(`  └─ Filename: ${file.originalname}`);
      console.log(`  └─ MIME Type: ${file.mimetype}`);
      console.log(`  └─ File Size: ${file.size} bytes`);
      console.log(`  └─ Folder ID: ${metadata.folder_id || 'None (root level)'}`);
      console.log(`  └─ Organize by Date: ${metadata.organize_by_date ? 'Yes' : 'No'}`);
      console.log(`  └─ Assigned Buyer: ${metadata.assigned_buyer_id || 'None'}`);

      // REMOVED: Upload limit check disabled per user request
      // Users should have unlimited uploads for their workflow
      // const hasReachedLimit = await User.hasReachedUploadLimit(userId);
      // if (hasReachedLimit) {
      //   throw new Error('Monthly upload limit reached');
      // }

      // Validate file type
      if (!s3Service.isValidFileType(file.mimetype)) {
        throw new Error(`Unsupported file type: ${file.mimetype}`);
      }

      const mediaType = s3Service.getMediaType(file.mimetype);
      console.log(`📁 Media Type Detected: ${mediaType}`);

      // Validate file size
      const sizeValidation = s3Service.validateFileSize(file.size, mediaType);
      if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error);
      }

      // Get editor details (optional for public uploads)
      let editor = null;
      if (editorId) {
        editor = await Editor.findById(editorId);
        if (!editor) {
          throw new Error('Editor not found');
        }
        console.log(`✅ Editor Found: ${editor.name} (ID: ${editorId})`);
      } else {
        console.log(`ℹ️ No editor specified (public upload)`);
      }

      // ✨ NEW: Handle folder path for organized storage
      let folderPath = null;
      let targetFolderId = metadata.folder_id;

      // 📝 PRIORITY: Use s3_folder_path if provided from controller (folder upload)
      if (metadata.s3_folder_path) {
        console.log('\n📁 Using provided S3 folder path from controller...');
        folderPath = metadata.s3_folder_path;
        console.log(`  └─ S3 Folder Path: ${folderPath}`);
      }
      // If organize_by_date is true, create date-based folder structure
      else if (metadata.organize_by_date) {
        console.log('\n📅 Creating date-based folder structure...');
        const Folder = require('../models/Folder');
        const folderController = require('../controllers/folderController');

        // Create or get date folder (jan2024/15-jan/)
        const date = new Date();
        const monthName = date.toLocaleString('en-US', { month: 'short' }).toLowerCase();
        const year = date.getFullYear();
        const monthFolderName = `${monthName}${year}`;
        const day = String(date.getDate()).padStart(2, '0');
        const dayFolderName = `${day}-${monthName}`;

        // Find or create month folder
        let monthFolder = await folderController.findOrCreateFolder(
          monthFolderName,
          metadata.folder_id || null,  // Parent folder (or null for root)
          userId,
          'date'
        );

        // Find or create day folder
        let dayFolder = await folderController.findOrCreateFolder(
          dayFolderName,
          monthFolder.id,
          userId,
          'date'
        );

        targetFolderId = dayFolder.id;
        folderPath = dayFolder.s3_path;
        console.log(`  └─ Created/Found folder: ${folderPath}`);
      } else if (targetFolderId) {
        // Get folder path from database
        console.log('\n📁 Fetching folder path from database...');
        const Folder = require('../models/Folder');
        const folder = await Folder.findById(targetFolderId);
        if (folder) {
          folderPath = folder.s3_path;
          console.log(`  └─ Folder path: ${folderPath}`);
        }
      }

      console.log('\n📤 Uploading to S3 with HYBRID STRUCTURE...');

      // Upload original file to S3 with NEW HYBRID STRUCTURE + FOLDER SUPPORT
      const uploadResult = await s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'originals',
        editor?.name || 'public-upload',  // ✨ NEW: Pass editor name for hybrid structure (or 'public-upload' if no editor)
        mediaType,    // ✨ NEW: Pass media type for hybrid structure
        {
          folderPath,           // ✨ NEW: Pass folder path for organized storage
          requestId: metadata.request_id  // ✨ NEW: Pass request ID for file request uploads
        }
      );

      // Generate S3 URL
      const s3Url = `${process.env.AWS_CLOUDFRONT_URL}/${uploadResult.s3Key}`;

      console.log(`\n🌐 CloudFront URL Generated: ${s3Url}`);

      // Process based on media type
      let width = null;
      let height = null;
      let thumbnailUrl = null;

      if (mediaType === 'image') {
        console.log('\n🖼️ Processing image...');

        // Get image dimensions
        const dimensions = await s3Service.getImageDimensions(file.buffer);
        width = dimensions?.width || null;
        height = dimensions?.height || null;

        console.log(`  └─ Dimensions: ${width}x${height}`);

        // Generate thumbnail with NEW HYBRID STRUCTURE + FOLDER SUPPORT
        const thumbnailResult = await s3Service.generateThumbnail(
          file.buffer,
          file.originalname,
          editor?.name || 'public-upload',  // ✨ NEW: Pass editor name for hybrid structure
          folderPath    // ✨ NEW: Pass folder path for organized storage
        );
        if (thumbnailResult) {
          thumbnailUrl = `${process.env.AWS_CLOUDFRONT_URL}/${thumbnailResult.s3Key}`;
          console.log(`  └─ Thumbnail URL: ${thumbnailUrl}`);
        }
      } else if (mediaType === 'video') {
        console.log('\n🎥 Processing video...');

        // Generate video thumbnail with NEW HYBRID STRUCTURE + FOLDER SUPPORT
        console.log('  └─ Generating video thumbnail...');
        const thumbnailResult = await s3Service.generateVideoThumbnail(
          file.buffer,
          file.originalname,
          editor?.name || 'public-upload',  // ✨ NEW: Pass editor name for hybrid structure
          folderPath    // ✨ NEW: Pass folder path for organized storage
        );
        if (thumbnailResult) {
          thumbnailUrl = `${process.env.AWS_CLOUDFRONT_URL}/${thumbnailResult.s3Key}`;
          console.log(`  └─ Video thumbnail URL: ${thumbnailUrl}`);
        } else {
          console.log('  └─ Video thumbnail generation skipped or failed');
        }
      }

      // Determine file type (image/video)
      const fileType = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : 'other';

      console.log('\n💾 Creating database record...');

      // Get metadata operations from request (if any)
      const metadataOps = metadata.metadataOperations || {};

      // Create database record matching schema
      const mediaFile = await MediaFile.createMediaFile({
        uploaded_by: userId,
        editor_id: editorId,
        editor_name: editor?.name || 'public-upload',
        filename: uploadResult.filename || file.originalname,
        original_filename: file.originalname,
        file_type: fileType,
        mime_type: file.mimetype,
        file_size: file.size,
        s3_key: uploadResult.s3Key,
        s3_url: s3Url,
        width,
        height,
        duration: null,
        thumbnail_url: thumbnailUrl,
        tags: metadata.tags || [],
        description: metadata.description || null,
        // ✨ NEW: Folder and buyer assignment
        folder_id: targetFolderId || null,
        assigned_buyer_id: metadata.assigned_buyer_id || null,
        // ✨ CHANGED: File request uploads should be visible in media library
        // They are already in the correct folder, no need to hide them
        is_deleted: false,
        // ✨ NEW: Metadata tracking fields
        metadata_stripped: metadataOps.removed || false,
        metadata_embedded: metadataOps.added ? {
          creator_id: editor?.name || 'public-upload',
          timestamp: new Date().toISOString(),
          tags: metadata.tags || [],
          description: metadata.description || null
        } : null,
        metadata_operations: metadataOps.operations || []
      });

      console.log('✅ Database record created successfully');
      console.log(`  └─ Media File ID: ${mediaFile.id}`);
      console.log(`  └─ S3 Key: ${uploadResult.s3Key}`);
      console.log(`  └─ Folder ID: ${targetFolderId || 'NULL (root)'}`);
      console.log(`  └─ S3 Folder Path: ${folderPath || 'NULL (root)'}`);
      console.log(`  └─ Is File Request Upload: ${metadata.is_file_request_upload === true}`);
      console.log(`  └─ Is Deleted (visible in library): FALSE`);
      console.log(`  └─ Structure Type: ${(editor?.name && mediaType) ? 'NEW HYBRID' : 'OLD FALLBACK'}`);

      logger.info('Media file uploaded successfully', {
        mediaFileId: mediaFile.id,
        userId,
        editorId,
        editorName: editor?.name || 'public-upload',
        s3Key: uploadResult.s3Key,
        structureType: 'NEW_HYBRID',
        isDeleted: false
      });

      console.log('🎉 ========== MEDIA UPLOAD COMPLETE ==========\n');

      // ✨ NEW: Auto-grant permissions for file request assigned buyer
      if (metadata.assigned_buyer_id && mediaFile.id) {
        try {
          const FilePermission = require('../models/FilePermission');
          await FilePermission.grantPermission({
            resource_type: 'file',
            resource_id: mediaFile.id,
            grantee_type: 'user',
            grantee_id: metadata.assigned_buyer_id,
            permission_type: 'view',
            granted_by: userId,
            expires_at: null
          });
          await FilePermission.grantPermission({
            resource_type: 'file',
            resource_id: mediaFile.id,
            grantee_type: 'user',
            grantee_id: metadata.assigned_buyer_id,
            permission_type: 'download',
            granted_by: userId,
            expires_at: null
          });
          console.log(`✅ Auto-granted view+download permissions to buyer ${metadata.assigned_buyer_id}`);
          logger.info('Auto-granted permissions for file request', {
            mediaFileId: mediaFile.id,
            buyerId: metadata.assigned_buyer_id,
            creatorId: userId
          });
        } catch (permError) {
          logger.error('Failed to auto-grant permissions', {
            error: permError.message,
            mediaFileId: mediaFile.id,
            buyerId: metadata.assigned_buyer_id
          });
          // Don't fail the upload if permission creation fails
        }
      }

      return mediaFile;
    } catch (error) {
      console.error('\n❌ ========== MEDIA UPLOAD FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('===========================================\n');
      logger.error('Media upload failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get media files with filters and presigned URLs
   * @param {Object} filters - Filter options
   * @param {string} userId - Requesting user ID (optional, for permission check)
   * @param {string} userRole - User role (for access control)
   * @returns {Promise<Object>} Media files with pagination info
   */
  async getMediaFiles(filters = {}, userId = null, userRole = null) {
    try {
      // IMPORTANT: Role-based access control for media files
      // - Admins can see all content (for system management)
      // - Buyers can see all content (they need to review all submissions)
      // - All other users (editors, creatives, etc.) can only see their own uploads
      if (userRole !== 'admin' && userRole !== 'buyer') {
        filters.uploaded_by = userId;
        logger.info('Non-admin/buyer user - restricting to own uploads', { userId, userRole });
      } else {
        logger.info('Admin/Buyer user - showing all files', { userId, userRole });
      }

      // Get media files
      logger.info('getMediaFiles called with filters:', filters);
      const mediaFiles = await MediaFile.findWithFilters(filters);
      logger.info(`Found ${mediaFiles?.length || 0} media files`);

      // If no files, return empty result early
      if (!mediaFiles || mediaFiles.length === 0) {
        logger.warn('No media files found, returning empty array');
        return {
          files: [],
          pagination: {
            total: 0,
            limit: filters.limit || 50,
            offset: filters.offset || 0,
            hasMore: false
          }
        };
      }

      // Use CloudFront URLs stored in database (no presigned URL generation needed)
      const mediaFilesWithUrls = mediaFiles.map((file) => {
        return {
          ...file,
          download_url: file.s3_url, // CloudFront URL already in database
          thumbnail_url: file.thumbnail_url // CloudFront URL already in database
        };
      });

      // Get total count for pagination (using same filters as results)
      const totalCount = await MediaFile.countWithFilters(filters);

      return {
        files: mediaFilesWithUrls,
        pagination: {
          total: totalCount,
          limit: filters.limit || 50,
          offset: filters.offset || 0,
          hasMore: (filters.offset || 0) + mediaFilesWithUrls.length < totalCount
        }
      };
    } catch (error) {
      logger.error('Get media files failed', { error: error.message, stack: error.stack, filters });
      throw new Error('Failed to retrieve media files');
    }
  }

  /**
   * Get single media file with URL
   * @param {string} mediaFileId - Media file ID
   * @returns {Promise<Object>} Media file with download URL
   */
  async getMediaFile(mediaFileId) {
    try {
      const mediaFile = await MediaFile.findById(mediaFileId);

      if (!mediaFile) {
        throw new Error('Media file not found');
      }

      if (mediaFile.is_deleted) {
        throw new Error('Media file has been deleted');
      }

      // Use CloudFront URLs from database
      return {
        ...mediaFile,
        download_url: mediaFile.s3_url,
        thumbnail_url: mediaFile.thumbnail_url
      };
    } catch (error) {
      logger.error('Get media file failed', { error: error.message, mediaFileId });
      throw error;
    }
  }

  /**
   * Update media file metadata
   * @param {string} mediaFileId - Media file ID
   * @param {string} userId - User ID (for permission check)
   * @param {Object} updates - Fields to update (tags, description, editor_id)
   * @returns {Promise<Object>} Updated media file
   */
  async updateMediaFile(mediaFileId, userId, updates) {
    try {
      const mediaFile = await MediaFile.findById(mediaFileId);

      if (!mediaFile) {
        throw new Error('Media file not found');
      }

      // Check ownership (only uploader or admin can update)
      const user = await User.findById(userId);
      if (mediaFile.user_id !== userId && user.role !== 'admin') {
        throw new Error('Permission denied');
      }

      // Only allow updating specific fields
      const allowedUpdates = {};
      if (updates.tags !== undefined) allowedUpdates.tags = updates.tags;
      if (updates.description !== undefined) allowedUpdates.description = updates.description;
      if (updates.editor_id !== undefined) allowedUpdates.editor_id = updates.editor_id;

      const updatedFile = await MediaFile.update(mediaFileId, allowedUpdates);

      logger.info('Media file updated', { mediaFileId, userId, updates: allowedUpdates });

      return updatedFile;
    } catch (error) {
      logger.error('Update media file failed', { error: error.message, mediaFileId });
      throw error;
    }
  }

  /**
   * Delete media file (soft delete)
   * @param {string} mediaFileId - Media file ID
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<boolean>} Success status
   */
  async deleteMediaFile(mediaFileId, userId) {
    try {
      const mediaFile = await MediaFile.findById(mediaFileId);

      if (!mediaFile) {
        throw new Error('Media file not found');
      }

      // Check ownership (only uploader or admin can delete)
      const user = await User.findById(userId);
      if (mediaFile.user_id !== userId && user.role !== 'admin') {
        throw new Error('Permission denied');
      }

      // Soft delete in database
      await MediaFile.softDelete(mediaFileId, userId);

      // Optional: Delete from S3 (can be done async/batch)
      // await s3Service.deleteFile(mediaFile.s3_key);
      // if (mediaFile.thumbnail_s3_key) {
      //   await s3Service.deleteFile(mediaFile.thumbnail_s3_key);
      // }

      logger.info('Media file deleted', { mediaFileId, userId });

      return true;
    } catch (error) {
      logger.error('Delete media file failed', { error: error.message, mediaFileId });
      throw error;
    }
  }

  /**
   * Get storage statistics
   * @param {string} userId - User ID
   * @param {string} userRole - User role (admin, buyer, creative, etc.)
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats(userId, userRole) {
    try {
      return await MediaFile.getStorageStats(userId, userRole);
    } catch (error) {
      logger.error('Get storage stats failed', { error: error.message });
      throw new Error('Failed to retrieve storage statistics');
    }
  }

  /**
   * ✨ NEW: Extract metadata from file
   * @param {string} fileId - Media file ID
   * @returns {Promise<Object>} Extracted metadata
   */
  async extractMetadata(fileId) {
    try {
      const file = await MediaFile.findById(fileId);
      if (!file) {
        throw new Error('Media file not found');
      }

      logger.info(`Extracting metadata for file: ${file.original_filename}`);

      // Download file from S3 to buffer
      const fileBuffer = await s3Service.downloadToBuffer(file.s3_key);

      let metadata = {};

      if (file.file_type === 'image') {
        metadata = await metadataService.extractImageMetadata(fileBuffer);
      } else if (file.file_type === 'video') {
        // For videos, we need to save to temp file for ffprobe
        metadata = await metadataService.extractVideoMetadata(fileBuffer);
      }

      logger.info(`Extracted ${Object.keys(metadata).length} metadata fields`);

      return metadata;

    } catch (error) {
      logger.error('Extract metadata failed', { error: error.message, fileId });
      throw error;
    }
  }

  /**
   * ✨ NEW: Create ZIP archive of multiple files
   * @param {Array<string>} fileIds - Array of media file IDs
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<Stream>} ZIP archive stream
   */
  async createBulkZip(fileIds, userId) {
    try {
      logger.info(`Creating ZIP for ${fileIds.length} files`);

      // Get all files
      const files = await MediaFile.findByIds(fileIds);

      if (files.length === 0) {
        throw new Error('No files found');
      }

      if (files.length !== fileIds.length) {
        logger.warn(`Only ${files.length} of ${fileIds.length} files found`);
      }

      // Create archive
      const archive = archiver('zip', {
        zlib: { level: 6 } // Compression level
      });

      // Handle errors
      archive.on('error', (err) => {
        logger.error('Archive error', { error: err.message });
        throw err;
      });

      // Process files sequentially to avoid memory issues
      let addedCount = 0;

      for (const file of files) {
        try {
          logger.info(`Adding to ZIP: ${file.original_filename}`);

          // Get signed URL or use CloudFront URL
          const fileUrl = file.s3_url || await s3Service.getSignedUrl(file.s3_key);

          // Download file as stream
          const protocol = fileUrl.startsWith('https') ? https : http;

          await new Promise((resolve, reject) => {
            protocol.get(fileUrl, (response) => {
              if (response.statusCode !== 200) {
                logger.warn(`Failed to download ${file.original_filename}: ${response.statusCode}`);
                resolve(); // Skip this file
                return;
              }

              // Add file to archive with original filename
              archive.append(response, { name: file.original_filename });
              addedCount++;

              response.on('end', resolve);
              response.on('error', (err) => {
                logger.error(`Error downloading ${file.original_filename}`, { error: err.message });
                resolve(); // Skip this file
              });
            }).on('error', (err) => {
              logger.error(`HTTP error for ${file.original_filename}`, { error: err.message });
              resolve(); // Skip this file
            });
          });

        } catch (fileError) {
          logger.error(`Error adding file to ZIP: ${file.original_filename}`, { error: fileError.message });
          // Continue with other files
        }
      }

      logger.info(`Added ${addedCount} files to ZIP`);

      // Finalize the archive
      archive.finalize();

      return archive;

    } catch (error) {
      logger.error('Create ZIP failed', { error: error.message });
      throw new Error('Failed to create ZIP archive');
    }
  }
}

module.exports = new MediaService();
