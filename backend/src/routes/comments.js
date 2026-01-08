const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all comment routes
router.use(authenticateToken);

/**
 * @route   POST /api/comments
 * @desc    Create a new comment
 * @access  Private
 */
router.post('/', commentController.createComment.bind(commentController));

/**
 * @route   GET /api/comments
 * @desc    Get comments for a file
 * @query   file_id - File ID (required)
 * @query   include_resolved - Include resolved comments (default: true)
 * @access  Private
 */
router.get('/', commentController.getComments.bind(commentController));

/**
 * @route   PATCH /api/comments/:id
 * @desc    Update a comment
 * @access  Private (Author or Admin only)
 */
router.patch('/:id', commentController.updateComment.bind(commentController));

/**
 * @route   DELETE /api/comments/:id
 * @desc    Delete a comment (soft delete)
 * @access  Private (Author or Admin only)
 */
router.delete('/:id', commentController.deleteComment.bind(commentController));

/**
 * @route   POST /api/comments/:id/resolve
 * @desc    Toggle comment resolution
 * @access  Private
 */
router.post('/:id/resolve', commentController.toggleResolve.bind(commentController));

/**
 * @route   POST /api/comments/:id/reactions
 * @desc    Add reaction to a comment
 * @access  Private
 */
router.post('/:id/reactions', commentController.addReaction.bind(commentController));

/**
 * @route   DELETE /api/comments/:id/reactions/:type
 * @desc    Remove reaction from a comment
 * @access  Private
 */
router.delete('/:id/reactions/:type', commentController.removeReaction.bind(commentController));

module.exports = router;
