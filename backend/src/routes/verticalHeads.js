/**
 * Vertical Heads Routes
 * Manages vertical-to-editor mappings for auto-assignment
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const verticalHeadsController = require('../controllers/verticalHeadsController');

// Get all vertical heads
router.get('/',
  authenticateToken,
  verticalHeadsController.getVerticalHeads
);

// Get assignment for specific vertical (used during file request creation)
router.post('/get-assignment',
  authenticateToken,
  verticalHeadsController.getAssignmentForVertical
);

// Get vertical head for specific vertical
router.get('/:vertical',
  authenticateToken,
  verticalHeadsController.getVerticalHead
);

// Update vertical head (admin only)
router.put('/:vertical',
  authenticateToken,
  verticalHeadsController.updateVerticalHead
);

module.exports = router;
