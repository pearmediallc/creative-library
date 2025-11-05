/**
 * Editors Routes
 * GET /api/editors - List all editors (with optional stats)
 * GET /api/editors/:id - Get single editor with stats
 * POST /api/editors - Create new editor (Admin only)
 * PATCH /api/editors/:id - Update editor (Admin only)
 */

const express = require('express');
const router = express.Router();
const editorController = require('../controllers/editorController');
const { validate, schemas } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Get all editors (optionally with stats)
router.get('/',
  authenticateToken,
  editorController.getEditors.bind(editorController)
);

// Get single editor with stats
router.get('/:id',
  authenticateToken,
  editorController.getEditor.bind(editorController)
);

// Create editor (Admin only)
router.post('/',
  authenticateToken,
  requireRole('admin'),
  validate(schemas.createEditor),
  editorController.createEditor.bind(editorController)
);

// Update editor (Admin only)
router.patch('/:id',
  authenticateToken,
  requireRole('admin'),
  validate(schemas.updateEditor),
  editorController.updateEditor.bind(editorController)
);

// Delete editor (Admin only) - Soft delete by setting is_active to false
router.delete('/:id',
  authenticateToken,
  requireRole('admin'),
  editorController.deleteEditor.bind(editorController)
);

module.exports = router;
