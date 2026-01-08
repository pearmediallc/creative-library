# Render Production Database Migration Instructions

## Problem Summary

Your Render production database is missing several tables and columns, causing these errors:
- ❌ `column "folder_id" of relation "file_requests" does not exist`
- ❌ `GET /api/teams 500 (Internal Server Error)`
- ❌ `this.query is not a function`
- ❌ Metadata tags UI not working (missing database tables)

## Solution

Run the comprehensive migration script that includes ALL required schema changes.

---

## Step 1: Get Your Render Database URL

1. Go to your [Render Dashboard](https://dashboard.render.com/)
2. Click on your **PostgreSQL** database instance
3. On the database page, click **"Connect"** (top right)
4. Copy the **"External Database URL"** - it will look like:
   ```
   postgresql://username:password@hostname.render.com:5432/database_name
   ```
5. Keep this URL handy for the next step

---

## Step 2: Run the Migration

### Option A: Using Render Shell (Recommended)

1. In Render Dashboard, click on your **Backend service**
2. Click **"Shell"** tab at the top
3. Run these commands one by one:

```bash
cd /app
export DATABASE_URL="your-database-url-from-step-1"
psql "$DATABASE_URL" -f backend/migrations/RENDER_PRODUCTION_MIGRATION.sql
```

Replace `"your-database-url-from-step-1"` with the actual URL you copied.

### Option B: From Your Local Machine

If you have `psql` installed locally:

```bash
cd ~/Desktop/creative-library
export DATABASE_URL="your-database-url-from-step-1"
psql "$DATABASE_URL" -f backend/migrations/RENDER_PRODUCTION_MIGRATION.sql
```

### Option C: Using pgAdmin or Database GUI

1. Open pgAdmin or your preferred PostgreSQL GUI
2. Connect to your Render database using the External Database URL
3. Open the SQL query tool
4. Copy and paste the contents of `backend/migrations/RENDER_PRODUCTION_MIGRATION.sql`
5. Execute the script

---

## Step 3: Verify Migration Success

After running the migration, you should see output like:

```
NOTICE:  ✓ file_requests table exists
NOTICE:  ✓ metadata_tags table exists
NOTICE:  ✓ media_file_tags table exists
NOTICE:  ✓ metadata_tags_with_usage view exists
NOTICE:  ✓ file_requests.folder_id column exists
NOTICE:  ✓ file_requests.editor_id column exists
NOTICE:  ✓ file_requests.assigned_buyer_id column exists

 status                          | total_tags | total_tag_associations | total_file_requests | completed_at
---------------------------------+------------+------------------------+---------------------+-------------------------
 Migration completed successfully!|     0      |           0            |          0          | 2026-01-09 XX:XX:XX
```

---

## Step 4: Restart Your Render Services

After migration completes:

1. Go to your Render Backend service
2. Click **"Manual Deploy"** > **"Clear build cache & deploy"**
3. Wait for deployment to complete
4. Your frontend should automatically pick up the changes

---

## Step 5: Verify in Your App

Once deployment completes, visit `https://creative-library.onrender.com` and verify:

- ✅ Teams page loads without errors
- ✅ File tags UI appears on media files (Tags button in grid view)
- ✅ Trash preview displays images correctly
- ✅ Recents page has Grid/List toggle
- ✅ Team creation has member selection

---

## What This Migration Includes

The migration script creates/updates:

### Tables Created:
- `file_requests` - with `folder_id`, `editor_id`, `assigned_buyer_id` columns
- `file_request_uploads` - tracks uploaded files through file requests
- `metadata_tags` - tag definitions (name, category, description)
- `media_file_tags` - junction table linking files to tags
- `file_comments` - comments on media files
- `comment_reactions` - reactions to comments
- `saved_searches` - smart collections
- `public_link_access_log` - public link analytics

### Views Created:
- `metadata_tags_with_usage` - tags with usage counts

### Columns Added to Existing Tables:
- `file_permissions`: public link features (expiry, password, view counts)

---

## Troubleshooting

### Error: "psql: command not found"
Use Option C (pgAdmin) or install PostgreSQL client:
- **Mac**: `brew install postgresql`
- **Linux**: `sudo apt-get install postgresql-client`
- **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/)

### Error: "connection refused"
- Make sure you're using the **External Database URL**, not the Internal one
- Verify your IP is whitelisted in Render database settings (usually all IPs are allowed)

### Error: "relation already exists"
This is OK! The script uses `CREATE TABLE IF NOT EXISTS`, so it won't error if tables already exist.

### Frontend still not showing changes after migration
1. Clear your browser cache
2. Hard reload with Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. Check browser console for any remaining errors

---

## Need Help?

If you encounter any issues:
1. Check the Render logs: Dashboard > Backend Service > Logs
2. Look for database connection errors or schema errors
3. Share the error messages and I can help debug further

---

**Created**: January 9, 2026
**Migration File**: `backend/migrations/RENDER_PRODUCTION_MIGRATION.sql`
**Git Commits**: 3b7de1a (route fixes), 9b5854f (frontend features), 008a51e (migration script)
