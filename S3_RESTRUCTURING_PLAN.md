# S3 Restructuring Implementation Plan

## Date: January 15, 2026

---

## 🎯 OBJECTIVES

1. **Organize by context** - Clear separation between general uploads and file requests
2. **Date-based hierarchy** - Easy to find files by date
3. **Clear ownership** - Know who uploaded and who requested
4. **Scalable structure** - Support growing file volumes
5. **Easy lifecycle management** - Automated archival/deletion policies

---

## 📁 PROPOSED S3 STRUCTURE

### Structure Overview

```
creative-library-media-pearmedia/
├── media-library/          # General media uploads (not request-specific)
│   └── {editor-name}/
│       └── {YYYY}/
│           └── {MM}/
│               └── {media-type}/
│                   └── {timestamp}-{random}-{filename}.ext
│
├── file-requests/          # File request uploads
│   └── {request-id}/
│       ├── _metadata.json  # Request info (buyer, deadline, etc.)
│       └── uploads/
│           └── {editor-name}/
│               └── {YYYY-MM-DD}/
│                   └── {media-type}/
│                       └── {timestamp}-{random}-{filename}.ext
│
├── public-uploads/         # Public/anonymous uploads (no auth required)
│   └── {YYYY-MM-DD}/
│       └── {media-type}/
│           └── {timestamp}-{random}-{filename}.ext
│
└── thumbnails/             # Auto-generated thumbnails (separate for easy CDN caching)
    └── {YYYY}/
        └── {MM}/
            └── {original-s3-key-hash}/
                └── thumb_{size}_{filename}.jpg
```

---

## 🎨 DETAILED STRUCTURE SCENARIOS

### Scenario 1: General Media Library Upload

**Use Case:** Editor PARMEET uploads a creative video for general use (not tied to specific request)

**S3 Path:**
```
media-library/PARMEET/2026/01/videos/1737000000000-abc123xyz-creative_ad_campaign.mp4
```

**Breakdown:**
- `media-library/` - General media section
- `PARMEET/` - Editor who uploaded
- `2026/01/` - Year and month
- `videos/` - Media type (videos, images, documents)
- `1737000000000-abc123xyz-creative_ad_campaign.mp4` - Timestamped unique file

**Thumbnail Path:**
```
thumbnails/2026/01/abc123xyz/thumb_1920x1080_creative_ad_campaign.jpg
```

---

### Scenario 2: File Request Upload

**Use Case:** Buyer "John Smith" created file request "Super Bowl Ad Campaign" (request ID: `2d9674e6-...`). Editor PARMEET uploads video to fulfill this request.

**S3 Path:**
```
file-requests/2d9674e6-5d93-4e5c-9f33-6c7274c083d1/uploads/PARMEET/2026-01-15/videos/1737000000000-def456-superbowl_final.mp4
```

**Metadata File:**
```
file-requests/2d9674e6-5d93-4e5c-9f33-6c7274c083d1/_metadata.json
```

**Metadata Content:**
```json
{
  "request_id": "2d9674e6-5d93-4e5c-9f33-6c7274c083d1",
  "request_title": "Super Bowl Ad Campaign",
  "buyer_id": "user-123",
  "buyer_name": "John Smith",
  "assigned_editor_id": "user-456",
  "assigned_editor_name": "PARMEET",
  "created_at": "2026-01-10T10:00:00Z",
  "deadline": "2026-01-20T23:59:59Z",
  "status": "in_progress",
  "request_type": "video_edit"
}
```

**Breakdown:**
- `file-requests/` - Request-specific section
- `2d9674e6-5d93-4e5c-9f33-6c7274c083d1/` - Request ID (unique identifier)
- `uploads/` - All uploads for this request
- `PARMEET/` - Editor who uploaded (allows multiple editors per request)
- `2026-01-15/` - Upload date (precise to day)
- `videos/` - Media type
- `1737000000000-def456-superbowl_final.mp4` - File

**Benefits:**
- ✅ Easy to find all files for a specific request
- ✅ See who uploaded what and when
- ✅ Multiple editors can work on same request (separate folders)
- ✅ Metadata file provides request context without DB query

---

### Scenario 3: Public Anonymous Upload

**Use Case:** Public file request link allows anonymous upload (e.g., client sending raw footage)

**S3 Path:**
```
public-uploads/2026-01-15/videos/1737000000000-pub789-client_raw_footage.mp4
```

**Breakdown:**
- `public-uploads/` - Anonymous/public uploads
- `2026-01-15/` - Upload date
- `videos/` - Media type
- `pub789` prefix identifies public upload

**Use Cases:**
- Client sending files via public link
- File request responses from external users
- Quick share links for file collection

