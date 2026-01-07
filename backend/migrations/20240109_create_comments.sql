-- Migration: Create Comments System with @mentions support
-- Date: 2024-01-09
-- Description: Creates file_comments and comment_reactions tables for file commenting with threading and reactions

-- Comments table
CREATE TABLE IF NOT EXISTS file_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES file_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_file_comments_file_id ON file_comments(file_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_file_comments_user_id ON file_comments(user_id);
CREATE INDEX idx_file_comments_parent ON file_comments(parent_comment_id);
CREATE INDEX idx_file_comments_created ON file_comments(created_at DESC);
CREATE INDEX idx_file_comments_resolved ON file_comments(is_resolved, file_id) WHERE deleted_at IS NULL;

-- Comment reactions table
CREATE TABLE IF NOT EXISTS comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES file_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('👍', '❤️', '😂', '😮', '👏')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(comment_id, user_id, reaction_type)
);

CREATE INDEX idx_comment_reactions_comment ON comment_reactions(comment_id);
CREATE INDEX idx_comment_reactions_user ON comment_reactions(user_id);

-- Rollback script (if needed):
-- DROP TABLE IF EXISTS comment_reactions;
-- DROP TABLE IF EXISTS file_comments;
