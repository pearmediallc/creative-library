// ============================================
// SLACK ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const slackController = require('../controllers/slackController');
const authMiddleware = require('../middleware/authMiddleware');

// OAuth routes
router.get('/oauth/initiate', authMiddleware, slackController.initiateOAuth);
router.get('/oauth/callback', slackController.handleOAuthCallback);

// Connection management
router.get('/status', authMiddleware, slackController.getConnectionStatus);
router.post('/disconnect', authMiddleware, slackController.disconnect);

// Notification preferences
router.get('/preferences', authMiddleware, slackController.getNotificationPreferences);
router.put('/preferences', authMiddleware, slackController.updateNotificationPreferences);

// Testing
router.post('/test', authMiddleware, slackController.testNotification);

module.exports = router;