---

### Scenario 4: Multiple Editors on Same Request

**Use Case:** Request requires collaboration between 3 editors

**S3 Paths:**
```
file-requests/abc-request-id/uploads/PARMEET/2026-01-15/videos/video_part1.mp4
file-requests/abc-request-id/uploads/SARAH/2026-01-15/videos/video_part2.mp4
file-requests/abc-request-id/uploads/MIKE/2026-01-16/videos/video_final.mp4
```

**Benefits:**
- ✅ Clear attribution (who did what)
- ✅ Chronological tracking (who uploaded when)
- ✅ Easy to aggregate all request files

---

### Scenario 5: Buyer-Specific Organization

**Use Case:** Buyer wants to see all files across all their requests

**Query Pattern:**
```sql
-- Database query gets all request IDs for buyer
SELECT request_id FROM file_requests WHERE buyer_id = 'buyer-123';

-- Then fetch S3 files for each request
file-requests/{request-id-1}/uploads/**/*
file-requests/{request-id-2}/uploads/**/*
```

**Alternative S3 Structure (if buyer-first organization preferred):**
```
file-requests/
  └── by-buyer/
      └── {buyer-name}/
          └── {request-id}/
              └── {editor-name}/
                  └── {YYYY-MM-DD}/
                      └── {media-type}/
```

**Trade-off Analysis:**
- Request-first: ✅ Better for request-centric workflow
- Buyer-first: ✅ Better for buyer-centric reporting

**Recommendation:** Use **request-first** structure + database indexes for buyer queries

---

## 🔧 IMPLEMENTATION DETAILS

### Path Generation Functions

#### 1. Media Library Upload Path
```javascript
function generateMediaLibraryPath(editorName, mediaType, filename) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const randomId = generateRandomId(9); // e.g., 'abc123xyz'

  return `media-library/${editorName}/${year}/${month}/${mediaType}/${timestamp}-${randomId}-${filename}`;
}

// Example output:
// media-library/PARMEET/2026/01/videos/1737000000000-abc123xyz-campaign.mp4
```

#### 2. File Request Upload Path
```javascript
function generateFileRequestPath(requestId, editorName, mediaType, filename) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = Date.now();
  const randomId = generateRandomId(9);

  return `file-requests/${requestId}/uploads/${editorName}/${dateStr}/${mediaType}/${timestamp}-${randomId}-${filename}`;
}

// Example output:
// file-requests/2d9674e6-5d93-4e5c-9f33-6c7274c083d1/uploads/PARMEET/2026-01-15/videos/1737000000000-abc123xyz-final.mp4
```

#### 3. Public Upload Path
```javascript
function generatePublicUploadPath(mediaType, filename) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timestamp = Date.now();
  const randomId = generateRandomId(9);

  return `public-uploads/${dateStr}/${mediaType}/${timestamp}-pub${randomId}-${filename}`;
}

// Example output:
// public-uploads/2026-01-15/videos/1737000000000-pub123abc-client_file.mp4
```

#### 4. Thumbnail Path
```javascript
function generateThumbnailPath(originalS3Key, size = '1920x1080') {
  const hash = crypto.createHash('md5').update(originalS3Key).digest('hex').substring(0, 9);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const filename = path.basename(originalS3Key);

  return `thumbnails/${year}/${month}/${hash}/thumb_${size}_${filename}.jpg`;
}

// Example output:
// thumbnails/2026/01/abc123xyz/thumb_1920x1080_campaign.jpg
```

---

## 📋 FILES THAT NEED TO BE CHANGED

### Backend Files

#### 1. `/backend/src/services/s3Service.js`
**Changes Required:**
- ✅ Add new path generation functions
- ✅ Update `uploadFile()` to use context-aware paths
- ✅ Add support for request ID parameter
- ✅ Add metadata file creation for requests
- ✅ Update thumbnail generation paths

**Key Functions to Update:**
```javascript
// Current (simplified)
async uploadFile(file, editorName, mediaType) {
  const s3Key = `${editorName}/${mediaType}/${timestamp}-${random}-${filename}`;
  // ...upload to S3
}

// New (context-aware)
async uploadFile(file, context) {
  const { uploadType, editorName, mediaType, requestId, buyerName } = context;

  let s3Key;
  if (uploadType === 'file_request') {
    s3Key = generateFileRequestPath(requestId, editorName, mediaType, file.originalname);
  } else if (uploadType === 'public') {
    s3Key = generatePublicUploadPath(mediaType, file.originalname);
  } else {
    s3Key = generateMediaLibraryPath(editorName, mediaType, file.originalname);
  }

  // Upload to S3
  // Create metadata file if request upload
  // Generate thumbnail
}
```

