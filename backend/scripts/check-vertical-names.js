/**
 * Check what vertical names are actually stored in requests
 */

const { query } = require('../src/config/database');

async function checkVerticals() {
  console.log('🔍 Checking vertical names in file_request_verticals...\n');

  try {
    const frVerticals = await query(`
      SELECT DISTINCT vertical, COUNT(*) as count
      FROM file_request_verticals
      GROUP BY vertical
      ORDER BY vertical
    `);

    console.log('File Request Verticals:');
    frVerticals.rows.forEach(row => {
      console.log(`  "${row.vertical}" (${row.count} requests)`);
    });

    console.log('\n🔍 Checking vertical names in launch_request_verticals...\n');

    const lrVerticals = await query(`
      SELECT DISTINCT vertical, COUNT(*) as count
      FROM launch_request_verticals
      GROUP BY vertical
      ORDER BY vertical
    `);

    console.log('Launch Request Verticals:');
    lrVerticals.rows.forEach(row => {
      console.log(`  "${row.vertical}" (${row.count} requests)`);
    });

    console.log('\n🔍 Checking vertical_heads table...\n');

    const vhVerticals = await query(`
      SELECT DISTINCT vertical
      FROM vertical_heads
      ORDER BY vertical
    `);

    console.log('Vertical Heads configured:');
    vhVerticals.rows.forEach(row => {
      console.log(`  "${row.vertical}"`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    process.exit(1);
  }
}

checkVerticals();
