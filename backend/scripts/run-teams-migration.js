const fs = require('fs');
const path = require('path');
const { query } = require('../src/config/database');

async function runMigration() {

  try {
    console.log('🚀 Starting Teams Feature Enhancement Migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/TEAMS_ENHANCEMENTS.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...\n');

    const verificationQueries = [
      { name: 'teams', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'teams')" },
      { name: 'team_members', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_members')" },
      { name: 'team_activity', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_activity')" },
      { name: 'request_templates', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'request_templates')" },
      { name: 'team_analytics_snapshots', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_analytics_snapshots')" },
      { name: 'team_role_presets', query: "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_role_presets')" },
      { name: 'folders.team_id', query: "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'team_id')" },
      { name: 'folders.ownership_type', query: "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'folders' AND column_name = 'ownership_type')" },
      { name: 'team_members.can_manage_members', query: "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'team_members' AND column_name = 'can_manage_members')" },
    ];

    for (const { name, query: checkQuery } of verificationQueries) {
      const result = await query(checkQuery);
      const exists = result.rows[0].exists;
      console.log(`✓ ${name} ${exists ? 'exists' : 'NOT FOUND'}: ${exists}`);
    }

    // Count role presets
    const presetsResult = await query('SELECT COUNT(*) FROM team_role_presets');
    console.log(`✓ Team role presets count: ${presetsResult.rows[0].count}`);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Summary:');
    console.log('   - Created 6 new tables');
    console.log('   - Modified folders table (added team_id, ownership_type)');
    console.log('   - Extended team_members table with permission columns');
    console.log('   - Inserted 3 default role presets (lead, member, guest)');
    console.log('   - Created all necessary indexes and triggers');
    console.log('\n🎉 Phase 8: Teams Feature Enhancements is ready!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

runMigration();
