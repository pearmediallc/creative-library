const MediaFile = require('../models/MediaFile');
const User = require('../models/User');
const Editor = require('../models/Editor');
const s3Service = require('./s3Service');
const logger = require('../utils/logger');

class MediaService {
  /**
   * Upload media file
   * @param {Object} file - File object from multer
   * @param {string} userId - User ID
   * @param {string} editorId - Selected editor ID
   * @param {Object} metadata - Additional metadata (tags, description)
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

      // Check user upload limit
      const hasReachedLimit = await User.hasReachedUploadLimit(userId);
      if (hasReachedLimit) {
        throw new Error('Monthly upload limit reached');
      }

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

      // Get editor details
      const editor = await Editor.findById(editorId);
      if (!editor) {
        throw new Error('Editor not found');
      }

      console.log(`✅ Editor Found: ${editor.name} (ID: ${editorId})`);
      console.log('\n📤 Uploading to S3 with HYBRID STRUCTURE...');

      // Upload original file to S3 with NEW HYBRID STRUCTURE
      const uploadResult = await s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'originals',
        editor.name,  // ✨ NEW: Pass editor name for hybrid structure
        mediaType     // ✨ NEW: Pass media type for hybrid structure
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

        // Generate thumbnail with NEW HYBRID STRUCTURE
        const thumbnailResult = await s3Service.generateThumbnail(
          file.buffer,
          file.originalname,
          editor.name  // ✨ NEW: Pass editor name for hybrid structure
        );
        if (thumbnailResult) {
          thumbnailUrl = `${process.env.AWS_CLOUDFRONT_URL}/${thumbnailResult.s3Key}`;
          console.log(`  └─ Thumbnail URL: ${thumbnailUrl}`);
        }
      } else if (mediaType === 'video') {
        console.log('\n🎥 Processing video...');

        // Generate video thumbnail with NEW HYBRID STRUCTURE
        console.log('  └─ Generating video thumbnail...');
        const thumbnailResult = await s3Service.generateVideoThumbnail(
          file.buffer,
          file.originalname,
          editor.name  // ✨ NEW: Pass editor name for hybrid structure
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

      // Create database record matching schema
      const mediaFile = await MediaFile.createMediaFile({
        uploaded_by: userId,
        editor_id: editorId,
        editor_name: editor.name,
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
        description: metadata.description || null
      });

      console.log('✅ Database record created successfully');
      console.log(`  └─ Media File ID: ${mediaFile.id}`);
      console.log(`  └─ S3 Key: ${uploadResult.s3Key}`);
      console.log(`  └─ Structure Type: ${(editor.name && mediaType) ? 'NEW HYBRID' : 'OLD FALLBACK'}`);

      logger.info('Media file uploaded successfully', {
        mediaFileId: mediaFile.id,
        userId,
        editorId,
        editorName: editor.name,
        s3Key: uploadResult.s3Key,
        structureType: 'NEW_HYBRID'
      });

      console.log('🎉 ========== MEDIA UPLOAD COMPLETE ==========\n');

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
   * @returns {Promise<Object>} Media files with pagination info
   */
  async getMediaFiles(filters = {}, userId = null) {
    try {
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

      // Get total count for pagination
      const totalCount = await MediaFile.count({
        is_deleted: false,
        ...(filters.uploaded_by && { uploaded_by: filters.uploaded_by }),
        ...(filters.editor_id && { editor_id: filters.editor_id }),
        ...(filters.media_type && { file_type: filters.media_type })
      });

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
   * @returns {Promise<Object>} Storage stats
   */
  async getStorageStats() {
    try {
      return await MediaFile.getStorageStats();
    } catch (error) {
      logger.error('Get storage stats failed', { error: error.message });
      throw new Error('Failed to retrieve storage statistics');
    }
  }
}

module.exports = new MediaService();
