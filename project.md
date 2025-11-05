Creative Asset Library with Integrated Analytics
Project Overview
Build a production-ready Creative Asset Library System that serves two primary functions:
Media Library: Centralized storage for creative team uploads with metadata tagging and role-based access
Performance Analytics: Facebook campaign performance tracking aggregated by editor/creative team member
This system will integrate with an existing Facebook Campaign Launcher and reuse logic from an existing Metadata Tagger system.
📁 Reference Projects (CRITICAL - Analyze These First)
1. Existing Campaign Launcher
Location: /Users/mac/Desktop/campaign all settings/fb-campaign-launcher What to Analyze:
Frontend Structure: /frontend/src/components/Strategy150/Phase1Setup/AdSection.tsx
Current file upload implementation (lines 103-161)
Media type handling (single_image, single_video, carousel)
Facebook specs validation (lines 46-78)
Form state management with react-hook-form
Backend API: /backend/routes/media.js
Current upload flow with multer (lines 7-31)
Facebook image upload integration (line 42)
Facebook Integration: /backend/services/facebookApi.js
How files are uploaded to Facebook
Campaign/Ad creation flow
Ad naming conventions (lines 35-100)
Database Models: /backend/models/
User authentication structure
Campaign data schema
Key Files to Read:
/frontend/src/components/Strategy150/Phase1Setup/AdSection.tsx
/frontend/src/types/strategy150.ts
/backend/routes/media.js
/backend/services/facebookApi.js
/backend/models/FacebookAuth.js
What to Understand:
How current upload works (don't break it!)
Facebook API integration patterns
User authentication flow (JWT-based)
Form data structure
How ads are named and created
2. Existing Metadata Tagger System
Location: /Users/mac/Desktop/metadata tagger What to Analyze:
Backend Core: metadata_tagger_backend.py (822 lines)
Metadata extraction from images (lines 130-217)
Metadata extraction from videos (lines 295-329)
File processing workflow (lines 365-473)
Flask API structure
Facebook Integration:
facebook_api.py - Graph API client for campaigns/insights
facebook_integration.py - OAuth and token management
creative_processor.py - Downloads creatives and extracts metadata
Editor Management: editor_manager.py
Editor list management (JSON file)
Metadata matching logic (lines 71-127)
Performance aggregation (lines 129-237)
Editors Data: editors.json
Current editor list format
Naming conventions
Analytics Dashboard: templates/dashboard.html
Existing UI/UX for analytics
Campaign selection flow
Results display format
Key Files to Read:
metadata_tagger_backend.py (entire file - 822 lines)
editor_manager.py (entire file - 242 lines)
creative_processor.py (first 200 lines)
facebook_api.py (first 150 lines)
editors.json
README.md
SYSTEM_ARCHITECTURE.md
What to Reuse:
Metadata Extraction Logic:
PNG: Read copyright_notice, Author, Creator fields (lines 143-169 in backend)
JPEG: Read EXIF Artist, Copyright, ImageDescription (lines 172-213)
Video: FFmpeg metadata artist, author, comment (lines 295-329)
Editor Matching:
Pattern: "Created by EDITORXXX" extraction (lines 96-103 in editor_manager.py)
Case-insensitive matching (lines 107-124)
Multiple field checking (artist, author, creator, copyright)
Facebook Analytics:
Campaign insights fetching (facebook_api.py lines 62-89)
Ad creative download (creative_processor.py)
Performance aggregation by editor (editor_manager.py lines 129-237)
OAuth Flow:
Facebook authentication (facebook_integration.py)
Token encryption/decryption
Permission validation
🏗️ System Architecture
┌─────────────────────────────────────────────────────────────────┐
│                    CREATIVE ASSET LIBRARY                        │
│                    (Single Unified System)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ┌───────▼────────┐         ┌───────▼────────┐
        │  Media Library │         │   Analytics    │
        │   Module       │         │    Module      │
        └───────┬────────┘         └───────┬────────┘
                │                           │
                │                           │
    ┌───────────┴───────────┐   ┌──────────┴──────────┐
    │                       │   │                     │
┌───▼────┐         ┌────▼────┐  │  ┌─────────────┐  │
│ Upload │         │ Browse  │  │  │  FB OAuth   │  │
│ Files  │         │ Gallery │  │  │ Integration │  │
└───┬────┘         └────┬────┘  │  └──────┬──────┘  │
    │                   │       │         │         │
    ▼                   ▼       │         ▼         │
┌────────────────────────────┐  │  ┌──────────────┐ │
│   AWS S3 Storage           │  │  │ Performance  │ │
│   + PostgreSQL Metadata    │  │  │ Aggregation  │ │
└────────────────────────────┘  │  └──────────────┘ │
                                └────────────────────┘
                │
                │ API Integration
                ▼
┌─────────────────────────────────────────────────────┐
│      EXISTING CAMPAIGN LAUNCHER                      │
│  /Users/mac/Desktop/campaign all settings/          │
│       fb-campaign-launcher                           │
│                                                      │
│  • Calls library API to browse creatives            │
│  • Downloads selected file                          │
│  • Stores editor name in campaign data              │
│  • Ad name: [REVIEW] Campaign - Editor - Ad 1       │
└─────────────────────────────────────────────────────┘
💾 Database Schema (PostgreSQL)
-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'admin', 'creative', 'buyer'
  upload_limit_monthly INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- EDITORS (matches metadata tagger editors.json)
-- ============================================

CREATE TABLE editors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) UNIQUE NOT NULL, -- "John Creative", "Sarah Designer"
  editor_id VARCHAR(100) UNIQUE NOT NULL, -- "EDITOR001", "JOHN_DOE"
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed with existing editors from metadata tagger
-- INSERT INTO editors (name, editor_id) VALUES 
--   ('John Doe', 'EDITOR001'),
--   ('Jane Smith', 'EDITOR002');

