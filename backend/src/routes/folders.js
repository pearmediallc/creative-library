/**
 * Folder Routes
 * API endpoints for folder management
 */

const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const folderLockController = require('../controllers/folderLockController');
const folderAccessController = require('../controllers/folderAccessController');
const { authenticateToken } = require('../middleware/auth');

// All folder routes require authentication
router.use(authenticateToken);

// Folder CRUD
router.post('/', folderController.createFolder.bind(folderController));
router.get('/tree', folderController.getFolderTree.bind(folderController));
router.get('/:id', folderController.getFolder.bind(folderController));
router.get('/:id/contents', folderController.getFolderContents.bind(folderController));
router.get('/:id/breadcrumb', folderController.getBreadcrumb.bind(folderController));
router.get('/:id/siblings', folderController.getSiblings.bind(folderController));
router.get('/:id/download', folderController.downloadFolder.bind(folderController));
router.patch('/:id', folderController.updateFolder.bind(folderController));
router.patch('/:id/rename', folderController.renameFolder.bind(folderController));
router.delete('/:id', folderController.deleteFolder.bind(folderController));

// File operations
router.post('/move-files', folderController.moveFiles.bind(folderController));
router.post('/copy-files', folderController.copyFiles.bind(folderController));

// Date-based folder creation
router.post('/date-folder', folderController.createDateFolder.bind(folderController));

// Folder lock
router.post('/:id/toggle-lock', folderLockController.toggleFolderLock);
router.get('/:id/lock-status', folderLockController.getFolderLockStatus);

// Folder access management
router.post('/:folderId/grant-access', folderAccessController.grantFolderAccess);
router.get('/:folderId/permissions', folderAccessController.getFolderPermissions);
router.delete('/:folderId/permissions/:permissionId', folderAccessController.revokeFolderAccess);
router.get('/search-users', folderAccessController.searchUsersForAccess);

module.exports = router;
