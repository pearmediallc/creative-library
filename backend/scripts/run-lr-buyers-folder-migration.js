/**
 * Migration: Add media_folder_id to launch_request_buyers
 * Run once after deploying the full launch request folder provisioning feature.
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting launch_request_buyers folder migration...\n');
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/20260219_01_launch_request_buyers_folder.sql'),
      'utf8'
    );
    await query(sql);
    console.log('✅ Migration completed: media_folder_id column added to launch_request_buyers');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
