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
   * Query: editor_id, date_from, date_to, media_type (image/video)
   */
  async getEditorPerformance(req, res, next) {
    try {
      const userRole = req.user.role;
      const userId = req.user.id;

      const filters = {
        editor_id: req.query.editor_id,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        media_type: req.query.media_type // image or video
      };

      // If user is a creative (editor), automatically filter to show only their own analytics
      if (userRole === 'creative') {
        // Find the editor_id for this user
        const editorResult = await query(
          'SELECT id FROM editors WHERE user_id = $1 AND is_active = TRUE',
          [userId]
        );

        if (editorResult.rows.length === 0) {
          logger.warn('Editor profile not found for user', { userId });
          return res.json({
            success: true,
            data: []
          });
        }

        // Override filter to only show this editor's data
        filters.editor_id = editorResult.rows[0].id;
        logger.info('Editor viewing their own analytics', {
          userId,
          editorId: filters.editor_id
        });
      }

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
   * Get editor media uploads with filtering
   * GET /api/analytics/editor-media
   * Query: editor_id, date_from, date_to, media_type (image/video)
   */
  async getEditorMedia(req, res, next) {
    try {
      const { editor_id, date_from, date_to, media_type } = req.query;

      // Build query filters
      let whereConditions = ['mf.is_deleted = FALSE'];
      const params = [];
      let paramIndex = 1;

      if (editor_id) {
        whereConditions.push(`mf.editor_id = $${paramIndex}`);
        params.push(editor_id);
        paramIndex++;
      }

      if (date_from) {
        whereConditions.push(`mf.created_at >= $${paramIndex}`);
        params.push(date_from);
        paramIndex++;
      }

      if (date_to) {
        whereConditions.push(`mf.created_at <= $${paramIndex}`);
        params.push(date_to);
        paramIndex++;
      }

      if (media_type) {
        if (media_type.toLowerCase() === 'image') {
          whereConditions.push(`mf.file_type IN ('image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp')`);
        } else if (media_type.toLowerCase() === 'video') {
          whereConditions.push(`mf.file_type IN ('video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm')`);
        }
      }

      const whereClause = whereConditions.join(' AND ');

      const pool = require('../config/database');
      const result = await pool.query(
        `SELECT
           mf.id,
           mf.original_filename,
           mf.file_type,
           mf.file_size,
           mf.created_at,
           mf.editor_id,
           e.name as editor_name,
           e.display_name as editor_display_name,
           u.full_name as uploaded_by_name,
           COUNT(DISTINCT s.id) as share_count
         FROM media_files mf
         LEFT JOIN editors e ON mf.editor_id = e.id
         LEFT JOIN users u ON mf.created_by = u.id
         LEFT JOIN shares s ON mf.id = s.file_id
         WHERE ${whereClause}
         GROUP BY mf.id, e.name, e.display_name, u.full_name
         ORDER BY mf.created_at DESC
         LIMIT 1000`,
        params
      );

      // Calculate statistics
      const stats = {
        total_files: result.rows.length,
        total_size: result.rows.reduce((sum, row) => sum + (parseInt(row.file_size) || 0), 0),
        images: result.rows.filter(row => row.file_type?.startsWith('image')).length,
        videos: result.rows.filter(row => row.file_type?.startsWith('video')).length
      };

      res.json({
        success: true,
        data: {
          files: result.rows,
          stats,
          filters: { editor_id, date_from, date_to, media_type }
        }
      });
    } catch (error) {
      logger.error('Get editor media controller error', { error: error.message });
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

  /**
   * Stop ongoing sync operation
   * POST /api/analytics/sync/stop
   */
  async stopSync(req, res, next) {
    try {
      const userId = req.user.id;

      // Request stop for this user's sync
      analyticsService.requestStopSync(userId);

      logger.info('Sync stop requested', { userId });

      res.json({
        success: true,
        message: 'Stop signal sent. Sync will stop gracefully after completing the current operation.'
      });
    } catch (error) {
      logger.error('Stop sync controller error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new AnalyticsController();
