const express = require('express');
const router = express.Router();
const starredController = require('../controllers/starredController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all starred routes
router.use(authenticateToken);

/**
 * @route   PUT /api/starred/:fileId
 * @desc    Toggle starred status for a file
 * @access  Private
 */
router.put('/:fileId', starredController.toggleStarred.bind(starredController));

/**
 * @route   GET /api/starred
 * @desc    Get all starred files for current user
 * @access  Private
 */
router.get('/', starredController.getStarredFiles.bind(starredController));

module.exports = router;
