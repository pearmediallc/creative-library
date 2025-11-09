/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  console.log('========== AUTH DEBUG START ==========');
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
  console.log('JWT_SECRET first 20 chars:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 20) : 'UNDEFINED');
  console.log('Token received:', token ? token.substring(0, 50) + '...' : 'NO TOKEN');
  console.log('Auth header:', authHeader);
  console.log('========== AUTH DEBUG END ==========');

  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  try {
    console.log('🔍 Attempting to verify token with JWT_SECRET...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified successfully:', { userId: decoded.id, email: decoded.email, role: decoded.role });
    req.user = decoded;
    next();
  } catch (error) {
    console.log('❌ Token verification FAILED');
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Full error:', error);
    logger.warn('Invalid token attempt', { error: error.message });
    return res.status(403).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
}

/**
 * Check if user has required role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized role access attempt', {
        userId: req.user.id,
        role: req.user.role,
        requiredRoles: roles
      });
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

/**
 * Optional authentication (attach user if token present, but don't require it)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (error) {
      // Invalid token, but we don't fail - just continue without user
      logger.debug('Optional auth - invalid token', { error: error.message });
    }
  }

  next();
}

/**
 * Require admin role
 * Convenience middleware for admin-only routes
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin') {
    logger.warn('Admin access denied', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role
    });
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  next();
}

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  optionalAuth
};