-- ============================================
-- MEDIA FILES (Core Library Storage)
-- ============================================

CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File Info
  filename VARCHAR(500) NOT NULL, -- Stored filename
  original_filename VARCHAR(500) NOT NULL, -- User's original filename
  s3_url TEXT NOT NULL, -- Full S3 URL
  s3_key TEXT NOT NULL, -- S3 object key
  thumbnail_url TEXT, -- Thumbnail for fast loading
  
  -- File Metadata
  file_type VARCHAR(20) NOT NULL, -- 'image', 'video'
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL, -- bytes
  width INTEGER,
  height INTEGER,
  duration FLOAT, -- seconds (for videos)
  
  -- Editor Attribution (CRITICAL)
  editor_name VARCHAR(255) NOT NULL, -- Extracted from file metadata
  editor_id VARCHAR(100), -- Links to editors.editor_id
  metadata_source VARCHAR(50) DEFAULT 'embedded', -- 'embedded', 'manual', 'api'
  
  -- Upload Info
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  upload_date TIMESTAMP DEFAULT NOW(),
  
  -- Search & Organization
  tags TEXT[], -- ["summer", "sale", "vertical"]
  description TEXT,
  
  -- Soft Delete
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX idx_media_editor_name ON media_files(editor_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_upload_date ON media_files(upload_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_file_type ON media_files(file_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_uploaded_by ON media_files(uploaded_by) WHERE is_deleted = FALSE;
CREATE INDEX idx_media_tags ON media_files USING GIN(tags);

-- ============================================
-- UPLOAD TRACKING (Monthly Limits)
-- ============================================

CREATE TABLE upload_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  upload_month VARCHAR(7) NOT NULL, -- 'YYYY-MM' format
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, file_id)
);

CREATE INDEX idx_upload_tracking_month ON upload_tracking(user_id, upload_month);

-- ============================================
-- ACCESS LOGS (Audit Trail)
-- ============================================

CREATE TABLE access_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  file_id UUID REFERENCES media_files(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'view', 'download', 'delete', 'upload'
  ip_address INET,
  user_agent TEXT,
  additional_data JSONB, -- Flexible for extra context
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_access_logs_user ON access_logs(user_id, created_at DESC);
CREATE INDEX idx_access_logs_file ON access_logs(file_id, created_at DESC);

-- ============================================
-- FACEBOOK ANALYTICS (Cached Performance Data)
-- ============================================

CREATE TABLE facebook_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fb_campaign_id VARCHAR(255) UNIQUE NOT NULL,
  fb_ad_account_id VARCHAR(255) NOT NULL,
  campaign_name TEXT,
  status VARCHAR(50),
  objective VARCHAR(100),
  created_time TIMESTAMP,
  last_synced_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE facebook_ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fb_ad_id VARCHAR(255) UNIQUE NOT NULL,
  fb_campaign_id VARCHAR(255) REFERENCES facebook_campaigns(fb_campaign_id),
  ad_name TEXT,
  status VARCHAR(50),
  
  -- Performance Metrics (from Facebook Insights)
  spend DECIMAL(12, 2),
  impressions BIGINT,
  clicks BIGINT,
  cpm DECIMAL(10, 2), -- Cost per 1000 impressions
  cpc DECIMAL(10, 2), -- Cost per click
  ctr DECIMAL(10, 4), -- Click-through rate
  cost_per_result DECIMAL(10, 2),
  
  -- Creative Attribution
  fb_creative_id VARCHAR(255),
  creative_image_hash VARCHAR(255),
  editor_name VARCHAR(255), -- Extracted from creative metadata
  editor_id VARCHAR(100),
  
  -- Sync Info
  insights_date DATE, -- Which day these metrics are for
  last_synced_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(fb_ad_id, insights_date) -- One row per ad per day
);

CREATE INDEX idx_fb_ads_campaign ON facebook_ads(fb_campaign_id);
CREATE INDEX idx_fb_ads_editor ON facebook_ads(editor_name) WHERE editor_name IS NOT NULL;
CREATE INDEX idx_fb_ads_date ON facebook_ads(insights_date DESC);

-- ============================================
-- FACEBOOK AUTH TOKENS (User-specific)
-- ============================================

CREATE TABLE facebook_auth (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Encrypted Tokens
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  
  -- Token Info
  expires_at TIMESTAMP NOT NULL,
  fb_user_id VARCHAR(255),
  fb_user_name VARCHAR(255),
  fb_user_email VARCHAR(255),
  
  -- Permissions
  granted_permissions TEXT[], -- ['ads_read', 'ads_management', ...]
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ANALYTICS CACHE (Aggregated Results)
-- ============================================

CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key VARCHAR(255) UNIQUE NOT NULL, -- e.g., 'editor_performance_2025-01'
  data JSONB NOT NULL,
  computed_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_analytics_cache_key ON analytics_cache(cache_key) WHERE expires_at > NOW();



🔧 Backend Architecture (Node.js + Express)
Technology Stack
Runtime: Node.js 18+
Framework: Express.js
Database: PostgreSQL 14+ (via pg driver)
Storage: AWS S3 (via @aws-sdk/client-s3)
Auth: JWT (jsonwebtoken, bcrypt)
File Upload: multer + multer-s3
Metadata Extraction:
Images: exifr (reads EXIF/IPTC/XMP)
Videos: fluent-ffmpeg (ffprobe for metadata)
Facebook API: axios for Graph API calls
Environment: dotenv
Validation: joi or express-validator
Project Structure
creative-asset-library/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js         # PostgreSQL connection
│   │   │   ├── aws.js              # S3 client setup
│   │   │   └── facebook.js         # FB API config
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js             # JWT validation
│   │   │   ├── roleCheck.js        # RBAC middleware
│   │   │   ├── upload.js           # Multer config
│   │   │   └── errorHandler.js     # Global error handler
│   │   │
│   │   ├── services/
│   │   │   ├── metadataExtractor.js  # REUSE metadata tagger logic
│   │   │   ├── editorMatcher.js      # REUSE editor_manager.py logic
│   │   │   ├── s3Service.js          # Upload/download from S3
│   │   │   ├── facebookAuth.js       # OAuth flow (REUSE metadata tagger)
│   │   │   ├── facebookApi.js        # Graph API client (REUSE)
│   │   │   └── analyticsAggregator.js # Performance aggregation
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.js             # POST /auth/login, /auth/register
│   │   │   ├── media.js            # Media CRUD operations
│   │   │   ├── editors.js          # GET /editors
│   │   │   ├── analytics.js        # Analytics endpoints
│   │   │   └── facebook.js         # FB OAuth callbacks
│   │   │
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   ├── MediaFile.js
│   │   │   ├── Editor.js
│   │   │   └── FacebookAd.js
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.js           # Winston logger
│   │   │   ├── validation.js       # Input validators
│   │   │   └── encryption.js       # Token encryption (like metadata tagger)
│   │   │
│   │   └── server.js               # Express app entry point
│   │
│   ├── package.json
│   ├── .env.example
│   └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Register.tsx
│   │   │   │
│   │   │   ├── Library/              # Media Library Module
│   │   │   │   ├── MediaGrid.tsx     # Instagram-style grid
│   │   │   │   ├── MediaCard.tsx     # File preview card
│   │   │   │   ├── FilterBar.tsx     # Editor + date filters
│   │   │   │   ├── UploadModal.tsx   # Upload interface
│   │   │   │   └── PreviewModal.tsx  # Full-screen preview
│   │   │   │
│   │   │   └── Analytics/            # Analytics Module
│   │   │       ├── Dashboard.tsx     # Main analytics page
│   │   │       ├── EditorLeaderboard.tsx
│   │   │       ├── EditorPerformance.tsx
│   │   │       ├── CampaignSelector.tsx
│   │   │       ├── MetricsComparison.tsx
│   │   │       └── ExportButton.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── LibraryPage.tsx       # /library route
│   │   │   ├── AnalyticsPage.tsx     # /analytics route
│   │   │   └── AdminPage.tsx         # /admin route
│   │   │
│   │   ├── hooks/
│   │   │   ├── useMediaLibrary.ts
│   │   │   ├── useUpload.ts
│   │   │   ├── useAnalytics.ts
│   │   │   └── useAuth.ts
│   │   │
│   │   ├── services/
│   │   │   └── api.ts                # Axios client
│   │   │
│   │   ├── types/
│   │   │   ├── media.ts
│   │   │   ├── analytics.ts
│   │   │   └── user.ts
│   │   │
│   │   └── App.tsx
│   │
│   ├── package.json
│   └── tsconfig.json
│
└── docker-compose.yml


📡 API Endpoints (Complete Specification)
Authentication
POST /api/auth/register
Body: { name, email, password, role }
Response: { token, user: { id, name, email, role } }

POST /api/auth/login
Body: { email, password }
Response: { token, user: { id, name, email, role } }

GET /api/auth/me
Headers: Authorization: Bearer {token}
Response: { user: { id, name, email, role, uploadLimitMonthly } }

Media Library
POST /api/media/upload
Headers: Authorization: Bearer {token}
Content-Type: multipart/form-data
Body: { file: File, tags?: string[] }
Process:
  1. Validate file type/size
  2. Extract metadata (editor name)
  3. Match against editors table
  4. Upload to S3
  5. Generate thumbnail
  6. Store in database
Response: {
  id, filename, s3_url, thumbnail_url,
  editorName, editorId, fileType, fileSize,
  width, height, uploadDate
}

GET /api/media
Headers: Authorization: Bearer {token}
Query Params:
  - editor_name: string (filter by editor)
  - date_from: ISO date (YYYY-MM-DD)
  - date_to: ISO date
  - file_type: 'image' | 'video'
  - tags: string[] (comma-separated)
  - limit: number (default 50)
  - offset: number (default 0)
Response: {
  files: [{ id, filename, thumbnail_url, editorName, uploadDate, ... }],
  total: number,
  hasMore: boolean
}

GET /api/media/:id
Headers: Authorization: Bearer {token}
Response: { full file metadata + presigned S3 URL }

DELETE /api/media/:id
Headers: Authorization: Bearer {token}
Response: { success: true }
Editors
GET /api/editors
Response: [{ id, name, editorId, isActive }]

POST /api/editors (Admin only)
Body: { name, editorId }
Response: { id, name, editorId }

DELETE /api/editors/:id (Admin only)
Response: { success: true }
Analytics
GET /api/analytics/facebook/auth
Initiates Facebook OAuth flow
Response: { authUrl: string }

GET /api/analytics/facebook/callback
Query: { code, state }
Handles OAuth callback
Response: Redirect to /analytics?success=true

GET /api/analytics/facebook/accounts
Headers: Authorization: Bearer {token}
Response: [{ id, name, accountId }]

GET /api/analytics/facebook/campaigns
Headers: Authorization: Bearer {token}
Query: { ad_account_id }
Response: [{ id, name, status, objective }]

POST /api/analytics/analyze
Headers: Authorization: Bearer {token}
Body: {
  adAccountId: string,
  campaignIds: string[], (optional - analyzes all if empty)
  dateRange?: { from: date, to: date }
}
Response: {
  byEditor: {
    "John Creative": {
      numAds: 15,
      totalSpend: 5420.50,
      avgCpm: 12.34,
      avgCpc: 0.45,
      avgCostPerResult: 8.90,
      totalImpressions: 439500,
      totalClicks: 12045,
      ctr: 2.74,
      adIds: [...]
    },
    ...
  },
  noEditor: {
    numAds: 3,
    totalSpend: 890.20,
    ads: [...]
  }
}

GET /api/analytics/editors/:editorName
Headers: Authorization: Bearer {token}
Query: { date_from, date_to }
Response: { detailed stats for specific editor }

GET /api/analytics/compare
Headers: Authorization: Bearer {token}
Query: { editors: "John,Sarah,Mike", date_from, date_to }
Response: { comparison data for multiple editors }

GET /api/analytics/export
Headers: Authorization: Bearer {token}
Query: { format: 'csv' | 'excel', date_from, date_to }
Response: File download

🎨 Frontend Implementation (React + TypeScript)
Key Pages
1. Library Page (/library)
Components Used:
FilterBar: Editor dropdown (multi-select) + date range picker + file type toggle
MediaGrid: Virtualized grid (React Window) showing thumbnails
MediaCard: Individual file preview with hover effects
UploadModal: Drag-drop upload with progress bar
PreviewModal: Full-screen image/video preview
Features:
Instagram explore-style grid layout
Lazy loading (infinite scroll)
Multi-select files (Shift + Click)
Right-click context menu (Download, Delete, View Details)
Real-time upload progress
Filter persistence (URL query params)

2. Analytics Page (/analytics)
Components Used:
CampaignSelector: Multi-select campaigns with search
EditorLeaderboard: Sortable table of top/bottom performers
EditorPerformanceCard: Individual editor stats with charts
MetricsComparison: Side-by-side comparison of 2-3 editors
ExportButton: Download results as CSV/Excel
Features:
Facebook OAuth integration
Campaign selection with batch analysis
Real-time progress indicator during analysis
Sortable metrics tables (click column headers)
Time-series charts (Chart.js or Recharts)
Drill-down to individual ads


🔌 Integration with Existing Campaign Launcher
Reference Project: /Users/mac/Desktop/campaign all settings/fb-campaign-launcher
Integration Points:
1. Library Browser in Launcher
Add to: frontend/src/components/Strategy150/Phase1Setup/AdSection.tsx Changes:
Add state for library modal
Add "Browse Library" button alongside existing upload
Fetch selected file from library API
Convert to File object and use existing upload logic
Store editor metadata in form state

2. Backend Campaign Creation
Add to: backend/services/facebookApi.js (or wherever ad creation happens) Changes:
Accept editor metadata in campaign/ad creation request
Include editor name in ad name
Store in database


3. Ad Copy Naming
When ad is copied:
// Handle ad duplication
if (originalAdName.includes(' - Ad ')) {
  // Preserve editor name in copy
  newAdName = `${originalAdName}-copy`;
  // Result: "[REVIEW] Campaign - John Creative - Ad 1-copy"
}

🚀 Deployment Guide
Environment Variables
Backend .env:
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/creative_library
DATABASE_POOL_SIZE=20

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=creative-library-prod
AWS_CLOUDFRONT_URL=https://d123456.cloudfront.net

# JWT
JWT_SECRET=your-256-bit-secret-here
JWT_EXPIRY=7d

# Facebook
FB_APP_ID=735375959485927
FB_APP_SECRET=your-app-secret
FB_API_VERSION=v18.0
FB_REDIRECT_URI=https://library.yourcompany.com/api/facebook/callback

# File Limits
MAX_FILE_SIZE_MB=500
MAX_UPLOAD_PER_USER_MONTHLY=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://launcher.yourcompany.com

# Metadata Tagger Integration
METADATA_TAGGER_EDITORS_PATH=/Users/mac/Desktop/metadata tagger/editors.json

# Server
PORT=3001
NODE_ENV=production

✅ Success Criteria & Testing Checklist
Media Library Module:
 Upload image → editor name extracted correctly from metadata
 Upload video → editor name extracted from FFmpeg tags
 Files uploaded via metadata tagger system work identically
 Filter by editor → only that editor's files shown
 Filter by date range → correct files displayed
 Grid loads 1000 files in under 2 seconds (virtualized)
 Thumbnails load lazily (no full image downloads until preview)
 S3 presigned URLs expire after 1 hour
 Monthly upload limits enforced correctly
 Soft delete works (files not actually removed from S3)
Analytics Module:
 Facebook OAuth connects successfully
 Ad accounts fetched correctly
 Campaigns listed with insights data
 Creatives downloaded and metadata extracted
 Editor names matched against database
 Performance aggregated correctly by editor
 Leaderboard sorts by CPM/CPC/spend
 No-editor ads listed separately
 Export to CSV includes all metrics
 Results match metadata tagger analytics (verification test)
Launcher Integration:
 "Browse Library" button appears in AdSection
 Editor dropdown populates from library API
 Date picker filters library correctly
 Selected file downloads and displays
 Editor name stored in form state
 Ad created with name: [REVIEW] Campaign - Editor - Ad 1
 Ad copy preserves format: [REVIEW] Campaign - Editor - Ad 1-copy
 Local upload still works (regression test)
 Campaign database stores editor metadata








