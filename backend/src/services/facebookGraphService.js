const axios = require('axios');
const logger = require('../utils/logger');

const FACEBOOK_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Facebook Graph API Service
 * Direct integration with Facebook Marketing API
 */
class FacebookGraphService {
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

      const response = await axios.get(
        `${FACEBOOK_GRAPH_API_URL}/${accountId}/campaigns`,
        { params }
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

      const response = await axios.get(
        `${FACEBOOK_GRAPH_API_URL}/${campaignId}/ads`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,name,status,created_time,updated_time,insights{spend,cpm,cpc,cost_per_action_type,impressions,clicks,actions,action_values}',
            limit: 1000
          }
        }
      );

      const ads = response.data.data || [];
      console.log(`✅ Found ${ads.length} ads in campaign ${campaignId}`);

      return ads;
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
   * Get ad accounts accessible by access token
   * @param {string} accessToken - Facebook access token
   * @returns {Promise<Array>} Ad accounts
   */
  async getAdAccounts(accessToken) {
    try {
      console.log('\n🏢 Fetching accessible ad accounts...');

      const response = await axios.get(
        `${FACEBOOK_GRAPH_API_URL}/me/adaccounts`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,name,account_id,account_status,currency,timezone_name',
            limit: 100
          }
        }
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

      const response = await axios.get(
        `${FACEBOOK_GRAPH_API_URL}/me`,
        {
          params: {
            access_token: accessToken,
            fields: 'id,name,email'
          }
        }
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

      const response = await axios.get(
        `${FACEBOOK_GRAPH_API_URL}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: process.env.FACEBOOK_APP_ID,
            client_secret: process.env.FACEBOOK_APP_SECRET,
            fb_exchange_token: shortLivedToken
          }
        }
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
