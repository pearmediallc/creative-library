# Slack Integration Setup Guide

## Overview
Full Slack integration is now configured with OAuth login and real-time notifications.

## App Configuration

### App Details
- **App Name:** Pear Media Editors App
- **App ID:** A0A8411776Z
- **Workspace:** Pearmedia LLC (pearmediallcgroup.slack.com)
- **Status:** ✅ Installed and Active

### Redirect URI
```
https://creative-library-frontend.onrender.com/auth/slack/callback
```

## Environment Variables (Production)

Add these to your Render backend service environment variables:

```bash
# Slack OAuth Credentials
SLACK_CLIENT_ID=993338752987910276035245237
SLACK_CLIENT_SECRET=e4f30d5db3bc9c90c94f85c661067161
SLACK_SIGNING_SECRET=f773706037954063c007d646c150b688

# Slack Bot Token (for sending notifications)
SLACK_BOT_TOKEN=xoxb-9933387529879-10283091144020-li35TAK2VaMmniNZtx10

# Frontend URL (for generating links in notifications)
FRONTEND_URL=https://creative-library-frontend.onrender.com
```

## Features Implemented

### 1. OAuth Login
**Scopes:**
- ✅ `identity.basic` - Get user's basic identity
- ✅ `identity.email` - Get user's email address

**Flow:**
1. User clicks "Login with Slack"
2. Redirected to Slack authorization page
3. After approval, redirected back with code
4. Backend exchanges code for access token
5. User info retrieved and account created/linked

### 2. Slack Notifications (NEW!)

**Bot Scope:**
- ✅ `chat:write` - Send messages to channels and DMs

**Notification Types:**

#### a) File Shared Notification
When someone shares a file with a user:
```javascript
await slackService.notifyFileShared(
  userId,
  fileName,
  sharedByName,
  fileUrl
);
```

**Slack Message:**
```
📁 File Shared with You

[Shared By Name] shared: [File Name]

[View File Button]
```

#### b) File Request Created
When a new file request is assigned to an editor:
```javascript
await slackService.notifyFileRequestCreated(
  editorUserId,
  requestTitle,
  requestType,
  conceptNotes,
  createdByName,
  requestUrl
);
```

**Slack Message:**
```
🎬 New File Request

Type: [Request Type]
From: [Creator Name]

Concept Notes:
[Notes content...]

[View Request Button]
```

#### c) File Request Completed
When an editor completes a file request:
```javascript
await slackService.notifyFileRequestCompleted(
  buyerUserId,
  requestType,
  editorName,
  deliveryNote,
  requestUrl
);
```

**Slack Message:**
```
✅ File Request Completed

Type: [Request Type]
Completed by: [Editor Name]

Delivery Note:
[Note content...]

[View Files Button]
```

#### d) File Request Reassigned
When a request is reassigned to a different editor:
```javascript
await slackService.notifyRequestReassigned(
  newEditorUserId,
  requestType,
  reassignedByName,
  reason,
  requestUrl
);
```

**Slack Message:**
```
🔄 File Request Reassigned

Type: [Request Type]
Reassigned by: [Admin Name]

Reason: [Reason text]

[View Request Button]
```

#### e) Comment Mention
When someone is mentioned in a comment:
```javascript
await slackService.notifyCommentMention(
  userId,
  mentionedByName,
  fileName,
  commentText,
  fileUrl
);
```

**Slack Message:**
```
💬 You were mentioned

By: [User Name]
File: [File Name]

Comment:
[Comment text...]

[View Comment Button]
```

#### f) Public Link Created
When a public share link is created:
```javascript
await slackService.notifyPublicLinkCreated(
  userId,
  fileName,
  publicUrl,
  expiresAt
);
```

**Slack Message:**
```
🔗 Public Link Created

File: [File Name]
Expires: [Date]

Link: [Public URL]

[Open Link Button]
```

## User Notification Preferences

Users can control which notifications they receive via their profile settings:

```javascript
{
  "slack_notifications_enabled": true,
  "slack_notification_preferences": {
    "file_shared": true,
    "file_request_created": true,
    "file_request_completed": true,
    "file_request_reassigned": true,
    "comment_mentioned": true,
    "public_link_created": false
  }
}
```

## Database Tables

### slack_workspaces
Stores Slack workspace OAuth credentials:
```sql
CREATE TABLE slack_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id VARCHAR(255) UNIQUE NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,  -- Encrypted bot token
  bot_user_id VARCHAR(255),
  scope TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### user_slack_connections
Links users to their Slack accounts:
```sql
CREATE TABLE user_slack_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  slack_user_id VARCHAR(255) NOT NULL,
  slack_username VARCHAR(255),
  slack_email VARCHAR(255),
  workspace_id UUID REFERENCES slack_workspaces(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, workspace_id)
);
```

### slack_notifications
Logs all sent notifications:
```sql
CREATE TABLE slack_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id),
  slack_user_id VARCHAR(255),
  channel VARCHAR(255),
  message TEXT,
  blocks JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## How Notifications Work

### 1. Check User Preferences
```javascript
const enabled = await slackService.isUserSlackEnabled(userId, 'file_shared');
if (!enabled) {
  return { success: false, reason: 'notifications_disabled' };
}
```

