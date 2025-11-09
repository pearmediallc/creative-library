/**
 * Activity Logs Routes
 * Admin-only access to activity logs
 */

const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All activity log routes require admin role
router.get('/',
  authenticateToken,
  requireAdmin,
  activityLogController.getLogs.bind(activityLogController)
);

router.get('/filters',
  authenticateToken,
  requireAdmin,
  activityLogController.getFilters.bind(activityLogController)
);

module.exports = router;
