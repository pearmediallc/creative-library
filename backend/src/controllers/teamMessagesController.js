/**
 * Team Messages Controller
 * Handles team discussion/chat functionality
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const Notification = require('../models/Notification');

class TeamMessagesController {
  /**
   * Get messages for a team
   * GET /api/teams/:teamId/messages
   */
  async getMessages(req, res, next) {
    try {
      const { teamId } = req.params;
      const { limit = 50, offset = 0, parent_id } = req.query;
      const userId = req.user.id;

      // Verify user is a team member
      const memberCheck = await query(
        `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not a team member'
        });
      }

      // Get messages
      const sql = `
        SELECT
          tm.*,
          u.name as user_name,
          u.email as user_email,
          (
            SELECT json_agg(json_build_object(
              'user_id', tmr.user_id,
              'user_name', u2.name,
              'read_at', tmr.read_at
            ))
            FROM team_message_reads tmr
            LEFT JOIN users u2 ON u2.id = tmr.user_id
            WHERE tmr.message_id = tm.id
          ) as read_receipts,
          (
            SELECT COUNT(*)::int
            FROM team_messages
            WHERE parent_message_id = tm.id AND is_deleted = FALSE
          ) as reply_count
        FROM team_messages tm
        LEFT JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1
          AND tm.is_deleted = FALSE
          ${parent_id ? 'AND tm.parent_message_id = $4' : 'AND tm.parent_message_id IS NULL'}
        ORDER BY tm.created_at ASC
        LIMIT $2 OFFSET $3
      `;

      const params = parent_id
        ? [teamId, limit, offset, parent_id]
        : [teamId, limit, offset];

      const result = await query(sql, params);

      res.json({
        success: true,
        data: result.rows || []
      });
    } catch (error) {
      logger.error('Get messages error', { error: error.message });
      next(error);
    }
  }

  /**
   * Post a message to a team
   * POST /api/teams/:teamId/messages
   */
  async postMessage(req, res, next) {
    try {
      const { teamId } = req.params;
      const { message_text, parent_message_id, mentions, attachments } = req.body;
      const userId = req.user.id;

      if (!message_text || message_text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message text is required'
        });
      }

      // Verify user is a team member
      const memberCheck = await query(
        `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not a team member'
        });
      }

      // Insert message
      const result = await query(
        `INSERT INTO team_messages
        (team_id, user_id, message_text, parent_message_id, mentions, attachments)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          teamId,
          userId,
          message_text.trim(),
          parent_message_id || null,
          mentions ? JSON.stringify(mentions) : '[]',
          attachments ? JSON.stringify(attachments) : '[]'
        ]
      );

      const message = result.rows[0];

      // Get user info for response
      const userResult = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [userId]
      );

      const responseMessage = {
        ...message,
        user_name: userResult.rows[0].name,
        user_email: userResult.rows[0].email,
        read_receipts: [],
        reply_count: 0
      };

      // Log activity
      await query(
        `INSERT INTO team_activity
        (team_id, user_id, activity_type, resource_type, resource_id, metadata)
        VALUES ($1, $2, 'message_posted', 'message', $3, $4)`,
        [
          teamId,
          userId,
          message.id,
          JSON.stringify({
            is_reply: !!parent_message_id,
            has_mentions: mentions && mentions.length > 0
          })
        ]
      );

      // Create notifications for team members (except the sender)
      try {
        const teamMembersResult = await query(
          `SELECT user_id FROM team_members WHERE team_id = $1 AND user_id != $2`,
          [teamId, userId]
        );

        const messageType = parent_message_id ? 'reply' : 'message';
        const notificationTitle = parent_message_id
          ? `New reply in team discussion`
          : `New message in team discussion`;

        const notificationMessage = parent_message_id
          ? `${userResult.rows[0].name} replied to a discussion`
          : `${userResult.rows[0].name} posted a new message`;

        // Create notification for each team member
        for (const member of teamMembersResult.rows) {
          await Notification.create({
            userId: member.user_id,
            type: 'team_message',
            title: notificationTitle,
            message: notificationMessage,
            referenceType: 'team_message',
            referenceId: message.id,
            metadata: {
              teamId,
              messageId: message.id,
              senderId: userId,
              senderName: userResult.rows[0].name,
              isReply: !!parent_message_id,
              parentMessageId: parent_message_id
            }
          });
        }

        logger.info('Team message notifications created', {
          teamId,
          messageId: message.id,
          recipientCount: teamMembersResult.rows.length
        });
      } catch (notifError) {
        logger.error('Failed to create team message notifications', {
          error: notifError.message,
          teamId,
          messageId: message.id
        });
        // Don't fail the request if notifications fail
      }

      logger.info('Team message posted', {
        teamId,
        userId,
        messageId: message.id
      });

      res.status(201).json({
        success: true,
        data: responseMessage
      });
    } catch (error) {
      logger.error('Post message error', { error: error.message });
      next(error);
    }
  }

  /**
   * Edit a message
   * PUT /api/teams/:teamId/messages/:messageId
   */
  async editMessage(req, res, next) {
    try {
      const { teamId, messageId } = req.params;
      const { message_text } = req.body;
      const userId = req.user.id;

      if (!message_text || message_text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Message text is required'
        });
      }

      // Verify message belongs to user
      const messageCheck = await query(
        `SELECT * FROM team_messages
        WHERE id = $1 AND team_id = $2 AND user_id = $3 AND is_deleted = FALSE`,
        [messageId, teamId, userId]
      );

      if (messageCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Message not found or access denied'
        });
      }

      // Update message
      await query(
        `UPDATE team_messages
        SET message_text = $1, is_edited = TRUE
        WHERE id = $2`,
        [message_text.trim(), messageId]
      );

      res.json({
        success: true,
        message: 'Message updated successfully'
      });
    } catch (error) {
      logger.error('Edit message error', { error: error.message });
      next(error);
    }
  }

  /**
   * Delete a message
   * DELETE /api/teams/:teamId/messages/:messageId
   */
  async deleteMessage(req, res, next) {
    try {
      const { teamId, messageId } = req.params;
      const userId = req.user.id;

      // Verify message belongs to user or user is team lead/owner
      const messageCheck = await query(
        `SELECT tm.*, t.owner_id, tmem.team_role
        FROM team_messages tm
        LEFT JOIN teams t ON t.id = tm.team_id
        LEFT JOIN team_members tmem ON tmem.team_id = tm.team_id AND tmem.user_id = $3
        WHERE tm.id = $1 AND tm.team_id = $2 AND tm.is_deleted = FALSE`,
        [messageId, teamId, userId]
      );

      if (messageCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Message not found'
        });
      }

      const message = messageCheck.rows[0];
      const canDelete = message.user_id === userId ||
                       message.owner_id === userId ||
                       message.team_role === 'lead';

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied'
        });
      }

      // Soft delete message
      await query(
        `UPDATE team_messages
        SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [messageId]
      );

      res.json({
        success: true,
        message: 'Message deleted successfully'
      });
    } catch (error) {
      logger.error('Delete message error', { error: error.message });
      next(error);
    }
  }

  /**
   * Mark message as read
   * POST /api/teams/:teamId/messages/:messageId/read
   */
  async markAsRead(req, res, next) {
    try {
      const { teamId, messageId } = req.params;
      const userId = req.user.id;

      // Verify user is a team member
      const memberCheck = await query(
        `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not a team member'
        });
      }

      // Insert or update read receipt
      await query(
        `INSERT INTO team_message_reads (message_id, user_id, read_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (message_id, user_id)
        DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
        [messageId, userId]
      );

      res.json({
        success: true,
        message: 'Message marked as read'
      });
    } catch (error) {
      logger.error('Mark as read error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get unread message count for a team
   * GET /api/teams/:teamId/messages/unread-count
   */
  async getUnreadCount(req, res, next) {
    try {
      const { teamId } = req.params;
      const userId = req.user.id;

      // Verify user is a team member
      const memberCheck = await query(
        `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Access denied - not a team member'
        });
      }

      // Count unread messages
      const result = await query(
        `SELECT COUNT(*)::int as unread_count
        FROM team_messages tm
        WHERE tm.team_id = $1
          AND tm.user_id != $2
          AND tm.is_deleted = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM team_message_reads tmr
            WHERE tmr.message_id = tm.id AND tmr.user_id = $2
          )`,
        [teamId, userId]
      );

      res.json({
        success: true,
        data: {
          unread_count: result.rows[0].unread_count
        }
      });
    } catch (error) {
      logger.error('Get unread count error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new TeamMessagesController();
