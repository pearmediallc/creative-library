const { query } = require('../config/database');
const permissionService = require('./permissionService');

/**
 * Access Request Service
 * Handles user requests for access to resources
 */

class AccessRequestService {

  /**
   * Create a new access request
   */
  async createRequest(requesterId, resourceType, resourceId, requestedPermission, options = {}) {
    try {
      const { reason = null, expiresAt = null } = options;

      // Check if there's already a pending request
      const existingResult = await query(
        `SELECT * FROM access_requests
         WHERE requester_id = $1
           AND resource_type = $2
           AND resource_id = $3
           AND requested_permission = $4
           AND status = 'pending'`,
        [requesterId, resourceType, resourceId, requestedPermission]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('You already have a pending request for this resource');
      }

      // Create the request
      const result = await query(
        `INSERT INTO access_requests (requester_id, resource_type, resource_id, requested_permission, reason, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [requesterId, resourceType, resourceId, requestedPermission, reason, expiresAt]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating access request:', error);
      throw error;
    }
  }

  /**
   * Get all access requests for a user (requests they made)
   */
  async getMyRequests(userId, status = null) {
    try {
      let sql = `
        SELECT * FROM access_requests_detailed
        WHERE requester_id = $1
      `;
      const params = [userId];

      if (status) {
        sql += ' AND status = $2';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting my requests:', error);
      throw error;
    }
  }

  /**
   * Get all access requests that a user can review/approve
   */
  async getPendingRequestsForReviewer(reviewerId) {
    try {
      const result = await query(
        `SELECT DISTINCT ar.*
         FROM access_requests_detailed ar
         JOIN access_request_watchers arw
           ON ar.resource_type = arw.resource_type
           AND ar.resource_id = arw.resource_id
         WHERE arw.user_id = $1
           AND arw.can_approve = TRUE
           AND ar.status = 'pending'
         ORDER BY ar.created_at DESC`,
        [reviewerId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting pending requests for reviewer:', error);
      throw error;
    }
  }

  /**
   * Get all access requests for a specific resource
   */
  async getRequestsForResource(resourceType, resourceId, status = null) {
    try {
      let sql = `
        SELECT * FROM access_requests_detailed
        WHERE resource_type = $1 AND resource_id = $2
      `;
      const params = [resourceType, resourceId];

      if (status) {
        sql += ' AND status = $3';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting requests for resource:', error);
      throw error;
    }
  }

  /**
   * Approve an access request and grant permission
   */
  async approveRequest(requestId, reviewerId, reviewNotes = null) {
    try {
      // Get the request
      const requestResult = await query(
        'SELECT * FROM access_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error('Access request not found');
      }

      const request = requestResult.rows[0];

      if (request.status !== 'pending') {
        throw new Error('Request has already been reviewed');
      }

      // Verify reviewer has permission to approve
      const canApprove = await this._canUserApproveRequest(reviewerId, request);
      if (!canApprove) {
        throw new Error('You do not have permission to approve this request');
      }

      // Grant the permission
      const grantedPermission = await permissionService.grantPermission(
        reviewerId,
        request.requester_id,
        request.resource_type,
        request.requested_permission,
        'allow',
        {
          resourceId: request.resource_id,
          expiresAt: request.expires_at,
          reason: `Approved access request: ${request.reason || 'No reason provided'}`
        }
      );

      // Update the request status
      const result = await query(
        `UPDATE access_requests
         SET status = 'approved',
             reviewed_by = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             review_notes = $2,
             permission_granted = TRUE,
             granted_permission_id = $3
         WHERE id = $4
         RETURNING *`,
        [reviewerId, reviewNotes, grantedPermission.id, requestId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error approving request:', error);
      throw error;
    }
  }

  /**
   * Deny an access request
   */
  async denyRequest(requestId, reviewerId, reviewNotes = null) {
    try {
      // Get the request
      const requestResult = await query(
        'SELECT * FROM access_requests WHERE id = $1',
        [requestId]
      );

      if (requestResult.rows.length === 0) {
        throw new Error('Access request not found');
      }

      const request = requestResult.rows[0];

      if (request.status !== 'pending') {
        throw new Error('Request has already been reviewed');
      }

      // Verify reviewer has permission to deny
      const canApprove = await this._canUserApproveRequest(reviewerId, request);
      if (!canApprove) {
        throw new Error('You do not have permission to deny this request');
      }

      // Update the request status
      const result = await query(
        `UPDATE access_requests
         SET status = 'denied',
             reviewed_by = $1,
             reviewed_at = CURRENT_TIMESTAMP,
             review_notes = $2
         WHERE id = $3
         RETURNING *`,
        [reviewerId, reviewNotes, requestId]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error denying request:', error);
      throw error;
    }
  }

  /**
   * Cancel an access request (by requester)
   */
  async cancelRequest(requestId, requesterId) {
    try {
      const result = await query(
        `UPDATE access_requests
         SET status = 'cancelled'
         WHERE id = $1 AND requester_id = $2 AND status = 'pending'
         RETURNING *`,
        [requestId, requesterId]
      );

      if (result.rows.length === 0) {
        throw new Error('Request not found or cannot be cancelled');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error cancelling request:', error);
      throw error;
    }
  }

  /**
   * Add a watcher for a resource (someone who can approve requests)
   */
  async addWatcher(resourceType, resourceId, userId, canApprove = true, addedBy) {
    try {
      const result = await query(
        `INSERT INTO access_request_watchers (resource_type, resource_id, user_id, can_approve, added_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (resource_type, resource_id, user_id)
         DO UPDATE SET can_approve = EXCLUDED.can_approve, notify_on_request = TRUE
         RETURNING *`,
        [resourceType, resourceId, userId, canApprove, addedBy]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error adding watcher:', error);
      throw error;
    }
  }

  /**
   * Remove a watcher
   */
  async removeWatcher(resourceType, resourceId, userId) {
    try {
      const result = await query(
        `DELETE FROM access_request_watchers
         WHERE resource_type = $1 AND resource_id = $2 AND user_id = $3
         RETURNING *`,
        [resourceType, resourceId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error removing watcher:', error);
      throw error;
    }
  }

  /**
   * Get watchers for a resource
   */
  async getWatchers(resourceType, resourceId) {
    try {
      const result = await query(
        `SELECT arw.*, u.name, u.email
         FROM access_request_watchers arw
         JOIN users u ON arw.user_id = u.id
         WHERE arw.resource_type = $1 AND arw.resource_id = $2`,
        [resourceType, resourceId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting watchers:', error);
      throw error;
    }
  }

  /**
   * Get counts for dashboard
   */
  async getRequestCounts(userId) {
    try {
      // Count of requests I made
      const myRequestsResult = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE status = 'approved') as approved,
           COUNT(*) FILTER (WHERE status = 'denied') as denied
         FROM access_requests
         WHERE requester_id = $1`,
        [userId]
      );

      // Count of requests I can review
      const toReviewResult = await query(
        `SELECT COUNT(DISTINCT ar.id) as count
         FROM access_requests ar
         JOIN access_request_watchers arw
           ON ar.resource_type = arw.resource_type
           AND ar.resource_id = arw.resource_id
         WHERE arw.user_id = $1
           AND arw.can_approve = TRUE
           AND ar.status = 'pending'`,
        [userId]
      );

      return {
        myRequests: myRequestsResult.rows[0],
        toReview: parseInt(toReviewResult.rows[0].count)
      };
    } catch (error) {
      console.error('Error getting request counts:', error);
      throw error;
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Check if user can approve a request
   */
  async _canUserApproveRequest(userId, request) {
    try {
      const result = await query(
        `SELECT 1 FROM access_request_watchers
         WHERE resource_type = $1
           AND resource_id = $2
           AND user_id = $3
           AND can_approve = TRUE`,
        [request.resource_type, request.resource_id, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking if user can approve:', error);
      return false;
    }
  }
}

module.exports = new AccessRequestService();
