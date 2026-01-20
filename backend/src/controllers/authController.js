/**
 * Authentication Controller
 * Thin controller - delegates to AuthService
 */

const authService = require('../services/authService');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');

class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);

      // Log registration activity (without req.user since not authenticated yet)
      await logActivity({
        req,
        actionType: 'user_register',
        resourceType: 'user',
        resourceId: result.user.id,
        resourceName: result.user.email,
        details: {
          name: result.user.name,
          role: result.user.role
        },
        status: 'success'
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error) {
      logger.error('Registration error', { error: error.message, email: req.body.email });
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const result = await authService.login(req.body);

      // Log successful login (without req.user since JWT not yet in request)
      await logActivity({
        req,
        actionType: 'user_login',
        resourceType: 'user',
        resourceId: result.user.id,
        resourceName: result.user.email,
        details: {
          name: result.user.name,
          role: result.user.role
        },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      logger.error('Login error', { error: error.message, email: req.body.email });

      // Log failed login attempt
      try {
        await logActivity({
          req,
          actionType: 'user_login',
          resourceType: 'user',
          resourceId: null,
          resourceName: req.body.email,
          details: { reason: error.message },
          status: 'failure',
          errorMessage: error.message
        });
      } catch (logErr) {
        logger.error('Failed to log login failure', { error: logErr.message });
      }

      // Return 401 for invalid credentials
      if (error.message === 'Invalid credentials' || error.message === 'Account is disabled') {
        return res.status(401).json({
          success: false,
          error: error.message
        });
      }

      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  async me(req, res, next) {
    try {
      // req.user is set by authenticateToken middleware
      res.json({
        success: true,
        data: { user: req.user }
      });
    } catch (error) {
      logger.error('Get current user error', { error: error.message, userId: req.user?.id });
      next(error);
    }
  }

  /**
   * GET /api/auth/users
   * Get all active users (for mentions dropdown)
   */
  async getAllUsers(req, res, next) {
    try {
      const result = await authService.getAllActiveUsers();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get all users error', { error: error.message });
      next(error);
    }
  }

  /**
   * GET /api/auth/buyers
   * Get all active buyers (for file request assignment dropdown)
   */
  async getBuyers(req, res, next) {
    try {
      const result = await authService.getBuyers();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get buyers error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new AuthController();
