const User = require('../models/User');
const Editor = require('../models/Editor');
const MediaFile = require('../models/MediaFile');
const logger = require('../utils/logger');

class AdminController {
  /**
   * Get all users (Admin only)
   * GET /api/admin/users
   */
  async getUsers(req, res, next) {
    try {
      const users = await User.findAll({}, 'created_at DESC');

      // Sanitize password hashes
      const sanitizedUsers = users.map(user => {
        const { password_hash, ...rest } = user;
        return rest;
      });

      res.json({
        success: true,
        data: sanitizedUsers
      });
    } catch (error) {
      logger.error('Get users error', { error: error.message });
      next(error);
    }
  }

  /**
   * Create user (Admin only)
   * POST /api/admin/users
   */
  async createUser(req, res, next) {
    try {
      const { name, email, password, role, upload_limit_monthly } = req.body;

      // Check if user exists
      const existing = await User.findByEmail(email);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'User with this email already exists'
        });
      }

      // Create user
      const user = await User.createUser({
        name,
        email,
        password,
        role,
        upload_limit_monthly
      });

      logger.info('User created by admin', { userId: user.id, email, createdBy: req.user.id });

      // Auto-create Editor entity for creative users
      if (role === 'creative') {
        try {
          const displayName = name;
          const editorName = name.toUpperCase().replace(/\s+/g, '');

          // Check if editor with this name already exists
          const existingEditor = await Editor.findByName(editorName);

          if (!existingEditor) {
            const { query } = require('../config/database');
            await query(`
              INSERT INTO editors (name, display_name, user_id, is_active)
              VALUES ($1, $2, $3, TRUE)
            `, [editorName, displayName, user.id]);

            logger.info('Editor entity auto-created by admin', {
              userId: user.id,
              editorName,
              displayName,
              createdBy: req.user.id
            });
          }
        } catch (error) {
          logger.error('Failed to auto-create editor entity', {
            userId: user.id,
            error: error.message
          });
        }
      }

      const { password_hash, ...sanitizedUser } = user;

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: sanitizedUser
      });
    } catch (error) {
      logger.error('Create user error', { error: error.message });
      next(error);
    }
  }

  /**
   * Update user (Admin only)
   * PATCH /api/admin/users/:id
   */
  async updateUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const updates = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.role) updates.role = req.body.role;
      if (req.body.upload_limit_monthly !== undefined) {
        updates.upload_limit_monthly = req.body.upload_limit_monthly;
      }
      if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;

      const updatedUser = await User.update(req.params.id, updates);

      logger.info('User updated by admin', { userId: req.params.id, updates, updatedBy: req.user.id });

      const { password_hash, ...sanitizedUser } = updatedUser;

      res.json({
        success: true,
        message: 'User updated successfully',
        data: sanitizedUser
      });
    } catch (error) {
      logger.error('Update user error', { error: error.message, userId: req.params.id });
      next(error);
    }
  }

  /**
   * Get system statistics (Admin only)
   * GET /api/admin/stats
   */
  async getSystemStats(req, res, next) {
    try {
      const userCount = await User.count();
      const editorCount = await Editor.count();
      const storageStats = await MediaFile.getStorageStats();

      res.json({
        success: true,
        data: {
          users: {
            total: userCount
          },
          editors: {
            total: editorCount
          },
          storage: storageStats
        }
      });
    } catch (error) {
      logger.error('Get system stats error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new AdminController();
