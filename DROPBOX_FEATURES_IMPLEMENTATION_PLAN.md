# 🚀 Dropbox-Like Features Implementation Plan
## Creative Library Enhancement - Complete Blueprint

---

## 📋 TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Requested Features Breakdown](#requested-features-breakdown)
4. [Additional Dropbox Features Analysis](#additional-dropbox-features-analysis)
5. [Database Schema Changes](#database-schema-changes)
6. [Backend Implementation Plan](#backend-implementation-plan)
7. [Frontend Implementation Plan](#frontend-implementation-plan)
8. [Implementation Phases](#implementation-phases)
9. [Risk Mitigation Strategy](#risk-mitigation-strategy)
10. [Testing Strategy](#testing-strategy)
11. [Timeline & Resources](#timeline--resources)

---

## 1. EXECUTIVE SUMMARY

### Goal
Transform Creative Library into a Dropbox-like collaborative asset management system with role-based access, folder hierarchy, batch uploads, real-time progress tracking, and buyer-specific permissions.

### Scope
- **Editor Features**: Folder uploads, batch operations, date-based organization, buyer-specific uploads, folder management with audit trails
- **Buyer Features**: Advanced filtering, sub-user management, library sharing, collaboration features
- **Core Features**: Real-time upload progress, folder hierarchy, version control, file operations audit

### Impact
- **Zero Breaking Changes**: All existing functionality preserved via backward compatibility
- **Progressive Enhancement**: New features added as opt-in capabilities
- **Database Evolution**: Schema migrations with rollback support
- **User Experience**: Modern, intuitive interface matching Dropbox UX patterns

---

## 2. CURRENT SYSTEM ANALYSIS

### ✅ What We Have (Working Well)

**Strong Foundation:**
- JWT authentication with role-based access control
- AWS S3 integration with CloudFront CDN
- Metadata processing (strip/embed EXIF)
- Thumbnail generation for images/videos
- Editor-based organization in S3
- Soft delete with audit trails
- Monthly upload limits
- Email whitelist system
- Bulk metadata operations (async)
- Activity logging

**Database:**
- PostgreSQL with UUID primary keys
- Comprehensive indexing
- Soft delete support
- Role system: admin, creative (editor), buyer

**Current File Organization:**
```
S3: {editor-name}/{media-type}/{unique-id}-{filename}
Database: media_files table with editor_id, tags, description
```

### ❌ What's Missing (Gaps to Fill)

**No Folder Hierarchy:**
- Files flat-organized by editor only
- No user-created folders/collections
- No nested folder structure
- No folder-level permissions

**No Batch Upload:**
- Single file upload only
- No folder upload capability
- No drag-and-drop multi-select
- No upload queue management

**No Real-time Progress:**
- No upload progress tracking
- No success/failure notifications during upload
- No concurrent upload handling

**No Buyer-Specific Access:**
- Buyers see all files (no filtering by assignment)
- No file-level buyer permissions
- No shared folders between buyers

**No Folder Operations:**
- Cannot create folders
- Cannot move files between folders
- Cannot copy/duplicate files
- No folder-level audit trails

**No Collaborative Features:**
- No file sharing links
- No sub-user management for buyers
- No commenting/annotations
- No approval workflows

---

## 3. REQUESTED FEATURES BREAKDOWN

### 🎯 EDITOR FEATURES

#### Feature 1: Folder & Multi-File Upload
**Requirement:** Editors can upload entire folders or multiple files in one operation

**Implementation:**
- Frontend: HTML5 File API with `webkitdirectory` attribute for folder selection
- Frontend: Drag-and-drop zone supporting multiple files and folders
- Backend: Batch upload endpoint accepting array of files
- Backend: Folder structure preservation in database
- Queue system: Process uploads sequentially or in parallel (configurable)

**Database Changes:**
- New table: `folders` (id, name, parent_folder_id, owner_id, created_at)
- Add to `media_files`: `folder_id` (FK to folders), `upload_batch_id` (group related uploads)

**S3 Storage:**
```
Current: {editor}/{media-type}/{unique-id}-{filename}
New:     {editor}/{folder-path}/{media-type}/{unique-id}-{filename}
Example: deep/2024-01-15/Campaign-Assets/images/abc123-photo.jpg
```

---

#### Feature 2: Real-time Upload Progress
**Requirement:** Show live upload progress, success/failure for each file (like Google Drive)

**Implementation:**
- Frontend: XMLHttpRequest with progress events OR axios onUploadProgress
- WebSocket connection for server-side processing updates
- Upload queue UI showing:
  - File name, size, progress bar (0-100%)
  - Status: queued → uploading → processing → completed/failed
  - Retry failed uploads button
  - Pause/resume capability

**Backend:**
- Chunked upload support for large files (multipart S3 upload)
- Progress tracking in Redis or memory cache
- WebSocket server (Socket.io) for real-time updates
- Upload session management

**UI Components:**
- Sticky bottom panel with collapsible upload queue
- Notifications for completed/failed uploads
- Detailed error messages (file size, type, S3 errors)

---

#### Feature 3: Auto Date-Based Folder Organization
**Requirement:** Files auto-organized in date folders (YYYY-MM-DD format)

**Implementation:**
- **Opt-in setting** per editor or upload session
- Frontend: Checkbox "Organize by date" (enabled by default)
- Backend: Auto-create folder with format `YYYY-MM-DD` on upload
- Database: `folders.auto_created` boolean flag
- S3: Include date in path when enabled

**Folder Structure:**
```
Option A (by upload date):
  └─ 2024-01-15/
     ├─ image1.jpg
     ├─ video1.mp4
     └─ Campaign-Assets/ (user-created subfolder)

Option B (by file creation date - from EXIF):
  └─ 2024-01-10/ (photo taken date)
     └─ photo.jpg
```

**Backward Compatibility:**
- Existing files without folder_id → virtual "root" folder
- Date organization optional (toggle in settings)

---

#### Feature 4: Buyer-Specific Upload Assignment
**Requirement:** Editors select buyer during upload; files only visible to that buyer

**Implementation:**
- Frontend: Buyer dropdown in upload modal
- Database changes:
  - New table: `file_permissions` (id, media_file_id, user_id, permission_type, granted_by, granted_at)
  - Permission types: 'owner', 'viewer', 'editor', 'downloader'
  - Add to `media_files`: `assigned_buyer_id` (FK to users where role='buyer')

**Access Control Logic:**
```javascript
// File visibility rules:
if (user.role === 'admin') {
  // See everything
  return allFiles;
} else if (user.role === 'creative') {
  // See only own uploads
  return files.where('uploaded_by', user.id);
} else if (user.role === 'buyer') {
  // See files assigned to them OR shared with them
  return files.where('assigned_buyer_id', user.id)
              .orWhere(hasPermission(user.id));
}
```

**UI Changes:**
- Upload modal: "Assign to buyer" dropdown (optional)
- File card: Badge showing "Private - Assigned to [Buyer Name]"
- Admin can see assignment and override

---

#### Feature 5: Folder Management with Audit Trails
**Requirement:** Create folders, move files, track all operations

**Implementation:**

**Folder Operations:**
1. **Create Folder**: POST /api/folders
2. **Rename Folder**: PATCH /api/folders/:id
3. **Delete Folder**: DELETE /api/folders/:id (soft delete, check for files)
4. **Move Files**: POST /api/files/move (fileIds[], targetFolderId)
5. **Copy Files**: POST /api/files/copy (fileIds[], targetFolderId)

**Audit Trail:**
- New table: `file_operations_log`
  ```sql
  id, user_id, operation_type,
  source_folder_id, target_folder_id,
  file_ids (JSONB array),
  metadata (JSONB),
  ip_address, user_agent,
  created_at
  ```

**Operation Types:**
- `folder_create`, `folder_rename`, `folder_delete`
- `file_move`, `file_copy`, `file_delete`
- `file_upload`, `permission_grant`, `permission_revoke`

**Security:**
- Only owner or admin can move/delete files
- Cannot move to folders you don't have access to
- Audit log immutable (append-only)

**UI:**
- Context menu on files: Move to, Copy to, Delete
- Drag-and-drop files between folders
- Audit log viewer in admin panel

---

### 🎯 BUYER FEATURES

#### Feature 6: Advanced Filtering
**Requirement:** Filter by date, media type (image/video), editor name

**Implementation:**

**Filter Panel (Left Sidebar):**
```
Filters
├─ Date Range
│  ├─ Today
│  ├─ Last 7 days
│  ├─ Last 30 days
│  ├─ Custom range (date picker)
├─ Media Type
│  ├─ Images (checkbox)
│  ├─ Videos (checkbox)
├─ Editor
│  ├─ [Editor 1] (checkbox)
│  ├─ [Editor 2] (checkbox)
│  └─ ... (all editors)
├─ File Size
│  ├─ < 10MB
│  ├─ 10-50MB
│  └─ > 50MB
├─ Folders
│  └─ Browse folder tree
└─ [Clear All Filters]
```

**Backend:**
- Update `getMediaFiles()` to accept filter params
- SQL query builder for dynamic WHERE clauses
- Indexed queries for performance

**URL State:**
```
/library?date_from=2024-01-01&date_to=2024-01-31&type=image,video&editor=deep,arun
```

**Saved Filters:**
- New table: `saved_filters` (user_id, name, filter_params JSONB)
- Quick access dropdown: "My Saved Filters"

---

#### Feature 7: Sub-User Management & Library Sharing
**Requirement:** Buyers can create sub-users or grant access to existing users

**Implementation:**

**Sub-User System:**

**Option A: Hierarchical User Model**
- Add to `users` table: `parent_user_id` (FK to users)
- Sub-users inherit parent's permissions
- Parent can manage sub-user access levels

**Option B: Team/Group Model (Recommended)**
- New table: `teams` (id, name, owner_id, created_at)
- New table: `team_members` (team_id, user_id, role, added_by, added_at)
- Buyers create teams and invite members
- File permissions granted to teams (not individual users)

**Team Roles:**
- `owner` - Full control (buyer)
- `admin` - Manage members, upload, delete
- `member` - View and download only
- `viewer` - View only (no download)

**Sharing Workflow:**
1. Buyer creates team: "Marketing Team"
2. Buyer invites users by email (existing or new)
3. Invited users get access to buyer's assigned files
4. Buyer sets role per member

**Database Tables:**
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50), -- owner, admin, member, viewer
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE team_file_permissions (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  folder_id UUID REFERENCES folders(id),
  permission_level VARCHAR(50), -- view, download, edit
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW()
);
```

**Access Control:**
```javascript
function canAccessFile(user, file) {
  // Admin sees all
  if (user.role === 'admin') return true;

  // Owner sees own uploads
  if (file.uploaded_by === user.id) return true;

  // Assigned buyer sees file
  if (file.assigned_buyer_id === user.id) return true;

  // Team member sees shared files
  if (isTeamMember(user.id, file.assigned_buyer_id)) return true;

  return false;
}
```

**UI:**
- Buyer Dashboard → "My Teams" section
- "Invite Members" button → Email input with role dropdown
- Team file browser with permission badges
- Admin can see all teams and override access

---

## 4. ADDITIONAL DROPBOX FEATURES ANALYSIS

### 🎯 Feature Comparison Matrix

| Feature | Dropbox | Creative Library (Current) | Proposed |
|---------|---------|---------------------------|----------|
| **File Organization** |
| Folder hierarchy | ✅ Unlimited depth | ❌ Flat editor structure | ✅ Unlimited depth |
| Drag-and-drop files | ✅ | ❌ | ✅ |
| Batch upload | ✅ | ❌ Single file | ✅ Multiple files + folders |
| Auto-organize | ❌ | ❌ | ✅ Date-based folders |
| **Collaboration** |
| File sharing links | ✅ Public/private | ❌ | ✅ Expiring links |
| Folder sharing | ✅ Team folders | ❌ | ✅ Team-based access |
| Comments | ✅ File annotations | ❌ | ✅ Comment threads |
| Version history | ✅ 30-180 days | ❌ | ✅ Unlimited versions |
| Activity feed | ✅ Recent changes | ✅ Activity logs | ✅ Enhanced feed |
| **Permissions** |
| Role-based access | ✅ Viewer/Editor/Owner | ✅ Admin/Creative/Buyer | ✅ Enhanced roles |
| File-level permissions | ✅ | ❌ | ✅ Granular ACL |
| Team management | ✅ | ❌ | ✅ Teams + sub-users |
| **Upload & Sync** |
| Progress tracking | ✅ Real-time | ❌ | ✅ Live progress |
| Resume uploads | ✅ Chunked upload | ❌ | ✅ Multipart S3 |
| Selective sync | ✅ Desktop app | N/A Web only | ⚠️ Future phase |
| **Search & Discovery** |
| Full-text search | ✅ Content indexing | ✅ Filename/tags | ✅ Enhanced search |
| Smart filters | ✅ By type/date/size | ❌ | ✅ Advanced filters |
| Saved searches | ✅ | ❌ | ✅ Saved filters |
| **Additional Features** |
| File requests | ✅ Upload portal | ❌ | ✅ Request uploads |
| Notifications | ✅ Email/push | ❌ | ✅ In-app + email |
| Trash/recovery | ✅ 30-day restore | ✅ Soft delete | ✅ Enhanced restore |
| Download as ZIP | ✅ Folder download | ❌ | ✅ Bulk download |
| Mobile app | ✅ | ❌ | ⚠️ Future phase |

### 🆕 Additional Features to Implement

#### 1. **File Sharing Links** (Like Dropbox Share)
- Generate public/private URLs for files/folders
- Expiration dates (7 days, 30 days, never)
- Password protection
- Download limit (e.g., max 100 downloads)
- Track link access (who accessed, when)

**Database:**
```sql
CREATE TABLE shared_links (
  id UUID PRIMARY KEY,
  share_token VARCHAR(255) UNIQUE,
  resource_type VARCHAR(50), -- file, folder
  resource_id UUID,
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMP,
  password_hash VARCHAR(255),
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Routes:**
- `POST /api/shares` - Create share link
- `GET /api/shares/:token` - Access shared resource (public route)
- `DELETE /api/shares/:id` - Revoke link

---

#### 2. **File Versioning**
- Keep history of file uploads with same name
- Restore previous versions
- Compare versions (metadata, size, date)
- Auto-version on re-upload

**Database:**
```sql
CREATE TABLE file_versions (
  id UUID PRIMARY KEY,
  media_file_id UUID REFERENCES media_files(id),
  version_number INTEGER,
  s3_url TEXT,
  s3_key VARCHAR(500),
  file_size BIGINT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**UI:**
- File detail view → "Version History" tab
- List of versions with download/restore buttons

---

#### 3. **Comments & Annotations**
- Comment on files (text threads)
- @mentions to notify team members
- Resolve/unresolve comments
- Pin annotations to specific file regions (advanced)

**Database:**
```sql
CREATE TABLE file_comments (
  id UUID PRIMARY KEY,
  media_file_id UUID REFERENCES media_files(id),
  user_id UUID REFERENCES users(id),
  parent_comment_id UUID REFERENCES file_comments(id), -- for threads
  content TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

CREATE TABLE comment_mentions (
  id UUID PRIMARY KEY,
  comment_id UUID REFERENCES file_comments(id),
  mentioned_user_id UUID REFERENCES users(id),
  is_read BOOLEAN DEFAULT FALSE
);
```

---

#### 4. **File Request Portal**
- Buyers request uploads from editors
- Editors receive notification with upload link
- Files auto-tagged with request ID

**Workflow:**
1. Buyer creates request: "Need logo variations for Q1 campaign"
2. System generates unique upload URL
3. Editor receives email with URL
4. Editor uploads files → auto-assigned to buyer
5. Buyer receives notification when files uploaded

**Database:**
```sql
CREATE TABLE upload_requests (
  id UUID PRIMARY KEY,
  request_token VARCHAR(255) UNIQUE,
  requested_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  title VARCHAR(255),
  description TEXT,
  target_folder_id UUID REFERENCES folders(id),
  status VARCHAR(50), -- pending, completed, expired
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

#### 5. **Smart Search**
- Full-text search in filenames, descriptions, tags
- Search by file properties (size, type, date)
- Search in comments
- PostgreSQL full-text search or Elasticsearch integration

**Example Queries:**
- "campaign logo" → Matches filename/description/tags
- "type:image size:>10mb editor:deep" → Advanced filter syntax
- "modified:last-7-days" → Date-based search

---

#### 6. **Bulk Download as ZIP**
- Select multiple files/folders
- Download as single ZIP archive
- Background job for large archives
- Email download link when ready

**Implementation:**
- Backend: Use `archiver` npm package
- Store temporary ZIP in S3 with expiration (24 hours)
- Queue system for large archives (>1GB)

---

#### 7. **Activity Feed & Notifications**
- Real-time activity feed showing recent uploads, shares, comments
- In-app notifications + email digests
- Notification preferences per user

**Events to Track:**
- File uploaded by teammate
- File shared with you
- Comment on your file
- File request assigned to you
- Team member added/removed

**Database:**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- upload, share, comment, mention, request
  title VARCHAR(255),
  message TEXT,
  link VARCHAR(500),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

#### 8. **Trash & Recovery**
- Soft-deleted files go to trash
- 30-day retention before permanent delete
- Restore from trash
- Empty trash (permanent delete)

**Current System:**
- ✅ Already has soft delete (`is_deleted`, `deleted_at`)

**Enhancement:**
- Add trash view in UI
- Auto-purge after 30 days (cron job)
- Restore endpoint

---

#### 9. **Storage Quotas & Usage**
- Track storage per user/team
- Visual usage charts
- Email alerts at 80%, 90%, 100%

**Current System:**
- ✅ Has `upload_limit_monthly` (file count)

**Enhancement:**
- Add storage limit (bytes)
- Dashboard widget showing usage

---

#### 10. **Approval Workflow**
- Editors submit files for approval
- Buyers approve/reject with comments
- Status tracking: draft → pending → approved → published

**Database:**
```sql
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY,
  media_file_id UUID REFERENCES media_files(id),
  submitted_by UUID REFERENCES users(id),
  status VARCHAR(50), -- draft, pending, approved, rejected
  reviewer_id UUID REFERENCES users(id),
  review_comments TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. DATABASE SCHEMA CHANGES

### 🗄️ New Tables

#### 1. `folders` - Folder Hierarchy
```sql
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  parent_folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Organization
  is_auto_created BOOLEAN DEFAULT FALSE, -- for date folders
  folder_type VARCHAR(50) DEFAULT 'user', -- user, system, date

  -- Metadata
  description TEXT,
  color VARCHAR(20), -- UI color tag

  -- Soft delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_folders_parent ON folders(parent_folder_id);
CREATE INDEX idx_folders_owner ON folders(owner_id);
CREATE INDEX idx_folders_not_deleted ON folders(is_deleted) WHERE is_deleted = FALSE;
CREATE INDEX idx_folders_path ON folders USING btree(parent_folder_id, name);
```

#### 2. `file_permissions` - Granular Access Control
```sql
CREATE TABLE file_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Resource (file or folder)
  resource_type VARCHAR(50) NOT NULL, -- file, folder
  resource_id UUID NOT NULL,

  -- Grantee (user or team)
  grantee_type VARCHAR(50) NOT NULL, -- user, team
  grantee_id UUID NOT NULL,

  -- Permission
  permission_type VARCHAR(50) NOT NULL, -- view, download, edit, delete

  -- Audit
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,

  UNIQUE(resource_type, resource_id, grantee_type, grantee_id, permission_type)
);

CREATE INDEX idx_permissions_resource ON file_permissions(resource_type, resource_id);
CREATE INDEX idx_permissions_grantee ON file_permissions(grantee_type, grantee_id);
```

#### 3. `teams` - Team Management
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_teams_owner ON teams(owner_id);
```

#### 4. `team_members` - Team Membership
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- owner, admin, member, viewer
  added_by UUID REFERENCES users(id),
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
```

#### 5. `upload_batches` - Track Multi-File Uploads
```sql
CREATE TABLE upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  folder_id UUID REFERENCES folders(id),
  total_files INTEGER,
  completed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, failed, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_batches_user ON upload_batches(user_id);
CREATE INDEX idx_batches_status ON upload_batches(status);
```

#### 6. `file_operations_log` - Audit Trail
```sql
CREATE TABLE file_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,

  -- Operation details
  source_folder_id UUID REFERENCES folders(id),
  target_folder_id UUID REFERENCES folders(id),
  file_ids JSONB, -- array of affected file IDs

  -- Context
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_operations_user ON file_operations_log(user_id);
CREATE INDEX idx_operations_type ON file_operations_log(operation_type);
CREATE INDEX idx_operations_date ON file_operations_log(created_at DESC);
```

#### 7. `shared_links` - Public/Private File Sharing
```sql
CREATE TABLE shared_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token VARCHAR(255) UNIQUE NOT NULL,

  -- Resource
  resource_type VARCHAR(50) NOT NULL, -- file, folder
  resource_id UUID NOT NULL,

  -- Access control
  created_by UUID REFERENCES users(id),
  password_hash VARCHAR(255),
  expires_at TIMESTAMP,
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,

  -- Settings
  allow_preview BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_shares_token ON shared_links(share_token);
CREATE INDEX idx_shares_resource ON shared_links(resource_type, resource_id);
```

#### 8. `file_versions` - Version History
```sql
CREATE TABLE file_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- File storage
  s3_url TEXT,
  s3_key VARCHAR(500),
  file_size BIGINT,

  -- Metadata snapshot
  metadata_snapshot JSONB,

  -- Audit
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(media_file_id, version_number)
);

CREATE INDEX idx_versions_file ON file_versions(media_file_id);
CREATE INDEX idx_versions_date ON file_versions(created_at DESC);
```

#### 9. `file_comments` - Collaboration Comments
```sql
CREATE TABLE file_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  parent_comment_id UUID REFERENCES file_comments(id),

  content TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_file ON file_comments(media_file_id);
CREATE INDEX idx_comments_user ON file_comments(user_id);
CREATE INDEX idx_comments_parent ON file_comments(parent_comment_id);
```

#### 10. `notifications` - User Notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL, -- upload, share, comment, mention, request
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_date ON notifications(created_at DESC);
```

---

### 🔄 Modified Tables

#### `media_files` - Add Folder Support
```sql
-- Add columns
ALTER TABLE media_files
ADD COLUMN folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
ADD COLUMN upload_batch_id UUID REFERENCES upload_batches(id),
ADD COLUMN assigned_buyer_id UUID REFERENCES users(id),
ADD COLUMN version_number INTEGER DEFAULT 1,
ADD COLUMN parent_file_id UUID REFERENCES media_files(id); -- for versions

-- Add indexes
CREATE INDEX idx_media_folder ON media_files(folder_id);
CREATE INDEX idx_media_batch ON media_files(upload_batch_id);
CREATE INDEX idx_media_buyer ON media_files(assigned_buyer_id);
CREATE INDEX idx_media_parent ON media_files(parent_file_id);
```

#### `users` - Add Team & Storage Settings
```sql
-- Add columns
ALTER TABLE users
ADD COLUMN storage_quota_bytes BIGINT DEFAULT 107374182400, -- 100GB
ADD COLUMN storage_used_bytes BIGINT DEFAULT 0,
ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "in_app": true}';

-- Add index
CREATE INDEX idx_users_storage ON users(storage_used_bytes);
```

---

### 📊 Database Migration Strategy

#### Migration Files (in `/database/migrations/`)

**1. `20240115_create_folders.sql`**
```sql
BEGIN;
CREATE TABLE folders (...);
CREATE INDEXES ...;
COMMIT;
```

**2. `20240115_add_folder_to_media_files.sql`**
```sql
BEGIN;
ALTER TABLE media_files ADD COLUMN folder_id UUID ...;
CREATE INDEX ...;
COMMIT;
```

**3. `20240115_create_teams.sql`**
```sql
BEGIN;
CREATE TABLE teams (...);
CREATE TABLE team_members (...);
CREATE TABLE file_permissions (...);
COMMIT;
```

**Rollback Plan:**
- Each migration has corresponding `_rollback.sql`
- Test migrations on staging database first
- Backup production database before migration

---

## 6. BACKEND IMPLEMENTATION PLAN

### 🛠️ Phase 1: Core Folder System

#### New Routes (`/backend/src/routes/folders.js`)
```javascript
const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// CRUD operations
router.post('/', folderController.createFolder);
router.get('/', folderController.getFolders); // Get folder tree
router.get('/:id', folderController.getFolder);
router.get('/:id/contents', folderController.getFolderContents); // Files + subfolders
router.patch('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder); // Soft delete

// File operations
router.post('/:id/files', folderController.uploadToFolder);
router.post('/files/move', folderController.moveFiles);
router.post('/files/copy', folderController.copyFiles);

// Path operations
router.get('/:id/breadcrumb', folderController.getBreadcrumb);

module.exports = router;
```

#### Folder Controller (`/backend/src/controllers/folderController.js`)
```javascript
const Folder = require('../models/Folder');
const MediaFile = require('../models/MediaFile');
const { logOperation } = require('../services/auditService');

class FolderController {
  async createFolder(req, res, next) {
    try {
      const { name, parent_folder_id, description, color } = req.body;

      // Validate parent exists and user has access
      if (parent_folder_id) {
        const parent = await Folder.findById(parent_folder_id);
        if (!parent) {
          return res.status(404).json({ error: 'Parent folder not found' });
        }
        // Check permission
        if (!await Folder.canAccess(req.user.id, parent_folder_id, 'edit')) {
          return res.status(403).json({ error: 'No access to parent folder' });
        }
      }

      const folder = await Folder.create({
        name,
        parent_folder_id,
        owner_id: req.user.id,
        description,
        color,
        folder_type: 'user'
      });

      // Log operation
      await logOperation({
        user_id: req.user.id,
        operation_type: 'folder_create',
        metadata: { folder_id: folder.id, name },
        ip_address: req.ip
      });

      res.status(201).json({ success: true, data: folder });
    } catch (error) {
      next(error);
    }
  }

  async getFolders(req, res, next) {
    try {
      const { parent_id, include_deleted } = req.query;

      // Get folder tree accessible by user
      const folders = await Folder.getTree(req.user.id, {
        parent_id,
        include_deleted: req.user.role === 'admin' && include_deleted
      });

      res.json({ success: true, data: folders });
    } catch (error) {
      next(error);
    }
  }

  async getFolderContents(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Check access
      if (!await Folder.canAccess(req.user.id, id, 'view')) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get subfolders
      const folders = await Folder.findAll({
        where: { parent_folder_id: id, is_deleted: false }
      });

      // Get files
      const files = await MediaFile.findAll({
        where: { folder_id: id, is_deleted: false },
        limit,
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          folders,
          files,
          pagination: { page, limit, total: files.length }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async moveFiles(req, res, next) {
    try {
      const { file_ids, target_folder_id } = req.body;

      // Validate target folder access
      if (!await Folder.canAccess(req.user.id, target_folder_id, 'edit')) {
        return res.status(403).json({ error: 'No access to target folder' });
      }

      // Move files
      const movedFiles = [];
      for (const file_id of file_ids) {
        const file = await MediaFile.findById(file_id);

        // Check ownership
        if (file.uploaded_by !== req.user.id && req.user.role !== 'admin') {
          continue; // Skip files user doesn't own
        }

        await MediaFile.update(file_id, { folder_id: target_folder_id });
        movedFiles.push(file_id);
      }

      // Log operation
      await logOperation({
        user_id: req.user.id,
        operation_type: 'file_move',
        target_folder_id,
        file_ids: movedFiles,
        ip_address: req.ip
      });

      res.json({
        success: true,
        data: { moved_count: movedFiles.length }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FolderController();
```

#### Folder Model (`/backend/src/models/Folder.js`)
```javascript
const BaseModel = require('./BaseModel');
const { query } = require('../config/database');

class Folder extends BaseModel {
  constructor() {
    super('folders');
  }

  /**
   * Get folder tree for user (with permissions)
   */
  async getTree(userId, options = {}) {
    const { parent_id = null, include_deleted = false } = options;

    const sql = `
      WITH RECURSIVE folder_tree AS (
        -- Base case: root folders
        SELECT f.*, 0 as depth
        FROM folders f
        WHERE f.parent_folder_id ${parent_id ? '= $1' : 'IS NULL'}
          AND f.is_deleted = ${include_deleted}
          AND (
            f.owner_id = $2
            OR EXISTS (
              SELECT 1 FROM file_permissions fp
              WHERE fp.resource_type = 'folder'
                AND fp.resource_id = f.id
                AND fp.grantee_type = 'user'
                AND fp.grantee_id = $2
            )
          )

        UNION ALL

        -- Recursive case: child folders
        SELECT f.*, ft.depth + 1
        FROM folders f
        INNER JOIN folder_tree ft ON f.parent_folder_id = ft.id
        WHERE f.is_deleted = ${include_deleted}
      )
      SELECT * FROM folder_tree
      ORDER BY depth, name;
    `;

    const params = parent_id ? [parent_id, userId] : [userId];
    const result = await query(sql, params);

    return result.rows || result;
  }

  /**
   * Check if user can access folder
   */
  async canAccess(userId, folderId, permissionType = 'view') {
    const sql = `
      SELECT 1
      FROM folders f
      WHERE f.id = $1
        AND (
          -- Owner
          f.owner_id = $2
          -- Has explicit permission
          OR EXISTS (
            SELECT 1 FROM file_permissions fp
            WHERE fp.resource_type = 'folder'
              AND fp.resource_id = f.id
              AND fp.grantee_type = 'user'
              AND fp.grantee_id = $2
              AND fp.permission_type = $3
          )
          -- Member of team with access
          OR EXISTS (
            SELECT 1
            FROM file_permissions fp
            JOIN team_members tm ON fp.grantee_id = tm.team_id
            WHERE fp.resource_type = 'folder'
              AND fp.resource_id = f.id
              AND fp.grantee_type = 'team'
              AND tm.user_id = $2
              AND fp.permission_type = $3
          )
        )
      LIMIT 1;
    `;

    const result = await query(sql, [folderId, userId, permissionType]);
    return (result.rows || result).length > 0;
  }

  /**
   * Get folder breadcrumb path
   */
  async getBreadcrumb(folderId) {
    const sql = `
      WITH RECURSIVE breadcrumb AS (
        SELECT id, name, parent_folder_id, 1 as level
        FROM folders
        WHERE id = $1

        UNION ALL

        SELECT f.id, f.name, f.parent_folder_id, b.level + 1
        FROM folders f
        INNER JOIN breadcrumb b ON f.id = b.parent_folder_id
      )
      SELECT id, name, level
      FROM breadcrumb
      ORDER BY level DESC;
    `;

    const result = await query(sql, [folderId]);
    return result.rows || result;
  }
}

module.exports = new Folder();
```

---

### 🛠️ Phase 2: Batch Upload System

#### Update Media Routes (`/backend/src/routes/media.js`)
```javascript
// Add new route for batch upload
router.post('/upload/batch',
  upload.array('files', 50), // Max 50 files per batch
  metadataMiddleware.processBatch,
  validate(schemas.batchUpload),
  mediaController.uploadBatch
);

// Upload progress endpoint
router.get('/upload/progress/:batch_id', mediaController.getUploadProgress);
```

#### Update Upload Middleware (`/backend/src/middleware/upload.js`)
```javascript
const multer = require('multer');

// Increase file size limit for batch uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB per file
    files: 50 // Max 50 files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

module.exports = { upload };
```

#### Media Controller - Batch Upload
```javascript
async uploadBatch(req, res, next) {
  try {
    const { folder_id, editor_id, assigned_buyer_id, tags, description } = req.body;
    const files = req.files; // Array of uploaded files

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Create upload batch record
    const batch = await UploadBatch.create({
      user_id: req.user.id,
      folder_id,
      total_files: files.length,
      status: 'in_progress'
    });

    // Process uploads asynchronously
    processUploadBatch(batch.id, files, {
      folder_id,
      editor_id,
      assigned_buyer_id,
      tags,
      description,
      uploaded_by: req.user.id
    });

    res.status(202).json({
      success: true,
      message: 'Batch upload started',
      data: { batch_id: batch.id, total_files: files.length }
    });
  } catch (error) {
    next(error);
  }
}

async getUploadProgress(req, res, next) {
  try {
    const { batch_id } = req.params;

    const batch = await UploadBatch.findById(batch_id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Get uploaded files in this batch
    const uploadedFiles = await MediaFile.findAll({
      where: { upload_batch_id: batch_id }
    });

    res.json({
      success: true,
      data: {
        batch_id,
        status: batch.status,
        total: batch.total_files,
        completed: batch.completed_files,
        failed: batch.failed_files,
        files: uploadedFiles
      }
    });
  } catch (error) {
    next(error);
  }
}
```

#### Batch Upload Service (`/backend/src/services/batchUploadService.js`)
```javascript
const s3Service = require('./s3Service');
const MediaFile = require('../models/MediaFile');
const UploadBatch = require('../models/UploadBatch');
const logger = require('../utils/logger');

/**
 * Process batch upload asynchronously
 */
async function processUploadBatch(batchId, files, metadata) {
  const { folder_id, editor_id, assigned_buyer_id, tags, description, uploaded_by } = metadata;

  let completed = 0;
  let failed = 0;

  for (const file of files) {
    try {
      // Upload to S3
      const s3Result = await s3Service.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimetype: file.mimetype,
        editorId: editor_id,
        folderId: folder_id
      });

      // Create database record
      await MediaFile.create({
        filename: s3Result.filename,
        original_filename: file.originalname,
        s3_url: s3Result.url,
        s3_key: s3Result.key,
        thumbnail_url: s3Result.thumbnailUrl,
        file_type: file.mimetype.startsWith('image') ? 'image' : 'video',
        mime_type: file.mimetype,
        file_size: file.size,
        editor_id,
        folder_id,
        assigned_buyer_id,
        uploaded_by,
        upload_batch_id: batchId,
        tags: tags ? tags.split(',') : [],
        description
      });

      completed++;

      // Update batch progress
      await UploadBatch.update(batchId, {
        completed_files: completed,
        failed_files: failed
      });

    } catch (error) {
      logger.error('Batch upload file failed', {
        batch_id: batchId,
        filename: file.originalname,
        error: error.message
      });

      failed++;

      await UploadBatch.update(batchId, {
        failed_files: failed
      });
    }
  }

  // Mark batch as completed
  await UploadBatch.update(batchId, {
    status: failed === files.length ? 'failed' : 'completed',
    completed_at: new Date()
  });

  logger.info('Batch upload completed', {
    batch_id: batchId,
    total: files.length,
    completed,
    failed
  });
}

module.exports = { processUploadBatch };
```

---

### 🛠️ Phase 3: Team Management

#### Team Routes (`/backend/src/routes/teams.js`)
```javascript
const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Team CRUD (buyers and admins only)
router.post('/', requireRole('buyer', 'admin'), teamController.createTeam);
router.get('/', teamController.getMyTeams);
router.get('/:id', teamController.getTeam);
router.patch('/:id', teamController.updateTeam);
router.delete('/:id', teamController.deleteTeam);

// Member management
router.post('/:id/members', teamController.addMember);
router.delete('/:id/members/:user_id', teamController.removeMember);
router.patch('/:id/members/:user_id', teamController.updateMemberRole);

// Permissions
router.post('/:id/permissions', teamController.grantFolderAccess);
router.delete('/:id/permissions/:permission_id', teamController.revokeFolderAccess);

module.exports = router;
```

#### Team Controller
```javascript
class TeamController {
  async createTeam(req, res, next) {
    try {
      const { name, description } = req.body;

      const team = await Team.create({
        name,
        description,
        owner_id: req.user.id
      });

      // Add creator as owner member
      await TeamMember.create({
        team_id: team.id,
        user_id: req.user.id,
        role: 'owner',
        added_by: req.user.id
      });

      res.status(201).json({ success: true, data: team });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req, res, next) {
    try {
      const { id } = req.params;
      const { user_id, email, role = 'member' } = req.body;

      // Check if requester is team owner/admin
      const isOwner = await Team.isOwnerOrAdmin(id, req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Only team owners/admins can add members' });
      }

      // If email provided, invite new user or find existing
      let targetUserId = user_id;
      if (email && !user_id) {
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
          targetUserId = existingUser.id;
        } else {
          // TODO: Send invitation email
          return res.status(400).json({ error: 'User not found. Invitation system coming soon.' });
        }
      }

      // Add member
      const member = await TeamMember.create({
        team_id: id,
        user_id: targetUserId,
        role,
        added_by: req.user.id
      });

      res.status(201).json({ success: true, data: member });
    } catch (error) {
      next(error);
    }
  }

  async grantFolderAccess(req, res, next) {
    try {
      const { id } = req.params;
      const { folder_id, permission_level = 'view' } = req.body;

      // Check if requester is team owner/admin
      const isOwner = await Team.isOwnerOrAdmin(id, req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      // Grant permission
      const permission = await FilePermission.create({
        resource_type: 'folder',
        resource_id: folder_id,
        grantee_type: 'team',
        grantee_id: id,
        permission_type: permission_level,
        granted_by: req.user.id
      });

      res.status(201).json({ success: true, data: permission });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TeamController();
```

---

## 7. FRONTEND IMPLEMENTATION PLAN

### 🎨 Phase 1: Folder UI Components

#### Folder Tree Sidebar (`/frontend/src/components/FolderTree.tsx`)
```typescript
import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderPlus } from 'lucide-react';
import { foldersApi } from '../lib/api';

interface FolderNode {
  id: string;
  name: string;
  parent_folder_id: string | null;
  children?: FolderNode[];
}

export function FolderTree() {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    loadFolders();
  }, []);

  const loadFolders = async () => {
    const response = await foldersApi.getTree();
    setFolders(buildTree(response.data));
  };

  const buildTree = (flatFolders: any[]): FolderNode[] => {
    const map = new Map<string, FolderNode>();
    const roots: FolderNode[] = [];

    // Create nodes
    flatFolders.forEach(folder => {
      map.set(folder.id, { ...folder, children: [] });
    });

    // Build tree
    flatFolders.forEach(folder => {
      const node = map.get(folder.id)!;
      if (folder.parent_folder_id) {
        const parent = map.get(folder.parent_folder_id);
        if (parent) {
          parent.children!.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const toggleExpand = (folderId: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpanded(newExpanded);
  };

  const renderFolder = (folder: FolderNode, depth = 0) => {
    const isExpanded = expanded.has(folder.id);
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent ${
            selectedFolder === folder.id ? 'bg-accent' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedFolder(folder.id)}
        >
          {hasChildren && (
            <button onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}>
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
          {!hasChildren && <div style={{ width: 16 }} />}
          <Folder size={18} className="text-muted-foreground" />
          <span className="text-sm">{folder.name}</span>
        </div>

        {isExpanded && hasChildren && (
          <div>
            {folder.children!.map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-64 border-r bg-background p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Folders</h3>
        <button className="p-1 hover:bg-accent rounded">
          <FolderPlus size={18} />
        </button>
      </div>

      <div className="space-y-1">
        {folders.map(folder => renderFolder(folder))}
      </div>
    </div>
  );
}
```

---

#### Batch Upload Component (`/frontend/src/components/BatchUpload.tsx`)
```typescript
import React, { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { mediaApi } from '../lib/api';

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

export function BatchUpload({ folderId, onComplete }: { folderId?: string; onComplete?: () => void }) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const uploadFiles = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));
    setFiles(prev => [...prev, ...uploadFiles]);
  }, []);

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // @ts-ignore - webkitdirectory is not in types
    const selectedFiles = Array.from(e.target.files || []);
    const uploadFiles = selectedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending' as const
    }));
    setFiles(prev => [...prev, ...uploadFiles]);
  }, []);

  const uploadFiles = async () => {
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i];

      try {
        // Update status to uploading
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading' } : f
        ));

        const formData = new FormData();
        formData.append('file', uploadFile.file);
        if (folderId) formData.append('folder_id', folderId);

        await mediaApi.upload(formData, {
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, progress } : f
            ));
          }
        });

        // Mark as completed
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'completed', progress: 100 } : f
        ));

      } catch (error: any) {
        // Mark as failed
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: 'failed',
            error: error.response?.data?.error || 'Upload failed'
          } : f
        ));
      }
    }

    setIsUploading(false);
    onComplete?.();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="btn btn-primary cursor-pointer">
          <Upload size={18} />
          <span>Select Files</span>
          <input
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*"
          />
        </label>

        <label className="btn btn-secondary cursor-pointer">
          <Upload size={18} />
          <span>Select Folder</span>
          <input
            type="file"
            // @ts-ignore
            webkitdirectory="true"
            directory="true"
            onChange={handleFolderSelect}
            className="hidden"
          />
        </label>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {files.length} file{files.length > 1 ? 's' : ''} selected
            </h4>
            <button
              onClick={uploadFiles}
              disabled={isUploading}
              className="btn btn-primary"
            >
              Upload All
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {files.map((uploadFile, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {uploadFile.status === 'completed' && (
                      <CheckCircle size={16} className="text-green-500" />
                    )}
                    {uploadFile.status === 'failed' && (
                      <AlertCircle size={16} className="text-red-500" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {uploadFile.file.name}
                    </span>
                  </div>

                  {uploadFile.status === 'uploading' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  )}

                  {uploadFile.status === 'failed' && (
                    <p className="text-xs text-red-500">{uploadFile.error}</p>
                  )}
                </div>

                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-accent rounded"
                  disabled={uploadFile.status === 'uploading'}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 8. IMPLEMENTATION PHASES

### 📅 Phase Timeline

#### **Phase 1: Foundation (Week 1-2)** ✅
**Goal:** Database schema & folder system

**Tasks:**
1. Create database migrations for new tables
2. Deploy migrations to staging
3. Test rollback scripts
4. Implement Folder model & controller
5. Create folder routes
6. Unit tests for folder operations

**Deliverables:**
- ✅ All new tables created
- ✅ Folder CRUD API working
- ✅ 100% backward compatibility
- ✅ Migration scripts tested

**Risk Level:** Low (additive changes only)

---

#### **Phase 2: Batch Upload (Week 3-4)** 🔄
**Goal:** Multi-file & folder upload with progress tracking

**Tasks:**
1. Update upload middleware for batch
2. Implement batch upload service
3. Create upload queue UI component
4. Add drag-and-drop interface
5. Real-time progress tracking
6. Error handling & retry logic

**Deliverables:**
- ✅ Upload multiple files simultaneously
- ✅ Upload entire folders
- ✅ Live progress bars
- ✅ Pause/resume capability

**Risk Level:** Medium (S3 multipart upload complexity)

---

#### **Phase 3: Date-Based Organization (Week 5)** 📅
**Goal:** Auto-create date folders on upload

**Tasks:**
1. Add auto-folder creation logic
2. UI toggle for date organization
3. Date folder naming strategy
4. Migrate existing files (optional)

**Deliverables:**
- ✅ Opt-in date folder creation
- ✅ YYYY-MM-DD folder structure
- ✅ Backward compatible

**Risk Level:** Low (simple feature)

---

#### **Phase 4: Buyer Assignment (Week 6)** 🎯
**Goal:** Assign files to specific buyers

**Tasks:**
1. Implement file permissions system
2. Add buyer dropdown to upload modal
3. Update file visibility logic
4. File detail shows assignment
5. Admin override capability

**Deliverables:**
- ✅ Buyer-specific file uploads
- ✅ Permission-based file listing
- ✅ Assignment audit trail

**Risk Level:** Medium (complex permission logic)

---

#### **Phase 5: Folder Operations & Audit (Week 7-8)** 🔐
**Goal:** Move, copy, delete files with full audit trail

**Tasks:**
1. Implement file operations (move/copy)
2. Create audit logging service
3. Drag-and-drop file moving
4. Context menu for file actions
5. Audit log viewer UI

**Deliverables:**
- ✅ Move files between folders
- ✅ Copy files
- ✅ Comprehensive audit trail
- ✅ Admin audit log dashboard

**Risk Level:** Medium (data integrity)

---

#### **Phase 6: Advanced Filtering (Week 9)** 🔍
**Goal:** Rich filtering for buyers

**Tasks:**
1. Build filter UI component
2. Update backend query builder
3. URL state management
4. Saved filters feature
5. Filter performance optimization

**Deliverables:**
- ✅ Date range picker
- ✅ Media type filter
- ✅ Editor filter
- ✅ Saved filter presets

**Risk Level:** Low (UI-focused)

---

#### **Phase 7: Team Management (Week 10-12)** 👥
**Goal:** Sub-users and library sharing

**Tasks:**
1. Create team CRUD endpoints
2. Member invitation system
3. Team permissions management
4. Team file browser UI
5. Email invitations

**Deliverables:**
- ✅ Create teams
- ✅ Add/remove members
- ✅ Grant folder access to teams
- ✅ Team-based file visibility

**Risk Level:** High (complex permission hierarchy)

---

#### **Phase 8: Additional Features (Week 13-16)** 🚀
**Goal:** Dropbox-like enhancements

**Tasks:**
1. File sharing links
2. Version history
3. Comments & collaboration
4. File request portal
5. Smart search
6. Bulk download (ZIP)
7. Activity feed
8. Notifications

**Deliverables:**
- ✅ Public share links
- ✅ Version control
- ✅ Comment threads
- ✅ Upload requests
- ✅ Enhanced search
- ✅ Download folders as ZIP
- ✅ In-app notifications

**Risk Level:** Medium (many moving parts)

---

#### **Phase 9: Polish & Testing (Week 17-18)** ✨
**Goal:** Production-ready quality

**Tasks:**
1. End-to-end testing
2. Performance optimization
3. Security audit
4. User acceptance testing
5. Documentation
6. Deployment planning

**Deliverables:**
- ✅ Full test coverage
- ✅ Performance benchmarks
- ✅ Security review passed
- ✅ User guide & API docs

**Risk Level:** Low (QA phase)

---

## 9. RISK MITIGATION STRATEGY

### 🛡️ Potential Risks & Mitigation

#### **Risk 1: Breaking Existing Functionality**
**Probability:** Medium | **Impact:** Critical

**Mitigation:**
- ✅ All new features use NEW tables (no alters to existing tables except adding nullable FK columns)
- ✅ Comprehensive test suite covering existing endpoints
- ✅ Feature flags for gradual rollout
- ✅ Database migration rollback scripts
- ✅ Staging environment testing before production
- ✅ Backward compatibility layer for legacy S3 paths

**Rollback Plan:**
```sql
-- If needed, rollback migrations
BEGIN;
ALTER TABLE media_files DROP COLUMN folder_id;
DROP TABLE folders CASCADE;
-- ... other rollbacks
COMMIT;
```

---

#### **Risk 2: S3 Storage Reorganization Complexity**
**Probability:** Medium | **Impact:** High

**Mitigation:**
- ✅ Keep current S3 structure for existing files (no migration)
- ✅ New uploads use new folder-based structure
- ✅ Hybrid S3Service supports both old and new paths
- ✅ Database tracks current location (s3_key)
- ✅ CloudFront caching updated incrementally

**Strategy:**
```javascript
function getS3Path(file) {
  if (file.folder_id) {
    // New structure
    return `{editor}/{folder-path}/{media-type}/{unique-id}-{filename}`;
  } else {
    // Legacy structure (backward compatible)
    return `{editor}/{media-type}/{unique-id}-{filename}`;
  }
}
```

---

#### **Risk 3: Permission System Performance**
**Probability:** Low | **Impact:** Medium

**Mitigation:**
- ✅ Aggressive database indexing on permission tables
- ✅ Redis caching for permission checks
- ✅ Denormalize permissions for hot paths
- ✅ Batch permission checks (avoid N+1 queries)
- ✅ PostgreSQL materialized views for complex queries

**Optimized Query:**
```sql
-- Cache user permissions in Redis
-- Key: user:{user_id}:permissions
-- Value: JSON array of accessible folder_ids
-- TTL: 5 minutes
```

---

#### **Risk 4: Batch Upload Memory Issues**
**Probability:** Medium | **Impact:** Medium

**Mitigation:**
- ✅ Stream uploads to S3 (don't buffer entire file in memory)
- ✅ Limit concurrent uploads (max 10 at once)
- ✅ Use S3 multipart upload for files >50MB
- ✅ Queue system for large batches (process in chunks)
- ✅ Monitor server memory usage

**Implementation:**
```javascript
// Use streams instead of buffers
const uploadStream = ({ Bucket, Key, Body }) => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket, Key, Body: pass }).promise(),
  };
};
```

---

#### **Risk 5: Team Permission Hierarchy Bugs**
**Probability:** Medium | **Impact:** High

**Mitigation:**
- ✅ Extensive unit tests for permission logic
- ✅ Integration tests for team workflows
- ✅ Role-based test scenarios
- ✅ Permission audit logs for debugging
- ✅ Admin override capability

**Test Coverage:**
- User in team with view permission → Can see files ✅
- User removed from team → Loses access ✅
- Team permission revoked → All members lose access ✅
- Nested folder permissions → Inherits from parent ✅

---

#### **Risk 6: Database Migration Failures**
**Probability:** Low | **Impact:** Critical

**Mitigation:**
- ✅ Test migrations on local copy of production data
- ✅ Dry-run on staging environment
- ✅ Backup database before migration
- ✅ Incremental migrations (not one big bang)
- ✅ Monitoring for migration errors
- ✅ Rollback scripts ready

**Migration Checklist:**
1. Backup production database
2. Run migration on staging
3. Verify data integrity
4. Test application on staging
5. Schedule maintenance window
6. Run migration on production
7. Verify application functionality
8. Monitor error logs

---

## 10. TESTING STRATEGY

### 🧪 Test Coverage Plan

#### **Unit Tests**
**Target:** 80% code coverage

**Backend:**
- Models: CRUD operations, permission checks, query builders
- Controllers: Request validation, error handling, response formats
- Services: Business logic, S3 operations, audit logging

**Frontend:**
- Components: Render tests, user interactions, state management
- API client: Request formatting, error handling
- Utilities: Date formatting, file size formatting, validation

**Tools:** Jest, React Testing Library

---

#### **Integration Tests**
**Target:** Core user flows

**Scenarios:**
1. Upload file → Creates DB record + S3 object ✅
2. Create folder → Nested folder structure ✅
3. Move file → Updates DB + audit log ✅
4. Grant permission → User gains access ✅
5. Batch upload → All files uploaded or failed with errors ✅
6. Team workflow → Add member → Share folder → Member can access ✅

**Tools:** Supertest (API), Playwright (E2E)

---

#### **Performance Tests**
**Target:** Handle 1000 concurrent users

**Metrics:**
- Upload speed: >10MB/s per user
- API response time: <200ms (p95)
- Database queries: <50ms (p95)
- Memory usage: <2GB per 100 concurrent uploads

**Tools:** Artillery, k6

**Load Test Scenarios:**
1. 100 users uploading simultaneously
2. 1000 folder tree queries/second
3. 500 permission checks/second

---

#### **Security Tests**
**Target:** No critical vulnerabilities

**Checks:**
- ✅ JWT token validation
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (input sanitization)
- ✅ CSRF protection
- ✅ File upload validation (type, size, magic bytes)
- ✅ Permission bypass attempts
- ✅ Rate limiting on sensitive endpoints

**Tools:** OWASP ZAP, npm audit, Snyk

---

#### **User Acceptance Testing (UAT)**
**Target:** Real user feedback

**Test Groups:**
1. **Editors (Creatives):** Test upload workflows, folder organization
2. **Buyers:** Test filtering, team management, file browsing
3. **Admins:** Test audit logs, permission management

**Feedback Collection:**
- User surveys
- Session recordings (Hotjar, FullStory)
- Bug reports
- Feature requests

---

## 11. TIMELINE & RESOURCES

### 📆 Estimated Timeline: 18 Weeks (~4.5 Months)

| Phase | Duration | Dependencies | Team |
|-------|----------|-------------|------|
| Phase 1: Foundation | 2 weeks | None | Backend Dev |
| Phase 2: Batch Upload | 2 weeks | Phase 1 | Backend + Frontend Dev |
| Phase 3: Date Organization | 1 week | Phase 2 | Backend + Frontend Dev |
| Phase 4: Buyer Assignment | 1 week | Phase 1 | Backend + Frontend Dev |
| Phase 5: Folder Operations | 2 weeks | Phase 1 | Backend + Frontend Dev |
| Phase 6: Advanced Filtering | 1 week | Phase 1 | Frontend Dev |
| Phase 7: Team Management | 3 weeks | Phase 4, 5 | Backend + Frontend Dev |
| Phase 8: Additional Features | 4 weeks | Phase 7 | Full Team |
| Phase 9: Polish & Testing | 2 weeks | All phases | QA + All Devs |

**Total:** 18 weeks

---

### 👥 Team Requirements

**Backend Developer (1 FTE)**
- Node.js/Express.js expert
- PostgreSQL database design
- AWS S3 integration
- API design & security

**Frontend Developer (1 FTE)**
- React + TypeScript expert
- UI/UX implementation
- State management (Context/Redux)
- Component library design

**Full-Stack Developer (0.5 FTE)**
- Support both backend & frontend
- Code reviews
- Integration testing

**QA Engineer (0.5 FTE)**
- Test plan creation
- Automated testing
- User acceptance testing
- Bug tracking

**DevOps Engineer (0.25 FTE)**
- Database migration management
- Deployment automation
- Monitoring & alerts
- Performance optimization

**Total Effort:** ~3.25 FTEs over 18 weeks = ~60 person-weeks

---

### 💰 Cost Estimate (Rough)

**Development:**
- Backend Dev: 18 weeks × $2000/week = $36,000
- Frontend Dev: 18 weeks × $2000/week = $36,000
- Full-Stack: 9 weeks × $2200/week = $19,800
- QA: 9 weeks × $1500/week = $13,500
- DevOps: 4.5 weeks × $2200/week = $9,900

**Infrastructure:**
- AWS S3 storage increase: ~$200/month
- CloudFront bandwidth: ~$300/month
- Redis caching: ~$100/month
- Database scaling: ~$200/month

**Total Development:** ~$115,200
**Total Infrastructure (annual):** ~$9,600

**Grand Total:** ~$124,800 (one-time + first year)

---

## 12. SUCCESS METRICS

### 📊 KPIs to Track

**User Adoption:**
- % of editors using folder organization
- % of uploads using batch upload
- % of buyers using teams feature
- Daily active users (DAU)

**Performance:**
- Average upload time per file
- API response times (p50, p95, p99)
- Database query performance
- Error rate (<1%)

**Business Impact:**
- Time saved on file organization (survey)
- User satisfaction score (NPS)
- Reduction in support tickets
- Feature usage analytics

---

## 13. CONCLUSION & NEXT STEPS

### ✅ Plan Summary

This implementation plan provides a **comprehensive, phased approach** to transform Creative Library into a Dropbox-like collaborative asset management system while maintaining **100% backward compatibility** with existing functionality.

**Key Strengths:**
- ✅ Zero breaking changes (additive architecture)
- ✅ Incremental rollout (phases can be deployed independently)
- ✅ Comprehensive risk mitigation
- ✅ Detailed testing strategy
- ✅ Realistic timeline & budget

**Immediate Next Steps:**
1. **Review & Approve** this plan with stakeholders
2. **Prioritize phases** based on business needs
3. **Set up staging environment** for safe testing
4. **Kick off Phase 1** (database schema design)
5. **Recruit team** (if not already in place)

---

### 🚀 Ready to Proceed?

If you approve this plan, I can immediately start implementing:

**Week 1 Tasks:**
1. Create database migration files
2. Implement Folder model & basic CRUD
3. Set up folder routes
4. Write unit tests
5. Deploy to local dev environment for review

**Shall I proceed with Phase 1 implementation?**

Let me know if you want any changes to the plan or if you'd like me to start coding! 🎯
