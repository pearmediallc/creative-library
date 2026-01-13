#!/usr/bin/env node

/**
 * Canvas Migration Script
 * Run this in Render shell to create the file_request_canvas table
 *
 * Usage:
 *   node scripts/run-canvas-migration.js
 */

const { Pool } = require('pg');
const path = require('path');

// Use DATABASE_URL from environment (automatically available in Render)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not found');
  console.error('Make sure you are running this in the Render environment');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const MIGRATION_SQL = `
-- Migration: Add Canvas/Product Brief feature for File Requests
-- Date: 2026-01-13
-- Description: Adds file_request_canvas table for rich text briefs with attachments

-- Create canvas table
CREATE TABLE IF NOT EXISTS file_request_canvas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_request_id UUID NOT NULL REFERENCES file_requests(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{"blocks": []}',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(file_request_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_canvas_request ON file_request_canvas(file_request_id);
CREATE INDEX IF NOT EXISTS idx_canvas_content ON file_request_canvas USING GIN(content);
CREATE INDEX IF NOT EXISTS idx_canvas_attachments ON file_request_canvas USING GIN(attachments);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_canvas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_canvas_timestamp
BEFORE UPDATE ON file_request_canvas
FOR EACH ROW
EXECUTE FUNCTION update_canvas_updated_at();
`;

async function runMigration() {
  console.log('🚀 Starting Canvas Migration...\n');
  console.log('📊 Database:', DATABASE_URL.split('@')[1]?.split('/')[0] || 'Unknown');
  console.log('');

  let client;

  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected successfully\n');

    // Check if table already exists
    console.log('🔍 Checking if table already exists...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'file_request_canvas'
      );
    `);

    const tableExists = checkResult.rows[0].exists;

    if (tableExists) {
      console.log('⚠️  Table file_request_canvas already exists');
      console.log('');

      // Show table info
      const countResult = await client.query('SELECT COUNT(*) FROM file_request_canvas');
      console.log(`📋 Current records: ${countResult.rows[0].count}`);
      console.log('');
      console.log('✨ Migration not needed - table already exists');
      console.log('');
      return;
    }

    console.log('✅ Table does not exist - proceeding with migration\n');

    // Run migration
    console.log('📝 Creating file_request_canvas table...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Table created successfully\n');

    // Verify creation
    console.log('🔍 Verifying migration...');

    const verifyTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'file_request_canvas'
    `);

    if (verifyTable.rows.length > 0) {
      console.log('✅ Table file_request_canvas verified\n');
    } else {
      throw new Error('Table creation verification failed');
    }

    // Check indexes
    const verifyIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'file_request_canvas'
    `);

    console.log(`✅ Indexes created: ${verifyIndexes.rows.length}`);
    verifyIndexes.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });
    console.log('');

    // Check trigger
    const verifyTrigger = await client.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'file_request_canvas'
    `);

    if (verifyTrigger.rows.length > 0) {
      console.log('✅ Trigger created successfully');
      verifyTrigger.rows.forEach(row => {
        console.log(`   - ${row.trigger_name}`);
      });
    }
    console.log('');

    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('✨ The Canvas feature is now ready to use');
    console.log('✨ The "Failed to load canvas" error should be resolved');
    console.log('');

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED!\n');
    console.error('Error:', error.message);
    console.error('');

    if (error.code) {
      console.error('Error Code:', error.code);
    }

    if (error.detail) {
      console.error('Details:', error.detail);
    }

    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);

    process.exit(1);

  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
