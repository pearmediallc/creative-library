const axios = require('axios');
const { query, transaction } = require('../config/database');
const adNameParser = require('./adNameParser');
const logger = require('../utils/logger');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

/**
 * Analytics Service
 * Fetches Facebook ad data via Python service and processes it
 */
class AnalyticsService {
  /**
   * Sync Facebook ads for an account
   * @param {string} adAccountId - Facebook ad account ID
   * @param {string} userId - User ID (for auth check)
   * @returns {Promise<Object>} Sync result
   */
  async syncFacebookAds(adAccountId, userId) {
    try {
      logger.info('Starting Facebook ad sync', { adAccountId, userId });

      // Fetch campaigns from Python service
      const campaignsResponse = await axios.post(
        `${PYTHON_SERVICE_URL}/api/facebook/get-campaigns`,
        { ad_account_id: adAccountId },
        { headers: { 'X-User-ID': userId } }
      );

      const campaigns = campaignsResponse.data.campaigns || [];
      logger.info('Fetched campaigns', { count: campaigns.length });

      let totalAdsProcessed = 0;
      let adsWithEditor = 0;
      let adsWithoutEditor = 0;

      // Process each campaign
      for (const campaign of campaigns) {
        const adsResponse = await axios.post(
          `${PYTHON_SERVICE_URL}/api/facebook/get-campaign-ads`,
          {
            ad_account_id: adAccountId,
            campaign_id: campaign.id
          },
          { headers: { 'X-User-ID': userId } }
        );

        const ads = adsResponse.data.ads || [];
        logger.info('Fetched ads for campaign', { campaignId: campaign.id, adCount: ads.length });

        // Process ads in batch
        for (const ad of ads) {
          const processed = await this._processAndStoreAd(ad, campaign, adAccountId);
          totalAdsProcessed++;

          if (processed.hasEditor) {
            adsWithEditor++;
          } else {
            adsWithoutEditor++;
          }
        }
      }

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
      // Extract editor from ad name
      const editorMatch = await adNameParser.extractEditorFromAdName(ad.name);

      // Extract insights
      const insights = ad.insights?.data?.[0] || {};
      const spend = parseFloat(insights.spend) || 0;
      const cpm = parseFloat(insights.cpm) || 0;
      const cpc = parseFloat(insights.cpc) || 0;
      const costPerResult = parseFloat(insights.cost_per_result) || 0;
      const impressions = parseInt(insights.impressions) || 0;
      const clicks = parseInt(insights.clicks) || 0;

      // Check if ad already exists
      const existingAdResult = await query(
        'SELECT id, ad_name FROM facebook_ads WHERE fb_ad_id = $1',
        [ad.id]
      );

      if (existingAdResult.rows.length > 0) {
        // Update existing ad
        const existingAd = existingAdResult.rows[0];
        const oldAdName = existingAd.ad_name;

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
          await this._logAdNameChange(ad.id, oldAdName, ad.name);
        }
      } else {
        // Insert new ad
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
        hasEditor: !!editorMatch
      };
    } catch (error) {
      logger.error('Failed to process ad', { error: error.message, adId: ad.id });
      return { hasEditor: false };
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
