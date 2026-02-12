/**
 * Personal + accessible request templates
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const requestTemplateController = require('../controllers/requestTemplateController');

router.use(authenticateToken);

// Get templates accessible to current user (personal + all team templates they belong to)
router.get('/', requestTemplateController.getAccessibleTemplates);

// Create personal template
router.post('/', requestTemplateController.createPersonalTemplate);

module.exports = router;
