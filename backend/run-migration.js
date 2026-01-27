/**
 * Migration Runner Script
 * Run with: node run-migration.js 007
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

/**
 * Split SQL file into individual statements, handling DO blocks correctly
 */
function splitSQLStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inDoBlock = false;
  let dollarQuoteTag = null;

  const lines = sql.split('\n');

  for (let line of lines) {
    const trimmedLine = line.trim();

    // Skip pure comment lines and blank lines when not in a statement
    if (!currentStatement && (trimmedLine.startsWith('--') || !trimmedLine)) {
      continue;
    }

    // Track DO $$ blocks
    if (trimmedLine.startsWith('DO $$') || trimmedLine.startsWith('DO $')) {
      inDoBlock = true;
      // Extract dollar quote tag if present (e.g., $$ or $tag$)
      const match = trimmedLine.match(/DO (\$\$|\$\w*\$)/);
      if (match) {
        dollarQuoteTag = match[1];
      }
    }

    currentStatement += line + '\n';

    // Check for end of DO block
    if (inDoBlock && dollarQuoteTag && trimmedLine.includes(`END ${dollarQuoteTag}`)) {
      // End of DO block - this is a complete statement
      statements.push(currentStatement.trim());
      currentStatement = '';
      inDoBlock = false;
      dollarQuoteTag = null;
      continue;
    }

    // If not in a DO block, split on semicolons
    if (!inDoBlock && trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements.filter(stmt => {
    const cleaned = stmt.trim();
    // Only filter out pure comment blocks or empty statements
    const hasSQL = cleaned.split('\n').some(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--');
    });
    return hasSQL;
  });
}

async function runMigration(migrationNumber) {
  try {
    // Try different file name patterns
    let migrationFile = path.join(__dirname, 'migrations', `${migrationNumber}_file_request_enhancements.sql`);

    if (!fs.existsSync(migrationFile)) {
      migrationFile = path.join(__dirname, 'migrations', `${migrationNumber}_vertical_based_assignment.sql`);
    }

    if (!fs.existsSync(migrationFile)) {
      // Try just the number pattern
      const migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'));
      const matchingFile = migrationFiles.find(file => file.startsWith(migrationNumber + '_'));
      if (matchingFile) {
        migrationFile = path.join(__dirname, 'migrations', matchingFile);
      }
    }

    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ Migration file not found for migration number: ${migrationNumber}`);
      process.exit(1);
    }

    console.log(`📄 Reading migration file: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('🚀 Running migration...');
    console.log('SQL Preview:');
    console.log(sql.substring(0, 500) + '...\n');

    // Split SQL into individual statements
    // We need to handle DO blocks specially - they should be treated as single statements
    const statements = splitSQLStatements(sql);

    console.log(`📝 Executing ${statements.length} statement(s)...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt || stmt.startsWith('--')) continue; // Skip empty lines and comments

      console.log(`  [${i + 1}/${statements.length}] Executing...`);
      try {
        await query(stmt);
        console.log(`  ✓ Statement ${i + 1} completed`);
      } catch (err) {
        console.error(`  ✗ Statement ${i + 1} failed:`, err.message);
        throw err;
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying changes...');

    // Verify the changes
    const statusCheck = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'file_requests'
        AND column_name IN ('status', 'uploaded_at', 'launched_at', 'closed_at', 'reopened_at')
      ORDER BY column_name
    `);

    console.log('\n✓ New columns in file_requests table:');
    statusCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    const tableCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'file_request_uploads'
    `);

    if (tableCheck.rows.length > 0) {
      console.log('\n✓ file_request_uploads table created');
    }

    const indexCheck = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename IN ('file_requests', 'file_request_uploads')
        AND indexname LIKE 'idx_%'
      ORDER BY indexname
    `);

    console.log('\n✓ Indexes created:');
    indexCheck.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });

    console.log('\n🎉 Migration verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Get migration number from command line
const migrationNumber = process.argv[2] || '007';

console.log(`\n🔧 Starting migration ${migrationNumber}...\n`);
runMigration(migrationNumber);
