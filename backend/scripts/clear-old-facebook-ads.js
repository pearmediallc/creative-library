#!/usr/bin/env node

/**
 * Clear Old Facebook Ads Migration Script
 *
 * This script removes all existing Facebook ads from the database to:
 * 1. Remove 6,732 ads without editor names that are polluting analytics
 * 2. Prepare for fresh sync with improved filtering (only ads with editor names)
 * 3. Clean up "Unknown" editor data that's causing misleading analytics
 *
 * Run: node backend/scripts/clear-old-facebook-ads.js
 */

const { query } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function clearOldFacebookAds() {
  try {
    console.log('\n🗑️  ========== CLEARING OLD FACEBOOK ADS ==========\n');

    // Step 1: Count existing ads
    console.log('📊 Step 1: Counting existing ads...');
    const countResult = await query('SELECT COUNT(*) as total FROM facebook_ads');
    const totalAds = parseInt(countResult.rows[0].total);
    console.log(`   Found ${totalAds} ads in database\n`);

    if (totalAds === 0) {
      console.log('✅ No ads to clear. Database is already clean.\n');
      return;
    }

    // Step 2: Count ads by editor status
    console.log('📊 Step 2: Analyzing ads by editor assignment...');
    const editorStats = await query(`
      SELECT
        CASE
          WHEN editor_name IS NULL OR editor_name = '' THEN 'No Editor'
          ELSE 'Has Editor'
        END as status,
        COUNT(*) as count
      FROM facebook_ads
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('   Current breakdown:');
    editorStats.rows.forEach(row => {
      console.log(`   - ${row.status}: ${row.count} ads`);
    });
    console.log('');

    // Step 3: Delete all ads
    console.log('🗑️  Step 3: Deleting all Facebook ads...');
    const deleteResult = await query('DELETE FROM facebook_ads');
    console.log(`   ✅ Deleted ${deleteResult.rowCount} ads\n`);

    // Step 4: Verify deletion
    console.log('✅ Step 4: Verifying deletion...');
    const verifyResult = await query('SELECT COUNT(*) as total FROM facebook_ads');
    const remainingAds = parseInt(verifyResult.rows[0].total);

    if (remainingAds === 0) {
      console.log(`   ✅ Success! All ads removed.\n`);
    } else {
      console.log(`   ⚠️  Warning: ${remainingAds} ads still remain\n`);
    }

    console.log('✅ ========== CLEANUP COMPLETE ==========\n');
    console.log('📋 Next Steps:');
    console.log('   1. Backend changes committed (6-second rate limit + retry logic)');
    console.log('   2. Restart backend server');
    console.log('   3. Run "Sync Facebook Ads" in Analytics page');
    console.log('   4. Only ads with editor names will be synced\n');

    logger.info('Old Facebook ads cleared successfully', {
      adsDeleted: deleteResult.rowCount,
      remainingAds
    });

  } catch (error) {
    console.error('\n❌ Error clearing old Facebook ads:', error.message);
    logger.error('Failed to clear old Facebook ads', { error: error.message });
    throw error;
  } finally {
    process.exit(0);
  }
}

// Run the migration
clearOldFacebookAds();
