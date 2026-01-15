#!/usr/bin/env node

/**
 * Critical Database Migration Script
 * Run this on Render shell with: node backend/migrations/run-critical-fix.js
 *
 * This script fixes:
 * 1. Rename team_members.role → team_members.team_role
 * 2. Add comments column to file_request_uploads
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
    console.log('✅ Connected to database');

    console.log('\n📋 Starting migration...\n');

    // Begin transaction
    await client.query('BEGIN');

    // Fix 1: Rename role to team_role in team_members
    console.log('🔧 Fix 1: Checking team_members.role column...');
    const roleColumnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'team_members' AND column_name = 'role'
    `);

    if (roleColumnCheck.rows.length > 0) {
      console.log('   → Column "role" exists, renaming to "team_role"...');
      await client.query('ALTER TABLE team_members RENAME COLUMN role TO team_role');
      console.log('   ✅ Column renamed: role → team_role');
    } else {
      console.log('   ℹ️  Column "team_role" already exists, skipping rename');
    }

    // Fix 2: Add comments column to file_request_uploads
    console.log('\n🔧 Fix 2: Checking file_request_uploads.comments column...');
    const commentsColumnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'file_request_uploads' AND column_name = 'comments'
    `);

    if (commentsColumnCheck.rows.length === 0) {
      console.log('   → Column "comments" does not exist, adding...');
      await client.query('ALTER TABLE file_request_uploads ADD COLUMN comments TEXT');
      console.log('   ✅ Column "comments" added successfully');
    } else {
      console.log('   ℹ️  Column "comments" already exists, skipping');
    }

    // Verify changes
    console.log('\n🔍 Verifying changes...');

    const teamRoleExists = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'team_members' AND column_name = 'team_role'
    `);

    const commentsExists = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'file_request_uploads' AND column_name = 'comments'
    `);

    if (teamRoleExists.rows.length > 0 && commentsExists.rows.length > 0) {
      console.log('   ✅ team_members.team_role exists');
      console.log('   ✅ file_request_uploads.comments exists');
      console.log('\n✅ All columns verified successfully!\n');

      // Commit transaction
      await client.query('COMMIT');
      console.log('✅ Migration committed successfully\n');

      // Show summary
      console.log('📊 MIGRATION SUMMARY:');
      console.log('   • team_members.role → team_members.team_role ✅');
      console.log('   • file_request_uploads.comments added ✅');
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

// Run migration
console.log('═══════════════════════════════════════════════════');
console.log('  CRITICAL DATABASE MIGRATION');
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
