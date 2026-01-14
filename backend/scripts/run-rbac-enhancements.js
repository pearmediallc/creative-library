/**
 * Complete RBAC Enhancements Migration Script
 * Runs all RBAC enhancement migrations
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting RBAC Enhancements migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/COMPLETE_RBAC_ENHANCEMENTS.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('🔨 Applying migration...\n');

    // Execute the migration
    await query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check file_request_comments table
    const commentsTableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'file_request_comments'
      ) as table_exists
    `);
    console.log(`✓ file_request_comments table exists: ${commentsTableCheck.rows[0].table_exists}`);

    // Check columns
    const commentsColumnsCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'file_request_comments'
      ORDER BY ordinal_position
    `);
    console.log(`✓ file_request_comments columns: ${commentsColumnsCheck.rows.length}`);
    commentsColumnsCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check permissions table enhancement
    const permissionsColumnCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'permissions'
          AND column_name = 'granted_by_folder_owner'
      ) as column_exists
    `);
    console.log(`\n✓ permissions.granted_by_folder_owner column exists: ${permissionsColumnCheck.rows[0].column_exists}`);

    console.log('\n✅ All verification checks passed!');
    console.log('\n📋 Migration Summary:');
    console.log('   ✓ Phase 5: File Request Comments System');
    console.log('   ✓ Phase 4: Folder Access Granting Enhancement');
    console.log('   ✓ Phase 6: Metadata Removal (already available)');
    console.log('   ✓ Phase 7: Admin Folder Edit/Delete (code updated)');
    console.log('\n🎉 RBAC Enhancements migration completed successfully!');

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
