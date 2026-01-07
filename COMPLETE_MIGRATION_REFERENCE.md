# Complete Migration Reference

## Overview

This document provides a complete reference for all database migrations in the Creative Asset Library project.

## Migration Files Available

### 1. MASTER_MIGRATION_ALL_FEATURES.sql (RECOMMENDED FOR NEW DATABASES)
**Location**: `backend/migrations/MASTER_MIGRATION_ALL_FEATURES.sql`
**Purpose**: Complete database setup from scratch
**Creates**: 24 tables + indexes + functions + triggers

**Use this when**:
- Setting up a new database
- Rebuilding database from scratch
- Fresh deployment

**Tables Created**:
1. users
2. editors
3. media_files
4. upload_tracking
5. access_logs
6. facebook_campaigns
7. facebook_ads
8. ad_name_changes
9. facebook_auth
10. analytics_cache
11. admin_audit_log
12. folders
13. file_permissions
14. teams
15. team_members
16. upload_batches
17. file_operations_log
18. file_comments
19. comment_reactions
20. file_requests
21. file_request_uploads
22. saved_searches
23. public_link_access_log

Plus numerous indexes, functions, and triggers.

---

### 2. CONSOLIDATED_20240113_all_new_features.sql (FOR EXISTING DATABASES)
**Location**: `backend/migrations/CONSOLIDATED_20240113_all_new_features.sql`
**Purpose**: Add 10 new Dropbox-like features to existing database
**Creates**: 6 new tables + enhancements to file_permissions

**Use this when**:
- You already have the base schema (users, editors, media_files, folders, etc.)
- You want to add only the new features

**What it adds**:
- Comments System (file_comments, comment_reactions)
- File Requests (file_requests, file_request_uploads)
- Smart Collections (saved_searches)
- Public Link Enhancements (7 new columns in file_permissions + public_link_access_log)

---

### 3. Individual Migration Files (FOR GRANULAR CONTROL)

#### Base System Migrations:
**database/schema.sql** - Original base schema
- Users, editors, media_files
- Facebook integration tables
- Access logs and analytics

**database/migrations/20240107_create_folders_system.sql** - Folders & Permissions
- folders table
- file_permissions table
- teams and team_members
- upload_batches
- file_operations_log
- Adds folder_id, version_number, etc. to media_files

**database/migrations/add_metadata_tracking.sql** - Metadata Features
- metadata_stripped
- metadata_embedded
- metadata_operations

#### New Features Migrations:
**backend/migrations/20240108_add_starred_column.sql** - Favorites
- is_starred column
- starred_at timestamp
- Indexes for starred queries

**backend/migrations/20240109_create_comments.sql** - Comments
- file_comments table
- comment_reactions table
- Indexes for performance

**backend/migrations/20240110_create_file_requests.sql** - File Requests
- file_requests table
- file_request_uploads table
- Token-based public uploads

**backend/migrations/20240111_create_saved_searches.sql** - Smart Collections
- saved_searches table
- JSONB filters support
- Favorite collections

**backend/migrations/20240112_enhance_public_links.sql** - Public Sharing
- 7 new columns in file_permissions
- public_link_access_log table
- Password protection, expiration, view limits

---

## Migration Strategies

### Strategy 1: Fresh Database Setup (Fastest)
```bash
# 1. Create database
createdb creative_library

# 2. Run master migration
cd /Users/mac/Desktop/creative-library/backend
psql -U your_username -d creative_library -f migrations/MASTER_MIGRATION_ALL_FEATURES.sql

# Expected: ✅ 24 tables created
```

### Strategy 2: Existing Database - Add New Features Only
```bash
# If you already have base schema + folders system
cd /Users/mac/Desktop/creative-library/backend
psql -U your_username -d creative_library -f migrations/CONSOLIDATED_20240113_all_new_features.sql

# Expected: ✅ 6 new tables + file_permissions enhanced
```

### Strategy 3: Incremental from Scratch (Most Control)
```bash
cd /Users/mac/Desktop/creative-library

# Base schema
psql -U user -d creative_library -f database/schema.sql

# Folders system
psql -U user -d creative_library -f database/migrations/20240107_create_folders_system.sql

# Metadata tracking
psql -U user -d creative_library -f database/migrations/add_metadata_tracking.sql

# New features (one by one)
psql -U user -d creative_library -f backend/migrations/20240108_add_starred_column.sql
psql -U user -d creative_library -f backend/migrations/20240109_create_comments.sql
psql -U user -d creative_library -f backend/migrations/20240110_create_file_requests.sql
psql -U user -d creative_library -f backend/migrations/20240111_create_saved_searches.sql
psql -U user -d creative_library -f backend/migrations/20240112_enhance_public_links.sql
```

---

## Verification Queries

### Check All Tables Exist
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected: 24 tables

### Check New Feature Tables
```sql
SELECT table_name 
FROM information_schema.tables 
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

Expected: 6 tables

### Check media_files Columns
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'media_files' 
ORDER BY ordinal_position;
```

Should include: folder_id, is_starred, starred_at, metadata_stripped, etc.

### Check file_permissions Enhancements
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'file_permissions' 
AND column_name IN (
  'is_public_link', 
  'link_password', 
  'link_expires_at', 
  'disable_download', 
  'view_count', 
  'last_viewed_at', 
  'max_views'
);
```

Expected: 7 rows

### Check Functions
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

Should include: get_folder_path, update_ad_name_hash

---

## Rollback Procedures

### Rollback New Features (Keep Base Schema)
```sql
BEGIN;

