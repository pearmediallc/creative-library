/**
 * Migration: Populate vertical_heads table
 * Run once to populate the vertical heads with correct user mappings
 */

const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {
  console.log('🚀 Starting vertical_heads population migration...\n');
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/20260219_03_populate_vertical_heads.sql'),
      'utf8'
    );
    await query(sql);
    console.log('✅ Migration completed: vertical_heads table populated with correct mappings');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
