/**
 * Facebook Authentication Routes
 * Facebook OAuth and ad account management
 */

const express = require('express');
const router = express.Router();
const facebookAuthController = require('../controllers/facebookAuthController');
const { authenticateToken } = require('../middleware/auth');

// Connect Facebook account (store access token)
router.post('/connect',
  authenticateToken,
  facebookAuthController.connectFacebook.bind(facebookAuthController)
);

// Get accessible ad accounts
router.get('/ad-accounts',
  authenticateToken,
  facebookAuthController.getAdAccounts.bind(facebookAuthController)
);

// Update selected ad account
router.put('/ad-account',
  authenticateToken,
  facebookAuthController.updateAdAccount.bind(facebookAuthController)
);

// Get Facebook connection status
router.get('/status',
  authenticateToken,
  facebookAuthController.getStatus.bind(facebookAuthController)
);

// Disconnect Facebook account
router.delete('/disconnect',
  authenticateToken,
  facebookAuthController.disconnect.bind(facebookAuthController)
);

module.exports = router;
