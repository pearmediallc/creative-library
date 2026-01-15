# S3 Structure - Final Version 2.0

## Date: January 15, 2026

**Updates from V1:**
- ✅ Added granular date structure: YYYY/MM/DD (not just YYYY/MM)
- ✅ Added deleted files tracking with who deleted and when
- ✅ Full audit trail for deletions

---

## 📁 COMPLETE S3 STRUCTURE

```
creative-library-media-pearmedia/
│
├── media-library/          # Active media files
│   └── {uploader-name}/
│       └── {YYYY}/
│           └── {MM}/
│               └── {DD}/              # ✅ NEW: Day-level granularity
│                   └── {media-type}/
│                       └── {timestamp}-{random}-{filename}.ext
│
├── file-requests/          # File request uploads
│   └── {request-id}/
│       ├── _metadata.json
│       └── uploads/
│           └── {uploader-name}/
│               └── {YYYY}/
│                   └── {MM}/
│                       └── {DD}/      # ✅ NEW: Day-level granularity
│                           └── {media-type}/
│                               └── {timestamp}-{random}-{filename}.ext
│
├── deleted/                # ✅ NEW: Deleted files (soft delete with audit)
│   └── {YYYY}/
│       └── {MM}/
│           └── {DD}/
│               └── {deleted-by-name}/
│                   └── {original-path}/
│                       ├── {filename}.ext
│                       └── {filename}.deletion-metadata.json
│
├── thumbnails/             # Auto-generated thumbnails
│   └── {YYYY}/
│       └── {MM}/
│           └── {DD}/              # ✅ NEW: Day-level granularity
│               └── {file-hash}/
│                   └── thumb_{size}_{filename}.jpg
│
└── _system/                # ✅ NEW: System files
    ├── audit-logs/         # Audit trail
    └── metadata-backups/   # Request metadata backups
```

---

## 🎨 DETAILED EXAMPLES

### Example 1: Media Library Upload with Date Granularity

**Use Case:** PARMEET uploads video on January 15, 2026 at 2:30 PM

**S3 Path:**
```
media-library/PARMEET/2026/01/15/videos/1737815400000-abc123-campaign_final.mp4
```

**Breakdown:**
- `media-library/` - General media section
- `PARMEET/` - Uploader name
- `2026/` - Year
- `01/` - Month (January)
- `15/` - Day
- `videos/` - Media type
- `1737815400000-abc123-campaign_final.mp4` - File

**Thumbnail:**
```
thumbnails/2026/01/15/abc123xyz/thumb_1920x1080_campaign_final.jpg
```

**Benefits:**
- ✅ Easy to find all files uploaded on specific date
- ✅ Better S3 lifecycle policies (archive files older than specific date)
- ✅ Clearer organization for large file volumes

---

### Example 2: File Request Upload with Date Granularity

**Use Case:** PARMEET uploads to request on January 15, 2026

**S3 Path:**
```
file-requests/2d9674e6-5d93-4e5c-9f33-6c7274c083d1/uploads/PARMEET/2026/01/15/videos/1737815400000-def456-final_edit.mp4
```

**Breakdown:**
- `file-requests/` - Request section
- `2d9674e6-5d93-4e5c-9f33-6c7274c083d1/` - Request ID
- `uploads/` - All uploads folder
- `PARMEET/` - Uploader name
- `2026/01/15/` - Full date path
- `videos/` - Media type
- `1737815400000-def456-final_edit.mp4` - File

---

### Example 3: Deleted File with Complete Audit Trail

**Use Case:** Admin user "John Smith" deletes PARMEET's video on January 16, 2026

**Original Path:**
```
media-library/PARMEET/2026/01/15/videos/1737815400000-abc123-campaign_final.mp4
```

**Moved to Deleted Folder:**
```
deleted/2026/01/16/John-Smith/media-library/PARMEET/2026/01/15/videos/1737815400000-abc123-campaign_final.mp4
```

**Deletion Metadata File:**
```
deleted/2026/01/16/John-Smith/media-library/PARMEET/2026/01/15/videos/1737815400000-abc123-campaign_final.deletion-metadata.json
```

