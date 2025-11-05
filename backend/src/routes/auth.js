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

// Public routes
router.post('/register',
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

module.exports = router;
