const metadataService = require('../services/metadataService');
const logger = require('../utils/logger');

/**
 * Metadata Middleware
 * Processes metadata operations on uploaded files BEFORE they go to S3
 * Must run AFTER multer middleware (requires req.file with buffer)
 */

/**
 * Process metadata on uploaded file
 * This middleware modifies req.file.buffer based on metadata options
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const processMetadata = async (req, res, next) => {
  try {
    // Skip if no file uploaded
    if (!req.file) {
      logger.info('No file in request, skipping metadata processing');
      return next();
    }

    // Get metadata options from request body
    const removeMetadata = req.body.remove_metadata === 'true';
    const addMetadata = req.body.add_metadata === 'true';

    // Skip if no metadata operations requested
    if (!removeMetadata && !addMetadata) {
      logger.info('No metadata operations requested, skipping processing');
      return next();
    }

    logger.info('\n🏷️  ========== METADATA PROCESSING START ==========');
    logger.info(`📋 Metadata Options:`);
    logger.info(`  └─ Remove Metadata: ${removeMetadata}`);
    logger.info(`  └─ Add Metadata: ${addMetadata}`);
    logger.info(`  └─ File: ${req.file.originalname}`);
    logger.info(`  └─ MIME Type: ${req.file.mimetype}`);
    logger.info(`  └─ Original Size: ${req.file.size} bytes`);

    let fileBuffer = req.file.buffer;
    const isImage = req.file.mimetype.startsWith('image/');
    const isVideo = req.file.mimetype.startsWith('video/');

    // Track metadata operations performed
    const metadataOperations = [];

    // STEP 1: Remove metadata if requested
    if (removeMetadata) {
      logger.info('\n🧹 Step 1: Removing existing metadata...');

      try {
        if (isImage) {
          fileBuffer = await metadataService.removeMetadataFromImage(fileBuffer);
          metadataOperations.push('stripped_image');
          logger.info('  ✅ Image metadata removed successfully');
        } else if (isVideo) {
          fileBuffer = await metadataService.removeMetadataFromVideo(fileBuffer);
          metadataOperations.push('stripped_video');
          logger.info('  ✅ Video metadata removed successfully');
        } else {
          logger.warn('  ⚠️  Unsupported file type for metadata removal');
        }
      } catch (error) {
        logger.error(`  ❌ Error removing metadata: ${error.message}`);
        // Continue processing even if removal fails
      }
    }

    // STEP 2: Add metadata if requested
    if (addMetadata) {
      logger.info('\n➕ Step 2: Adding creator metadata...');

      try {
        // Get editor name from request body
        const editorName = req.body.editor_name || req.body.creator_id || 'Unknown';
        const uploadDate = new Date().toISOString();

        // Parse tags and description
        let tags = [];
        try {
          tags = req.body.tags ? JSON.parse(req.body.tags) : [];
        } catch (e) {
          tags = [];
        }
        const description = req.body.description || '';

        // Build metadata object
        const metadata = {
          creator_id: editorName,
          timestamp: uploadDate,
          additional: {
            description: description,
            keywords: tags.join(', '),
            title: req.file.originalname,
            campaign_id: req.body.campaign_id || '',
            custom: {}
          }
        };

        logger.info(`  └─ Creator ID: ${editorName}`);
        logger.info(`  └─ Timestamp: ${uploadDate}`);
        logger.info(`  └─ Tags: ${tags.join(', ')}`);
        logger.info(`  └─ Description: ${description}`);

        if (isImage) {
          fileBuffer = await metadataService.addMetadataToImage(fileBuffer, metadata);
          metadataOperations.push('embedded_creator_image');
          logger.info('  ✅ Image metadata added successfully');
        } else if (isVideo) {
          fileBuffer = await metadataService.addMetadataToVideo(fileBuffer, metadata);
          metadataOperations.push('embedded_creator_video');
          logger.info('  ✅ Video metadata added successfully');
        } else {
          logger.warn('  ⚠️  Unsupported file type for metadata addition');
        }
      } catch (error) {
        logger.error(`  ❌ Error adding metadata: ${error.message}`);
        // Continue processing even if addition fails
      }
    }

    // Update req.file with processed buffer
    const originalSize = req.file.size;
    req.file.buffer = fileBuffer;
    req.file.size = fileBuffer.length;

    // Store metadata operations in request for later use
    req.metadataOperations = {
      operations: metadataOperations,
      removed: removeMetadata,
      added: addMetadata
    };

    logger.info('\n📊 Metadata Processing Summary:');
    logger.info(`  └─ Operations: ${metadataOperations.join(', ') || 'none'}`);
    logger.info(`  └─ Original Size: ${originalSize} bytes`);
    logger.info(`  └─ New Size: ${req.file.size} bytes`);
    logger.info(`  └─ Size Change: ${req.file.size - originalSize} bytes`);
    logger.info('🏷️  ========== METADATA PROCESSING END ==========\n');

    next();

  } catch (error) {
    logger.error(`❌ Metadata processing error: ${error.message}`);
    logger.error(error.stack);

    // Don't fail the upload if metadata processing fails
    // Just log the error and continue
    logger.warn('⚠️  Continuing with upload despite metadata processing error');
    next();
  }
};

module.exports = {
  processMetadata
};
