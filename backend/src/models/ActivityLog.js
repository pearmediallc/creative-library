/**
 * ActivityLog Model
 * Handles activity logging for audit trail
 */

const BaseModel = require('./BaseModel');

class ActivityLog extends BaseModel {
  constructor() {
    super('activity_logs');
  }

  /**
   * Create an activity log entry
   * @param {Object} logData - Activity log data
   * @returns {Promise<Object>} Created log entry
   */
  async createLog({
    userId,
    userEmail,
    userRole,
    actionType,
    resourceType,
    resourceId,
    resourceName,
    details,
    ipAddress,
    userAgent,
    status = 'success',
    errorMessage = null
  }) {
    const sql = `
      INSERT INTO activity_logs (
        user_id,
        user_email,
        user_role,
        action_type,
        resource_type,
        resource_id,
        resource_name,
        details,
        ip_address,
        user_agent,
        status,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      userId || null,
      userEmail || null,
      userRole || null,
      actionType,
      resourceType || null,
      resourceId || null,
      resourceName || null,
      details ? JSON.stringify(details) : null,
      ipAddress || null,
      userAgent || null,
      status,
      errorMessage
    ];

    const result = await this.raw(sql, values);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows[0];
  }

  /**
   * Get activity logs with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Activity logs
   */
  async getLogs(filters = {}) {
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.userEmail) {
      conditions.push(`user_email ILIKE $${paramIndex++}`);
      params.push(`%${filters.userEmail}%`);
    }

    if (filters.actionType) {
      conditions.push(`action_type = $${paramIndex++}`);
      params.push(filters.actionType);
    }

    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(filters.resourceType);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.dateFrom) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.dateTo);
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const sql = `
      SELECT *
      FROM activity_logs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const result = await this.raw(sql, params);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows;
  }

  /**
   * Get log count with filters
   * @param {Object} filters - Filter options
   * @returns {Promise<number>} Total count
   */
  async getCount(filters = {}) {
    const conditions = ['1=1'];
    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }

    if (filters.userEmail) {
      conditions.push(`user_email ILIKE $${paramIndex++}`);
      params.push(`%${filters.userEmail}%`);
    }

    if (filters.actionType) {
      conditions.push(`action_type = $${paramIndex++}`);
      params.push(filters.actionType);
    }

    if (filters.resourceType) {
      conditions.push(`resource_type = $${paramIndex++}`);
      params.push(filters.resourceType);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.dateFrom) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.dateTo);
    }

    const sql = `
      SELECT COUNT(*) as total
      FROM activity_logs
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.raw(sql, params);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return parseInt(rows[0]?.total || 0);
  }

  /**
   * Get unique action types
   * @returns {Promise<Array>} List of action types
   */
  async getActionTypes() {
    const sql = `
      SELECT DISTINCT action_type
      FROM activity_logs
      ORDER BY action_type ASC
    `;

    const result = await this.raw(sql);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows.map(row => row.action_type);
  }

  /**
   * Get unique resource types
   * @returns {Promise<Array>} List of resource types
   */
  async getResourceTypes() {
    const sql = `
      SELECT DISTINCT resource_type
      FROM activity_logs
      WHERE resource_type IS NOT NULL
      ORDER BY resource_type ASC
    `;

    const result = await this.raw(sql);
    const rows = Array.isArray(result) ? result : (result.rows || []);
    return rows.map(row => row.resource_type);
  }
}

module.exports = new ActivityLog();
