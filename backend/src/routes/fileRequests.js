/**
 * File Request Routes
 * Allows users to request file uploads from external parties
 */

const express = require('express');
const router = express.Router();
const fileRequestController = require('../controllers/fileRequestController');
const CanvasController = require('../controllers/canvasController');
const requestCommentsController = require('../controllers/requestCommentsController');
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

// Assign multiple editors to file request
router.post('/:id/assign-editors',
  authenticateToken,
  fileRequestController.assignEditors.bind(fileRequestController)
);

// Create folder for file request
router.post('/:id/folders',
  authenticateToken,
  fileRequestController.createRequestFolder.bind(fileRequestController)
);

// Get folders for file request
router.get('/:id/folders',
  authenticateToken,
  fileRequestController.getRequestFolders.bind(fileRequestController)
);

// Get assigned editors for file request
router.get('/:id/editors',
  authenticateToken,
  fileRequestController.getAssignedEditors.bind(fileRequestController)
);

// Complete file request
router.post('/:id/complete',
  authenticateToken,
  fileRequestController.completeRequest.bind(fileRequestController)
);

// Reassign file request (admin only)
router.post('/:id/reassign',
  authenticateToken,
  fileRequestController.reassignRequest.bind(fileRequestController)
);

// ============================================
// CANVAS ROUTES (Product Brief Feature)
// ============================================

// Get or create canvas for a file request
router.get('/:id/canvas',
  authenticateToken,
  CanvasController.getCanvas
);

// Create or update canvas
router.post('/:id/canvas',
  authenticateToken,
  CanvasController.upsertCanvas
);

// Upload attachment to canvas
router.post('/:id/canvas/attach',
  authenticateToken,
  upload.single('file'),
  CanvasController.uploadAttachment
);

// Remove attachment from canvas
router.delete('/:id/canvas/attachments/:fileId',
  authenticateToken,
  CanvasController.removeAttachment
);

// Delete canvas
router.delete('/:id/canvas',
  authenticateToken,
  CanvasController.deleteCanvas
);

// ============================================
// COMMENT ROUTES (Request Feedback System)
// ============================================

// Get all comments for a request
router.get('/:requestId/comments',
  authenticateToken,
  requestCommentsController.getRequestComments
);

// Add a comment to a request
router.post('/:requestId/comments',
  authenticateToken,
  requestCommentsController.addRequestComment
);

// Update a comment
router.put('/comments/:commentId',
  authenticateToken,
  requestCommentsController.updateRequestComment
);

// Delete a comment
router.delete('/comments/:commentId',
  authenticateToken,
  requestCommentsController.deleteRequestComment
);

// Get comment count for a request
router.get('/:requestId/comments/count',
  authenticateToken,
  requestCommentsController.getCommentCount
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