-- Drop new tables
DROP TABLE IF EXISTS public_link_access_log CASCADE;
DROP TABLE IF EXISTS saved_searches CASCADE;
DROP TABLE IF EXISTS file_request_uploads CASCADE;
DROP TABLE IF EXISTS file_requests CASCADE;
DROP TABLE IF EXISTS comment_reactions CASCADE;
DROP TABLE IF EXISTS file_comments CASCADE;

-- Remove public link columns
ALTER TABLE file_permissions 
  DROP COLUMN IF EXISTS is_public_link,
  DROP COLUMN IF EXISTS link_password,
  DROP COLUMN IF EXISTS link_expires_at,
  DROP COLUMN IF EXISTS disable_download,
  DROP COLUMN IF EXISTS view_count,
  DROP COLUMN IF EXISTS last_viewed_at,
  DROP COLUMN IF EXISTS max_views;

-- Remove starred columns
ALTER TABLE media_files 
  DROP COLUMN IF EXISTS is_starred,
  DROP COLUMN IF EXISTS starred_at;

COMMIT;
```

### Complete Rollback (Nuclear Option)
```sql
-- Drop all tables
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO your_username;
GRANT ALL ON SCHEMA public TO public;

-- Then run migrations again from scratch
```

---

## Migration Dependencies

### Dependency Graph
```
Base Schema (schema.sql)
  ↓
Folders System (20240107_create_folders_system.sql)
  ↓
Metadata Tracking (add_metadata_tracking.sql)
  ↓
┌─────────────────┬─────────────────┬──────────────────┬─────────────────┐
│   Starred       │   Comments      │  File Requests   │  Smart Collections │
│  (20240108)     │  (20240109)     │   (20240110)     │    (20240111)      │
└────��────────────┴─────────────────┴──────────────────┴─────────────────┘
                              ↓
                    Public Link Enhancements
                        (20240112)
```

### Required Tables for Each Feature

**Starred/Favorites**:
- Requires: media_files
- Creates: Adds columns to media_files

**Comments System**:
- Requires: media_files, users
- Creates: file_comments, comment_reactions

**File Requests**:
- Requires: users, media_files, folders
- Creates: file_requests, file_request_uploads

**Smart Collections**:
- Requires: users
- Creates: saved_searches

**Public Links**:
- Requires: file_permissions (from folders system)
- Creates: Adds columns to file_permissions, public_link_access_log

---

## Common Issues

### Issue: "relation already exists"
**Cause**: Table already created
**Solution**: This is normal with idempotent migrations using `IF NOT EXISTS`

### Issue: "column already exists"
**Cause**: Column already added
**Solution**: This is normal with `ADD COLUMN IF NOT EXISTS`

### Issue: "relation does not exist"
**Cause**: Trying to reference a table that doesn't exist yet
**Solution**: Run migrations in correct order (see dependency graph)

### Issue: "permission denied"
**Cause**: Database user lacks privileges
**Solution**:
```sql
GRANT ALL PRIVILEGES ON DATABASE creative_library TO your_username;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_username;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_username;
```

---

## Production Deployment

### Render PostgreSQL
```bash
# Get connection string from Render dashboard
# Then run migration

# Option 1: Via Render CLI
render sql-console -c "postgresql://..." < backend/migrations/MASTER_MIGRATION_ALL_FEATURES.sql

# Option 2: Via psql
psql "postgresql://user:pass@host:port/database" -f backend/migrations/MASTER_MIGRATION_ALL_FEATURES.sql
```

### Heroku PostgreSQL
```bash
# Get database URL
heroku config:get DATABASE_URL -a your-app-name

# Run migration
heroku pg:psql -a your-app-name < backend/migrations/MASTER_MIGRATION_ALL_FEATURES.sql
```

### AWS RDS
```bash
# Use RDS endpoint
psql -h your-rds-endpoint.rds.amazonaws.com \
     -U your_username \
     -d creative_library \
     -f backend/migrations/MASTER_MIGRATION_ALL_FEATURES.sql
```

---

## Migration Checklist

Before running migrations:
- [ ] Backup database
- [ ] Stop backend server
- [ ] Check current schema state
- [ ] Choose correct migration file
- [ ] Review migration for compatibility

After running migrations:
- [ ] Verify table count (24 expected)
- [ ] Check all indexes created
- [ ] Test foreign key constraints
- [ ] Run verification queries
- [ ] Install frontend dependencies (pdfjs-dist)
- [ ] Restart backend server
- [ ] Test new features in UI

---

## Quick Reference

| Scenario | Migration File | Tables Created |
|----------|---------------|----------------|
| New database | MASTER_MIGRATION_ALL_FEATURES.sql | 24 |
| Add new features only | CONSOLIDATED_20240113_all_new_features.sql | 6 + enhancements |
| Just comments | 20240109_create_comments.sql | 2 |
| Just file requests | 20240110_create_file_requests.sql | 2 |
| Just smart collections | 20240111_create_saved_searches.sql | 1 |
| Just public links | 20240112_enhance_public_links.sql | 1 + columns |
| Just starred | 20240108_add_starred_column.sql | 0 (columns only) |

---

**Last Updated**: 2024-01-13
**Version**: 1.0.0
