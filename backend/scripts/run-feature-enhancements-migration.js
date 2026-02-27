/**
 * Migration Runner: Feature Enhancements
 * Adds new features including starred media, analytics, edit history, and permissions
 */

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database').pool;

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/20260227_01_feature_enhancements.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('🚀 Running feature enhancements migration...\n');

  try {
    // Execute the entire migration as a single transaction
    await pool.query(sql);

    console.log('✅ All migration statements executed successfully!\n');

    console.log('\n✅ Feature enhancements migration completed successfully!');
    console.log('\nNew features added:');
    console.log('  - Starred/high-performer media files');
    console.log('  - Analytics metrics for creative performance and profitability');
    console.log('  - Per-editor reassignment notes');
    console.log('  - View all requests permission for Ritu and Parmeet');
    console.log('  - Scheduled auto-close for launch requests');
    console.log('  - Edit history tracking for file and launch requests');
    console.log('  - Enhanced search indexes for media files');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

runMigration();
