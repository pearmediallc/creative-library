#!/usr/bin/env node

const bcrypt = require('bcryptjs');

// Get password from command line or use default
const password = process.argv[2] || 'Admin@123';

console.log('\n==========================================');
console.log('Generating Password Hash for Production');
console.log('==========================================');
console.log('Password:', password);
console.log('\nGenerating bcrypt hash (10 rounds)...\n');

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('Generated Hash:');
  console.log(hash);
  console.log('\n==========================================');
  console.log('Copy the hash above and use it in:');
  console.log('PRODUCTION_SETUP.sql (line with password_hash)');
  console.log('==========================================\n');
});
