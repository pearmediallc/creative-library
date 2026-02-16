const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function runMigration4() {
  const migration = '20260217_04_folder_file_counts.sql';
  const filePath = path.join(__dirname, 'migrations', migration);

  console.log('🚀 Running Migration 4...\n');

  try {
    console.log(`📝 Running migration: ${migration}`);
    const sql = fs.readFileSync(filePath, 'utf8');

    await query(sql);

    console.log(`✅ Successfully completed: ${migration}\n`);
    console.log('🎉 Migration 4 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error(`❌ Failed to run ${migration}:`);
    console.error(error.message);
    console.error('\nMigration failed.\n');
    process.exit(1);
  }
}

runMigration4().catch(err => {
  console.error('Migration script error:', err);
  process.exit(1);
});
