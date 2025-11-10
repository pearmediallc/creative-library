/**
 * Add Approval Workflow Migration Script
 *
 * Purpose:
 * - Adds approval workflow fields to users table
 * - Creates allowed_emails whitelist table
 * - Creates password audit log table
 * - Updates existing users to 'approved' status
 *
 * Usage: node src/scripts/addApprovalWorkflow.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDatabase, query } = require('../config/database');
const logger = require('../utils/logger');

async function addApprovalWorkflow() {
  try {
    console.log('\n🔐 ========== ADDING APPROVAL WORKFLOW ==========\n');

    // Connect to database
    console.log('📊 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected\n');

    // Step 1: Add approval workflow fields to users table
    console.log('📋 Step 1: Adding approval workflow fields to users table...');
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS password_changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP
    `);
    console.log('✅ Approval workflow fields added\n');

    // Step 2: Create indexes for performance
    console.log('📋 Step 2: Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_approval_status
      ON users(approval_status)
      WHERE approval_status = 'pending'
    `);
    console.log('✅ Indexes created\n');

    // Step 3: Create allowed_emails whitelist table
    console.log('📋 Step 3: Creating allowed_emails whitelist table...');
    await query(`
      CREATE TABLE IF NOT EXISTS allowed_emails (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        department VARCHAR(100),
        job_title VARCHAR(100),
        added_by UUID REFERENCES users(id) ON DELETE SET NULL,
        notes TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_allowed_emails_email
      ON allowed_emails(email)
      WHERE is_active = TRUE
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_allowed_emails_active
      ON allowed_emails(is_active)
      WHERE is_active = TRUE
    `);
    console.log('✅ Allowed emails table created\n');

    // Step 4: Create password audit log table
    console.log('📋 Step 4: Creating password audit log table...');
    await query(`
      CREATE TABLE IF NOT EXISTS password_audit_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_password_audit_user
      ON password_audit_log(user_id, created_at DESC)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_password_audit_admin
      ON password_audit_log(admin_id, created_at DESC)
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_password_audit_action
      ON password_audit_log(action, created_at DESC)
    `);
    console.log('✅ Password audit log table created\n');

    // Step 5: Update existing users to 'approved' status
    console.log('📋 Step 5: Updating existing users to approved status...');
    const updateResult = await query(`
      UPDATE users
      SET
        approval_status = 'approved',
        is_active = TRUE,
        email_verified = TRUE,
        approved_at = NOW()
      WHERE approval_status IS NULL OR approval_status = 'pending'
      RETURNING id, email
    `);

    const updatedUsers = Array.isArray(updateResult) ? updateResult : (updateResult.rows || []);
    console.log(`✅ Updated ${updatedUsers.length} existing users to approved status\n`);

    // Step 6: Add existing user emails to whitelist
    console.log('📋 Step 6: Adding existing user emails to whitelist...');
    const existingUsersResult = await query(`
      SELECT id, email, role FROM users WHERE is_active = TRUE
    `);

    const existingUsers = Array.isArray(existingUsersResult) ? existingUsersResult : (existingUsersResult.rows || []);

    for (const user of existingUsers) {
      try {
        await query(`
          INSERT INTO allowed_emails (email, department, notes, is_active)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (email) DO NOTHING
        `, [
          user.email,
          user.role === 'admin' ? 'Administration' : user.role === 'creative' ? 'Creative' : 'Media Buying',
          'Auto-added from existing users'
        ]);
      } catch (error) {
        console.log(`  ⚠️ Could not add ${user.email} to whitelist: ${error.message}`);
      }
    }
    console.log(`✅ Added ${existingUsers.length} existing emails to whitelist\n`);

    // Step 7: Summary
    console.log('\n📊 ========== MIGRATION SUMMARY ==========\n');

    const statsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE approval_status = 'approved') as approved_users,
        (SELECT COUNT(*) FROM users WHERE approval_status = 'pending') as pending_users,
        (SELECT COUNT(*) FROM allowed_emails WHERE is_active = TRUE) as whitelisted_emails
    `);
    const stats = Array.isArray(statsResult) ? statsResult[0] : statsResult.rows?.[0];

    console.log(`Total users: ${stats.total_users}`);
    console.log(`Approved users: ${stats.approved_users}`);
    console.log(`Pending users: ${stats.pending_users}`);
    console.log(`Whitelisted emails: ${stats.whitelisted_emails}`);
    console.log('\n✅ Migration completed successfully!\n');

    logger.info('Approval workflow migration completed', stats);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ========== MIGRATION FAILED ==========');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('==============================================\n');

    logger.error('Approval workflow migration failed', {
      error: error.message,
      stack: error.stack
    });

    process.exit(1);
  }
}

// Run migration
addApprovalWorkflow();
