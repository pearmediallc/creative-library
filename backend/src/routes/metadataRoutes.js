const express = require('express');
const router = express.Router();
const metadataController = require('../controllers/metadataController');
const { authenticate } = require('../middleware/auth');

// All metadata routes require authentication
router.use(authenticate);

/**
 * Add metadata to file (embed creator info)
 * POST /api/metadata/add
 * Body (multipart/form-data):
 *   - file: File to process
 *   - creator_id: Creator/editor name (required)
 *   - description: Optional description
 *   - title: Optional title
 *   - keywords: Optional keywords
 *   - custom_fields: Optional JSON string of custom fields
 */
router.post('/add', metadataController.upload, metadataController.addMetadata);

/**
 * Remove metadata from file (strip EXIF/GPS)
 * POST /api/metadata/remove
 * Body (multipart/form-data):
 *   - file: File to process
 */
router.post('/remove', metadataController.upload, metadataController.removeMetadata);

/**
 * Extract metadata from file (read-only)
 * POST /api/metadata/extract
 * Body (multipart/form-data):
 *   - file: File to extract metadata from
 */
router.post('/extract', metadataController.upload, metadataController.extractMetadata);

module.exports = router;
