/**
 * Email Whitelist Validation Middleware
 *
 * Validates user email against allowed_emails whitelist table
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Check if email exists in whitelist
 */
async function checkEmailWhitelist(email) {
  try {
    const result = await query(`
      SELECT id, email, department, is_active
      FROM allowed_emails
      WHERE LOWER(email) = LOWER($1)
      AND is_active = TRUE
      LIMIT 1
    `, [email]);

    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error('Email whitelist check failed', { error: error.message });
    throw error;
  }
}

/**
 * Validate email against whitelist
 * Middleware for registration
 */
async function validateEmailWhitelist(req, res, next) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }

  try {
    // Check if email is in whitelist
    const whitelisted = await checkEmailWhitelist(email);

    if (!whitelisted) {
      logger.warn('Registration blocked - email not in whitelist', {
        email: email.split('@')[0] + '@***',  // Partial email for privacy
        domain: email.split('@')[1],
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        success: false,
        error: 'Please use your official email address to register'
      });
    }

    // Attach whitelist info to request for later use
    req.emailWhitelist = whitelisted;

    logger.debug('Email whitelist validation passed', {
      email: email.split('@')[0] + '@***',
      department: whitelisted.department
    });

    next();
  } catch (error) {
    logger.error('Email validation error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to validate email'
    });
  }
}

module.exports = {
  validateEmailWhitelist,
  checkEmailWhitelist
};
