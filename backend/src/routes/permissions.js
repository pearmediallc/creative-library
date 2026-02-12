const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no auth required) - must come first
router.post('/public/verify', permissionController.verifyPublicLinkPassword.bind(permissionController));
router.get('/public/:token', permissionController.getPublicResource.bind(permissionController));
router.get('/public/:token/download', permissionController.downloadPublicResource.bind(permissionController));

// All other routes require authentication
router.use(authenticateToken);

// Shared resources
router.get('/shared-by-me', permissionController.getSharedByMe.bind(permissionController));
router.get('/shared-with-me', permissionController.getSharedWithMe.bind(permissionController));

// Public link management (protected routes)
// Ergonomic resource-based endpoint (preferred)
router.post('/public-link', permissionController.createPublicLinkForResource.bind(permissionController));
// Legacy: permission-id based endpoint
router.post('/:id/public-link', permissionController.createPublicLink.bind(permissionController));
router.patch('/public-link/:linkId', permissionController.updatePublicLink.bind(permissionController));
router.delete('/public-link/:linkId', permissionController.revokePublicLink.bind(permissionController));
router.get('/public-link/:linkId/stats', permissionController.getPublicLinkStats.bind(permissionController));

// Permission management
router.post('/', permissionController.grantPermission.bind(permissionController));
router.get('/', permissionController.getPermissions.bind(permissionController));
router.delete('/:id', permissionController.revokePermission.bind(permissionController));

// Bulk operations
router.post('/share-folder', permissionController.shareFolderWithTeam.bind(permissionController));

module.exports = router;
