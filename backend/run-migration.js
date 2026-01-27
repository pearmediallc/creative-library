/**
 * Migration Runner Script
 * Run with: node run-migration.js 007
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function runMigration(migrationNumber) {
  try {
    const migrationFile = path.join(__dirname, 'migrations', `${migrationNumber}_file_request_enhancements.sql`);

    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ Migration file not found: ${migrationFile}`);
      process.exit(1);
    }

    console.log(`📄 Reading migration file: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('🚀 Running migration...');
    console.log('SQL Preview:');
    console.log(sql.substring(0, 500) + '...\n');

    await query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying changes...');

    // Verify the changes
    const statusCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'file_requests'
        AND column_name IN ('status', 'uploaded_at', 'launched_at', 'closed_at', 'reopened_at')
      ORDER BY column_name
    `);

    console.log('\n✓ New columns in file_requests table:');
    statusCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    const tableCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'file_request_uploads'
    `);

    if (tableCheck.rows.length > 0) {
      console.log('\n✓ file_request_uploads table created');
    }

    const indexCheck = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('file_requests', 'file_request_uploads')
        AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);

    console.log('\n✓ Indexes created:');
    indexCheck.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });

    console.log('\n🎉 Migration verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Get migration number from command line
const migrationNumber = process.argv[2] || '007';

console.log(`\n🔧 Starting migration ${migrationNumber}...\n`);
runMigration(migrationNumber);
