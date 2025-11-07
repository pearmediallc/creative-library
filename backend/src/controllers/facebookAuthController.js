const facebookGraphService = require('../services/facebookGraphService');
const FacebookAuth = require('../models/FacebookAuth');
const logger = require('../utils/logger');

/**
 * Facebook Authentication Controller
 * Handles Facebook OAuth and ad account management
 */
class FacebookAuthController {
  /**
   * Connect Facebook account and store access token
   * POST /api/facebook/connect
   * Body: { accessToken, adAccountId, adAccountName }
   */
  async connectFacebook(req, res) {
    try {
      console.log('\n🔗 ========== FACEBOOK CONNECT START ==========');
      console.log(`👤 User ID: ${req.user.id}`);

      const { accessToken, adAccountId, adAccountName } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          success: false,
          error: 'Access token is required'
        });
      }

      console.log('✅ Access token provided');

      // Validate token with Facebook
      console.log('🔐 Validating token with Facebook...');
      const fbUser = await facebookGraphService.validateToken(accessToken);
      console.log(`✅ Token valid for Facebook user: ${fbUser.name}`);

      // Exchange for long-lived token (60 days)
      console.log('🔄 Exchanging for long-lived token...');
      const longLivedToken = await facebookGraphService.getLongLivedToken(accessToken);
      console.log('✅ Long-lived token obtained');

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + longLivedToken.expires_in);

      // Store in database
      console.log('💾 Storing Facebook auth in database...');
      const authData = {
        accessToken: longLivedToken.access_token,
        tokenType: longLivedToken.token_type,
        expiresAt,
        adAccountId: adAccountId || null,
        adAccountName: adAccountName || null,
        isActive: true
      };

      const fbAuth = await FacebookAuth.upsertAuth(req.user.id, authData);
      console.log('✅ Facebook auth stored successfully');

      console.log('\n✅ ========== FACEBOOK CONNECT COMPLETE ==========\n');

      logger.info('Facebook account connected', {
        userId: req.user.id,
        fbUserId: fbUser.id,
        adAccountId: adAccountId || 'none'
      });

      res.json({
        success: true,
        data: {
          id: fbAuth.id,
          adAccountId: fbAuth.ad_account_id,
          adAccountName: fbAuth.ad_account_name,
          expiresAt: fbAuth.expires_at,
          fbUser: {
            id: fbUser.id,
            name: fbUser.name,
            email: fbUser.email
          }
        }
      });
    } catch (error) {
      console.error('\n❌ ========== FACEBOOK CONNECT FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('===============================================\n');

      logger.error('Facebook connect failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to connect Facebook account'
      });
    }
  }

  /**
   * Get accessible ad accounts for connected Facebook account
   * GET /api/facebook/ad-accounts
   */
  async getAdAccounts(req, res) {
    try {
      console.log('\n🏢 ========== GET AD ACCOUNTS START ==========');
      console.log(`👤 User ID: ${req.user.id}`);

      // Get user's Facebook access token
      const fbAuth = await FacebookAuth.getByUserId(req.user.id);

      if (!fbAuth || !fbAuth.access_token) {
        console.log('⚠️ No Facebook account connected');
        return res.status(400).json({
          success: false,
          error: 'Facebook account not connected. Please connect your Facebook account first.'
        });
      }

      console.log('✅ Facebook auth found');

      // Fetch ad accounts from Facebook
      const adAccounts = await facebookGraphService.getAdAccounts(fbAuth.access_token);

      console.log(`✅ Found ${adAccounts.length} ad accounts`);
      console.log('\n✅ ========== GET AD ACCOUNTS COMPLETE ==========\n');

      logger.info('Ad accounts fetched', {
        userId: req.user.id,
        accountCount: adAccounts.length
      });

      res.json({
        success: true,
        data: adAccounts
      });
    } catch (error) {
      console.error('\n❌ ========== GET AD ACCOUNTS FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('==============================================\n');

      logger.error('Get ad accounts failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch ad accounts'
      });
    }
  }

  /**
   * Update selected ad account for user
   * PUT /api/facebook/ad-account
   * Body: { adAccountId, adAccountName }
   */
  async updateAdAccount(req, res) {
    try {
      console.log('\n🔄 ========== UPDATE AD ACCOUNT START ==========');
      console.log(`👤 User ID: ${req.user.id}`);

      const { adAccountId, adAccountName } = req.body;

      if (!adAccountId) {
        return res.status(400).json({
          success: false,
          error: 'Ad account ID is required'
        });
      }

      console.log(`📊 Ad Account ID: ${adAccountId}`);
      console.log(`📊 Ad Account Name: ${adAccountName || 'Not provided'}`);

      // Get existing Facebook auth
      const fbAuth = await FacebookAuth.getByUserId(req.user.id);

      if (!fbAuth) {
        console.log('⚠️ No Facebook account connected');
        return res.status(400).json({
          success: false,
          error: 'Facebook account not connected'
        });
      }

      console.log('✅ Facebook auth found, updating ad account...');

      // Update ad account
      const authData = {
        accessToken: fbAuth.access_token,
        tokenType: fbAuth.token_type,
        expiresAt: fbAuth.expires_at,
        adAccountId,
        adAccountName: adAccountName || null,
        isActive: true
      };

      const updatedAuth = await FacebookAuth.upsertAuth(req.user.id, authData);
      console.log('✅ Ad account updated successfully');

      console.log('\n✅ ========== UPDATE AD ACCOUNT COMPLETE ==========\n');

      logger.info('Ad account updated', {
        userId: req.user.id,
        adAccountId
      });

      res.json({
        success: true,
        data: {
          id: updatedAuth.id,
          adAccountId: updatedAuth.ad_account_id,
          adAccountName: updatedAuth.ad_account_name
        }
      });
    } catch (error) {
      console.error('\n❌ ========== UPDATE AD ACCOUNT FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('================================================\n');

      logger.error('Update ad account failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update ad account'
      });
    }
  }

  /**
   * Get current Facebook connection status
   * GET /api/facebook/status
   */
  async getStatus(req, res) {
    try {
      console.log('\n📊 Checking Facebook connection status...');
      console.log(`👤 User ID: ${req.user.id}`);

      const fbAuth = await FacebookAuth.getByUserId(req.user.id);

      if (!fbAuth) {
        console.log('⚠️ No Facebook connection found');
        return res.json({
          success: true,
          data: {
            connected: false
          }
        });
      }

      console.log('✅ Facebook connection found');
      console.log(`  └─ Ad Account: ${fbAuth.ad_account_id || 'Not selected'}`);
      console.log(`  └─ Expires: ${fbAuth.expires_at}`);

      const now = new Date();
      const isExpired = new Date(fbAuth.expires_at) < now;

      if (isExpired) {
        console.log('⚠️ Access token has expired');
      }

      res.json({
        success: true,
        data: {
          connected: true,
          adAccountId: fbAuth.ad_account_id,
          adAccountName: fbAuth.ad_account_name,
          expiresAt: fbAuth.expires_at,
          isExpired,
          isActive: fbAuth.is_active
        }
      });
    } catch (error) {
      console.error('❌ Failed to get Facebook status:', error.message);
      logger.error('Get Facebook status failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to check Facebook connection status'
      });
    }
  }

  /**
   * Disconnect Facebook account
   * DELETE /api/facebook/disconnect
   */
  async disconnect(req, res) {
    try {
      console.log('\n🔌 ========== FACEBOOK DISCONNECT START ==========');
      console.log(`👤 User ID: ${req.user.id}`);

      const fbAuth = await FacebookAuth.getByUserId(req.user.id);

      if (!fbAuth) {
        console.log('⚠️ No Facebook connection to disconnect');
        return res.json({
          success: true,
          message: 'No Facebook connection found'
        });
      }

      console.log('🗑️ Deleting Facebook connection...');
      await FacebookAuth.delete(fbAuth.id);
      console.log('✅ Facebook connection deleted');

      console.log('\n✅ ========== FACEBOOK DISCONNECT COMPLETE ==========\n');

      logger.info('Facebook account disconnected', {
        userId: req.user.id
      });

      res.json({
        success: true,
        message: 'Facebook account disconnected successfully'
      });
    } catch (error) {
      console.error('\n❌ ========== FACEBOOK DISCONNECT FAILED ==========');
      console.error(`Error: ${error.message}`);
      console.error('==================================================\n');

      logger.error('Facebook disconnect failed', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to disconnect Facebook account'
      });
    }
  }
}

module.exports = new FacebookAuthController();
