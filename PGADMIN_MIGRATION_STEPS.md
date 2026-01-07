# 🚀 Run Migration Using pgAdmin (Render Dashboard)

## You're Here: Render PostgreSQL → Apps → pgAdmin

Perfect! pgAdmin is the easiest way to run the migration.

---

## Step-by-Step Instructions

### Step 1: Deploy pgAdmin

1. Click the **"Deploy app"** button under **pgAdmin** in your Render dashboard
2. Wait for pgAdmin to deploy (takes 2-3 minutes)
3. Once deployed, click on the pgAdmin URL to open it

---

### Step 2: Login to pgAdmin

When pgAdmin opens, it will ask for credentials.

**Default credentials:**
- **Email:** `admin@admin.com`
- **Password:** `admin` (or check Render for the actual password)

---

### Step 3: Add Your PostgreSQL Server

1. In pgAdmin, click **"Add New Server"**
2. **General Tab:**
   - Name: `creative-library`

3. **Connection Tab:**
   - Host: `dpg-d45o9463jp1c73dma5sg-a` (the internal hostname)
   - Port: `5432`
   - Database: `creative_library`
   - Username: `creative_library_user`
   - Password: `dhEneE0oJmdC7hBJ0KQvQ85t9PECO5Uo`
   - Save Password: ✅ Check this

4. Click **"Save"**

---

### Step 4: Open Query Tool

1. In the left sidebar, expand: **Servers** → **creative-library** → **Databases** → **creative_library**
2. Right-click on **creative_library** database
3. Select **"Query Tool"**

This opens a SQL editor window.

---

### Step 5: Run the Migration

1. Open the file: `/Users/mac/Desktop/creative-library/COMPLETE_PRODUCTION_MIGRATION.sql`
2. Copy **ALL** the content
3. Paste it into the pgAdmin Query Tool
4. Click the **"Execute/Run"** button (▶ play icon) or press **F5**

---

### Step 6: Verify Success

You should see in the **Messages** panel:

```
NOTICE:  ✅ All required columns and tables exist!
Query returned successfully in X msec.
```

If you see this, **you're done!** 🎉

---

## Alternative: Use psql from Your Local Machine

If you prefer command line and have `psql` installed:

```bash
cd /Users/mac/Desktop/creative-library

# Using the EXTERNAL connection URL
psql "postgresql://creative_library_user:dhEneE0oJmdC7hBJ0KQvQ85t9PECO5Uo@dpg-d45o9463jp1c73dma5sg-a.oregon-postgres.render.com/creative_library" -f COMPLETE_PRODUCTION_MIGRATION.sql
```

**Note:** This might fail with timeout if your IP isn't whitelisted. pgAdmin method is more reliable.

---

## After Migration - Test Production

Go to: https://creative-library-frontend.onrender.com

Test these features:

### ✅ File Upload
- Upload any image/video
- Should work without `metadata_stripped` error

### ✅ Create User
- Admin Panel → Users → Add New User
- Should work without validation error

### ✅ Password Reset
- Admin Panel → Users → Key icon
- Should work without `password_changed_by` error

---

## Troubleshooting

### Can't find pgAdmin URL after deploying

1. Go back to Render Dashboard
2. Click on the **pgAdmin** service (should be in your services list now)
3. The URL is at the top (something like `https://pgadmin-xxx.onrender.com`)

---

### pgAdmin asks for password when connecting

Use: `dhEneE0oJmdC7hBJ0KQvQ85t9PECO5Uo`

---

### "Server doesn't exist" or connection error

Make sure you're using:
- **Internal hostname:** `dpg-d45o9463jp1c73dma5sg-a` (NOT the full .oregon-postgres.render.com)
- **Port:** 5432
- **Database:** `creative_library`

---

## Summary

1. **Deploy pgAdmin** from Render Apps
2. **Add server** with your database credentials
3. **Open Query Tool** on creative_library database
4. **Paste** COMPLETE_PRODUCTION_MIGRATION.sql
5. **Run** (press F5 or click play button)
6. **Look for:** `✅ All required columns and tables exist!`

**Estimated time:** 5 minutes

That's it! Your production will be fixed. 🚀
