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
    // Split by semicolon and execute each statement separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.toLowerCase().startsWith('select')) {
        // Display result for SELECT statements
        const result = await pool.query(statement);
        console.log('\n📊 Migration Verification:');
        console.table(result.rows);
      } else {
        // Execute other statements
        await pool.query(statement);
        const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
        console.log(`✅ Executed: ${preview}...`);
      }
    }

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
