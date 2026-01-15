/**
 * Team Routes
 * All team-related endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const teamController = require('../controllers/teamController');
const requestTemplateController = require('../controllers/requestTemplateController');
const teamMessageController = require('../controllers/teamMessageController');
const smartCollectionController = require('../controllers/smartCollectionController');
const mediaShareController = require('../controllers/mediaShareController');

// Team management
router.post('/', authenticateToken, teamController.createTeam);
router.get('/', authenticateToken, teamController.getUserTeams);
router.get('/:teamId', authenticateToken, teamController.getTeam);
router.put('/:teamId', authenticateToken, teamController.updateTeam);
router.delete('/:teamId', authenticateToken, teamController.deleteTeam);

// Team members
router.post('/:teamId/members', authenticateToken, teamController.addTeamMember);
router.delete('/:teamId/members/:userId', authenticateToken, teamController.removeTeamMember);
router.put('/:teamId/members/:userId/role', authenticateToken, teamController.updateTeamMemberRole);

// Team folders
router.get('/:teamId/folders', authenticateToken, teamController.getTeamFolders);

// Request templates
router.post('/:teamId/templates', authenticateToken, requestTemplateController.createTemplate);
router.get('/:teamId/templates', authenticateToken, requestTemplateController.getTeamTemplates);
router.get('/templates/:templateId', authenticateToken, requestTemplateController.getTemplate);
router.put('/templates/:templateId', authenticateToken, requestTemplateController.updateTemplate);
router.delete('/templates/:templateId', authenticateToken, requestTemplateController.deleteTemplate);
router.post('/templates/:templateId/use', authenticateToken, requestTemplateController.useTemplate);

// Team messages/discussion
router.post('/:teamId/messages', authenticateToken, teamMessageController.sendMessage);
router.get('/:teamId/messages', authenticateToken, teamMessageController.getMessages);
router.get('/:teamId/messages/:messageId', authenticateToken, teamMessageController.getMessage);
router.delete('/:teamId/messages/:messageId', authenticateToken, teamMessageController.deleteMessage);
router.post('/:teamId/messages/:messageId/read', authenticateToken, teamMessageController.markAsRead);

// Smart collections
router.post('/collections', authenticateToken, smartCollectionController.createCollection);
router.get('/collections', authenticateToken, smartCollectionController.getCollections);
router.get('/collections/:collectionId', authenticateToken, smartCollectionController.getCollection);
router.put('/collections/:collectionId', authenticateToken, smartCollectionController.updateCollection);
router.delete('/collections/:collectionId', authenticateToken, smartCollectionController.deleteCollection);
router.post('/collections/:collectionId/items', authenticateToken, smartCollectionController.addItemToCollection);
router.delete('/collections/:collectionId/items/:itemId', authenticateToken, smartCollectionController.removeItemFromCollection);

// Team shared media
router.post('/:teamId/shared-media', authenticateToken, mediaShareController.shareMediaWithTeam);
router.get('/:teamId/shared-media', authenticateToken, mediaShareController.getTeamSharedMedia);
router.delete('/:teamId/shared-media/:fileId', authenticateToken, mediaShareController.removeSharedMedia);

module.exports = router;
