const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Team CRUD
router.post('/', teamController.createTeam.bind(teamController));
router.get('/', teamController.getUserTeams.bind(teamController));
router.get('/:id', teamController.getTeam.bind(teamController));
router.patch('/:id', teamController.updateTeam.bind(teamController));
router.delete('/:id', teamController.deleteTeam.bind(teamController));

// Team members
router.get('/:id/members', teamController.getMembers.bind(teamController));
router.post('/:id/members', teamController.addMember.bind(teamController));
router.delete('/:id/members/:userId', teamController.removeMember.bind(teamController));
router.patch('/:id/members/:userId/role', teamController.updateMemberRole.bind(teamController));

module.exports = router;
