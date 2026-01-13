# @ Mention System - Complete Implementation Guide

## Overview

The @ mention system allows users to mention other team members in Canvas briefs. When mentioned, users receive notifications and can navigate directly to the canvas where they were mentioned.

## Features Implemented

### Frontend Components

#### 1. MentionInput Component
**Location**: `frontend/src/components/MentionInput.tsx`

**Features**:
- Detects `@` character in text inputs
- Fetches all users from `/api/admin/users`
- Shows autocomplete dropdown with user list
- Filters users by name or email as you type
- Keyboard navigation:
  - `Arrow Down` / `Arrow Up` - Navigate through users
  - `Enter` - Select highlighted user
  - `Escape` - Close dropdown
- Inserts mentions in format: `@[User Name](user_id)`
- Supports both single-line and multi-line inputs
- Click outside to close dropdown

**Usage**:
```tsx
import { MentionInput } from './MentionInput';

<MentionInput
  value={text}
  onChange={setText}
  placeholder="Type @ to mention someone"
  multiline={true}
  rows={3}
/>
```

#### 2. NotificationBell Component
**Location**: `frontend/src/components/NotificationBell.tsx`

**Features**:
- Bell icon with unread count badge (shows "9+" if more than 9)
- Dropdown showing recent 20 notifications
- Real-time updates (polls every 30 seconds)
- Mark individual notification as read (click on notification)
- Mark all notifications as read button
- Time ago display (e.g., "5m ago", "2h ago", "3d ago")
- Click notification to navigate to referenced content
- Visual indicator for unread notifications (blue dot + blue background)
- "View all notifications" footer button

**Integration**:
Already integrated in `DashboardLayout` - appears in top-right corner of all pages.

#### 3. Canvas Editor Integration
**Location**: `frontend/src/components/CanvasEditor.tsx`

All text input fields in the Canvas editor now use `MentionInput`:
- Headings (h2 and h3)
- Text blocks (multiline)
- List items
- Checklist items

Users can mention anyone in any of these fields.

### Backend Components

#### 1. Notifications Database
**Migration**: `backend/migrations/20260114_add_notifications_table.sql`

**Schema**:
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50),
  reference_id UUID,
  metadata JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  read_at TIMESTAMP
);
```

**Indexes**:
- `idx_notifications_user` - For fetching user's notifications
- `idx_notifications_is_read` - For unread count queries
- `idx_notifications_created_at` - For sorting by date
- `idx_notifications_type` - For filtering by type
- `idx_notifications_reference` - For reference lookups

#### 2. Notification Model
**Location**: `backend/src/models/Notification.js`

**Key Methods**:
- `create(data)` - Create a notification
- `getByUserId(userId, options)` - Get user's notifications
- `getUnreadCount(userId)` - Count unread notifications
- `markAsRead(notificationId, userId)` - Mark single as read
- `markAllAsRead(userId)` - Mark all user's notifications as read
- `deleteById(notificationId, userId)` - Delete notification
- `createMentionNotifications(userIds, mentionedBy, canvasData)` - Create mention notifications

#### 3. Notification Controller
**Location**: `backend/src/controllers/notificationController.js`

**Endpoints**:
- `GET /api/notifications` - Get notifications (with pagination)
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark as read
- `POST /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

#### 4. Canvas Controller Updates
**Location**: `backend/src/controllers/canvasController.js`

**New Functionality**:
- `extractMentions(content)` - Parse canvas content for @[Name](user_id) mentions
- Automatically creates notifications when canvas is saved with mentions
- Non-blocking (canvas saves even if notifications fail)

**Mention Format**: `@[User Name](user_id)`

**Extraction Logic**:
```javascript
const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
```

Searches all canvas blocks:
- Heading content
- Text content
- List items (strings)
- Checklist items (text property)

## How It Works

### User Workflow

1. **Mentioning Someone**:
   - User opens Canvas editor
   - Types `@` in any text field
   - Dropdown shows all system users
   - User types to filter (e.g., "@john")
   - User selects from dropdown or presses Enter
   - Mention is inserted: `@[John Doe](abc-123-uuid)`

2. **Receiving Notifications**:
   - When canvas is saved, backend extracts mentions
   - Notifications created for each mentioned user
   - Mentioned user sees red badge on bell icon
   - Click bell to see notification
   - Click notification to navigate to canvas

3. **Reading Notifications**:
   - Clicking notification marks it as read
   - Badge count decreases
   - Blue background and dot disappear
   - Can mark all as read with one click

### Technical Flow