**Metadata Content:**
```json
{
  "original_file": {
    "s3_key": "media-library/PARMEET/2026/01/15/videos/1737815400000-abc123-campaign_final.mp4",
    "filename": "campaign_final.mp4",
    "file_type": "video",
    "file_size": 156789012,
    "uploaded_by_id": "user-456",
    "uploaded_by_name": "PARMEET",
    "uploaded_at": "2026-01-15T14:30:00Z",
    "upload_context": "media_library"
  },
  "deletion_info": {
    "deleted_by_id": "user-admin-123",
    "deleted_by_name": "John Smith",
    "deleted_by_role": "admin",
    "deleted_at": "2026-01-16T10:45:00Z",
    "deletion_reason": "Duplicate file, wrong version uploaded",
    "original_database_id": "file-uuid-789",
    "can_be_restored": true,
    "auto_delete_after": "2026-04-16T10:45:00Z"  // 90 days retention
  },
  "file_metadata": {
    "tags": ["super-bowl", "final", "video"],
    "description": "Final edited version for Super Bowl campaign",
    "folder_id": "folder-uuid-123",
    "view_count": 45,
    "download_count": 12
  }
}
```

**Benefits:**
- ✅ Complete audit trail (who deleted, when, why)
- ✅ Can restore deleted files easily
- ✅ Preserves original folder structure
- ✅ Automatic cleanup after retention period
- ✅ Track deletion patterns (who deletes most files)

---

### Example 4: Multiple Files Deleted on Same Day

**Use Case:** Admin deletes 3 files on January 16, 2026

**S3 Structure:**
```
deleted/2026/01/16/John-Smith/
├── media-library/
│   └── PARMEET/
│       └── 2026/01/15/videos/
│           ├── file1.mp4
│           ├── file1.deletion-metadata.json
│           ├── file2.mp4
│           └── file2.deletion-metadata.json
└── file-requests/
    └── abc-request-id/
        └── uploads/Sarah-Wilson/2026/01/14/images/
            ├── draft.jpg
            └── draft.deletion-metadata.json
```

**Benefits:**
- ✅ Easy to see all deletions by specific person on specific date
- ✅ Audit compliance (track who deletes what)
- ✅ Restoration is simple (move back to original path)

---

## 🗑️ DELETION WORKFLOW

### Soft Delete Process

```javascript
/**
 * Soft delete a media file
 * - Move to deleted folder
 * - Create metadata file
 * - Mark as deleted in database (don't remove record)
 */
async function softDeleteFile(fileId, deletedByUserId, deletionReason) {
  // 1. Get file info from database
  const file = await MediaFile.findById(fileId);

  // 2. Get user who is deleting
  const deletedByUser = await User.findById(deletedByUserId);

  // 3. Generate deleted folder path
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const deletedByName = deletedByUser.name.replace(/\s+/g, '-');

  // Preserve original path structure
  const deletedPath = `deleted/${year}/${month}/${day}/${deletedByName}/${file.s3_key}`;
  const metadataPath = `${deletedPath}.deletion-metadata.json`;

  // 4. Create deletion metadata
  const metadata = {
    original_file: {
      s3_key: file.s3_key,
      filename: file.original_filename,
      file_type: file.file_type,
      file_size: file.file_size,
      uploaded_by_id: file.uploaded_by_id,
      uploaded_by_name: file.uploaded_by_name,
      uploaded_at: file.created_at,
      upload_context: file.upload_context,
      file_request_id: file.file_request_id
    },
    deletion_info: {
      deleted_by_id: deletedByUserId,
      deleted_by_name: deletedByUser.name,
      deleted_by_role: deletedByUser.role,
      deleted_at: now.toISOString(),
      deletion_reason: deletionReason || 'No reason provided',
      original_database_id: fileId,
      can_be_restored: true,
      auto_delete_after: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    },
    file_metadata: {
      tags: file.tags,
      description: file.description,
      folder_id: file.folder_id,
      view_count: file.view_count || 0,
      download_count: file.download_count || 0
    }
  };

  // 5. Copy file to deleted folder
  await s3Client.send(new CopyObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    CopySource: `${process.env.AWS_S3_BUCKET}/${file.s3_key}`,
    Key: deletedPath
  }));

  // 6. Upload metadata file
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: metadataPath,
    Body: JSON.stringify(metadata, null, 2),
    ContentType: 'application/json'
  }));

  // 7. Delete original file from S3
  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: file.s3_key
  }));

  // 8. Update database (soft delete)
  await MediaFile.update(fileId, {
    is_deleted: true,
    deleted_at: now,
    deleted_by_id: deletedByUserId,
    deleted_s3_path: deletedPath,
    deletion_reason: deletionReason
  });

  // 9. Log deletion activity
  await logActivity({
    actionType: 'file_deleted',
    resourceType: 'media_file',
    resourceId: fileId,
    userId: deletedByUserId,
    details: {
      filename: file.original_filename,
      reason: deletionReason,
      deleted_path: deletedPath
    }
  });

  return {
    success: true,
    deletedPath,
    metadataPath
  };
}
```

