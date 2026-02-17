/**
 * Launch Request Routes
 * Creative Strategist → Creative Head + Buyer Head → Media Buyers
 */

const express = require('express');
const router = express.Router();
const launchRequestController = require('../controllers/launchRequestController');
const { authenticateToken } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// ─── CRUD ───────────────────────────────────────────────────────────────────

// Create new launch request
router.post('/', authenticateToken, (req, res) => launchRequestController.create(req, res));

// Get all launch requests for current user (role-filtered)
router.get('/', authenticateToken, (req, res) => launchRequestController.getAll(req, res));

// Get single launch request
router.get('/:id', authenticateToken, (req, res) => launchRequestController.getOne(req, res));

// Update launch request fields
router.patch('/:id', authenticateToken, (req, res) => launchRequestController.update(req, res));

// Delete launch request
router.delete('/:id', authenticateToken, (req, res) => launchRequestController.delete(req, res));

// ─── STATUS TRANSITIONS ─────────────────────────────────────────────────────

// Strategist submits (draft → pending_review)
router.post('/:id/submit', authenticateToken, (req, res) => launchRequestController.submit(req, res));

// Creative head accepts (pending_review → in_production)
router.post('/:id/accept', authenticateToken, (req, res) => launchRequestController.acceptByCreativeHead(req, res));

// Creative head marks ready (in_production → ready_to_launch)
router.post('/:id/mark-ready', authenticateToken, (req, res) => launchRequestController.markReadyToLaunch(req, res));

// Buyer head assigns files to buyers (ready_to_launch → buyer_assigned)
router.post('/:id/assign-buyers', authenticateToken, (req, res) => launchRequestController.assignBuyers(req, res));

// Buyer marks as launched (buyer_assigned → launched)
router.post('/:id/launch', authenticateToken, (req, res) => launchRequestController.launch(req, res));

// Close (launched → closed)
router.post('/:id/close', authenticateToken, (req, res) => launchRequestController.close(req, res));

// Reopen (closed → reopened)
router.post('/:id/reopen', authenticateToken, (req, res) => launchRequestController.reopen(req, res));

// ─── REASSIGNMENT ───────────────────────────────────────────────────────────

// Reassign creative head
router.post('/:id/reassign-creative-head', authenticateToken, (req, res) => launchRequestController.reassignCreativeHead(req, res));

// Reassign buyer head
router.post('/:id/reassign-buyer-head', authenticateToken, (req, res) => launchRequestController.reassignBuyerHead(req, res));

// ─── EDITOR ASSIGNMENT (creative side) ──────────────────────────────────────

// Assign / reassign editors with optional creative distribution
router.post('/:id/assign-editors', authenticateToken, (req, res) => launchRequestController.assignEditors(req, res));

// ─── UPLOADS ────────────────────────────────────────────────────────────────

// Upload a creative file (authenticated — editors/creative head)
router.post('/:id/upload', authenticateToken, upload.single('file'), (req, res) => launchRequestController.upload(req, res));

// ─── TEMPLATES ──────────────────────────────────────────────────────────────

// Get user's saved launch request templates
router.get('/templates/list', authenticateToken, (req, res) => launchRequestController.getTemplates(req, res));

// Save a new template
router.post('/templates', authenticateToken, (req, res) => launchRequestController.saveTemplate(req, res));

// Soft-delete a template
router.delete('/templates/:templateId', authenticateToken, (req, res) => launchRequestController.deleteTemplate(req, res));

module.exports = router;
