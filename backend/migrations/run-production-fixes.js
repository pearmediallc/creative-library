#!/usr/bin/env node

/**
 * Production Fixes Migration Script
 * Run this on Render shell: node backend/migrations/run-production-fixes.js
 */

const { Pool } = require('pg');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  let client;

  try {
    console.log('🔄 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Connected to database\n');

    console.log('📋 Starting production fixes migration...\n');

    await client.query('BEGIN');

    // Fix 1: Add team_id to folders (if missing in production)
    console.log('🔧 Fix 1: Checking folders table schema...');

    const teamIdCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'folders' AND column_name = 'team_id'
    `);

    if (teamIdCheck.rows.length === 0) {
      console.log('   → Adding team_id column...');
      await client.query(`
        ALTER TABLE folders
        ADD COLUMN team_id UUID REFERENCES teams(id)
      `);
      console.log('   ✅ team_id column added');
    } else {
      console.log('   ℹ️  team_id column already exists');
    }

    const ownershipCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'folders' AND column_name = 'ownership_type'
    `);

    if (ownershipCheck.rows.length === 0) {
      console.log('   → Adding ownership_type column...');
      await client.query(`
        ALTER TABLE folders
        ADD COLUMN ownership_type VARCHAR(20) DEFAULT 'user'
          CHECK (ownership_type IN ('user', 'team'))
      `);
      console.log('   ✅ ownership_type column added');
    } else {
      console.log('   ℹ️  ownership_type column already exists');
    }
    console.log('');

    // Create indexes
    console.log('🔧 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_folders_team_id ON folders(team_id) WHERE team_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_folders_team_count ON folders(team_id) WHERE team_id IS NOT NULL
    `);
    console.log('   ✅ Indexes created\n');

    // Fix 2: Clean up saved_searches filters
    console.log('🔧 Fix 2: Cleaning up saved_searches filters...');
    const invalidFilters = await client.query(`
      SELECT id, name, filters
      FROM saved_searches
      WHERE filters::text LIKE '%[object Object]%'
    `);

    if (invalidFilters.rows.length > 0) {
      console.log(`   ⚠️  Found ${invalidFilters.rows.length} saved searches with invalid filters`);
      await client.query(`
        UPDATE saved_searches
        SET filters = '{}'::jsonb
        WHERE filters::text LIKE '%[object Object]%'
      `);
      console.log('   ✅ Invalid filters cleaned up\n');
    } else {
      console.log('   ℹ️  No invalid filters found\n');
    }

    // Verify changes
    console.log('🔍 Verifying changes...');

    const teamIdExists = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'folders' AND column_name = 'team_id'
    `);

    const ownershipTypeExists = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'folders' AND column_name = 'ownership_type'
    `);

    if (teamIdExists.rows.length > 0 && ownershipTypeExists.rows.length > 0) {
      console.log('   ✅ folders.team_id exists');
      console.log('   ✅ folders.ownership_type exists\n');

      await client.query('COMMIT');
      console.log('✅ Migration committed successfully\n');

      console.log('📊 MIGRATION SUMMARY:');
      console.log('   • folders.team_id added ✅');
      console.log('   • folders.ownership_type added ✅');
      console.log('   • Indexes created ✅');
      console.log('   • Saved searches filters cleaned ✅');
      console.log('\n🎉 Migration completed successfully!\n');

    } else {
      throw new Error('Column verification failed');
    }

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
      console.error('\n❌ Migration rolled back due to error\n');
    }
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

console.log('═══════════════════════════════════════════════════');
console.log('  PRODUCTION FIXES MIGRATION');
console.log('  Date: 2026-01-15');
console.log('═══════════════════════════════════════════════════\n');

runMigration()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
