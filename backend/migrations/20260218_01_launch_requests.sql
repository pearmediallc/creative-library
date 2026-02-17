-- ============================================================
-- Launch Requests System
-- Creative Strategist → Creative Head + Buyer Head → Buyers
-- ============================================================

-- Core launch requests table
CREATE TABLE IF NOT EXISTS launch_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(255),           -- auto-generated from request_type if blank
  request_type          VARCHAR(100),           -- e.g. "UGC", "Motion", "Static"
  concept_notes         TEXT,                   -- strategist's brief
  num_creatives         INTEGER DEFAULT 1,      -- how many creatives will be provided
  suggested_run_qty     INTEGER,                -- how many the buyer should test/run
  notes_to_creative     TEXT,                   -- strategist → creative head
  notes_to_buyer        TEXT,                   -- strategist → buyer head

  -- platforms & verticals stored in junction tables (same pattern as file_requests)
  -- primary vertical for display convenience
  primary_vertical      VARCHAR(100),

  -- delivery & test deadlines
  delivery_deadline     TIMESTAMP,              -- when creatives will be ready
  test_deadline         TIMESTAMP,              -- when buyer should have tested

  -- folder for uploads (mirrors file_requests)
  folder_id             UUID REFERENCES folders(id) ON DELETE SET NULL,
  folder_name           VARCHAR(255),           -- snapshot of folder name at creation

  -- status lifecycle
  status                VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- draft | pending_review | in_production | ready_to_launch | buyer_assigned | launched | closed | reopened

  -- who created it
  created_by            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by_name       VARCHAR(255),           -- snapshot

  -- assigned creative head (reassignable)
  creative_head_id      UUID REFERENCES users(id) ON DELETE SET NULL,

  -- assigned buyer head (reassignable)
  buyer_head_id         UUID REFERENCES users(id) ON DELETE SET NULL,

  -- buyer commitment fields (filled in by buyer head)
  committed_run_qty     INTEGER,
  committed_test_deadline TIMESTAMP,

  -- template support
  save_as_template      BOOLEAN DEFAULT FALSE,
  template_name         VARCHAR(255),

  -- timestamps
  submitted_at          TIMESTAMP,
  accepted_at           TIMESTAMP,
  ready_at              TIMESTAMP,
  buyer_assigned_at     TIMESTAMP,
  launched_at           TIMESTAMP,
  closed_at             TIMESTAMP,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- Platforms for launch requests (same pattern as file_request_platforms)
CREATE TABLE IF NOT EXISTS launch_request_platforms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  platform          VARCHAR(100) NOT NULL,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Verticals for launch requests
CREATE TABLE IF NOT EXISTS launch_request_verticals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  vertical          VARCHAR(100) NOT NULL,
  is_primary        BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Editors assigned on the creative side (mirrors file_request_editors)
CREATE TABLE IF NOT EXISTS launch_request_editors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id       UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  editor_id               UUID NOT NULL REFERENCES editors(id) ON DELETE CASCADE,
  num_creatives_assigned  INTEGER DEFAULT 0,
  creatives_completed     INTEGER DEFAULT 0,
  status                  VARCHAR(50) DEFAULT 'pending',
  assigned_at             TIMESTAMP DEFAULT NOW(),
  completed_at            TIMESTAMP,
  UNIQUE (launch_request_id, editor_id),
  CONSTRAINT lr_creatives_non_negative CHECK (num_creatives_assigned >= 0),
  CONSTRAINT lr_completed_lte_assigned CHECK (creatives_completed <= num_creatives_assigned)
);

-- Media buyers assigned on the buyer side (buyer head assigns files + deadline per buyer)
CREATE TABLE IF NOT EXISTS launch_request_buyers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  buyer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_file_ids UUID[],                     -- array of file IDs selected from uploads
  run_qty           INTEGER,                    -- how many this buyer should run
  test_deadline     TIMESTAMP,
  status            VARCHAR(50) DEFAULT 'assigned', -- assigned | launched | done
  assigned_at       TIMESTAMP DEFAULT NOW(),
  launched_at       TIMESTAMP,
  UNIQUE (launch_request_id, buyer_id)
);

-- Uploaded creatives for launch requests (mirrors file_request_uploads)
CREATE TABLE IF NOT EXISTS launch_request_uploads (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  file_id           UUID REFERENCES media_files(id) ON DELETE SET NULL,
  uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  editor_id         UUID REFERENCES editors(id) ON DELETE SET NULL,
  original_filename VARCHAR(500),
  s3_key            VARCHAR(1000),
  s3_url            TEXT,
  file_size         BIGINT,
  mime_type         VARCHAR(100),
  comments          TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Reassignment history
CREATE TABLE IF NOT EXISTS launch_request_reassignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  reassigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  reassign_type     VARCHAR(20) DEFAULT 'creative', -- 'creative' | 'buyer'
  from_name         VARCHAR(255),
  to_name           VARCHAR(255),
  reason            TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- Templates for launch requests (same pattern as existing templates)
CREATE TABLE IF NOT EXISTS launch_request_templates (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by                UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                      VARCHAR(255) NOT NULL,
  default_request_type      VARCHAR(100),
  default_platforms         TEXT[],
  default_verticals         TEXT[],
  default_num_creatives     INTEGER,
  default_suggested_run_qty INTEGER,
  default_concept_notes     TEXT,
  default_notes_to_creative TEXT,
  default_notes_to_buyer    TEXT,
  is_active                 BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

-- Canvas Brief for launch requests (same pattern as file_request_canvas)
CREATE TABLE IF NOT EXISTS launch_request_canvas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_request_id UUID NOT NULL REFERENCES launch_requests(id) ON DELETE CASCADE,
  content           JSONB NOT NULL DEFAULT '[]',
  attachments       JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (launch_request_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_launch_requests_created_by ON launch_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_launch_requests_status ON launch_requests(status);
CREATE INDEX IF NOT EXISTS idx_launch_requests_creative_head ON launch_requests(creative_head_id);
CREATE INDEX IF NOT EXISTS idx_launch_requests_buyer_head ON launch_requests(buyer_head_id);
CREATE INDEX IF NOT EXISTS idx_launch_request_platforms_req ON launch_request_platforms(launch_request_id);
CREATE INDEX IF NOT EXISTS idx_launch_request_verticals_req ON launch_request_verticals(launch_request_id);
CREATE INDEX IF NOT EXISTS idx_launch_request_editors_req ON launch_request_editors(launch_request_id);
CREATE INDEX IF NOT EXISTS idx_launch_request_buyers_req ON launch_request_buyers(launch_request_id);
CREATE INDEX IF NOT EXISTS idx_launch_request_uploads_req ON launch_request_uploads(launch_request_id);
