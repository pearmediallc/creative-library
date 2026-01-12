// ============================================
// SLACK INTEGRATION SERVICE
// ============================================
// Handles all Slack notifications, OAuth, and messaging

const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const pool = require('../config/database');

// Encryption for Slack tokens (using existing ENCRYPTION_KEY from .env)
const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
  : null;

/**
 * Encrypt Slack access token
 */
function encryptToken(token) {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt Slack access token
 */
function decryptToken(encryptedToken) {
  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const parts = encryptedToken.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get workspace bot token
 * First tries environment variable, then falls back to database
 */
async function getWorkspaceToken() {
  // Use bot token from environment variable if available
  if (process.env.SLACK_BOT_TOKEN) {
    return process.env.SLACK_BOT_TOKEN;
  }

  // Fallback to database-stored token
  const result = await pool.query(
    'SELECT access_token FROM slack_workspaces WHERE is_active = TRUE LIMIT 1'
  );

  if (result.rows.length === 0) {
    throw new Error('No active Slack workspace connected. Please set SLACK_BOT_TOKEN in environment variables or connect a workspace.');
  }

  return decryptToken(result.rows[0].access_token);
}

/**
 * Get Slack user ID for a given user
 */
async function getSlackUserId(userId) {
  const result = await pool.query(
    `SELECT slack_user_id FROM user_slack_connections
     WHERE user_id = $1 AND is_active = TRUE LIMIT 1`,
    [userId]
  );

  return result.rows.length > 0 ? result.rows[0].slack_user_id : null;
}

/**
 * Log notification to database
 */
async function logNotification(notificationType, userId, slackUserId, channel, message, blocks, status, errorMessage = null) {
  await pool.query(
    `INSERT INTO slack_notifications
     (notification_type, user_id, slack_user_id, channel, message, blocks, status, error_message, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      notificationType,
      userId,
      slackUserId,
      channel,
      message,
      blocks ? JSON.stringify(blocks) : null,
      status,
      errorMessage,
      status === 'sent' ? new Date() : null
    ]
  );
}

/**
 * Check if user has Slack notifications enabled
 */
async function isUserSlackEnabled(userId, notificationType) {
  const result = await pool.query(
    `SELECT slack_notifications_enabled, slack_notification_preferences
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) return false;

  const user = result.rows[0];
  if (!user.slack_notifications_enabled) return false;

  const prefs = user.slack_notification_preferences || {};
  return prefs[notificationType] !== false; // Default to true if not specified
}

/**
 * Send message to Slack channel or DM
 */
async function sendMessage(channel, message, blocks = null) {
  try {
    const token = await getWorkspaceToken();
    const client = new WebClient(token);

    const payload = {
      channel,
      text: message
    };

    if (blocks) {
      payload.blocks = blocks;
    }

    const response = await client.chat.postMessage(payload);
    return response;
  } catch (error) {
    console.error('Slack sendMessage error:', error);
    throw error;
  }
}

/**
 * Notify user when a file is shared with them
 */
async function notifyFileShared(userId, fileName, sharedByName, fileUrl) {
  try {
    const notificationType = 'file_shared';

    // Check if user has this notification enabled
    if (!await isUserSlackEnabled(userId, notificationType)) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const slackUserId = await getSlackUserId(userId);
    if (!slackUserId) {
      return { success: false, reason: 'no_slack_connection' };
    }

    const message = `📁 ${sharedByName} shared a file with you: *${fileName}*`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📁 *File Shared with You*\n\n*${sharedByName}* shared: *${fileName}*`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 View File'
            },
            url: fileUrl,
            style: 'primary'
          }
        ]
      }
    ];

    await sendMessage(slackUserId, message, blocks);
    await logNotification(notificationType, userId, slackUserId, slackUserId, message, blocks, 'sent');

    return { success: true };
  } catch (error) {
    console.error('notifyFileShared error:', error);
    await logNotification('file_shared', userId, null, null, `Error: ${error.message}`, null, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify editor when a new file request is created
 */
async function notifyFileRequestCreated(editorUserId, requestTitle, requestType, conceptNotes, createdByName, requestUrl) {
  try {
    const notificationType = 'file_request_created';

    if (!await isUserSlackEnabled(editorUserId, notificationType)) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const slackUserId = await getSlackUserId(editorUserId);
    if (!slackUserId) {
      return { success: false, reason: 'no_slack_connection' };
    }

    const message = `🎬 New file request from ${createdByName}: ${requestType}`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎬 *New File Request*\n\n*Type:* ${requestType}\n*From:* ${createdByName}`
        }
      }
    ];

    if (conceptNotes) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Concept Notes:*\n${conceptNotes.substring(0, 300)}${conceptNotes.length > 300 ? '...' : ''}`
        }
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📋 View Request'
          },
          url: requestUrl,
          style: 'primary'
        }
      ]
    });

    await sendMessage(slackUserId, message, blocks);
    await logNotification(notificationType, editorUserId, slackUserId, slackUserId, message, blocks, 'sent');

    return { success: true };
  } catch (error) {
    console.error('notifyFileRequestCreated error:', error);
    await logNotification('file_request_created', editorUserId, null, null, `Error: ${error.message}`, null, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify buyer when a file request is completed
 */
async function notifyFileRequestCompleted(buyerUserId, requestType, editorName, deliveryNote, requestUrl) {
  try {
    const notificationType = 'file_request_completed';

    if (!await isUserSlackEnabled(buyerUserId, notificationType)) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const slackUserId = await getSlackUserId(buyerUserId);
    if (!slackUserId) {
      return { success: false, reason: 'no_slack_connection' };
    }

    const message = `✅ File request completed by ${editorName}: ${requestType}`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *File Request Completed*\n\n*Type:* ${requestType}\n*Completed by:* ${editorName}`
        }
      }
    ];

    if (deliveryNote) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Delivery Note:*\n${deliveryNote.substring(0, 300)}${deliveryNote.length > 300 ? '...' : ''}`
        }
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🎉 View Files'
          },
          url: requestUrl,
          style: 'primary'
        }
      ]
    });

    await sendMessage(slackUserId, message, blocks);
    await logNotification(notificationType, buyerUserId, slackUserId, slackUserId, message, blocks, 'sent');

    return { success: true };
  } catch (error) {
    console.error('notifyFileRequestCompleted error:', error);
    await logNotification('file_request_completed', buyerUserId, null, null, `Error: ${error.message}`, null, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify editor when a file request is reassigned to them
 */
async function notifyRequestReassigned(newEditorUserId, requestType, reassignedByName, reason, requestUrl) {
  try {
    const notificationType = 'file_request_reassigned';

    if (!await isUserSlackEnabled(newEditorUserId, notificationType)) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const slackUserId = await getSlackUserId(newEditorUserId);
    if (!slackUserId) {
      return { success: false, reason: 'no_slack_connection' };
    }

    const message = `🔄 File request reassigned to you: ${requestType}`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔄 *File Request Reassigned*\n\n*Type:* ${requestType}\n*Reassigned by:* ${reassignedByName}`
        }
      }
    ];

    if (reason) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Reason:* ${reason}`
        }
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📋 View Request'
          },
          url: requestUrl,
          style: 'primary'
        }
      ]
    });

    await sendMessage(slackUserId, message, blocks);
    await logNotification(notificationType, newEditorUserId, slackUserId, slackUserId, message, blocks, 'sent');

    return { success: true };
  } catch (error) {
    console.error('notifyRequestReassigned error:', error);
    await logNotification('file_request_reassigned', newEditorUserId, null, null, `Error: ${error.message}`, null, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify user when a public link is created and shared
 */
async function notifyPublicLinkCreated(userId, fileName, publicUrl, expiresAt) {
  try {
    const notificationType = 'public_link_created';

    if (!await isUserSlackEnabled(userId, notificationType)) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const slackUserId = await getSlackUserId(userId);
    if (!slackUserId) {
      return { success: false, reason: 'no_slack_connection' };
    }

    const expiryText = expiresAt
      ? `\n*Expires:* ${new Date(expiresAt).toLocaleString()}`
      : '';

    const message = `🔗 Public link created for: ${fileName}`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔗 *Public Link Created*\n\n*File:* ${fileName}${expiryText}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Link:* ${publicUrl}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔗 Open Link'
            },
            url: publicUrl,
            style: 'primary'
          }
        ]
      }
    ];

    await sendMessage(slackUserId, message, blocks);
    await logNotification(notificationType, userId, slackUserId, slackUserId, message, blocks, 'sent');

    return { success: true };
  } catch (error) {
    console.error('notifyPublicLinkCreated error:', error);
    await logNotification('public_link_created', userId, null, null, `Error: ${error.message}`, null, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify user when they are mentioned in a comment
 */
async function notifyCommentMention(userId, mentionedByName, fileName, commentText, fileUrl) {
  try {
    const notificationType = 'comment_mentioned';

    if (!await isUserSlackEnabled(userId, notificationType)) {
      return { success: false, reason: 'notifications_disabled' };
    }

    const slackUserId = await getSlackUserId(userId);
    if (!slackUserId) {
      return { success: false, reason: 'no_slack_connection' };
    }

    const message = `💬 ${mentionedByName} mentioned you in a comment on ${fileName}`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💬 *You were mentioned*\n\n*By:* ${mentionedByName}\n*File:* ${fileName}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Comment:*\n${commentText.substring(0, 300)}${commentText.length > 300 ? '...' : ''}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '💬 View Comment'
            },
            url: fileUrl,
            style: 'primary'
          }
        ]
      }
    ];

    await sendMessage(slackUserId, message, blocks);
    await logNotification(notificationType, userId, slackUserId, slackUserId, message, blocks, 'sent');

    return { success: true };
  } catch (error) {
    console.error('notifyCommentMention error:', error);
    await logNotification('comment_mentioned', userId, null, null, `Error: ${error.message}`, null, 'failed', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Store Slack workspace OAuth credentials
 */
async function storeWorkspaceCredentials(teamId, teamName, accessToken, botUserId, scope) {
  const encryptedToken = encryptToken(accessToken);

  const result = await pool.query(
    `INSERT INTO slack_workspaces (team_id, team_name, access_token, bot_user_id, scope, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (team_id)
     DO UPDATE SET
       team_name = EXCLUDED.team_name,
       access_token = EXCLUDED.access_token,
       bot_user_id = EXCLUDED.bot_user_id,
       scope = EXCLUDED.scope,
       is_active = TRUE,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [teamId, teamName, encryptedToken, botUserId, scope]
  );

  return result.rows[0].id;
}

