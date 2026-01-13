const { query } = require('../config/database');

class Notification {
  /**
   * Create a notification
   */
  static async create({
    userId,
    type,
    title,
    message,
    referenceType,
    referenceId,
    metadata = {}
  }) {
    const sql = `
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await query(sql, [
      userId,
      type,
      title,
      message,
      referenceType,
      referenceId,
      JSON.stringify(metadata)
    ]);

    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Get notifications for a user
   */
  static async getByUserId(userId, { limit = 50, offset = 0, unreadOnly = false } = {}) {
    const sql = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ${unreadOnly ? 'AND is_read = FALSE' : ''}
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [userId, limit, offset]);
    return result.rows || result;
  }

  /**
   * Get unread count for user
   */
  static async getUnreadCount(userId) {
    const sql = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
    `;

    const result = await query(sql, [userId]);
    const row = result.rows ? result.rows[0] : result[0];
    return parseInt(row.count);
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId, userId) {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(sql, [notificationId, userId]);
    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Mark all notifications as read for user
   */
  static async markAllAsRead(userId) {
    const sql = `
      UPDATE notifications
      SET is_read = TRUE, read_at = NOW()
      WHERE user_id = $1 AND is_read = FALSE
      RETURNING COUNT(*) as count
    `;

    const result = await query(sql, [userId]);
    const row = result.rows ? result.rows[0] : result[0];
    return parseInt(row.count);
  }

  /**
   * Delete a notification
   */
  static async delete(notificationId, userId) {
    const sql = `
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await query(sql, [notificationId, userId]);
    return result.rows ? result.rows[0] : result[0];
  }

  /**
   * Create mention notifications
   */
  static async createMentionNotifications(mentionedUserIds, mentionedBy, canvasData) {
    const notifications = [];

    for (const userId of mentionedUserIds) {
      if (userId === mentionedBy) continue; // Don't notify yourself

      const notification = await this.create({
        userId,
        type: 'mention',
        title: 'You were mentioned in a canvas',
        message: `${canvasData.mentionedByName} mentioned you in a canvas brief`,
        referenceType: 'canvas',
        referenceId: canvasData.canvasId,
        metadata: {
          fileRequestId: canvasData.fileRequestId,
          mentionedBy: mentionedBy,
          mentionedByName: canvasData.mentionedByName
        }
      });

      notifications.push(notification);
    }

    return notifications;
  }
}

module.exports = Notification;
