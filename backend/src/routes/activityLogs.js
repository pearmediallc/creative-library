/**
 * Activity Logs Routes
 * Admin-only access to activity logs
 */

const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const activityLogExportService = require('../services/activityLogExportService');

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

// Export endpoints
router.get('/exports',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const history = await activityLogExportService.getExportHistory(30);
      res.json({ exports: history });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get export history' });
    }
  }
);

router.get('/exports/:exportId',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const exportData = await activityLogExportService.getExportById(req.params.exportId);
      if (!exportData) {
        return res.status(404).json({ error: 'Export not found' });
      }
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get export' });
    }
  }
);

router.get('/exports/:exportId/download',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const url = await activityLogExportService.getExportDownloadUrl(req.params.exportId);
      res.json({ downloadUrl: url });
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate download URL' });
    }
  }
);

router.post('/exports/manual',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { targetDate } = req.body;
      if (!targetDate) {
        return res.status(400).json({ error: 'targetDate is required' });
      }
      const result = await activityLogExportService.manualExport(targetDate, req.user.id);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: 'Manual export failed', message: error.message });
    }
  }
);

router.get('/exports/job/status',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const status = await activityLogExportService.getJobStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get job status' });
    }
  }
);

module.exports = router;
