const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Team CRUD
router.post('/', teamController.createTeam);
router.get('/', teamController.getUserTeams);
router.get('/:id', teamController.getTeam);
router.patch('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

// Team members
router.post('/:id/members', teamController.addMember);
router.delete('/:id/members/:userId', teamController.removeMember);

module.exports = router;
