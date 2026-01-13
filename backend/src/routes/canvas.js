const express = require('express');
const router = express.Router();
const CanvasController = require('../controllers/canvasController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes require authentication
router.use(authenticateToken);

// Get or create canvas for a file request
router.get('/:requestId/canvas', CanvasController.getCanvas);

// Create or update canvas
router.post('/:requestId/canvas', CanvasController.upsertCanvas);

// Upload attachment to canvas
router.post('/:requestId/canvas/attach', upload.single('file'), CanvasController.uploadAttachment);

// Remove attachment from canvas
router.delete('/:requestId/canvas/attachments/:fileId', CanvasController.removeAttachment);

// Delete canvas
router.delete('/:requestId/canvas', CanvasController.deleteCanvas);

module.exports = router;
