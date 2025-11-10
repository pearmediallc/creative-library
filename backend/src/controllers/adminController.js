const User = require('../models/User');
const Editor = require('../models/Editor');
const MediaFile = require('../models/MediaFile');
const AllowedEmail = require('../models/AllowedEmail');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { logActivity } = require('../middleware/activityLogger');

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

  /**
   * Get pending user registrations
   * GET /api/admin/pending-users
   */
  async getPendingUsers(req, res, next) {
    try {
      const pendingUsers = await User.findAll(
        { approval_status: 'pending' },
        'created_at ASC'
      );

      // Sanitize
      const sanitized = pendingUsers.map(u => {
        const { password_hash, ...rest } = u;
        return rest;
      });

      res.json({
        success: true,
        data: sanitized
      });
    } catch (error) {
      logger.error('Get pending users error', { error: error.message });
      next(error);
    }
  }

  /**
   * Approve user registration
   * POST /api/admin/approve-user/:id
   */
  async approveUser(req, res, next) {
    try {
      const { id } = req.params;
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.approval_status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `User is not pending approval (current status: ${user.approval_status})`
        });
      }

      // Approve user
      await User.update(id, {
        approval_status: 'approved',
        is_active: true,
        approved_by: req.user.id,
        approved_at: new Date()
      });

      // Auto-create editor for creative users
      if (user.role === 'creative') {
        try {
          const editorName = user.name.toUpperCase().replace(/\s+/g, '');
          const displayName = user.name;

          const existingEditor = await Editor.findByName(editorName);

          if (!existingEditor) {
            const { query } = require('../config/database');
            await query(`
              INSERT INTO editors (name, display_name, user_id, is_active)
              VALUES ($1, $2, $3, TRUE)
            `, [editorName, displayName, user.id]);

            logger.info('Editor entity auto-created on approval', {
              userId: user.id,
              editorName,
              displayName,
              approvedBy: req.user.id
            });
          } else if (!existingEditor.user_id) {
            // Link existing editor to this user
            await Editor.update(existingEditor.id, { user_id: user.id });
            logger.info('Existing editor linked to approved user', {
              userId: user.id,
              editorId: existingEditor.id
            });
          }
        } catch (error) {
          logger.error('Failed to create/link editor on approval', {
            userId: user.id,
            error: error.message
          });
        }
      }

      logger.info('User approved by admin', {
        userId: id,
        userEmail: user.email,
        userRole: user.role,
        approvedBy: req.user.id,
        approvedByEmail: req.user.email
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'user_approval',
        resourceType: 'user',
        resourceId: id,
        resourceName: user.email,
        details: {
          user_name: user.name,
          user_role: user.role
        },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'User approved successfully'
      });
    } catch (error) {
      logger.error('Approve user error', { error: error.message });
      next(error);
    }
  }

  /**
   * Reject user registration
   * POST /api/admin/reject-user/:id
   * Body: { reason: string }
   */
  async rejectUser(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (user.approval_status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `User is not pending approval (current status: ${user.approval_status})`
        });
      }

      // Reject user
      await User.update(id, {
        approval_status: 'rejected',
        is_active: false,
        rejection_reason: reason || 'No reason provided',
        approved_by: req.user.id,
        approved_at: new Date()
      });

      logger.info('User rejected by admin', {
        userId: id,
        userEmail: user.email,
        rejectedBy: req.user.id,
        rejectedByEmail: req.user.email,
        reason
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'user_rejection',
        resourceType: 'user',
        resourceId: id,
        resourceName: user.email,
        details: {
          user_name: user.name,
          user_role: user.role,
          reason
        },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'User registration rejected'
      });
    } catch (error) {
      logger.error('Reject user error', { error: error.message });
      next(error);
    }
  }

  /**
   * Reset user password (Admin only)
   * POST /api/admin/users/:id/reset-password
   * Body: { admin_password: string, new_password: string }
   */
  async resetUserPassword(req, res, next) {
    try {
      const { id } = req.params;
      const { admin_password, new_password } = req.body;

      // Validate new password
      if (!new_password || new_password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'New password must be at least 8 characters'
        });
      }

      // Verify admin password
      const admin = await User.findById(req.user.id);
      const isValidPassword = await bcrypt.compare(admin_password, admin.password_hash);

      if (!isValidPassword) {
        logger.warn('Failed password reset - invalid admin password', {
          adminId: req.user.id,
          targetUserId: id,
          ip: req.ip
        });

        return res.status(401).json({
          success: false,
          error: 'Invalid admin password'
        });
      }

      // Get target user
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(new_password, 10);

      // Update user password
      await User.update(id, {
        password_hash: newPasswordHash,
        password_changed_by: req.user.id,
        password_changed_at: new Date()
      });

      // Log in audit table
      const { query } = require('../config/database');
      await query(`
        INSERT INTO password_audit_log (user_id, admin_id, action, ip_address, user_agent)
        VALUES ($1, $2, 'reset', $3, $4)
      `, [id, req.user.id, req.ip, req.headers['user-agent']]);

      logger.info('Admin reset user password', {
        adminId: req.user.id,
        adminEmail: admin.email,
        targetUserId: id,
        targetEmail: user.email,
        ip: req.ip
      });

      // Log activity
      await logActivity({
        req,
        actionType: 'password_reset',
        resourceType: 'user',
        resourceId: id,
        resourceName: user.email,
        details: {
          user_name: user.name,
          reset_by_admin: admin.email
        },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Password reset successfully',
        data: {
          new_password: new_password  // Return to admin to give to user
        }
      });
    } catch (error) {
      logger.error('Reset password error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get allowed emails whitelist
   * GET /api/admin/allowed-emails
   */
  async getAllowedEmails(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      const emails = await AllowedEmail.getActiveEmails(limit, offset);
      const total = await AllowedEmail.count({ is_active: true });

      res.json({
        success: true,
        data: {
          emails,
          pagination: {
            total,
            limit,
            offset
          }
        }
      });
    } catch (error) {
      logger.error('Get allowed emails error', { error: error.message });
      next(error);
    }
  }

  /**
   * Add email to whitelist
   * POST /api/admin/allowed-emails
   * Body: { email, department, job_title, notes }
   */
  async addAllowedEmail(req, res, next) {
    try {
      const { email, department, job_title, notes } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      // Check if email already exists
      const existing = await AllowedEmail.findByEmail(email);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Email already in whitelist'
        });
      }

      const allowedEmail = await AllowedEmail.addEmail({
        email,
        department,
        job_title,
        notes,
        added_by: req.user.id
      });

      logger.info('Email added to whitelist', {
        email,
        addedBy: req.user.id,
        addedByEmail: req.user.email
      });

      res.status(201).json({
        success: true,
        message: 'Email added to whitelist',
        data: allowedEmail
      });
    } catch (error) {
      logger.error('Add allowed email error', { error: error.message });
      next(error);
    }
  }

  /**
   * Bulk import emails to whitelist
   * POST /api/admin/allowed-emails/bulk-import
   * Body: { emails: [{ email, department, job_title, notes }] }
   */
  async bulkImportEmails(req, res, next) {
    try {
      const { emails } = req.body;

      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Emails array is required'
        });
      }

      const results = await AllowedEmail.bulkImport(emails, req.user.id);

      logger.info('Bulk email import completed', {
        total: emails.length,
        success: results.success.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length,
        importedBy: req.user.id
      });

      res.json({
        success: true,
        message: 'Bulk import completed',
        data: results
      });
    } catch (error) {
      logger.error('Bulk import emails error', { error: error.message });
      next(error);
    }
  }

  /**
   * Remove email from whitelist
   * DELETE /api/admin/allowed-emails/:id
   */
  async removeAllowedEmail(req, res, next) {
    try {
      const { id } = req.params;

      const email = await AllowedEmail.findById(id);
      if (!email) {
        return res.status(404).json({
          success: false,
          error: 'Email not found in whitelist'
        });
      }

      await AllowedEmail.deactivateEmail(id);

      logger.info('Email removed from whitelist', {
        emailId: id,
        email: email.email,
        removedBy: req.user.id
      });

      res.json({
        success: true,
        message: 'Email removed from whitelist'
      });
    } catch (error) {
      logger.error('Remove allowed email error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new AdminController();
