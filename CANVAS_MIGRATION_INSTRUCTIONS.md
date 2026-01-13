# Canvas Feature Database Migration

## Problem
The canvas feature requires a new database table `file_request_canvas` which doesn't exist in production yet.

## Error in Logs
```
relation "file_request_canvas" does not exist
```

## Solution: Run Migration on Render

### Option 1: Using Render Dashboard (Easiest)

1. Go to https://dashboard.render.com
2. Select your PostgreSQL database: `creative_library_db`
3. Click "Connect" tab
4. Copy the External Database URL
5. Open a terminal and run:

```bash
# Copy the migration SQL
cat backend/migrations/20260113_add_canvas_table.sql

# Connect to database and paste the SQL
psql "YOUR_EXTERNAL_DATABASE_URL_HERE"

# Then paste the SQL content from the migration file
```

### Option 2: Using Render Shell (Direct)

1. Go to https://dashboard.render.com
2. Select your backend service: `creative-library`
3. Click "Shell" tab
4. Run these commands:

```bash
cd backend
psql $DATABASE_URL -f migrations/20260113_add_canvas_table.sql
```

### Option 3: Using Local Connection

From your local machine:

```bash
cd /Users/mac/Desktop/creative-library/backend

# Use the DATABASE_URL from Render environment variables
psql "postgresql://creative_library_db_user:YOUR_PASSWORD@dpg-csq11fdsvqrc73amjv70-a.oregon-postgres.render.com:5432/creative_library_db?sslmode=require" -f migrations/20260113_add_canvas_table.sql
```

## Migration SQL Content

The migration creates:
- `file_request_canvas` table with JSONB content and attachments
- Indexes for efficient queries
- Auto-update trigger for `updated_at` timestamp
- Foreign key to `file_requests` table

## Verify Migration Success

After running the migration, verify with:

```sql
-- Check table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'file_request_canvas';

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'file_request_canvas';
```

## Rollback (if needed)

```sql
DROP TRIGGER IF EXISTS trigger_update_canvas_timestamp ON file_request_canvas;
DROP FUNCTION IF EXISTS update_canvas_updated_at();
DROP TABLE IF EXISTS file_request_canvas;
```

## After Migration

Once the migration is successful:
1. The "Failed to load canvas" error will disappear
2. Users can create and edit Canvas briefs
3. Attachments can be uploaded to canvas
4. Auto-save will work properly

## Need Help?

If you encounter SSL connection issues, try adding `?sslmode=require` to the connection string.
