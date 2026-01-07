/**
 * File Request Routes
 * Allows users to request file uploads from external parties
 */

const express = require('express');
const router = express.Router();
const fileRequestController = require('../controllers/fileRequestController');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// ============================================
// PROTECTED ROUTES (Requires Authentication)
// ============================================

// Create new file request
router.post('/',
  authenticateToken,
  fileRequestController.create.bind(fileRequestController)
);

// Get all file requests for current user
router.get('/',
  authenticateToken,
  fileRequestController.getAll.bind(fileRequestController)
);

// Get single file request details
router.get('/:id',
  authenticateToken,
  fileRequestController.getOne.bind(fileRequestController)
);

// Update file request
router.patch('/:id',
  authenticateToken,
  fileRequestController.update.bind(fileRequestController)
);

// Close file request
router.post('/:id/close',
  authenticateToken,
  fileRequestController.close.bind(fileRequestController)
);

// Delete file request
router.delete('/:id',
  authenticateToken,
  fileRequestController.delete.bind(fileRequestController)
);

// ============================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================

// Get public file request details by token
router.get('/public/:token',
  fileRequestController.getPublic.bind(fileRequestController)
);

// Upload file to request (public endpoint)
router.post('/public/:token/upload',
  upload.single('file'),
  fileRequestController.uploadToRequest.bind(fileRequestController)
);

module.exports = router;
