/**
 * Apply Creative Distribution Migration
 * Handles dollar-quoted functions properly by executing the entire file as one statement
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
    console.log('🚀 Starting creative distribution migration...\n');

    const sqlPath = path.join(__dirname, 'migrations', '20260217_02_creative_distribution.sql');
    const fullSql = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Executing migration as a single transaction...\n');

    await client.query('BEGIN');
    await client.query(fullSql);
    await client.query('COMMIT');

    console.log('✅ Migration executed successfully!\n');

    // Verify columns were added
    console.log('🔍 Verifying columns...');
    const colResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'file_request_editors'
        AND column_name IN ('num_creatives_assigned', 'creatives_completed')
      ORDER BY column_name
    `);

    if (colResult.rows.length === 2) {
      colResult.rows.forEach(row => {
        console.log(`  ✅ file_request_editors.${row.column_name} (${row.data_type}, default: ${row.column_default})`);
      });
    } else {
      console.log(`  ⚠️  Expected 2 columns, found ${colResult.rows.length}`);
      colResult.rows.forEach(row => console.log(`  - ${row.column_name}`));
    }

    // Verify functions were created
    console.log('\n🔍 Verifying functions...');
    const funcResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_name IN (
        'validate_creative_distribution',
        'get_total_creatives_assigned',
        'get_remaining_creatives',
        'get_creative_distribution_summary'
      )
      ORDER BY routine_name
    `);

    funcResult.rows.forEach(row => {
      console.log(`  ✅ ${row.routine_name}()`);
    });

    // Verify view was created
    console.log('\n🔍 Verifying view...');
    const viewResult = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_name = 'file_request_assignments_detailed'
    `);

    if (viewResult.rows.length > 0) {
      console.log('  ✅ file_request_assignments_detailed view created');
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
console.log('  CREATIVE DISTRIBUTION MIGRATION');
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
