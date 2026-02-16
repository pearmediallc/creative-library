const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function runMigrations() {
  const migrations = [
    '20260217_01_multi_platform_vertical.sql',
    '20260217_02_creative_distribution.sql',
    '20260217_03_workload_upload_triggers.sql',
    '20260217_04_folder_file_counts.sql'
  ];

  console.log('🚀 Starting database migrations...\n');

  for (const migration of migrations) {
    const filePath = path.join(__dirname, 'migrations', migration);

    try {
      console.log(`📝 Running migration: ${migration}`);
      const sql = fs.readFileSync(filePath, 'utf8');

      await query(sql);

      console.log(`✅ Successfully completed: ${migration}\n`);
    } catch (error) {
      console.error(`❌ Failed to run ${migration}:`);
      console.error(error.message);
      console.error('\nStopping migration process.\n');
      process.exit(1);
    }
  }

  console.log('🎉 All migrations completed successfully!');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});
