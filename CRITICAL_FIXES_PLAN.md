# Critical Fixes - Root Cause Analysis & Implementation Plan

## Date: January 15, 2026

---

## 🚨 CRITICAL ISSUES IDENTIFIED

### Issue #1: Database Column Mismatch - `team_role` Does Not Exist
**Error**: `column tm.team_role does not exist`

**Root Cause**:
- The `team_members` table was created with column name `role`
- The backend code is querying for `team_role`
- Column name mismatch between database schema and application code

**Impact**:
- Teams page completely broken
- Cannot fetch user teams
- All team-related features non-functional

**Fix Required**:
```sql
-- Option 1: Rename column in database (RECOMMENDED)
ALTER TABLE team_members RENAME COLUMN role TO team_role;

-- Option 2: Update all queries to use 'role' instead of 'team_role'
-- (Not recommended as code already uses team_role everywhere)
```

**Files to Check/Fix**:
1. Database migration scripts
2. `/backend/src/controllers/teamController.js` (lines 78, 186, 333, 342, 497)
3. Verify column name in production database

---

### Issue #2: Missing `comments` Column in `file_request_uploads`
**Error**: `column "comments" of relation "file_request_uploads" does not exist`

**Root Cause**:
- Frontend code was updated to send `comments` parameter
- Backend code expects `comments` column
- Database migration for adding `comments` column was NOT run on production

**Impact**:
- File request uploads failing
- Editors cannot upload files to requests

**Fix Required**:
```sql
-- Add comments column to file_request_uploads table
ALTER TABLE file_request_uploads
ADD COLUMN IF NOT EXISTS comments TEXT;
```

**Files Already Updated** (no changes needed):
- `/backend/src/controllers/fileRequestController.js` (line 985)
- `/frontend/src/pages/PublicFileRequestPage.tsx`

---

### Issue #3: Folder Navigation Not Working - Shows All Files
**Error**: Clicking any folder shows all media files instead of folder-specific files

**Root Cause**:
The Media Library is not filtering files by `folder_id` when a folder is selected.

**Current Behavior**:
- User clicks on a folder
- Frontend sets `currentFolderId` state
- Backend query does NOT filter by `folder_id`
- Returns all files regardless of folder

**Fix Required**:

**Backend** - `/backend/src/controllers/mediaController.js`:
```javascript
// In getAll() method, add folder_id filtering
async getAll(req, res, next) {
  try {
    const { folder_id, ...otherParams } = req.query;

    let whereClause = 'WHERE mf.is_deleted = FALSE';
    const params = [];
    let paramIndex = 1;

    // ADD THIS: Filter by folder_id
    if (folder_id) {
      whereClause += ` AND mf.folder_id = $${paramIndex}`;
      params.push(folder_id);
      paramIndex++;
    }

    // Rest of the query...
  }
}
```

**Frontend** - `/frontend/src/pages/MediaLibrary.tsx`:
```typescript
// Ensure folder selection passes folder_id to API
const fetchData = async () => {
  const params = {
    folder_id: currentFolderId, // MUST pass this
    page: currentPage,
    limit: pageSize,
    // ... other params
  };

  const response = await mediaApi.getAll(params);
};
```

---

### Issue #4: Slack "View Folder" Link Opens Dashboard
**Error**: Clicking "View Folder" from Slack notification opens dashboard root instead of specific folder

**Root Cause**:
Slack share link format is incorrect or frontend routing doesn't handle folder parameter.

**Current Link Format** (assumed):
```
https://creative-library-frontend.onrender.com/media
```

**Should Be**:
```
https://creative-library-frontend.onrender.com/media?folderId=FOLDER_ID
```

**Fix Required**:

**Backend** - Slack share notification:
```javascript
// Update Slack message to include folder ID in URL
const folderLink = `${process.env.FRONTEND_URL}/media?folderId=${folderId}`;
```

**Frontend** - `/frontend/src/pages/MediaLibrary.tsx`:
```typescript
// On component mount, check for folderId in URL params
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const folderIdFromUrl = params.get('folderId');

  if (folderIdFromUrl) {
    setCurrentFolderId(folderIdFromUrl);
    // Optionally navigate to folder in tree
  }
}, []);
```

---

### Issue #5: S3 Structure Documentation & Clarification

**Current S3 Structure** (from logs):

```
S3 Bucket: creative-library-media-pearmedia/

Structure:
{editor-name}/
  ├── videos/
  │   └── {timestamp}-{random}-{filename}.mp4
  ├── images/
  │   └── {timestamp}-{random}-{filename}.jpg
  ├── thumbnails/
  │   └── {timestamp}-{random}-thumb_{filename}.jpg
  └── documents/
      └── {timestamp}-{random}-{filename}.pdf

Example:
public-upload/
  ├── videos/
  │   └── 1768491599100-gzh3dnf0h-ad_9_Library_ID__1537653050648842.mp4
  └── thumbnails/
      └── 1768491601481-9kt589vkf-thumb_ad_9_Library_ID__1537653050648842.jpg

PARMEET/
  ├── images/
  │   └── 1768400000000-abc123-ad_10_Library_ID_82580472375880.jpg
  └── videos/
      └── 1768400000000-def456-ad_7_Library_ID_127404602475276.mp4
```

**Issues with Current Structure**:
1. ❌ No date-based organization
2. ❌ No folder hierarchy (all files flat within media type)
3. ❌ Cannot segregate by buyer/request
4. ❌ Difficult to find files by date
5. ❌ No way to identify request-specific uploads

**Proposed Improved S3 Structure**:

