# CRITICAL: Run This Migration on Production Database

## Problem
The production Render database doesn't have the `folders` table and related tables, causing 500 errors.

## Solution
You need to run the migration on your Render PostgreSQL database.

## Steps:

### 1. Get Your Production Database URL
1. Go to https://dashboard.render.com
2. Find your PostgreSQL database
3. Click on it
4. Copy the **External Database URL** (it looks like: `postgresql://user:password@host:5432/database`)

### 2. Run the Migration

Option A - Using psql (recommended):
```bash
psql "<YOUR_RENDER_DATABASE_URL>" -f /Users/mac/Desktop/creative-library/database/migrations/20240107_create_folders_system.sql
```

Option B - Using pgAdmin:
1. Open pgAdmin
2. Add new server with your Render database credentials
3. Open Query Tool
4. Load the file: `database/migrations/20240107_create_folders_system.sql`
5. Execute

### 3. Verify Tables Were Created
```bash
psql "<YOUR_RENDER_DATABASE_URL>" -c "\dt" | grep -E "(folders|file_permissions|teams|upload_batches)"
```

You should see:
- folders
- file_permissions
- teams
- team_members
- upload_batches
- file_operations_log

### 4. Test the Endpoints
After migration, test in production:
```bash
curl -X GET https://creative-library.onrender.com/api/folders/tree \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return folders array (empty initially) instead of 500 error.

## What This Migration Does:
- Creates `folders` table with hierarchical structure
- Creates `file_permissions` for access control
- Creates `teams` and `team_members` for collaboration
- Creates `upload_batches` for batch upload tracking
- Creates `file_operations_log` for audit trail
- Adds `folder_id`, `assigned_buyer_id`, `upload_batch_id` columns to `media_files` table
- Adds storage quota fields to `users` table
- Creates PostgreSQL function `get_folder_path()` for path traversal

## After Migration:
All folder features will work:
✅ Create folders
✅ Upload to folders
✅ Date-based organization (jan2024/15-jan/)
✅ Drag-and-drop files
✅ Folder navigation
✅ Breadcrumb trail
✅ Buyer assignment

---
**IMPORTANT**: Run this migration BEFORE testing folder features on production!
