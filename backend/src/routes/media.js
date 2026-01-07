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
const versionController = require('../controllers/versionController');
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

// ✨ NEW: Get file metadata (EXIF, IPTC, XMP)
router.get('/:id/metadata',
  authenticateToken,
  mediaController.getFileMetadata.bind(mediaController)
);

// ✨ NEW: Get file activity logs
router.get('/:id/activity',
  authenticateToken,
  mediaController.getFileActivity.bind(mediaController)
);

// Update file metadata
router.patch('/:id',
  authenticateToken,
  validate(schemas.mediaUpdate),
  mediaController.updateFile.bind(mediaController)
);

// Rename file
router.patch('/:id/rename',
  authenticateToken,
  mediaController.renameFile.bind(mediaController)
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

// ✨ NEW: Bulk ZIP download
router.post('/bulk/download-zip',
  authenticateToken,
  mediaController.bulkDownloadZip.bind(mediaController)
);

// ✨ NEW: Bulk delete files
router.delete('/bulk',
  authenticateToken,
  requireAdmin,
  mediaController.bulkDelete.bind(mediaController)
);

// ✨ NEW: Bulk move files to folder
router.post('/bulk/move',
  authenticateToken,
  mediaController.bulkMove.bind(mediaController)
);

// ✨ NEW: Trash / Deleted files endpoints
router.get('/deleted',
  authenticateToken,
  mediaController.getDeletedFiles.bind(mediaController)
);

router.post('/:id/restore',
  authenticateToken,
  mediaController.restoreFile.bind(mediaController)
);

router.delete('/:id/permanent',
  authenticateToken,
  requireAdmin,
  mediaController.permanentDeleteFile.bind(mediaController)
);

router.delete('/deleted/empty',
  authenticateToken,
  requireAdmin,
  mediaController.emptyTrash.bind(mediaController)
);

// ✨ NEW: File versioning endpoints
router.get('/:id/versions',
  authenticateToken,
  versionController.getVersionHistory.bind(versionController)
);

router.post('/:id/versions',
  authenticateToken,
  requireRole('admin', 'creative'),
  upload.single('file'),
  versionController.createVersion.bind(versionController)
);

router.post('/:id/versions/:versionId/restore',
  authenticateToken,
  requireRole('admin', 'creative'),
  versionController.restoreVersion.bind(versionController)
);

router.delete('/:id/versions/:versionId',
  authenticateToken,
  requireRole('admin', 'creative'),
  versionController.deleteVersion.bind(versionController)
);

module.exports = router;
