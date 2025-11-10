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
    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Validate role
    const validRoles = ['admin', 'creative', 'buyer'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role');
    }

    // Create user
    const user = await User.createUser({ name, email, password, role });

    logger.info('User registered', { userId: user.id, email: user.email });

    // Auto-create Editor entity for creative users
    if (role === 'creative') {
      try {
        const displayName = name;
        const editorName = name.toUpperCase().replace(/\s+/g, '');

        // Check if editor with this name already exists
        const existingEditor = await Editor.findByName(editorName);

        if (existingEditor) {
          logger.warn('Editor name already exists', {
            userId: user.id,
            editorName,
            existingEditorId: existingEditor.id
          });
        } else {
          // Create editor entity linked to this user
          const { query } = require('../config/database');
          await query(`
            INSERT INTO editors (name, display_name, user_id, is_active)
            VALUES ($1, $2, $3, TRUE)
          `, [editorName, displayName, user.id]);

          logger.info('Editor entity auto-created for creative user', {
            userId: user.id,
            editorName,
            displayName
          });
        }
      } catch (error) {
        // Don't fail registration if editor creation fails
        logger.error('Failed to auto-create editor entity', {
          userId: user.id,
          error: error.message
        });
      }
    }

    // Generate token
    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token
    };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    console.log('========== LOGIN DEBUG START ==========');
    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0);
    console.log('JWT_SECRET first 20 chars:', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 20) : 'UNDEFINED');
    console.log('========== LOGIN DEBUG END ==========');

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if active
    if (!user.is_active) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const isValid = await User.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    logger.info('User logged in', { userId: user.id, email: user.email });

    // Generate token
    const token = this.generateToken(user);
    console.log('🎫 Generated token:', token.substring(0, 50) + '...');

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

    console.log('🔐 Generating token with payload:', payload);
    console.log('🔑 Using JWT_SECRET (first 20 chars):', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 20) : 'UNDEFINED');
    console.log('⏰ Token expiry:', process.env.JWT_EXPIRY || '7d');

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRY || '7d'
    });

    console.log('✅ Token generated successfully, length:', token.length);

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
}

module.exports = new AuthService();