```
User types @ in Canvas
    ↓
MentionInput detects @
    ↓
Fetches users from /api/admin/users
    ↓
Shows dropdown with filtered results
    ↓
User selects → Inserts @[Name](id)
    ↓
Canvas auto-saves after 2 seconds
    ↓
Backend receives canvas content
    ↓
extractMentions() finds all @[...](...)
    ↓
Creates notification for each user
    ↓
Frontend polls /api/notifications/unread-count
    ↓
Badge updates with new count
    ↓
User clicks bell → sees notifications
    ↓
User clicks notification → navigates to canvas
    ↓
Notification marked as read
```

## Installation & Setup

### Step 1: Run Notifications Migration

You need to create the `notifications` table in the database.

**Option A: Using Render Shell (Recommended)**

1. Go to https://dashboard.render.com
2. Select your backend service: `creative-library`
3. Click "Shell" tab
4. Run:
```bash
cd backend
node scripts/run-notifications-migration.js
```

**Option B: Using Local Database Connection**

```bash
# From your local machine
cd /Users/mac/Desktop/creative-library/backend

# Use DATABASE_URL from Render environment
psql "$DATABASE_URL" -f migrations/20260114_add_notifications_table.sql
```

**Option C: Using psql directly**

```bash
# Connect to database
psql "$DATABASE_URL"

# Paste the contents of migrations/20260114_add_notifications_table.sql
```

### Step 2: Verify Migration

```sql
-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'notifications';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'notifications';

-- Should show 5 indexes:
-- - notifications_pkey (primary key)
-- - idx_notifications_user
-- - idx_notifications_is_read
-- - idx_notifications_created_at
-- - idx_notifications_type
-- - idx_notifications_reference
```

### Step 3: Deploy Frontend

Frontend is already deployed via Render auto-deployment from Git push.

The changes include:
- `MentionInput.tsx` - New component
- `NotificationBell.tsx` - New component
- `CanvasEditor.tsx` - Updated to use MentionInput
- `DashboardLayout.tsx` - Updated to show NotificationBell

### Step 4: Test End-to-End

1. **Create a Canvas Brief**:
   - Go to Dashboard → File Requests
   - Click on a file request
   - Click "Create Canvas Brief" or "Edit Canvas"

2. **Mention Someone**:
   - In any text field, type `@`
   - You should see a dropdown with all users
   - Type a name to filter (e.g., "john")
   - Click a user or press Enter
   - You should see: `@[User Name](uuid)` inserted

3. **Save and Check**:
   - Wait 2 seconds for auto-save
   - Status should show "✓ Saved"
   - Close the canvas

4. **Check Notifications** (as mentioned user):
   - Login as the mentioned user
   - Look for red badge on bell icon (top right)
   - Click bell icon
   - Should see notification: "You were mentioned in a canvas brief"

5. **Navigate to Canvas**:
   - Click the notification
   - Should navigate to file request with canvas
   - Notification should be marked as read
   - Badge count should decrease

## API Documentation

### GET /api/notifications

Get user's notifications.

**Query Parameters**:
- `limit` (optional) - Number of notifications to return (default: 50)
- `offset` (optional) - Offset for pagination (default: 0)

**Response**:
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "type": "mention",
      "title": "You were mentioned in a canvas",
      "message": "John Doe mentioned you in a canvas brief",
      "reference_type": "canvas",
      "reference_id": "canvas-uuid",
      "metadata": {
        "fileRequestId": "request-uuid",
        "mentionedBy": "user-uuid",
        "mentionedByName": "John Doe"
      },
      "is_read": false,
      "created_at": "2026-01-14T10:30:00Z",
      "read_at": null
    }
  ],
  "total": 10,
  "hasMore": false
}
```

### GET /api/notifications/unread-count

Get count of unread notifications.

**Response**:
```json
{
  "success": true,
  "count": 5
}
```

### PATCH /api/notifications/:id/read

Mark notification as read.

**Response**:
```json
{
  "success": true,
  "notification": { /* updated notification */ }
}
```

### POST /api/notifications/mark-all-read

Mark all user's notifications as read.

**Response**:
```json
{
  "success": true,
  "updated": 5
}
```

### DELETE /api/notifications/:id

Delete a notification.

**Response**:
```json
{
  "success": true,
  "message": "Notification deleted"
}
```

## Configuration

### Polling Interval

The NotificationBell polls for new notifications every 30 seconds. To change:

**File**: `frontend/src/components/NotificationBell.tsx`

```typescript
// Change 30000 to desired milliseconds
const interval = setInterval(fetchNotifications, 30000);
```

### Notification Limit

By default, shows 20 most recent notifications. To change:

```typescript
// In NotificationBell.tsx
const notifResponse = await axios.get(`${API_URL}/notifications`, {
  params: { limit: 20 } // Change this number
});
```

### Mention Regex

If you need to change the mention format:

**File**: `backend/src/controllers/canvasController.js`

```javascript
// Current format: @[Name](uuid)
const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;

