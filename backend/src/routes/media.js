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
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// Upload endpoint with file upload middleware
router.post('/upload',
  authenticateToken,
  upload.single('file'),
  validate(schemas.mediaUpload),
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

// Delete file
router.delete('/:id',
  authenticateToken,
  mediaController.deleteFile.bind(mediaController)
);

module.exports = router;
