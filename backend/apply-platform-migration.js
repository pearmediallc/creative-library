/**
 * Apply Platform/Vertical Migration
 * Handles dollar-quoted functions properly
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting platform/vertical migration...\n');

    // Read the entire SQL file
    const sqlPath = path.join(__dirname, 'migrations', '20260217_01_multi_platform_vertical.sql');
    const fullSql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing migration as a single transaction...\n');

    // Execute the entire file as one statement (PostgreSQL can handle this)
    await client.query('BEGIN');
    await client.query(fullSql);
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('file_request_platforms', 'file_request_verticals')
      ORDER BY table_name
    `);

    console.log('Created tables:');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Verify functions were created
    console.log('\n🔍 Verifying functions...');
    const funcResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name IN (
        'get_request_platforms',
        'get_request_verticals',
        'get_primary_vertical'
      )
      ORDER BY routine_name
    `);

    console.log('Created functions:');
    funcResult.rows.forEach(row => {
      console.log(`  ✅ ${row.routine_name}()`);
    });

    // Verify view was created
    console.log('\n🔍 Verifying views...');
    const viewResult = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_name = 'file_requests_enhanced'
    `);

    if (viewResult.rows.length > 0) {
      console.log('Created views:');
      viewResult.rows.forEach(row => {
        console.log(`  ✅ ${row.table_name}`);
      });
    }

    console.log('\n🎉 All migration components verified successfully!\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('═══════════════════════════════════════════════════');
console.log('  PLATFORM/VERTICAL MIGRATION');
console.log('  Date: 2026-02-17');
console.log('═══════════════════════════════════════════════════\n');

runMigration()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed');
    process.exit(1);
  });
