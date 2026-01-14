const accessRequestService = require('../services/accessRequestService');
const Notification = require('../models/Notification');

/**
 * Access Request Controller
 * Handles API endpoints for resource access requests
 */

/**
 * Create a new access request
 * POST /api/access-requests
 */
async function createRequest(req, res) {
  try {
    const requesterId = req.user.id;
    const { resourceType, resourceId, requestedPermission, reason, expiresAt } = req.body;

    if (!resourceType || !resourceId || !requestedPermission) {
      return res.status(400).json({
        success: false,
        error: 'resourceType, resourceId, and requestedPermission are required'
      });
    }

    // Create the request
    const request = await accessRequestService.createRequest(
      requesterId,
      resourceType,
      resourceId,
      requestedPermission,
      { reason, expiresAt }
    );

    // Get watchers to notify
    const watchers = await accessRequestService.getWatchers(resourceType, resourceId);

    // Send notifications to all watchers using existing notification service
    for (const watcher of watchers) {
      if (watcher.notify_on_request) {
        await Notification.create({
          userId: watcher.user_id,
          type: 'access_request',
          title: 'New Access Request',
          message: `${req.user.name} is requesting ${requestedPermission} access to your ${resourceType}`,
          referenceType: 'access_request',
          referenceId: request.id,
          metadata: {
            requestId: request.id,
            requesterId,
            requesterName: req.user.name,
            resourceType,
            resourceId,
            requestedPermission,
            reason
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      message: 'Access request submitted successfully',
      data: request
    });
  } catch (error) {
    console.error('Error creating access request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create access request'
    });
  }
}

/**
 * Get my access requests (requests I made)
 * GET /api/access-requests/my-requests
 */
async function getMyRequests(req, res) {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const requests = await accessRequestService.getMyRequests(userId, status);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error getting my requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get requests'
    });
  }
}

/**
 * Get requests I need to review
 * GET /api/access-requests/to-review
 */
async function getRequestsToReview(req, res) {
  try {
    const reviewerId = req.user.id;

    const requests = await accessRequestService.getPendingRequestsForReviewer(reviewerId);

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error getting requests to review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get requests'
    });
  }
}

/**
 * Get requests for a specific resource
 * GET /api/access-requests/resource/:resourceType/:resourceId
 */
async function getRequestsForResource(req, res) {
  try {
    const { resourceType, resourceId } = req.params;
    const { status } = req.query;

    const requests = await accessRequestService.getRequestsForResource(
      resourceType,
      resourceId,
      status
    );

    res.json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error getting requests for resource:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get requests'
    });
  }
}

/**
 * Approve an access request
 * POST /api/access-requests/:id/approve
 */
async function approveRequest(req, res) {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;
    const { reviewNotes } = req.body;

    const request = await accessRequestService.approveRequest(id, reviewerId, reviewNotes);

    // Notify the requester using existing notification service
    await Notification.create({
      userId: request.requester_id,
      type: 'access_request_approved',
      title: 'Access Request Approved',
      message: `Your request for ${request.requested_permission} access has been approved`,
      referenceType: request.resource_type,
      referenceId: request.resource_id,
      metadata: {
        requestId: id,
        reviewerId,
        reviewerName: req.user.name,
        resourceType: request.resource_type,
        resourceId: request.resource_id,
        requestedPermission: request.requested_permission,
        reviewNotes
      }
    });

    res.json({
      success: true,
      message: 'Access request approved',
      data: request
    });
  } catch (error) {
    console.error('Error approving request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve request'
    });
  }
}

/**
 * Deny an access request
 * POST /api/access-requests/:id/deny
 */
async function denyRequest(req, res) {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;
    const { reviewNotes } = req.body;

    const request = await accessRequestService.denyRequest(id, reviewerId, reviewNotes);

    // Notify the requester
    await Notification.create({
      userId: request.requester_id,
      type: 'access_request_denied',
      title: 'Access Request Denied',
      message: `Your request for ${request.requested_permission} access was denied`,
      referenceType: request.resource_type,
      referenceId: request.resource_id,
      metadata: {
        requestId: id,
        reviewerId,
        reviewerName: req.user.name,
        resourceType: request.resource_type,
        resourceId: request.resource_id,
        requestedPermission: request.requested_permission,
        reviewNotes
      }
    });

    res.json({
      success: true,
      message: 'Access request denied',
      data: request
    });
  } catch (error) {
    console.error('Error denying request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to deny request'
    });
  }
}

/**
 * Cancel an access request
 * POST /api/access-requests/:id/cancel
 */
async function cancelRequest(req, res) {
  try {
    const { id } = req.params;
    const requesterId = req.user.id;

    const request = await accessRequestService.cancelRequest(id, requesterId);

    res.json({
      success: true,
      message: 'Access request cancelled',
      data: request
    });
  } catch (error) {
    console.error('Error cancelling request:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel request'
    });
  }
}

/**
 * Get request counts for dashboard
 * GET /api/access-requests/counts
 */
async function getRequestCounts(req, res) {
  try {
    const userId = req.user.id;

    const counts = await accessRequestService.getRequestCounts(userId);

    res.json({
      success: true,
      data: counts
    });
  } catch (error) {
    console.error('Error getting request counts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get counts'
    });
  }
}

/**
 * Add a watcher to a resource
 * POST /api/access-requests/watchers
 */
async function addWatcher(req, res) {
  try {
    const addedBy = req.user.id;
    const { resourceType, resourceId, userId, canApprove } = req.body;

    if (!resourceType || !resourceId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'resourceType, resourceId, and userId are required'
      });
    }

    const watcher = await accessRequestService.addWatcher(
      resourceType,
      resourceId,
      userId,
      canApprove !== undefined ? canApprove : true,
      addedBy
    );

    res.json({
      success: true,
      message: 'Watcher added successfully',
      data: watcher
    });
  } catch (error) {
    console.error('Error adding watcher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add watcher'
    });
  }
}

/**
 * Remove a watcher from a resource
 * DELETE /api/access-requests/watchers
 */
async function removeWatcher(req, res) {
  try {
    const { resourceType, resourceId, userId } = req.body;

    if (!resourceType || !resourceId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'resourceType, resourceId, and userId are required'
      });
    }

    const removed = await accessRequestService.removeWatcher(resourceType, resourceId, userId);

    res.json({
      success: true,
      message: removed ? 'Watcher removed successfully' : 'Watcher not found'
    });
  } catch (error) {
    console.error('Error removing watcher:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove watcher'
    });
  }
}

/**
 * Get watchers for a resource
 * GET /api/access-requests/watchers/:resourceType/:resourceId
 */
async function getWatchers(req, res) {
  try {
    const { resourceType, resourceId } = req.params;

    const watchers = await accessRequestService.getWatchers(resourceType, resourceId);

    res.json({
      success: true,
      data: watchers
    });
  } catch (error) {
    console.error('Error getting watchers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get watchers'
    });
  }
}

module.exports = {
  createRequest,
  getMyRequests,
  getRequestsToReview,
  getRequestsForResource,
  approveRequest,
  denyRequest,
  cancelRequest,
  getRequestCounts,
  addWatcher,
  removeWatcher,
  getWatchers
};
