const { query, transaction } = require('../config/database');
const adNameParser = require('./adNameParser');
const facebookGraphService = require('./facebookGraphService');
const FacebookAuth = require('../models/FacebookAuth');
const logger = require('../utils/logger');

/**
 * Analytics Service
 * Fetches Facebook ad data directly from Graph API and processes it
 */
class AnalyticsService {
  /**
   * Sync Facebook ads for an account
   * @param {string} adAccountId - Facebook ad account ID (with or without act_ prefix)
   * @param {string} userId - User ID (for auth check)
   * @param {string} dateFrom - Optional start date (YYYY-MM-DD)
   * @param {string} dateTo - Optional end date (YYYY-MM-DD)
   * @returns {Promise<Object>} Sync result
   */
  async syncFacebookAds(adAccountId, userId, dateFrom = null, dateTo = null) {
    try {
      console.log('\n🚀 ========== FACEBOOK AD SYNC START ==========');
      console.log(`📊 Ad Account ID: ${adAccountId}`);
      console.log(`👤 User ID: ${userId}`);

      if (dateFrom && dateTo) {
        console.log(`📅 Date Range: ${dateFrom} to ${dateTo}`);
      } else {
        console.log(`📅 Date Range: All time (no filter)`);
      }

      logger.info('Starting Facebook ad sync', { adAccountId, userId, dateFrom, dateTo });

      // Get user's Facebook access token
      const fbAuth = await FacebookAuth.getByUserId(userId);
      if (!fbAuth || !fbAuth.access_token) {
        throw new Error('Facebook account not connected. Please connect your Facebook account first.');
      }

      console.log('✅ Facebook auth found for user');

      const accessToken = fbAuth.access_token;

      // Fetch campaigns from Facebook Graph API with date filter
      const campaigns = await facebookGraphService.getCampaigns(adAccountId, accessToken, dateFrom, dateTo);
      logger.info('Fetched campaigns', { count: campaigns.length });

      if (campaigns.length === 0) {
        console.log('⚠️ No campaigns found in ad account');
        return {
          success: true,
          totalAdsProcessed: 0,
          adsWithEditor: 0,
          adsWithoutEditor: 0,
          message: 'No campaigns found in this ad account'
        };
      }

      let totalAdsProcessed = 0;
      let adsWithEditor = 0;
      let adsWithoutEditor = 0;

      // Process each campaign
      console.log(`\n📋 Processing ${campaigns.length} campaign(s)...`);
      for (let i = 0; i < campaigns.length; i++) {
        const campaign = campaigns[i];
        console.log(`\n📂 [${i + 1}/${campaigns.length}] Campaign: ${campaign.name}`);
        console.log(`   - Campaign ID: ${campaign.id}`);
        console.log(`   - Status: ${campaign.status || 'N/A'}`);
        console.log(`   - Objective: ${campaign.objective || 'N/A'}`);

        const ads = await facebookGraphService.getCampaignAds(campaign.id, accessToken);
        console.log(`   - Found ${ads.length} ad(s) in this campaign`);
        logger.info('Fetched ads for campaign', { campaignId: campaign.id, adCount: ads.length });

        // Process ads in batch
        if (ads.length === 0) {
          console.log(`   ⚠️ No ads to process in this campaign`);
        } else {
          console.log(`\n   📊 CAMPAIGN SUMMARY: Found ${ads.length} total ad(s) in this campaign`);
          console.log(`   📋 Processing each ad individually...\n`);

          let campaignAdsWithEditor = 0;
          let campaignAdsWithoutEditor = 0;

          for (let j = 0; j < ads.length; j++) {
            const ad = ads[j];
            console.log(`\n   📢 ========== AD ${j + 1}/${ads.length} ==========`);
            console.log(`      📝 Ad Name: "${ad.name}"`);
            console.log(`      🆔 Ad ID: ${ad.id}`);
            console.log(`      📊 Status: ${ad.status || 'N/A'}`);
            console.log(`      📅 Created: ${ad.created_time || 'N/A'}`);
            console.log(`      📅 Updated: ${ad.updated_time || 'N/A'}`);

            const processed = await this._processAndStoreAd(ad, campaign, adAccountId);
            totalAdsProcessed++;

            if (processed.hasEditor) {
              adsWithEditor++;
              campaignAdsWithEditor++;
              console.log(`      ✅ RESULT: Editor detected → ${processed.editorName}`);
            } else {
              adsWithoutEditor++;
              campaignAdsWithoutEditor++;
              console.log(`      ⚠️  RESULT: No editor name found in ad name`);
            }
            console.log(`   ========================================\n`);
          }

          console.log(`\n   ✅ CAMPAIGN COMPLETE: Processed ${ads.length} ads`);
          console.log(`      - With Editor: ${campaignAdsWithEditor}`);
          console.log(`      - Without Editor: ${campaignAdsWithoutEditor}`);
        }
      }

      console.log('\n✅ ========== FACEBOOK AD SYNC COMPLETE ==========');
      console.log(`📊 Total Ads Processed: ${totalAdsProcessed}`);
      console.log(`✅ Ads with Editor: ${adsWithEditor}`);
      console.log(`⚠️ Ads without Editor: ${adsWithoutEditor}`);
      console.log('================================================\n');

      logger.info('Facebook ad sync completed', {
        adAccountId,
        totalAdsProcessed,
        adsWithEditor,
        adsWithoutEditor
      });

      return {
        success: true,
        totalAdsProcessed,
        adsWithEditor,
        adsWithoutEditor
      };
    } catch (error) {
      console.error('\n❌ ========== FACEBOOK AD SYNC FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('===============================================\n');

      logger.error('Facebook ad sync failed', { error: error.message, adAccountId });
      throw new Error(`Failed to sync Facebook ads: ${error.message}`);
    }
  }

  /**
   * Process and store a single ad
   * @private
   */
  async _processAndStoreAd(ad, campaign, adAccountId) {
    try {
      console.log(`\n      🔍 Analyzing ad name: "${ad.name}"`);

      // Extract editor from ad name
      const editorMatch = await adNameParser.extractEditorFromAdName(ad.name);

      if (editorMatch) {
        console.log(`      ✅ Editor extraction successful:`);
        console.log(`         - Editor Name: ${editorMatch.editor_name}`);
        console.log(`         - Editor ID: ${editorMatch.editor_id || 'N/A'}`);
        console.log(`         - Match Pattern: ${editorMatch.pattern || 'N/A'}`);
      } else {
        console.log(`      ⚠️ No editor name pattern found in ad name`);
        console.log(`         - Ad name format may not match expected patterns`);
        console.log(`         - Expected formats: "Ad Name - EDITORNAME" or "[Launcher] Campaign - Ad Date - EDITORNAME"`);
      }

      // Extract insights
      const insights = ad.insights?.data?.[0] || {};
      const spend = parseFloat(insights.spend) || 0;
      const cpm = parseFloat(insights.cpm) || 0;
      const cpc = parseFloat(insights.cpc) || 0;
      const costPerResult = parseFloat(insights.cost_per_result) || 0;
      const impressions = parseInt(insights.impressions) || 0;
      const clicks = parseInt(insights.clicks) || 0;

      console.log(`      📊 Ad Metrics:`);
      console.log(`         - Spend: $${spend.toFixed(2)}`);
      console.log(`         - Impressions: ${impressions.toLocaleString()}`);
      console.log(`         - Clicks: ${clicks}`);
      console.log(`         - CPM: $${cpm.toFixed(2)}`);
      console.log(`         - CPC: $${cpc.toFixed(2)}`);

      // Check if ad already exists
      const existingAdResult = await query(
        'SELECT id, ad_name FROM facebook_ads WHERE fb_ad_id = $1',
        [ad.id]
      );

      if (existingAdResult.rows.length > 0) {
        // Update existing ad
        const existingAd = existingAdResult.rows[0];
        const oldAdName = existingAd.ad_name;

        console.log(`      🔄 Updating existing ad in database`);

        await query(`
          UPDATE facebook_ads SET
            ad_name = $1,
            ad_account_id = $2,
            campaign_id = $3,
            campaign_name = $4,
            editor_id = $5,
            editor_name = $6,
            spend = $7,
            cpm = $8,
            cpc = $9,
            cost_per_result = $10,
            impressions = $11,
            clicks = $12,
            last_synced_at = NOW()
          WHERE fb_ad_id = $13
        `, [
          ad.name,
          adAccountId,
          campaign.id,
          campaign.name,
          editorMatch?.editor_id || null,
          editorMatch?.editor_name || null,
          spend, cpm, cpc, costPerResult, impressions, clicks,
          ad.id
        ]);

        // Check for ad name change
        if (oldAdName !== ad.name) {
          console.log(`      📝 Ad name changed: "${oldAdName}" → "${ad.name}"`);
          await this._logAdNameChange(ad.id, oldAdName, ad.name);
        }
      } else {
        // Insert new ad
        console.log(`      ➕ Inserting new ad into database`);

        await query(`
          INSERT INTO facebook_ads (
            fb_ad_id, ad_name, ad_account_id, campaign_id, campaign_name,
            editor_id, editor_name, spend, cpm, cpc, cost_per_result,
            impressions, clicks, last_synced_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        `, [
          ad.id, ad.name, adAccountId, campaign.id, campaign.name,
          editorMatch?.editor_id || null,
          editorMatch?.editor_name || null,
          spend, cpm, cpc, costPerResult, impressions, clicks
        ]);
      }

      return {
        hasEditor: !!editorMatch,
        editorName: editorMatch?.editor_name || null
      };
    } catch (error) {
      console.error(`      ❌ Failed to process ad: ${error.message}`);
      logger.error('Failed to process ad', { error: error.message, adId: ad.id });
      return { hasEditor: false, editorName: null };
    }
  }

  /**
   * Log ad name change
   * @private
   */
  async _logAdNameChange(fbAdId, oldAdName, newAdName) {
    try {
      // Extract editors from both names
      const oldEditorMatch = await adNameParser.extractEditorFromAdName(oldAdName);
      const newEditorMatch = await adNameParser.extractEditorFromAdName(newAdName);

      const editorChanged = oldEditorMatch?.editor_name !== newEditorMatch?.editor_name;

      await query(`
        INSERT INTO ad_name_changes (
          fb_ad_id, old_ad_name, new_ad_name,
          old_editor_name, new_editor_name, editor_changed
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        fbAdId,
        oldAdName,
        newAdName,
        oldEditorMatch?.editor_name || null,
        newEditorMatch?.editor_name || null,
        editorChanged
      ]);

      if (editorChanged) {
        logger.warn('Editor name changed in ad', {
          fbAdId,
          oldEditor: oldEditorMatch?.editor_name,
          newEditor: newEditorMatch?.editor_name
        });
      }
    } catch (error) {
      logger.error('Failed to log ad name change', { error: error.message, fbAdId });
    }
  }

  /**
   * Get editor performance analytics
   * @param {Object} filters - Date range, editor_id, etc.
   * @returns {Promise<Array>} Editor performance data
   */
  async getEditorPerformance(filters = {}) {
    try {
      const conditions = ['1=1'];
      const params = [];
      let paramIndex = 1;

      if (filters.editor_id) {
        conditions.push(`editor_id = $${paramIndex++}`);
        params.push(filters.editor_id);
      }

      if (filters.date_from) {
        conditions.push(`last_synced_at >= $${paramIndex++}`);
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        conditions.push(`last_synced_at <= $${paramIndex++}`);
        params.push(filters.date_to);
      }

      const sql = `
        SELECT
          editor_id,
          editor_name,
          COUNT(*) as ad_count,
          SUM(spend) as total_spend,
          AVG(cpm) as avg_cpm,
          AVG(cpc) as avg_cpc,
          AVG(cost_per_result) as avg_cost_per_result,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks
        FROM facebook_ads
        WHERE ${conditions.join(' AND ')} AND editor_id IS NOT NULL
        GROUP BY editor_id, editor_name
        ORDER BY total_spend DESC
      `;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Get editor performance failed', { error: error.message });
      throw new Error('Failed to retrieve editor performance data');
    }
  }

  /**
   * Get ads without editor assignment
   * @returns {Promise<Array>} Ads without editor
   */
  async getAdsWithoutEditor() {
    try {
      const sql = `
        SELECT
          fb_ad_id,
          ad_name,
          campaign_name,
          spend,
          cpm,
          cpc,
          cost_per_result,
          last_synced_at
        FROM facebook_ads
        WHERE editor_id IS NULL
        ORDER BY spend DESC
        LIMIT 100
      `;

      const result = await query(sql);
      return result.rows;
    } catch (error) {
      logger.error('Get ads without editor failed', { error: error.message });
      throw new Error('Failed to retrieve ads without editor');
    }
  }

  /**
   * Get ad name change history
   * @param {Object} filters - Filter by editor_changed, date range
   * @returns {Promise<Array>} Ad name changes
   */
  async getAdNameChanges(filters = {}) {
    try {
      const conditions = ['1=1'];
      const params = [];
      let paramIndex = 1;

      if (filters.editor_changed === true) {
        conditions.push('editor_changed = TRUE');
      }

      if (filters.date_from) {
        conditions.push(`detected_at >= $${paramIndex++}`);
        params.push(filters.date_from);
      }

      const sql = `
        SELECT
          anc.*,
          fa.ad_name as current_ad_name,
          fa.campaign_name
        FROM ad_name_changes anc
        LEFT JOIN facebook_ads fa ON fa.fb_ad_id = anc.fb_ad_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY anc.detected_at DESC
        LIMIT 100
      `;

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Get ad name changes failed', { error: error.message });
      throw new Error('Failed to retrieve ad name change history');
    }
  }
}

module.exports = new AnalyticsService();
