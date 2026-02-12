/**
 * Workload Management Routes
 * Admin-only routes for managing editor workload and capacity
 */

const express = require('express');
const router = express.Router();
const workloadController = require('../controllers/workloadController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// Get workload overview for all editors
router.get('/overview', workloadController.getOverview.bind(workloadController));

// Get detailed workload for a specific editor
router.get('/editor/:editorId', workloadController.getEditorWorkload.bind(workloadController));

// Admin override: mark editor free (optionally complete active assignments)
router.post('/editor/:editorId/mark-free', workloadController.markEditorFree.bind(workloadController));

// Update editor capacity settings
router.put('/capacity/:editorId', workloadController.updateCapacity.bind(workloadController));

// Get workload analytics
router.get('/analytics', workloadController.getAnalytics.bind(workloadController));

// Get workload recommendations
router.get('/recommendations', workloadController.getRecommendations.bind(workloadController));

// Update file request time estimate (accessible to all authenticated users)
router.put(
  '/request/:id/estimate',
  authenticateToken,
  workloadController.updateEstimate.bind(workloadController)
);

module.exports = router;
