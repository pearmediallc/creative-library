/**
 * Authentication Routes
 * POST /api/auth/register - Register new user
 * POST /api/auth/login - Login user
 * GET /api/auth/me - Get current user
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validate, schemas } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');
const { validateEmailWhitelist } = require('../middleware/emailValidator');

// Public routes
router.post('/register',
  validateEmailWhitelist,  // ✅ Check email whitelist first
  validate(schemas.register),
  authController.register.bind(authController)
);

router.post('/login',
  validate(schemas.login),
  authController.login.bind(authController)
);

// Protected routes
router.get('/me',
  authenticateToken,
  authController.me.bind(authController)
);

// Update notification preferences
router.patch('/me/notification-preferences',
  authenticateToken,
  authController.updateNotificationPreferences.bind(authController)
);

// Get all users (for mentions dropdown) - authenticated users only
router.get('/users',
  authenticateToken,
  authController.getAllUsers.bind(authController)
);

// Get all buyers (for file request assignment dropdown) - authenticated users only
router.get('/buyers',
  authenticateToken,
  authController.getBuyers.bind(authController)
);

// Get users by role (e.g. /auth/users-by-role?role=creative)
router.get('/users-by-role',
  authenticateToken,
  authController.getUsersByRole.bind(authController)
);

module.exports = router;
