const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://creative_library_user:dhEneE0oJmdC7hBJ0KQvQ85t9PECO5Uo@dpg-d45o9463jp1c73dma5sg-a.oregon-postgres.render.com/creative_library',
  ssl: {
    rejectUnauthorized: false
  }
});

const usersToCreate = [
  { name: 'Jatin Chauhan', email: 'jatin.chauhan@pearmediallc.com', role: 'buyer', password: 'SystemsBuildProfit5%' },
  { name: 'Mohd Taufeeq', email: 'taufeeq.khan@pearmediallc.com', role: 'buyer', password: 'ROASRules24!' },
  { name: 'Aakarshan Rohatgi', email: 'aakarshan.rohatgi@pearmediallc.com', role: 'buyer', password: 'Earn50KMonthlyNow#' },
  { name: 'Gaurav Kushwaha', email: 'gaurav.kushwaha@pearmediallc.com', role: 'buyer', password: 'ClicksVault7!' },
  { name: 'Anusree Madhu', email: 'anusree.madhu@pearmediallc.com', role: 'buyer', password: 'AdScale2026#' },
  { name: 'Arushi Negi', email: 'arushi.negi@pearmediallc.com', role: 'buyer', password: 'MediaBuyer2026!' },
  { name: 'Aman Saini', email: 'aman.saini@pearmediallc.com', role: 'buyer', password: 'ProfitThroughSystems8@' },
  { name: 'Mamta Negi', email: 'mamta.negi@pearmediallc.com', role: 'buyer', password: 'DataDrivesDecisions6#' }
];

async function createUsers() {
  try {
    console.log('Starting user creation process...\n');

    for (const userData of usersToCreate) {
      const { name, email, role, password } = userData;

      // Check if user already exists
      const checkResult = await pool.query(
        'SELECT id, email FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (checkResult.rows.length > 0) {
        console.log(`❌ User ${email} already exists (ID: ${checkResult.rows[0].id})`);
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert the user
      const insertResult = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, is_active, approval_status, email_verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
         RETURNING id, name, email, role`,
        [name, email.toLowerCase(), hashedPassword, role, true, 'approved', true]
      );

      const createdUser = insertResult.rows[0];
      console.log(`✅ Created user: ${createdUser.name} (${createdUser.email}) - Role: ${createdUser.role} - ID: ${createdUser.id}`);
    }

    console.log('\n✅ User creation process completed!');
  } catch (error) {
    console.error('❌ Error creating users:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

createUsers();
