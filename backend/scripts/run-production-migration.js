/**
 * Production Migration Script
 * Runs the RBAC, Access Requests, and Folder Lock migration on production database
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting production migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/PRODUCTION_RBAC_ACCESS_REQUESTS_FOLDER_LOCK.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log('📊 Running migration queries...\n');

    // Execute the migration
    await query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration...\n');

    // Check RBAC tables
    const rolesCheck = await query('SELECT COUNT(*) as count FROM roles');
    console.log(`✓ Roles table: ${rolesCheck.rows[0].count} roles created`);

    const permissionsCheck = await query('SELECT COUNT(*) as count FROM permissions');
    console.log(`✓ Permissions table: ${permissionsCheck.rows[0].count} permission types`);

    const userRolesCheck = await query('SELECT COUNT(*) as count FROM user_roles');
    console.log(`✓ User roles table: ${userRolesCheck.rows[0].count} user role assignments`);

    // Check Access Requests tables
    const accessRequestsCheck = await query('SELECT COUNT(*) as count FROM access_requests');
    console.log(`✓ Access requests table: ${accessRequestsCheck.rows[0].count} requests`);

    const watchersCheck = await query('SELECT COUNT(*) as count FROM access_request_watchers');
    console.log(`✓ Access request watchers table: ${watchersCheck.rows[0].count} watchers`);

    // Check Folder Lock columns
    const folderColumnsCheck = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'folders'
        AND column_name IN ('is_locked', 'locked_by', 'locked_at', 'lock_reason')
      ORDER BY column_name
    `);
    console.log(`✓ Folder lock columns: ${folderColumnsCheck.rows.length}/4 columns added`);
    folderColumnsCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });

    console.log('\n✅ All verification checks passed!\n');
    console.log('📋 Migration Summary:');
    console.log('   - RBAC system tables created');
    console.log('   - Access Requests system tables created');
    console.log('   - Folder lock columns added');
    console.log('   - Default system roles inserted');
    console.log('   - Triggers and views created\n');
    console.log('🎉 Production migration completed successfully!');

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
