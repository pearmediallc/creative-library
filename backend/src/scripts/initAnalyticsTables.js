/**
 * Initialize Analytics Database Tables
 * Run this script to create Facebook analytics tables
 * Usage: node src/scripts/initAnalyticsTables.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { connectDatabase } = require('../config/database');
const FacebookAuth = require('../models/FacebookAuth');
const FacebookAd = require('../models/FacebookAd');
const logger = require('../utils/logger');

async function initializeTables() {
  try {
    console.log('\n🚀 ========== ANALYTICS TABLES INITIALIZATION ==========\n');

    // Connect to database
    console.log('📊 Connecting to database...');
    await connectDatabase();
    console.log('✅ Database connected\n');

    // Drop existing tables if they exist (old structure)
    console.log('🗑️  Dropping old tables if they exist...');
    const { query } = require('../config/database');
    await query('DROP TABLE IF EXISTS ad_name_changes CASCADE');
    await query('DROP TABLE IF EXISTS facebook_ads CASCADE');
    await query('DROP TABLE IF EXISTS facebook_auth CASCADE');
    console.log('✅ Old tables dropped\n');

    // Create FacebookAuth table
    console.log('📋 Creating facebook_auth table...');
    await FacebookAuth.createTable();
    console.log('✅ facebook_auth table created\n');

    // Create FacebookAd tables
    console.log('📋 Creating facebook_ads table...');
    await FacebookAd.createTable();
    console.log('✅ facebook_ads table created\n');

    console.log('📋 Creating ad_name_changes table...');
    await FacebookAd.createAdNameChangesTable();
    console.log('✅ ad_name_changes table created\n');

    console.log('✅ ========== INITIALIZATION COMPLETE ==========\n');
    console.log('🎉 All analytics tables have been created successfully!');
    console.log('\n📌 Created tables:');
    console.log('   - facebook_auth: Stores Facebook access tokens');
    console.log('   - facebook_ads: Stores synced ad data and metrics');
    console.log('   - ad_name_changes: Tracks ad name and editor changes\n');

    logger.info('Analytics tables initialized successfully');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ========== INITIALIZATION FAILED ==========');
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error('==============================================\n');

    logger.error('Analytics tables initialization failed', {
      error: error.message,
      stack: error.stack
    });

    process.exit(1);
  }
}

// Run initialization
initializeTables();
