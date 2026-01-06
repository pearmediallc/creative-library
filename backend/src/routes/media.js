/**
 * Media Library Routes
 * POST /api/media/upload - Upload file to S3
 * GET /api/media - Browse/filter files
 * GET /api/media/stats - Get storage statistics
 * GET /api/media/:id - Get file details
 * PATCH /api/media/:id - Update file metadata
 * DELETE /api/media/:id - Soft delete file
 */

const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { validate, schemas } = require('../middleware/validate');
const { authenticateToken, requireRole, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { processMetadata } = require('../middleware/metadataMiddleware');

// Upload endpoint with file upload middleware
// Only admin and creative users can upload
router.post('/upload',
  authenticateToken,
  requireRole('admin', 'creative'),
  upload.single('file'),
  validate(schemas.mediaUpload),
  processMetadata,  // ✨ NEW: Process metadata before S3 upload
  mediaController.upload.bind(mediaController)
);

// Browse files with filters
router.get('/',
  authenticateToken,
  mediaController.getFiles.bind(mediaController)
);

// Get storage statistics
router.get('/stats',
  authenticateToken,
  mediaController.getStats.bind(mediaController)
);

// Get files for library selector (campaign launcher integration)
router.get('/select',
  authenticateToken,
  mediaController.selectFromLibrary.bind(mediaController)
);

// Download file (proxy from S3/CloudFront with CORS headers)
router.get('/:id/download',
  authenticateToken,
  mediaController.downloadFile.bind(mediaController)
);

// Get single file
router.get('/:id',
  authenticateToken,
  mediaController.getFile.bind(mediaController)
);

// Update file metadata
router.patch('/:id',
  authenticateToken,
  validate(schemas.mediaUpdate),
  mediaController.updateFile.bind(mediaController)
);

// Delete file (Admin only)
router.delete('/:id',
  authenticateToken,
  requireAdmin,
  mediaController.deleteFile.bind(mediaController)
);

// ✨ NEW: Bulk metadata operations
router.post('/bulk/metadata',
  authenticateToken,
  requireRole('admin', 'creative'),
  mediaController.bulkMetadataOperation.bind(mediaController)
);

router.get('/bulk/status/:jobId',
  authenticateToken,
  mediaController.getBulkOperationStatus.bind(mediaController)
);

router.post('/bulk/cancel/:jobId',
  authenticateToken,
  mediaController.cancelBulkOperation.bind(mediaController)
);

module.exports = router;
