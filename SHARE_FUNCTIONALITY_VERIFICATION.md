# Share Functionality Verification Guide

## Overview
This document verifies that the share functionality correctly shows files/folders to designated users (editors, media buyers) without any discrepancies.

## How Share Permissions Work

### Database Schema
```sql
file_permissions table:
- resource_type: 'file' or 'folder'
- resource_id: UUID of the file or folder
- grantee_type: 'user' or 'team'
- grantee_id: UUID of the user or team
- permission_type: 'view', 'download', 'edit', 'delete'
- expires_at: Optional expiration date
```

### Query Logic (Backend)

#### 1. Direct User Shares
When you share a file with a specific user (e.g., Ritu - editor):
```sql
SELECT * FROM file_permissions
WHERE grantee_type = 'user' AND grantee_id = '<user_id>'
```

#### 2. Team Shares
When you share a file with a team:
```sql
SELECT * FROM file_permissions fp
JOIN team_members tm ON fp.grantee_id = tm.team_id
WHERE fp.grantee_type = 'team' AND tm.user_id = '<user_id>' AND tm.is_active = TRUE
```

#### 3. Combined Query (getSharedWithMe)
The actual implementation in `permissionController.js` (lines 321-376):
```sql
SELECT DISTINCT ON (fp.resource_type, fp.resource_id, fp.permission_type)
  fp.resource_type,
  fp.resource_id,
  fp.permission_type,
  -- File metadata
  CASE WHEN fp.resource_type = 'file' THEN mf.original_filename
       WHEN fp.resource_type = 'folder' THEN f.name
  END as resource_name,
  -- ... other fields
FROM file_permissions fp
LEFT JOIN team_members tm ON fp.grantee_type = 'team' AND fp.grantee_id = tm.team_id
LEFT JOIN media_files mf ON fp.resource_type = 'file' AND fp.resource_id = mf.id AND mf.is_deleted = FALSE
LEFT JOIN folders f ON fp.resource_type = 'folder' AND fp.resource_id = f.id AND f.is_deleted = FALSE
WHERE (
  -- Direct shares to this user
  (fp.grantee_type = 'user' AND fp.grantee_id = $1)
  OR
  -- Team shares where this user is a team member
  (fp.grantee_type = 'team' AND tm.user_id = $1 AND tm.is_active = TRUE)
)
AND (fp.expires_at IS NULL OR fp.expires_at > NOW())
AND (
  -- Only show non-deleted resources
  (fp.resource_type = 'file' AND mf.id IS NOT NULL) OR
  (fp.resource_type = 'folder' AND f.id IS NOT NULL)
)
ORDER BY fp.resource_type, fp.resource_id, fp.permission_type, fp.granted_at DESC
```

## Verification Checklist

### ✅ Backend Verification

1. **No Role Restrictions**
   - ✅ Route `/api/permissions/shared-with-me` only requires `authenticateToken`
   - ✅ NO `requireAdmin` middleware
   - ✅ Works for: admin, creative (editor), buyer

2. **Query Correctness**
   - ✅ Includes both direct user shares AND team shares
   - ✅ Filters out expired permissions
   - ✅ Excludes deleted files/folders
   - ✅ Returns resource metadata (filename, type, size, etc.)

3. **Permission Types**
   - ✅ Supports: view, download, edit, delete
   - ✅ Multiple permissions can be granted per resource

### ✅ Frontend Verification

1. **Shared With Me Page** (`frontend/src/pages/SharedWithMePage.tsx`)
   - ✅ Accessible to all authenticated users
   - ✅ Displays shared resources in card grid
   - ✅ Shows permission badges
   - ✅ Allows download if user has download permission

2. **Navigation**
   - ✅ "Shared with me" link in sidebar for all users
   - ✅ Located at: `/shared-with-me`

## Test Scenarios

### Scenario 1: Share File with Individual Editor
**Steps:**
1. Admin logs in
2. Selects a file → Click Share
3. Select "User" tab
4. Choose "Ritu" (editor) from dropdown
5. Select permissions: "Can view" + "Can download"
6. Click Share

**Expected Result:**
- Ritu logs in → Goes to "Shared with me" page
- ✅ File appears in the list
- ✅ Shows "view" and "download" permission badges
- ✅ Download button is enabled

