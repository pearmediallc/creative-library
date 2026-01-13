const Notification = require('../models/Notification');
const logger = require('../utils/logger');

class NotificationController {
  /**
   * Get notifications for current user
   * GET /api/notifications
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, unread_only = 'false' } = req.query;

      const notifications = await Notification.getByUserId(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        unreadOnly: unread_only === 'true'
      });

      const unreadCount = await Notification.getUnreadCount(userId);

      res.json({
        success: true,
        notifications,
        unreadCount,
        total: notifications.length
      });

    } catch (error) {
      logger.error('Failed to get notifications', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get notifications'
      });
    }
  }

  /**
   * Get unread count
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const count = await Notification.getUnreadCount(userId);

      res.json({
        success: true,
        count
      });

    } catch (error) {
      logger.error('Failed to get unread count', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get unread count'
      });
    }
  }

  /**
   * Mark notification as read
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const notification = await Notification.markAsRead(id, userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      res.json({
        success: true,
        notification
      });

    } catch (error) {
      logger.error('Failed to mark notification as read', {
        error: error.message,
        userId: req.user?.id,
        notificationId: req.params.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark all notifications as read
   * POST /api/notifications/mark-all-read
   */
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const count = await Notification.markAllAsRead(userId);

      res.json({
        success: true,
        count
      });

    } catch (error) {
      logger.error('Failed to mark all as read', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: 'Failed to mark all as read'
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  static async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const notification = await Notification.delete(id, userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted'
      });

    } catch (error) {
      logger.error('Failed to delete notification', {
        error: error.message,
        userId: req.user?.id,
        notificationId: req.params.id
      });
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification'
      });
    }
  }
}

module.exports = NotificationController;
