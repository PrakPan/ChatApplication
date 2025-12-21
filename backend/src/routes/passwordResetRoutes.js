// routes/passwordResetRoutes.js
const express = require('express');
const router = express.Router();
const {
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  resendOTP
} = require('../controllers/passwordResetController');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/request-reset', requestPasswordReset);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);
router.post('/resend-otp', resendOTP);

module.exports = router;