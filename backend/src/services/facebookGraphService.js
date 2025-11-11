const axios = require('axios');
const logger = require('../utils/logger');

const FACEBOOK_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

// Rate limiting: Facebook allows ~200 calls per hour per user
// To be safe, we'll limit to 20 calls per minute (1200 per hour)
const RATE_LIMIT_DELAY_MS = 3000; // 3 seconds = 20 requests per minute

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Facebook Graph API Service
 * Direct integration with Facebook Marketing API
 */
class FacebookGraphService {
  constructor() {
    this.lastRequestTime = 0;
  }

  /**
   * Rate limit API calls to avoid Facebook rate limiting
   * @private
   */
  async _rateLimitedRequest(requestFn) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
      const delay = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
      console.log(`      ⏳ Rate limiting: waiting ${delay}ms before next request...`);
      await sleep(delay);
    }

    this.lastRequestTime = Date.now();
    return await requestFn();
  }
  /**
   * Get campaigns from ad account
   * @param {string} adAccountId - Ad account ID (with or without act_ prefix)
   * @param {string} accessToken - Facebook access token
   * @param {string} dateFrom - Optional start date (YYYY-MM-DD)
   * @param {string} dateTo - Optional end date (YYYY-MM-DD)
   * @returns {Promise<Array>} Campaigns
   */
  async getCampaigns(adAccountId, accessToken, dateFrom = null, dateTo = null) {
    try {
      // Ensure ad account ID has act_ prefix
      const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

      console.log(`\n📊 Fetching campaigns for account: ${accountId}`);

      const params = {
        access_token: accessToken,
        fields: 'id,name,status,objective,created_time,updated_time',
        limit: 1000
      };

      // Add date filtering if provided
      if (dateFrom && dateTo) {
        const fromTimestamp = Math.floor(new Date(dateFrom).getTime() / 1000);
        const toTimestamp = Math.floor(new Date(dateTo).getTime() / 1000);

        console.log(`📅 Applying date filter: ${dateFrom} to ${dateTo}`);
        console.log(`   Unix timestamps: ${fromTimestamp} to ${toTimestamp}`);

        params.filtering = JSON.stringify([
          {
            field: 'updated_time',
            operator: 'GREATER_THAN',
            value: fromTimestamp
          },
          {
            field: 'updated_time',
            operator: 'LESS_THAN',
            value: toTimestamp
          }
        ]);
      }

      const response = await this._rateLimitedRequest(() =>
        axios.get(
          `${FACEBOOK_GRAPH_API_URL}/${accountId}/campaigns`,
          { params }
        )
      );

      const campaigns = response.data.data || [];
      console.log(`✅ Found ${campaigns.length} campaigns`);

      return campaigns;
    } catch (error) {
      console.error('❌ Failed to fetch campaigns:', error.response?.data || error.message);
      logger.error('Get campaigns failed', {
        error: error.message,
        responseData: error.response?.data,
        adAccountId
      });
      throw new Error(`Failed to fetch campaigns: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get ads from campaign with insights
   * @param {string} campaignId - Campaign ID
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Array>} Ads with insights
   */
  async getCampaignAds(campaignId, accessToken) {
    try {
      console.log(`\n📢 Fetching ads for campaign: ${campaignId}`);

      let allAds = [];
      let currentPage = 1;
      let nextUrl = `${FACEBOOK_GRAPH_API_URL}/${campaignId}/ads`;
      let hasMore = true;

      const params = {
        access_token: accessToken,
        fields: 'id,name,status,created_time,updated_time,insights{spend,cpm,cpc,cost_per_action_type,impressions,clicks,actions,action_values}',
        limit: 1000
      };

      // Fetch all pages of ads using pagination
      while (hasMore) {
        console.log(`   📄 Fetching page ${currentPage} of ads...`);

        const response = await this._rateLimitedRequest(() =>
          axios.get(nextUrl, {
            params: currentPage === 1 ? params : { access_token: accessToken }
          })
        );

        const ads = response.data.data || [];
        console.log(`   ✅ Page ${currentPage}: Found ${ads.length} ads`);

        // Log each ad name for visibility
        if (ads.length > 0) {
          ads.forEach((ad, idx) => {
            console.log(`      ${idx + 1}. Ad ID: ${ad.id} | Name: "${ad.name}" | Status: ${ad.status}`);
          });
        }

        allAds = allAds.concat(ads);

        // Check if there's a next page
        if (response.data.paging && response.data.paging.next) {
          nextUrl = response.data.paging.next;
          currentPage++;
          console.log(`   ➡️  More ads available, fetching next page...`);
        } else {
          hasMore = false;
          console.log(`   ✅ No more pages - completed fetching all ads`);
        }
      }

      console.log(`\n✅ Total ads fetched for campaign ${campaignId}: ${allAds.length} ads across ${currentPage} page(s)`);

      return allAds;
    } catch (error) {
      console.error(`❌ Failed to fetch ads for campaign ${campaignId}:`, error.response?.data || error.message);
      logger.error('Get campaign ads failed', {
        error: error.message,
        responseData: error.response?.data,
        campaignId
      });

      // Don't throw error for individual campaign failures - return empty array
      return [];
    }
  }

  /**
   * Get ad sets from campaign with pagination
   * @param {string} campaignId - Campaign ID
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Array>} Ad sets
   */
  async getCampaignAdSets(campaignId, accessToken) {
    try {
      console.log(`\n   📦 Fetching ad sets for campaign: ${campaignId}`);

      let allAdSets = [];
      let currentPage = 1;
      let nextUrl = `${FACEBOOK_GRAPH_API_URL}/${campaignId}/adsets`;
      let hasMore = true;

      const params = {
        access_token: accessToken,
        fields: 'id,name,status,created_time,updated_time,daily_budget,lifetime_budget',
        limit: 1000
      };

      // Fetch all pages of ad sets using pagination
      while (hasMore) {
        console.log(`      📄 Fetching page ${currentPage} of ad sets...`);

        const response = await this._rateLimitedRequest(() =>
          axios.get(nextUrl, {
            params: currentPage === 1 ? params : { access_token: accessToken }
          })
        );

        const adSets = response.data.data || [];
        console.log(`      ✅ Page ${currentPage}: Found ${adSets.length} ad sets`);

        // Log each ad set name for visibility
        if (adSets.length > 0) {
          adSets.forEach((adSet, idx) => {
            console.log(`         ${idx + 1}. Ad Set ID: ${adSet.id} | Name: "${adSet.name}" | Status: ${adSet.status}`);
          });
        }

        allAdSets = allAdSets.concat(adSets);

        // Check if there's a next page
        if (response.data.paging && response.data.paging.next) {
          nextUrl = response.data.paging.next;
          currentPage++;
          console.log(`      ➡️  More ad sets available, fetching next page...`);
        } else {
          hasMore = false;
          console.log(`      ✅ No more pages - completed fetching all ad sets`);
        }
      }

      console.log(`\n   ✅ Total ad sets fetched: ${allAdSets.length} ad sets across ${currentPage} page(s)`);

      return allAdSets;
    } catch (error) {
      console.error(`   ❌ Failed to fetch ad sets for campaign ${campaignId}:`, error.response?.data || error.message);
      logger.error('Get campaign ad sets failed', {
        error: error.message,
        responseData: error.response?.data,
        campaignId
      });

      // Don't throw error for individual campaign failures - return empty array
      return [];
    }
  }

  /**
   * Get ads from ad set with insights and pagination
   * @param {string} adSetId - Ad Set ID
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Array>} Ads with insights
   */
  async getAdSetAds(adSetId, accessToken) {
    try {
      console.log(`\n      📢 Fetching ads for ad set: ${adSetId}`);

      let allAds = [];
      let currentPage = 1;
      let nextUrl = `${FACEBOOK_GRAPH_API_URL}/${adSetId}/ads`;
      let hasMore = true;

      const params = {
        access_token: accessToken,
        fields: 'id,name,status,created_time,updated_time,insights{spend,cpm,cpc,cost_per_action_type,impressions,clicks,actions,action_values}',
        limit: 1000
      };

      // Fetch all pages of ads using pagination
      while (hasMore) {
        console.log(`         📄 Fetching page ${currentPage} of ads...`);

        const response = await this._rateLimitedRequest(() =>
          axios.get(nextUrl, {
            params: currentPage === 1 ? params : { access_token: accessToken }
          })
        );

        const ads = response.data.data || [];
        console.log(`         ✅ Page ${currentPage}: Found ${ads.length} ads`);

        // Log each ad name for visibility
        if (ads.length > 0) {
          ads.forEach((ad, idx) => {
            console.log(`            ${idx + 1}. Ad ID: ${ad.id} | Name: "${ad.name}" | Status: ${ad.status}`);
          });
        }

        allAds = allAds.concat(ads);

        // Check if there's a next page
        if (response.data.paging && response.data.paging.next) {
          nextUrl = response.data.paging.next;
          currentPage++;
          console.log(`         ➡️  More ads available, fetching next page...`);
        } else {
          hasMore = false;
          console.log(`         ✅ No more pages - completed fetching all ads`);
        }
      }

      console.log(`\n      ✅ Total ads fetched: ${allAds.length} ads across ${currentPage} page(s)`);

      return allAds;
    } catch (error) {
      console.error(`      ❌ Failed to fetch ads for ad set ${adSetId}:`, error.response?.data || error.message);
      logger.error('Get ad set ads failed', {
        error: error.message,
        responseData: error.response?.data,
        adSetId
      });

      // Don't throw error for individual ad set failures - return empty array
      return [];
    }
  }

  /**
   * Get ad accounts accessible by access token
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Array>} Ad accounts
   */
  async getAdAccounts(accessToken) {
    try {
      console.log('\n🏢 Fetching accessible ad accounts...');

      const response = await this._rateLimitedRequest(() =>
        axios.get(
          `${FACEBOOK_GRAPH_API_URL}/me/adaccounts`,
          {
            params: {
              access_token: accessToken,
              fields: 'id,name,account_id,account_status,currency,timezone_name',
              limit: 100
            }
          }
        )
      );

      const accounts = response.data.data || [];
      console.log(`✅ Found ${accounts.length} ad accounts`);

      return accounts;
    } catch (error) {
      console.error('❌ Failed to fetch ad accounts:', error.response?.data || error.message);
      logger.error('Get ad accounts failed', {
        error: error.message,
        responseData: error.response?.data
      });
      throw new Error(`Failed to fetch ad accounts: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Validate Facebook access token
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Object>} Token info
   */
  async validateToken(accessToken) {
    try {
      console.log('\n🔐 Validating Facebook access token...');

      const response = await this._rateLimitedRequest(() =>
        axios.get(
          `${FACEBOOK_GRAPH_API_URL}/me`,
          {
            params: {
              access_token: accessToken,
              fields: 'id,name,email'
            }
          }
        )
      );

      console.log(`✅ Token valid for user: ${response.data.name}`);

      return response.data;
    } catch (error) {
      console.error('❌ Token validation failed:', error.response?.data || error.message);
      logger.error('Validate token failed', {
        error: error.message,
        responseData: error.response?.data
      });
      throw new Error(`Invalid access token: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get long-lived access token
   * @param {string} shortLivedToken - Short-lived access token
   * @returns {Promise<Object>} Long-lived token data
   */
  async getLongLivedToken(shortLivedToken) {
    try {
      if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
        throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set in environment variables');
      }

      console.log('\n🔄 Exchanging for long-lived token...');

      const response = await this._rateLimitedRequest(() =>
        axios.get(
          `${FACEBOOK_GRAPH_API_URL}/oauth/access_token`,
          {
            params: {
              grant_type: 'fb_exchange_token',
              client_id: process.env.FACEBOOK_APP_ID,
              client_secret: process.env.FACEBOOK_APP_SECRET,
              fb_exchange_token: shortLivedToken
            }
          }
        )
      );

      console.log('✅ Long-lived token obtained');

      return {
        access_token: response.data.access_token,
        token_type: response.data.token_type || 'Bearer',
        expires_in: response.data.expires_in || 5184000 // 60 days default
      };
    } catch (error) {
      console.error('❌ Failed to get long-lived token:', error.response?.data || error.message);
      logger.error('Get long-lived token failed', {
        error: error.message,
        responseData: error.response?.data
      });
      throw new Error(`Failed to get long-lived token: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

module.exports = new FacebookGraphService();
