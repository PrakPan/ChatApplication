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

router.post('/request-reset', authLimiter, requestPasswordReset);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/resend-otp', authLimiter, resendOTP);

module.exports = router;