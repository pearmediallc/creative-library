const s3Service = require('./s3Service');
const metadataService = require('./metadataService');
const MediaFile = require('../models/MediaFile');
const logger = require('../utils/logger');

/**
 * Bulk Metadata Service
 * Handles asynchronous bulk metadata operations on already-uploaded files
 */
class BulkMetadataService {
  constructor() {
    this.activeJobs = new Map();

    // Cleanup old jobs every hour
    setInterval(() => this.cleanupOldJobs(), 60 * 60 * 1000);
  }

  /**
   * Start bulk metadata operation
   * Downloads files from S3, processes metadata, re-uploads to S3
   *
   * @param {string} jobId - Unique job identifier
   * @param {Array<string>} fileIds - Array of media file IDs to process
   * @param {string} operation - Operation type: 'add', 'remove', or 'remove_and_add'
   * @param {Object} metadata - Metadata to embed (if operation includes 'add')
   * @param {string} userId - User ID initiating the operation
   * @returns {Promise<Object>} Job result
   */
  async processBulkOperation(jobId, fileIds, operation, metadata, userId) {
    const job = {
      id: jobId,
      status: 'processing',
      total: fileIds.length,
      processed: 0,
      successful: 0,
      failed: 0,
      progress: 0,
      results: [],
      startedAt: new Date(),
      userId
    };

    this.activeJobs.set(jobId, job);
    logger.info(`Starting bulk metadata operation ${jobId}: ${operation} on ${fileIds.length} files`);

    try {
      for (let i = 0; i < fileIds.length; i++) {
        // Check if job was cancelled
        const currentJob = this.activeJobs.get(jobId);
        if (currentJob.status === 'cancelled') {
          logger.info(`Bulk operation ${jobId} cancelled by user`);
          break;
        }

        const fileId = fileIds[i];
        const startTime = Date.now();

        try {
          logger.info(`Processing file ${i + 1}/${fileIds.length}: ${fileId}`);

          // Get file record from database
          const mediaFile = await MediaFile.findById(fileId);
          if (!mediaFile) {
            throw new Error('File not found in database');
          }

          logger.info(`  File: ${mediaFile.original_filename} (${mediaFile.file_type})`);

          // Download file from S3
          logger.info(`  Downloading from S3: ${mediaFile.s3_key}`);
          const fileBuffer = await s3Service.downloadFileBuffer(mediaFile.s3_key);
          logger.info(`  Downloaded ${fileBuffer.length} bytes`);

          let processedBuffer = fileBuffer;
          const operations = [];

          // STEP 1: Remove metadata if requested
          if (operation === 'remove' || operation === 'remove_and_add') {
            logger.info(`  Removing metadata from ${mediaFile.file_type}...`);

            if (mediaFile.file_type === 'image') {
              processedBuffer = await metadataService.removeMetadataFromImage(processedBuffer);
              operations.push('stripped_image');
            } else if (mediaFile.file_type === 'video') {
              processedBuffer = await metadataService.removeMetadataFromVideo(processedBuffer);
              operations.push('stripped_video');
            }

            logger.info(`  ✓ Metadata removed`);
          }

          // STEP 2: Add metadata if requested
          if (operation === 'add' || operation === 'remove_and_add') {
            logger.info(`  Adding metadata to ${mediaFile.file_type}...`);

            // Merge existing tags if preserve_tags option is set
            let tagsToEmbed = metadata.tags || [];
            if (metadata.preserve_tags && mediaFile.tags && mediaFile.tags.length > 0) {
              tagsToEmbed = [...new Set([...mediaFile.tags, ...tagsToEmbed])];
            }

            const metadataToEmbed = {
              creator_id: metadata.creator_id || mediaFile.editor_name,
              timestamp: new Date().toISOString(),
              additional: {
                description: metadata.description || mediaFile.description || '',
                keywords: tagsToEmbed.join(', '),
                campaign_id: metadata.campaign_id || '',
                title: mediaFile.original_filename
              }
            };

            if (mediaFile.file_type === 'image') {
              processedBuffer = await metadataService.addMetadataToImage(
                processedBuffer,
                metadataToEmbed
              );
              operations.push('embedded_creator_image');
            } else if (mediaFile.file_type === 'video') {
              processedBuffer = await metadataService.addMetadataToVideo(
                processedBuffer,
                metadataToEmbed
              );
              operations.push('embedded_creator_video');
            }

            logger.info(`  ✓ Metadata added`);
          }

          // Generate new S3 key (versioned to preserve original)
          const timestamp = Date.now();
          const ext = mediaFile.s3_key.match(/\.[^.]+$/)?.[0] || '';
          const basePath = mediaFile.s3_key.replace(/\.[^.]+$/, '');
          const newS3Key = `${basePath}_meta_${timestamp}${ext}`;

          // Upload processed file back to S3
          logger.info(`  Uploading to S3: ${newS3Key}`);
          await s3Service.uploadFileBuffer(
            processedBuffer,
            newS3Key,
            mediaFile.mime_type
          );
          logger.info(`  ✓ Uploaded ${processedBuffer.length} bytes`);

          // Update database record
          const updatedData = {
            s3_key: newS3Key,
            s3_url: `${process.env.AWS_CLOUDFRONT_URL}/${newS3Key}`,
            file_size: processedBuffer.length,
            metadata_stripped: operation.includes('remove'),
            metadata_embedded: operation.includes('add') ? {
              creator_id: metadata.creator_id || mediaFile.editor_name,
              timestamp: new Date().toISOString(),
              tags: tagsToEmbed,
              description: metadata.description || mediaFile.description || ''
            } : mediaFile.metadata_embedded,
            metadata_operations: [
              ...(mediaFile.metadata_operations || []),
              ...operations
            ],
            updated_at: new Date()
          };

          // Merge tags if preserve_tags option
          if (metadata.preserve_tags && operation.includes('add')) {
            updatedData.tags = tagsToEmbed;
          }

          await MediaFile.update(fileId, updatedData);
          logger.info(`  ✓ Database updated`);

          const processingTime = Date.now() - startTime;

          // Record success
          job.successful++;
          job.results.push({
            file_id: fileId,
            filename: mediaFile.original_filename,
            success: true,
            operations: operations,
            oldSize: fileBuffer.length,
            newSize: processedBuffer.length,
            processingTime: processingTime,
            oldS3Key: mediaFile.s3_key,
            newS3Key: newS3Key
          });

          logger.info(`  ✓ Success in ${processingTime}ms`);

        } catch (error) {
          logger.error(`Failed to process file ${fileId}:`, error);

          job.failed++;
          job.results.push({
            file_id: fileId,
            success: false,
            error: error.message
          });
        }

        // Update progress
        job.processed++;
        job.progress = Math.round((job.processed / job.total) * 100);
        this.activeJobs.set(jobId, job);
      }

      // Mark job as complete
      job.status = job.status === 'cancelled' ? 'cancelled' : 'completed';
      job.completedAt = new Date();
      job.totalTime = Date.now() - new Date(job.startedAt).getTime();
      this.activeJobs.set(jobId, job);

      logger.info(`Bulk operation ${jobId} ${job.status}: ${job.successful}/${job.total} successful`);

      return job;

    } catch (error) {
      logger.error(`Bulk operation ${jobId} failed:`, error);

      job.status = 'failed';
      job.error = error.message;
      job.completedAt = new Date();
      this.activeJobs.set(jobId, job);

      throw error;
    }
  }

  /**
   * Get job status by ID
   * @param {string} jobId - Job ID
   * @returns {Object|null} Job status or null if not found
   */
  getJobStatus(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      return null;
    }

    // Return sanitized job info (don't expose internal details)
    return {
      id: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      successful: job.successful,
      failed: job.failed,
      progress: job.progress,
      results: job.results,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      totalTime: job.totalTime,
      error: job.error
    };
  }

  /**
   * Cancel a running job
   * @param {string} jobId - Job ID
   * @returns {boolean} True if cancelled, false if not found or already completed
   */
  cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job && job.status === 'processing') {
      logger.info(`Cancelling bulk operation ${jobId}`);
      job.status = 'cancelled';
      this.activeJobs.set(jobId, job);
      return true;
    }
    return false;
  }

  /**
   * Clean up old jobs (older than 1 hour)
   */
  cleanupOldJobs() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.completedAt && new Date(job.completedAt).getTime() < oneHourAgo) {
        this.activeJobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old bulk operation jobs`);
    }
  }

  /**
   * Get all active jobs (for monitoring/debugging)
   * @returns {Array} List of active jobs
   */
  getAllJobs() {
    return Array.from(this.activeJobs.values());
  }
}

module.exports = new BulkMetadataService();
