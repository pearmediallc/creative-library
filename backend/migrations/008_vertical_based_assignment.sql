-- Migration: Vertical-Based Editor Assignment System
-- Purpose: Add vertical heads mapping, reassignment tracking, and template enhancements
-- Date: 2026-01-27

-- 1. Create vertical_heads table for mapping verticals to head editors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vertical_heads') THEN
    CREATE TABLE vertical_heads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      vertical VARCHAR(50) NOT NULL UNIQUE,
      head_editor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      fallback_editor_ids UUID[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX idx_vertical_heads_vertical ON vertical_heads(vertical);
    CREATE INDEX idx_vertical_heads_head_editor ON vertical_heads(head_editor_id);
  END IF;
END $$;

-- 2. Seed vertical heads data with default assignments
DO $$
DECLARE
  aditya_id UUID;
  priya_id UUID;
  baljeet_id UUID;
  pankaj_id UUID;
  karan_id UUID;
  ritu_id UUID;
  parmeet_id UUID;
BEGIN
  -- Get user IDs by name (case-insensitive)
  SELECT id INTO aditya_id FROM users WHERE LOWER(name) = 'aditya' LIMIT 1;
  SELECT id INTO priya_id FROM users WHERE LOWER(name) = 'priya' LIMIT 1;
  SELECT id INTO baljeet_id FROM users WHERE LOWER(name) = 'baljeet' LIMIT 1;
  SELECT id INTO pankaj_id FROM users WHERE LOWER(name) = 'pankaj' LIMIT 1;
  SELECT id INTO karan_id FROM users WHERE LOWER(name) = 'karan' LIMIT 1;
  SELECT id INTO ritu_id FROM users WHERE LOWER(name) = 'ritu' LIMIT 1;
  SELECT id INTO parmeet_id FROM users WHERE LOWER(name) = 'parmeet' LIMIT 1;

  -- Insert vertical head mappings (only if user exists)
  IF aditya_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('bizop', aditya_id)
    ON CONFLICT (vertical) DO UPDATE SET head_editor_id = aditya_id;
  END IF;

  IF priya_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('auto', priya_id)
    ON CONFLICT (vertical) DO UPDATE SET head_editor_id = priya_id;
  END IF;

  IF baljeet_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('home', baljeet_id)
    ON CONFLICT (vertical) DO UPDATE SET head_editor_id = baljeet_id;
  END IF;

  IF pankaj_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('guns', pankaj_id)
    ON CONFLICT (vertical) DO UPDATE SET head_editor_id = pankaj_id;
  END IF;

  IF karan_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('refi', karan_id)
    ON CONFLICT (vertical) DO UPDATE SET head_editor_id = karan_id;
  END IF;

  IF ritu_id IS NOT NULL THEN
    INSERT INTO vertical_heads (vertical, head_editor_id)
    VALUES ('mediacare', ritu_id)
    ON CONFLICT (vertical) DO UPDATE SET head_editor_id = ritu_id;
  END IF;

  -- Set fallback editors (Parmeet and Ritu) for all verticals
  IF parmeet_id IS NOT NULL AND ritu_id IS NOT NULL THEN
    UPDATE vertical_heads SET fallback_editor_ids = ARRAY[parmeet_id, ritu_id]::UUID[];
  ELSIF parmeet_id IS NOT NULL THEN
    UPDATE vertical_heads SET fallback_editor_ids = ARRAY[parmeet_id]::UUID[];
  ELSIF ritu_id IS NOT NULL THEN
    UPDATE vertical_heads SET fallback_editor_ids = ARRAY[ritu_id]::UUID[];
  END IF;
END $$;

-- 3. Create request_reassignments table for tracking reassignment history
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'request_reassignments') THEN
    CREATE TABLE request_reassignments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
      reassigned_from UUID NOT NULL REFERENCES users(id),
      reassigned_to UUID NOT NULL REFERENCES users(id),
      reassignment_note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE INDEX idx_reassignments_request ON request_reassignments(file_request_id);
    CREATE INDEX idx_reassignments_to ON request_reassignments(reassigned_to);
    CREATE INDEX idx_reassignments_from ON request_reassignments(reassigned_from);
    CREATE INDEX idx_reassignments_created ON request_reassignments(created_at);
  END IF;
END $$;

-- 4. Add vertical assignment columns to file_requests
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='auto_assigned_head') THEN
    ALTER TABLE file_requests ADD COLUMN auto_assigned_head UUID REFERENCES users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='file_requests' AND column_name='reassignment_count') THEN
    ALTER TABLE file_requests ADD COLUMN reassignment_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 5. Add missing fields to request_templates for full file request compatibility
DO $$
BEGIN
  -- Add request_type field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_request_type') THEN
    ALTER TABLE request_templates ADD COLUMN default_request_type VARCHAR(255);
  END IF;

  -- Add platform field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_platform') THEN
    ALTER TABLE request_templates ADD COLUMN default_platform VARCHAR(100);
  END IF;

  -- Add vertical field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_vertical') THEN
    ALTER TABLE request_templates ADD COLUMN default_vertical VARCHAR(100);
  END IF;

  -- Add num_creatives field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_num_creatives') THEN
    ALTER TABLE request_templates ADD COLUMN default_num_creatives INTEGER DEFAULT 1;
  END IF;

  -- Add folder_id field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_folder_id') THEN
    ALTER TABLE request_templates ADD COLUMN default_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
  END IF;

  -- Add allow_multiple_uploads field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_allow_multiple_uploads') THEN
    ALTER TABLE request_templates ADD COLUMN default_allow_multiple_uploads BOOLEAN DEFAULT true;
  END IF;

  -- Add require_email field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_require_email') THEN
    ALTER TABLE request_templates ADD COLUMN default_require_email BOOLEAN DEFAULT false;
  END IF;

  -- Add custom_message field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_custom_message') THEN
    ALTER TABLE request_templates ADD COLUMN default_custom_message TEXT;
  END IF;

  -- Add assigned_editor_ids field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_assigned_editor_ids') THEN
    ALTER TABLE request_templates ADD COLUMN default_assigned_editor_ids UUID[] DEFAULT '{}';
  END IF;

  -- Add assigned_buyer_id field
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='request_templates' AND column_name='default_assigned_buyer_id') THEN
    ALTER TABLE request_templates ADD COLUMN default_assigned_buyer_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_requests_auto_assigned_head ON file_requests(auto_assigned_head);
CREATE INDEX IF NOT EXISTS idx_file_requests_reassignment_count ON file_requests(reassignment_count);
