#!/usr/bin/env node
/**
 * Migration Runner Script
 * Runs SQL migration files using the app's database configuration
 *
 * Usage: node scripts/run-migration.js <migration-file-path>
 * Example: node scripts/run-migration.js migrations/20260111_workload_management.sql
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigration() {
  // Get migration file path from command line
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('❌ Error: Please provide a migration file path');
    console.error('Usage: node scripts/run-migration.js <migration-file-path>');
    console.error('Example: node scripts/run-migration.js migrations/20260111_workload_management.sql');
    process.exit(1);
  }

  // Resolve full path
  const fullPath = path.resolve(process.cwd(), migrationFile);

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Error: Migration file not found: ${fullPath}`);
    process.exit(1);
  }

  // Read migration SQL
  console.log(`📄 Reading migration file: ${fullPath}`);
  const sql = fs.readFileSync(fullPath, 'utf8');
  console.log(`✅ Migration file loaded (${sql.length} characters)`);

  // Create database connection using same config as app
  console.log('\n🔌 Connecting to database...');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false // Required for Render PostgreSQL
    } : false
  });

  try {
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log(`✅ Connected to database at: ${result.rows[0].now}`);
    client.release();

    // Run migration
    console.log('\n🚀 Running migration...\n');
    console.log('─'.repeat(60));

    await pool.query(sql);

    console.log('─'.repeat(60));
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error details:', error.message);
    if (error.position) {
      console.error('Error position:', error.position);
    }
    if (error.detail) {
      console.error('Error detail:', error.detail);
    }
    if (error.hint) {
      console.error('Error hint:', error.hint);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
