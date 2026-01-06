# 🚀 Run Migration on Render PostgreSQL

## The Issue
Your production database is missing columns that the code requires:
- ❌ `column "metadata_stripped" of relation "media_files" does not exist`
- ❌ `column "password_changed_by" of relation "users" does not exist`

## The Fix (3 Simple Steps)

### Step 1: Go to Render PostgreSQL Dashboard

1. Open: https://dashboard.render.com
2. Click on your PostgreSQL service: **creative_library** (or similar name)
3. Click the **"Shell"** tab at the top

You should see a terminal/console interface.

---

### Step 2: Copy & Paste the Migration SQL

Open the file `COMPLETE_PRODUCTION_MIGRATION.sql` and copy **ALL** of it.

Then paste it into the Render Shell and press Enter.

**That's it!** The migration will run automatically.

---

### Step 3: Verify Success

You should see output ending with:

```
NOTICE:  ✅ All required columns and tables exist!
COMMIT
```

If you see this, **you're done!** Production is fixed.

---

## What This Migration Does

✅ Adds `metadata_stripped`, `metadata_embedded`, `metadata_operations` to `media_files` table
✅ Adds `password_changed_by`, `password_changed_at` to `users` table
✅ Creates `password_audit_log` table for tracking admin actions
✅ Adds all necessary indexes for performance
✅ Verifies everything was created successfully

---

## After Migration - Test Production

Go to: https://creative-library-frontend.onrender.com

Test these features (they should all work now):

### 1. **File Upload** ✅
- Go to Upload page
- Upload any image/video
- Should work without "metadata_stripped" error

### 2. **Create User** ✅
- Admin Panel → Users → Add New User
- Enter any name and email
- Should work without "validation failed" error

### 3. **Password Reset** ✅
- Admin Panel → Users → Click Key icon next to any user
- Enter your admin password
- Enter new password for the user
- Should work without "password_changed_by" error

### 4. **Facebook Integration** ✅
- Try connecting Facebook account
- Fetch ad accounts
- Fetch campaigns
- Should all work properly

---

## Troubleshooting

### "ERROR: relation 'media_files' does not exist"

**Cause:** Your production database doesn't have the base schema yet.

**Fix:** You need to run the schema creation first. Check if you have a `schema.sql` file or run the initial database setup.

---

### "ERROR: column already exists"

**Cause:** Some columns were already created in a previous attempt.

**Fix:** This is OKAY! The script uses `IF NOT EXISTS` so it's safe. Just check the final verification output shows all columns exist.

---

### "Connection refused" or timeout

**Cause:** Cannot connect from local machine.

**Fix:** Use Render Shell (Step 1 above) instead of trying to connect from your computer.

---

## Alternative: Run from Your Computer (if IP whitelisted)

If you've already whitelisted your IP in Render:

```bash
cd /Users/mac/Desktop/creative-library

psql "postgresql://creative_library_user:dhEneE0oJmdC7hBJ0KQvQ85t9PECO5Uo@dpg-d45o9463jp1c73dma5sg-a.oregon-postgres.render.com/creative_library" -f COMPLETE_PRODUCTION_MIGRATION.sql
```

Otherwise, use Render Shell method (Step 1-3 above).

---

## Summary

1. **Go to**: Render Dashboard → PostgreSQL → Shell tab
2. **Copy**: All of `COMPLETE_PRODUCTION_MIGRATION.sql`
3. **Paste**: Into Render Shell and press Enter
4. **Look for**: `✅ All required columns and tables exist!`
5. **Test**: Production site should work now!

**Estimated time:** 2 minutes

---

## 🎉 After This

Your production will be fully functional:
- ✅ File uploads working
- ✅ User creation working
- ✅ Password reset working
- ✅ Admin panel fully functional
- ✅ All features operational

The code was already deployed in commit `aa7b492`, it just needed the database schema to catch up!
