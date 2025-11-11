const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');

class AnalyticsController {
  /**
   * Sync Facebook ads
   * POST /api/analytics/sync
   * Body: { ad_account_id }
   */
  async syncAds(req, res, next) {
    try {
      const { ad_account_id, date_from, date_to } = req.body;

      if (!ad_account_id) {
        return res.status(400).json({
          success: false,
          error: 'ad_account_id is required'
        });
      }

      // Validate dates if provided
      if (date_from && date_to) {
        const fromDate = new Date(date_from);
        const toDate = new Date(date_to);

        if (fromDate > toDate) {
          return res.status(400).json({
            success: false,
            error: 'date_from must be before or equal to date_to'
          });
        }

        console.log(`📅 Date filter: ${date_from} to ${date_to}`);
      } else if (!date_from && !date_to) {
        console.log(`📅 No date filter - fetching all ads`);
      }

      const result = await analyticsService.syncFacebookAds(
        ad_account_id,
        req.user.id,
        date_from,
        date_to
      );

      // Log analytics sync activity
      await logActivity({
        req,
        actionType: 'analytics_sync',
        resourceType: 'facebook_ads',
        resourceId: null,
        resourceName: `Ad Account ${ad_account_id}`,
        details: {
          ad_account_id,
          date_from,
          date_to,
          ads_synced: result.total,
          new_ads: result.new,
          updated_ads: result.updated,
          skipped_ads: result.skipped
        },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Ads synced successfully',
        data: result
      });
    } catch (error) {
      logger.error('Sync ads controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get editor performance analytics
   * GET /api/analytics/editor-performance
   * Query: editor_id, date_from, date_to
   */
  async getEditorPerformance(req, res, next) {
    try {
      const filters = {
        editor_id: req.query.editor_id,
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      const data = await analyticsService.getEditorPerformance(filters);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Get editor performance controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get ads without editor assignment
   * GET /api/analytics/ads-without-editor
   */
  async getAdsWithoutEditor(req, res, next) {
    try {
      const data = await analyticsService.getAdsWithoutEditor();

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Get ads without editor controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get ad name change history
   * GET /api/analytics/ad-name-changes
   * Query: editor_changed, date_from
   */
  async getAdNameChanges(req, res, next) {
    try {
      const filters = {
        editor_changed: req.query.editor_changed === 'true',
        date_from: req.query.date_from
      };

      const data = await analyticsService.getAdNameChanges(filters);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Get ad name changes controller error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get unified analytics (Facebook Ads + RedTrack)
   * GET /api/analytics/unified
   * Query: ad_account_id (required), date_from, date_to, bulk_fetch
   */
  async getUnifiedAnalytics(req, res, next) {
    try {
      const { ad_account_id, date_from, date_to, bulk_fetch } = req.query;

      if (!ad_account_id) {
        return res.status(400).json({
          success: false,
          error: 'ad_account_id is required'
        });
      }

      // Validate dates if provided
      if (date_from && date_to) {
        const fromDate = new Date(date_from);
        const toDate = new Date(date_to);

        if (fromDate > toDate) {
          return res.status(400).json({
            success: false,
            error: 'date_from must be before or equal to date_to'
          });
        }
      }

      // Parse bulk_fetch parameter
      const useBulkFetch = bulk_fetch === 'true' ? true : bulk_fetch === 'false' ? false : null;

      console.log(`\n📊 Unified analytics request:`);
      console.log(`   Ad Account: ${ad_account_id}`);
      console.log(`   Date Range: ${date_from || 'all time'} to ${date_to || 'now'}`);
      console.log(`   Bulk Fetch: ${useBulkFetch === null ? 'auto' : useBulkFetch}`);

      const result = await analyticsService.getUnifiedAnalytics(
        ad_account_id,
        req.user.id,
        date_from,
        date_to,
        useBulkFetch
      );

      // Log unified analytics activity
      await logActivity({
        req,
        actionType: 'unified_analytics',
        resourceType: 'analytics',
        resourceId: null,
        resourceName: `Unified Analytics - ${ad_account_id}`,
        details: {
          ad_account_id,
          date_from,
          date_to,
          total_ads: result.summary.total_ads,
          total_spend: result.summary.total_spend,
          total_revenue: result.summary.total_revenue,
          total_profit: result.summary.total_profit
        },
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Unified analytics generated successfully',
        data: result
      });
    } catch (error) {
      logger.error('Unified analytics controller error', { error: error.message });

      // Log failed activity
      await logActivity({
        req,
        actionType: 'unified_analytics',
        resourceType: 'analytics',
        resourceId: null,
        resourceName: `Unified Analytics - ${req.query.ad_account_id}`,
        details: {
          error: error.message
        },
        status: 'failure'
      }).catch(logError => {
        logger.error('Failed to log activity', { error: logError.message });
      });

      next(error);
    }
  }
}

module.exports = new AnalyticsController();
