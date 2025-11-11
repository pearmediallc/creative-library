const { query, transaction } = require('../config/database');
const adNameParser = require('./adNameParser');
const facebookGraphService = require('./facebookGraphService');
const redtrackService = require('./redtrackService');
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

        // Fetch ad sets for this campaign
        const adSets = await facebookGraphService.getCampaignAdSets(campaign.id, accessToken);
        console.log(`   - Found ${adSets.length} ad set(s) in this campaign`);
        logger.info('Fetched ad sets for campaign', { campaignId: campaign.id, adSetCount: adSets.length });

        // Process each ad set
        if (adSets.length === 0) {
          console.log(`   ⚠️ No ad sets to process in this campaign`);
        } else {
          let campaignAdsWithEditor = 0;
          let campaignAdsWithoutEditor = 0;
          let campaignTotalAds = 0;

          for (let j = 0; j < adSets.length; j++) {
            const adSet = adSets[j];
            console.log(`\n   📦 [Ad Set ${j + 1}/${adSets.length}] ${adSet.name}`);
            console.log(`      Ad Set ID: ${adSet.id}`);
            console.log(`      Status: ${adSet.status}`);

            // Fetch ads for this ad set
            const ads = await facebookGraphService.getAdSetAds(adSet.id, accessToken);
            console.log(`      Found ${ads.length} ad(s) in this ad set`);
            logger.info('Fetched ads for ad set', { adSetId: adSet.id, adCount: ads.length });

            if (ads.length === 0) {
              console.log(`      ⚠️ No ads to process in this ad set`);
            } else {
              for (let k = 0; k < ads.length; k++) {
                const ad = ads[k];
                console.log(`\n      📢 ========== AD ${k + 1}/${ads.length} (from Ad Set: ${adSet.name}) ==========`);
                console.log(`         📝 Ad Name: "${ad.name}"`);
                console.log(`         🆔 Ad ID: ${ad.id}`);
                console.log(`         📊 Status: ${ad.status || 'N/A'}`);
                console.log(`         📅 Created: ${ad.created_time || 'N/A'}`);
                console.log(`         📅 Updated: ${ad.updated_time || 'N/A'}`);

                const processed = await this._processAndStoreAd(ad, campaign, adAccountId);
                totalAdsProcessed++;
                campaignTotalAds++;

                if (processed.hasEditor) {
                  adsWithEditor++;
                  campaignAdsWithEditor++;
                  console.log(`         ✅ RESULT: Editor detected → ${processed.editorName}`);
                } else {
                  adsWithoutEditor++;
                  campaignAdsWithoutEditor++;
                  console.log(`         ⚠️  RESULT: No editor name found in ad name`);
                }
                console.log(`      ========================================\n`);
              }
            }
          }

          console.log(`\n   ✅ CAMPAIGN COMPLETE: Processed ${campaignTotalAds} ads from ${adSets.length} ad sets`);
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

  /**
   * Get unified analytics (Facebook Ads + RedTrack)
   * Combines Facebook traffic metrics with RedTrack conversion/revenue data
   * @param {string} adAccountId - Facebook ad account ID
   * @param {string} userId - User ID (for auth check)
   * @param {string} dateFrom - Optional start date (YYYY-MM-DD)
   * @param {string} dateTo - Optional end date (YYYY-MM-DD)
   * @param {boolean} useBulkFetch - Use bulk fetch for better performance (default: true for >10 ads)
   * @returns {Promise<Object>} Unified analytics with Facebook + RedTrack data
   */
  async getUnifiedAnalytics(adAccountId, userId, dateFrom = null, dateTo = null, useBulkFetch = null) {
    try {
      console.log('\n🚀 ========== UNIFIED ANALYTICS START ==========');
      console.log(`📊 Ad Account: ${adAccountId}`);
      console.log(`👤 User: ${userId}`);
      console.log(`📅 Date Range: ${dateFrom || 'all time'} to ${dateTo || 'now'}`);

      // Step 1: Sync Facebook ads first (ensures we have latest data)
      console.log('\n📥 Step 1: Syncing Facebook ads...');
      const syncResult = await this.syncFacebookAds(adAccountId, userId, dateFrom, dateTo);
      console.log(`✅ Synced ${syncResult.totalAdsProcessed} ads from Facebook`);

      // Step 2: Get Facebook ads with metrics
      console.log('\n📊 Step 2: Fetching Facebook ad data from database...');
      const fbAdsResult = await query(`
        SELECT
          fb_ad_id,
          ad_name,
          campaign_id,
          campaign_name,
          ad_account_id,
          editor_id,
          editor_name,
          spend,
          cpm,
          cpc,
          cost_per_result,
          impressions,
          clicks,
          last_synced_at
        FROM facebook_ads
        WHERE ad_account_id = $1
          AND (
            ($2::date IS NULL OR last_synced_at >= $2::date) AND
            ($3::date IS NULL OR last_synced_at <= $3::date)
          )
        ORDER BY spend DESC
      `, [adAccountId, dateFrom, dateTo]);

      const fbAds = fbAdsResult.rows;
      console.log(`✅ Found ${fbAds.length} Facebook ads in database`);

      if (fbAds.length === 0) {
        console.log('⚠️ No ads found for this account and date range');
        return this._getEmptyUnifiedAnalytics();
      }

      // Step 3: Fetch RedTrack data
      console.log('\n📈 Step 3: Fetching RedTrack conversion data...');
      const adIds = fbAds.map(ad => ad.fb_ad_id);

      // Auto-determine fetch method based on ad count
      const shouldUseBulk = useBulkFetch !== null ? useBulkFetch : (adIds.length > 10);
      console.log(`   Fetch method: ${shouldUseBulk ? 'BULK' : 'INDIVIDUAL'} (${adIds.length} ads)`);

      let redtrackData;
      if (shouldUseBulk) {
        // Bulk fetch - single API call, faster for many ads
        redtrackData = await redtrackService.getBulkAdMetrics(adIds, dateFrom, dateTo);
      } else {
        // Individual fetch - better for few ads or when you need specific filtering
        redtrackData = await redtrackService.getBatchAdMetrics(adIds, dateFrom, dateTo);
      }

      console.log(`✅ Fetched RedTrack data for ${redtrackData.size} ad(s)`);

      // Step 4: Merge Facebook + RedTrack data
      console.log('\n🔗 Step 4: Merging Facebook + RedTrack data...');
      const unifiedAds = fbAds.map(fbAd => {
        const rtData = redtrackData.get(fbAd.fb_ad_id) || {};

        const spend = parseFloat(fbAd.spend) || 0;
        const revenue = rtData.revenue || 0;
        const profit = revenue - spend;
        const roas = spend > 0 ? (revenue / spend) : 0;

        return {
          // Identifiers
          fb_ad_id: fbAd.fb_ad_id,
          ad_name: fbAd.ad_name,
          campaign_id: fbAd.campaign_id,
          campaign_name: fbAd.campaign_name,
          ad_account_id: fbAd.ad_account_id,

          // Editor info
          editor_id: fbAd.editor_id,
          editor_name: fbAd.editor_name,

          // Facebook metrics
          spend: spend,
          impressions: parseInt(fbAd.impressions) || 0,
          clicks: parseInt(fbAd.clicks) || 0,
          cpm: parseFloat(fbAd.cpm) || 0,
          cpc: parseFloat(fbAd.cpc) || 0,
          cost_per_result: parseFloat(fbAd.cost_per_result) || 0,
          fb_ctr: fbAd.impressions > 0 ? (fbAd.clicks / fbAd.impressions) * 100 : 0,

          // RedTrack metrics
          revenue: revenue,
          conversions: rtData.conversions || 0,
          approved_conversions: rtData.approved_conversions || 0,
          pending_conversions: rtData.pending_conversions || 0,
          rejected_conversions: rtData.rejected_conversions || 0,
          rt_clicks: rtData.clicks || 0,
          lp_views: rtData.lp_views || 0,
          lp_clicks: rtData.lp_clicks || 0,
          lp_ctr: rtData.lp_ctr || 0,
          cr: rtData.cr || 0, // Conversion rate
          epc: rtData.epc || 0, // Earnings per click
          rt_roi: rtData.roi || 0,

          // Calculated metrics
          profit: profit,
          roas: roas,
          cost_per_conversion: rtData.conversions > 0 ? (spend / rtData.conversions) : 0,

          // Meta
          last_synced_at: fbAd.last_synced_at,
          redtrack_error: rtData.error || null,
          has_redtrack_data: !rtData.error && (rtData.revenue > 0 || rtData.conversions > 0)
        };
      });

      console.log(`✅ Merged ${unifiedAds.length} ad records`);

      // Step 5: Aggregate by editor
      console.log('\n👥 Step 5: Aggregating by editor...');
      const editorPerformance = this._aggregateByEditor(unifiedAds);
      console.log(`✅ Aggregated data for ${editorPerformance.length} editor(s)`);

      // Step 6: Calculate summary statistics
      console.log('\n📊 Step 6: Calculating summary statistics...');
      const summary = this._calculateSummary(unifiedAds);

      console.log('\n✅ ========== UNIFIED ANALYTICS COMPLETE ==========');
      console.log(`📊 Summary:`);
      console.log(`   - Total Ads: ${summary.total_ads}`);
      console.log(`   - Total Spend: $${summary.total_spend.toFixed(2)}`);
      console.log(`   - Total Revenue: $${summary.total_revenue.toFixed(2)}`);
      console.log(`   - Total Profit: $${summary.total_profit.toFixed(2)}`);
      console.log(`   - Overall ROAS: ${summary.overall_roas.toFixed(2)}x`);
      console.log(`   - Ads with RedTrack Data: ${summary.ads_with_redtrack_data}`);
      console.log(`   - Ads with Editor: ${summary.ads_with_editor}`);
      console.log(`================================================\n`);

      logger.info('Unified analytics completed', {
        adAccountId,
        totalAds: summary.total_ads,
        totalSpend: summary.total_spend,
        totalRevenue: summary.total_revenue,
        editorCount: editorPerformance.length
      });

      return {
        ads: unifiedAds,
        editor_performance: editorPerformance,
        summary: summary,
        meta: {
          date_from: dateFrom,
          date_to: dateTo,
          ad_account_id: adAccountId,
          fetch_method: shouldUseBulk ? 'bulk' : 'individual',
          generated_at: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('\n❌ ========== UNIFIED ANALYTICS FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('===============================================\n');

      logger.error('Unified analytics failed', {
        error: error.message,
        adAccountId,
        userId
      });

      throw new Error(`Failed to generate unified analytics: ${error.message}`);
    }
  }

  /**
   * Aggregate unified ad data by editor
   * @private
   */
  _aggregateByEditor(unifiedAds) {
    const editorMap = {};

    unifiedAds.forEach(ad => {
      const editorKey = ad.editor_name || 'Unknown';

      if (!editorMap[editorKey]) {
        editorMap[editorKey] = {
          editor_name: editorKey,
          editor_id: ad.editor_id,
          total_ads: 0,
          ads_with_redtrack_data: 0,

          // Facebook metrics
          total_spend: 0,
          total_impressions: 0,
          total_clicks: 0,
          avg_cpm: 0,
          avg_cpc: 0,
          avg_ctr: 0,

          // RedTrack metrics
          total_revenue: 0,
          total_conversions: 0,
          total_approved_conversions: 0,
          total_rt_clicks: 0,
          total_lp_views: 0,
          avg_cr: 0,
          avg_epc: 0,

          // Calculated metrics
          total_profit: 0,
          roas: 0,
          avg_cost_per_conversion: 0
        };
      }

      const ep = editorMap[editorKey];
      ep.total_ads++;

      if (ad.has_redtrack_data) {
        ep.ads_with_redtrack_data++;
      }

      // Accumulate Facebook metrics
      ep.total_spend += ad.spend;
      ep.total_impressions += ad.impressions;
      ep.total_clicks += ad.clicks;

      // Accumulate RedTrack metrics
      ep.total_revenue += ad.revenue;
      ep.total_conversions += ad.conversions;
      ep.total_approved_conversions += ad.approved_conversions;
      ep.total_rt_clicks += ad.rt_clicks;
      ep.total_lp_views += ad.lp_views;

      // Accumulate calculated metrics
      ep.total_profit += ad.profit;
    });

    // Calculate averages and ratios
    Object.values(editorMap).forEach(ep => {
      ep.avg_cpm = ep.total_impressions > 0 ? (ep.total_spend / ep.total_impressions) * 1000 : 0;
      ep.avg_cpc = ep.total_clicks > 0 ? ep.total_spend / ep.total_clicks : 0;
      ep.avg_ctr = ep.total_impressions > 0 ? (ep.total_clicks / ep.total_impressions) * 100 : 0;
      ep.avg_cr = ep.total_rt_clicks > 0 ? (ep.total_conversions / ep.total_rt_clicks) * 100 : 0;
      ep.avg_epc = ep.total_rt_clicks > 0 ? ep.total_revenue / ep.total_rt_clicks : 0;
      ep.roas = ep.total_spend > 0 ? ep.total_revenue / ep.total_spend : 0;
      ep.avg_cost_per_conversion = ep.total_conversions > 0 ? ep.total_spend / ep.total_conversions : 0;
    });

    // Sort by total spend descending
    return Object.values(editorMap).sort((a, b) => b.total_spend - a.total_spend);
  }

  /**
   * Calculate summary statistics
   * @private
   */
  _calculateSummary(unifiedAds) {
    const summary = {
      total_ads: unifiedAds.length,
      ads_with_editor: unifiedAds.filter(ad => ad.editor_id).length,
      ads_without_editor: unifiedAds.filter(ad => !ad.editor_id).length,
      ads_with_redtrack_data: unifiedAds.filter(ad => ad.has_redtrack_data).length,
      ads_without_redtrack_data: unifiedAds.filter(ad => !ad.has_redtrack_data).length,

      // Facebook totals
      total_spend: unifiedAds.reduce((sum, ad) => sum + ad.spend, 0),
      total_impressions: unifiedAds.reduce((sum, ad) => sum + ad.impressions, 0),
      total_clicks: unifiedAds.reduce((sum, ad) => sum + ad.clicks, 0),

      // RedTrack totals
      total_revenue: unifiedAds.reduce((sum, ad) => sum + ad.revenue, 0),
      total_conversions: unifiedAds.reduce((sum, ad) => sum + ad.conversions, 0),
      total_approved_conversions: unifiedAds.reduce((sum, ad) => sum + ad.approved_conversions, 0),
      total_rt_clicks: unifiedAds.reduce((sum, ad) => sum + ad.rt_clicks, 0),

      // Calculated totals
      total_profit: unifiedAds.reduce((sum, ad) => sum + ad.profit, 0)
    };

    // Calculate overall averages
    summary.overall_cpm = summary.total_impressions > 0
      ? (summary.total_spend / summary.total_impressions) * 1000
      : 0;
    summary.overall_cpc = summary.total_clicks > 0
      ? summary.total_spend / summary.total_clicks
      : 0;
    summary.overall_ctr = summary.total_impressions > 0
      ? (summary.total_clicks / summary.total_impressions) * 100
      : 0;
    summary.overall_cr = summary.total_rt_clicks > 0
      ? (summary.total_conversions / summary.total_rt_clicks) * 100
      : 0;
    summary.overall_epc = summary.total_rt_clicks > 0
      ? summary.total_revenue / summary.total_rt_clicks
      : 0;
    summary.overall_roas = summary.total_spend > 0
      ? summary.total_revenue / summary.total_spend
      : 0;
    summary.overall_roi = summary.total_spend > 0
      ? ((summary.total_profit / summary.total_spend) * 100)
      : 0;
    summary.overall_cost_per_conversion = summary.total_conversions > 0
      ? summary.total_spend / summary.total_conversions
      : 0;

    return summary;
  }

  /**
   * Get empty unified analytics result
   * @private
   */
  _getEmptyUnifiedAnalytics() {
    return {
      ads: [],
      editor_performance: [],
      summary: {
        total_ads: 0,
        ads_with_editor: 0,
        ads_without_editor: 0,
        ads_with_redtrack_data: 0,
        ads_without_redtrack_data: 0,
        total_spend: 0,
        total_impressions: 0,
        total_clicks: 0,
        total_revenue: 0,
        total_conversions: 0,
        total_approved_conversions: 0,
        total_rt_clicks: 0,
        total_profit: 0,
        overall_cpm: 0,
        overall_cpc: 0,
        overall_ctr: 0,
        overall_cr: 0,
        overall_epc: 0,
        overall_roas: 0,
        overall_roi: 0,
        overall_cost_per_conversion: 0
      },
      meta: {
        generated_at: new Date().toISOString()
      }
    };
  }
}

module.exports = new AnalyticsService();
