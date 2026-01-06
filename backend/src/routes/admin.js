/**
 * Admin Routes
 * User and editor management (admin only)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { validate, schemas } = require('../middleware/validate');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All admin routes require admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// User management
router.get('/users',
  adminController.getUsers.bind(adminController)
);

// Admin user creation - email whitelist will be bypassed automatically via middleware check
router.post('/users',
  validate(schemas.createUser),
  adminController.createUser.bind(adminController)
);

router.patch('/users/:id',
  validate(schemas.updateUser),
  adminController.updateUser.bind(adminController)
);

// System statistics
router.get('/stats',
  adminController.getSystemStats.bind(adminController)
);

// Approval workflow
router.get('/pending-users',
  adminController.getPendingUsers.bind(adminController)
);

router.post('/approve-user/:id',
  adminController.approveUser.bind(adminController)
);

router.post('/reject-user/:id',
  adminController.rejectUser.bind(adminController)
);

// Password management
router.post('/users/:id/reset-password',
  adminController.resetUserPassword.bind(adminController)
);

// Email whitelist management
router.get('/allowed-emails',
  adminController.getAllowedEmails.bind(adminController)
);

router.post('/allowed-emails',
  adminController.addAllowedEmail.bind(adminController)
);

router.post('/allowed-emails/bulk-import',
  adminController.bulkImportEmails.bind(adminController)
);

router.delete('/allowed-emails/:id',
  adminController.removeAllowedEmail.bind(adminController)
);

module.exports = router;
