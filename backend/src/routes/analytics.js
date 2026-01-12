/**
 * Analytics Routes
 * Facebook ad analytics and ad name change tracking
 */

const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Sync Facebook ads (Admin only)
router.post('/sync',
  authenticateToken,
  requireAdmin,
  analyticsController.syncAds.bind(analyticsController)
);

// Stop ongoing sync operation (Admin only)
router.post('/sync/stop',
  authenticateToken,
  requireAdmin,
  analyticsController.stopSync.bind(analyticsController)
);

// Get editor performance data (Admin and Editor/Creative roles)
// Editors will only see their own data; admins see all
router.get('/editor-performance',
  authenticateToken,
  analyticsController.getEditorPerformance.bind(analyticsController)
);

// Get editor media uploads with filtering (Admin and Editor roles)
router.get('/editor-media',
  authenticateToken,
  analyticsController.getEditorMedia.bind(analyticsController)
);

// Get ads without editor assignment (Admin only)
router.get('/ads-without-editor',
  authenticateToken,
  requireAdmin,
  analyticsController.getAdsWithoutEditor.bind(analyticsController)
);

// Get ad name change history (Admin only)
router.get('/ad-name-changes',
  authenticateToken,
  requireAdmin,
  analyticsController.getAdNameChanges.bind(analyticsController)
);

// Get unified analytics (Facebook + RedTrack) (Admin only)
router.get('/unified',
  authenticateToken,
  requireAdmin,
  analyticsController.getUnifiedAnalytics.bind(analyticsController)
);

module.exports = router;
