# Migration Guide - New Features Implementation

This guide walks you through deploying all 10 new features to your Creative Asset Library.

## Features Included

1. **Comments System** - @mentions, threading, reactions, resolve threads
2. **Activity Feed UI** - Per-file activity timeline with filtering and export
3. **Upload Folder** - Directory upload with structure preservation
4. **Advanced Upload Controls** - Pause/resume/cancel uploads with queue management
5. **PDF Preview** - Full PDF viewer with zoom and navigation
6. **File Request Workflow** - External file collection via public links
7. **Smart Collections** - Saved searches with favorites and custom filters
8. **Public Link Sharing Enhancements** - Password protection, expiration, view limits
9. **Folder Breadcrumb Dropdown** - Sibling folder navigation
10. **Properties Panel** - 4-tab comprehensive file/folder properties viewer

## Prerequisites

- PostgreSQL database access
- Node.js and npm installed
- Backend and frontend servers stopped during migration

## Step 1: Backup Your Database (CRITICAL)

Before running any migration, always backup your database:

```bash
# Replace 'your_username' and 'creative_library' with your actual values
pg_dump -U your_username -d creative_library > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Save this backup file in a safe location!**

## Step 2: Run the Consolidated Migration

The migration file is idempotent and can be run multiple times safely.

```bash
# Navigate to backend directory
cd /Users/mac/Desktop/creative-library/backend

# Run the migration (replace with your database credentials)
psql -U your_username -d creative_library -f migrations/CONSOLIDATED_20240113_all_new_features.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE TABLE
ALTER TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
```

## Step 3: Verify Migration Success

Connect to your database and verify all tables were created:

```bash
psql -U your_username -d creative_library
```

Then run this verification query:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'file_comments',
    'comment_reactions',
    'file_requests',
    'file_request_uploads',
    'saved_searches',
    'public_link_access_log'
)
ORDER BY table_name;
```

**Expected Output (6 tables):**
```
      table_name
------------------------
 comment_reactions
 file_comments
 file_request_uploads
 file_requests
 public_link_access_log
 saved_searches
(6 rows)
```

Also verify the `file_permissions` table was altered:

```sql
\d file_permissions
```

You should see these new columns:
- `is_public_link`
- `link_password`
- `link_expires_at`
- `disable_download`
- `view_count`
- `last_viewed_at`
- `max_views`

Type `\q` to exit psql.

## Step 4: Install Frontend Dependencies

Install the PDF.js library:

```bash
cd /Users/mac/Desktop/creative-library/frontend
npm install pdfjs-dist@3.11.174
```

## Step 5: Verify Backend Routes

Check that all new routes are registered in `backend/src/server.js`:

```bash
cd /Users/mac/Desktop/creative-library/backend
grep -E "(commentRoutes|savedSearchRoutes|fileRequestRoutes)" src/server.js
```

You should see:
```javascript
const commentRoutes = require('./routes/comments');
const savedSearchRoutes = require('./routes/savedSearches');
const fileRequestRoutes = require('./routes/fileRequests');
app.use('/api/comments', commentRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/file-requests', fileRequestRoutes);
```

## Step 6: Start Backend Server

```bash
cd /Users/mac/Desktop/creative-library/backend
npm run dev
```

**Look for these log messages:**
```
✅ Database connected
API routes registered: /api/auth, /api/media, ..., /api/comments, /api/saved-searches, /api/file-requests
🚀 CREATIVE ASSET LIBRARY - SERVER RUNNING
```

## Step 7: Start Frontend Application

In a new terminal:

```bash
cd /Users/mac/Desktop/creative-library/frontend
npm start
```

## Step 8: Test New Features

### Test 1: Comments System
1. Navigate to Media Library
2. Right-click on any file
3. Select "Comments"
4. Add a comment with @mention
5. Add a reaction to the comment

### Test 2: Properties Panel
1. Right-click on any file or folder
2. Select "Properties"
3. Verify 4 tabs load: Details, Activity, Sharing, Versions

### Test 3: File Requests
1. Click "File Requests" in sidebar
2. Click "New Request"
3. Create a request and copy the public link
4. Open the link in an incognito window
5. Upload a file without logging in

