const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Team CRUD
router.post('/', teamController.createTeam);
router.get('/', teamController.getUserTeams);
router.get('/:id', teamController.getTeam);
router.patch('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

// Team members
router.get('/:id/members', teamController.getMembers);
router.post('/:id/members', teamController.addMember);
router.delete('/:id/members/:userId', teamController.removeMember);
router.patch('/:id/members/:userId/role', teamController.updateMemberRole);

module.exports = router;
