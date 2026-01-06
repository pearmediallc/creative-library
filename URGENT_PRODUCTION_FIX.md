# 🚨 URGENT: Production Database Migration Required

## Problem
Your production deployment is failing because the database migrations were never run on Render PostgreSQL.

**Current Errors:**
```
❌ column "metadata_stripped" of relation "media_files" does not exist
❌ column "password_changed_by" of relation "users" does not exist
```

**Impact:**
- File uploads are completely broken
- Password reset functionality doesn't work
- User creation may fail
- Production site is unusable

---

## ✅ IMMEDIATE FIX (5 minutes)

### Step 1: Connect to Render PostgreSQL

1. **Go to Render Dashboard**
   - Navigate to: https://dashboard.render.com
   - Find your PostgreSQL service (should be named something like "creative-library-db")

2. **Get Connection Details**
   - Click on your PostgreSQL service
   - Click **"Connect"** button (top right)
   - Select **"External Connection"**
   - You'll see connection details like:
     ```
     Host: dpg-xxxxx.oregon-postgres.render.com
     Port: 5432
     Database: creative_library_xxx
     Username: creative_library_xxx_user
     Password: [shown on screen]
     ```

3. **Copy the Connection String**
   - It looks like: `postgresql://username:password@host:port/database`
   - Example:
     ```
     postgresql://creative_library_xxx_user:abc123@dpg-xxx.oregon-postgres.render.com:5432/creative_library_xxx
     ```

### Step 2: Install PostgreSQL Client (if not already installed)

**Option A: Using Homebrew (Mac)**
```bash
brew install postgresql
```

**Option B: Using Official Installer**
- Download from: https://www.postgresql.org/download/
- Or download TablePlus/DBeaver (GUI tools)

### Step 3: Connect to Database

**Using psql command line:**
```bash
# Replace with your actual connection string from Render
psql "postgresql://username:password@host:port/database"
```

**OR using TablePlus/DBeaver (Easier):**
1. Open TablePlus or DBeaver
2. Click "New Connection" → PostgreSQL
3. Enter connection details from Render
4. Click "Connect"

### Step 4: Run the Migration Script

**Method 1: Copy-Paste in psql**
```bash
# After connecting with psql
\i /Users/mac/Desktop/creative-library/COMPLETE_PRODUCTION_MIGRATION.sql
```

**Method 2: Copy-Paste in GUI Tool**
1. Open `COMPLETE_PRODUCTION_MIGRATION.sql` in a text editor
2. Copy the entire contents
3. In TablePlus/DBeaver, paste into SQL editor
4. Click "Run" or press Cmd+Enter

**Method 3: Direct psql command**
```bash
psql "postgresql://YOUR_CONNECTION_STRING" -f /Users/mac/Desktop/creative-library/COMPLETE_PRODUCTION_MIGRATION.sql
```

### Step 5: Verify Migration Success

You should see output like:
```
NOTICE:  ✅ All required columns and tables exist!
COMMIT
```

If you see any errors, **DO NOT PANIC** - the script is idempotent (safe to run multiple times).

### Step 6: Create Admin User (Optional)

If you don't have an admin user yet:

```bash
# Generate password hash
cd /Users/mac/Desktop/creative-library
node generate-password-hash.js "YourSecurePassword123"

# Copy the hash output (looks like: $2b$10$...)
# Edit COMPLETE_PRODUCTION_MIGRATION.sql
# Uncomment the bootstrap section at the bottom
# Replace the hash with your generated hash
# Run the script again
```

### Step 7: Test Production Site

1. Go to: https://creative-library-frontend.onrender.com
2. Try to **upload a file** - Should work now ✅
3. Try to **create a user** as admin - Should work now ✅
4. Try to **reset a password** - Should work now ✅

---

## 🎯 Expected Results After Migration

### ✅ Database Schema Should Have:

**media_files table:**
- `metadata_stripped` (boolean)
- `metadata_embedded` (jsonb)
- `metadata_operations` (text array)

**users table:**
- `password_changed_by` (uuid)
- `password_changed_at` (timestamp)

**New table:**
- `password_audit_log` (complete table for audit trail)

### ✅ Functionality Should Work:

1. **File Uploads**
   - Upload any image/video
   - With or without metadata options checked
   - No "column does not exist" errors

2. **Password Reset**
   - Admin panel → Users → Key icon
   - Reset user password
   - No "password_changed_by" errors

3. **User Creation**
   - Admin panel → Add User
   - Create with any email
   - User appears in list

4. **Facebook Integration**
   - Connect Facebook account
   - Fetch ad accounts
   - Fetch campaigns

---

## 🔧 Troubleshooting

### "Connection refused" or "Could not connect"
**Cause:** Wrong connection details or firewall
**Fix:**
1. Double-check connection string from Render
2. Make sure you're using **External Connection** details (not Internal)
3. Check if your IP needs to be whitelisted (Render usually doesn't require this)

### "Permission denied"
**Cause:** Wrong username/password
**Fix:**
1. Copy password exactly from Render dashboard
2. Use the full connection string provided by Render

### "psql: command not found"
**Cause:** PostgreSQL client not installed
**Fix:**
```bash
# Install via Homebrew
brew install postgresql

# OR use a GUI tool like TablePlus instead
```

### Migration shows "ERROR: relation already exists"
**Cause:** Some tables/columns already exist
**Fix:** This is OKAY! The script uses "IF NOT EXISTS" so it's safe. Just check the verification queries at the end show all columns exist.

### "password_audit_log already exists"
**Cause:** Table was created in a previous run
**Fix:** This is OKAY! The migration is idempotent.

---

## 📞 Need Help?

If you're stuck, here's a quick diagnostic:

**Check if tables exist:**
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('media_files', 'users', 'password_audit_log')
AND column_name IN (
  'metadata_stripped',
  'metadata_embedded',
  'metadata_operations',
  'password_changed_by',
  'password_changed_at'
)
ORDER BY table_name, column_name;
```

**Expected output:**
```
   table_name   |      column_name      |   data_type
----------------+----------------------+--------------
 media_files    | metadata_embedded    | jsonb
 media_files    | metadata_operations  | ARRAY
 media_files    | metadata_stripped    | boolean
 users          | password_changed_at  | timestamp
 users          | password_changed_by  | uuid
```

---

## ⚡ Quick Summary

1. **Get Render PostgreSQL connection string**
2. **Connect using psql or TablePlus**
3. **Run COMPLETE_PRODUCTION_MIGRATION.sql**
4. **Verify success** (should see ✅ message)
5. **Test production site** (uploads should work)

**Estimated Time:** 5-10 minutes

---

## 🎉 After This Is Done

Your production site will be fully functional:
- ✅ File uploads working
- ✅ Password reset working
- ✅ User creation working
- ✅ All features operational

The issue was simply that the database schema on production didn't match the code. This migration fixes that mismatch.

