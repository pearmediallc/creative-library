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

      // Upload original file to S3
      const uploadResult = await s3Service.uploadFile(
        file.buffer,
        file.originalname,
        file.mimetype,
        'originals'
      );

      // Generate S3 URL
      const s3Url = `${process.env.AWS_CLOUDFRONT_URL}/${uploadResult.s3Key}`;

      // Process based on media type
      let width = null;
      let height = null;
      let thumbnailUrl = null;

      if (mediaType === 'image') {
        // Get image dimensions
        const dimensions = await s3Service.getImageDimensions(file.buffer);
        width = dimensions?.width || null;
        height = dimensions?.height || null;

        // Generate thumbnail
        const thumbnailResult = await s3Service.generateThumbnail(
          file.buffer,
          file.originalname
        );
        if (thumbnailResult) {
          thumbnailUrl = `${process.env.AWS_CLOUDFRONT_URL}/${thumbnailResult.s3Key}`;
        }
      }

      // Determine file type (image/video)
      const fileType = mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : 'other';

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

      logger.info('Media file uploaded successfully', {
        mediaFileId: mediaFile.id,
        userId,
        editorId,
        s3Key: uploadResult.s3Key
      });

      return mediaFile;
    } catch (error) {
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
      const mediaFiles = await MediaFile.findWithFilters(filters);

      // If no files, return empty result early
      if (!mediaFiles || mediaFiles.length === 0) {
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

      // Generate presigned URLs for each file
      const mediaFilesWithUrls = await Promise.all(
        mediaFiles.map(async (file) => {
          let downloadUrl = null;
          let thumbnailUrl = null;

          try {
            downloadUrl = await s3Service.getDownloadUrl(file.s3_key);
            if (file.thumbnail_s3_key) {
              thumbnailUrl = await s3Service.getDownloadUrl(file.thumbnail_s3_key);
            }
          } catch (error) {
            logger.warn('Failed to generate presigned URL', { error: error.message, fileId: file.id });
            // Continue without URLs if S3 is not configured
          }

          return {
            ...file,
            download_url: downloadUrl,
            thumbnail_url: thumbnailUrl
          };
        })
      );

      // Get total count for pagination
      const totalCount = await MediaFile.count({
        deleted_at: null,
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.editor_id && { editor_id: filters.editor_id }),
        ...(filters.media_type && { media_type: filters.media_type })
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

      if (mediaFile.deleted_at) {
        throw new Error('Media file has been deleted');
      }

      // Generate presigned URLs
      const downloadUrl = await s3Service.getDownloadUrl(mediaFile.s3_key);

      let thumbnailUrl = null;
      if (mediaFile.thumbnail_s3_key) {
        thumbnailUrl = await s3Service.getDownloadUrl(mediaFile.thumbnail_s3_key);
      }

      return {
        ...mediaFile,
        download_url: downloadUrl,
        thumbnail_url: thumbnailUrl
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
