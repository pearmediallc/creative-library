const { s3Client, getPresignedDownloadUrl, generateS3Key } = require('../config/aws');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const path = require('path');
const logger = require('../utils/logger');

const S3_BUCKET = process.env.AWS_S3_BUCKET;

class S3Service {
  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} filename - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - S3 folder (default: 'originals')
   * @returns {Promise<Object>} Upload result with s3Key
   */
  async uploadFile(fileBuffer, filename, mimeType, folder = 'originals') {
    try {
      const s3Key = generateS3Key(filename, folder);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(command);

      logger.info('File uploaded to S3', { s3Key, bucket: S3_BUCKET });

      return {
        s3Key,
        s3Bucket: S3_BUCKET,
        fileSize: fileBuffer.length
      };
    } catch (error) {
      logger.error('S3 upload error', { error: error.message, filename });
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail for image
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {string} originalFilename - Original filename
   * @returns {Promise<Object>} Thumbnail upload result
   */
  async generateThumbnail(imageBuffer, originalFilename) {
    try {
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbnailFilename = `thumb_${originalFilename}`;
      const result = await this.uploadFile(
        thumbnailBuffer,
        thumbnailFilename,
        'image/jpeg',
        'thumbnails'
      );

      logger.info('Thumbnail generated', { thumbnailKey: result.s3Key });

      return result;
    } catch (error) {
      logger.warn('Thumbnail generation failed', { error: error.message });
      // Non-critical error - return null
      return null;
    }
  }

  /**
   * Get image dimensions
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} Dimensions {width, height}
   */
  async getImageDimensions(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      logger.warn('Failed to get image dimensions', { error: error.message });
      return null;
    }
  }

  /**
   * Get file download URL (presigned)
   * @param {string} s3Key - S3 object key
   * @param {number} expiresIn - URL expiry in seconds (default: 3600)
   * @returns {Promise<string>} Presigned download URL
   */
  async getDownloadUrl(s3Key, expiresIn = 3600) {
    try {
      // Note: getPresignedDownloadUrl from config only takes s3Key
      return await getPresignedDownloadUrl(s3Key);
    } catch (error) {
      logger.error('Failed to generate download URL', { error: error.message, s3Key });
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Delete file from S3
   * @param {string} s3Key - S3 object key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(s3Key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });

      await s3Client.send(command);

      logger.info('File deleted from S3', { s3Key });
      return true;
    } catch (error) {
      logger.error('S3 delete error', { error: error.message, s3Key });
      return false;
    }
  }

  /**
   * Determine media type from MIME type
   * @param {string} mimeType - File MIME type
   * @returns {string} Media type: 'image', 'video', or 'other'
   */
  getMediaType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    return 'other';
  }

  /**
   * Validate file type
   * @param {string} mimeType - File MIME type
   * @returns {boolean} Is valid
   */
  isValidFileType(mimeType) {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm'
    ];

    return allowedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Validate file size
   * @param {number} fileSize - File size in bytes
   * @param {string} mediaType - Media type (image, video, other)
   * @returns {Object} Validation result
   */
  validateFileSize(fileSize, mediaType) {
    const limits = {
      image: 10 * 1024 * 1024,  // 10MB for images
      video: 500 * 1024 * 1024, // 500MB for videos
      other: 50 * 1024 * 1024   // 50MB for other files
    };

    const limit = limits[mediaType] || limits.other;

    if (fileSize > limit) {
      return {
        valid: false,
        error: `File size exceeds ${this._formatBytes(limit)} limit for ${mediaType} files`
      };
    }

    return { valid: true };
  }

  /**
   * Format bytes to human-readable string
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new S3Service();
