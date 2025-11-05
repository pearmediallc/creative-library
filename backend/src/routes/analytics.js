/**
 * Analytics Routes
 * Facebook ad analytics and ad name change tracking
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

// Sync Facebook ads
router.post('/sync',
  authenticateToken,
  analyticsController.syncAds.bind(analyticsController)
);

// Get editor performance data
router.get('/editor-performance',
  authenticateToken,
  analyticsController.getEditorPerformance.bind(analyticsController)
);

// Get ads without editor assignment
router.get('/ads-without-editor',
  authenticateToken,
  analyticsController.getAdsWithoutEditor.bind(analyticsController)
);

// Get ad name change history
router.get('/ad-name-changes',
  authenticateToken,
  analyticsController.getAdNameChanges.bind(analyticsController)
);

module.exports = router;
