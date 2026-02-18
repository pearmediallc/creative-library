const Notification = require('../models/Notification');
const { query } = require('../config/database');
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
   * Get pending action counts for sidebar badges
   * GET /api/notifications/pending-counts
   * Returns: { fileRequests: number, launchRequests: number }
   * Role-aware: what this user needs to act on
   */
  static async getPendingCounts(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      let fileRequestCount = 0;
      let launchRequestCount = 0;

      if (userRole === 'creative') {
        // Creatives: file requests assigned to them that are not completed
        const editorResult = await query(
          `SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
          [userId]
        );
        if (editorResult.rows.length > 0) {
          const editorId = editorResult.rows[0].id;

          const frResult = await query(
            `SELECT COUNT(DISTINCT fre.request_id) as cnt
             FROM file_request_editors fre
             JOIN file_requests fr ON fr.id = fre.request_id
             WHERE fre.editor_id = $1
               AND fre.status != 'completed'
               AND fr.is_active = TRUE`,
            [editorId]
          );
          fileRequestCount = parseInt(frResult.rows[0]?.cnt || '0', 10);
        }

        // Launch requests: user is creative head OR assigned as editor, and status is actionable
        try {
          const lrResult = await query(
            `SELECT COUNT(DISTINCT lr.id) as cnt
             FROM launch_requests lr
             WHERE lr.status IN ('pending_review', 'in_production')
               AND (
                 lr.creative_head_id = $1
                 OR EXISTS (
                   SELECT 1 FROM launch_request_editors lre
                   JOIN editors e ON e.id = lre.editor_id
                   WHERE lre.launch_request_id = lr.id AND e.user_id = $1
                 )
               )`,
            [userId]
          );
          launchRequestCount = parseInt(lrResult.rows[0]?.cnt || '0', 10);
        } catch (_e) {
          // launch_requests table may not exist yet
          launchRequestCount = 0;
        }

      } else if (userRole === 'buyer') {
        // Buyers: file requests assigned to them that are active
        const frResult = await query(
          `SELECT COUNT(*) as cnt FROM file_requests
           WHERE assigned_buyer_id = $1 AND is_active = TRUE`,
          [userId]
        );
        fileRequestCount = parseInt(frResult.rows[0]?.cnt || '0', 10);

        // Launch requests: user is buyer head OR assigned as buyer, with actionable status
        try {
          const lrResult = await query(
            `SELECT COUNT(DISTINCT lr.id) as cnt
             FROM launch_requests lr
             WHERE lr.status IN ('ready_to_launch', 'buyer_assigned')
               AND (
                 lr.buyer_head_id = $1
                 OR EXISTS (
                   SELECT 1 FROM launch_request_buyers lrb
                   WHERE lrb.launch_request_id = lr.id AND lrb.buyer_id = $1
                 )
               )`,
            [userId]
          );
          launchRequestCount = parseInt(lrResult.rows[0]?.cnt || '0', 10);
        } catch (_e) {
          launchRequestCount = 0;
        }

      } else if (userRole === 'admin') {
        // Admins: file requests that are open (not yet assigned / started)
        const frResult = await query(
          `SELECT COUNT(*) as cnt FROM file_requests WHERE is_active = TRUE`,
          []
        );
        fileRequestCount = parseInt(frResult.rows[0]?.cnt || '0', 10);

        // Launch requests: pending review for creative head, or in any active state
        try {
          const lrResult = await query(
            `SELECT COUNT(*) as cnt FROM launch_requests
             WHERE status NOT IN ('closed', 'launched', 'draft')`,
            []
          );
          launchRequestCount = parseInt(lrResult.rows[0]?.cnt || '0', 10);
        } catch (_e) {
          launchRequestCount = 0;
        }
      }

      res.json({
        success: true,
        data: {
          fileRequests: fileRequestCount,
          launchRequests: launchRequestCount
        }
      });

    } catch (error) {
      logger.error('Failed to get pending counts', { error: error.message, userId: req.user?.id });
      // Return zeros on error so badge doesn't break the sidebar
      res.json({
        success: true,
        data: { fileRequests: 0, launchRequests: 0 }
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
