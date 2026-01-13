-- Migration: Add Notifications System
-- Date: 2026-01-14
-- Description: Adds notifications table for @ mentions and other events

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'mention', 'request_assigned', 'file_uploaded', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50), -- 'canvas', 'file_request', 'media_file', etc.
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Rollback script (if needed):
-- DROP INDEX IF EXISTS idx_notifications_created;
-- DROP INDEX IF EXISTS idx_notifications_reference;
-- DROP INDEX IF EXISTS idx_notifications_type;
-- DROP INDEX IF EXISTS idx_notifications_unread;
-- DROP INDEX IF EXISTS idx_notifications_user;
-- DROP TABLE IF EXISTS notifications;