---

### Restore Deleted File

```javascript
/**
 * Restore a deleted file back to original location
 */
async function restoreDeletedFile(fileId, restoredByUserId) {
  const file = await MediaFile.findById(fileId);

  if (!file.is_deleted) {
    throw new Error('File is not deleted');
  }

  // 1. Copy file back from deleted folder to original location
  await s3Client.send(new CopyObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    CopySource: `${process.env.AWS_S3_BUCKET}/${file.deleted_s3_path}`,
    Key: file.s3_key  // Original path
  }));

  // 2. Delete from deleted folder
  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: file.deleted_s3_path
  }));

  // Also delete metadata file
  await s3Client.send(new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: `${file.deleted_s3_path}.deletion-metadata.json`
  }));

  // 3. Update database
  await MediaFile.update(fileId, {
    is_deleted: false,
    deleted_at: null,
    deleted_by_id: null,
    deleted_s3_path: null,
    deletion_reason: null,
    restored_at: new Date(),
    restored_by_id: restoredByUserId
  });

  // 4. Log restoration activity
  await logActivity({
    actionType: 'file_restored',
    resourceType: 'media_file',
    resourceId: fileId,
    userId: restoredByUserId,
    details: {
      filename: file.original_filename,
      original_deleted_by: file.deleted_by_id
    }
  });

  return { success: true };
}
```

---

## 🔧 PATH GENERATION FUNCTIONS (UPDATED)

```javascript
/**
 * Generate media library path with full date granularity
 */
function generateMediaLibraryPath(uploaderName, mediaType, filename) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');  // ✅ NEW
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(5).toString('hex');

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return `media-library/${uploaderName}/${year}/${month}/${day}/${mediaType}/${timestamp}-${randomId}-${sanitizedFilename}`;

  // Example output:
  // media-library/PARMEET/2026/01/15/videos/1737815400000-abc123-campaign.mp4
}

/**
 * Generate file request path with full date granularity
 */
function generateFileRequestPath(requestId, uploaderName, mediaType, filename) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');  // ✅ NEW
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(5).toString('hex');

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return `file-requests/${requestId}/uploads/${uploaderName}/${year}/${month}/${day}/${mediaType}/${timestamp}-${randomId}-${sanitizedFilename}`;

  // Example output:
  // file-requests/abc-123/uploads/PARMEET/2026/01/15/videos/1737815400000-def456-final.mp4
}

/**
 * Generate deleted file path
 */
function generateDeletedPath(originalS3Key, deletedByName) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const sanitizedDeleterName = deletedByName.replace(/\s+/g, '-');

  return `deleted/${year}/${month}/${day}/${sanitizedDeleterName}/${originalS3Key}`;

  // Example output:
  // deleted/2026/01/16/John-Smith/media-library/PARMEET/2026/01/15/videos/file.mp4
}

/**
 * Generate thumbnail path with full date granularity
 */
function generateThumbnailPath(originalS3Key, size = '1920x1080') {
  const hash = crypto.createHash('md5').update(originalS3Key).digest('hex').substring(0, 9);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');  // ✅ NEW
  const filename = path.basename(originalS3Key);

  return `thumbnails/${year}/${month}/${day}/${hash}/thumb_${size}_${filename}.jpg`;

  // Example output:
  // thumbnails/2026/01/15/abc123xyz/thumb_1920x1080_campaign.jpg
}
```

---

## 📊 DATABASE SCHEMA UPDATES

