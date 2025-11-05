const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');

class AnalyticsController {
  /**
   * Sync Facebook ads
   * POST /api/analytics/sync
   * Body: { ad_account_id }
   */
  async syncAds(req, res, next) {
    try {
      const { ad_account_id } = req.body;

      if (!ad_account_id) {
        return res.status(400).json({
          success: false,
          error: 'ad_account_id is required'
        });
      }

      const result = await analyticsService.syncFacebookAds(
        ad_account_id,
        req.user.id
      );

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
}

module.exports = new AnalyticsController();
