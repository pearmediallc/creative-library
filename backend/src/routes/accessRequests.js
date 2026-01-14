const express = require('express');
const router = express.Router();
const accessRequestController = require('../controllers/accessRequestController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/access-requests
 * @desc    Create a new access request
 * @access  Private
 */
router.post('/', accessRequestController.createRequest);

/**
 * @route   GET /api/access-requests/my-requests
 * @desc    Get my access requests (requests I made)
 * @access  Private
 */
router.get('/my-requests', accessRequestController.getMyRequests);

/**
 * @route   GET /api/access-requests/to-review
 * @desc    Get requests I need to review/approve
 * @access  Private
 */
router.get('/to-review', accessRequestController.getRequestsToReview);

/**
 * @route   GET /api/access-requests/counts
 * @desc    Get request counts for dashboard badge
 * @access  Private
 */
router.get('/counts', accessRequestController.getRequestCounts);

/**
 * @route   GET /api/access-requests/resource/:resourceType/:resourceId
 * @desc    Get all requests for a specific resource
 * @access  Private
 */
router.get('/resource/:resourceType/:resourceId', accessRequestController.getRequestsForResource);

/**
 * @route   POST /api/access-requests/:id/approve
 * @desc    Approve an access request
 * @access  Private
 */
router.post('/:id/approve', accessRequestController.approveRequest);

/**
 * @route   POST /api/access-requests/:id/deny
 * @desc    Deny an access request
 * @access  Private
 */
router.post('/:id/deny', accessRequestController.denyRequest);

/**
 * @route   POST /api/access-requests/:id/cancel
 * @desc    Cancel an access request (by requester)
 * @access  Private
 */
router.post('/:id/cancel', accessRequestController.cancelRequest);

/**
 * @route   POST /api/access-requests/watchers
 * @desc    Add a watcher to a resource
 * @access  Private
 */
router.post('/watchers', accessRequestController.addWatcher);

/**
 * @route   DELETE /api/access-requests/watchers
 * @desc    Remove a watcher from a resource
 * @access  Private
 */
router.delete('/watchers', accessRequestController.removeWatcher);

/**
 * @route   GET /api/access-requests/watchers/:resourceType/:resourceId
 * @desc    Get watchers for a resource
 * @access  Private
 */
router.get('/watchers/:resourceType/:resourceId', accessRequestController.getWatchers);

module.exports = router;