```sql
-- Add deletion tracking columns to media_files table
ALTER TABLE media_files
ADD COLUMN deleted_s3_path TEXT,              -- Path in deleted folder
ADD COLUMN deletion_reason TEXT,              -- Why it was deleted
ADD COLUMN restored_at TIMESTAMP,             -- When it was restored (if applicable)
ADD COLUMN restored_by_id UUID REFERENCES users(id);  -- Who restored it

-- Create index for deleted files queries
CREATE INDEX idx_media_files_deleted ON media_files(is_deleted, deleted_at);
CREATE INDEX idx_media_files_deleted_by ON media_files(deleted_by_id) WHERE is_deleted = true;

-- Create deletion audit log table (separate from main activity log for compliance)
CREATE TABLE file_deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_file_id UUID REFERENCES media_files(id),
  original_filename VARCHAR(255) NOT NULL,
  original_s3_key TEXT NOT NULL,
  deleted_s3_path TEXT NOT NULL,
  deleted_by_id UUID REFERENCES users(id),
  deleted_by_name VARCHAR(255) NOT NULL,
  deleted_by_role VARCHAR(50) NOT NULL,
  deleted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  deletion_reason TEXT,
  file_size BIGINT,
  upload_context VARCHAR(50),
  uploaded_by_name VARCHAR(255),
  restored_at TIMESTAMP,
  restored_by_id UUID REFERENCES users(id),
  permanently_deleted_at TIMESTAMP,  -- After retention period
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deletion_audit_deleted_by ON file_deletion_audit(deleted_by_id);
CREATE INDEX idx_deletion_audit_deleted_at ON file_deletion_audit(deleted_at);
CREATE INDEX idx_deletion_audit_media_file ON file_deletion_audit(media_file_id);
```

---

## 📈 BENEFITS OF NEW STRUCTURE

### Date Granularity (YYYY/MM/DD)

**Before (YYYY/MM):**
```
media-library/PARMEET/2026/01/videos/
  ├── file1.mp4  (uploaded Jan 1)
  ├── file2.mp4  (uploaded Jan 5)
  ├── file3.mp4  (uploaded Jan 10)
  └── file4.mp4  (uploaded Jan 31)
```
❌ All January files mixed together
❌ Can't easily find files from specific date
❌ Hard to apply date-specific policies

**After (YYYY/MM/DD):**
```
media-library/PARMEET/2026/01/
  ├── 01/videos/file1.mp4
  ├── 05/videos/file2.mp4
  ├── 10/videos/file3.mp4
  └── 31/videos/file4.mp4
```
✅ Clear daily organization
✅ Easy to find files from specific date
✅ Better lifecycle policies (archive files older than specific date)
✅ Easier to troubleshoot issues by date

---

### Deletion Tracking

**Benefits:**
- ✅ **Audit compliance** - Track who deletes what and when
- ✅ **Easy restoration** - Move file back to original location
- ✅ **Retention policies** - Auto-delete after 90 days
- ✅ **Pattern analysis** - Identify users who delete frequently
- ✅ **Accidental deletion protection** - Quick recovery
- ✅ **Legal compliance** - Maintain deletion audit trail

**Use Cases:**
1. User accidentally deletes important file → Quick restore
2. Compliance audit asks "who deleted file X?" → Check deletion metadata
3. Storage optimization → Permanently delete files older than 90 days from deleted folder
4. Manager wants to see all deletions by team → Query deletion audit log

---

## ✅ IMPLEMENTATION CHECKLIST

### Phase 1: Update Path Generators
- [ ] Update `generateMediaLibraryPath()` to include day
- [ ] Update `generateFileRequestPath()` to include day
- [ ] Update `generateThumbnailPath()` to include day
- [ ] Add `generateDeletedPath()` function
- [ ] Add `softDeleteFile()` function
- [ ] Add `restoreDeletedFile()` function

### Phase 2: Database Changes
- [ ] Add deletion tracking columns
- [ ] Create `file_deletion_audit` table
- [ ] Add indexes
- [ ] Update `MediaFile.delete()` to use soft delete

### Phase 3: Controller Updates
- [ ] Update upload controllers to use new paths
- [ ] Update delete controller to use soft delete
- [ ] Add restore endpoint
- [ ] Add deletion audit log endpoint

### Phase 4: Testing
- [ ] Upload file → verify YYYY/MM/DD structure
- [ ] Delete file → verify moved to deleted folder
- [ ] Check metadata file created
- [ ] Restore file → verify back in original location
- [ ] Check deletion audit log

---

## 🚀 READY TO IMPLEMENT?

**Approval needed for:**
1. ✅ Use YYYY/MM/DD date structure (instead of YYYY/MM)
2. ✅ Implement soft delete with deleted folder
3. ✅ Create deletion audit trail
4. ✅ 90-day retention for deleted files

**If approved, I'll start implementing in this order:**
1. Update s3Service.js path generators
2. Add database migration for deletion columns
3. Update mediaController.js for soft delete
4. Add restore functionality
5. Test full workflow

Let me know and I'll begin! 🚀
