# S3 Restructuring Implementation Plan (FINAL)

## Date: January 15, 2026

**Key Requirements:**
- ✅ NO anonymous uploads - everything tracked and attributed
- ✅ Full migration at once (dummy data can be replaced)
- ✅ Clear segregation and structured organization
- ✅ Every upload must have uploader name recorded

---

## 📁 FINAL S3 STRUCTURE

### Structure Overview

```
creative-library-media-pearmedia/
│
├── media-library/          # General media uploads (not request-specific)
│   └── {editor-name}/
│       └── {YYYY}/
│           └── {MM}/
│               └── {media-type}/
│                   └── {timestamp}-{random}-{filename}.ext
│
├── file-requests/          # File request uploads
│   └── {request-id}/
│       ├── _metadata.json  # Request context (buyer, deadline, title)
│       └── uploads/
│           └── {uploader-name}/     # Person who uploaded (editor or external)
│               └── {YYYY-MM-DD}/
│                   └── {media-type}/
│                       └── {timestamp}-{random}-{filename}.ext
│
└── thumbnails/             # Auto-generated thumbnails
    └── {YYYY}/
        └── {MM}/
            └── {file-hash}/
                └── thumb_{size}_{filename}.jpg
```

---

## 🎨 DETAILED SCENARIOS

### Scenario 1: Media Library Upload

**Use Case:** Editor PARMEET uploads creative video for general library

**S3 Path:**
```
media-library/PARMEET/2026/01/videos/1737000000000-abc123-creative_ad.mp4
```

**Database Record:**
```javascript
{
  id: 'file-uuid-123',
  original_filename: 'creative_ad.mp4',
  s3_key: 'media-library/PARMEET/2026/01/videos/1737000000000-abc123-creative_ad.mp4',
  s3_url: 'https://d1119rg1irtir1.cloudfront.net/media-library/PARMEET/2026/01/videos/...',
  upload_context: 'media_library',
  uploaded_by_id: 'user-456',
  uploaded_by_name: 'PARMEET',
  file_type: 'video',
  created_at: '2026-01-15T10:30:00Z'
}
```

---

### Scenario 2: File Request Upload by Assigned Editor

**Use Case:** Buyer "John Smith" requests video. Editor PARMEET uploads final video.

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
  "request_type": "video_edit",
  "buyer_id": "user-123",
  "buyer_name": "John Smith",
  "buyer_email": "john@company.com",
  "assigned_editor_id": "user-456",
  "assigned_editor_name": "PARMEET",
  "created_at": "2026-01-10T09:00:00Z",
  "deadline": "2026-01-20T23:59:59Z",
  "status": "in_progress",
  "uploaded_files_count": 3,
  "last_upload_at": "2026-01-15T14:30:00Z"
}
```

**Database Record:**
```javascript
{
  id: 'file-uuid-789',
  original_filename: 'superbowl_final.mp4',
  s3_key: 'file-requests/2d9674e6-5d93-4e5c-9f33-6c7274c083d1/uploads/PARMEET/2026-01-15/videos/...',
  s3_url: 'https://d1119rg1irtir1.cloudfront.net/file-requests/...',
  upload_context: 'file_request',
  file_request_id: '2d9674e6-5d93-4e5c-9f33-6c7274c083d1',
  uploaded_by_id: 'user-456',
  uploaded_by_name: 'PARMEET',
  file_type: 'video',
  created_at: '2026-01-15T14:30:00Z'
}
```

---

### Scenario 3: Public File Request Upload (External User)

**Use Case:** Public link for file request. Client "Sarah Wilson" uploads raw footage using public link.

**IMPORTANT:** Even public uploads must capture uploader name!

**S3 Path:**
```
file-requests/2d9674e6-5d93-4e5c-9f33-6c7274c083d1/uploads/Sarah-Wilson/2026-01-12/videos/1737000000000-xyz789-raw_footage.mp4
```

**How We Capture Name:**
- Public upload form REQUIRES name field (mandatory)
- If email provided, use email prefix as name
- Format: "FirstName-LastName" or "Email-Prefix"

**Database Record:**
```javascript
{
  id: 'file-uuid-999',
  original_filename: 'raw_footage.mp4',
  s3_key: 'file-requests/.../uploads/Sarah-Wilson/2026-01-12/videos/...',
  upload_context: 'file_request_public',
  file_request_id: '2d9674e6-5d93-4e5c-9f33-6c7274c083d1',
  uploaded_by_id: null,                    // No user account
  uploaded_by_name: 'Sarah Wilson',        // Captured from form
  uploaded_by_email: 'sarah@client.com',   // Captured from form
  file_type: 'video',
  created_at: '2026-01-12T11:00:00Z'
}
```

---

### Scenario 4: Multiple People Uploading to Same Request

**Use Case:** Request has multiple contributors (assigned editor + client + team members)

**S3 Structure:**
```
file-requests/abc-request-id/
├── _metadata.json
└── uploads/
    ├── PARMEET/                    # Assigned editor
    │   └── 2026-01-15/
    │       └── videos/
    │           └── final_edit_v1.mp4
    ├── Sarah-Wilson/               # Client (public upload)
    │   └── 2026-01-12/
    │       └── videos/
    │           └── raw_footage.mp4
    └── Mike-Chen/                  # Team member
        └── 2026-01-14/
            └── videos/
                └── draft_review.mp4
