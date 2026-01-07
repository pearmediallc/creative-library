const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Permission management
router.post('/', permissionController.grantPermission);
router.get('/', permissionController.getPermissions);
router.delete('/:id', permissionController.revokePermission);

// Bulk operations
router.post('/share-folder', permissionController.shareFolderWithTeam);

module.exports = router;