```
S3 Bucket: creative-library-media-pearmedia/

{editor-name}/
  └── {YYYY}/
      └── {MM}/
          └── {media-type}/
              └── {timestamp}-{random}-{filename}.ext

For File Requests:
file-requests/
  └── {request-id}/
      └── {editor-name}/
          └── {YYYY-MM-DD}/
              └── {media-type}/
                  └── {timestamp}-{random}-{filename}.ext

Example:
PARMEET/
  └── 2026/
      └── 01/
          ├── images/
          │   └── 1768491599100-abc123-ad_10_Library.jpg
          └── videos/
              └── 1768491599100-def456-ad_7_Library.mp4

file-requests/
  └── 2d9674e6-5d93-4e5c-9f33-6c7274c083d1/
      └── PARMEET/
          └── 2026-01-15/
              └── videos/
                  └── 1768491599100-gzh3dnf0h-test_file.mp4
```

**Benefits**:
✅ Easy to find files by date
✅ Organized by editor/buyer
✅ Request-specific uploads segregated
✅ Scalable structure
✅ Easy S3 lifecycle policies by date

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Critical Database Fixes (30 minutes)

**Step 1.1**: Create database migration script
```sql
-- File: backend/migrations/fix_team_columns.sql

-- Fix 1: Rename role to team_role in team_members
ALTER TABLE team_members RENAME COLUMN role TO team_role;

-- Fix 2: Add comments column to file_request_uploads
ALTER TABLE file_request_uploads
ADD COLUMN IF NOT EXISTS comments TEXT;

-- Verify changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'team_members'
  AND column_name = 'team_role';

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'file_request_uploads'
  AND column_name = 'comments';
```

**Step 1.2**: Run migration on production database
```bash
# Connect to production database and run migration
psql $DATABASE_URL -f backend/migrations/fix_team_columns.sql
```

---

### Phase 2: Fix Folder Navigation (1 hour)

**Step 2.1**: Update mediaController.js to filter by folder_id

File: `/backend/src/controllers/mediaController.js`

Add folder filtering logic to `getAll()` method around line 50-100.

**Step 2.2**: Ensure frontend passes folder_id parameter

File: `/frontend/src/pages/MediaLibrary.tsx`

Update `fetchData()` function to include `folder_id` in API call.

**Step 2.3**: Add URL parameter handling for direct folder links

---

### Phase 3: Fix Slack Folder Sharing (30 minutes)

**Step 3.1**: Update Slack share controller to include folder ID in URL

**Step 3.2**: Add URL parameter detection in MediaLibrary component

**Step 3.3**: Test Slack notification → folder navigation flow

---

### Phase 4: Improve S3 Structure (2 hours)

**Step 4.1**: Update `s3Service.js` to use date-based paths

**Step 4.2**: Update file upload logic to organize by date

**Step 4.3**: Update file request uploads to use request-specific paths

**Step 4.4**: Add migration script to reorganize existing S3 files (optional)

---

## 📋 TESTING CHECKLIST

### Teams Functionality
- [ ] Create new team (verify database insert with `team_role`)
- [ ] View teams list (verify query works)
- [ ] Add team member (verify `team_role` column)
- [ ] Update member role (verify update works)

### File Request Uploads
- [ ] Upload file to request with comments
- [ ] Verify comments saved in database
- [ ] Check S3 file organization

### Folder Navigation
- [ ] Click folder in Media Library
- [ ] Verify only folder files shown
- [ ] Test breadcrumb navigation
- [ ] Test "All Files" view

### Slack Sharing
- [ ] Share folder via Slack
- [ ] Click "View Folder" link
- [ ] Verify correct folder opens
- [ ] Verify files shown correctly

### S3 Structure
- [ ] Upload file → verify date-based path
- [ ] Upload to file request → verify request path
- [ ] Check S3 console for correct structure

---

## 🎯 PRIORITY ORDER

1. **HIGHEST PRIORITY**: Database column fixes (blocks everything)
   - Fix `team_role` column
   - Add `comments` column

2. **HIGH PRIORITY**: Folder navigation
   - Users cannot browse folders properly

3. **MEDIUM PRIORITY**: Slack folder links
   - Workaround: users can navigate manually

4. **LOW PRIORITY**: S3 structure improvement
   - Current structure works, just not optimal

---

## 📊 ESTIMATED TIME

- **Phase 1 (Database)**: 30 minutes
- **Phase 2 (Folders)**: 1 hour
- **Phase 3 (Slack)**: 30 minutes
- **Phase 4 (S3)**: 2 hours

**Total**: ~4 hours for complete fix

---

## 🚀 DEPLOYMENT NOTES

1. **Database migrations MUST run before code deployment**
2. Backup database before running migrations
3. Test migrations on staging first
4. S3 structure change is backwards compatible (old files still work)
5. No downtime required for any fixes

---

## 📝 SQL MIGRATION SCRIPT (READY TO RUN)

```sql
-- ================================================
-- CRITICAL FIX: Team Members & File Request Uploads
-- Date: 2026-01-15
-- ================================================

BEGIN;

-- Fix 1: Rename role to team_role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'role'
  ) THEN
    ALTER TABLE team_members RENAME COLUMN role TO team_role;
    RAISE NOTICE 'Column renamed: role → team_role';
  ELSE
    RAISE NOTICE 'Column team_role already exists, skipping rename';
  END IF;
END $$;

-- Fix 2: Add comments column
ALTER TABLE file_request_uploads
ADD COLUMN IF NOT EXISTS comments TEXT;

-- Verify changes
DO $$
DECLARE
  team_role_exists BOOLEAN;
  comments_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'team_role'
  ) INTO team_role_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'file_request_uploads' AND column_name = 'comments'
  ) INTO comments_exists;

  IF team_role_exists AND comments_exists THEN
    RAISE NOTICE '✅ All columns verified successfully';
  ELSE
    RAISE EXCEPTION '❌ Column verification failed';
  END IF;
END $$;

COMMIT;
```