```

**Benefits:**
- ✅ Clear attribution for each file
- ✅ Chronological tracking
- ✅ Easy to see who contributed what
- ✅ No anonymous uploads

---

## 🔧 IMPLEMENTATION CHANGES

### 1. Database Schema Updates

```sql
-- Add new columns to track upload context
ALTER TABLE media_files
ADD COLUMN upload_context VARCHAR(50) DEFAULT 'media_library'
  CHECK (upload_context IN ('media_library', 'file_request', 'file_request_public')),
ADD COLUMN file_request_id UUID REFERENCES file_requests(id),
ADD COLUMN uploaded_by_name VARCHAR(255) NOT NULL,  -- Always required!
ADD COLUMN uploaded_by_email VARCHAR(255),          -- For public uploads
ADD COLUMN s3_path_version VARCHAR(10) DEFAULT 'v2';

-- Create index for faster queries
CREATE INDEX idx_media_files_upload_context ON media_files(upload_context);
CREATE INDEX idx_media_files_file_request ON media_files(file_request_id);
CREATE INDEX idx_media_files_uploader_name ON media_files(uploaded_by_name);
```

---

### 2. Backend: S3 Service Path Generators

**File:** `/backend/src/services/s3Service.js`

```javascript
/**
 * Generate S3 path for media library upload
 */
function generateMediaLibraryPath(uploaderName, mediaType, filename) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(5).toString('hex');

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return `media-library/${uploaderName}/${year}/${month}/${mediaType}/${timestamp}-${randomId}-${sanitizedFilename}`;
}

/**
 * Generate S3 path for file request upload
 */
function generateFileRequestPath(requestId, uploaderName, mediaType, filename) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(5).toString('hex');

  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return `file-requests/${requestId}/uploads/${uploaderName}/${dateStr}/${mediaType}/${timestamp}-${randomId}-${sanitizedFilename}`;
}

/**
 * Generate thumbnail path
 */
function generateThumbnailPath(originalS3Key, size = '1920x1080') {
  const hash = crypto.createHash('md5').update(originalS3Key).digest('hex').substring(0, 9);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const filename = path.basename(originalS3Key);

  return `thumbnails/${year}/${month}/${hash}/thumb_${size}_${filename}.jpg`;
}

/**
 * Main upload function with context awareness
 */
async function uploadFile(file, uploadContext) {
  const {
    uploadType,        // 'media_library' | 'file_request' | 'file_request_public'
    uploaderName,      // REQUIRED - always captured
    uploaderEmail,     // Optional for public uploads
    mediaType,         // 'videos' | 'images' | 'documents'
    requestId,         // Required if uploadType is file_request
    userId             // null for public uploads
  } = uploadContext;

  // Generate S3 key based on upload type
  let s3Key;
  if (uploadType === 'file_request' || uploadType === 'file_request_public') {
    s3Key = generateFileRequestPath(requestId, uploaderName, mediaType, file.originalname);
  } else {
    s3Key = generateMediaLibraryPath(uploaderName, mediaType, file.originalname);
  }

  // Upload to S3
  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  const result = await s3Client.send(new PutObjectCommand(uploadParams));

  // Generate CloudFront URL
  const cloudFrontUrl = `${process.env.AWS_CLOUDFRONT_URL}/${s3Key}`;

  // Create/update request metadata if file request upload
  if (uploadType === 'file_request' || uploadType === 'file_request_public') {
    await updateRequestMetadata(requestId);
  }

  return {
    s3_key: s3Key,
    s3_url: cloudFrontUrl,
    upload_context: uploadType
  };
}

/**
 * Create/update request metadata file
 */