// Alternative format: @<uuid>
// const mentionRegex = /@<([a-f0-9-]+)>/g;
```

## Troubleshooting

### Issue: Dropdown doesn't appear when typing @

**Check**:
1. Open browser console for errors
2. Verify `/api/admin/users` endpoint is accessible
3. Check if user has auth token (localStorage.getItem('token'))

**Fix**:
```javascript
// In MentionInput.tsx, add console.log
const fetchUsers = async () => {
  console.log('Fetching users...');
  const response = await axios.get(/* ... */);
  console.log('Users:', response.data);
};
```

### Issue: Notifications not being created

**Check**:
1. Backend logs for errors in canvasController.upsertCanvas
2. Verify notifications table exists
3. Check if mentions are being extracted

**Debug**:
```javascript
// In canvasController.js
const mentionedUserIds = this.extractMentions(content);
console.log('Extracted mentions:', mentionedUserIds);
```

### Issue: Bell icon not showing

**Check**:
1. Verify `NotificationBell` is imported in `DashboardLayout`
2. Check browser console for import errors
3. Verify lucide-react is installed

### Issue: Notification count not updating

**Check**:
1. Verify polling is working (check Network tab)
2. Check for API errors in console
3. Verify auth token is valid

**Fix**:
```javascript
// In NotificationBell.tsx, add logging
const fetchNotifications = async () => {
  console.log('Polling notifications...');
  // ...
};
```

### Issue: Cannot navigate to canvas from notification

**Check**:
1. Verify `fileRequestId` is in notification metadata
2. Check if navigation route is correct
3. Look for React Router errors

## Future Enhancements

### Potential Improvements

1. **Real-time Notifications** (WebSocket)
   - Replace polling with WebSocket connection
   - Instant notification delivery
   - Reduced server load

2. **Email Notifications**
   - Send email when user is mentioned
   - Configurable in user settings
   - Email templates for mentions

3. **Slack Integration**
   - Post notification to user's Slack
   - Link back to canvas
   - Already have Slack OAuth

4. **Mention Preview**
   - Hover over mention to see user info
   - Show user avatar and role
   - Quick profile preview

5. **Bulk Mentions**
   - Mention entire teams: @team-marketing
   - Mention roles: @all-editors
   - Reduce repetitive typing

6. **Notification Preferences**
   - User settings for notification types
   - Mute/unmute notifications
   - Daily digest option

7. **Rich Notifications**
   - Show canvas preview in notification
   - Mention context (surrounding text)
   - Attachment thumbnails

## Testing Checklist

### Manual Testing

- [ ] Type @ in canvas heading
- [ ] Dropdown appears with all users
- [ ] Filter users by typing name
- [ ] Navigate with arrow keys
- [ ] Select with Enter key
- [ ] Close with Escape key
- [ ] Mention inserted correctly
- [ ] Try @ in text block
- [ ] Try @ in list item
- [ ] Try @ in checklist item
- [ ] Save canvas (auto-save or manual)
- [ ] Check backend logs (no errors)
- [ ] Login as mentioned user
- [ ] See badge on bell icon
- [ ] Click bell to see notification
- [ ] Notification shows correct info
- [ ] Click notification
- [ ] Navigate to correct canvas
- [ ] Notification marked as read
- [ ] Badge count decreases
- [ ] Click "Mark all as read"
- [ ] All notifications marked as read
- [ ] Badge disappears

### Edge Cases

- [ ] Mention same user multiple times (only one notification)
- [ ] Mention yourself (no notification)
- [ ] Very long user name (truncates properly)
- [ ] Special characters in user name
- [ ] Multiple @ symbols in one text
- [ ] Delete mention and re-add
- [ ] Network error during fetch users
- [ ] Network error during save
- [ ] Logout/login (notifications persist)
- [ ] Multiple tabs open (both update)

## Support

If you encounter issues:

1. Check browser console for errors
2. Check backend logs in Render
3. Verify migrations have been run
4. Test with different users
5. Clear browser cache/localStorage
6. Check network requests in DevTools

## Summary

The @ mention system is fully implemented and ready to use. All code is deployed, but the **notifications table migration must be run manually** in production.

**Key Files**:
- Frontend: `MentionInput.tsx`, `NotificationBell.tsx`, `CanvasEditor.tsx`
- Backend: `Notification.js`, `notificationController.js`, `canvasController.js`
- Migration: `run-notifications-migration.js`

**Next Step**: Run the migration script in Render shell to enable notifications.
