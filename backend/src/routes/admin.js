/**
 * Admin Routes
 * User and editor management (admin only)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { validate, schemas } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// User management
router.get('/users',
  adminController.getUsers.bind(adminController)
);

router.post('/users',
  validate(schemas.createUser),
  adminController.createUser.bind(adminController)
);

router.patch('/users/:id',
  validate(schemas.updateUser),
  adminController.updateUser.bind(adminController)
);

// System statistics
router.get('/stats',
  adminController.getSystemStats.bind(adminController)
);

module.exports = router;
