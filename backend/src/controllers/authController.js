/**
 * Authentication Controller
 * Thin controller - delegates to AuthService
 */

const authService = require('../services/authService');
const logger = require('../utils/logger');

class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req, res, next) {
    try {
      const result = await authService.register(req.body);

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

      res.json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error) {
      logger.error('Login error', { error: error.message, email: req.body.email });

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
}

module.exports = new AuthController();
