#!/usr/bin/env node

/**
 * Quick Script to Create Editor Records for Creative Users
 * Run with: node run-editor-records-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       CREATE EDITOR RECORDS FOR CREATIVE USERS                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const migrationPath = path.join(__dirname, 'migrations', '20260211_ensure_creative_users_have_editor_records.sql');

  if (!fs.existsSync(migrationPath)) {
    console.error('❌ ERROR: Migration file not found at:', migrationPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  const client = await pool.connect();

  try {
    console.log('🚀 Running migration...\n');

    // Execute the migration
    await client.query(sql);

    console.log('\n✅ SUCCESS: Editor records created!\n');

    // Verify the results
    console.log('🔍 Verification:\n');

    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'creative') as total_creative,
        (SELECT COUNT(*) FROM editors) as total_editors,
        (SELECT COUNT(*) FROM users u
         LEFT JOIN editors e ON e.user_id = u.id
         WHERE u.role = 'creative' AND e.id IS NULL) as missing_editors
    `);

    console.log(`✓ Total creative users: ${stats.rows[0].total_creative}`);
    console.log(`✓ Total editor records: ${stats.rows[0].total_editors}`);
    console.log(`✓ Creative users missing editors: ${stats.rows[0].missing_editors}\n`);

    // Show all creative users with editor status
    const users = await client.query(`
      SELECT
        u.name,
        u.email,
        e.id as editor_id,
        e.is_active,
        CASE
          WHEN e.id IS NULL THEN '❌ NO EDITOR'
          WHEN e.is_active THEN '✅ ACTIVE'
          ELSE '⚠️ INACTIVE'
        END as status
      FROM users u
      LEFT JOIN editors e ON e.user_id = u.id
      WHERE u.role = 'creative'
      ORDER BY u.name
    `);

    console.log('📋 Creative Users & Editor Status:\n');
    users.rows.forEach(user => {
      console.log(`  ${user.status} ${user.name} (${user.email})`);
    });

    console.log('\n✅ MIGRATION COMPLETED SUCCESSFULLY!\n');
    console.log('📋 Next Steps:');
    console.log('  1. Restart the Railway backend service');
    console.log('  2. Create a new file request with a vertical (e.g., "Home Insurance")');
    console.log('  3. Verify the vertical head (e.g., Baljeet) is auto-assigned');
    console.log('  4. Check that "Request To" column shows the vertical head name\n');

  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
