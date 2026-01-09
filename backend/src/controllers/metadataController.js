const metadataService = require('../services/metadataService');
const logger = require('../utils/logger');
const multer = require('multer');

// Configure multer for file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

class MetadataController {
  /**
   * Add metadata to file (embed creator info)
   * POST /api/metadata/add
   */
  async addMetadata(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const { creator_id, description, title, keywords, custom_fields } = req.body;

      if (!creator_id || !creator_id.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Creator ID is required'
        });
      }

      const file = req.file;
      const fileType = file.mimetype.split('/')[0]; // 'image' or 'video'

      logger.info('Processing metadata add request', {
        filename: file.originalname,
        creator_id,
        fileType
      });

      // Prepare metadata object
      const metadata = {
        creator_id: creator_id.trim(),
        timestamp: new Date().toISOString(),
        additional: {
          description,
          title,
          keywords,
          custom: custom_fields ? JSON.parse(custom_fields) : {}
        }
      };

      let processedBuffer;
      let embeddedFields = {};

      // Process based on file type
      if (fileType === 'image') {
        processedBuffer = await metadataService.addMetadataToImage(file.buffer, metadata);

        // Extract embedded fields to show in response
        const extracted = await metadataService.extractImageMetadata(processedBuffer);
        embeddedFields = {
          Artist: extracted['EXIF:0th:Artist'] || creator_id,
          Copyright: extracted['EXIF:0th:Copyright'] || `Created by ${creator_id}`,
          Creator: creator_id,
          ProcessedDate: metadata.timestamp
        };
      } else if (fileType === 'video') {
        processedBuffer = await metadataService.addMetadataToVideo(file.buffer, metadata);

        embeddedFields = {
          Artist: creator_id,
          Author: creator_id,
          Creator: creator_id,
          Comment: `Creator: ${creator_id} | Date: ${metadata.timestamp}`,
          ProcessedDate: metadata.timestamp
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type. Only images and videos are supported.'
        });
      }

      // Generate filename for download
      const ext = file.originalname.split('.').pop();
      const filename = `tagged_${Date.now()}_${file.originalname}`;

      // Convert buffer to base64 for download URL
      const base64Data = processedBuffer.toString('base64');
      const downloadUrl = `data:${file.mimetype};base64,${base64Data}`;

      logger.info('Metadata added successfully', {
        filename: file.originalname,
        creator_id,
        outputSize: processedBuffer.length
      });

      res.json({
        success: true,
        message: 'Metadata added successfully',
        data: {
          filename,
          download_url: downloadUrl,
          original_filename: file.originalname,
          file_type: file.mimetype,
          processed_size: processedBuffer.length,
          metadata: {
            creator_id,
            original_filename: file.originalname,
            processed_date: metadata.timestamp,
            file_type: fileType,
            embedded_fields: embeddedFields
          }
        }
      });
    } catch (error) {
      logger.error('Add metadata failed', {
        error: error.message,
        filename: req.file?.originalname
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to add metadata to file'
      });
    }
  }

  /**
   * Remove metadata from file (strip EXIF/GPS)
   * POST /api/metadata/remove
   */
  async removeMetadata(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const file = req.file;
      const fileType = file.mimetype.split('/')[0]; // 'image' or 'video'

      logger.info('Processing metadata remove request', {
        filename: file.originalname,
        fileType
      });

      let processedBuffer;
      let removedFields = [];

      // Extract metadata before removing to show what was removed
      if (fileType === 'image') {
        const beforeMetadata = await metadataService.extractImageMetadata(file.buffer);

        // Remove metadata
        processedBuffer = await metadataService.removeMetadataFromImage(file.buffer);

        // Identify removed fields
        if (beforeMetadata['EXIF:GPS:GPSLatitude']) removedFields.push('GPS Location');
        if (beforeMetadata['EXIF:0th:Make']) removedFields.push('Camera Make');
        if (beforeMetadata['EXIF:0th:Model']) removedFields.push('Camera Model');
        if (beforeMetadata['EXIF:0th:Artist']) removedFields.push('Artist/Creator');
        if (beforeMetadata['EXIF:0th:Copyright']) removedFields.push('Copyright');

        if (removedFields.length === 0) {
          removedFields.push('All EXIF/Metadata');
        }
      } else if (fileType === 'video') {
        const beforeMetadata = await metadataService.extractVideoMetadata(file.buffer);

        // Remove metadata
        processedBuffer = await metadataService.removeMetadataFromVideo(file.buffer);

        // Identify removed fields from video tags
        if (beforeMetadata.tags) {
          Object.keys(beforeMetadata.tags).forEach(tag => {
            removedFields.push(tag);
          });
        }

        if (removedFields.length === 0) {
          removedFields.push('All Video Metadata');
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type. Only images and videos are supported.'
        });
      }

      // Generate filename for download
      const filename = `cleaned_${Date.now()}_${file.originalname}`;

      // Convert buffer to base64 for download URL
      const base64Data = processedBuffer.toString('base64');
      const downloadUrl = `data:${file.mimetype};base64,${base64Data}`;

      logger.info('Metadata removed successfully', {
        filename: file.originalname,
        removedFields: removedFields.join(', '),
        outputSize: processedBuffer.length
      });

      res.json({
        success: true,
        message: 'Metadata removed successfully',
        data: {
          filename,
          download_url: downloadUrl,
          original_filename: file.originalname,
          file_type: file.mimetype,
          processed_size: processedBuffer.length,
          removed_fields: removedFields,
          metadata: {
            original_filename: file.originalname,
            processed_date: new Date().toISOString(),
            file_type: fileType,
            operation: 'remove',
            removed_count: removedFields.length
          }
        }
      });
    } catch (error) {
      logger.error('Remove metadata failed', {
        error: error.message,
        filename: req.file?.originalname
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to remove metadata from file'
      });
    }
  }

  /**
   * Extract metadata from file (read-only)
   * POST /api/metadata/extract
   */
  async extractMetadata(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const file = req.file;
      const fileType = file.mimetype.split('/')[0]; // 'image' or 'video'

      logger.info('Processing metadata extract request', {
        filename: file.originalname,
        fileType
      });

      let metadata;

      if (fileType === 'image') {
        metadata = await metadataService.extractImageMetadata(file.buffer);
      } else if (fileType === 'video') {
        metadata = await metadataService.extractVideoMetadata(file.buffer);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Unsupported file type. Only images and videos are supported.'
        });
      }

      logger.info('Metadata extracted successfully', {
        filename: file.originalname,
        fieldCount: Object.keys(metadata).length
      });

      res.json({
        success: true,
        message: 'Metadata extracted successfully',
        data: {
          filename: file.originalname,
          file_type: file.mimetype,
          metadata
        }
      });
    } catch (error) {
      logger.error('Extract metadata failed', {
        error: error.message,
        filename: req.file?.originalname
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to extract metadata from file'
      });
    }
  }
}

// Create controller instance
const controller = new MetadataController();

// Export controller methods with multer middleware
module.exports = {
  upload: upload.single('file'),
  addMetadata: controller.addMetadata.bind(controller),
  removeMetadata: controller.removeMetadata.bind(controller),
  extractMetadata: controller.extractMetadata.bind(controller)
};