---

#### 2. `/backend/src/controllers/mediaController.js`
**Changes Required:**
- ✅ Update upload handler to pass context to s3Service
- ✅ Determine upload type (media-library vs file-request)
- ✅ Pass request metadata for file-request uploads

**Example Update:**
```javascript
async upload(req, res, next) {
  const { editor_id, folder_id, file_request_id } = req.body;

  const uploadContext = {
    uploadType: file_request_id ? 'file_request' : 'media_library',
    editorName: req.user.name,
    mediaType: getMediaType(req.file.mimetype),
    requestId: file_request_id,
    // ... other context
  };

  const result = await s3Service.uploadFile(req.file, uploadContext);
  // ...
}
```

---

#### 3. `/backend/src/controllers/fileRequestController.js`
**Changes Required:**
- ✅ Update public upload handler
- ✅ Pass file_request_id to upload context
- ✅ Create request metadata file on first upload
- ✅ Update metadata when request status changes

**Key Update:**
```javascript
async uploadToPublicRequest(req, res, next) {
  const { request_id } = req.params;

  const uploadContext = {
    uploadType: 'file_request',
    requestId: request_id,
    editorName: req.body.editor_name || 'Anonymous',
    mediaType: getMediaType(req.file.mimetype)
  };

  // Create/update request metadata
  await s3Service.createRequestMetadata(request_id, {
    request_title: request.title,
    buyer_name: request.buyer_name,
    // ...
  });

  const result = await s3Service.uploadFile(req.file, uploadContext);
}
```

---

#### 4. `/backend/src/services/thumbnailService.js`
**Changes Required:**
- ✅ Update thumbnail S3 path generation
- ✅ Use new thumbnail structure with hash-based organization

---

### Database Schema Updates

#### 5. `media_files` table
**New Columns to Add:**
```sql
ALTER TABLE media_files
ADD COLUMN upload_context VARCHAR(50) DEFAULT 'media_library', -- 'media_library', 'file_request', 'public'
ADD COLUMN file_request_id UUID REFERENCES file_requests(id),
ADD COLUMN s3_path_structure VARCHAR(20) DEFAULT 'v2'; -- Track which structure version
```

**Purpose:**
- Track which S3 structure version is used
- Link files to requests
- Enable migration queries

---

### Frontend Files

#### 6. `/frontend/src/lib/api.ts`
**Changes Required:**
- ✅ Add `file_request_id` parameter to upload API
- ✅ Add `upload_context` parameter

**Example:**
```typescript
export const mediaApi = {
  upload: (data: {
    file: File;
    editor_id: string;
    folder_id?: string;
    file_request_id?: string; // NEW
    upload_context?: 'media_library' | 'file_request'; // NEW
  }) => {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('editor_id', data.editor_id);
    if (data.folder_id) formData.append('folder_id', data.folder_id);
    if (data.file_request_id) formData.append('file_request_id', data.file_request_id);
    if (data.upload_context) formData.append('upload_context', data.upload_context);
    return api.post('/media/upload', formData);
  }
};
```

---

#### 7. `/frontend/src/components/BatchUploadModal.tsx`
**Changes Required:**
- ✅ Pass `file_request_id` if uploading to request
- ✅ Show upload context in UI

---

#### 8. `/frontend/src/pages/PublicFileRequestPage.tsx`
**Changes Required:**
- ✅ Pass `file_request_id` to upload API
- ✅ Set upload_context to 'file_request'

---

## 🔄 MIGRATION STRATEGY

### Option 1: Gradual Migration (RECOMMENDED)

**Approach:** New uploads use new structure, old files stay in place

**Pros:**
- ✅ Zero downtime
- ✅ No S3 copy costs
- ✅ Lower risk
- ✅ Gradual transition

**Cons:**
- ❌ Two structures coexist
- ❌ Search across both locations

**Implementation:**
1. Deploy new code with dual-path support
2. All new uploads use new structure
3. Old files remain accessible at old paths
4. Optional: Migrate old files over time (background job)

---

### Option 2: Full Migration

**Approach:** Copy all existing files to new structure

**Pros:**
- ✅ Single consistent structure
- ✅ Easier querying

**Cons:**
- ❌ S3 copy costs (potentially high)
- ❌ Takes time for large datasets
- ❌ Risk of data loss

**Implementation:**
1. Create migration script
2. Copy files to new paths (preserve originals)
3. Update database s3_key references
4. Verify all files accessible
5. Delete old files after verification period

---

### Option 3: Hybrid (BEST APPROACH)

**Approach:** New structure for new uploads + migrate critical/recent files