### Test 4: Smart Collections
1. Click "Collections" in sidebar
2. Create a new collection with filters
3. Mark it as favorite
4. Verify it appears in sidebar under "Collections"

### Test 5: Public Link Sharing
1. Right-click a file → Share
2. Click "Get link" tab
3. Generate a public link with password
4. Test the link in incognito window

### Test 6: PDF Preview
1. Upload a PDF file
2. Click on it to open lightbox
3. Verify PDF renders with page navigation

### Test 7: Upload Folder
1. Click "Upload" button in Media Library
2. Enable "Upload Folder" toggle
3. Select a folder from your computer
4. Verify folder structure is preserved

### Test 8: Folder Breadcrumb Dropdown
1. Navigate into a folder with sibling folders
2. Click the chevron icon on any breadcrumb item
3. Verify dropdown shows sibling folders

## Rollback Procedure (If Needed)

If you encounter issues and need to rollback:

```bash
# Restore from backup
psql -U your_username -d creative_library < backup_YYYYMMDD_HHMMSS.sql

# Uninstall frontend dependencies
cd /Users/mac/Desktop/creative-library/frontend
npm uninstall pdfjs-dist

# Checkout previous git commit (if already pushed)
git checkout <previous-commit-hash>
```

## Common Issues

### Issue 1: "relation already exists" errors
**Solution**: This is normal if you've run the migration before. The migration is idempotent.

### Issue 2: "permission denied for table" errors
**Solution**: Ensure your database user has CREATE, ALTER privileges.

### Issue 3: Frontend compilation errors about missing modules
**Solution**: Run `npm install` in the frontend directory.

### Issue 4: 404 errors when accessing new routes
**Solution**: Restart the backend server to register new routes.

### Issue 5: PDF.js worker errors
**Solution**: Clear browser cache. The worker URL is set to CDN: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

## Environment Variables

No new environment variables are required for these features. However, you may want to configure:

```env
# Optional: Set to 'true' to enable detailed logging
DEBUG=true

# Optional: Adjust rate limits if needed
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Production Deployment Notes

When deploying to production (e.g., Render, Heroku):

1. **Run migration via platform CLI**:
   ```bash
   # Render example
   render sql-console -c "your-database-url" < migrations/CONSOLIDATED_20240113_all_new_features.sql
   ```

2. **Set build commands**:
   - Backend: `npm install`
   - Frontend: `npm install && npm run build`

3. **Environment variables**: Ensure `ALLOWED_ORIGINS` includes your production frontend URL

4. **CORS**: Verify backend allows your production domain in CORS configuration

## Database Schema Reference

### New Tables Summary

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `file_comments` | Stores file comments | file_id, user_id, content, mentions |
| `comment_reactions` | Comment reactions | comment_id, user_id, reaction_type |
| `file_requests` | File request definitions | title, request_token, deadline |
| `file_request_uploads` | Files uploaded to requests | file_request_id, file_id, uploaded_by_email |
| `saved_searches` | Smart collections | user_id, filters (JSONB), is_favorite |
| `public_link_access_log` | Public link analytics | permission_id, ip_address, action |

### Enhanced Tables

| Table | New Columns Added |
|-------|-------------------|
| `file_permissions` | is_public_link, link_password, link_expires_at, disable_download, view_count, last_viewed_at, max_views |

## Support

If you encounter any issues during migration:

1. Check the backend server logs for detailed error messages
2. Verify database connection settings in `.env`
3. Ensure all backend dependencies are installed: `npm install`
4. Check browser console for frontend errors

## Success Checklist

- [ ] Database backup created
- [ ] Migration script executed successfully
- [ ] All 6 new tables created
- [ ] `file_permissions` table altered
- [ ] Frontend dependencies installed
- [ ] Backend server starts without errors
- [ ] Frontend builds without errors
- [ ] All 8 test scenarios pass
- [ ] New menu items appear in UI (Comments, Properties, Activity)
- [ ] File Requests page loads
- [ ] Smart Collections page loads
- [ ] Public link generation works
- [ ] PDF preview works for PDF files

---

**Migration Complete!** Your Creative Asset Library now has all 10 advanced features enabled.
