/**
 * Authentication Service
 * Handles user registration, login, and token generation
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Editor = require('../models/Editor');
const logger = require('../utils/logger');

class AuthService {
  /**
   * Register new user
   */
  async register({ name, email, password, role = 'creative' }) {
    // Email whitelist already validated by middleware

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      if (existingUser.approval_status === 'rejected') {
        throw new Error('Your previous registration was not approved. Please contact your administrator.');
      }
      if (existingUser.approval_status === 'pending') {
        throw new Error('Your registration is pending approval. Please wait for confirmation.');
      }
      throw new Error('Email already registered');
    }

    // Validate role
    const validRoles = ['admin', 'creative', 'buyer'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    // Create user
    const user = await User.createUser({ name, email, password, role });

    // Set to pending approval
    await User.update(user.id, {
      is_active: false,
      approval_status: 'pending',
      email_verified: true  // Skip email verification for now
    });

    logger.info('New user registration - pending approval', {
      userId: user.id,
      email: user.email,
      role,
      name
    });

    return {
      message: 'Registration submitted successfully. Your account is pending admin approval.',
      requiresApproval: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check approval status
    if (user.approval_status === 'pending') {
      logger.warn('Login attempt with pending account', {
        userId: user.id,
        email: user.email
      });
      throw new Error('Your account is pending admin approval. Please wait for confirmation.');
    }

    if (user.approval_status === 'rejected') {
      logger.warn('Login attempt with rejected account', {
        userId: user.id,
        email: user.email
      });
      throw new Error('Your registration was not approved. Please contact your administrator.');
    }

    // Check if active
    if (!user.is_active) {
      throw new Error('Your account has been deactivated. Please contact your administrator.');
    }

    // Verify password
    const isValid = await User.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    logger.info('User logged in', { userId: user.id, email: user.email, role: user.role });

    // Generate token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '7d'
    });

    return token;
  }

  /**
   * Verify token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Remove sensitive fields from user object
   */
  sanitizeUser(user) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Get current user by ID
   */
  async getCurrentUser(userId) {
    const user = await User.getSafeUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Get all active users (for mentions dropdown)
   */
  async getAllActiveUsers() {
    const { query } = require('../config/database');
    const result = await query(
      `SELECT id, name, email, role
       FROM users
       WHERE is_active = TRUE
       ORDER BY name ASC`
    );
    return result.rows || result;
  }

  /**
   * Get all active buyers (for file request assignment dropdown)
   */
  async getBuyers() {
    const { query } = require('../config/database');
    const result = await query(
      `SELECT id, name, email
       FROM users
       WHERE is_active = TRUE AND role = 'buyer'
       ORDER BY name ASC`
    );
    return result.rows || result;
  }
}

module.exports = new AuthService();
