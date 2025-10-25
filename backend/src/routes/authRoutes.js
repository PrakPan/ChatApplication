const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validation');
const validators = require('../utils/validators');
const { authLimiter } = require('../middleware/rateLimiter');

router.post('/register', authLimiter, validate(validators.register), register);
router.post('/login', authLimiter, validate(validators.login), login);
router.post('/refresh-token', refreshAccessToken);
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, validate(validators.updateProfile), updateProfile);
router.put('/change-password', authenticate, changePassword);

module.exports = router;

