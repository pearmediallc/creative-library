/**
 * Verification Script: Check vertical_heads table
 */

const { query } = require('../src/config/database');

async function verify() {
  console.log('🔍 Checking vertical_heads table...\n');

  try {
    // Check vertical heads mappings
    const result = await query(`
      SELECT
        vh.vertical,
        u.id as user_id,
        u.name,
        u.email,
        u.role
      FROM vertical_heads vh
      JOIN users u ON u.id = vh.head_editor_id
      ORDER BY vh.vertical
    `);

    if (result.rows.length === 0) {
      console.log('❌ NO vertical heads found in table!');
    } else {
      console.log(`✅ Found ${result.rows.length} vertical head mappings:\n`);
      result.rows.forEach(row => {
        console.log(`  ${row.vertical.padEnd(20)} → ${row.name.padEnd(25)} (${row.email}) [${row.role}]`);
      });
    }

    // Check if Baljeet exists
    console.log('\n\n🔍 Checking for Baljeet Singh...\n');
    const baljeetResult = await query(`
      SELECT id, name, email, role
      FROM users
      WHERE email = 'baljeet.singh@pearmediallc.com'
    `);

    if (baljeetResult.rows.length === 0) {
      console.log('❌ Baljeet Singh user NOT FOUND in database!');
    } else {
      console.log('✅ Baljeet Singh found:');
      console.log(`   ID: ${baljeetResult.rows[0].id}`);
      console.log(`   Name: ${baljeetResult.rows[0].name}`);
      console.log(`   Email: ${baljeetResult.rows[0].email}`);
      console.log(`   Role: ${baljeetResult.rows[0].role}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

verify();
