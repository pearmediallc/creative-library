# Phase 8 Teams Feature - Final Implementation Plan

## Current Issues Identified

### 1. Authentication UX
- ❌ Email whitelist error shows "Failed to validate email" instead of clear message
- ✅ Backend correctly requires approval
- ✅ Frontend handles approval workflow
- **Fix**: Improve error message clarity

### 2. Phase 8 Teams Features NOT Accessible
- ❌ TeamManagementDialog not integrated into TeamsPage
- ❌ TeamActivityFeed not visible
- ❌ RequestTemplateManager not accessible
- ❌ TeamFolderBadge not showing on team folders
- ❌ No team discussion/chat feature

### 3. Editor File Requests
- ⚠️ Need to verify editors see their assigned requests
- ⚠️ Need to verify upload endpoints work correctly

### 4. Notification System
- ❌ No sound notifications
- ❌ No visual popup for mentions/requests

---

## Implementation Tasks

### Task 1: Wire Phase 8 Components into TeamsPage
**File**: `frontend/src/pages/TeamsPage.tsx`

**Changes**:
1. Import TeamManagementDialog, TeamActivityFeed, RequestTemplateManager
2. Replace current team management with TeamManagementDialog
3. Add tabs: Overview | Members | Templates | Activity | Analytics
4. Show Request Templates in Templates tab
5. Show Activity Feed in Activity tab
6. Add Analytics dashboard

### Task 2: Add TeamFolderBadge to Folder Displays
**Files**:
- `frontend/src/components/FolderCard.tsx`
- `frontend/src/components/FolderTree.tsx`
- `frontend/src/pages/MediaLibrary.tsx`

**Changes**:
1. Check if folder has `team_id`
2. Display TeamFolderBadge next to folder name
3. Fetch team name from API

### Task 3: Create Team Discussion Feature
**New File**: `frontend/src/components/TeamDiscussionPanel.tsx`

**Features**:
- Real-time chat interface
- @mentions support
- File/link sharing
- Thread-based discussions
- Backend: New table `team_messages`
- Backend: WebSocket support or polling

### Task 4: Add Notification System
**New Files**:
- `frontend/src/hooks/useNotifications.ts`
- `frontend/src/components/NotificationSound.tsx`
- `frontend/src/utils/notificationSound.ts`

**Features**:
- Browser notification API
- Sound alerts (customizable)
- Notification center
- Mark as read
- Filter by type (mention, request, file share)

### Task 5: Verify Editor Requests Workflow
**Check**:
- Editor login → sees assigned requests
- Editor uploads files → goes to correct folder
- Requester gets notified

---

## Estimated Time
- Task 1: 2-3 hours
- Task 2: 1 hour
- Task 3: 4-5 hours (with backend)
- Task 4: 2-3 hours
- Task 5: 1 hour testing

**Total**: 10-13 hours

---

## Priority Order
1. Task 1 (Wire Teams Components) - HIGH
2. Task 5 (Verify Editor Requests) - HIGH
3. Task 2 (TeamFolderBadge) - MEDIUM
4. Task 4 (Notifications) - MEDIUM
5. Task 3 (Team Discussion) - LOW (Can be Phase 9)
