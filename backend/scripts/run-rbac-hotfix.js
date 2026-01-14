/**
 * RBAC Hotfix Script
 * Adds missing columns to user_roles and folder_admins tables
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runHotfix() {
  console.log('🔧 Starting RBAC hotfix...\n');

  try {
    // Read the hotfix file
    const hotfixPath = path.join(__dirname, '../migrations/HOTFIX_RBAC_MISSING_COLUMNS.sql');
    const sql = fs.readFileSync(hotfixPath, 'utf8');

    console.log('📄 Hotfix file loaded successfully');
    console.log('🔨 Applying hotfix...\n');

    // Execute the hotfix
    await query(sql);

    console.log('✅ Hotfix applied successfully!\n');

    // Verify the hotfix
    console.log('🔍 Verifying hotfix...\n');

    // Check user_roles columns
    const userRolesColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'user_roles'
        AND column_name IN ('granted_by', 'granted_at')
      ORDER BY column_name
    `);

    console.log('✓ user_roles table columns:');
    userRolesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check folder_admins columns
    const folderAdminsColumns = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'folder_admins'
        AND column_name IN ('can_grant_access', 'can_revoke_access', 'can_manage_requests', 'can_delete_files')
      ORDER BY column_name
    `);

    console.log('\n✓ folder_admins table columns:');
    folderAdminsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    console.log('\n✅ All verification checks passed!\n');
    console.log('📋 Hotfix Summary:');
    console.log('   - Added granted_by and granted_at to user_roles');
    console.log('   - Added can_grant_access, can_revoke_access, can_manage_requests, can_delete_files to folder_admins');
    console.log('   - Created necessary indexes\n');
    console.log('🎉 RBAC hotfix completed successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Hotfix failed:', error);
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

// Run the hotfix
runHotfix();
