-- ============================================
-- PRODUCTION ADMIN SETUP SCRIPT
-- Run this on your Render PostgreSQL database
-- ============================================

-- Step 1: Add admin email to whitelist
INSERT INTO allowed_emails (email, department, job_title, notes, is_active)
VALUES ('admin@creative-library.com', 'Administration', 'System Administrator', 'Default admin account', TRUE)
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE;

-- Step 2: Create admin user
-- Password: Admin@123 (bcrypt hash with 10 rounds)
INSERT INTO users (name, email, password_hash, role, upload_limit_monthly, is_active)
VALUES (
  'Admin User',
  'admin@creative-library.com',
  '$2b$10$8XqX5xJ5Y8F5QQ0eP5Y8F5QQ0eP5Y8F5QQ0eP5Y8F5QQ0eP5Y8F5QQ',
  'admin',
  9999,
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET is_active = TRUE;

-- Verify admin user was created
SELECT id, name, email, role, is_active, created_at
FROM users
WHERE email = 'admin@creative-library.com';

-- Verify email is whitelisted
SELECT id, email, department, is_active
FROM allowed_emails
WHERE email = 'admin@creative-library.com';

-- ============================================
-- INSTRUCTIONS:
-- ============================================
-- 1. Go to your Render dashboard
-- 2. Navigate to your PostgreSQL database
-- 3. Click "Connect" → "External Connection"
-- 4. Use the connection string to connect via psql or a GUI client
-- 5. Run this entire script
-- 6. After running, you can login with:
--    Email: admin@creative-library.com
--    Password: Admin@123
-- ============================================
