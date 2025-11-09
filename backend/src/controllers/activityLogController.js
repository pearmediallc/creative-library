/**
 * Activity Log Controller
 * Handles activity log API endpoints
 */

const ActivityLog = require('../models/ActivityLog');
const logger = require('../utils/logger');

class ActivityLogController {
  /**
   * Get activity logs
   * GET /api/activity-logs
   */
  async getLogs(req, res, next) {
    try {
      const filters = {
        userId: req.query.user_id,
        userEmail: req.query.user_email,
        actionType: req.query.action_type,
        resourceType: req.query.resource_type,
        status: req.query.status,
        dateFrom: req.query.date_from,
        dateTo: req.query.date_to,
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0
      };

      const [logs, total] = await Promise.all([
        ActivityLog.getLogs(filters),
        ActivityLog.getCount(filters)
      ]);

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            total,
            limit: filters.limit,
            offset: filters.offset,
            hasMore: filters.offset + logs.length < total
          }
        }
      });
    } catch (error) {
      logger.error('Get activity logs error', { error: error.message });
      next(error);
    }
  }

  /**
   * Get filter options (action types, resource types)
   * GET /api/activity-logs/filters
   */
  async getFilters(req, res, next) {
    try {
      const [actionTypes, resourceTypes] = await Promise.all([
        ActivityLog.getActionTypes(),
        ActivityLog.getResourceTypes()
      ]);

      res.json({
        success: true,
        data: {
          actionTypes,
          resourceTypes
        }
      });
    } catch (error) {
      logger.error('Get activity log filters error', { error: error.message });
      next(error);
    }
  }
}

module.exports = new ActivityLogController();
