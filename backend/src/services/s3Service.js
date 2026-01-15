const { s3Client, getPresignedDownloadUrl, generateS3Key } = require('../config/aws');
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const logger = require('../utils/logger');

const S3_BUCKET = process.env.AWS_S3_BUCKET;

class S3Service {
  /**
   * Upload file to S3 with hybrid structure support
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} filename - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - S3 folder (default: 'originals')
   * @param {string|null} editorName - Editor name for new structure (optional)
   * @param {string|null} mediaType - Media type for new structure (optional)
   * @param {string|null} folderPath - Folder path from database (optional, e.g., "jan2024/15-jan")
   * @returns {Promise<Object>} Upload result with s3Key
   */
  async uploadFile(fileBuffer, filename, mimeType, folder = 'originals', editorName = null, mediaType = null, folderPath = null) {
    try {
      console.log('📤 S3Service.uploadFile called with:');
      console.log(`  └─ Filename: ${filename}`);
      console.log(`  └─ MIME Type: ${mimeType}`);
      console.log(`  └─ Folder: ${folder}`);
      console.log(`  └─ Editor Name: ${editorName || 'NOT PROVIDED (will use old structure)'}`);
      console.log(`  └─ Media Type: ${mediaType || 'NOT PROVIDED (will use old structure)'}`);
      console.log(`  └─ Folder Path: ${folderPath || 'NOT PROVIDED'}`);

      // Generate S3 key using hybrid structure with folder path support
      const s3Key = generateS3Key(filename, folder, editorName, mediaType, folderPath);

      console.log(`🔑 Generated S3 Key: ${s3Key}`);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(command);

      console.log(`✅ File uploaded successfully to S3`);
      console.log(`  └─ Bucket: ${S3_BUCKET}`);
      console.log(`  └─ Key: ${s3Key}`);
      console.log(`  └─ Size: ${fileBuffer.length} bytes`);

      logger.info('File uploaded to S3', {
        s3Key,
        bucket: S3_BUCKET,
        editorName: editorName || 'none',
        mediaType: mediaType || 'none',
        structureType: (editorName && mediaType) ? 'NEW_HYBRID' : 'OLD_FALLBACK'
      });

      return {
        s3Key,
        s3Bucket: S3_BUCKET,
        fileSize: fileBuffer.length,
        filename: filename
      };
    } catch (error) {
      console.error('❌ S3 upload failed:', error.message);
      logger.error('S3 upload error', { error: error.message, filename, editorName, mediaType });
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Generate thumbnail for image with hybrid structure support
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {string} originalFilename - Original filename
   * @param {string|null} editorName - Editor name for new structure (optional)
   * @param {string|null} folderPath - Folder path from database (optional)
   * @returns {Promise<Object>} Thumbnail upload result
   */
  async generateThumbnail(imageBuffer, originalFilename, editorName = null, folderPath = null) {
    try {
      console.log('🖼️ Generating thumbnail for:', originalFilename);
      console.log(`  └─ Editor: ${editorName || 'NOT PROVIDED (will use old structure)'}`);

      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(300, 300, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      console.log(`✅ Thumbnail buffer created (${thumbnailBuffer.length} bytes)`);

      const thumbnailFilename = `thumb_${originalFilename}`;

      // Upload thumbnail using new structure if editor name provided
      // Pass 'image' as mediaType since thumbnails are always images
      const result = await this.uploadFile(
        thumbnailBuffer,
        thumbnailFilename,
        'image/jpeg',
        'thumbnails',
        editorName,      // Pass editor name for hybrid structure
        'image',         // Thumbnails are always images
        folderPath       // Pass folder path for organized storage
      );

      console.log(`✅ Thumbnail uploaded successfully`);
      console.log(`  └─ Thumbnail Key: ${result.s3Key}`);

      logger.info('Thumbnail generated', {
        thumbnailKey: result.s3Key,
        editorName: editorName || 'none',
        structureType: editorName ? 'NEW_HYBRID' : 'OLD_FALLBACK'
      });

      return result;
    } catch (error) {
      console.warn('⚠️ Thumbnail generation failed:', error.message);
      logger.warn('Thumbnail generation failed', { error: error.message, editorName });
      // Non-critical error - return null
      return null;
    }
  }

  /**
   * Generate thumbnail for video
   * @param {Buffer} videoBuffer - Original video buffer
   * @param {string} originalFilename - Original filename
   * @param {string|null} editorName - Editor name for new structure (optional)
   * @param {string|null} folderPath - Folder path from database (optional)
   * @returns {Promise<Object>} Thumbnail upload result
   */
  async generateVideoThumbnail(videoBuffer, originalFilename, editorName = null, folderPath = null) {
    let tempVideoPath = null;
    let tempThumbnailPath = null;

    try {
      console.log('🎥 Generating video thumbnail for:', originalFilename);
      console.log(`  └─ Editor: ${editorName || 'NOT PROVIDED (will use old structure)'}`);

      // Create temporary directory
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const videoExt = path.extname(originalFilename);
      tempVideoPath = path.join(tempDir, `video_${timestamp}${videoExt}`);
      tempThumbnailPath = path.join(tempDir, `thumb_${timestamp}.jpg`);

      console.log(`📝 Writing video to temp file: ${tempVideoPath}`);
      // Write video buffer to temporary file
      await fs.writeFile(tempVideoPath, videoBuffer);

      console.log(`🎬 Extracting frame from video using ffmpeg...`);
      // Extract frame at 1 second using ffmpeg
      await new Promise((resolve, reject) => {
        ffmpeg(tempVideoPath)
          .screenshots({
            timestamps: ['00:00:01.000'],
            filename: path.basename(tempThumbnailPath),
            folder: tempDir,
            size: '300x?'  // Width 300, auto height to maintain aspect ratio
          })
          .on('end', () => {
            console.log(`✅ Frame extracted successfully`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`❌ FFmpeg error: ${err.message}`);
            reject(err);
          });
      });

      // Read the generated thumbnail
      console.log(`📖 Reading generated thumbnail: ${tempThumbnailPath}`);
      const thumbnailBuffer = await fs.readFile(tempThumbnailPath);

      console.log(`✅ Thumbnail buffer created (${thumbnailBuffer.length} bytes)`);

      const thumbnailFilename = `thumb_${originalFilename.replace(videoExt, '.jpg')}`;

      // Upload thumbnail using new structure if editor name provided
      const result = await this.uploadFile(
        thumbnailBuffer,
        thumbnailFilename,
        'image/jpeg',
        'thumbnails',
        editorName,      // Pass editor name for hybrid structure
        'video',         // Mark as video thumbnail
        folderPath       // Pass folder path for organized storage
      );

      console.log(`✅ Video thumbnail uploaded successfully`);
      console.log(`  └─ Thumbnail Key: ${result.s3Key}`);

      logger.info('Video thumbnail generated', {
        thumbnailKey: result.s3Key,
        editorName: editorName || 'none',
        structureType: editorName ? 'NEW_HYBRID' : 'OLD_FALLBACK'
      });

      // Clean up temp files
      try {
        await fs.unlink(tempVideoPath);
        await fs.unlink(tempThumbnailPath);
        console.log(`🧹 Cleaned up temporary files`);
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp files', { error: cleanupError.message });
      }

      return result;
    } catch (error) {
      console.warn('⚠️ Video thumbnail generation failed:', error.message);
      logger.warn('Video thumbnail generation failed', { error: error.message, editorName });

      // Clean up temp files on error
      try {
        if (tempVideoPath) await fs.unlink(tempVideoPath).catch(() => {});
        if (tempThumbnailPath) await fs.unlink(tempThumbnailPath).catch(() => {});
      } catch (cleanupError) {
        // Ignore cleanup errors
      }

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
   * ✨ NEW: Download file buffer from S3
   * Used by bulk metadata operations to download, process, and re-upload files
   * @param {string} s3Key - S3 object key
   * @returns {Promise<Buffer>} File buffer
   */
  async downloadFileBuffer(s3Key) {
    try {
      logger.info(`Downloading file from S3: ${s3Key}`);

      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });

      const response = await s3Client.send(command);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      logger.info(`Downloaded ${buffer.length} bytes from S3`);

      return buffer;

    } catch (error) {
      logger.error(`Failed to download file from S3: ${s3Key}`, error);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * ✨ NEW: Upload buffer directly to S3
   * Used by bulk metadata operations to upload processed files
   * @param {Buffer} buffer - File buffer to upload
   * @param {string} s3Key - S3 object key
   * @param {string} mimeType - File MIME type
   * @returns {Promise<Object>} Upload result
   */
  async uploadFileBuffer(buffer, s3Key, mimeType) {
    try {
      logger.info(`Uploading buffer to S3: ${s3Key} (${buffer.length} bytes)`);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(command);

      const url = `${process.env.AWS_CLOUDFRONT_URL}/${s3Key}`;

      logger.info(`Uploaded successfully to S3: ${url}`);

      return {
        s3Key,
        url
      };

    } catch (error) {
      logger.error(`Failed to upload buffer to S3: ${s3Key}`, error);
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * ✨ NEW: Download file from S3 to buffer
   * @param {string} s3Key - S3 object key
   * @returns {Promise<Buffer>} File buffer
   */
  async downloadToBuffer(s3Key) {
    try {
      logger.info(`Downloading from S3 to buffer: ${s3Key}`);

      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });

      const response = await s3Client.send(command);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);

      logger.info(`Downloaded ${buffer.length} bytes from S3`);

      return buffer;

    } catch (error) {
      logger.error(`Failed to download from S3: ${s3Key}`, error);
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  /**
   * Copy file within S3 bucket
   * @param {string} sourceKey - Source S3 object key
   * @param {string} destinationKey - Destination S3 object key
   * @returns {Promise<Object>} Copy result with new s3Key
   */
  async copyFile(sourceKey, destinationKey) {
    try {
      logger.info(`Copying file in S3: ${sourceKey} -> ${destinationKey}`);

      const command = new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${sourceKey}`,
        Key: destinationKey,
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(command);

      logger.info(`File copied successfully in S3: ${destinationKey}`);

      return {
        s3Key: destinationKey,
        s3Bucket: S3_BUCKET
      };
    } catch (error) {
      logger.error('S3 copy error', { error: error.message, sourceKey, destinationKey });
      throw new Error(`Failed to copy file in S3: ${error.message}`);
    }
  }

  /**
   * Get signed URL for S3 object
   * @param {string} s3Key - S3 object key
   * @returns {Promise<string>} Signed URL
   */
  async getSignedUrl(s3Key) {
    try {
      return await getPresignedDownloadUrl(s3Key);
    } catch (error) {
      logger.error('Failed to generate signed URL', { error: error.message, s3Key });
      throw new Error('Failed to generate signed URL');
    }
  }

  /**
   * Soft delete file - move to deleted folder with metadata
   * @param {string} s3Key - Current S3 key
   * @param {Object} metadata - Deletion metadata
   * @param {string} metadata.deletedBy - Name of person who deleted
   * @param {string} metadata.deletedById - User ID who deleted
   * @param {string} metadata.reason - Deletion reason
   * @param {string} metadata.uploaderName - Original uploader name
   * @param {Date} metadata.uploadedAt - Upload timestamp
   * @returns {Promise<Object>} Deleted file info with new S3 keys
   */
  async softDeleteFile(s3Key, metadata) {
    try {
      const { deletedBy, deletedById, reason, uploaderName, uploadedAt } = metadata;

      console.log(`🗑️ Soft deleting file: ${s3Key}`);
      console.log(`  └─ Deleted by: ${deletedBy} (${deletedById})`);

      // Generate new S3 key in deleted folder
      const filename = path.basename(s3Key);
      const deletedS3Key = generateS3Key(filename, 'deleted', null, null, {
        deletedBy,
        originalPath: s3Key
      });

      // Create deletion metadata
      const deletionMetadata = {
        original_file: {
          s3_key: s3Key,
          uploaded_by_name: uploaderName || 'Unknown',
          uploaded_at: uploadedAt || new Date().toISOString(),
          file_size: 0 // Will be updated after copy
        },
        deletion_info: {
          deleted_by_id: deletedById,
          deleted_by_name: deletedBy,
          deleted_at: new Date().toISOString(),
          deletion_reason: reason || 'No reason provided',
          auto_delete_after: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
        },
        restoration_info: {
          can_restore: true,
          restore_to_path: s3Key
        }
      };

      // Copy file to deleted location
      const copyCommand = new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${s3Key}`,
        Key: deletedS3Key,
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(copyCommand);
      console.log(`✅ File copied to deleted folder: ${deletedS3Key}`);

      // Upload deletion metadata JSON
      const metadataKey = `${deletedS3Key}.deletion-metadata.json`;
      const metadataCommand = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: metadataKey,
        Body: JSON.stringify(deletionMetadata, null, 2),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(metadataCommand);
      console.log(`✅ Deletion metadata uploaded: ${metadataKey}`);

      // Delete original file
      const deleteCommand = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key
      });

      await s3Client.send(deleteCommand);
      console.log(`✅ Original file deleted: ${s3Key}`);

      logger.info('File soft deleted', {
        originalKey: s3Key,
        deletedKey: deletedS3Key,
        deletedBy,
        reason
      });

      return {
        success: true,
        original_s3_key: s3Key,
        deleted_s3_key: deletedS3Key,
        metadata_s3_key: metadataKey,
        deletion_metadata: deletionMetadata
      };
    } catch (error) {
      console.error('❌ Soft delete failed:', error.message);
      logger.error('Soft delete error', { error: error.message, s3Key });
      throw new Error(`Failed to soft delete file: ${error.message}`);
    }
  }

  /**
   * Restore soft-deleted file to original location
   * @param {string} deletedS3Key - S3 key in deleted folder
   * @param {string} restoredBy - Name of person restoring
   * @returns {Promise<Object>} Restored file info
   */
  async restoreDeletedFile(deletedS3Key, restoredBy) {
    try {
      console.log(`♻️ Restoring deleted file: ${deletedS3Key}`);
      console.log(`  └─ Restored by: ${restoredBy}`);

      // Get deletion metadata
      const metadataKey = `${deletedS3Key}.deletion-metadata.json`;
      const metadataCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: metadataKey
      });

      const metadataResponse = await s3Client.send(metadataCommand);
      const metadataBody = await metadataResponse.Body.transformToString();
      const metadata = JSON.parse(metadataBody);

      const originalS3Key = metadata.restoration_info.restore_to_path;

      // Copy file back to original location
      const copyCommand = new CopyObjectCommand({
        Bucket: S3_BUCKET,
        CopySource: `${S3_BUCKET}/${deletedS3Key}`,
        Key: originalS3Key,
        ServerSideEncryption: 'AES256'
      });

      await s3Client.send(copyCommand);
      console.log(`✅ File restored to original location: ${originalS3Key}`);

      // Delete from deleted folder
      const deleteFileCommand = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: deletedS3Key
      });

      const deleteMetadataCommand = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: metadataKey
      });

      await s3Client.send(deleteFileCommand);
      await s3Client.send(deleteMetadataCommand);
      console.log(`✅ Deleted files removed from deleted folder`);

      logger.info('File restored', {
        deletedKey: deletedS3Key,
        restoredKey: originalS3Key,
        restoredBy
      });

      return {
        success: true,
        restored_s3_key: originalS3Key,
        deleted_from: deletedS3Key,
        restored_by: restoredBy
      };
    } catch (error) {
      console.error('❌ Restore failed:', error.message);
      logger.error('Restore error', { error: error.message, deletedS3Key });
      throw new Error(`Failed to restore file: ${error.message}`);
    }
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