/**
 * Store user Slack connection
 */
async function storeUserConnection(userId, slackUserId, slackUsername, slackEmail, workspaceId) {
  const result = await pool.query(
    `INSERT INTO user_slack_connections (user_id, slack_user_id, slack_username, slack_email, workspace_id, is_active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (user_id, workspace_id)
     DO UPDATE SET
       slack_user_id = EXCLUDED.slack_user_id,
       slack_username = EXCLUDED.slack_username,
       slack_email = EXCLUDED.slack_email,
       is_active = TRUE,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [userId, slackUserId, slackUsername, slackEmail, workspaceId]
  );

  return result.rows[0].id;
}

/**
 * Get active workspace info
 */
async function getActiveWorkspace() {
  const result = await pool.query(
    'SELECT id, team_id, team_name, bot_user_id FROM slack_workspaces WHERE is_active = TRUE LIMIT 1'
  );

  return result.rows[0] || null;
}

module.exports = {
  encryptToken,
  decryptToken,
  getWorkspaceToken,
  getSlackUserId,
  sendMessage,
  notifyFileShared,
  notifyFileRequestCreated,
  notifyFileRequestCompleted,
  notifyRequestReassigned,
  notifyPublicLinkCreated,
  notifyCommentMention,
  storeWorkspaceCredentials,
  storeUserConnection,
  getActiveWorkspace,
  isUserSlackEnabled
};
