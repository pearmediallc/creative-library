const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no auth required) - must come first
router.post('/public/verify', permissionController.verifyPublicLinkPassword);
router.get('/public/:token', permissionController.getPublicResource);
router.get('/public/:token/download', permissionController.downloadPublicResource);

// All other routes require authentication
router.use(authenticateToken);

// Shared resources
router.get('/shared-by-me', permissionController.getSharedByMe);
router.get('/shared-with-me', permissionController.getSharedWithMe);

// Public link management (protected routes)
router.post('/:id/public-link', permissionController.createPublicLink);
router.patch('/public-link/:linkId', permissionController.updatePublicLink);
router.delete('/public-link/:linkId', permissionController.revokePublicLink);
router.get('/public-link/:linkId/stats', permissionController.getPublicLinkStats);

// Permission management
router.post('/', permissionController.grantPermission);
router.get('/', permissionController.getPermissions);
router.delete('/:id', permissionController.revokePermission);

// Bulk operations
router.post('/share-folder', permissionController.shareFolderWithTeam);

module.exports = router;
