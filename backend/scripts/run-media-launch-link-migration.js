/**
 * Migration: Add launch_request_upload_id to media_files
 * Run once after deploying the launch request media folder provisioning feature.
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting media_files launch request link migration...\n');
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/20260218_02_media_files_launch_request_link.sql'),
      'utf8'
    );
    await query(sql);
    console.log('✅ Migration completed: launch_request_upload_id column added to media_files');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
