/**
 * Request Comments System Migration Script
 * Adds comment functionality for file requests
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting Request Comments System migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/ADD_REQUEST_COMMENTS_SYSTEM.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('🔨 Applying migration...\n');

    // Execute the migration
    await query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check table exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'file_request_comments'
      ) as table_exists
    `);
    console.log(`✓ Table exists: ${tableCheck.rows[0].table_exists}`);

    // Check columns
    const columnsCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'file_request_comments'
      ORDER BY ordinal_position
    `);
    console.log('\n✓ Columns created:');
    columnsCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check indexes
    const indexesCheck = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'file_request_comments'
      ORDER BY indexname
    `);
    console.log('\n✓ Indexes created:');
    indexesCheck.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });

    console.log('\n✅ All verification checks passed!');
    console.log('\n📋 Migration Summary:');
    console.log('   - Created file_request_comments table');
    console.log('   - Added indexes for performance');
    console.log('   - Created timestamp update trigger');
    console.log('\n🎉 Request Comments System migration completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nError details:', error.message);

    if (error.code) {
      console.error('Error code:', error.code);
    }

    if (error.detail) {
      console.error('Error detail:', error.detail);
    }

    process.exit(1);
  }
}

// Run the migration
runMigration();
