/**
 * Launch Requests Migration Script
 * Creates all tables for the Launch Requests feature
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting Launch Requests migration...\n');

  try {
    const migrationPath = path.join(__dirname, '../migrations/20260218_01_launch_requests.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded');
    console.log('📊 Running migration...\n');

    await query(sql);

    console.log('✅ Migration completed!\n');

    // Verify
    const tables = [
      'launch_requests',
      'launch_request_platforms',
      'launch_request_verticals',
      'launch_request_editors',
      'launch_request_buyers',
      'launch_request_uploads',
      'launch_request_reassignments',
      'launch_request_templates'
    ];

    for (const table of tables) {
      const check = await query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`✓ ${table}: OK (${check.rows[0].count} rows)`);
    }

    console.log('\n🎉 Launch Requests migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) console.error('Code:', error.code);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  }
}

runMigration();
