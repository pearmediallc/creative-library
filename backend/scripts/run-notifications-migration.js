#!/usr/bin/env node

/**
 * Notifications Migration Script
 * Run this in Render shell to create the notifications table
 *
 * Usage:
 *   node scripts/run-notifications-migration.js
 */

const { Pool } = require('pg');

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
-- Migration: Add Notifications system for @ mentions
-- Date: 2026-01-14
-- Description: Adds notifications table for @ mentions in canvas and other notifications

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_type VARCHAR(50),
  reference_id UUID,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);
`;

async function runMigration() {
  console.log('🚀 Starting Notifications Migration...\n');
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
        AND table_name = 'notifications'
      );
    `);

    const tableExists = checkResult.rows[0].exists;

    if (tableExists) {
      console.log('⚠️  Table notifications already exists');
      console.log('');

      // Show table info
      const countResult = await client.query('SELECT COUNT(*) FROM notifications');
      console.log(`📋 Current records: ${countResult.rows[0].count}`);
      console.log('');
      console.log('✨ Migration not needed - table already exists');
      console.log('');
      return;
    }

    console.log('✅ Table does not exist - proceeding with migration\n');

    // Run migration
    console.log('📝 Creating notifications table...');
    await client.query(MIGRATION_SQL);
    console.log('✅ Table created successfully\n');

    // Verify creation
    console.log('🔍 Verifying migration...');

    const verifyTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'notifications'
    `);

    if (verifyTable.rows.length > 0) {
      console.log('✅ Table notifications verified\n');
    } else {
      throw new Error('Table creation verification failed');
    }

    // Check indexes
    const verifyIndexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'notifications'
    `);

    console.log(`✅ Indexes created: ${verifyIndexes.rows.length}`);
    verifyIndexes.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });
    console.log('');

    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('✨ The Notifications system is now ready');
    console.log('✨ @ mentions will now create notifications');
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