**Implementation:**
1. **Phase 1:** Deploy new code (supports both structures)
2. **Phase 2:** New uploads use new structure
3. **Phase 3:** Migrate files from last 90 days
4. **Phase 4:** Migrate active file requests
5. **Phase 5:** Leave old files in place (archive)

**Timeline:**
- Week 1: Deploy new structure code
- Week 2: Monitor new uploads
- Week 3-4: Migrate recent files
- Week 5+: Optional full migration

---

## 🔍 BACKWARDS COMPATIBILITY

### Dual-Path Lookup Function

```javascript
async function getFileUrl(mediaFile) {
  // Check which structure version
  if (mediaFile.s3_path_structure === 'v2') {
    // New structure - direct lookup
    return s3Service.getSignedUrl(mediaFile.s3_key);
  } else {
    // Old structure - legacy path
    const legacyKey = mediaFile.s3_key;

    // Try new location first
    const exists = await s3Service.fileExists(legacyKey);
    if (exists) {
      return s3Service.getSignedUrl(legacyKey);
    }

    // Fallback to old location
    return s3Service.getSignedUrl(legacyKey);
  }
}
```

---

## 📊 BENEFITS SUMMARY

### Current Structure Issues:
- ❌ All files flat within media type folders
- ❌ Cannot distinguish request uploads from general uploads
- ❌ No date-based organization
- ❌ Difficult to find files by time period
- ❌ No clear attribution for request uploads
- ❌ Cannot set lifecycle policies by date

### New Structure Benefits:
- ✅ **Request-first organization:** Easy to find all files for a request
- ✅ **Date-based hierarchy:** Archive old files automatically
- ✅ **Clear attribution:** Know who uploaded, when, and why
- ✅ **Scalable:** Handles millions of files efficiently
- ✅ **Buyer visibility:** Easy to aggregate buyer-specific files
- ✅ **Lifecycle management:** Auto-delete/archive by date
- ✅ **Cost optimization:** Move old files to Glacier automatically
- ✅ **Metadata files:** Request context without DB queries

---

## 💰 COST CONSIDERATIONS

### S3 Storage Costs:
- Current: ~$0.023/GB/month (Standard)
- With lifecycle: ~$0.004/GB/month (Glacier after 90 days)

### Potential Savings:
- Archive files >90 days old: **80% cost reduction**
- Delete file request uploads after completion + 180 days: **100% cost reduction**

### Lifecycle Policy Example:
```json
{
  "Rules": [
    {
      "Id": "ArchiveOldMediaLibrary",
      "Filter": {
        "Prefix": "media-library/"
      },
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ]
    },
    {
      "Id": "DeleteCompletedRequests",
      "Filter": {
        "Prefix": "file-requests/"
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 180
      }
    }
  ]
}
```

---

## 🚀 IMPLEMENTATION CHECKLIST

### Phase 1: Code Changes (Week 1)
- [ ] Update `s3Service.js` with new path generators
- [ ] Update `mediaController.js` to pass context
- [ ] Update `fileRequestController.js` for request uploads
- [ ] Add database columns (`upload_context`, `file_request_id`, `s3_path_structure`)
- [ ] Update frontend upload components
- [ ] Add backwards compatibility functions
- [ ] Write unit tests for path generation
- [ ] Test uploads in both contexts

### Phase 2: Deployment (Week 2)
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Monitor new uploads
- [ ] Verify new structure in S3
- [ ] Test file access (both old and new)

### Phase 3: Migration (Week 3-4) - OPTIONAL
- [ ] Create migration script
- [ ] Migrate recent files (last 90 days)
- [ ] Migrate active file requests
- [ ] Update database references
- [ ] Verify migrated files

### Phase 4: Optimization (Week 5+)
- [ ] Set up S3 lifecycle policies
- [ ] Monitor costs
- [ ] Archive old files
- [ ] Performance optimization

---

## ❓ QUESTIONS FOR APPROVAL

Before implementing, please confirm:

1. **Primary Organization:** Do you prefer request-first or buyer-first structure?
   - My recommendation: **Request-first** (easier to manage)

2. **Migration Strategy:** Gradual, Full, or Hybrid?
   - My recommendation: **Hybrid** (new structure + migrate recent)

3. **Lifecycle Policies:** Auto-archive files after X days?
   - My recommendation: **90 days to Glacier** (80% cost savings)

4. **Metadata Files:** Store request metadata in S3 or DB only?
   - My recommendation: **Both** (faster access, less DB load)

5. **Public Uploads:** Separate `public-uploads/` or within `file-requests/`?
   - My recommendation: **Separate** (easier to manage anonymous uploads)

---

Let me know if you approve this plan and I'll start implementing! 🚀
