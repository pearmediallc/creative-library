#!/usr/bin/env node

/**
 * Production Migration Runner for Railway
 * Run with: node run-production-migrations.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrations = [
  {
    name: '20260129_fix_file_request_uploads_critical.sql',
    description: 'Fix file_request_uploads table schema'
  },
  {
    name: '008_vertical_based_assignment.sql',
    description: 'Create vertical_heads table'
  },
  {
    name: '20260129_populate_vertical_heads.sql',
    description: 'Populate vertical heads team mapping'
  },
  {
    name: '20260211_ensure_creative_users_have_editor_records.sql',
    description: 'Create editor records for creative users'
  }
];

async function runMigration(migrationFile, description) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📋 Running: ${migrationFile}`);
  console.log(`📝 Description: ${description}`);
  console.log('='.repeat(70));

  const migrationPath = path.join(__dirname, 'migrations', migrationFile);

  // Check if file exists
  if (!fs.existsSync(migrationPath)) {
    console.log(`⚠️  SKIPPED: Migration file not found at ${migrationPath}`);
    return { success: false, skipped: true };
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = await pool.connect();
  try {
    // Start transaction
    await client.query('BEGIN');

    // Execute migration
    await client.query(sql);

    // Commit transaction
    await client.query('COMMIT');

    console.log(`✅ SUCCESS: ${migrationFile} completed`);
    return { success: true };
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error(`❌ FAILED: ${migrationFile}`);
    console.error(`Error: ${error.message}`);
    console.error(`Details: ${error.stack}`);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

async function verifyChanges() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('🔍 VERIFICATION');
  console.log('='.repeat(70));

  const client = await pool.connect();
  try {
    // Check file_request_uploads columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'file_request_uploads'
      ORDER BY column_name
    `);

    console.log('\n📊 file_request_uploads columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`);
    });

    // Check vertical_heads table
    const verticalHeadsExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'vertical_heads'
      )
    `);

    if (verticalHeadsExists.rows[0].exists) {
      console.log('\n✅ vertical_heads table exists');

      // Get vertical heads mapping
      const verticalHeads = await client.query(`
        SELECT
          vh.vertical,
          u.name as head_name,
          u.email as head_email
        FROM vertical_heads vh
        LEFT JOIN users u ON vh.head_editor_id = u.id
        ORDER BY vh.vertical
      `);

      console.log('\n📋 Vertical Heads Mapping:');
      if (verticalHeads.rows.length === 0) {
        console.log('  ⚠️  No vertical heads configured yet');
      } else {
        verticalHeads.rows.forEach(row => {
          console.log(`  • ${row.vertical.padEnd(12)} → ${row.head_name || 'NOT ASSIGNED'} (${row.head_email || 'N/A'})`);
        });
      }
    } else {
      console.log('\n❌ vertical_heads table does NOT exist');
    }

    // Check for required columns
    const requiredColumns = ['file_id', 'uploaded_by', 'upload_type', 'editor_id', 'comments'];
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n⚠️  Missing columns in file_request_uploads:');
      missingColumns.forEach(col => console.log(`  • ${col}`));
    } else {
      console.log('\n✅ All required columns present in file_request_uploads');
    }

    // Check editor records for creative users
    console.log('\n📋 Checking Editor Records:');
    const editorStats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'creative') as total_creative_users,
        (SELECT COUNT(*) FROM editors) as total_editors,
        (SELECT COUNT(*) FROM users u
         LEFT JOIN editors e ON e.user_id = u.id
         WHERE u.role = 'creative' AND e.id IS NULL) as creative_without_editor
    `);

    const stats = editorStats.rows[0];
    console.log(`  • Total creative users: ${stats.total_creative_users}`);
    console.log(`  • Total editor records: ${stats.total_editors}`);
    console.log(`  • Creative users WITHOUT editor record: ${stats.creative_without_editor}`);

    if (parseInt(stats.creative_without_editor) > 0) {
      console.log('\n⚠️  WARNING: Some creative users are missing editor records!');
    } else {
      console.log('\n✅ All creative users have editor records');
    }

    // Show all creative users with their editor status
    const creativeUsers = await client.query(`
      SELECT
        u.name,
        u.email,
        e.id as editor_id,
        CASE
          WHEN e.id IS NULL THEN '❌ NO EDITOR RECORD'
          WHEN e.is_active THEN '✅ ACTIVE EDITOR'
          ELSE '⚠️ INACTIVE EDITOR'
        END as status
      FROM users u
      LEFT JOIN editors e ON e.user_id = u.id
      WHERE u.role = 'creative'
      ORDER BY u.name
    `);

    if (creativeUsers.rows.length > 0) {
      console.log('\n📋 Creative Users & Editor Status:');
      creativeUsers.rows.forEach(user => {
        console.log(`  ${user.status} ${user.name} (${user.email})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║         CREATIVE LIBRARY - PRODUCTION MIGRATIONS                  ║');
  console.log('║                     Railway Deployment                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  console.log('\n📍 Database:', process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED');
  console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

  if (!process.env.DATABASE_URL) {
    console.error('\n❌ ERROR: DATABASE_URL environment variable not set');
    console.error('Please ensure DATABASE_URL is configured in Railway environment variables');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  // Run migrations sequentially
  for (const migration of migrations) {
    const result = await runMigration(migration.name, migration.description);
    if (result.success) {
      successCount++;
    } else if (result.skipped) {
      skipCount++;
    } else {
      failCount++;
      // Stop on first failure
      console.error('\n⚠️  Stopping migrations due to failure');
      break;
    }
  }

  // Verify changes
  await verifyChanges();

  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 MIGRATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⚠️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n❌ MIGRATIONS FAILED - Please check errors above');
    process.exit(1);
  } else {
    console.log('\n✅ ALL MIGRATIONS COMPLETED SUCCESSFULLY!');
    console.log('\n📋 Next Steps:');
    console.log('  1. Restart the Railway service to pick up changes');
    console.log('  2. Verify file request uploads are working');
    console.log('  3. Check vertical heads assignments in dashboard');
  }

  await pool.end();
}

// Run migrations
main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  process.exit(1);
});
