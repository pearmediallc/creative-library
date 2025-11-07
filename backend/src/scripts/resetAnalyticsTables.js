/**
 * RESET Analytics Database Tables
 * This script DROPS and RECREATES all analytics tables with correct schema
 * Use this to fix production database column mismatch issues
 *
 * ⚠️ WARNING: This will DELETE all existing analytics data!
 *
 * Usage: node src/scripts/resetAnalyticsTables.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDatabase, query } = require('../config/database');
const logger = require('../utils/logger');

async function resetTables() {
  try {
    console.log('\n🚀 ========== ANALYTICS TABLES RESET START ==========\n');

    // Connect to database
    console.log('📊 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected\n');

    // STEP 1: Drop existing tables (clean slate)
    console.log('🗑️  STEP 1: Dropping existing analytics tables...');

    try {
      await query('DROP TABLE IF EXISTS ad_name_changes CASCADE');
      console.log('  ✅ Dropped: ad_name_changes');
    } catch (err) {
      console.log('  ℹ️  ad_name_changes did not exist');
    }

    try {
      await query('DROP TABLE IF EXISTS facebook_ads CASCADE');
      console.log('  ✅ Dropped: facebook_ads');
    } catch (err) {
      console.log('  ℹ️  facebook_ads did not exist');
    }

    try {
      await query('DROP TABLE IF EXISTS facebook_auth CASCADE');
      console.log('  ✅ Dropped: facebook_auth');
    } catch (err) {
      console.log('  ℹ️  facebook_auth did not exist');
    }

    console.log('\n✅ All old tables dropped successfully\n');

    // STEP 2: Create facebook_auth table
    console.log('📋 STEP 2: Creating facebook_auth table...');

    await query(`
      CREATE TABLE facebook_auth (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        access_token TEXT NOT NULL,
        token_type VARCHAR(50) DEFAULT 'Bearer',
        expires_at TIMESTAMP,
        ad_account_id VARCHAR(255),
        ad_account_name VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Table created: facebook_auth');
    console.log('     - Columns: id, user_id, access_token, token_type, expires_at');
    console.log('     - Columns: ad_account_id, ad_account_name, is_active');
    console.log('     - Columns: created_at, updated_at');

    // Create indexes for facebook_auth
    await query('CREATE INDEX idx_facebook_auth_user_id ON facebook_auth(user_id)');
    await query('CREATE INDEX idx_facebook_auth_is_active ON facebook_auth(is_active)');
    console.log('  ✅ Indexes created: user_id, is_active\n');

    // STEP 3: Create facebook_ads table
    console.log('📋 STEP 3: Creating facebook_ads table...');

    await query(`
      CREATE TABLE facebook_ads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fb_ad_id VARCHAR(255) UNIQUE NOT NULL,
        ad_name TEXT NOT NULL,
        ad_account_id VARCHAR(255) NOT NULL,
        campaign_id VARCHAR(255),
        campaign_name TEXT,
        editor_id UUID REFERENCES editors(id) ON DELETE SET NULL,
        editor_name VARCHAR(255),
        spend DECIMAL(12, 2) DEFAULT 0,
        cpm DECIMAL(12, 2) DEFAULT 0,
        cpc DECIMAL(12, 2) DEFAULT 0,
        cost_per_result DECIMAL(12, 2) DEFAULT 0,
        impressions BIGINT DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        last_synced_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Table created: facebook_ads');
    console.log('     - Columns: id, fb_ad_id, ad_name, ad_account_id');
    console.log('     - Columns: campaign_id, campaign_name, editor_id, editor_name');
    console.log('     - Columns: spend, cpm, cpc, cost_per_result, impressions, clicks');
    console.log('     - Columns: last_synced_at, created_at, updated_at');

    // Create indexes for facebook_ads
    await query('CREATE INDEX idx_facebook_ads_fb_ad_id ON facebook_ads(fb_ad_id)');
    await query('CREATE INDEX idx_facebook_ads_editor_id ON facebook_ads(editor_id)');
    await query('CREATE INDEX idx_facebook_ads_ad_account_id ON facebook_ads(ad_account_id)');
    await query('CREATE INDEX idx_facebook_ads_campaign_id ON facebook_ads(campaign_id)');
    console.log('  ✅ Indexes created: fb_ad_id, editor_id, ad_account_id, campaign_id\n');

    // STEP 4: Create ad_name_changes table
    console.log('📋 STEP 4: Creating ad_name_changes table...');

    await query(`
      CREATE TABLE ad_name_changes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        fb_ad_id VARCHAR(255) NOT NULL,
        old_ad_name TEXT,
        new_ad_name TEXT,
        old_editor_name VARCHAR(255),
        new_editor_name VARCHAR(255),
        editor_changed BOOLEAN DEFAULT FALSE,
        detected_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  ✅ Table created: ad_name_changes');
    console.log('     - Columns: id, fb_ad_id, old_ad_name, new_ad_name');
    console.log('     - Columns: old_editor_name, new_editor_name, editor_changed');
    console.log('     - Columns: detected_at');

    // Create indexes for ad_name_changes
    await query('CREATE INDEX idx_ad_name_changes_fb_ad_id ON ad_name_changes(fb_ad_id)');
    await query('CREATE INDEX idx_ad_name_changes_editor_changed ON ad_name_changes(editor_changed)');
    console.log('  ✅ Indexes created: fb_ad_id, editor_changed\n');

    // STEP 5: Verify all tables exist
    console.log('🔍 STEP 5: Verifying tables...');

    const verification = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('facebook_auth', 'facebook_ads', 'ad_name_changes')
      ORDER BY table_name
    `);

    console.log('  ✅ Tables found in database:');
    verification.rows.forEach(row => {
      console.log(`     - ${row.table_name}`);
    });

    if (verification.rows.length !== 3) {
      throw new Error('Not all tables were created successfully!');
    }

    console.log('\n✅ ========== ANALYTICS TABLES RESET COMPLETE ==========\n');
    console.log('🎉 All analytics tables recreated successfully!');
    console.log('\n📌 Summary:');
    console.log('   ✅ facebook_auth - Stores Facebook access tokens (with is_active column)');
    console.log('   ✅ facebook_ads - Stores synced ad data (with campaign_name column)');
    console.log('   ✅ ad_name_changes - Tracks ad name and editor changes');
    console.log('\n📊 Column counts:');
    console.log('   - facebook_auth: 10 columns');
    console.log('   - facebook_ads: 17 columns');
    console.log('   - ad_name_changes: 8 columns');
    console.log('\n✅ All indexes created for optimal performance');
    console.log('\n🚀 You can now use Facebook Analytics features!\n');

    logger.info('Analytics tables reset successfully');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ========== RESET FAILED ==========');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('======================================\n');

    logger.error('Analytics tables reset failed', {
      error: error.message,
      stack: error.stack
    });

    process.exit(1);
  }
}

// Confirm before running
console.log('\n⚠️  WARNING: This will DROP and RECREATE analytics tables!');
console.log('⚠️  All existing analytics data will be DELETED!');
console.log('\nRunning in 3 seconds...');
console.log('Press Ctrl+C to cancel\n');

setTimeout(() => {
  resetTables();
}, 3000);
