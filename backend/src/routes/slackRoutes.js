// ============================================
// SLACK ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const slackController = require('../controllers/slackController');
const { authenticateToken } = require('../middleware/auth');

// OAuth routes
router.get('/oauth/initiate', authenticateToken, slackController.initiateOAuth);
router.get('/oauth/callback', slackController.handleOAuthCallback);

// Connection management
router.get('/status', authenticateToken, slackController.getConnectionStatus);
router.post('/disconnect', authenticateToken, slackController.disconnect);

// Notification preferences
router.get('/preferences', authenticateToken, slackController.getNotificationPreferences);
router.put('/preferences', authenticateToken, slackController.updateNotificationPreferences);

// Connected users
router.get('/connected-users', authenticateToken, slackController.getConnectedUsers);

// Manual notifications
router.post('/notify', authenticateToken, slackController.sendManualNotification);

// Testing
router.post('/test', authenticateToken, slackController.testNotification);

module.exports = router;
