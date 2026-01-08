const express = require('express');
const router = express.Router();
const savedSearchController = require('../controllers/savedSearchController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all saved search routes
router.use(authenticateToken);

/**
 * @route   POST /api/saved-searches
 * @desc    Create a new saved search/smart collection
 * @access  Private
 */
router.post('/', savedSearchController.create.bind(savedSearchController));

/**
 * @route   GET /api/saved-searches
 * @desc    Get all saved searches for current user
 * @access  Private
 */
router.get('/', savedSearchController.getAll.bind(savedSearchController));

/**
 * @route   GET /api/saved-searches/:id
 * @desc    Get single saved search
 * @access  Private
 */
router.get('/:id', savedSearchController.getOne.bind(savedSearchController));

/**
 * @route   GET /api/saved-searches/:id/results
 * @desc    Execute saved search and get results
 * @access  Private
 */
router.get('/:id/results', savedSearchController.getResults.bind(savedSearchController));

/**
 * @route   PATCH /api/saved-searches/:id
 * @desc    Update saved search
 * @access  Private
 */
router.patch('/:id', savedSearchController.update.bind(savedSearchController));

/**
 * @route   DELETE /api/saved-searches/:id
 * @desc    Delete saved search
 * @access  Private
 */
router.delete('/:id', savedSearchController.delete.bind(savedSearchController));

/**
 * @route   POST /api/saved-searches/:id/favorite
 * @desc    Toggle favorite status
 * @access  Private
 */
router.post('/:id/favorite', savedSearchController.toggleFavorite.bind(savedSearchController));

module.exports = router;