async function updateRequestMetadata(requestId) {
  const metadataKey = `file-requests/${requestId}/_metadata.json`;

  // Fetch request details from database
  const request = await FileRequest.findById(requestId);

  const metadata = {
    request_id: requestId,
    request_title: request.title,
    request_type: request.request_type,
    buyer_id: request.buyer_id,
    buyer_name: request.buyer_name,
    buyer_email: request.buyer_email,
    assigned_editor_id: request.assigned_editor_id,
    assigned_editor_name: request.assigned_editor_name,
    created_at: request.created_at,
    deadline: request.deadline,
    status: request.status,
    uploaded_files_count: await countRequestFiles(requestId),
    last_upload_at: new Date().toISOString()
  };

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: metadataKey,
    Body: JSON.stringify(metadata, null, 2),
    ContentType: 'application/json'
  };

  await s3Client.send(new PutObjectCommand(uploadParams));
}
```

---

### 3. Backend: Media Controller Updates

**File:** `/backend/src/controllers/mediaController.js`

```javascript
async upload(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const {
      editor_id,
      file_request_id,
      folder_id,
      tags,
      description
    } = req.body;

    // Determine upload context
    const uploadType = file_request_id ? 'file_request' : 'media_library';

    // Get uploader name from user
    const uploaderName = req.user.name;
    const mediaType = getMediaTypeFromMimetype(req.file.mimetype);

    // Create upload context
    const uploadContext = {
      uploadType,
      uploaderName,
      uploaderEmail: req.user.email,
      mediaType,
      requestId: file_request_id,
      userId: req.user.id
    };

    // Upload to S3
    const s3Result = await s3Service.uploadFile(req.file, uploadContext);

    // Save to database
    const mediaFile = await MediaFile.create({
      original_filename: req.file.originalname,
      file_type: mediaType,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      s3_key: s3Result.s3_key,
      s3_url: s3Result.s3_url,
      upload_context: uploadType,
      file_request_id: file_request_id || null,
      uploaded_by_id: req.user.id,
      uploaded_by_name: uploaderName,
      uploaded_by_email: req.user.email,
      folder_id: folder_id || null,
      tags: tags ? JSON.parse(tags) : [],
      description: description || null,
      s3_path_version: 'v2'
    });

    res.status(201).json({
      success: true,
      data: mediaFile
    });

  } catch (error) {
    logger.error('Upload failed:', error);
    next(error);
  }
}
```

---

### 4. Backend: Public File Request Upload

**File:** `/backend/src/controllers/fileRequestController.js`

```javascript
async uploadToPublicRequest(req, res, next) {
  try {
    const { request_id } = req.params;
    const { uploader_name, uploader_email } = req.body;

    // VALIDATE: Uploader name is REQUIRED
    if (!uploader_name || uploader_name.trim() === '') {
      return res.status(400).json({
        error: 'Uploader name is required'
      });
    }

    // Verify request exists and is accepting uploads
    const request = await FileRequest.findById(request_id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Sanitize uploader name (convert spaces to hyphens)
    const sanitizedName = uploader_name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '');

    const mediaType = getMediaTypeFromMimetype(req.file.mimetype);

    // Create upload context for public upload
    const uploadContext = {
      uploadType: 'file_request_public',
      uploaderName: sanitizedName,
      uploaderEmail: uploader_email || null,
      mediaType,
      requestId: request_id,
      userId: null  // No user account for public uploads
    };

    // Upload to S3
    const s3Result = await s3Service.uploadFile(req.file, uploadContext);

    // Save to database
    const mediaFile = await MediaFile.create({
      original_filename: req.file.originalname,
      file_type: mediaType,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      s3_key: s3Result.s3_key,
      s3_url: s3Result.s3_url,
      upload_context: 'file_request_public',
      file_request_id: request_id,
      uploaded_by_id: null,                    // No user ID
      uploaded_by_name: sanitizedName,         // Captured from form
      uploaded_by_email: uploader_email || null,
      s3_path_version: 'v2'
    });

    // Link to file request
    await FileRequestUpload.create({
      file_request_id: request_id,
      media_file_id: mediaFile.id,
      uploaded_by_name: sanitizedName,
      uploaded_by_email: uploader_email || null
    });

    res.status(201).json({
      success: true,
      data: mediaFile
    });

  } catch (error) {
    logger.error('Public upload failed:', error);
    next(error);
  }
}
```

---

### 5. Frontend: Public Upload Form

**File:** `/frontend/src/pages/PublicFileRequestPage.tsx`

```typescript
// Add to upload form
const [uploaderName, setUploaderName] = useState('');
const [uploaderEmail, setUploaderEmail] = useState('');

