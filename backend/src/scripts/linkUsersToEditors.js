/**
 * Link Users to Editors Migration Script
 *
 * Purpose:
 * - Adds user_id column to editors table
 * - Creates Editor entities for all existing creative users
 * - Links users to their corresponding editors
 *
 * Usage: node src/scripts/linkUsersToEditors.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDatabase, query } = require('../config/database');
const logger = require('../utils/logger');

async function linkUsersToEditors() {
  try {
    console.log('\n🔗 ========== LINKING USERS TO EDITORS ==========\n');

    // Connect to database
    console.log('📊 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected\n');

    // Step 1: Add user_id column to editors table if it doesn't exist
    console.log('📋 Step 1: Adding user_id column to editors table...');
    await query(`
      ALTER TABLE editors
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL
    `);
    console.log('✅ user_id column added\n');

    // Step 2: Create index on user_id for performance
    console.log('📋 Step 2: Creating index on user_id...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_editors_user_id ON editors(user_id)
    `);
    console.log('✅ Index created\n');

    // Step 3: Get all creative users without an editor
    console.log('📋 Step 3: Finding creative users without editors...');
    const usersResult = await query(`
      SELECT u.id, u.name, u.email
      FROM users u
      LEFT JOIN editors e ON e.user_id = u.id
      WHERE u.role = 'creative'
      AND e.id IS NULL
      ORDER BY u.created_at ASC
    `);

    const users = Array.isArray(usersResult) ? usersResult : (usersResult.rows || []);
    console.log(`✅ Found ${users.length} creative users without editors\n`);

    if (users.length === 0) {
      console.log('ℹ️  No users need editor entities created');
    } else {
      // Step 4: Create editor for each creative user
      console.log('📋 Step 4: Creating editor entities for creative users...\n');

      for (const user of users) {
        try {
          // Create display name from user's name
          const displayName = user.name;
          // Create editor name (uppercase, no spaces for matching ad names)
          const editorName = user.name.toUpperCase().replace(/\s+/g, '');

          console.log(`  Creating editor for: ${displayName} (${user.email})`);
          console.log(`    - Editor name: ${editorName}`);

          // Check if editor with this name already exists
          const existingResult = await query(
            'SELECT id, user_id FROM editors WHERE UPPER(name) = UPPER($1)',
            [editorName]
          );
          const existing = Array.isArray(existingResult) ? existingResult[0] : existingResult.rows?.[0];

          if (existing) {
            if (existing.user_id) {
              console.log(`    ⚠️  Editor "${editorName}" already linked to another user, skipping...`);
            } else {
              // Link existing editor to this user
              await query(
                'UPDATE editors SET user_id = $1 WHERE id = $2',
                [user.id, existing.id]
              );
              console.log(`    ✅ Linked existing editor "${editorName}" to user\n`);
            }
          } else {
            // Create new editor
            const insertResult = await query(`
              INSERT INTO editors (name, display_name, user_id, is_active)
              VALUES ($1, $2, $3, TRUE)
              RETURNING id, name, display_name
            `, [editorName, displayName, user.id]);

            const newEditor = Array.isArray(insertResult) ? insertResult[0] : insertResult.rows?.[0];
            console.log(`    ✅ Created editor: ${newEditor.display_name} (${newEditor.name})\n`);
          }
        } catch (error) {
          console.error(`    ❌ Failed to create editor for ${user.name}: ${error.message}\n`);
        }
      }
    }

    // Step 5: Summary
    console.log('\n📊 ========== MIGRATION SUMMARY ==========\n');

    const statsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'creative') as total_creatives,
        (SELECT COUNT(*) FROM editors WHERE user_id IS NOT NULL) as linked_editors,
        (SELECT COUNT(*) FROM editors WHERE user_id IS NULL) as unlinked_editors
    `);
    const stats = Array.isArray(statsResult) ? statsResult[0] : statsResult.rows?.[0];

    console.log(`Total creative users: ${stats.total_creatives}`);
    console.log(`Linked editors (with user_id): ${stats.linked_editors}`);
    console.log(`Unlinked editors (legacy/manual): ${stats.unlinked_editors}`);
    console.log('\n✅ Migration completed successfully!\n');

    logger.info('User-Editor linking migration completed', stats);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ========== MIGRATION FAILED ==========');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('==============================================\n');

    logger.error('User-Editor linking migration failed', {
      error: error.message,
      stack: error.stack
    });

    process.exit(1);
  }
}

// Run migration
linkUsersToEditors();
