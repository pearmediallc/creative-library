/**
 * Activity Logger Middleware
 * Logs user actions for audit trail
 */

const ActivityLog = require('../models/ActivityLog');

/**
 * Helper to log activity
 * Can be called manually or used as middleware
 */
async function logActivity({
  req,
  actionType,
  resourceType,
  resourceId,
  resourceName,
  details,
  status = 'success',
  errorMessage = null
}) {
  try {
    const userId = req.user?.id || null;
    const userEmail = req.user?.email || null;
    const userRole = req.user?.role || null;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    await ActivityLog.createLog({
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
      status,
      errorMessage
    });

    console.log(`📝 Activity logged: ${actionType} by ${userEmail || 'anonymous'}`);
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('❌ Failed to log activity:', error.message);
  }
}

/**
 * Middleware to automatically log certain actions
 */
function activityLoggerMiddleware(actionType, getResourceInfo) {
  return async (req, res, next) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override res.json to capture response
    res.json = function(data) {
      // Log activity after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const resourceInfo = getResourceInfo ? getResourceInfo(req, data) : {};

        logActivity({
          req,
          actionType,
          resourceType: resourceInfo.resourceType,
          resourceId: resourceInfo.resourceId,
          resourceName: resourceInfo.resourceName,
          details: resourceInfo.details,
          status: 'success'
        }).catch(err => console.error('Logging error:', err));
      } else {
        // Log failure
        logActivity({
          req,
          actionType,
          status: 'failed',
          errorMessage: data.error || data.message || 'Unknown error'
        }).catch(err => console.error('Logging error:', err));
      }

      return originalJson(data);
    };

    next();
  };
}

module.exports = {
  logActivity,
  activityLoggerMiddleware
};
