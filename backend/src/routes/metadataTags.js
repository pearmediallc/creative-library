const express = require('express');
const router = express.Router();
const metadataTagController = require('../controllers/metadataTagController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Tag management routes
router.get('/', metadataTagController.getAllTags);
router.get('/categories', metadataTagController.getCategories);
router.get('/:id', metadataTagController.getTag);
router.post('/', metadataTagController.createTag);
router.patch('/:id', metadataTagController.updateTag);
router.delete('/:id', metadataTagController.deleteTag);

// Tag-file association routes
router.get('/:id/files', metadataTagController.getFilesWithTag);

module.exports = router;
