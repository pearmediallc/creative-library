/**
 * Migration Runner: Notification Preferences
 * Adds browser notification and sound preferences to users table
 */

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database').pool;

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/20260219_04_notification_preferences.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('🚀 Running notification preferences migration...\n');

  try {
    await pool.query(sql);
    console.log('\n✅ Notification preferences migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

runMigration();
