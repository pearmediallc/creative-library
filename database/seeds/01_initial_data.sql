-- ============================================
-- INITIAL DATA SEED
-- ============================================

-- Insert Initial Editors (from metadata tagger)
INSERT INTO editors (name, display_name) VALUES
  ('DEEP', 'Deep'),
  ('DEEPA', 'Deepa'),
  ('DEEPANSHU', 'Deepanshu'),
  ('DEEPANSHUVERMA', 'Deepanshu Verma')
ON CONFLICT (name) DO NOTHING;

-- Insert Default Admin User
-- Password: Admin@123 (CHANGE THIS IN PRODUCTION!)
-- Generated with bcrypt rounds=10
INSERT INTO users (name, email, password_hash, role, upload_limit_monthly) VALUES
  ('Admin User', 'admin@creative-library.com', '$2b$10$rKvI8d5qhZ5xJ5Y8F5QQ0eP5Y8F5QQ0eP5Y8F5QQ0eP5Y8F5QQ0eP', 'admin', 9999)
ON CONFLICT (email) DO NOTHING;

-- Note: The password hash above is a placeholder
-- You should generate a real hash or set it via the API after deployment

COMMENT ON TABLE editors IS 'Seeded with initial 4 editors from metadata tagger system';
