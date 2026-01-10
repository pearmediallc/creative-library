/**
 * Workload Management Controller
 * Handles editor workload tracking, capacity management, and analytics
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

class WorkloadController {
  /**
   * Get workload overview for all editors
   * GET /api/admin/workload/overview
   */
  async getOverview(req, res, next) {
    try {
      // Get summary from view
      const result = await query(`
        SELECT
          editor_id,
          editor_name,
          display_name,
          load_percentage,
          status,
          max_concurrent_requests,
          avg_completion_time_hours,
          is_available,
          active_requests,
          completed_requests,
          total_requests
        FROM editor_workload_summary
        ORDER BY load_percentage DESC, editor_name ASC
      `);

      const editors = result.rows;

      // Calculate overview stats
      const totalEditors = editors.length;
      const activeEditors = editors.filter(e => e.is_available).length;
      const totalActiveRequests = editors.reduce((sum, e) => sum + parseInt(e.active_requests || 0), 0);
      const averageLoad = editors.length > 0
        ? editors.reduce((sum, e) => sum + parseFloat(e.load_percentage || 0), 0) / editors.length
        : 0;
      const overloadedEditors = editors.filter(e => parseFloat(e.load_percentage || 0) >= 80).length;

      // Get recent alerts
      const alertsResult = await query(`
        SELECT
          wa.id,
          wa.editor_id,
          e.name AS editor_name,
          wa.alert_type,
          wa.severity,
          wa.message,
          wa.created_at
        FROM workload_alerts wa
        JOIN editors e ON wa.editor_id = e.id
        WHERE wa.is_resolved = FALSE
        ORDER BY wa.created_at DESC
        LIMIT 10
      `);

      res.json({
        success: true,
        data: {
          summary: {
            totalEditors,
            activeEditors,
            totalActiveRequests,
            averageLoad: Math.round(averageLoad * 100) / 100,
            overloadedEditors
          },
          editors: editors.map(e => ({
            id: e.editor_id,
            name: e.editor_name,
            displayName: e.display_name,
            activeRequests: parseInt(e.active_requests || 0),
            completedRequests: parseInt(e.completed_requests || 0),
            totalRequests: parseInt(e.total_requests || 0),
            loadPercentage: parseFloat(e.load_percentage || 0),
            status: e.status || 'available',
            maxConcurrentRequests: parseInt(e.max_concurrent_requests || 10),
            avgCompletionTimeHours: parseFloat(e.avg_completion_time_hours || 0),
            isAvailable: e.is_available
          })),
          alerts: alertsResult.rows
        }
      });
    } catch (error) {
      logger.error('Get workload overview error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get detailed workload for a specific editor
   * GET /api/admin/workload/editor/:editorId
   */
  async getEditorWorkload(req, res, next) {
    try {
      const { editorId } = req.params;

      // Get editor info and capacity
      const editorResult = await query(`
        SELECT
          e.id,
          e.name,
          e.display_name,
          ec.current_load_percentage,
          ec.status,
          ec.max_concurrent_requests,
          ec.max_hours_per_week,
          ec.avg_completion_time_hours,
          ec.total_completed_requests,
          ec.is_available,
          ec.unavailable_until,
          ec.unavailable_reason
        FROM editors e
        LEFT JOIN editor_capacity ec ON e.id = ec.editor_id
        WHERE e.id = $1
      `, [editorId]);

      if (editorResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Editor not found'
        });
      }

      const editor = editorResult.rows[0];

      // Get assigned requests
      const requestsResult = await query(`
        SELECT
          fr.id,
          fr.title,
          fr.description,
          fr.request_type,
          fr.status,
          fr.priority,
          fr.complexity,
          fr.estimated_hours,
          fr.actual_hours,
          fr.deadline,
          fr.created_at,
          fre.assigned_at,
          ftt.estimated_completion,
          ftt.started_at,
          f.name AS folder_name
        FROM file_requests fr
        JOIN file_request_editors fre ON fr.id = fre.request_id
        LEFT JOIN file_request_time_tracking ftt ON fr.id = ftt.request_id
        LEFT JOIN folders f ON fr.folder_id = f.id
        WHERE fre.editor_id = $1
        ORDER BY
          CASE fr.status
            WHEN 'in_progress' THEN 1
            WHEN 'assigned' THEN 2
            WHEN 'pending' THEN 3
            ELSE 4
          END,
          fr.priority ASC,
          fr.created_at DESC
      `, [editorId]);

      // Get workload stats for last 30 days
      const statsResult = await query(`
        SELECT
          stat_date,
          active_requests,
          completed_requests,
          load_percentage,
          avg_completion_time_hours
        FROM editor_workload_stats
        WHERE editor_id = $1
          AND stat_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY stat_date DESC
      `, [editorId]);

      // Calculate additional metrics
      const requests = requestsResult.rows;
      const activeRequests = requests.filter(r => ['pending', 'assigned', 'in_progress'].includes(r.status));
      const completedRequests = requests.filter(r => r.status === 'completed');

      res.json({
        success: true,
        data: {
          editor: {
            id: editor.id,
            name: editor.name,
            displayName: editor.display_name,
            loadPercentage: parseFloat(editor.current_load_percentage || 0),
            status: editor.status,
            maxConcurrentRequests: parseInt(editor.max_concurrent_requests || 10),
            maxHoursPerWeek: parseFloat(editor.max_hours_per_week || 40),
            avgCompletionTimeHours: parseFloat(editor.avg_completion_time_hours || 0),
            totalCompletedRequests: parseInt(editor.total_completed_requests || 0),
            isAvailable: editor.is_available,
            unavailableUntil: editor.unavailable_until,
            unavailableReason: editor.unavailable_reason
          },
          requests: requests.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            requestType: r.request_type,
            status: r.status,
            priority: r.priority,
            complexity: r.complexity,
            estimatedHours: parseFloat(r.estimated_hours || 0),
            actualHours: parseFloat(r.actual_hours || 0),
            deadline: r.deadline,
            createdAt: r.created_at,
            assignedAt: r.assigned_at,
            estimatedCompletion: r.estimated_completion,
            startedAt: r.started_at,
            folderName: r.folder_name
          })),
          stats: {
            totalRequests: requests.length,
            activeRequests: activeRequests.length,
            completedRequests: completedRequests.length,
            completionRate: requests.length > 0
              ? Math.round((completedRequests.length / requests.length) * 100)
              : 0,
            history: statsResult.rows.map(s => ({
              date: s.stat_date,
              activeRequests: parseInt(s.active_requests || 0),
              completedRequests: parseInt(s.completed_requests || 0),
              loadPercentage: parseFloat(s.load_percentage || 0),
              avgCompletionTimeHours: parseFloat(s.avg_completion_time_hours || 0)
            }))
          }
        }
      });
    } catch (error) {
      logger.error('Get editor workload error', { error: error.message, editorId: req.params.editorId });
      next(error);
    }
  }

  /**
   * Update editor capacity settings
   * PUT /api/admin/workload/capacity/:editorId
   */
  async updateCapacity(req, res, next) {
    try {
      const { editorId } = req.params;
      const {
        maxConcurrentRequests,
        maxHoursPerWeek,
        isAvailable,
        unavailableUntil,
        unavailableReason
      } = req.body;

      // Verify editor exists
      const editorCheck = await query(
        'SELECT id FROM editors WHERE id = $1',
        [editorId]
      );

      if (editorCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Editor not found'
        });
      }

      // Update or insert capacity
      const result = await query(`
        INSERT INTO editor_capacity (
          editor_id,
          max_concurrent_requests,
          max_hours_per_week,
          is_available,
          unavailable_until,
          unavailable_reason,
          last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        ON CONFLICT (editor_id)
        DO UPDATE SET
          max_concurrent_requests = COALESCE($2, editor_capacity.max_concurrent_requests),
          max_hours_per_week = COALESCE($3, editor_capacity.max_hours_per_week),
          is_available = COALESCE($4, editor_capacity.is_available),
          unavailable_until = $5,
          unavailable_reason = $6,
          last_updated = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        editorId,
        maxConcurrentRequests,
        maxHoursPerWeek,
        isAvailable,
        unavailableUntil,
        unavailableReason
      ]);

      logger.info('Editor capacity updated', {
        editorId,
        updatedBy: req.user.id
      });

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      logger.error('Update capacity error', { error: error.message });
      next(error);
    }
  }

  /**
   * Update file request time estimate
   * PUT /api/file-requests/:id/estimate
   */
  async updateEstimate(req, res, next) {
    try {
      const { id } = req.params;
      const { estimatedHours, complexity, priority } = req.body;

      // Update file_requests table
      await query(`
        UPDATE file_requests
        SET
          estimated_hours = $1,
          complexity = $2,
          priority = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [estimatedHours, complexity, priority, id]);

      // Get assigned editor (if any)
      const editorResult = await query(`
        SELECT editor_id
        FROM file_request_editors
        WHERE request_id = $1
        LIMIT 1
      `, [id]);

      if (editorResult.rows.length > 0) {
        const editorId = editorResult.rows[0].editor_id;

        // Insert or update time tracking
        await query(`
          INSERT INTO file_request_time_tracking (
            request_id,
            editor_id,
            estimated_hours,
            complexity,
            priority
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (request_id)
          DO UPDATE SET
            estimated_hours = $3,
            complexity = $4,
            priority = $5,
            updated_at = CURRENT_TIMESTAMP
        `, [id, editorId, estimatedHours, complexity, priority]);
      }

      res.json({
        success: true,
        message: 'Time estimate updated successfully'
      });
    } catch (error) {
      logger.error('Update estimate error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get workload analytics
   * GET /api/admin/workload/analytics
   */
  async getAnalytics(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const end = endDate || new Date().toISOString().split('T')[0];

      // Get aggregated stats
      const statsResult = await query(`
        SELECT
          stat_date,
          SUM(active_requests) AS total_active,
          SUM(completed_requests) AS total_completed,
          AVG(load_percentage) AS avg_load,
          AVG(avg_completion_time_hours) AS avg_completion_time
        FROM editor_workload_stats
        WHERE stat_date BETWEEN $1 AND $2
        GROUP BY stat_date
        ORDER BY stat_date ASC
      `, [start, end]);

      // Get editor performance comparison
      const performanceResult = await query(`
        SELECT
          e.id,
          e.name,
          COUNT(DISTINCT fr.id) AS total_requests,
          COUNT(DISTINCT CASE WHEN fr.status = 'completed' THEN fr.id END) AS completed_requests,
          AVG(CASE WHEN fr.status = 'completed' THEN fr.actual_hours END) AS avg_actual_hours,
          AVG(ec.current_load_percentage) AS avg_load
        FROM editors e
        LEFT JOIN file_request_editors fre ON e.id = fre.editor_id
        LEFT JOIN file_requests fr ON fre.request_id = fr.id
        LEFT JOIN editor_capacity ec ON e.id = ec.editor_id
        WHERE e.is_active = TRUE
          AND (fr.created_at IS NULL OR fr.created_at BETWEEN $1 AND $2)
        GROUP BY e.id, e.name
        ORDER BY completed_requests DESC
      `, [start, end]);

      res.json({
        success: true,
        data: {
          period: { start, end },
          trends: statsResult.rows.map(s => ({
            date: s.stat_date,
            totalActive: parseInt(s.total_active || 0),
            totalCompleted: parseInt(s.total_completed || 0),
            avgLoad: parseFloat(s.avg_load || 0),
            avgCompletionTime: parseFloat(s.avg_completion_time || 0)
          })),
          editorPerformance: performanceResult.rows.map(e => ({
            editorId: e.id,
            editorName: e.name,
            totalRequests: parseInt(e.total_requests || 0),
            completedRequests: parseInt(e.completed_requests || 0),
            avgActualHours: parseFloat(e.avg_actual_hours || 0),
            avgLoad: parseFloat(e.avg_load || 0),
            completionRate: parseInt(e.total_requests || 0) > 0
              ? Math.round((parseInt(e.completed_requests || 0) / parseInt(e.total_requests || 0)) * 100)
              : 0
          }))
        }
      });
    } catch (error) {
      logger.error('Get analytics error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get workload recommendations for optimal assignment
   * GET /api/admin/workload/recommendations
   */
  async getRecommendations(req, res, next) {
    try {
      const { requestId } = req.query;

      // Get all available editors sorted by load
      const editorsResult = await query(`
        SELECT
          e.id,
          e.name,
          e.display_name,
          ec.current_load_percentage,
          ec.status,
          ec.max_concurrent_requests,
          ec.avg_completion_time_hours,
          COUNT(DISTINCT fre.request_id) AS current_requests
        FROM editors e
        LEFT JOIN editor_capacity ec ON e.id = ec.editor_id
        LEFT JOIN file_request_editors fre ON e.id = fre.editor_id
          AND fre.request_id IN (
            SELECT id FROM file_requests WHERE status IN ('pending', 'assigned', 'in_progress')
          )
        WHERE e.is_active = TRUE
          AND ec.is_available = TRUE
        GROUP BY e.id, e.name, e.display_name, ec.current_load_percentage,
                 ec.status, ec.max_concurrent_requests, ec.avg_completion_time_hours
        ORDER BY ec.current_load_percentage ASC, ec.avg_completion_time_hours ASC
      `);

      // Find overloaded editors who need redistribution
      const overloadedResult = await query(`
        SELECT
          e.id,
          e.name,
          ec.current_load_percentage,
          COUNT(DISTINCT fre.request_id) AS active_requests
        FROM editors e
        JOIN editor_capacity ec ON e.id = ec.editor_id
        JOIN file_request_editors fre ON e.id = fre.editor_id
        JOIN file_requests fr ON fre.request_id = fr.id
        WHERE ec.current_load_percentage >= 80
          AND fr.status IN ('pending', 'assigned', 'in_progress')
        GROUP BY e.id, e.name, ec.current_load_percentage
        ORDER BY ec.current_load_percentage DESC
      `);

      const recommendations = [];

      // Suggest reassignments from overloaded to available editors
      for (const overloaded of overloadedResult.rows) {
        const available = editorsResult.rows.find(e =>
          e.id !== overloaded.id && parseFloat(e.current_load_percentage || 0) < 60
        );

        if (available) {
          recommendations.push({
            type: 'redistribute',
            severity: 'high',
            fromEditor: {
              id: overloaded.id,
              name: overloaded.name,
              loadPercentage: parseFloat(overloaded.current_load_percentage)
            },
            toEditor: {
              id: available.id,
              name: available.name,
              loadPercentage: parseFloat(available.current_load_percentage || 0)
            },
            reason: `${overloaded.name} is overloaded (${Math.round(overloaded.current_load_percentage)}%), ` +
                    `${available.name} has capacity (${Math.round(available.current_load_percentage || 0)}%)`
          });
        }
      }

      res.json({
        success: true,
        data: {
          availableEditors: editorsResult.rows.map(e => ({
            id: e.id,
            name: e.name,
            displayName: e.display_name,
            loadPercentage: parseFloat(e.current_load_percentage || 0),
            status: e.status,
            currentRequests: parseInt(e.current_requests || 0),
            maxConcurrentRequests: parseInt(e.max_concurrent_requests || 10),
            avgCompletionTimeHours: parseFloat(e.avg_completion_time_hours || 0),
            recommended: parseFloat(e.current_load_percentage || 0) < 50
          })),
          recommendations
        }
      });
    } catch (error) {
      logger.error('Get recommendations error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new WorkloadController();
