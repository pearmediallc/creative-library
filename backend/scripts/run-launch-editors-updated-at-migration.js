/**
 * Migration: Add updated_at to launch_request_editors
 * Run once to add the updated_at column required by assignEditors functionality
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting launch_request_editors updated_at migration...\n');
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/20260219_02_launch_request_editors_updated_at.sql'),
      'utf8'
    );
    await query(sql);
    console.log('✅ Migration completed: updated_at column added to launch_request_editors');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