### Scenario 2: Share Folder with Team
**Steps:**
1. Admin logs in
2. Selects a folder → Click Share
3. Select "Team" tab
4. Choose "creative team" from dropdown
5. Select permissions: "Can view", "Can edit"
6. Click Share

**Expected Result:**
- Any team member logs in → Goes to "Shared with me" page
- ✅ Folder appears in the list
- ✅ Shows "view" and "edit" permission badges

### Scenario 3: Share with Media Buyer
**Steps:**
1. Admin logs in
2. Selects a file → Click Share
3. Select "User" tab
4. Choose media buyer from dropdown
5. Select permissions: "Can view"
6. Click Share

**Expected Result:**
- Media buyer logs in → Goes to "Shared with me" page
- ✅ File appears in the list
- ✅ Shows "view" permission badge
- ✅ Download button is disabled (no download permission)

## Common Issues & Solutions

### Issue 1: Shared files not showing up
**Possible causes:**
1. Permission expired: Check `expires_at` field
2. Resource deleted: Check `is_deleted` flag on media_files/folders
3. Team membership inactive: Check `team_members.is_active = TRUE`
4. Wrong grantee_id: Verify user/team ID matches

**Solution:**
```sql
-- Check permissions for a specific user
SELECT
  fp.*,
  mf.original_filename,
  mf.is_deleted as file_deleted,
  tm.is_active as team_active
FROM file_permissions fp
LEFT JOIN team_members tm ON fp.grantee_type = 'team' AND fp.grantee_id = tm.team_id
LEFT JOIN media_files mf ON fp.resource_type = 'file' AND fp.resource_id = mf.id
WHERE (
  (fp.grantee_type = 'user' AND fp.grantee_id = '<user_id>')
  OR
  (fp.grantee_type = 'team' AND tm.user_id = '<user_id>')
);
```

### Issue 2: User can see file but not download
**Cause:** User has "view" permission but not "download" permission

**Solution:**
Grant additional permission:
```sql
INSERT INTO file_permissions (resource_type, resource_id, grantee_type, grantee_id, permission_type, granted_by)
VALUES ('file', '<file_id>', 'user', '<user_id>', 'download', '<admin_id>');
```

### Issue 3: Shared resources showing after revoke
**Cause:** Frontend cache not refreshed

**Solution:**
- Refresh the page
- Or implement real-time updates with WebSocket

## API Endpoints

### Get Shared With Me
```
GET /api/permissions/shared-with-me
Authorization: Bearer <token>

Response:
{
  "success": true,
  "data": [
    {
      "resource_type": "file",
      "resource_id": "uuid",
      "resource_name": "example.mp4",
      "file_type": "video/mp4",
      "file_size": 1048576,
      "thumbnail_url": "https://...",
      "s3_url": "https://...",
      "owner_name": "Admin User",
      "owner_email": "admin@example.com",
      "shared_at": "2026-01-12T10:00:00Z",
      "permissions": ["view", "download"]
    }
  ]
}
```

### Grant Permission
```
POST /api/permissions
Authorization: Bearer <token>

Body:
{
  "resource_type": "file",
  "resource_id": "uuid",
  "grantee_type": "user",
  "grantee_id": "uuid",
  "permission_type": "view",
  "expires_at": "2026-12-31T23:59:59Z" // optional
}

Response:
{
  "success": true,
  "data": {
    "id": "uuid",
    "resource_type": "file",
    "resource_id": "uuid",
    "grantee_type": "user",
    "grantee_id": "uuid",
    "permission_type": "view",
    "granted_by": "uuid",
    "granted_at": "2026-01-12T10:00:00Z",
    "expires_at": "2026-12-31T23:59:59Z"
  }
}
```

### Revoke Permission
```
DELETE /api/permissions/:id
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Permission revoked successfully"
}
```

## Conclusion

The share functionality is **correctly implemented** and works for all user roles:
- ✅ Editors can see files/folders shared with them
- ✅ Media buyers can see files/folders shared with them
- ✅ Team members see resources shared with their team
- ✅ Permissions are respected (view, download, edit, delete)
- ✅ Expired permissions are automatically filtered out
- ✅ Deleted resources don't appear

**No code changes needed** - the implementation is accurate and complete.
