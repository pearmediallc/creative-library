const analyticsService = require('../services/analyticsService');
const logger = require('../utils/logger');
const { logActivity } = require('../middleware/activityLogger');
const { query } = require('../config/database');

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

  /**
   * Get vertical-based dashboard analytics
   * Shows counts and progress for each vertical
   * Admin sees all verticals, vertical heads see only their assigned verticals
   */
  async getVerticalDashboard(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // Get user's assigned verticals if they are a vertical head
      let assignedVerticals = [];
      if (userRole !== 'admin') {
        const verticalHeadsResult = await query(
          `SELECT vertical FROM vertical_heads WHERE head_editor_id = $1`,
          [userId]
        );
        assignedVerticals = verticalHeadsResult.rows.map(r => r.vertical);

        if (assignedVerticals.length === 0) {
          // Not a vertical head and not admin - no access
          return res.json({ success: true, data: [] });
        }
      }

      // Build vertical filter condition (case-insensitive)
      const verticalFilter = userRole === 'admin'
        ? ''
        : `AND LOWER(frv.vertical) = ANY(ARRAY[${assignedVerticals.map((_, i) => `LOWER($${i + 1})`).join(',')}]::text[])`;
      const queryParams = userRole === 'admin' ? [] : assignedVerticals;

      // File Requests analytics by vertical
      const fileRequestsQuery = `
        SELECT
          frv.vertical,
          COUNT(DISTINCT fr.id) as total_requests,
          COUNT(DISTINCT fr.id) FILTER (WHERE fr.request_type LIKE '%Video%' OR fr.request_type LIKE '%video%') as video_requests,
          COUNT(DISTINCT fr.id) FILTER (WHERE fr.status IN ('open', 'in_progress', 'uploaded')) as pending_requests,
          COUNT(DISTINCT fr.id) FILTER (WHERE fr.status = 'launched') as launched_requests,
          COUNT(DISTINCT fr.id) FILTER (WHERE fr.status = 'closed') as closed_requests,
          STRING_AGG(DISTINCT e.display_name, ', ') as editors_working,
          COALESCE(SUM(fre.num_creatives_assigned), 0) as total_creatives,
          COALESCE(SUM(fre.creatives_completed), 0) as completed_creatives
        FROM file_request_verticals frv
        JOIN file_requests fr ON fr.id = frv.file_request_id
        LEFT JOIN file_request_editors fre ON fre.request_id = fr.id AND fre.status IN ('pending', 'accepted', 'in_progress')
        LEFT JOIN editors e ON e.id = fre.editor_id
        WHERE fr.is_active = TRUE
        ${verticalFilter}
        GROUP BY frv.vertical
        ORDER BY total_requests DESC
      `;

      const fileRequestsResult = await query(fileRequestsQuery, queryParams);

      // Launch Requests analytics by vertical
      const launchRequestsQuery = `
        SELECT
          lrv.vertical,
          COUNT(DISTINCT lr.id) as total_requests,
          COUNT(DISTINCT lr.id) FILTER (WHERE lr.request_type LIKE '%Video%' OR lr.request_type LIKE '%video%') as video_requests,
          COUNT(DISTINCT lr.id) FILTER (WHERE lr.status IN ('draft', 'pending_review', 'in_production', 'ready_to_launch', 'buyer_assigned')) as pending_requests,
          COUNT(DISTINCT lr.id) FILTER (WHERE lr.status = 'launched') as launched_requests,
          COUNT(DISTINCT lr.id) FILTER (WHERE lr.status = 'closed') as closed_requests,
          STRING_AGG(DISTINCT e.display_name, ', ') as editors_working,
          COALESCE(SUM(lre.num_creatives_assigned), 0) as total_creatives,
          COALESCE(SUM(lre.creatives_completed), 0) as completed_creatives
        FROM launch_request_verticals lrv
        JOIN launch_requests lr ON lr.id = lrv.launch_request_id
        LEFT JOIN launch_request_editors lre ON lre.launch_request_id = lr.id AND lre.status IN ('pending', 'in_progress')
        LEFT JOIN editors e ON e.id = lre.editor_id
        WHERE 1=1
        ${verticalFilter.replace('frv.vertical', 'lrv.vertical')}
        GROUP BY lrv.vertical
        ORDER BY total_requests DESC
      `;

      const launchRequestsResult = await query(launchRequestsQuery, queryParams);

      // Merge file requests and launch requests data by vertical
      const verticalMap = new Map();

      fileRequestsResult.rows.forEach(row => {
        verticalMap.set(row.vertical, {
          vertical: row.vertical,
          file_requests: {
            total: parseInt(row.total_requests, 10),
            video: parseInt(row.video_requests, 10),
            pending: parseInt(row.pending_requests, 10),
            launched: parseInt(row.launched_requests, 10),
            closed: parseInt(row.closed_requests, 10),
            total_creatives: parseInt(row.total_creatives, 10),
            completed_creatives: parseInt(row.completed_creatives, 10),
            editors_working: row.editors_working || ''
          },
          launch_requests: {
            total: 0,
            video: 0,
            pending: 0,
            launched: 0,
            closed: 0,
            total_creatives: 0,
            completed_creatives: 0,
            editors_working: ''
          }
        });
      });

      launchRequestsResult.rows.forEach(row => {
        const existing = verticalMap.get(row.vertical);
        const launchData = {
          total: parseInt(row.total_requests, 10),
          video: parseInt(row.video_requests, 10),
          pending: parseInt(row.pending_requests, 10),
          launched: parseInt(row.launched_requests, 10),
          closed: parseInt(row.closed_requests, 10),
          total_creatives: parseInt(row.total_creatives, 10),
          completed_creatives: parseInt(row.completed_creatives, 10),
          editors_working: row.editors_working || ''
        };

        if (existing) {
          existing.launch_requests = launchData;
        } else {
          verticalMap.set(row.vertical, {
            vertical: row.vertical,
            file_requests: {
              total: 0,
              video: 0,
              pending: 0,
              launched: 0,
              closed: 0,
              total_creatives: 0,
              completed_creatives: 0,
              editors_working: ''
            },
            launch_requests: launchData
          });
        }
      });

      // For non-admin users, ensure ALL assigned verticals appear (even with 0 requests)
      if (userRole !== 'admin') {
        assignedVerticals.forEach(vertical => {
          if (!verticalMap.has(vertical)) {
            verticalMap.set(vertical, {
              vertical: vertical,
              file_requests: {
                total: 0,
                video: 0,
                pending: 0,
                launched: 0,
                closed: 0,
                total_creatives: 0,
                completed_creatives: 0,
                editors_working: ''
              },
              launch_requests: {
                total: 0,
                video: 0,
                pending: 0,
                launched: 0,
                closed: 0,
                total_creatives: 0,
                completed_creatives: 0,
                editors_working: ''
              }
            });
          }
        });
      }

      // Convert map to array and add computed fields
      const verticals = Array.from(verticalMap.values()).map(v => ({
        ...v,
        combined_total: v.file_requests.total + v.launch_requests.total,
        combined_video: v.file_requests.video + v.launch_requests.video,
        combined_pending: v.file_requests.pending + v.launch_requests.pending,
        combined_creatives: v.file_requests.total_creatives + v.launch_requests.total_creatives,
        combined_completed: v.file_requests.completed_creatives + v.launch_requests.completed_creatives,
        progress_percent: (v.file_requests.total_creatives + v.launch_requests.total_creatives) > 0
          ? Math.round(((v.file_requests.completed_creatives + v.launch_requests.completed_creatives) /
              (v.file_requests.total_creatives + v.launch_requests.total_creatives)) * 100)
          : 0
      })).sort((a, b) => b.combined_total - a.combined_total);

      res.json({
        success: true,
        data: verticals
      });

    } catch (error) {
      logger.error('Vertical dashboard error', { error: error.message, stack: error.stack });
      next(error);
    }
  }

  /**
   * Get detailed granular request data for a specific vertical
   * Shows individual requests with who requested, when accepted, assigned editors, timestamps
   */
  async getVerticalDetailedRequests(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const { vertical } = req.params;

      // Check access - admin or vertical head for this vertical
      if (userRole !== 'admin') {
        const verticalHeadsResult = await query(
          `SELECT 1 FROM vertical_heads WHERE head_editor_id = $1 AND vertical = $2`,
          [userId, vertical]
        );

        if (verticalHeadsResult.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized to view this vertical'
          });
        }
      }

      // Get detailed file requests for this vertical
      const fileRequestsQuery = `
        SELECT
          fr.id,
          fr.title,
          fr.request_type,
          fr.status,
          fr.created_at,
          fr.updated_at,
          fr.launched_at,
          fr.closed_at,
          u_creator.name as creator_name,
          u_buyer.name as buyer_name,
          STRING_AGG(DISTINCT e.display_name, ', ' ORDER BY e.display_name) as assigned_editors,
          COALESCE(SUM(fre.num_creatives_assigned), 0) as total_creatives,
          COALESCE(SUM(fre.creatives_completed), 0) as completed_creatives,
          MIN(fre.created_at) as first_assignment_at,
          MAX(fre.accepted_at) as last_accepted_at
        FROM file_request_verticals frv
        JOIN file_requests fr ON fr.id = frv.file_request_id
        LEFT JOIN users u_creator ON u_creator.id = fr.created_by
        LEFT JOIN users u_buyer ON u_buyer.id = fr.assigned_buyer_id
        LEFT JOIN file_request_editors fre ON fre.request_id = fr.id AND fre.status IN ('pending', 'accepted', 'in_progress')
        LEFT JOIN editors e ON e.id = fre.editor_id
        WHERE frv.vertical = $1 AND fr.is_active = TRUE
        GROUP BY fr.id, u_creator.name, u_buyer.name
        ORDER BY fr.created_at DESC
      `;

      const fileRequests = await query(fileRequestsQuery, [vertical]);

      // Get detailed launch requests for this vertical
      const launchRequestsQuery = `
        SELECT
          lr.id,
          lr.title,
          lr.request_type,
          lr.status,
          lr.created_at,
          lr.updated_at,
          lr.launched_at,
          lr.closed_at,
          u_creator.name as creator_name,
          u_buyer_head.name as buyer_name,
          STRING_AGG(DISTINCT e.display_name, ', ' ORDER BY e.display_name) as assigned_editors,
          COALESCE(SUM(lre.num_creatives_assigned), 0) as total_creatives,
          COALESCE(SUM(lre.creatives_completed), 0) as completed_creatives,
          MIN(lre.assigned_at) as first_assignment_at
        FROM launch_request_verticals lrv
        JOIN launch_requests lr ON lr.id = lrv.launch_request_id
        LEFT JOIN users u_creator ON u_creator.id = lr.created_by
        LEFT JOIN users u_buyer_head ON u_buyer_head.id = lr.buyer_head_id
        LEFT JOIN launch_request_editors lre ON lre.launch_request_id = lr.id AND lre.status IN ('pending', 'in_progress')
        LEFT JOIN editors e ON e.id = lre.editor_id
        WHERE lrv.vertical = $1
        GROUP BY lr.id, u_creator.name, u_buyer_head.name
        ORDER BY lr.created_at DESC
      `;

      const launchRequests = await query(launchRequestsQuery, [vertical]);

      res.json({
        success: true,
        data: {
          vertical,
          file_requests: fileRequests.rows.map(r => ({
            id: r.id,
            title: r.title,
            type: 'file_request',
            request_type: r.request_type,
            status: r.status,
            creator: r.creator_name,
            buyer: r.buyer_name,
            editors: r.assigned_editors || '—',
            total_creatives: parseInt(r.total_creatives, 10),
            completed_creatives: parseInt(r.completed_creatives, 10),
            progress_percent: parseInt(r.total_creatives, 10) > 0
              ? Math.round((parseInt(r.completed_creatives, 10) / parseInt(r.total_creatives, 10)) * 100)
              : 0,
            created_at: r.created_at,
            first_assignment_at: r.first_assignment_at,
            last_accepted_at: r.last_accepted_at,
            launched_at: r.launched_at,
            closed_at: r.closed_at
          })),
          launch_requests: launchRequests.rows.map(r => ({
            id: r.id,
            title: r.title,
            type: 'launch_request',
            request_type: r.request_type,
            status: r.status,
            creator: r.creator_name,
            buyer: r.buyer_name,
            editors: r.assigned_editors || '—',
            total_creatives: parseInt(r.total_creatives, 10),
            completed_creatives: parseInt(r.completed_creatives, 10),
            progress_percent: parseInt(r.total_creatives, 10) > 0
              ? Math.round((parseInt(r.completed_creatives, 10) / parseInt(r.total_creatives, 10)) * 100)
              : 0,
            created_at: r.created_at,
            first_assignment_at: r.first_assignment_at,
            launched_at: r.launched_at,
            closed_at: r.closed_at
          }))
        }
      });

    } catch (error) {
      logger.error('Vertical detailed requests error', { error: error.message, stack: error.stack });
      next(error);
    }
  }
}

module.exports = new AnalyticsController();