const handleUpload = async () => {
  // Validate uploader name
  if (!uploaderName.trim()) {
    alert('Please enter your name');
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('uploader_name', uploaderName.trim());
  if (uploaderEmail) {
    formData.append('uploader_email', uploaderEmail.trim());
  }

  await api.post(`/file-requests/${requestId}/public-upload`, formData);
};

// In JSX
<div>
  <label>Your Name *</label>
  <input
    type="text"
    value={uploaderName}
    onChange={(e) => setUploaderName(e.target.value)}
    placeholder="Enter your full name"
    required
  />
</div>

<div>
  <label>Your Email (optional)</label>
  <input
    type="email"
    value={uploaderEmail}
    onChange={(e) => setUploaderEmail(e.target.value)}
    placeholder="your@email.com"
  />
</div>
```

---

## 🔄 FULL MIGRATION PLAN

Since all data is dummy/test data, we'll do a **complete clean migration**:

### Step 1: Backup Current Data
```bash
# Backup database
pg_dump $DATABASE_URL > backup_before_s3_migration.sql

# Optional: Backup S3 (if needed)
aws s3 sync s3://creative-library-media-pearmedia/ ./s3-backup/
```

### Step 2: Deploy New Code
```bash
git pull origin main
npm install  # backend
npm run build  # frontend
```

### Step 3: Run Database Migration
```sql
-- Run this SQL script on production

BEGIN;

-- Add new columns
ALTER TABLE media_files
ADD COLUMN IF NOT EXISTS upload_context VARCHAR(50) DEFAULT 'media_library',
ADD COLUMN IF NOT EXISTS file_request_id UUID REFERENCES file_requests(id),
ADD COLUMN IF NOT EXISTS uploaded_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS uploaded_by_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS s3_path_version VARCHAR(10) DEFAULT 'v1';

-- Update existing records with uploader name
UPDATE media_files mf
SET uploaded_by_name = u.name,
    uploaded_by_email = u.email
FROM users u
WHERE mf.user_id = u.id AND mf.uploaded_by_name IS NULL;

-- Make uploaded_by_name NOT NULL after backfilling
ALTER TABLE media_files
ALTER COLUMN uploaded_by_name SET NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_media_files_upload_context ON media_files(upload_context);
CREATE INDEX IF NOT EXISTS idx_media_files_file_request ON media_files(file_request_id);
CREATE INDEX IF NOT EXISTS idx_media_files_uploader_name ON media_files(uploaded_by_name);
CREATE INDEX IF NOT EXISTS idx_media_files_s3_version ON media_files(s3_path_version);

COMMIT;
```

### Step 4: Clear S3 Bucket (Dummy Data)
```bash
# Since it's all test data, we can delete everything
aws s3 rm s3://creative-library-media-pearmedia/ --recursive

# Or via script
node backend/scripts/clear-s3-bucket.js
```

### Step 5: Clear Database Media Files
```sql
-- Delete all media files (test data only!)
TRUNCATE TABLE media_files CASCADE;
TRUNCATE TABLE file_request_uploads CASCADE;
```

### Step 6: Restart Services
```bash
# On Render, trigger manual deploy or restart service
```

### Step 7: Test New Uploads
- Upload to media library → verify S3 path structure
- Upload to file request → verify S3 path structure
- Public upload → verify name is captured
- Check metadata files in S3

---

## ✅ VERIFICATION CHECKLIST

After migration:

- [ ] New media library uploads use: `media-library/{uploader}/{YYYY}/{MM}/{type}/...`
- [ ] File request uploads use: `file-requests/{request-id}/uploads/{uploader}/{date}/{type}/...`
- [ ] Public uploads capture uploader name (no anonymous uploads)
- [ ] Metadata files created for each request: `_metadata.json`
- [ ] Thumbnails use new structure: `thumbnails/{YYYY}/{MM}/{hash}/...`
- [ ] Database has `uploaded_by_name` for all files
- [ ] Database has `upload_context` tracking
- [ ] All uploads have proper attribution

---

## 📊 SUMMARY

### Key Changes:
1. ✅ **NO anonymous uploads** - uploader name always required
2. ✅ **Full migration** - clean slate with new structure
3. ✅ **Request-centric** - easy to find all files for a request
4. ✅ **Date-based** - chronological organization
5. ✅ **Clear attribution** - who uploaded what and when
6. ✅ **Metadata files** - request context without DB queries

### Files to Update:
- `/backend/src/services/s3Service.js` - Path generators
- `/backend/src/controllers/mediaController.js` - Upload handler
- `/backend/src/controllers/fileRequestController.js` - Public upload handler
- `/backend/src/models/MediaFile.js` - Add new fields
- `/frontend/src/pages/PublicFileRequestPage.tsx` - Capture uploader name
- Database schema - Add columns and indexes

### Timeline:
- **Day 1:** Deploy code changes
- **Day 2:** Run database migration
- **Day 3:** Clear dummy data (S3 + DB)
- **Day 4:** Test new uploads
- **Day 5:** Full production testing

---

**Ready to implement? I'll start with the backend S3 service updates!** 🚀
