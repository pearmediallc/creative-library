/**
 * Team Message Controller
 * Handles team discussions/chat with notifications
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Send a message in team discussion
 * POST /api/teams/:teamId/messages
 */
async function sendMessage(req, res) {
  try {
    const { teamId } = req.params;
    // Accept both camelCase and snake_case for compatibility
    const messageText = req.body.messageText || req.body.message_text;
    const parentMessageId = req.body.parentMessageId || req.body.parent_message_id;
    const mentions = req.body.mentions || [];
    const attachments = req.body.attachments || [];
    const userId = req.user.id;

    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Verify parent message exists if replying
    if (parentMessageId) {
      const parentCheck = await query(
        'SELECT * FROM team_messages WHERE id = $1 AND team_id = $2',
        [parentMessageId, teamId]
      );

      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Parent message not found' });
      }
    }

    // Insert message
    const result = await query(
      `INSERT INTO team_messages (
        team_id, user_id, message_text, parent_message_id,
        mentions, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        teamId,
        userId,
        messageText.trim(),
        parentMessageId || null,
        mentions,
        JSON.stringify(attachments)
      ]
    );

    const message = result.rows[0];

    // Get sender info
    const senderResult = await query(
      'SELECT name FROM users WHERE id = $1',
      [userId]
    );
    const senderName = senderResult.rows[0]?.name || 'Team Member';

    // Get team info
    const teamResult = await query(
      'SELECT name FROM teams WHERE id = $1',
      [teamId]
    );
    const teamName = teamResult.rows[0]?.name || 'Team';

    // Send notifications to all team members except sender
    const teamMembersResult = await query(
      'SELECT user_id FROM team_members WHERE team_id = $1 AND user_id != $2',
      [teamId, userId]
    );

    const notificationPromises = teamMembersResult.rows.map(async (member) => {
      try {
        await query(
          `INSERT INTO notifications (
            user_id, type, title, message, reference_type, reference_id, is_read
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            member.user_id,
            'team_message',
            `New message in ${teamName}`,
            `${senderName} posted: ${messageText.substring(0, 100)}${messageText.length > 100 ? '...' : ''}`,
            'team_message',
            message.id,
            false
          ]
        );
      } catch (error) {
        logger.error('Failed to send notification', {
          error: error.message,
          user_id: member.user_id,
          message_id: message.id
        });
      }
    });

    // Send special notifications for mentions
    if (mentions && mentions.length > 0) {
      const mentionPromises = mentions.map(async (mentionedUserId) => {
        try {
          // Check if mentioned user is a team member
          const mentionMemberCheck = await query(
            'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
            [teamId, mentionedUserId]
          );

          if (mentionMemberCheck.rows.length > 0 && mentionedUserId !== userId) {
            await query(
              `INSERT INTO notifications (
                user_id, type, title, message, reference_type, reference_id, is_read
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                mentionedUserId,
                'mention',
                `${senderName} mentioned you in ${teamName}`,
                messageText.substring(0, 200) + (messageText.length > 200 ? '...' : ''),
                'team_message',
                message.id,
                false
              ]
            );
          }
        } catch (error) {
          logger.error('Failed to send mention notification', {
            error: error.message,
            mentioned_user_id: mentionedUserId
          });
        }
      });

      await Promise.all(mentionPromises);
    }

    await Promise.all(notificationPromises);

    logger.info('Team message sent', {
      message_id: message.id,
      team_id: teamId,
      user_id: userId
    });

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });
  } catch (error) {
    logger.error('Send team message failed', {
      error: error.message,
      team_id: req.params.teamId,
      user_id: req.user.id
    });
    res.status(500).json({ error: 'Failed to send message' });
  }
}

/**
 * Get team messages
 * GET /api/teams/:teamId/messages
 */
async function getMessages(req, res) {
  try {
    const { teamId } = req.params;
    const { limit = 50, offset = 0, parentMessageId } = req.query;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    let whereClause = 'tm.team_id = $1 AND tm.is_deleted = false';
    const params = [teamId];

    // Filter by parent message if specified (get replies)
    if (parentMessageId) {
      whereClause += ' AND tm.parent_message_id = $2';
      params.push(parentMessageId);
    } else {
      // Only get top-level messages if no parent specified
      whereClause += ' AND tm.parent_message_id IS NULL';
    }

    const result = await query(
      `SELECT
        tm.*,
        u.name as user_name,
        (SELECT COUNT(*) FROM team_messages WHERE parent_message_id = tm.id AND is_deleted = false) as reply_count,
        (SELECT COUNT(*) FROM team_message_reads WHERE message_id = tm.id) as read_count
       FROM team_messages tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE ${whereClause}
       ORDER BY tm.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logger.error('Get team messages failed', {
      error: error.message,
      team_id: req.params.teamId
    });
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

/**
 * Get single message with replies
 * GET /api/teams/:teamId/messages/:messageId
 */
async function getMessage(req, res) {
  try {
    const { teamId, messageId } = req.params;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    // Get main message
    const messageResult = await query(
      `SELECT
        tm.*,
        u.name as user_name
       FROM team_messages tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.id = $1 AND tm.team_id = $2 AND tm.is_deleted = false`,
      [messageId, teamId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult.rows[0];

    // Get replies
    const repliesResult = await query(
      `SELECT
        tm.*,
        u.name as user_name
       FROM team_messages tm
       LEFT JOIN users u ON tm.user_id = u.id
       WHERE tm.parent_message_id = $1 AND tm.is_deleted = false
       ORDER BY tm.created_at ASC`,
      [messageId]
    );

    // Mark as read for this user
    await query(
      `INSERT INTO team_message_reads (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, userId]
    );

    res.json({
      success: true,
      data: {
        ...message,
        replies: repliesResult.rows
      }
    });
  } catch (error) {
    logger.error('Get team message failed', {
      error: error.message,
      message_id: req.params.messageId
    });
    res.status(500).json({ error: 'Failed to fetch message' });
  }
}

/**
 * Delete a message
 * DELETE /api/teams/:teamId/messages/:messageId
 */
async function deleteMessage(req, res) {
  try {
    const { teamId, messageId } = req.params;
    const userId = req.user.id;

    // Get message
    const messageResult = await query(
      'SELECT * FROM team_messages WHERE id = $1 AND team_id = $2',
      [messageId, teamId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageResult.rows[0];

    // Check if user is the message author or team admin
    if (message.user_id !== userId) {
      const memberCheck = await query(
        'SELECT team_role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, userId]
      );

      if (memberCheck.rows.length === 0 || !['admin', 'lead'].includes(memberCheck.rows[0].team_role)) {
        return res.status(403).json({ error: 'You do not have permission to delete this message' });
      }
    }

    // Soft delete the message
    await query(
      'UPDATE team_messages SET is_deleted = true WHERE id = $1',
      [messageId]
    );

    logger.info('Team message deleted', { message_id: messageId, team_id: teamId });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Delete team message failed', {
      error: error.message,
      message_id: req.params.messageId
    });
    res.status(500).json({ error: 'Failed to delete message' });
  }
}

/**
 * Mark message as read
 * POST /api/teams/:teamId/messages/:messageId/read
 */
async function markAsRead(req, res) {
  try {
    const { teamId, messageId } = req.params;
    const userId = req.user.id;

    // Check if user is a team member
    const memberCheck = await query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this team' });
    }

    await query(
      `INSERT INTO team_message_reads (message_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, userId]
    );

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    logger.error('Mark message as read failed', {
      error: error.message,
      message_id: req.params.messageId
    });
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
}

module.exports = {
  sendMessage,
  getMessages,
  getMessage,
  deleteMessage,
  markAsRead
};
