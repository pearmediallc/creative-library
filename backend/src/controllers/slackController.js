// ============================================
// SLACK CONTROLLER
// ============================================
// Handles Slack OAuth and settings

const { WebClient } = require('@slack/web-api');
const slackService = require('../services/slackService');
const pool = require('../config/database');

/**
 * Initiate Slack OAuth flow
 */
async function initiateOAuth(req, res) {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;

    if (!clientId) {
      console.error('SLACK_CLIENT_ID not configured');
      return res.status(500).json({
        error: 'Slack OAuth not configured. Please contact administrator.'
      });
    }

    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/slack/oauth/callback`;

    const scopes = [
      'chat:write',
      'users:read',
      'users:read.email',
      'im:write'
    ].join(',');

    const state = req.user.id; // Use user ID as state for security

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    console.log('Slack OAuth initiated', { clientId: clientId.substring(0, 10) + '...', redirectUri });

    res.json({ authUrl });
  } catch (error) {
    console.error('Slack OAuth initiate error:', error);
    res.status(500).json({ error: 'Failed to initiate Slack OAuth', details: error.message });
  }
}

/**
 * Handle Slack OAuth callback
 */
async function handleOAuthCallback(req, res) {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?slack_error=no_code`);
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/slack/oauth/callback`;

    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    });

    if (!response.ok) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?slack_error=oauth_failed`);
    }

    // Store workspace credentials
    const workspaceId = await slackService.storeWorkspaceCredentials(
      response.team.id,
      response.team.name,
      response.access_token,
      response.bot_user_id,
      response.scope
    );

    // Get user info using the bot token
    const botClient = new WebClient(response.access_token);
    const userInfo = await botClient.users.info({ user: response.authed_user.id });

    // Store user connection
    await slackService.storeUserConnection(
      state, // userId from state parameter
      response.authed_user.id,
      userInfo.user.name,
      userInfo.user.profile.email,
      workspaceId
    );

    res.redirect(`${process.env.FRONTEND_URL}/settings?slack_success=true`);
  } catch (error) {
    console.error('Slack OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/settings?slack_error=callback_failed`);
  }
}

/**
 * Get Slack connection status for current user
 */
async function getConnectionStatus(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
        usc.id,
        usc.slack_username,
        usc.slack_email,
        usc.is_active,
        usc.created_at,
        sw.team_name as workspace_name
       FROM user_slack_connections usc
       LEFT JOIN slack_workspaces sw ON usc.workspace_id = sw.id
       WHERE usc.user_id = $1 AND usc.is_active = TRUE
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ connected: false });
    }

    const connection = result.rows[0];
    res.json({
      connected: true,
      slackUsername: connection.slack_username,
      slackEmail: connection.slack_email,
      workspaceName: connection.workspace_name,
      connectedAt: connection.created_at
    });
  } catch (error) {
    console.error('Get Slack connection status error:', error);
    res.status(500).json({ error: 'Failed to get connection status' });
  }
}

/**
 * Disconnect Slack for current user
 */
async function disconnect(req, res) {
  try {
    const userId = req.user.id;

    await pool.query(
      'UPDATE user_slack_connections SET is_active = FALSE WHERE user_id = $1',
      [userId]
    );

    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (error) {
    console.error('Slack disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
}

/**
 * Update Slack notification preferences
 */
async function updateNotificationPreferences(req, res) {
  try {
    const userId = req.user.id;
    const { enabled, preferences } = req.body;

    const updates = [];
    const params = [userId];
    let paramIndex = 2;

    if (typeof enabled === 'boolean') {
      updates.push(`slack_notifications_enabled = $${paramIndex}`);
      params.push(enabled);
      paramIndex++;
    }

    if (preferences && typeof preferences === 'object') {
      updates.push(`slack_notification_preferences = $${paramIndex}`);
      params.push(JSON.stringify(preferences));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No preferences provided' });
    }

    await pool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      params
    );

    res.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error) {
    console.error('Update Slack preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
}

/**
 * Get Slack notification preferences
 */
async function getNotificationPreferences(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      'SELECT slack_notifications_enabled, slack_notification_preferences FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    res.json({
      enabled: user.slack_notifications_enabled,
      preferences: user.slack_notification_preferences || {}
    });
  } catch (error) {
    console.error('Get Slack preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
}

/**
 * Test Slack notification
 */
async function testNotification(req, res) {
  try {
    const userId = req.user.id;
    const { type = 'test' } = req.body;

    console.log('🧪 Test notification request:', {
      userId,
      type,
      frontendUrl: process.env.FRONTEND_URL
    });

    const result = await slackService.notifyPublicLinkCreated(
      userId,
      'Test File.mp4',
      `${process.env.FRONTEND_URL}/media`,
      null
    );

    console.log('🧪 Test notification result:', result);

    if (result.success) {
      res.json({ success: true, message: 'Test notification sent' });
    } else {
      console.warn('⚠️ Test notification failed:', {
        userId,
        reason: result.reason,
        error: result.error
      });
      res.status(400).json({
        success: false,
        message: 'Failed to send notification',
        reason: result.reason,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Test notification error:', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      details: error.message
    });
  }
}

module.exports = {
  initiateOAuth,
  handleOAuthCallback,
  getConnectionStatus,
  disconnect,
  updateNotificationPreferences,
  getNotificationPreferences,
  testNotification
};
