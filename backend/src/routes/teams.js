/**
 * Team Routes
 * All team-related endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const teamController = require('../controllers/teamController');
const teamActivityController = require('../controllers/teamActivityController');
const requestTemplateController = require('../controllers/requestTemplateController');
const teamAnalyticsController = require('../controllers/teamAnalyticsController');
const teamMessagesController = require('../controllers/teamMessagesController');
const { checkTeamPermission } = require('../middleware/teamPermissions');

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

// Team activity
router.get('/:teamId/activity', authenticateToken, teamActivityController.getTeamActivity);
router.post('/:teamId/activity', authenticateToken, teamActivityController.logTeamActivity);

// Request templates
router.post('/:teamId/templates', authenticateToken, checkTeamPermission('can_manage_templates'), requestTemplateController.createTemplate);
router.get('/:teamId/templates', authenticateToken, requestTemplateController.getTeamTemplates);
router.get('/templates/:templateId', authenticateToken, requestTemplateController.getTemplate);
router.put('/templates/:templateId', authenticateToken, requestTemplateController.updateTemplate);
router.delete('/templates/:templateId', authenticateToken, requestTemplateController.deleteTemplate);
router.post('/templates/:templateId/use', authenticateToken, requestTemplateController.useTemplate);

// Team analytics
router.get('/:teamId/analytics/summary', authenticateToken, teamAnalyticsController.getAnalyticsSummary);
router.get('/:teamId/analytics/trends', authenticateToken, teamAnalyticsController.getAnalyticsTrends);
router.get('/:teamId/analytics/members', authenticateToken, teamAnalyticsController.getMemberAnalytics);
router.get('/:teamId/analytics/requests', authenticateToken, teamAnalyticsController.getRequestAnalytics);

// Team messages/discussion
router.get('/:teamId/messages', authenticateToken, teamMessagesController.getMessages);
router.post('/:teamId/messages', authenticateToken, teamMessagesController.postMessage);
router.put('/:teamId/messages/:messageId', authenticateToken, teamMessagesController.editMessage);
router.delete('/:teamId/messages/:messageId', authenticateToken, teamMessagesController.deleteMessage);
router.post('/:teamId/messages/:messageId/read', authenticateToken, teamMessagesController.markAsRead);
router.get('/:teamId/messages/unread-count', authenticateToken, teamMessagesController.getUnreadCount);

module.exports = router;