### 2. Get Slack User ID
```javascript
const slackUserId = await slackService.getSlackUserId(userId);
if (!slackUserId) {
  return { success: false, reason: 'no_slack_connection' };
}
```

### 3. Send Message with Blocks
```javascript
const blocks = [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '📁 *File Shared with You*\n\n*[Name]* shared: *[File]*'
    }
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔗 View File' },
        url: fileUrl,
        style: 'primary'
      }
    ]
  }
];

await sendMessage(slackUserId, message, blocks);
```

### 4. Log Notification
```javascript
await logNotification(
  'file_shared',
  userId,
  slackUserId,
  slackUserId,
  message,
  blocks,
  'sent'
);
```

## Integration Points

### File Sharing
**Location:** `backend/src/controllers/permissionController.js:51-69`

When a file is shared with a user (not a team), a Slack notification is automatically sent.

### File Requests
**Locations to add:**
- File request creation → Notify assigned editors
- File request completion → Notify requesting buyer
- File request reassignment → Notify new editor

### Comments
**Location to add:** `backend/src/controllers/commentController.js`

When a user is @mentioned in a comment, send notification.

## Testing Slack Notifications

### 1. Connect User to Slack
```bash
# User must first login with Slack OAuth
# This creates entry in user_slack_connections table
```

### 2. Test File Share Notification
```bash
# Via API
POST /api/permissions
{
  "resource_type": "file",
  "resource_id": "[file-uuid]",
  "grantee_type": "user",
  "grantee_id": "[user-uuid]",
  "permission_type": "view"
}

# Expected: Slack DM sent to user
```

### 3. Test Direct Notification (Manual)
```javascript
const slackService = require('./services/slackService');

await slackService.notifyFileShared(
  'user-uuid',
  'example.mp4',
  'John Doe',
  'https://creative-library.com/media/123'
);
```

### 4. Check Notification Log
```sql
SELECT * FROM slack_notifications
ORDER BY created_at DESC
LIMIT 10;
```

## Security Considerations

### ✅ Token Encryption
Bot tokens stored in database are encrypted using AES-256-GCM:
```javascript
const encrypted = encryptToken(accessToken);
const decrypted = decryptToken(encrypted);
```

### ✅ Environment Variables
Never commit tokens to git. Always use environment variables.

### ✅ HTTPS Only
All OAuth redirects and webhooks use HTTPS.

### ✅ Request Signing
Validate incoming Slack requests using signing secret:
```javascript
const timestamp = req.headers['x-slack-request-timestamp'];
const signature = req.headers['x-slack-signature'];
const signingSecret = process.env.SLACK_SIGNING_SECRET;

// Verify signature matches
```

### ✅ Workspace Restriction
App is limited to Pearmedia LLC workspace only.

## Troubleshooting

### Notification not sent
1. Check user has Slack connection: `SELECT * FROM user_slack_connections WHERE user_id = ?`
2. Check notification preferences: `SELECT slack_notification_preferences FROM users WHERE id = ?`
3. Check notification log: `SELECT * FROM slack_notifications WHERE user_id = ? ORDER BY created_at DESC`
4. Verify SLACK_BOT_TOKEN is set in environment variables

### "No active Slack workspace connected" error
Set SLACK_BOT_TOKEN in environment variables:
```bash
SLACK_BOT_TOKEN=xoxb-9933387529879-10283091144020-li35TAK2VaMmniNZtx10
```

### OAuth callback fails
1. Verify redirect URI matches exactly:
   - Production: `https://creative-library-frontend.onrender.com/auth/slack/callback`
   - Local: `http://localhost:3001/api/auth/slack/callback`
2. Check SLACK_CLIENT_ID and SLACK_CLIENT_SECRET are correct
3. Verify user approved all requested scopes

## API Endpoints

### OAuth
```
GET /api/auth/slack
  → Redirects to Slack authorization page

GET /api/auth/slack/callback?code=[code]
  → Handles OAuth callback, exchanges code for token
```

### Notifications (Admin)
```
GET /api/slack/notifications
  → Get all sent notifications (admin only)

GET /api/slack/notifications/:userId
  → Get notifications for specific user
```

### User Settings
```
PATCH /api/users/me/slack-preferences
Body: {
  "slack_notifications_enabled": true,
  "slack_notification_preferences": {
    "file_shared": true,
    "file_request_created": false
  }
}
```

## Next Steps

1. ✅ Environment variables configured
2. ✅ Slack service implemented with bot token support
3. ✅ File share notifications integrated
4. ⏳ Add notifications to file request creation
5. ⏳ Add notifications to comment mentions
6. ⏳ Add user preference UI in frontend
7. ⏳ Test end-to-end notification flow

## Production Deployment Checklist

- [ ] Set SLACK_BOT_TOKEN in Render environment variables
- [ ] Set SLACK_CLIENT_ID in Render environment variables
- [ ] Set SLACK_CLIENT_SECRET in Render environment variables
- [ ] Set SLACK_SIGNING_SECRET in Render environment variables
- [ ] Set FRONTEND_URL to production URL
- [ ] Verify redirect URI matches in Slack app settings
- [ ] Test OAuth login flow
- [ ] Test file share notification
- [ ] Monitor slack_notifications table for errors
- [ ] Set up alerts for failed notifications
