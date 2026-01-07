const bcrypt = require('bcryptjs');

const password = 'Admin@123';
const rounds = 10;

bcrypt.hash(password, rounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('\n==========================================');
  console.log('Admin Password Hash Generated');
  console.log('==========================================');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nCopy this hash to use in the SQL script:');
  console.log(hash);
  console.log('==========================================\n');
});
