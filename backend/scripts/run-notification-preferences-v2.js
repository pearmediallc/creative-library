/**
 * Migration Runner: Notification Preferences V2 (Fixed)
 * Adds browser notification and sound preferences to users table
 */

const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database').pool;

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/20260219_04_notification_preferences_v2.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  console.log('🚀 Running notification preferences migration (V2 - Fixed)...\n');

  try {
    // Split by semicolon and execute each statement separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().startsWith('select')) {
        // Display result for SELECT statements
        const result = await pool.query(statement);
        console.log('\n📊 Current user notification settings:');
        console.table(result.rows);
      } else {
        // Execute other statements
        await pool.query(statement);
        console.log(`✅ Executed: ${statement.substring(0, 60)}...`);
      }
    }

    console.log('\n✅ Notification preferences migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }
}

runMigration();
