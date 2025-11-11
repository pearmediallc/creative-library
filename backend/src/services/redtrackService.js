const axios = require('axios');
const logger = require('../utils/logger');

/**
 * RedTrack API Service
 * Integrates with RedTrack to fetch conversion and revenue data
 * Uses sub1 parameter (Facebook ad ID) as the linking key
 */
class RedTrackService {
  constructor() {
    this.baseURL = process.env.REDTRACK_API_URL || 'https://api.redtrack.io';
    this.apiKey = process.env.REDTRACK_API_KEY;
    this.rateLimitDelay = 3000; // 3 seconds between requests (20 RPM = 3s delay)
  }

  /**
   * Get traffic report data filtered by sub1 (ad ID)
   * @param {string} adId - Facebook ad ID (passed as sub1)
   * @param {string} dateFrom - Start date (YYYY-MM-DD)
   * @param {string} dateTo - End date (YYYY-MM-DD)
   * @returns {Promise<Object>} RedTrack metrics for this ad
   */
  async getAdMetrics(adId, dateFrom = null, dateTo = null) {
    try {
      if (!this.apiKey) {
        logger.warn('RedTrack API key not configured');
        return this._getEmptyMetrics(adId, 'API key not configured');
      }

      console.log(`\n🔍 Fetching RedTrack metrics for ad: ${adId}`);
      console.log(`   Date range: ${dateFrom || 'all time'} to ${dateTo || 'now'}`);

      // Prepare request parameters according to RedTrack API documentation
      const params = {
        api_key: this.apiKey,
        group: 'sub1', // Group by sub1 to get per-ad metrics
        date_from: dateFrom || this._getDefaultDateFrom(),
        date_to: dateTo || this._getDefaultDateTo(),
        sub1: adId, // Filter by specific ad ID
        per: 1000, // Max results per page
        total: true, // Include total stats
        timezone: 'UTC'
      };

      console.log(`   Request params:`, { ...params, api_key: '***' });

      const response = await axios.get(`${this.baseURL}/report`, {
        params,
        timeout: 30000, // 30 second timeout
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log(`   ✅ RedTrack response received`);

      // Parse response - RedTrack returns data in specific format
      const data = this._parseRedTrackResponse(response.data, adId);

      console.log(`   📊 Parsed metrics:`, {
        revenue: data.revenue,
        conversions: data.conversions,
        clicks: data.clicks,
        lp_clicks: data.lp_clicks,
        lp_views: data.lp_views
      });

      return data;

    } catch (error) {
      console.error(`   ❌ RedTrack API error for ad ${adId}:`, error.message);

      if (error.response) {
        logger.error('RedTrack API error response', {
          status: error.response.status,
          data: error.response.data,
          adId
        });
      } else {
        logger.error('RedTrack API error', { error: error.message, adId });
      }

      return this._getEmptyMetrics(adId, error.message);
    }
  }

  /**
   * Batch fetch metrics for multiple ad IDs with rate limiting
   * @param {Array<string>} adIds - Array of Facebook ad IDs
   * @param {string} dateFrom - Start date (YYYY-MM-DD)
   * @param {string} dateTo - End date (YYYY-MM-DD)
   * @returns {Promise<Map>} Map of adId -> metrics
   */
  async getBatchAdMetrics(adIds, dateFrom = null, dateTo = null) {
    console.log(`\n🚀 ========== REDTRACK BATCH FETCH START ==========`);
    console.log(`📊 Fetching metrics for ${adIds.length} ad(s)`);
    console.log(`📅 Date range: ${dateFrom || 'all time'} to ${dateTo || 'now'}`);

    const results = new Map();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < adIds.length; i++) {
      const adId = adIds[i];
      console.log(`\n[${i + 1}/${adIds.length}] Processing ad: ${adId}`);

      try {
        const metrics = await this.getAdMetrics(adId, dateFrom, dateTo);
        results.set(adId, metrics);

        if (metrics.error) {
          errorCount++;
        } else {
          successCount++;
        }

        // Rate limiting: Wait 3 seconds between requests (20 RPM limit)
        if (i < adIds.length - 1) {
          console.log(`   ⏳ Rate limit delay: waiting ${this.rateLimitDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
        }

      } catch (error) {
        console.error(`   ❌ Failed to fetch metrics for ad ${adId}:`, error.message);
        results.set(adId, this._getEmptyMetrics(adId, error.message));
        errorCount++;
      }
    }

    console.log(`\n✅ ========== REDTRACK BATCH FETCH COMPLETE ==========`);
    console.log(`📊 Results: ${successCount} successful, ${errorCount} errors`);
    console.log(`================================================\n`);

    logger.info('RedTrack batch fetch completed', {
      totalAds: adIds.length,
      successCount,
      errorCount
    });

    return results;
  }

  /**
   * Get aggregated metrics for multiple ads (bulk report)
   * More efficient for large datasets - fetches all at once without filtering by individual ad
   * @param {Array<string>} adIds - Array of ad IDs to fetch (optional, for validation)
   * @param {string} dateFrom - Start date (YYYY-MM-DD)
   * @param {string} dateTo - End date (YYYY-MM-DD)
   * @returns {Promise<Map>} Map of adId -> metrics
   */
  async getBulkAdMetrics(adIds = null, dateFrom = null, dateTo = null) {
    try {
      if (!this.apiKey) {
        logger.warn('RedTrack API key not configured');
        return new Map();
      }

      console.log(`\n🚀 Fetching bulk RedTrack report (grouped by sub1)`);

      const params = {
        api_key: this.apiKey,
        group: 'sub1', // Group by sub1 (ad ID)
        date_from: dateFrom || this._getDefaultDateFrom(),
        date_to: dateTo || this._getDefaultDateTo(),
        per: 1000, // Max results
        total: true,
        timezone: 'UTC'
      };

      const response = await axios.get(`${this.baseURL}/report`, {
        params,
        timeout: 60000, // 60 second timeout for bulk
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log(`   ✅ Bulk report received`);

      // Parse all results
      const results = new Map();
      const data = response.data?.data || [];

      data.forEach(row => {
        const adId = row.sub1;
        if (adId) {
          const metrics = this._parseRedTrackRow(row, adId);
          results.set(adId, metrics);
        }
      });

      console.log(`   📊 Parsed ${results.size} ad(s) from bulk report`);

      return results;

    } catch (error) {
      logger.error('RedTrack bulk fetch error', { error: error.message });
      console.error(`   ❌ Bulk fetch failed:`, error.message);
      return new Map();
    }
  }

  /**
   * Parse RedTrack API response
   * @private
   */
  _parseRedTrackResponse(responseData, adId) {
    try {
      // RedTrack returns: { data: [...], total: {...} }
      const rows = responseData.data || [];

      if (rows.length === 0) {
        console.log(`   ℹ️ No data found in RedTrack for ad ${adId}`);
        return this._getEmptyMetrics(adId, 'No data found');
      }

      // If filtered by sub1, should only have one row
      const row = rows[0];
      return this._parseRedTrackRow(row, adId);

    } catch (error) {
      logger.error('Failed to parse RedTrack response', { error: error.message, adId });
      return this._getEmptyMetrics(adId, 'Parse error');
    }
  }

  /**
   * Parse a single RedTrack data row
   * @private
   */
  _parseRedTrackRow(row, adId) {
    return {
      ad_id: adId,

      // Revenue metrics
      revenue: parseFloat(row.revenue) || 0,
      cost: parseFloat(row.cost) || 0,
      profit: parseFloat(row.profit) || 0,

      // Conversion metrics
      conversions: parseInt(row.conversions) || 0,
      approved_conversions: parseInt(row.approved_conversions) || 0,
      rejected_conversions: parseInt(row.rejected_conversions) || 0,
      pending_conversions: parseInt(row.pending_conversions) || 0,

      // Traffic metrics
      clicks: parseInt(row.clicks) || 0,
      lp_clicks: parseInt(row.lp_clicks) || 0, // Landing page clicks
      lp_views: parseInt(row.lp_views) || 0,   // Landing page views

      // Performance metrics
      cr: parseFloat(row.cr) || 0,              // Conversion rate
      epc: parseFloat(row.epc) || 0,            // Earnings per click
      roi: parseFloat(row.roi) || 0,            // Return on investment
      epv: parseFloat(row.epv) || 0,            // Earnings per view

      // CTR metrics
      lp_ctr: parseFloat(row.lp_ctr) || 0,      // Landing page CTR
      offer_ctr: parseFloat(row.offer_ctr) || 0, // Offer CTR

      error: null
    };
  }

  /**
   * Get empty metrics object (for errors or no data)
   * @private
   */
  _getEmptyMetrics(adId, errorMessage = null) {
    return {
      ad_id: adId,
      revenue: 0,
      cost: 0,
      profit: 0,
      conversions: 0,
      approved_conversions: 0,
      rejected_conversions: 0,
      pending_conversions: 0,
      clicks: 0,
      lp_clicks: 0,
      lp_views: 0,
      cr: 0,
      epc: 0,
      roi: 0,
      epv: 0,
      lp_ctr: 0,
      offer_ctr: 0,
      error: errorMessage
    };
  }

  /**
   * Get default date from (30 days ago)
   * @private
   */
  _getDefaultDateFrom() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  /**
   * Get default date to (today)
   * @private
   */
  _getDefaultDateTo() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Test RedTrack API connection
   * @returns {Promise<Object>} Connection test result
   */
  async testConnection() {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'RedTrack API key not configured'
        };
      }

      console.log('🔍 Testing RedTrack API connection...');

      const params = {
        api_key: this.apiKey,
        group: 'sub1',
        date_from: this._getDefaultDateFrom(),
        date_to: this._getDefaultDateTo(),
        per: 1,
        timezone: 'UTC'
      };

      const response = await axios.get(`${this.baseURL}/report`, {
        params,
        timeout: 10000
      });

      console.log('✅ RedTrack API connection successful');

      return {
        success: true,
        message: 'Connected to RedTrack API',
        dataAvailable: response.data?.data?.length > 0
      };

    } catch (error) {
      console.error('❌ RedTrack API connection failed:', error.message);

      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      };
    }
  }
}

module.exports = new RedTrackService();
